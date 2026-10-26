import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createXlsx } from '../../shared/xlsx.js';
import { bad, ok, parseBody } from '../../shared/response.js';
import { principal, requireSupervisor } from '../../shared/auth.js';
import { ddb, tableName } from '../../shared/dynamodb.js';
import { s3, uploadBucket, presignedGet } from '../../shared/s3.js';
import { payrollSchema } from '../../shared/validation.js';
import { classifyShift } from '../../shared/nightShift.js';

type AnyItem = Record<string, any>;
function day(value?: string) { return value ? String(value).slice(0, 10) : ''; }
function time(value?: string) { if (!value) return ''; try { return new Date(value).toLocaleTimeString('en-ZA', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Africa/Johannesburg' }); } catch { return String(value).slice(11, 19); } }
function dateOnly(value?: string) { if (!value) return ''; try { return new Date(value).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg' }); } catch { return day(value); } }
function monthKey(value?: string) { return day(value).slice(0, 7); }
function within(value: string | undefined, start: string, end: string) { const d = day(value); return !!d && d >= start && d <= end; }
function csvEscape(value: unknown) { const s = String(value ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function meterDiff(r: AnyItem) { const a = Number(r.startMeterReading); const b = Number(r.closingMeterReading); return Number.isFinite(a) && Number.isFinite(b) ? Number((b-a).toFixed(2)) : ''; }
function shiftMetrics(r: AnyItem) {
  if (r.clockInTime && r.clockOutTime) return classifyShift(r.serverClockInTime || r.clockInTime, r.serverClockOutTime || r.clockOutTime);
  const fallback = r.clockInTime || r.serverClockInTime || new Date().toISOString();
  const provisional = classifyShift(fallback);
  return { ...provisional, shiftType: r.shiftType || provisional.shiftType, nightShift: typeof r.nightShift === 'boolean' ? r.nightShift : provisional.nightShift, totalHours: Number(r.totalHours || 0), nightHours: Number(r.nightHours || 0), dayHours: Number(r.dayHours || 0), payrollDate: r.payrollDate || provisional.payrollDate, shiftWindowLabel: r.shiftWindowLabel || provisional.shiftWindowLabel };
}
function payrollDay(r: AnyItem) { return r.payrollDate || shiftMetrics(r).payrollDate || day(r.clockInTime || r.serverClockInTime); }
async function scanAll(): Promise<AnyItem[]> { const out: AnyItem[] = []; let ExclusiveStartKey: any; do { const r = await ddb.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey })); out.push(...(r.Items || [])); ExclusiveStartKey = r.LastEvaluatedKey; } while (ExclusiveStartKey); return out; }
async function photoUrl(key?: string) { if (!key || String(key).startsWith('PHOTO_PENDING')) return key || ''; try { return await presignedGet(String(key)); } catch { return String(key); } }
async function photoUrls(keys?: string[]) { if (!Array.isArray(keys) || !keys.length) return ''; return (await Promise.all(keys.map((k)=>photoUrl(k)))).join(' | '); }

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const p = principal(event);
    requireSupervisor(p);
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    const all = await scanAll();

    if (method === 'GET' && path === '/supervisor/payroll/filters') {
      const employees = all.filter((r) => r.entity === 'EMPLOYEE' && r.status !== 'INACTIVE').map((r) => ({ employeeNumber: r.employeeNumber, fullName: r.fullName || r.employeeNumber, role: r.role || 'worker', status: r.status || 'ACTIVE', siteIds: r.siteIds || ['ALL'] })).sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));
      const sites = all.filter((r) => r.entity === 'SITE' && r.status !== 'INACTIVE').map((r) => ({ siteId: r.siteId, name: r.name || r.siteId, status: r.status || 'ACTIVE' })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      return ok({ employees, sites });
    }

    const body = payrollSchema.parse(parseBody(event));
    const siteFilter = body.site && body.site !== 'ALL';
    const shifts = all.filter((r) => r.entity === 'SHIFT')
      .filter((r) => { const d = payrollDay(r); return d >= body.startDate && d <= body.endDate; })
      .filter((r) => !siteFilter || r.siteId === body.site)
      .filter((r) => !body.workerId || r.employeeNumber === body.workerId)
      .filter((r) => body.status === 'All' || r.status === body.status)
      .sort((a,b) => String(a.clockInTime).localeCompare(String(b.clockInTime)));
    const related = (entity: string) => all.filter((r) => r.entity === entity).filter((r) => within(r.createdAt || r.timestamp || r.clientTimestamp || r.distributedAt, body.startDate, body.endDate)).filter((r) => !siteFilter || r.siteId === body.site).filter((r) => !body.workerId || r.employeeNumber === body.workerId);
    const checklistResponses = shifts.flatMap((s) => (s.checklist || []).map((i:any) => ({ shiftId: s.shiftId, employeeNumber: s.employeeNumber, siteId: s.siteId, machineId: s.machineId, clockInDate: dateOnly(s.clockInTime), clockInTime: time(s.clockInTime), itemId: i.id, checklistItem: i.label, defectClass: i.defectClass, decision: i.decision, remarks: i.remarks || '', checklistReportId: s.checklistReportId || '' })));
    const checklistReports = related('CHECKLIST_REPORT').flatMap((r) => (r.items || []).map((i:any) => ({ reportId: r.reportId, employeeNumber: r.employeeNumber, siteId: r.siteId, machineId: r.machineId, createdDate: dateOnly(r.createdAt), createdTime: time(r.createdAt), status: r.status, reportSeverity: r.reportSeverity, requiredAction: r.requiredAction, machineBlocked: r.machineBlocked ? 'YES' : 'NO', defectClass: i.defectClass, checklistItem: i.label, remarks: i.remarks, gps: r.gps ? `${r.gps.lat},${r.gps.lng}` : '' })));
    const fuel = related('FUEL'); const fuelForUsage = all.filter((r)=>r.entity==='FUEL').filter((r)=>within(r.distributedAt || r.createdAt || r.timestamp, body.startDate, body.endDate)).filter((r)=>!siteFilter || r.siteId===body.site).filter((r)=>!body.workerId || r.employeeNumber===body.workerId); const breakdowns = related('BREAKDOWN'); const emergencies = related('EMERGENCY');
    const tx = all.filter((r)=>r.entity==='FUEL_TRANSACTION').filter((r)=>within(r.createdAt,body.startDate,body.endDate));
    const fuelUsageMap = new Map<string, AnyItem>();
    for (const r of fuelForUsage.filter((x)=>Number(x.distributedLitres)>0)) {
      const key = `${monthKey(r.distributedAt || r.createdAt)}#${r.machineId || ''}`;
      const current = fuelUsageMap.get(key) || { month: monthKey(r.distributedAt || r.createdAt), machineId: r.machineId || '', totalLitres: 0, requestCount: 0 };
      current.totalLitres = Number((Number(current.totalLitres) + Number(r.distributedLitres || 0)).toFixed(2));
      current.requestCount += 1;
      fuelUsageMap.set(key, current);
    }
    const fuelUsageRows = [...fuelUsageMap.values()].sort((a,b)=>`${a.month}${a.machineId}`.localeCompare(`${b.month}${b.machineId}`));

    const format = body.format || 'xlsx';
    const key = `exports/workforce-export-${body.startDate}-to-${body.endDate}-${Date.now()}.${format}`;
    let bodyData: Buffer | string; let contentType = 'text/csv';
    if (format === 'xlsx') {
      const shiftRows = await Promise.all(shifts.map(async (r) => {
        const metrics = shiftMetrics(r);
        return { employeeNumber: r.employeeNumber, fullName: r.fullName || '', siteId: r.siteId, machineId: r.machineId, status: r.status, payrollDate: metrics.payrollDate, shiftType: metrics.shiftType, nightShift: metrics.nightShift ? 'YES' : 'NO', shiftWindowLabel: metrics.shiftWindowLabel, clockInDate: dateOnly(r.clockInTime), clockInTime: time(r.clockInTime), clockOutDate: dateOnly(r.clockOutTime), clockOutTime: time(r.clockOutTime), totalHours: r.totalHours || metrics.totalHours || '', nightHours: r.nightHours ?? metrics.nightHours, dayHours: r.dayHours ?? metrics.dayHours, startMeterReading: r.startMeterReading ?? '', closingMeterReading: r.closingMeterReading ?? '', meterDifference: meterDiff(r), gpsStart: r.gpsStart ? `${r.gpsStart.lat},${r.gpsStart.lng}` : '', gpsEnd: r.gpsEnd ? `${r.gpsEnd.lat},${r.gpsEnd.lng}` : '', startMeterPhotoLink: await photoUrl(r.startMeterPhoto), closingMeterPhotoLink: await photoUrl(r.closingMeterPhoto), checklistReportId: r.checklistReportId || '' };
      }));
      const fuelRows = await Promise.all(fuel.map(async (r) => ({ requestId:r.fuelId, employeeNumber:r.employeeNumber, machineId:r.machineId, fuelLevel:r.fuelLevel, status:r.status, requestDate:dateOnly(r.timestamp || r.createdAt), requestTime:time(r.timestamp || r.createdAt), assignedTo:r.assignedFuelWorkerName || r.assignedFuelWorker || '', distributedLitres:r.distributedLitres || '', distributedDate:dateOnly(r.distributedAt), distributedTime:time(r.distributedAt), distributedBy:r.distributedBy || '', fuelBalanceAfter:r.fuelBalanceAfter ?? '', distributionPhotoLinks: await photoUrls(r.distributionPhotos), gps:r.gps?`${r.gps.lat},${r.gps.lng}`:'' })));
      const breakdownRows = await Promise.all(breakdowns.map(async (r) => ({ breakdownId:r.breakdownId, employeeNumber:r.employeeNumber, machineId:r.machineId, severity:r.severity, description:r.description, photoLinks: await photoUrls(r.photos), status:r.status, createdDate:dateOnly(r.timestamp || r.createdAt), createdTime:time(r.timestamp || r.createdAt), inProgressComment:r.inProgressComment || '', mechanicComment:r.mechanicComment || '', gps:r.gps?`${r.gps.lat},${r.gps.lng}`:'' })));
      const emergencyRows = emergencies.map((r) => ({ emergencyId:r.emergencyId, employeeNumber:r.employeeNumber, type:r.type, severity:r.severity, notes:r.notes, status:r.status, createdDate:dateOnly(r.timestamp || r.createdAt), createdTime:time(r.timestamp || r.createdAt), gps:r.gps?`${r.gps.lat},${r.gps.lng}`:'' }));
      const fuelTxRows = tx.map((r)=>({ transactionType:r.transactionType, litres:r.litres, machineId:r.machineId || '', fuelId:r.fuelId || '', supplier:r.supplier || '', deliveryNote:r.deliveryNote || '', balanceAfter:r.balanceAfter ?? '', employeeNumber:r.employeeNumber || '', date:dateOnly(r.createdAt), time:time(r.createdAt), notes:r.notes || '' }));
      bodyData = createXlsx([
        { name:'Shift Summary', rows: shiftRows, columns:[ {header:'Employee ID',key:'employeeNumber'},{header:'Full Name',key:'fullName'},{header:'Site',key:'siteId'},{header:'Machine',key:'machineId'},{header:'Status',key:'status'},{header:'Payroll Date',key:'payrollDate'},{header:'Shift Type',key:'shiftType'},{header:'Night Shift',key:'nightShift'},{header:'Shift Window',key:'shiftWindowLabel'},{header:'Clock In Date',key:'clockInDate'},{header:'Clock In Time',key:'clockInTime'},{header:'Clock Out Date',key:'clockOutDate'},{header:'Clock Out Time',key:'clockOutTime'},{header:'Total Hours',key:'totalHours'},{header:'Night Hours',key:'nightHours'},{header:'Day Hours',key:'dayHours'},{header:'Opening Meter Reading',key:'startMeterReading'},{header:'Closing Meter Reading',key:'closingMeterReading'},{header:'Meter Difference',key:'meterDifference'},{header:'Start GPS',key:'gpsStart'},{header:'End GPS',key:'gpsEnd'},{header:'Start Meter Photo Link',key:'startMeterPhotoLink'},{header:'Closing Meter Photo Link',key:'closingMeterPhotoLink'},{header:'Checklist Report ID',key:'checklistReportId'} ]},
        { name:'Checklist Responses', rows: checklistResponses, columns:[ {header:'Shift ID',key:'shiftId'},{header:'Employee ID',key:'employeeNumber'},{header:'Site',key:'siteId'},{header:'Machine',key:'machineId'},{header:'Clock In Date',key:'clockInDate'},{header:'Clock In Time',key:'clockInTime'},{header:'Item ID',key:'itemId'},{header:'Checklist Item',key:'checklistItem'},{header:'Class',key:'defectClass'},{header:'GO / NO GO',key:'decision'},{header:'Remarks',key:'remarks'},{header:'Report ID',key:'checklistReportId'} ]},
        { name:'Checklist Defect Reports', rows: checklistReports, columns:[ {header:'Report ID',key:'reportId'},{header:'Employee ID',key:'employeeNumber'},{header:'Site',key:'siteId'},{header:'Machine',key:'machineId'},{header:'Created Date',key:'createdDate'},{header:'Created Time',key:'createdTime'},{header:'Status',key:'status'},{header:'Severity',key:'reportSeverity'},{header:'Required Action',key:'requiredAction'},{header:'Machine Blocked',key:'machineBlocked'},{header:'Class',key:'defectClass'},{header:'Checklist Item',key:'checklistItem'},{header:'Remarks',key:'remarks'},{header:'GPS',key:'gps'} ]},
        { name:'Fuel Requests', rows: fuelRows, columns:[ {header:'Request ID',key:'requestId'},{header:'Employee ID',key:'employeeNumber'},{header:'Machine',key:'machineId'},{header:'Fuel Level',key:'fuelLevel'},{header:'Status',key:'status'},{header:'Request Date',key:'requestDate'},{header:'Request Time',key:'requestTime'},{header:'Assigned To',key:'assignedTo'},{header:'Litres Distributed',key:'distributedLitres'},{header:'Distributed Date',key:'distributedDate'},{header:'Distributed Time',key:'distributedTime'},{header:'Distributed By',key:'distributedBy'},{header:'Fuel Balance After',key:'fuelBalanceAfter'},{header:'Distribution Photo Links',key:'distributionPhotoLinks'},{header:'GPS',key:'gps'} ]},
        { name:'Fuel Usage Monthly', rows: fuelUsageRows, columns:[ {header:'Month',key:'month'},{header:'Machine',key:'machineId'},{header:'Total Litres',key:'totalLitres'},{header:'Request Count',key:'requestCount'} ]},
        { name:'Fuel Stock Transactions', rows: fuelTxRows, columns:[ {header:'Type',key:'transactionType'},{header:'Litres',key:'litres'},{header:'Machine',key:'machineId'},{header:'Fuel Request',key:'fuelId'},{header:'Supplier',key:'supplier'},{header:'Delivery Note',key:'deliveryNote'},{header:'Balance After',key:'balanceAfter'},{header:'Captured By',key:'employeeNumber'},{header:'Date',key:'date'},{header:'Time',key:'time'},{header:'Notes',key:'notes'} ]},
        { name:'Breakdown Reports', rows: breakdownRows, columns:[ {header:'Breakdown ID',key:'breakdownId'},{header:'Employee ID',key:'employeeNumber'},{header:'Machine',key:'machineId'},{header:'Severity',key:'severity'},{header:'Description',key:'description'},{header:'Photo Links',key:'photoLinks'},{header:'Status',key:'status'},{header:'Created Date',key:'createdDate'},{header:'Created Time',key:'createdTime'},{header:'In Progress Comment',key:'inProgressComment'},{header:'Mechanic Comment',key:'mechanicComment'},{header:'GPS',key:'gps'} ]},
        { name:'Emergency Logs', rows: emergencyRows, columns:[ {header:'Emergency ID',key:'emergencyId'},{header:'Employee ID',key:'employeeNumber'},{header:'Type',key:'type'},{header:'Severity',key:'severity'},{header:'Notes',key:'notes'},{header:'Status',key:'status'},{header:'Created Date',key:'createdDate'},{header:'Created Time',key:'createdTime'},{header:'GPS',key:'gps'} ]}
      ]);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
      const header = ['Employee ID','Full Name','Site','Machine','Status','Payroll Date','Shift Type','Night Shift','Clock In Date','Clock In Time','Clock Out Date','Clock Out Time','Total Hours','Opening Meter Reading','Closing Meter Reading','Meter Difference','Start GPS','End GPS','Start Photo Link','End Photo Link','Checklist Report ID'];
      const rows = await Promise.all(shifts.map(async (r) => { const metrics = shiftMetrics(r); return [r.employeeNumber,r.fullName || '',r.siteId,r.machineId,r.status,metrics.payrollDate,metrics.shiftType,metrics.nightShift?'YES':'NO',dateOnly(r.clockInTime),time(r.clockInTime),dateOnly(r.clockOutTime),time(r.clockOutTime),r.totalHours || metrics.totalHours || '',r.startMeterReading ?? '',r.closingMeterReading ?? '',meterDiff(r),r.gpsStart?`${r.gpsStart.lat},${r.gpsStart.lng}`:'',r.gpsEnd?`${r.gpsEnd.lat},${r.gpsEnd.lng}`:'',await photoUrl(r.startMeterPhoto),await photoUrl(r.closingMeterPhoto),r.checklistReportId || ''].map(csvEscape).join(','); }));
      bodyData = [header.join(','), ...rows].join('\n');
    }
    await s3.send(new PutObjectCommand({ Bucket: uploadBucket, Key: key, Body: bodyData, ContentType: contentType }));
    return ok({ url: await presignedGet(key), count: shifts.length, checklistRows: checklistResponses.length, checklistReports: checklistReports.length, format });
  } catch(e:any) {
    return bad(e.message || 'Payroll export error', e.message?.startsWith('Forbidden') ? 403 : e.message?.includes('Unauthorized') ? 401 : 400);
  }
}
