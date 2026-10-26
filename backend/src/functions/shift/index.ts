import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { bad, ok, parseBody } from '../../shared/response.js';
import { ddb, tableName } from '../../shared/dynamodb.js';
import { principal } from '../../shared/auth.js';
import { checklistReportSchema, clockInSchema, clockOutSchema } from '../../shared/validation.js';
import { broadcastToRole } from '../../shared/websocket.js';
import { audit } from '../../shared/audit.js';
import { classifyShift } from '../../shared/nightShift.js';

function normaliseShift(item: any) {
  if (!item) return item;
  const shiftId = item.shiftId || String(item.PK || '').replace('SHIFT#', '');
  return { ...item, shiftId };
}

async function activeFor(employeeNumber: string) {
  const response = await ddb.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'GSI_Status',
    KeyConditionExpression: 'GSI_StatusPK=:s',
    FilterExpression: 'employeeNumber=:e',
    ExpressionAttributeValues: { ':s': 'STATUS#ACTIVE', ':e': employeeNumber }
  }));
  return normaliseShift(response.Items?.[0]);
}

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const p = principal(event);

    if (event.requestContext.http.method === 'POST' && event.rawPath.endsWith('/checklists/report')) {
      const body = checklistReportSchema.parse(parseBody(event));
      const idempotent = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `IDEMP#${p.employeeNumber}`, SK: body.idempotencyKey } }));
      if (idempotent.Item) return ok(idempotent.Item.response, 200);

      const hasClassA = body.items.some((item) => item.defectClass === 'A');
      const item = {
        PK: `CHECKLIST_REPORT#${body.reportId}`,
        SK: `META#${body.reportId}`,
        entity: 'CHECKLIST_REPORT',
        reportId: body.reportId,
        employeeNumber: p.employeeNumber,
        siteId: body.siteId,
        machineId: body.machineId,
        items: body.items,
        gps: body.gps,
        clientTimestamp: body.timestamp,
        createdAt: new Date().toISOString(),
        status: 'Open',
        machineBlocked: hasClassA,
        reportSeverity: hasClassA ? 'BLOCKING' : 'MAINTENANCE_REQUIRED',
        requiredAction: hasClassA ? 'Machine blocked: repair and re-inspection required' : 'Machine attention required: maintenance/admin review',
        GSI_StatusPK: 'CHECKLIST_REPORT#Open',
        GSI_StatusSK: `${hasClassA ? 'A' : 'BC'}#${new Date().toISOString()}#${body.reportId}`
      };

      await ddb.send(new PutCommand({ TableName: tableName, Item: item, ConditionExpression: 'attribute_not_exists(PK)' }));
      if (hasClassA) {
        await ddb.send(new UpdateCommand({
          TableName: tableName,
          Key: { PK: `MACHINE#${body.machineId}`, SK: 'META' },
          UpdateExpression: 'SET #s=:s, blockedReason=:r, blockedAt=:t',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':s': 'OUT_OF_SERVICE', ':r': 'Class A checklist NO GO', ':t': new Date().toISOString() }
        }));
      }
      await ddb.send(new PutCommand({ TableName: tableName, Item: { PK: `IDEMP#${p.employeeNumber}`, SK: body.idempotencyKey, response: item, ttl: Math.floor(Date.now() / 1000) + 86400 } }));
      await audit(p.employeeNumber, 'CHECKLIST_DEFECT_REPORTED', body.reportId, { machineId: body.machineId, hasClassA, count: body.items.length, reportSeverity: item.reportSeverity });
      await Promise.allSettled([broadcastToRole('supervisor', { type: 'CHECKLIST_DEFECT_REPORTED', payload: item }), broadcastToRole('admin', { type: 'CHECKLIST_DEFECT_REPORTED', payload: item })]);
      return ok(item, 201);
    }

    if (event.requestContext.http.method === 'POST' && event.rawPath.endsWith('/clock-in')) {
      const body = clockInSchema.parse(parseBody(event));
      const existing = await activeFor(p.employeeNumber);
      if (existing) return bad('An active shift already exists. Clock out first before starting a new shift.', 409);

      if (body.checklist.some((item) => item.decision === 'NO_GO')) {
        if (!body.checklistReportId) return bad('Checklist defect report is required', 400);
        const report = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `CHECKLIST_REPORT#${body.checklistReportId}`, SK: `META#${body.checklistReportId}` } }));
        if (!report.Item || report.Item.employeeNumber !== p.employeeNumber || report.Item.machineId !== body.machineId) return bad('Checklist defect report could not be verified', 409);
        if (report.Item.machineBlocked) return bad('Machine is blocked because of a Class A NO GO defect', 409);
      }

      const idempotent = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `IDEMP#${p.employeeNumber}`, SK: body.idempotencyKey } }));
      if (idempotent.Item) return ok(normaliseShift(idempotent.Item.response), 200);

      const serverClockInTime = new Date().toISOString();
      const date = serverClockInTime.slice(0, 10);
      const shiftClassification = classifyShift(serverClockInTime);
      const item = {
        PK: `SHIFT#${body.shiftId}`,
        SK: `META#${body.shiftId}`,
        entity: 'SHIFT',
        shiftId: body.shiftId,
        employeeNumber: p.employeeNumber,
        fullName: body.fullName || p.employeeNumber,
        status: 'ACTIVE',
        siteId: body.siteId,
        machineId: body.machineId,
        checklist: body.checklist,
        checklistReportId: body.checklistReportId,
        startMeterReading: body.startMeterReading,
        startMeterPhoto: body.startMeterPhoto,
        gpsStart: body.gpsStart,
        clientClockInTime: body.clockInTime,
        serverClockInTime,
        clockInTime: serverClockInTime,
        shiftType: shiftClassification.shiftType,
        nightShift: shiftClassification.nightShift,
        nightHours: shiftClassification.nightHours,
        dayHours: shiftClassification.dayHours,
        payrollDate: shiftClassification.payrollDate,
        shiftWindowLabel: shiftClassification.shiftWindowLabel,
        GSI_WorkerDatePK: `WORKER#${p.employeeNumber}`,
        GSI_WorkerDateSK: `DATE#${date}#SHIFT#${body.shiftId}`,
        GSI_SiteDatePK: `SITE#${body.siteId}`,
        GSI_SiteDateSK: `DATE#${date}#SHIFT#${body.shiftId}`,
        GSI_PayrollPK: `SITE#${body.siteId}`,
        GSI_PayrollSK: `DATE#${date}#SHIFT#${body.shiftId}`,
        GSI_StatusPK: 'STATUS#ACTIVE',
        GSI_StatusSK: `SHIFT#${body.shiftId}`
      };

      await ddb.send(new PutCommand({ TableName: tableName, Item: item, ConditionExpression: 'attribute_not_exists(PK)' }));
      await ddb.send(new PutCommand({ TableName: tableName, Item: { PK: `IDEMP#${p.employeeNumber}`, SK: body.idempotencyKey, response: item, ttl: Math.floor(Date.now() / 1000) + 86400 } }));
      await audit(p.employeeNumber, 'SHIFT_CLOCK_IN', body.shiftId, { siteId: body.siteId, machineId: body.machineId, shiftType: shiftClassification.shiftType, payrollDate: shiftClassification.payrollDate });
      await Promise.allSettled([broadcastToRole('supervisor', { type: 'SHIFT_STARTED', payload: item }), broadcastToRole('admin', { type: 'SHIFT_STARTED', payload: item })]);
      return ok(item, 201);
    }

    if (event.requestContext.http.method === 'POST' && event.rawPath.endsWith('/clock-out')) {
      const body = clockOutSchema.parse(parseBody(event));
      const idempotent = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `IDEMP#${p.employeeNumber}`, SK: body.idempotencyKey } }));
      if (idempotent.Item) return ok(normaliseShift(idempotent.Item.response), 200);

      const found = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `SHIFT#${body.shiftId}`, SK: `META#${body.shiftId}` } }));
      const shift = found.Item;
      if (!shift) return bad('Shift not found', 404);
      if (shift.employeeNumber !== p.employeeNumber && p.role !== 'supervisor') return bad('Forbidden', 403);
      if (shift.status !== 'ACTIVE') {
        if (shift.status === 'COMPLETED') return ok(normaliseShift(shift), 200);
        return bad('Shift is not active', 409);
      }

      const serverClockOutTime = new Date().toISOString();
      const shiftClassification = classifyShift(shift.serverClockInTime || shift.clockInTime, serverClockOutTime);
      const totalHours = shiftClassification.totalHours;
      const response = await ddb.send(new UpdateCommand({
        TableName: tableName,
        Key: { PK: shift.PK, SK: shift.SK },
        UpdateExpression: 'SET #status=:done, closingMeterReading=:meter, closingMeterPhoto=:photo, gpsEnd=:gps, clientClockOutTime=:client, serverClockOutTime=:server, clockOutTime=:server, totalHours=:hours, shiftType=:shiftType, nightShift=:nightShift, nightHours=:nightHours, dayHours=:dayHours, payrollDate=:payrollDate, shiftWindowLabel=:shiftWindowLabel, GSI_StatusPK=:statuspk, GSI_StatusSK=:statussk',
        ConditionExpression: '#status=:active',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':done': 'COMPLETED', ':active': 'ACTIVE', ':meter': body.closingMeterReading, ':photo': body.closingMeterPhoto, ':gps': body.gpsEnd, ':client': body.clockOutTime, ':server': serverClockOutTime, ':hours': shiftClassification.totalHours, ':shiftType': shiftClassification.shiftType, ':nightShift': shiftClassification.nightShift, ':nightHours': shiftClassification.nightHours, ':dayHours': shiftClassification.dayHours, ':payrollDate': shiftClassification.payrollDate, ':shiftWindowLabel': shiftClassification.shiftWindowLabel, ':statuspk': 'STATUS#COMPLETED', ':statussk': `SHIFT#${body.shiftId}` },
        ReturnValues: 'ALL_NEW'
      }));
      const attributes = normaliseShift(response.Attributes);
      await ddb.send(new PutCommand({ TableName: tableName, Item: { PK: `IDEMP#${p.employeeNumber}`, SK: body.idempotencyKey, response: attributes, ttl: Math.floor(Date.now() / 1000) + 86400 } }));
      await audit(p.employeeNumber, 'SHIFT_CLOCK_OUT', body.shiftId, { totalHours: shiftClassification.totalHours, nightHours: shiftClassification.nightHours, shiftType: shiftClassification.shiftType, payrollDate: shiftClassification.payrollDate });
      await Promise.allSettled([broadcastToRole('supervisor', { type: 'SHIFT_ENDED', payload: attributes }), broadcastToRole('admin', { type: 'SHIFT_ENDED', payload: attributes })]);
      return ok(attributes);
    }

    if (event.rawPath.endsWith('/active')) return ok({ shift: await activeFor(p.employeeNumber) || null });
    return bad('Route not found', 404);
  } catch (error: any) {
    return bad(error.message || 'Shift error', error.name === 'ConditionalCheckFailedException' ? 409 : 400);
  }
}
