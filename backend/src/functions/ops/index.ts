import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { bad, ok, parseBody } from '../../shared/response.js';
import { ddb, tableName } from '../../shared/dynamodb.js';
import { principal } from '../../shared/auth.js';
import { breakdownSchema, emergencySchema, fuelSchema } from '../../shared/validation.js';
import { broadcastToRole, sendToEmployee } from '../../shared/websocket.js';
import { audit } from '../../shared/audit.js';

const sns = new SNSClient({});
const FUEL_ATTENDANT = 'Z9000021';
const FUEL_ATTENDANT_NAME = 'Demo Fuel Attendant';

async function getEmployeeName(employeeNumber: string) {
  const r = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `EMP#${employeeNumber}`, SK: 'PROFILE' } }));
  return r.Item?.fullName || (employeeNumber === FUEL_ATTENDANT ? FUEL_ATTENDANT_NAME : employeeNumber);
}

async function createFuelTask(fuel: any, actor: string) {
  const now = new Date().toISOString();
  const taskId = `FUEL-${fuel.fuelId}`;
  const workerName = await getEmployeeName(FUEL_ATTENDANT);
  const machineId = fuel.machineId || 'machine';
  const task = {
    PK: `TASKS#${FUEL_ATTENDANT}`,
    SK: `FUEL#${fuel.fuelId}`,
    entity: 'TASK',
    taskId,
    employeeNumber: FUEL_ATTENDANT,
    assignedBy: actor,
    createdAt: now,
    status: 'Unread',
    title: `Fuel request: ${machineId}`,
    description: `Attend to fuel request ${fuel.fuelId} for ${machineId}. Reported fuel level: ${fuel.fuelLevel}%. Capture litres distributed and delivery photo when done.`,
    priority: 'Urgent',
    assignedTo: [FUEL_ATTENDANT],
    sourceEntity: 'FUEL',
    sourceId: fuel.fuelId
  };
  await ddb.send(new PutCommand({ TableName: tableName, Item: task }));
  const updated = await ddb.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: `FUEL#${fuel.fuelId}`, SK: `META#${fuel.fuelId}` },
    UpdateExpression: 'SET #s=:s, assignedFuelWorker=:w, assignedFuelWorkerName=:wn, fuelAssignedAt=:t, fuelAssignedBy=:b, taskId=:task, updatedAt=:t, updatedBy=:b, GSI_StatusPK=:g',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: {
      ':s': 'In Progress',
      ':w': FUEL_ATTENDANT,
      ':wn': workerName,
      ':t': now,
      ':b': actor,
      ':task': taskId,
      ':g': 'OPS#FUEL#In Progress'
    },
    ReturnValues: 'ALL_NEW'
  }));
  await sendToEmployee(FUEL_ATTENDANT, { type: 'TASK_ASSIGNED', payload: task });
  return updated.Attributes || fuel;
}

async function create(p: any, entity: string, body: any, eventType: string) {
  const idem = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `IDEMP#${p.employeeNumber}`, SK: body.idempotencyKey } }));
  if (idem.Item) return idem.Item.response;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  let item: any = {
    PK: `${entity}#${id}`,
    SK: `META#${id}`,
    entity,
    [`${entity.toLowerCase()}Id`]: id,
    employeeNumber: p.employeeNumber,
    status: 'Open',
    timestamp: now,
    createdAt: body.timestamp || now,
    ...body,
    GSI_StatusPK: `OPS#${entity}#Open`,
    GSI_StatusSK: `DATE#${now}#${id}`
  };

  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));

  if (entity === 'FUEL') {
    item = await createFuelTask(item, p.employeeNumber);
  }

  await ddb.send(new PutCommand({ TableName: tableName, Item: { PK: `IDEMP#${p.employeeNumber}`, SK: body.idempotencyKey, response: item, ttl: Math.floor(Date.now() / 1000) + 86400 } }));
  await Promise.allSettled([
    broadcastToRole('supervisor', { type: eventType, payload: item }),
    broadcastToRole('admin', { type: eventType, payload: item })
  ]);
  await audit(p.employeeNumber, `${entity}_CREATED`, id, { severity: body.severity, assignedFuelWorker: entity === 'FUEL' ? FUEL_ATTENDANT : undefined });
  return item;
}

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const p = principal(event);
    if (event.rawPath.endsWith('/fuel')) return ok(await create(p, 'FUEL', fuelSchema.parse(parseBody(event)), 'FUEL_REQUEST_CREATED'), 201);
    if (event.rawPath.endsWith('/breakdown')) return ok(await create(p, 'BREAKDOWN', breakdownSchema.parse(parseBody(event)), 'BREAKDOWN_CREATED'), 201);
    if (event.rawPath.endsWith('/emergency')) {
      const item = await create(p, 'EMERGENCY', emergencySchema.parse(parseBody(event)), 'EMERGENCY_CREATED');
      if (process.env.SNS_TOPIC_ARN) await sns.send(new PublishCommand({ TopicArn: process.env.SNS_TOPIC_ARN, Subject: `THANDANAZI ${item.severity} emergency`, Message: `Worker: ${p.employeeNumber}\nType: ${item.type}\nDetails: ${item.notes}\nGPS: ${item.gps.lat},${item.gps.lng}\nTime: ${item.timestamp}` }));
      return ok(item, 201);
    }
    return bad('Route not found', 404);
  } catch (e: any) {
    return bad(e.message || 'Ops error', 400);
  }
}
