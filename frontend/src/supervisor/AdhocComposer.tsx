import { useEffect, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { api } from '../shared/api/client';
import { Employee, Site } from '../shared/types/domain';

type TaskTargetsResponse = { employees: Employee[]; sites: Site[] };

export function AdhocComposer() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [target, setTarget] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadTargets() {
    setLoading(true);
    setError('');
    try {
      const result = await api<TaskTargetsResponse>('/supervisor/task-targets');
      setEmployees((result.employees || []).filter((x) => x.status !== 'INACTIVE' && x.role === 'worker'));
      setSites((result.sites || []).filter((x) => x.status !== 'INACTIVE'));
    } catch (e: any) {
      setEmployees([]);
      setSites([]);
      setError(e.message || 'Could not load workers and sites for task assignment.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadTargets(); }, []);

  function employeesForSite(siteId: string) {
    return employees.filter((e) => {
      const siteIds = e.siteIds || [];
      return siteIds.includes('ALL') || siteIds.includes(siteId);
    });
  }

  async function send() {
    if (!target || !title.trim() || !description.trim()) {
      alert('Select a recipient and enter a title and description.');
      return;
    }

    setBusy(true);
    try {
      let assignedTo: string[] = [];

      if (target === 'ALL_WORKERS') {
        assignedTo = employees.map((e) => e.employeeNumber);
      } else if (target.startsWith('SITE:')) {
        const siteId = target.slice(5);
        assignedTo = employeesForSite(siteId).map((e) => e.employeeNumber);
      } else {
        assignedTo = [target];
      }

      assignedTo = [...new Set(assignedTo)].filter(Boolean);
      if (!assignedTo.length) throw new Error('No active workers found for this selection.');

      await api('/supervisor/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority,
          assignedTo
        })
      });

      setTitle('');
      setDescription('');
      setTarget('');
      alert(`Task sent to ${assignedTo.length} worker(s).`);
    } catch (e: any) {
      alert(e.message || 'Task could not be sent');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="section-title">Communication</p>
          <h2 className="font-black">Send Ad Hoc Task</h2>
          <p className="text-xs text-zinc-500 mt-1">Send a task to one worker, all workers, or all workers assigned to a selected site.</p>
        </div>
        <button className="h-10 w-10 rounded-2xl bg-white/5 grid place-items-center" onClick={loadTargets} disabled={loading} title="Reload workers and sites">
          <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-3 mb-3 text-xs text-yellow-100">
          <p className="font-bold mb-1">Task target warning</p>
          <p>{error}</p>
          <button className="btn mt-2 bg-yellow-500 text-black" onClick={loadTargets} disabled={loading}>Retry loading workers/sites</button>
        </div>
      )}

      <label className="text-[11px] text-zinc-500 font-bold uppercase">Task recipient</label>
      <select className="input mb-2" value={target} onChange={(e) => setTarget(e.target.value)} disabled={loading}>
        <option value="">Select worker or site</option>
        <option value="ALL_WORKERS">All active workers</option>
        {sites.map((s) => (
          <option key={s.siteId} value={`SITE:${s.siteId}`}>All workers at {s.name}</option>
        ))}
        {employees.map((e) => (
          <option key={e.employeeNumber} value={e.employeeNumber}>{e.employeeNumber} • {e.fullName}</option>
        ))}
      </select>

      <input className="input mb-2" placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="input mb-2 min-h-24" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <select className="input mb-3" value={priority} onChange={(e) => setPriority(e.target.value as 'Normal' | 'Urgent')}>
        <option>Normal</option>
        <option>Urgent</option>
      </select>

      <button className="btn bg-orange-500 text-black w-full flex items-center justify-center gap-2" disabled={busy || loading} onClick={send}>
        <Send size={16} /> {busy ? 'Sending...' : 'Send Task'}
      </button>
    </section>
  );
}
