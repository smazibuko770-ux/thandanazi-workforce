import { db, QueueItem } from './db';
import { api, isNetworkFailure } from '../api/client';
import { uploadBlob } from '../api/uploads';

function sortQueue(items: QueueItem[]) {
  const weight: Record<QueueItem['type'], number> = {
    CHECKLIST_REPORT: 10,
    CLOCK_IN: 20,
    FUEL: 30,
    BREAKDOWN: 40,
    EMERGENCY: 50,
    CLOCK_OUT: 90
  };
  return [...items].sort((a, b) => {
    const shiftA = String(a.payload?.shiftId || '');
    const shiftB = String(b.payload?.shiftId || '');
    if (shiftA && shiftA === shiftB && weight[a.type] !== weight[b.type]) return weight[a.type] - weight[b.type];
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function canTreatAsAlreadySynced(item: QueueItem, error: unknown) {
  const message = String((error as any)?.message || error || '').toLowerCase();
  if (item.type === 'CLOCK_OUT' && (message.includes('not active') || message.includes('already') || message.includes('completed'))) return true;
  if (item.type === 'CLOCK_IN' && message.includes('active shift already exists')) return true;
  if (message.includes('duplicate') || message.includes('conditionalcheckfailed')) return true;
  return false;
}

export async function syncQueue() {
  if (!navigator.onLine) return { synced: 0, failed: 0 };
  const pending = sortQueue(await db.queue.where('status').anyOf('PENDING', 'FAILED').toArray());
  let synced = 0, failed = 0;

  for (const item of pending) {
    try {
      const payload: Record<string, unknown> = { ...item.payload };
      for (const attachment of item.attachments || []) {
        const key = await uploadBlob(attachment.file, attachment.fileName, attachment.contentType, attachment.category);
        if (attachment.array) payload[attachment.field] = [...((payload[attachment.field] as string[] | undefined) || []), key];
        else payload[attachment.field] = key;
      }
      await api(item.endpoint, { method: item.method, body: JSON.stringify(payload) });
      await db.queue.delete(item.id!);
      synced++;
    } catch (error: any) {
      if (canTreatAsAlreadySynced(item, error)) {
        await db.queue.delete(item.id!);
        synced++;
        continue;
      }
      failed++;
      const attempts = item.attempts + 1;
      const transient = isNetworkFailure(error) || String(error?.message || '').toLowerCase().includes('shift not found');
      await db.queue.update(item.id!, {
        attempts,
        status: transient || attempts < 10 ? 'PENDING' : 'FAILED',
        lastError: error?.message || 'Sync failed'
      });
    }
  }
  return { synced, failed };
}

navigator.serviceWorker?.addEventListener?.('message', (event) => {
  if (event.data?.type === 'SYNC_QUEUE') void syncQueue();
});
window.addEventListener('online', () => void syncQueue());
