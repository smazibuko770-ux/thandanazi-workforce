const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

export function cors() {
  return {
    'content-type': 'application/json',
    'access-control-allow-origin': CORS_ORIGIN,
    'access-control-allow-headers': 'authorization,content-type,x-thandanazi-request-id',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-max-age': '300'
  };
}

export function ok(body: unknown, statusCode = 200) { return { statusCode, headers: cors(), body: JSON.stringify(body) }; }
export function bad(message: string, statusCode = 400) { return ok({ error: message, message }, statusCode); }
export function parseBody<T>(event: { body?: string | null }): T { return event.body ? JSON.parse(event.body) : {} as T; }
