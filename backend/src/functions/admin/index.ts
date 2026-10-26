import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { AdminCreateUserCommand, AdminDisableUserCommand, AdminEnableUserCommand, AdminSetUserPasswordCommand, AdminUpdateUserAttributesCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { randomBytes } from 'node:crypto';
import { principal, requireAdmin } from '../../shared/auth.js';
import { ddb, tableName } from '../../shared/dynamodb.js';
import { bad, ok, parseBody } from '../../shared/response.js';
import { certificateSchema, checklistTemplateSchema, createEmployeeSchema, createMachineSchema, emergencyContactSchema, siteSchema, updateEmployeeSchema, updateMachineSchema } from '../../shared/validation.js';
import { audit } from '../../shared/audit.js';

const cognito=new CognitoIdentityProviderClient({});
const userPoolId=process.env.USER_POOL_ID!;
const now=()=>new Date().toISOString();
const temporaryPassword=()=>`Tn!${randomBytes(8).toString('base64url')}9a`;
async function scanEntity(entity:string){const r=await ddb.send(new ScanCommand({TableName:tableName,FilterExpression:'entity=:e',ExpressionAttributeValues:{':e':entity}}));return r.Items||[];}

export async function handler(event:APIGatewayProxyEventV2){
 try{
  const p=principal(event);requireAdmin(p);
  const method=event.requestContext.http.method;
  const path=event.rawPath;

  if(path==='/admin/employees'&&method==='GET') return ok({items:(await scanEntity('EMPLOYEE')).sort((a,b)=>String(a.fullName).localeCompare(String(b.fullName)))});
  if(path==='/admin/employees'&&method==='POST'){
   const body=createEmployeeSchema.parse(parseBody(event)); const temp=temporaryPassword();
   try{await cognito.send(new AdminCreateUserCommand({UserPoolId:userPoolId,Username:body.employeeNumber.toUpperCase(),TemporaryPassword:temp,MessageAction:'SUPPRESS',UserAttributes:[{Name:'name',Value:body.fullName},{Name:'custom:employeeNumber',Value:body.employeeNumber.toUpperCase()},{Name:'custom:role',Value:body.role},...(body.email?[{Name:'email',Value:body.email},{Name:'email_verified',Value:'true'}]:[])]}));}
   catch(e:any){if(e.name==='UsernameExistsException')return bad('Employee account already exists',409);throw e;}
   const employeeNumber=body.employeeNumber.toUpperCase(); const item={PK:`EMP#${employeeNumber}`,SK:'PROFILE',entity:'EMPLOYEE',...body,employeeNumber,status:'ACTIVE',createdAt:now(),createdBy:p.employeeNumber};
   await ddb.send(new PutCommand({TableName:tableName,Item:item,ConditionExpression:'attribute_not_exists(PK)'}));
   await audit(p.employeeNumber,'EMPLOYEE_CREATED',employeeNumber,{role:body.role});
   return ok({employee:item,temporaryPassword:temp},201);
  }
  const employeeMatch=path.match(/^\/admin\/employees\/(Z[A-Z0-9-]{2,30})$/);
  if(employeeMatch&&method==='PATCH'){
   const employeeNumber=employeeMatch[1].toUpperCase(); const body=updateEmployeeSchema.parse(parseBody(event));
   const current=(await ddb.send(new GetCommand({TableName:tableName,Key:{PK:`EMP#${employeeNumber}`,SK:'PROFILE'}}))).Item;
   if(!current)return bad('Employee not found',404);
   const updated={...current,...body,employeeNumber,updatedAt:now(),updatedBy:p.employeeNumber};
   await ddb.send(new PutCommand({TableName:tableName,Item:updated}));
   const attrs:any[]=[]; if(body.fullName)attrs.push({Name:'name',Value:body.fullName}); if(body.role)attrs.push({Name:'custom:role',Value:body.role}); if(body.email)attrs.push({Name:'email',Value:body.email},{Name:'email_verified',Value:'true'});
   if(attrs.length)await cognito.send(new AdminUpdateUserAttributesCommand({UserPoolId:userPoolId,Username:employeeNumber,UserAttributes:attrs}));
   if(body.status==='INACTIVE')await cognito.send(new AdminDisableUserCommand({UserPoolId:userPoolId,Username:employeeNumber}));
   if(body.status==='ACTIVE')await cognito.send(new AdminEnableUserCommand({UserPoolId:userPoolId,Username:employeeNumber}));
   await audit(p.employeeNumber,'EMPLOYEE_UPDATED',employeeNumber,body);
   return ok({employee:updated});
  }
  if(employeeMatch&&method==='DELETE'){
   const employeeNumber=employeeMatch[1].toUpperCase();
   const current=(await ddb.send(new GetCommand({TableName:tableName,Key:{PK:`EMP#${employeeNumber}`,SK:'PROFILE'}}))).Item;
   if(!current)return bad('Employee not found',404);
   await cognito.send(new AdminDisableUserCommand({UserPoolId:userPoolId,Username:employeeNumber}));
   const archived={...current,status:'INACTIVE',archivedAt:now(),archivedBy:p.employeeNumber};
   await ddb.send(new PutCommand({TableName:tableName,Item:archived}));
   await audit(p.employeeNumber,'EMPLOYEE_ARCHIVED',employeeNumber,{});
   return ok({message:'Employee archived and sign-in disabled'});
  }
  const resetMatch=path.match(/^\/admin\/employees\/(Z[A-Z0-9-]{2,30})\/reset-password$/);
  if(resetMatch&&method==='POST'){
   const employeeNumber=resetMatch[1].toUpperCase(); const temp=temporaryPassword();
   await cognito.send(new AdminSetUserPasswordCommand({UserPoolId:userPoolId,Username:employeeNumber,Password:temp,Permanent:false}));
   await audit(p.employeeNumber,'EMPLOYEE_PASSWORD_RESET',employeeNumber,{forcedChange:true});
   return ok({employeeNumber,temporaryPassword:temp,message:'Temporary password created. Employee must change it at next login.'});
  }
  const certMatch=path.match(/^\/admin\/employees\/(Z[A-Z0-9-]{2,30})\/certificates$/);
  if(certMatch&&method==='PATCH'){
   const employeeNumber=certMatch[1].toUpperCase(); const body=certificateSchema.parse(parseBody(event));
   const current=(await ddb.send(new GetCommand({TableName:tableName,Key:{PK:`EMP#${employeeNumber}`,SK:'PROFILE'}}))).Item;
   if(!current)return bad('Employee not found',404);
   const updated={...current,...body,updatedAt:now(),updatedBy:p.employeeNumber};
   await ddb.send(new PutCommand({TableName:tableName,Item:updated}));
   await audit(p.employeeNumber,'CERTIFICATES_UPDATED',employeeNumber,body);
   return ok({employee:updated});
  }

  if(path==='/admin/machines'&&method==='GET') return ok({items:(await scanEntity('MACHINE')).sort((a,b)=>String(a.machineId).localeCompare(String(b.machineId)))});
  if(path==='/admin/machines'&&method==='POST'){
   const body=createMachineSchema.parse(parseBody(event));
   const item={PK:`MACHINE#${body.machineId}`,SK:'META',entity:'MACHINE',machineId:body.machineId,machineType:body.machineType,regNo:body.regNo||null,tarNumber:body.regNo||null,siteId:body.siteId,status:'ACTIVE',label:`${body.machineId} - ${body.machineType}${body.regNo?` - ${body.regNo}`:''}`,GSI_StatusPK:`MACHINES#${body.siteId}`,GSI_StatusSK:body.machineId,createdAt:now(),createdBy:p.employeeNumber};
   await ddb.send(new PutCommand({TableName:tableName,Item:item,ConditionExpression:'attribute_not_exists(PK)'})); await audit(p.employeeNumber,'MACHINE_CREATED',body.machineId,{siteId:body.siteId}); return ok({machine:item},201);
  }
  const machineMatch=path.match(/^\/admin\/machines\/([^/]+)$/);
  if(machineMatch&&method==='PATCH'){
   const machineId=decodeURIComponent(machineMatch[1]).toUpperCase(); const body=updateMachineSchema.parse(parseBody(event));
   const current=(await ddb.send(new GetCommand({TableName:tableName,Key:{PK:`MACHINE#${machineId}`,SK:'META'}}))).Item; if(!current)return bad('Machine not found',404);
   const siteId=body.siteId||current.siteId; const machineType=body.machineType||current.machineType; const regNo=body.regNo??current.regNo;
   const updated={...current,...body,machineId,siteId,machineType,regNo,tarNumber:regNo,label:`${machineId} - ${machineType}${regNo?` - ${regNo}`:''}`,GSI_StatusPK:`MACHINES#${siteId}`,updatedAt:now(),updatedBy:p.employeeNumber};
   await ddb.send(new PutCommand({TableName:tableName,Item:updated})); await audit(p.employeeNumber,'MACHINE_UPDATED',machineId,body); return ok({machine:updated});
  }
  if(machineMatch&&method==='DELETE'){
   const machineId=decodeURIComponent(machineMatch[1]).toUpperCase(); const current=(await ddb.send(new GetCommand({TableName:tableName,Key:{PK:`MACHINE#${machineId}`,SK:'META'}}))).Item; if(!current)return bad('Machine not found',404);
   const archived={...current,status:'INACTIVE',archivedAt:now(),archivedBy:p.employeeNumber}; await ddb.send(new PutCommand({TableName:tableName,Item:archived})); await audit(p.employeeNumber,'MACHINE_ARCHIVED',machineId,{}); return ok({message:'Machine archived'});
  }

  if(path==='/admin/sites'&&method==='GET')return ok({items:(await scanEntity('SITE')).sort((a,b)=>String(a.name).localeCompare(String(b.name)))});
  if(path==='/admin/sites'&&method==='POST'){
   const body=siteSchema.parse(parseBody(event)); const item={PK:'CATALOG#SITES',SK:`SITE#${body.siteId}`,entity:'SITE',...body,createdAt:now(),createdBy:p.employeeNumber}; await ddb.send(new PutCommand({TableName:tableName,Item:item,ConditionExpression:'attribute_not_exists(PK)'})); await audit(p.employeeNumber,'SITE_CREATED',body.siteId,{}); return ok({site:item},201);
  }
  const siteMatch=path.match(/^\/admin\/sites\/([^/]+)$/);
  if(siteMatch&&method==='PATCH'){
   const siteId=decodeURIComponent(siteMatch[1]).toUpperCase(); const body=siteSchema.partial().parse(parseBody(event)); const current=(await scanEntity('SITE')).find((x:any)=>x.siteId===siteId); if(!current)return bad('Site not found',404); const updated={...current,...body,siteId,updatedAt:now(),updatedBy:p.employeeNumber}; await ddb.send(new PutCommand({TableName:tableName,Item:updated})); await audit(p.employeeNumber,'SITE_UPDATED',siteId,body); return ok({site:updated});
  }
  if(siteMatch&&method==='DELETE'){
   const siteId=decodeURIComponent(siteMatch[1]).toUpperCase(); const current=(await scanEntity('SITE')).find((x:any)=>x.siteId===siteId); if(!current)return bad('Site not found',404); await ddb.send(new PutCommand({TableName:tableName,Item:{...current,status:'INACTIVE',archivedAt:now()}})); await audit(p.employeeNumber,'SITE_ARCHIVED',siteId,{}); return ok({message:'Site archived'});
  }

  if(path==='/admin/checklists'&&method==='GET')return ok({items:(await scanEntity('CHECKLIST_TEMPLATE')).sort((a,b)=>String(a.name).localeCompare(String(b.name)))});
  if(path==='/admin/checklists'&&method==='POST'){
   const body=checklistTemplateSchema.parse(parseBody(event)); const item={PK:`CHECKLIST#${body.templateId}`,SK:'TEMPLATE',entity:'CHECKLIST_TEMPLATE',...body,createdAt:now(),createdBy:p.employeeNumber}; await ddb.send(new PutCommand({TableName:tableName,Item:item})); await audit(p.employeeNumber,'CHECKLIST_SAVED',body.templateId,{machineType:body.machineType}); return ok({template:item},201);
  }
  const checklistMatch=path.match(/^\/admin\/checklists\/([^/]+)$/);
  if(checklistMatch&&method==='DELETE'){
   const templateId=decodeURIComponent(checklistMatch[1]); await ddb.send(new DeleteCommand({TableName:tableName,Key:{PK:`CHECKLIST#${templateId}`,SK:'TEMPLATE'}})); await audit(p.employeeNumber,'CHECKLIST_DELETED',templateId,{}); return ok({message:'Checklist deleted'});
  }

  if(path==='/admin/emergency-contacts'&&method==='GET')return ok({items:(await scanEntity('EMERGENCY_CONTACT')).sort((a,b)=>String(a.name).localeCompare(String(b.name)))});
  if(path==='/admin/emergency-contacts'&&method==='POST'){
   const body=emergencyContactSchema.parse(parseBody(event)); const item={PK:`EMERGENCY_CONTACT#${body.contactId}`,SK:'META',entity:'EMERGENCY_CONTACT',...body,updatedAt:now(),updatedBy:p.employeeNumber}; await ddb.send(new PutCommand({TableName:tableName,Item:item})); await audit(p.employeeNumber,'EMERGENCY_CONTACT_SAVED',body.contactId,{}); return ok({contact:item},201);
  }
  const contactMatch=path.match(/^\/admin\/emergency-contacts\/([^/]+)$/);
  if(contactMatch&&method==='DELETE'){
   const contactId=decodeURIComponent(contactMatch[1]); await ddb.send(new DeleteCommand({TableName:tableName,Key:{PK:`EMERGENCY_CONTACT#${contactId}`,SK:'META'}})); await audit(p.employeeNumber,'EMERGENCY_CONTACT_DELETED',contactId,{}); return ok({message:'Emergency contact deleted'});
  }

  if(path==='/admin/audit'&&method==='GET'){
   const items=(await scanEntity('AUDIT')).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,200); return ok({items});
  }
  return bad('Route not found',404);
 }catch(e:any){return bad(e.message||'Admin error',e.name==='ConditionalCheckFailedException'?409:e.message?.startsWith('Forbidden')?403:400);}
}
