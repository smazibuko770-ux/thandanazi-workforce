import { APIGatewayProxyEventV2 } from 'aws-lambda';
export type Role = 'worker' | 'supervisor' | 'admin' | 'mechanic';
export type Principal = { employeeNumber: string; role: Role; sub: string };

const allowedRoles: Role[] = ['worker', 'supervisor', 'admin', 'mechanic'];
function normaliseRole(value: unknown): Role {
  const raw = String(value || 'worker').toLowerCase();
  return allowedRoles.includes(raw as Role) ? raw as Role : 'worker';
}

export function principal(event: APIGatewayProxyEventV2): Principal {
  const claims = (event.requestContext as any).authorizer?.jwt?.claims;
  if (!claims) throw new Error('Unauthorized');

  const employeeNumber = String(
    claims['custom:employeeNumber'] ||
    claims['cognito:username'] ||
    claims.username ||
    ''
  ).toUpperCase();

  const role = normaliseRole(claims['custom:role'] || claims.role || 'worker');
  const sub = String(claims.sub || claims.username || employeeNumber || '');

  if (!employeeNumber) throw new Error('Invalid identity token');
  return { employeeNumber, role, sub };
}

export function requireSupervisor(p: Principal) {
  if (p.role !== 'supervisor' && p.role !== 'admin') throw new Error('Forbidden: supervisor or admin role required');
}

export function requireAdmin(p: Principal) {
  if (p.role !== 'admin') throw new Error('Forbidden: admin role required');
}

export function requireOperationsViewer(p: Principal) {
  if (!['supervisor', 'admin', 'mechanic'].includes(p.role)) throw new Error('Forbidden: operations access required');
}

export function canUpdateOperations(p: Principal) {
  return p.role === 'supervisor' || p.role === 'admin';
}
