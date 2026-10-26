const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const SAST_OFFSET_MS = 2 * HOUR_MS;

export type ShiftType = 'DAY' | 'NIGHT';

export interface ShiftClassification {
  shiftType: ShiftType;
  nightShift: boolean;
  totalHours: number;
  nightHours: number;
  dayHours: number;
  payrollDate: string;
  shiftWindowLabel: string;
}

function toMs(value: string | number | Date) {
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error('Invalid shift time supplied for night-shift calculation');
  return ms;
}

function localParts(msUtc: number) {
  const d = new Date(msUtc + SAST_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), hour: d.getUTCHours() };
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function localDate(msUtc: number) {
  const p = localParts(msUtc);
  return ymd(p.year, p.month, p.day);
}

function previousLocalDate(msUtc: number) {
  const local = new Date(msUtc + SAST_OFFSET_MS);
  local.setUTCDate(local.getUTCDate() - 1);
  return ymd(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
}

function localDayStartUtc(msUtc: number) {
  const p = localParts(msUtc);
  return Date.UTC(p.year, p.month, p.day) - SAST_OFFSET_MS;
}

function isClockInDuringNightWindow(msUtc: number) {
  const hour = localParts(msUtc).hour;
  return hour >= 18 || hour < 6;
}

export function classifyShift(clockInTime: string | number | Date, clockOutTime?: string | number | Date): ShiftClassification {
  const start = toMs(clockInTime);
  const end = clockOutTime ? Math.max(start, toMs(clockOutTime)) : start;
  const totalMs = clockOutTime ? Math.max(0, end - start) : 0;
  let nightMs = 0;
  const firstDay = localDayStartUtc(start) - DAY_MS;
  const lastDay = localDayStartUtc(end) + DAY_MS;

  if (clockOutTime) {
    for (let dayStart = firstDay; dayStart <= lastDay; dayStart += DAY_MS) {
      const nightStart = dayStart + 18 * HOUR_MS;
      const nightEnd = dayStart + DAY_MS + 6 * HOUR_MS;
      nightMs += Math.max(0, Math.min(end, nightEnd) - Math.max(start, nightStart));
    }
  }

  const hasNight = clockOutTime ? nightMs > 0 : isClockInDuringNightWindow(start);
  const payrollDate = hasNight && localParts(start).hour < 6 ? previousLocalDate(start) : localDate(start);
  const nightHours = Number((nightMs / HOUR_MS).toFixed(2));
  const totalHours = Number((totalMs / HOUR_MS).toFixed(2));
  const dayHours = Number(Math.max(0, totalHours - nightHours).toFixed(2));

  return {
    shiftType: hasNight ? 'NIGHT' : 'DAY',
    nightShift: hasNight,
    totalHours,
    nightHours,
    dayHours,
    payrollDate,
    shiftWindowLabel: hasNight ? 'Night Shift (18:00-06:00 SAST)' : 'Day Shift'
  };
}
