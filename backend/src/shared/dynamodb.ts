import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
export const tableName = process.env.TABLE_NAME!;
export const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({}),
  { marshallOptions: { removeUndefinedValues: true } }
);
export const keys = {
  emp: (id: string) => ({ PK: `EMP#${id}`, SK: `PROFILE#${id}` }),
  shift: (id: string) => ({ PK: `SHIFT#${id}`, SK: `META#${id}` }),
  connection: (id: string) => ({ PK: `CONNECTION#${id}`, SK: `META#${id}` }),
  pending: (employee: string, id: string) => ({ PK: `PENDING#${employee}`, SK: `UPDATE#${id}` })
};
