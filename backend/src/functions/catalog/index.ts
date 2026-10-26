import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { principal } from '../../shared/auth.js';
import { ddb, tableName } from '../../shared/dynamodb.js';
import { ok, bad } from '../../shared/response.js';

function normaliseMachine(item: any) {
  const machineId = String(item.machineId || item.machineNo || item.PK?.replace('MACHINE#', '') || '').toUpperCase();
  const machineType = String(item.machineType || item.type || 'GENERAL').toUpperCase();
  const regNo = item.regNo || item.tarNumber || item.registration || '';
  return {
    ...item,
    machineId,
    siteId: item.siteId || 'ALL',
    machineType,
    regNo,
    label: item.label || [machineId, machineType, regNo].filter(Boolean).join(' - '),
    status: item.status || 'ACTIVE'
  };
}

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const p = principal(event);

    if (event.rawPath === '/me') {
      const r = await ddb.send(new GetCommand({
        TableName: tableName,
        Key: { PK: `EMP#${p.employeeNumber}`, SK: 'PROFILE' }
      }));
      return ok({ user: r.Item || { employeeNumber: p.employeeNumber, role: p.role } });
    }

    if (event.rawPath === '/sites') {
      const r = await ddb.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK=:pk',
        ExpressionAttributeValues: { ':pk': 'CATALOG#SITES' }
      }));
      return ok({ items: r.Items || [] });
    }

    if (event.rawPath.includes('/machines')) {
      const siteId = event.pathParameters?.siteId || 'ALL';
      const r = await ddb.send(new QueryCommand({
        TableName: tableName,
        IndexName: 'GSI_Status',
        KeyConditionExpression: 'GSI_StatusPK=:pk',
        ExpressionAttributeValues: { ':pk': `MACHINES#${siteId}` }
      }));

      let items = r.Items || [];
      if (!items.length) {
        const all = await ddb.send(new QueryCommand({
          TableName: tableName,
          IndexName: 'GSI_Status',
          KeyConditionExpression: 'GSI_StatusPK=:pk',
          ExpressionAttributeValues: { ':pk': 'MACHINES#ALL' }
        }));
        items = all.Items || [];
      }

      return ok({ items: items.map(normaliseMachine) });
    }

    return bad('Route not found', 404);
  } catch (e: any) {
    return bad(e.message || 'Catalog error', 400);
  }
}
