import { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, tableName } from '../../shared/dynamodb.js';

export async function handler(event: APIGatewayProxyWebsocketEventV2) {
  const connectionId = event.requestContext.connectionId;
  await Promise.all([
    ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: `CONNECTION#${connectionId}`, SK: 'META' } })),
    ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: `CONNECTION#${connectionId}`, SK: 'EMP' } }))
  ]);
  return { statusCode: 200 };
}
