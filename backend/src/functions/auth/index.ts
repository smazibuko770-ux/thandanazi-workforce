import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ok } from '../../shared/response.js';
import { principal } from '../../shared/auth.js';
export async function handler(event: APIGatewayProxyEventV2) { return ok({ user: principal(event) }); }
