import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { canUpdateOperations, principal, requireAdmin, requireOperationsViewer, requireSupervisor } from '../../shared/auth.js';
import { ddb, tableName } from '../../shared/dynamodb.js';
import { ok, bad, parseBody } from '../../shared/response.js';
import { fuelReceiveSchema } from '../../shared/validation.js';
import { broadcastToRole } from '../../shared/websocket.js';

type AnyItem = Record<string, any>;

async function byStatus(pk: string) {
  const r = await ddb.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'GSI_Status',
    KeyConditionExpression: 'GSI_StatusPK=:pk',
    ExpressionAttributeValues: { ':pk': pk }
  }));
  return r.Items || [];
}

async function byStatuses(pks: string[]) {
  const groups = await Promise.all(pks.map((pk) => byStatus(pk)));
  const seen = new Set<string>();
  return groups.flat().filter((item) => {
    const id = `${item.PK || ''}#${item.SK || ''}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function scanEntity(entity: string): Promise<AnyItem[]> {
  const items: AnyItem[] = [];
  let ExclusiveStartKey: any;
  do {
    const r = await ddb.send(new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey,
      FilterExpression: '#entity = :entity',
      ExpressionAttributeNames: { '#entity': 'entity' },
      ExpressionAttributeValues: { ':entity': entity }
    }));
    items.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

function reportKey(entity: string, id: string) {
  return { PK: `${entity}#${id}`, SK: `META#${id}` };
}

const STOCK_KEY = { PK: 'FUEL_STOCK#MAIN', SK: 'BALANCE#MAIN' };
async function getFuelStock() {
  const r = await ddb.send(new GetCommand({ TableName: tableName, Key: STOCK_KEY }));
  return {
    entity: 'FUEL_STOCK',
    balanceLitres: Number(r.Item?.balanceLitres || 0),
    totalReceivedLitres: Number(r.Item?.totalReceivedLitres || 0),
    totalIssuedLitres: Number(r.Item?.totalIssuedLitres || 0),
    updatedAt: r.Item?.updatedAt || '',
    updatedBy: r.Item?.updatedBy || ''
  };
}

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const p = principal(event);
    const method = event.requestContext.http.method;
    const path = event.rawPath;

    if (path === '/supervisor/fuel-stock' && method === 'GET') {
      requireSupervisor(p);
      return ok(await getFuelStock());
    }

    if (path === '/supervisor/fuel-stock/receive' && method === 'POST') {
      requireAdmin(p);
      const body = fuelReceiveSchema.parse(parseBody(event));
      const now = new Date().toISOString();
      const stockUpdate = await ddb.send(new UpdateCommand({
        TableName: tableName,
        Key: STOCK_KEY,
        UpdateExpression: 'SET entity=:entity, updatedAt=:t, updatedBy=:b ADD balanceLitres :litres, totalReceivedLitres :litres',
        ExpressionAttributeValues: { ':entity': 'FUEL_STOCK', ':t': now, ':b': p.employeeNumber, ':litres': body.litres },
        ReturnValues: 'ALL_NEW'
      }));
      const nextBalance = Number(stockUpdate.Attributes?.balanceLitres || 0);
      await ddb.send(new PutCommand({ TableName: tableName, Item: { PK: `FUEL_TX#${now.slice(0, 7)}`, SK: `${now}#${crypto.randomUUID()}`, entity: 'FUEL_TRANSACTION', transactionType: 'RECEIVE', litres: body.litres, supplier: body.supplier || '', deliveryNote: body.deliveryNote || '', notes: body.notes || '', employeeNumber: p.employeeNumber, createdAt: now, balanceAfter: nextBalance } }));
      const latestStock = await getFuelStock();
      await Promise.allSettled([
        broadcastToRole('admin', { type: 'FUEL_STOCK_UPDATED', payload: latestStock }),
        broadcastToRole('supervisor', { type: 'FUEL_STOCK_UPDATED', payload: latestStock })
      ]);
      return ok(latestStock, 201);
    }

    if (path.endsWith('/overview')) {
      requireOperationsViewer(p);
      const [active, emergencies, breakdowns, fuel, checklists] = await Promise.all([
        p.role === 'mechanic' ? Promise.resolve([]) : byStatus('STATUS#ACTIVE'),
        p.role === 'mechanic' ? Promise.resolve([]) : byStatus('OPS#EMERGENCY#Open'),
        byStatus('OPS#BREAKDOWN#Open'),
        p.role === 'mechanic' ? Promise.resolve([]) : byStatuses(['OPS#FUEL#Open', 'OPS#FUEL#Acknowledged', 'OPS#FUEL#In Progress']),
        byStatuses(['CHECKLIST_REPORT#Open', 'CHECKLIST_REPORT#Acknowledged', 'CHECKLIST_REPORT#In Progress'])
      ]);
      return ok({
        activeWorkers: active.length,
        openEmergencies: emergencies.length,
        openBreakdowns: breakdowns.length,
        pendingFuel: fuel.length,
        checklistReports: checklists.length,
        role: p.role
      });
    }

    if (path.endsWith('/task-targets') && method === 'GET') {
      requireSupervisor(p);
      const [employeesRaw, sitesRaw] = await Promise.all([scanEntity('EMPLOYEE'), scanEntity('SITE')]);

      const employees = employeesRaw
        .filter((r) => r.status !== 'INACTIVE' && (r.role || 'worker') === 'worker')
        .map((r) => ({
          employeeNumber: r.employeeNumber,
          fullName: r.fullName || r.employeeNumber,
          role: r.role || 'worker',
          status: r.status || 'ACTIVE',
          siteIds: Array.isArray(r.siteIds) && r.siteIds.length ? r.siteIds : ['ALL'],
          permittedMachineTypes: Array.isArray(r.permittedMachineTypes) ? r.permittedMachineTypes : []
        }))
        .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));

      const sites = sitesRaw
        .filter((r) => r.status !== 'INACTIVE')
        .map((r) => ({ siteId: r.siteId, name: r.name || r.siteId, status: r.status || 'ACTIVE' }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

      return ok({ employees, sites });
    }

    if (path.endsWith('/active-shifts')) {
      requireSupervisor(p);
      return ok({ items: await byStatus('STATUS#ACTIVE') });
    }

    if (path.endsWith('/ops') && method === 'GET') {
      requireOperationsViewer(p);
      const [e, b, f, c] = await Promise.all([
        p.role === 'mechanic' ? Promise.resolve([]) : byStatuses(['OPS#EMERGENCY#Open', 'OPS#EMERGENCY#Acknowledged', 'OPS#EMERGENCY#In Progress']),
        byStatuses(['OPS#BREAKDOWN#Open', 'OPS#BREAKDOWN#Acknowledged', 'OPS#BREAKDOWN#In Progress']),
        p.role === 'mechanic' ? Promise.resolve([]) : byStatuses(['OPS#FUEL#Open', 'OPS#FUEL#Acknowledged', 'OPS#FUEL#In Progress']),
        byStatuses(['CHECKLIST_REPORT#Open', 'CHECKLIST_REPORT#Acknowledged', 'CHECKLIST_REPORT#In Progress'])
      ]);
      return ok({ items: [...c, ...e, ...b, ...f].sort((a, b) => String(b.createdAt || b.timestamp || '').localeCompare(String(a.createdAt || a.timestamp || ''))) });
    }

    if (path.includes('/fuel/') && path.endsWith('/assign') && method === 'POST') {
      requireSupervisor(p);
      return bad('Fuel requests are automatically assigned only to Demo Fuel Attendant (Z9000021). Manual assignment is disabled.', 409);
    }

    if (path.includes('/ops/') && method === 'PATCH') {
      requireOperationsViewer(p);
      const body = parseBody<any>(event);
      if (!['Open', 'In Progress', 'Resolved', 'Closed', 'Acknowledged'].includes(body.status)) return bad('Invalid status', 400);

      const id = event.pathParameters?.id;
      const entity = String(body.entity || '').toUpperCase();
      if (!id || !['EMERGENCY', 'BREAKDOWN', 'FUEL', 'CHECKLIST_REPORT'].includes(entity)) return bad('Entity and id required', 400);

      const mechanicAllowedStatuses = ['Acknowledged', 'In Progress', 'Resolved'];
      const isMechanicStatusUpdate = p.role === 'mechanic' && mechanicAllowedStatuses.includes(body.status) && ['BREAKDOWN', 'CHECKLIST_REPORT'].includes(entity);
      if (!canUpdateOperations(p) && !isMechanicStatusUpdate) {
        return bad('Forbidden: mechanic role can only update breakdowns and checklist faults to Acknowledged, In Progress, or Resolved', 403);
      }
      if (p.role === 'mechanic' && !['BREAKDOWN', 'CHECKLIST_REPORT'].includes(entity)) {
        return bad('Forbidden: mechanic role cannot update fuel or emergency reports', 403);
      }
      if (entity === 'FUEL') {
        return bad('Fuel requests are managed only by Demo Fuel Attendant (Z9000021). Admin and supervisors receive notifications but cannot reassign or change the fuel status.', 400);
      }

      const statusIndex = entity === 'CHECKLIST_REPORT' ? `CHECKLIST_REPORT#${body.status}` : `OPS#${entity}#${body.status}`;
      const now = new Date().toISOString();
      const extraNames: Record<string, string> = {};
      const extraValues: Record<string, any> = {};
      const extraSets: string[] = [];

      if (body.status === 'Acknowledged') {
        extraSets.push('acknowledgedAt=:u', 'acknowledgedBy=:b');
      }
      if (body.status === 'In Progress') {
        extraSets.push('inProgressAt=:u', 'inProgressBy=:b');
      }
      if (body.status === 'Resolved') {
        extraSets.push('resolvedAt=:u', 'resolvedBy=:b');
      }
      const comment = String(body.comment || '').trim();
      if (p.role === 'mechanic' && body.status === 'In Progress' && !comment) {
        return bad('Add a mechanic comment or reason for delay before marking the item In Progress.', 400);
      }
      if (comment) {
        const commentRecord = { at: now, by: p.employeeNumber, status: body.status, comment };
        extraNames['#comment'] = body.status === 'In Progress' ? 'inProgressComment' : 'mechanicComment';
        extraValues[':comment'] = comment;
        extraSets.push('#comment=:comment');
        extraSets.push('mechanicComments=list_append(if_not_exists(mechanicComments,:emptyComments),:newComment)');
        extraValues[':emptyComments'] = [];
        extraValues[':newComment'] = [commentRecord];
      }

      const updateExpression = ['SET #s=:s', 'updatedAt=:u', 'updatedBy=:b', 'GSI_StatusPK=:g', ...extraSets].join(',');

      const r = await ddb.send(new UpdateCommand({
        TableName: tableName,
        Key: reportKey(entity, id),
        UpdateExpression: updateExpression,
        ConditionExpression: 'attribute_exists(PK)',
        ExpressionAttributeNames: { '#s': 'status', ...extraNames },
        ExpressionAttributeValues: { ':s': body.status, ':u': now, ':b': p.employeeNumber, ':g': statusIndex, ...extraValues },
        ReturnValues: 'ALL_NEW'
      }));

      if (entity === 'CHECKLIST_REPORT' && body.status === 'Resolved' && body.returnMachineToService && r.Attributes?.machineId) {
        await ddb.send(new UpdateCommand({
          TableName: tableName,
          Key: { PK: `MACHINE#${r.Attributes.machineId}`, SK: 'META' },
          UpdateExpression: 'SET #s=:active,returnedToServiceAt=:t,returnedToServiceBy=:b REMOVE blockedReason',
          ConditionExpression: 'attribute_exists(PK)',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':active': 'ACTIVE', ':t': now, ':b': p.employeeNumber }
        }));
      }

      // Keep supervisors and admins in sync while the item remains in the active
      // operations queue. In Progress is intentionally queried until Resolved.
      await Promise.allSettled([
        broadcastToRole('supervisor', { type: 'MECHANIC_STATUS_UPDATED', payload: r.Attributes }),
        broadcastToRole('admin', { type: 'MECHANIC_STATUS_UPDATED', payload: r.Attributes })
      ]);

      return ok(r.Attributes);
    }

    return bad('Route not found', 404);
  } catch (e: any) {
    return bad(e.message || 'Supervisor error', e.message?.startsWith('Forbidden') ? 403 : 400);
  }
}
