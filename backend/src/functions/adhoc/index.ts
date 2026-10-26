import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { bad, ok, parseBody } from '../../shared/response.js';
import { ddb, tableName } from '../../shared/dynamodb.js';
import { principal, requireSupervisor } from '../../shared/auth.js';
import { taskSchema } from '../../shared/validation.js';
import { broadcastToRole } from '../../shared/websocket.js';
export async function handler(event: APIGatewayProxyEventV2) {
  try { const p = principal(event); requireSupervisor(p); const body = taskSchema.parse(parseBody(event)); const id = crypto.randomUUID(); const item = { PK:`TASK#${id}`, SK:`META#${id}`, entity:'TASK', taskId:id, assignedBy:p.employeeNumber, createdAt:new Date().toISOString(), status:'Unread', ...body }; await ddb.send(new PutCommand({ TableName: tableName, Item:item })); await broadcastToRole('worker', { type:'TASK_ASSIGNED', payload:item }); return ok(item, 201); } catch(e:any) { return bad(e.message || 'Task error', 400); }
}
