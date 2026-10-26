import { useEffect, useState } from 'react';
import { AlertOctagon, CheckCircle2, Fuel, RefreshCw, Wrench } from 'lucide-react';
import { api } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthProvider';

type Row = {
  entity: string;
  reportId?: string;
  emergencyId?: string;
  breakdownId?: string;
  requestId?: string;
  fuelId?: string;
  machineId?: string;
  status: string;
  severity?: string;
  type?: string;
  description?: string;
  notes?: string;
  fuelLevel?: number;
  items?: Array<{ label: string; defectClass: string; remarks: string }>;
  machineBlocked?: boolean;
  reportSeverity?: string;
  requiredAction?: string;
  createdAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  assignedFuelWorker?: string;
  assignedFuelWorkerName?: string;
  fuelAssignedAt?: string;
  fuelAssignedBy?: string;
  taskId?: string;
  distributedLitres?: number;
  fuelBalanceAfter?: number;
  distributionPhotos?: string[];
  inProgressComment?: string;
  inProgressAt?: string;
  inProgressBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  mechanicComment?: string;
  mechanicComments?: Array<{at:string;by:string;status:string;comment:string}>;
};

function rowId(row: Row) {
  return row.reportId || row.emergencyId || row.breakdownId || row.requestId || row.fuelId || '';
}

export function OperationsMonitor({ readOnly = false, mechanicOnly = false }: { readOnly?: boolean; mechanicOnly?: boolean } = {}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stock, setStock] = useState<{ balanceLitres:number; totalReceivedLitres?:number; totalIssuedLitres?:number; updatedAt?:string } | null>(null);
  const [receiveLitres, setReceiveLitres] = useState('');
  const [receiveSupplier, setReceiveSupplier] = useState('');
  const [receiveNote, setReceiveNote] = useState('');
  const [commentById, setCommentById] = useState<Record<string,string>>({});

  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ items: Row[] }>('/supervisor/ops');
      const items = mechanicOnly ? r.items.filter((row) => row.entity === 'BREAKDOWN' || row.entity === 'CHECKLIST_REPORT') : r.items;
      setRows(items);
      if (!readOnly && !mechanicOnly) {
        try { setStock(await api<{ balanceLitres:number; totalReceivedLitres?:number; totalIssuedLitres?:number; updatedAt?:string }>('/supervisor/fuel-stock')); } catch { setStock(null); }
      }
    } catch (e: any) {
      setError(e.message || 'Could not load operations');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const onOps = () => void load();
    window.addEventListener('thandanazi-ops-updated', onOps);
    return () => window.removeEventListener('thandanazi-ops-updated', onOps);
  }, []);
  useEffect(() => {
    if (!mechanicOnly) return;
    const timer = window.setInterval(() => { void load(); }, 15000);
    return () => window.clearInterval(timer);
  }, [mechanicOnly]);

  async function update(row: Row, status: string) {
    const id = rowId(row);
    if (!id) {
      setError('This report is missing an ID and cannot be updated.');
      return;
    }

    const entity = row.entity;
    const mechanicAllowedStatuses = ['Acknowledged', 'In Progress', 'Resolved'];
    if (readOnly && !(mechanicOnly && mechanicAllowedStatuses.includes(status) && ['BREAKDOWN', 'CHECKLIST_REPORT'].includes(entity))) {
      setError('This role can only update breakdowns and checklist faults to Acknowledged, In Progress, or Resolved.');
      return;
    }

    const comment = (commentById[id] || '').trim();
    if (mechanicOnly && status === 'In Progress' && !comment) {
      setError('Add a mechanic comment or reason for delay before marking the item In Progress.');
      return;
    }

    setUpdatingId(id);
    setError('');
    setSuccess('');
    try {
      await api(`/supervisor/ops/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ entity, status, comment, returnMachineToService: entity === 'CHECKLIST_REPORT' && status === 'Resolved' })
      });
      setCommentById((current)=>({ ...current, [id]: '' }));
      setSuccess(status === 'In Progress'
        ? 'Status changed to In Progress. The note is visible to supervisors/admins and the item remains open until resolved.'
        : `Status changed to ${status}.`);
      await load();
    } catch (e: any) {
      setError(e.message || 'Update failed');
    } finally {
      setUpdatingId('');
    }
  }


  async function receiveFuelStock() {
    const litres = Number(receiveLitres);
    if (!Number.isFinite(litres) || litres <= 0) return setError('Enter total litres received from supplier.');
    setUpdatingId('FUEL_STOCK');
    setError('');
    try {
      const saved = await api<{ balanceLitres:number; totalReceivedLitres?:number; totalIssuedLitres?:number; updatedAt?:string }>('/supervisor/fuel-stock/receive', {
        method: 'POST',
        body: JSON.stringify({ litres, supplier: receiveSupplier.trim(), deliveryNote: receiveNote.trim() })
      });
      setStock(saved);
      setReceiveLitres('');
      setReceiveSupplier('');
      setReceiveNote('');
      alert('Fuel stock captured and balance updated.');
      await load();
    } catch (e:any) {
      setError(e.message || 'Fuel stock could not be captured.');
    } finally {
      setUpdatingId('');
    }
  }

  const icon = (e: string) => e === 'CHECKLIST_REPORT'
    ? <AlertOctagon className="text-red-400" />
    : e === 'EMERGENCY'
      ? <AlertOctagon className="text-red-400" />
      : e === 'BREAKDOWN'
        ? <Wrench className="text-yellow-400" />
        : <Fuel className="text-blue-400" />;

  return (
    <section className="card mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="section-title">Operations</p>
          <h2 className="font-black">Alerts & defect reports</h2>
          {mechanicOnly && <p className="text-xs text-zinc-500 mt-1">Mechanic access is limited to breakdowns and checklist faults. Mechanics can acknowledge, mark in progress, and mark resolved.</p>}
        </div>
        <button className="h-10 w-10 rounded-2xl bg-white/5 grid place-items-center" onClick={load} disabled={busy}>
          <RefreshCw size={17} className={busy ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      {success && <p className="text-green-300 text-sm mb-3">{success}</p>}
      {!mechanicOnly && stock && <div className="card mb-4 border-blue-500/30 bg-blue-500/10"><div className="flex justify-between gap-3"><div><p className="section-title text-blue-200">Fuel Stock Balance</p><h3 className="text-2xl font-black">{stock.balanceLitres.toLocaleString()} L</h3><p className="text-[11px] text-blue-100/70 mt-1">Received: {(stock.totalReceivedLitres||0).toLocaleString()} L • Issued: {(stock.totalIssuedLitres||0).toLocaleString()} L</p>{stock.updatedAt&&<p className="text-[11px] text-blue-100/70">Updated {new Date(stock.updatedAt).toLocaleString()}</p>}</div></div>{isAdmin&&<div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3"><p className="font-bold text-sm mb-2">Capture fuel received from supplier</p><div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><input className="input" type="number" min="0" step="0.1" value={receiveLitres} onChange={e=>setReceiveLitres(e.target.value)} placeholder="Litres received"/><input className="input" value={receiveSupplier} onChange={e=>setReceiveSupplier(e.target.value)} placeholder="Supplier (optional)"/><input className="input" value={receiveNote} onChange={e=>setReceiveNote(e.target.value)} placeholder="Delivery note / notes"/></div><button className="btn bg-blue-600 w-full mt-3" disabled={updatingId==='FUEL_STOCK'} onClick={receiveFuelStock}>{updatingId==='FUEL_STOCK'?'Saving fuel stock...':'Add fuel stock'}</button></div>}</div>}
      {!rows.length && !busy && <p className="text-sm text-zinc-500">No open operational reports.</p>}

      <div className="space-y-3 max-h-[520px] overflow-y-auto">
        {rows.map((row, index) => {
          const id = rowId(row) || String(index);
          const isMechanicReport = mechanicOnly && ['BREAKDOWN', 'CHECKLIST_REPORT'].includes(row.entity);
          const isFinalStatus = ['Resolved', 'Closed'].includes(row.status);
          const canMechanicAcknowledge = isMechanicReport && row.status === 'Open';
          const canMechanicStartProgress = isMechanicReport && ['Open', 'Acknowledged'].includes(row.status);
          const canMechanicResolve = isMechanicReport && ['Open', 'Acknowledged', 'In Progress'].includes(row.status) && !isFinalStatus;

          return (
            <div className={`kpi ${row.machineBlocked ? 'border-red-500/40' : ''}`} key={id}>
              <div className="flex gap-3">
                {icon(row.entity)}
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <p className="font-black">{row.entity === 'CHECKLIST_REPORT' ? 'Checklist NO GO report' : row.entity}</p>
                    <span className={`text-xs font-bold ${row.machineBlocked ? 'text-red-400' : 'text-orange-400'}`}>{row.machineBlocked ? 'MACHINE BLOCKED' : row.status}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{row.machineId || row.type || 'Operational report'}</p>
                  {row.createdAt && <p className="text-[11px] text-zinc-600 mt-1">Created: {new Date(row.createdAt).toLocaleString()}</p>}
                  {row.requiredAction && <p className="text-xs text-orange-300 mt-2">{row.requiredAction}</p>}
                  {row.items?.map((i) => (
                    <div className="mt-2 rounded-xl bg-black/30 p-2" key={`${i.defectClass}-${i.label}`}>
                      <p className="text-xs font-bold">Class {i.defectClass}: {i.label}</p>
                      <p className="text-xs text-zinc-400">{i.remarks}</p>
                    </div>
                  ))}
                  {row.fuelLevel !== undefined && <p className="text-xs text-zinc-400 mt-2">Fuel level requested: {row.fuelLevel}%</p>}
                  {row.distributedLitres !== undefined && <p className="text-xs text-green-300 mt-2">Fuel distributed: {row.distributedLitres} L • Balance after: {row.fuelBalanceAfter ?? 'n/a'} L</p>}
                  {(row.description || row.notes) && <p className="text-xs text-zinc-400 mt-2">{row.description || row.notes}</p>}
                  {row.inProgressComment && <div className="mt-2 rounded-xl border border-orange-500/25 bg-orange-500/10 p-2"><p className="text-xs font-bold text-orange-200">In progress</p><p className="text-xs text-yellow-100 mt-1">{row.inProgressComment}</p><p className="text-[11px] text-zinc-400 mt-1">By {row.inProgressBy || 'mechanic'}{row.inProgressAt ? ` • ${new Date(row.inProgressAt).toLocaleString()}` : ''}</p></div>}
                  {row.mechanicComments?.filter((comment) => !(comment.status === 'In Progress' && comment.comment === row.inProgressComment)).map((comment, i)=><p key={i} className="text-[11px] text-zinc-400 mt-1">{comment.status} by {comment.by}: {comment.comment}</p>)}
                  {row.acknowledgedAt && <p className="text-[11px] text-green-400 mt-2">Acknowledged by {row.acknowledgedBy || 'supervisor/admin'} on {new Date(row.acknowledgedAt).toLocaleString()}</p>}
                  {row.entity === 'FUEL' && row.assignedFuelWorker && <p className="text-[11px] text-blue-300 mt-2">Fuel task assigned to {row.assignedFuelWorkerName || row.assignedFuelWorker} {row.fuelAssignedAt ? `on ${new Date(row.fuelAssignedAt).toLocaleString()}` : ''}</p>}
                </div>
              </div>

              {mechanicOnly ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">
                  <p className="font-bold text-zinc-200">Mechanic machine status</p>
                  <p className="mt-1">Add the repair update or reason for delay, then select In Progress. The item stays in the active queue until Resolved.</p><textarea className="input min-h-24 mt-3" value={commentById[id] || ''} onChange={(e)=>setCommentById((current)=>({ ...current, [id]: e.target.value }))} placeholder="Required for In Progress: repair update or reason for delay" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                    <button className="btn bg-green-600 w-full flex items-center justify-center gap-2" disabled={!canMechanicAcknowledge || updatingId === id} onClick={() => update(row, 'Acknowledged')}>
                      <CheckCircle2 size={16} /> {row.status === 'Acknowledged' ? 'Acknowledged' : updatingId === id ? 'Saving...' : 'Acknowledge'}
                    </button>
                    <button className="btn bg-orange-600 w-full flex items-center justify-center gap-2" disabled={!canMechanicStartProgress || updatingId === id} onClick={() => update(row, 'In Progress')}>
                      <Wrench size={16} /> {row.status === 'In Progress' ? 'In progress' : updatingId === id ? 'Saving...' : 'In progress'}
                    </button>
                    <button className="btn bg-blue-600 w-full flex items-center justify-center gap-2" disabled={!canMechanicResolve || updatingId === id} onClick={() => update(row, 'Resolved')}>
                      <CheckCircle2 size={16} /> {row.status === 'Resolved' ? 'Resolved' : updatingId === id ? 'Saving...' : 'Resolved'}
                    </button>
                  </div>
                  {row.entity === 'CHECKLIST_REPORT' && row.machineBlocked && <p className="text-[11px] text-zinc-500 mt-2">Marking resolved returns the machine to active service after repair and inspection.</p>}
                </div>
              ) : readOnly ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">Read-only view. Report status: <span className="font-bold text-zinc-200">{row.status}</span></div>
              ) : row.entity === 'FUEL' ? (
                <div className="mt-3 rounded-2xl border border-blue-500/25 bg-blue-500/10 p-3 text-xs text-blue-100">
                  <p className="font-black">Automatically routed to Demo Fuel Attendant</p>
                  <p className="mt-1 text-blue-100/70">Fuel tasks are reserved for Z9000021. Admin and supervisors receive notifications and can monitor progress, but cannot assign the request to another employee or resolve it manually.</p>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <select className="input" value={row.status} onChange={(e) => update(row, e.target.value)} disabled={updatingId === id}>
                    {['Open','In Progress','Acknowledged','Resolved','Closed'].map((status)=><option key={status}>{status}</option>)}
                  </select>
                </div>
              )}

              {!readOnly && row.entity === 'CHECKLIST_REPORT' && row.machineBlocked && <p className="text-[11px] text-zinc-500 mt-2">Selecting Resolved returns the machine to active service. Only do this after repairs and inspection.</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
