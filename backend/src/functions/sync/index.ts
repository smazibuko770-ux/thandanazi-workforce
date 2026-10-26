import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ok, bad } from '../../shared/response.js';
import { ddb, tableName } from '../../shared/dynamodb.js';
import { principal } from '../../shared/auth.js';
export async function handler(event: APIGatewayProxyEventV2) { try { const p = principal(event); const res = await ddb.send(new QueryCommand({ TableName:tableName, KeyConditionExpression:'PK = :pk', ExpressionAttributeValues:{':pk':`PENDING#${p.employeeNumber}`} })); await Promise.all((res.Items||[]).map(i=>ddb.send(new DeleteCommand({ TableName:tableName, Key:{PK:i.PK, SK:i.SK} })))); return ok({ updates:res.Items||[] }); } catch(e:any) { return bad(e.message || 'Sync error', 400); } }
