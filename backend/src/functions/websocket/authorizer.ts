import { APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID!,
  tokenUse: 'id',
  clientId: process.env.USER_POOL_CLIENT_ID!
});

export async function handler(event: APIGatewayRequestAuthorizerEventV2) {
  try {
    const token = event.queryStringParameters?.token || event.headers?.authorization?.replace(/^Bearer /i, '');
    if (!token) throw new Error('Missing token');
    const payload = await verifier.verify(token);
    const employeeNumber = String(payload['custom:employeeNumber'] || payload['cognito:username'] || payload.username || '').toUpperCase();
    const role = String(payload['custom:role'] || 'worker').toLowerCase();
    if (!employeeNumber) throw new Error('Invalid token');
    return {
      principalId: employeeNumber,
      policyDocument: { Version: '2012-10-17', Statement: [{ Action: 'execute-api:Invoke', Effect: 'Allow', Resource: event.routeArn }] },
      context: { employeeNumber, role }
    };
  } catch {
    return { principalId: 'unauthorized', policyDocument: { Version: '2012-10-17', Statement: [{ Action: 'execute-api:Invoke', Effect: 'Deny', Resource: event.routeArn }] } };
  }
}
