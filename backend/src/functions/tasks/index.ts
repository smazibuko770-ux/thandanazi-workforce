import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { principal, requireSupervisor } from '../../shared/auth.js';
import { fuelCompleteSchema, taskSchema } from '../../shared/validation.js';
import { ddb, tableName } from '../../shared/dynamodb.js';
import { ok, bad, parseBody } from '../../shared/response.js';
import { sendToEmployee, broadcastToRole } from '../../shared/websocket.js';

const FUEL_ATTENDANT = 'Z9000021';
const STOCK_KEY = { PK: 'FUEL_STOCK#MAIN', SK: 'BALANCE#MAIN' };

type AnyItem = Record<string, any>;

async function getStock() {
  const r = await ddb.send(new GetCommand({ TableName: tableName, Key: STOCK_KEY }));
  return {
    entity: 'FUEL_STOCK',
    balanceLitres: Number(r.Item?.balanceLitres || 0),
    updatedAt: r.Item?.updatedAt || '',
    updatedBy: r.Item?.updatedBy || ''
  };
}

async function findTask(employeeNumber: string, taskId?: string, sourceId?: string): Promise<AnyItem | undefined> {
  // DynamoDB applies Query Limit before FilterExpression. The previous implementation
  // used a query limit with a filter, so if Themba had more than one task the correct
  // fuel task could be skipped and the API returned "Task not found". Query the
  // employee task partition and find the task in memory instead.
  const r = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'PK=:pk',
    ExpressionAttributeValues: { ':pk': `TASKS#${employeeNumber}` },
    ScanIndexForward: false
  }));
  const items = r.Items || [];
  return items.find((item) => item.taskId === taskId)
    || (sourceId ? items.find((item) => item.sourceEntity === 'FUEL' && item.sourceId === sourceId && item.status !== 'Completed') : undefined);
}

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const p = principal(event);
    const method = event.requestContext.http.method;
    const path = event.rawPath;

    if (method === 'GET' && path === '/tasks/fuel-stock') {
      if (p.employeeNumber !== FUEL_ATTENDANT && p.role !== 'admin' && p.role !== 'supervisor') return bad('Forbidden: fuel stock view is for Themba, admin, or supervisor only', 403);
      return ok(await getStock());
    }

    if (method === 'POST') {
      if (path.includes('/fuel-complete')) {
        if (p.employeeNumber !== FUEL_ATTENDANT) return bad('Only Demo Fuel Attendant (Z9000021) may complete fuel requests.', 403);
        const taskId = event.pathParameters?.taskId;
        const body = fuelCompleteSchema.parse(parseBody(event));
        const task = await findTask(p.employeeNumber, taskId, body.fuelId);
        if (!task) return bad('Fuel task not found for this user. Refresh the dashboard and try again.', 404);
        if (task.sourceEntity !== 'FUEL' || !task.sourceId) return bad('This task is not a fuel task', 400);
        if (body.fuelId !== task.sourceId) return bad('Fuel task does not match selected request', 409);

        const fuelKey = { PK: `FUEL#${body.fuelId}`, SK: `META#${body.fuelId}` };
        const fuel = await ddb.send(new GetCommand({ TableName: tableName, Key: fuelKey }));
        if (!fuel.Item) return bad('Fuel request not found', 404);
        if (fuel.Item.assignedFuelWorker !== p.employeeNumber) return bad('This fuel request is assigned to another worker', 403);
        if (String(fuel.Item.status) === 'Resolved') return ok({ fuel: fuel.Item, stock: await getStock(), alreadyResolved: true });

        let resolvedFuel: AnyItem | undefined;
        let resolvedStock: AnyItem | undefined;
        const now = new Date().toISOString();

        for (let attempt = 0; attempt < 3; attempt += 1) {
          const stock = await getStock();
          if (stock.balanceLitres < body.litres) return bad(`Fuel stock is too low. Current balance is ${stock.balanceLitres} L. Admin must capture supplier fuel before resolving.`, 409);

          const nextBalance = Number((stock.balanceLitres - body.litres).toFixed(2));
          const transactionKey = { PK: `FUEL_TX#${now.slice(0, 7)}`, SK: `ISSUE#${body.fuelId}` };

          try {
            await ddb.send(new TransactWriteCommand({
              TransactItems: [
                {
                  Update: {
                    TableName: tableName,
                    Key: STOCK_KEY,
                    UpdateExpression: 'SET entity=:entity, balanceLitres=:balance, updatedAt=:t, updatedBy=:worker ADD totalIssuedLitres :litres',
                    ConditionExpression: 'attribute_exists(PK) AND balanceLitres=:expected AND balanceLitres>=:litres',
                    ExpressionAttributeValues: {
                      ':entity': 'FUEL_STOCK', ':balance': nextBalance, ':expected': stock.balanceLitres, ':t': now, ':worker': p.employeeNumber, ':litres': body.litres
                    }
                  }
                },
                {
                  Update: {
                    TableName: tableName,
                    Key: fuelKey,
                    UpdateExpression: 'SET #s=:resolved, distributedLitres=:litres, distributionPhotos=:photos, distributionNotes=:notes, distributedAt=:t, distributedBy=:worker, fuelBalanceAfter=:balance, updatedAt=:t, updatedBy=:worker, GSI_StatusPK=:g',
                    ConditionExpression: 'attribute_exists(PK) AND assignedFuelWorker=:worker AND (attribute_not_exists(#s) OR #s<>:resolved)',
                    ExpressionAttributeNames: { '#s': 'status' },
                    ExpressionAttributeValues: {
                      ':resolved': 'Resolved', ':litres': body.litres, ':photos': body.photos, ':notes': body.notes || '', ':t': now, ':worker': p.employeeNumber, ':balance': nextBalance, ':g': 'OPS#FUEL#Resolved'
                    }
                  }
                },
                {
                  Update: {
                    TableName: tableName,
                    Key: { PK: task.PK, SK: task.SK },
                    UpdateExpression: 'SET #s=:completed, completedAt=:t, updatedAt=:t, fuelLitres=:litres, fuelPhotos=:photos',
                    ConditionExpression: 'attribute_exists(PK) AND (attribute_not_exists(#s) OR #s<>:completed)',
                    ExpressionAttributeNames: { '#s': 'status' },
                    ExpressionAttributeValues: { ':completed': 'Completed', ':t': now, ':litres': body.litres, ':photos': body.photos }
                  }
                },
                {
                  Put: {
                    TableName: tableName,
                    Item: {
                      ...transactionKey,
                      entity: 'FUEL_TRANSACTION', transactionType: 'ISSUE', litres: body.litres,
                      machineId: fuel.Item.machineId || body.machineId || '', fuelId: body.fuelId,
                      employeeNumber: p.employeeNumber, createdAt: now, balanceAfter: nextBalance,
                      photos: body.photos, notes: body.notes || ''
                    },
                    ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)'
                  }
                }
              ]
            }));

            const [fuelAfter, stockAfter] = await Promise.all([
              ddb.send(new GetCommand({ TableName: tableName, Key: fuelKey })),
              ddb.send(new GetCommand({ TableName: tableName, Key: STOCK_KEY }))
            ]);
            resolvedFuel = fuelAfter.Item;
            resolvedStock = {
              entity: 'FUEL_STOCK',
              balanceLitres: Number(stockAfter.Item?.balanceLitres || 0),
              updatedAt: stockAfter.Item?.updatedAt || '',
              updatedBy: stockAfter.Item?.updatedBy || ''
            };
            break;
          } catch (error: any) {
            if (error?.name === 'TransactionCanceledException' && attempt < 2) continue;
            if (error?.name === 'TransactionCanceledException') {
              const latest = await getStock();
              return bad(`Fuel request could not be resolved because the stock or request changed. Current fuel balance is ${latest.balanceLitres} L. Refresh and try again.`, 409);
            }
            throw error;
          }
        }

        if (!resolvedFuel || !resolvedStock) return bad('Fuel resolution could not be completed. Refresh and try again.', 409);
        await Promise.allSettled([
          broadcastToRole('admin', { type: 'FUEL_REQUEST_RESOLVED', payload: resolvedFuel }),
          broadcastToRole('supervisor', { type: 'FUEL_REQUEST_RESOLVED', payload: resolvedFuel })
        ]);
        return ok({ fuel: resolvedFuel, stock: resolvedStock });
      }

      requireSupervisor(p);
      const b = taskSchema.parse(parseBody(event));
      const id = crypto.randomUUID(), now = new Date().toISOString();
      await Promise.all(b.assignedTo.map(async emp => {
        const item = { PK: `TASKS#${emp}`, SK: `${now}#${id}`, entity: 'TASK', taskId: id, employeeNumber: emp, assignedBy: p.employeeNumber, createdAt: now, status: 'Unread', ...b };
        await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
        await sendToEmployee(emp, { type: 'TASK_ASSIGNED', payload: item });
      }));
      return ok({ taskId: id, assignedCount: b.assignedTo.length }, 201);
    }

    if (method === 'GET') {
      const r = await ddb.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: 'PK=:pk', ExpressionAttributeValues: { ':pk': `TASKS#${p.employeeNumber}` }, ScanIndexForward: false }));
      const items = (r.Items || []).filter((item) => p.employeeNumber === FUEL_ATTENDANT || item.sourceEntity !== 'FUEL');
      return ok({ items });
    }

    if (method === 'PATCH') {
      const taskId = event.pathParameters?.taskId;
      const action = event.rawPath.endsWith('/complete') ? 'Completed' : 'Read';
      const task = await findTask(p.employeeNumber, taskId);
      if (!task) return bad('Task not found', 404);
      if (task.sourceEntity === 'FUEL' && p.employeeNumber !== FUEL_ATTENDANT) return bad('Fuel tasks are reserved for Demo Fuel Attendant (Z9000021).', 403);
      await ddb.send(new UpdateCommand({ TableName: tableName, Key: { PK: task.PK, SK: task.SK }, UpdateExpression: 'SET #s=:s,updatedAt=:u', ExpressionAttributeNames: { '#s': 'status' }, ExpressionAttributeValues: { ':s': action, ':u': new Date().toISOString() } }));
      return ok({ success: true, status: action });
    }
    return bad('Route not found', 404);
  } catch (e: any) {
    return bad(e.message || 'Task error', e.message?.startsWith('Forbidden') ? 403 : e.name === 'ConditionalCheckFailedException' ? 409 : 400);
  }
}
