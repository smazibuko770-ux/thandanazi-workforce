import { useEffect, useState } from 'react';
import { AlertTriangle, BriefcaseBusiness, Clock, Fuel, MapPin, Wrench } from 'lucide-react';
import { Header } from '../shared/components/Header';
import { ShiftRecord } from '../shared/types/domain';
import { getGps } from '../shared/hooks/useGps';
import { enqueue } from '../shared/offline/db';
import { api, isNetworkFailure } from '../shared/api/client';
import { safeUuid } from '../shared/utils/id';
import { nowIso } from '../shared/utils/appTime';
import { classifyShift } from '../shared/utils/nightShift';

type Screen = 'ops' | 'clockout';
function fmt(ms: number) { const s = Math.max(0, Math.floor(ms/1000)); const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60); const ss = s%60; return [h,m,ss].map(n=>String(n).padStart(2,'0')).join(':'); }
export function ActiveShift({ shift, go }: { shift: ShiftRecord; go: (s: Screen) => void }) {
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [confirmSos, setConfirmSos] = useState(false);
  const liveShiftClassification = classifyShift(shift.clockInTime, new Date(now).toISOString());
  const isNightShift = shift.shiftType === 'NIGHT' || shift.nightShift || liveShiftClassification.nightShift;
  const nightHoursSoFar = shift.nightHours ?? liveShiftClassification.nightHours;
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  async function sos() {
    setConfirmSos(false);
    setBusy(true);
    setNotice({ type: 'info', text: 'Sending emergency alert...' });
    try {
      const gps = await getGps();
      const payload = { type: 'Other', severity: 'Critical', notes: 'SOS triggered from active shift screen', employeeNumber: shift.employeeNumber, gps, timestamp: nowIso(), machineId: shift.machineId, idempotencyKey: safeUuid() };
      if (!navigator.onLine) {
        await enqueue({ type: 'EMERGENCY', endpoint: '/ops/emergency', method: 'POST', payload });
        setNotice({ type: 'success', text: 'Emergency queued. It will be sent when the device is online.' });
        return;
      }
      await api('/ops/emergency',{method:'POST',body:JSON.stringify(payload)});
      navigator.vibrate?.([500,200,500]);
      setNotice({ type: 'success', text: 'Emergency alert sent to supervisor/admin.' });
    } catch(e:any) {
      if (isNetworkFailure(e)) {
        const gps = await getGps();
        const payload = { type: 'Other', severity: 'Critical', notes: 'SOS triggered from active shift screen', employeeNumber: shift.employeeNumber, gps, timestamp: nowIso(), machineId: shift.machineId, idempotencyKey: safeUuid() };
        await enqueue({ type: 'EMERGENCY', endpoint: '/ops/emergency', method: 'POST', payload });
        setNotice({ type: 'success', text: 'SOS saved locally because the network/server failed. It will sync when connection returns.' });
      } else {
        setNotice({ type: 'error', text: e.message || 'Emergency alert failed.' });
      }
    } finally {
      setBusy(false);
    }
  }
  return <>
    <Header title="Active Shift" subtitle="Live shift tracking is running until clock-out is completed." showUser />
    {notice && <div className={`card mb-4 ${notice.type === 'error' ? 'border-red-500/40 text-red-200' : notice.type === 'success' ? 'border-green-500/40 text-green-200' : 'border-orange-500/40 text-orange-200'}`}>{notice.text}</div>}
    {confirmSos && <div className="card mb-4 border-red-500/50 bg-red-500/10"><h3 className="font-black text-red-200">Confirm SOS emergency</h3><p className="text-sm text-zinc-300 mt-2">This will alert supervisors/admins and attach your current GPS location where the device allows it.</p><div className="grid grid-cols-2 gap-3 mt-4"><button className="btn bg-white/5 border border-white/10" onClick={() => setConfirmSos(false)}>Cancel</button><button className="btn bg-red-600" disabled={busy} onClick={sos}>{busy ? 'Sending...' : 'Send SOS'}</button></div></div>}
    <div className="card-glow text-center">
      <p className="section-title">Live shift timer</p>
      <div className="text-6xl font-black tabular-nums my-4 text-orange-500 tracking-tight">{fmt(now - new Date(shift.clockInTime).getTime())}</div>
      <p className="text-sm text-zinc-400">Shift in progress</p>
      {isNightShift && <div className="mt-4 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-black text-blue-200">Night Shift • Timesheet marked</div>}
    </div>
    <div className="card mt-4 space-y-3 text-sm">
      <div className="flex items-center gap-3"><MapPin className="text-orange-500" size={18}/><span className="text-zinc-400 w-20">Site</span><strong>{shift.siteId}</strong></div>
      <div className="flex items-center gap-3"><BriefcaseBusiness className="text-orange-500" size={18}/><span className="text-zinc-400 w-20">Machine</span><strong>{shift.machineId}</strong></div>
      <div className="flex items-center gap-3"><Clock className="text-orange-500" size={18}/><span className="text-zinc-400 w-20">Clock in</span><strong>{new Date(shift.clockInTime).toLocaleString()}</strong></div>
      <div className="flex items-center gap-3"><Clock className="text-blue-400" size={18}/><span className="text-zinc-400 w-20">Shift</span><strong>{isNightShift ? `Night Shift${nightHoursSoFar ? ` • ${nightHoursSoFar.toFixed(2)} night hrs so far` : ''}` : 'Day Shift'}</strong></div>
      <div className="flex items-center gap-3"><MapPin className="text-green-400" size={18}/><span className="text-zinc-400 w-20">GPS</span><strong>{shift.gpsStart.lat.toFixed(5)}, {shift.gpsStart.lng.toFixed(5)}</strong></div>
    </div>
    <p className="section-title mt-5 mb-2">In-shift actions</p>
    <div className="grid grid-cols-2 gap-3">
      <button className="card text-left" onClick={() => go('ops')}><BriefcaseBusiness className="text-orange-500 mb-3"/><p className="font-bold">Operations</p></button>
      <button className="card text-left" onClick={() => go('ops')}><Wrench className="text-yellow-500 mb-3"/><p className="font-bold">Breakdown</p></button>
      <button className="card text-left" onClick={() => go('ops')}><Fuel className="text-blue-400 mb-3"/><p className="font-bold">Fuel Request</p></button>
      <button className="card text-left border-red-500/30 disabled:opacity-50" disabled={busy} onClick={() => { setNotice(null); setConfirmSos(true); }}><AlertTriangle className="text-red-500 mb-3"/><p className="font-bold">{busy ? 'Sending SOS...' : 'SOS Emergency'}</p></button>
    </div>
    <button className="btn bg-red-600 w-full mt-5 text-base" onClick={() => go('clockout')}>Clock Out</button>
  </>;
}
