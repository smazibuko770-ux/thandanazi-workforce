import { WebSocketEnvelope } from '../types/domain';
import { getAccessToken } from '../api/client';

export function connectRealtime(employeeNumber: string, onEvent: (event: WebSocketEnvelope) => void) {
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (!wsUrl) return { close() {} };
  const token = getAccessToken();
  const params = new URLSearchParams({ employeeNumber });
  if (token) params.set('token', token);
  const ws = new WebSocket(`${wsUrl}?${params.toString()}`);
  ws.onmessage = (msg) => {
    try { onEvent(JSON.parse(msg.data)); } catch { /* ignore malformed event */ }
  };
  return ws;
}

export function foregroundNotify(message: string) {
  // Foreground-first alert: vibration + short sound + optional browser notification.
  // Full background push notifications require a separate Web Push/FCM setup.
  try { navigator.vibrate?.([300, 120, 300, 120, 500]); } catch {}
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, 220);
  } catch {}
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('THANDANAZI task alert', { body: message, tag: 'thandanazi-task' });
    }
  } catch {}
  console.warn(message);
}
