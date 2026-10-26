import { ShiftRecord } from '../types/domain';

const ACTIVE_SHIFT_KEY = 'thandanazi.local.activeShift.v1';
const LAST_MESSAGE_KEY = 'thandanazi.local.lastWorkerMessage.v1';

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

export function loadLocalActiveShift(): ShiftRecord | null {
  return safeParse<ShiftRecord>(localStorage.getItem(ACTIVE_SHIFT_KEY));
}

export function saveLocalActiveShift(shift: ShiftRecord) {
  localStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
}

export function clearLocalActiveShift() {
  localStorage.removeItem(ACTIVE_SHIFT_KEY);
}

export function saveWorkerMessage(message: string) {
  localStorage.setItem(LAST_MESSAGE_KEY, message);
}

export function takeWorkerMessage(): string {
  const message = localStorage.getItem(LAST_MESSAGE_KEY) || '';
  if (message) localStorage.removeItem(LAST_MESSAGE_KEY);
  return message;
}
