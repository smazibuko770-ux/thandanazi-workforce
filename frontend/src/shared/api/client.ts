import { safeUuid } from '../utils/id';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

let accessToken: string | null = null;
export function setAccessToken(token: string | null) { accessToken = token; }
export function getAccessToken() { return accessToken; }

export function isNetworkFailure(error: unknown): boolean {
  const message = String((error as any)?.message || error || '').toLowerCase();
  const name = String((error as any)?.name || '').toLowerCase();
  return name === 'typeerror' || message.includes('load failed') || message.includes('failed to fetch') || message.includes('network') || message.includes('cors') || message.includes('timed out') || message.includes('offline') || message.includes('aws connection unavailable') || message.includes('connection unavailable') || message.includes('could not be reached');
}

function readableError(body: string, fallback: string) {
  if (!body) return fallback;
  try {
    const parsed = JSON.parse(body);
    return String(parsed.message || parsed.error || body);
  } catch {
    return body;
  }
}

function requestId() {
  try { return safeUuid(); } catch { return `REQ-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error('API URL is not configured. Check VITE_API_BASE_URL in frontend/.env.');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25000);
  const id = requestId();
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-thandanazi-request-id': id,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      const body = await res.text();
      const message = readableError(body, `API error ${res.status}`);
      if (res.status === 401 || /token|expired|unauthorized/i.test(message)) {
        window.dispatchEvent(new CustomEvent('thandanazi-auth-expired'));
        throw new Error('Your secure session expired. Please sign in again.');
      }
      if (res.status === 403 || /forbidden|not authorised|not authorized/i.test(message)) {
        throw new Error('Access denied. Your Z-number does not have permission for this section. Use an admin or supervisor account.');
      }
      throw new Error(message);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('Request timed out. Check your internet connection and try again.');
    if (!navigator.onLine) throw new Error('Device is offline. The action was not sent to the server.');
    if (isNetworkFailure(error)) throw new Error('AWS connection unavailable. Field actions are saved locally where possible and will sync later.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
