import Dexie, { Table } from 'dexie';

export interface QueueAttachment {
  field: string;
  category: 'meter-start' | 'meter-end' | 'breakdown';
  file: Blob;
  fileName: string;
  contentType: string;
  array?: boolean;
}
export interface QueueItem {
  id?: number;
  type: 'CLOCK_IN' | 'CLOCK_OUT' | 'FUEL' | 'BREAKDOWN' | 'EMERGENCY' | 'CHECKLIST_REPORT';
  endpoint: string;
  method: 'POST' | 'PATCH';
  payload: Record<string, unknown>;
  attachments?: QueueAttachment[];
  createdAt: string;
  attempts: number;
  status: 'PENDING' | 'FAILED';
  lastError?: string;
}
class ThandanaziDb extends Dexie {
  queue!: Table<QueueItem, number>;
  cache!: Table<{ key: string; value: unknown; updatedAt: string }, string>;
  constructor() {
    super('thandanazi-workforce');
    this.version(2).stores({ queue: '++id,status,type,createdAt', cache: 'key' });
  }
}
export const db = new ThandanaziDb();
export async function cacheSet(key: string, value: unknown) { await db.cache.put({ key, value, updatedAt: new Date().toISOString() }); }
export async function cacheGet<T>(key: string): Promise<T | undefined> { return (await db.cache.get(key))?.value as T | undefined; }
export async function enqueue(item: Omit<QueueItem, 'createdAt' | 'attempts' | 'status'>) {
  await db.queue.add({ ...item, createdAt: new Date().toISOString(), attempts: 0, status: 'PENDING' });
  // During the recovery deployment we intentionally unregister service workers to prevent stale blank screens.
  // Offline queueing must therefore never hang while waiting for navigator.serviceWorker.ready.
  if ('serviceWorker' in navigator && 'SyncManager' in window && navigator.serviceWorker.controller) {
    try {
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Service worker not ready')), 2500))]);
      await (reg as any).sync.register('sync-queue');
    } catch {
      // Queue is already safely stored in IndexedDB. Do not block user flow when background sync is unavailable.
    }
  }
}
