import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, tableName } from './dynamodb.js';
export async function audit(actor:string, action:string, target:string, details:Record<string,unknown>={}) {
 const at=new Date().toISOString(); const id=crypto.randomUUID();
 await ddb.send(new PutCommand({TableName:tableName,Item:{PK:`AUDIT#${at.slice(0,10)}`,SK:`${at}#${id}`,entity:'AUDIT',actor,action,target,details,createdAt:at}}));
}
