import { useEffect, useMemo, useState } from 'react';
import { Camera, Fuel, RefreshCw, Zap } from 'lucide-react';
import { api } from '../shared/api/client';
import { uploadImage } from '../shared/api/uploads';
import { PhotoInput } from '../shared/components/PhotoInput';

type Task = {
  taskId: string;
  title: string;
  description: string;
  priority: 'Normal' | 'Urgent';
  status: 'Unread' | 'Read' | 'Completed';
  createdAt: string;
  sourceEntity?: string;
  sourceId?: string;
};

type FuelDraft = { litres: string; notes: string; photos: File[] };

type Stock = { balanceLitres: number; updatedAt?: string };

function emptyDraft(): FuelDraft { return { litres: '', notes: '', photos: [] }; }

export function FuelTasksPanel({ compact = false }: { compact?: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stock, setStock] = useState<Stock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyTask, setBusyTask] = useState('');
  const [drafts, setDrafts] = useState<Record<string, FuelDraft>>({});
  const [lastRefresh, setLastRefresh] = useState('');

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await api<{ items: Task[] }>('/tasks');
      const items = response.items || [];
      setTasks(items);
      try {
        setStock(await api<Stock>('/tasks/fuel-stock'));
      } catch {
        setStock(null);
      }
      setLastRefresh(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e: any) {
      if (!silent) setError(e.message || 'Fuel tasks could not be loaded.');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 10000);
    const onTask = () => void load(true);
    window.addEventListener('thandanazi-task-assigned', onTask);
    window.addEventListener('focus', onTask);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('thandanazi-task-assigned', onTask);
      window.removeEventListener('focus', onTask);
    };
  }, []);

  const fuelTasks = useMemo(
    () => tasks.filter((task) => task.sourceEntity === 'FUEL' && task.status !== 'Completed'),
    [tasks]
  );

  function draftFor(taskId: string) { return drafts[taskId] || emptyDraft(); }
  function updateDraft(taskId: string, patch: Partial<FuelDraft>) {
    setDrafts((current) => ({ ...current, [taskId]: { ...(current[taskId] || emptyDraft()), ...patch } }));
  }

  async function completeFuelTask(task: Task) {
    const draft = draftFor(task.taskId);
    const litres = Number(draft.litres);
    if (!task.sourceId) return alert('Fuel request ID missing on this task. Refresh and try again.');
    if (!Number.isFinite(litres) || litres <= 0) return alert('Enter litres distributed.');
    if (draft.photos.length < 1) return alert('Take at least one fuel delivery photo.');
    setBusyTask(task.taskId);
    try {
      const photos = await Promise.all(draft.photos.map((photo) => uploadImage(photo, 'fuel-distribution')));
      await api(`/tasks/${task.taskId}/fuel-complete`, {
        method: 'POST',
        body: JSON.stringify({ fuelId: task.sourceId, litres, photos, notes: draft.notes })
      });
      setDrafts((current) => { const copy = { ...current }; delete copy[task.taskId]; return copy; });
      navigator.vibrate?.([120, 60, 120]);
      alert('Fuel distribution captured, stock balance updated, and request marked resolved.');
      await load();
    } catch (e: any) {
      alert(e.message || 'Fuel completion failed. Refresh the dashboard and try again.');
    } finally {
      setBusyTask('');
    }
  }

  async function enableAlerts() {
    try {
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
      navigator.vibrate?.([120, 60, 120]);
      alert('Task alerts enabled where supported. Keep the app open for instant vibration alerts.');
    } catch {
      alert('This browser does not support notification permissions. In-app alerts will still show.');
    }
  }

  return <div className={compact ? 'card-glow mb-4' : 'card-glow mb-4'}>
    <div className="flex justify-between gap-3 items-start mb-3">
      <div>
        <p className="section-title">Themba fuel dashboard</p>
        <h2 className="font-black text-xl">Fuel requests</h2>
        <p className="text-xs text-zinc-400 mt-1">Auto-refreshes every 10 seconds. New requests appear here without going to My Tasks.</p>
      </div>
      <button className="btn bg-white/5 border border-white/10 text-xs px-3 py-2" onClick={() => load()}><RefreshCw size={14}/></button>
    </div>

    {stock && <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-3 mb-3 flex items-center gap-3">
      <Fuel className="text-blue-300"/>
      <div>
        <p className="text-xs text-blue-200 uppercase tracking-[0.18em]">Current fuel balance</p>
        <p className="text-2xl font-black">{stock.balanceLitres.toLocaleString()} L</p>
        {stock.updatedAt && <p className="text-[11px] text-blue-100/70">Updated {new Date(stock.updatedAt).toLocaleString()}</p>}
      </div>
    </div>}

    <div className="grid grid-cols-2 gap-2 mb-3">
      <button className="btn bg-orange-500 text-black" onClick={enableAlerts}><Zap size={16}/> Enable alerts</button>
      <button className="btn bg-white/5 border border-white/10" onClick={() => load()}>{loading ? 'Loading...' : 'Refresh now'}</button>
    </div>
    {lastRefresh && <p className="text-[11px] text-zinc-500 mb-3">Last refreshed: {lastRefresh}</p>}
    {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm mb-3">{error}</div>}
    {!loading && !error && fuelTasks.length === 0 && <div className="rounded-2xl bg-white/[0.04] p-3 text-zinc-400 text-sm">No open fuel requests assigned to Themba at the moment.</div>}

    {fuelTasks.map((task) => {
      const draft = draftFor(task.taskId);
      return <div className="rounded-3xl border border-blue-500/25 bg-blue-500/10 p-4 mt-3" key={`${task.taskId}-${task.createdAt}`}>
        <div className="flex justify-between gap-3">
          <div>
            <h3 className="font-black text-blue-50">{task.title}</h3>
            <p className="text-sm text-blue-100/70 mt-1">{task.description}</p>
            <p className="text-xs text-blue-100/50 mt-2">Created {new Date(task.createdAt).toLocaleString()}</p>
          </div>
          <span className="badge bg-red-500/15 text-red-300 h-fit">{task.priority}</span>
        </div>

        <div className="mt-4">
          <label className="text-xs text-zinc-400 font-bold">Litres distributed</label>
          <input className="input mt-2 mb-3" type="number" min="0" step="0.1" inputMode="decimal" value={draft.litres} onChange={(e) => updateDraft(task.taskId, { litres: e.target.value })} placeholder="Example: 200" />
          <label className="text-xs text-zinc-400 font-bold">Notes / machine condition</label>
          <textarea className="input min-h-24 mt-2 mb-3" value={draft.notes} onChange={(e) => updateDraft(task.taskId, { notes: e.target.value })} placeholder="Optional note about fuel issued" />
          <div className="card bg-black/20 mb-3">
            <div className="flex items-center gap-2 mb-3"><Camera className="text-orange-500"/><p className="font-bold">Fuel delivery photo</p></div>
            <PhotoInput label="Take fuel photo" onFile={(file) => updateDraft(task.taskId, { photos: [...draft.photos, file] })}/>
            {draft.photos.length > 0 && <p className="text-green-400 text-sm mt-2">✓ {draft.photos.length} photo(s) attached</p>}
          </div>
          <button className="btn bg-blue-600 w-full" disabled={busyTask === task.taskId} onClick={() => completeFuelTask(task)}>{busyTask === task.taskId ? 'Saving fuel record...' : 'Save litres & resolve request'}</button>
        </div>
      </div>;
    })}
  </div>;
}
