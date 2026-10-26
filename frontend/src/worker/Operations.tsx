import { useMemo, useState } from 'react';
import { AlertTriangle, Camera, Fuel as FuelIcon, MapPin, Wrench } from 'lucide-react';
import { Header } from '../shared/components/Header';
import { PhotoInput } from '../shared/components/PhotoInput';
import { ShiftRecord } from '../shared/types/domain';
import { getGps, isGpsUnavailable } from '../shared/hooks/useGps';
import { enqueue } from '../shared/offline/db';
import { api, isNetworkFailure } from '../shared/api/client';
import { uploadImage } from '../shared/api/uploads';
import { MACHINES } from '../shared/data/companyData';
import { safeUuid } from '../shared/utils/id';
import { nowIso } from '../shared/utils/appTime';

type Tab = 'fuel' | 'breakdown' | 'emergency';
type EmergencyType = 'Injury' | 'Fire' | 'Gas' | 'Collapse' | 'Other';
type EmergencySeverity = 'Low' | 'Medium' | 'High' | 'Critical';
const emergencyTypes: EmergencyType[] = ['Injury', 'Fire', 'Gas', 'Collapse', 'Other'];
const severities: EmergencySeverity[] = ['Low', 'Medium', 'High', 'Critical'];

function machineLabel(machineId: string) {
  const machine = MACHINES.find((item) => item.machineId === machineId);
  return machine ? [machine.machineId, machine.machineType, machine.regNo].filter(Boolean).join(' - ') : machineId;
}

export function Operations({ activeShift, onBack }: { activeShift: ShiftRecord | null; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('fuel');
  const [fuel, setFuel] = useState(50);
  const [machineId, setMachineId] = useState(activeShift?.machineId || MACHINES[0]?.machineId || '');
  const [machineSearch, setMachineSearch] = useState('');
  const [desc, setDesc] = useState('');
  const [severity, setSeverity] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [photos, setPhotos] = useState<File[]>([]);
  const [emergencyType, setEmergencyType] = useState<EmergencyType>('Injury');
  const [emergencySeverity, setEmergencySeverity] = useState<EmergencySeverity>('Critical');
  const [emergencyNotes, setEmergencyNotes] = useState('');
  const [busy, setBusy] = useState<Tab | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const machineOptions = useMemo(() => {
    const search = machineSearch.trim().toLowerCase();
    const sorted = [...MACHINES].sort((a, b) => a.machineId.localeCompare(b.machineId, undefined, { numeric: true }));
    if (!search) return sorted;
    return sorted.filter((machine) => machineLabel(machine.machineId).toLowerCase().includes(search));
  }, [machineSearch]);

  async function submit(endpoint: string, type: 'FUEL' | 'BREAKDOWN' | 'EMERGENCY', payload: Record<string, unknown>, successText: string) {
    if (!machineId) {
      setNotice({ type: 'error', text: 'Select the machine first.' });
      return null;
    }

    setBusy(tab);
    setNotice({ type: 'info', text: 'Sending. Please wait...' });
    try {
      const gps = await getGps();
      const body = { ...payload, gps, timestamp: nowIso(), machineId, idempotencyKey: safeUuid() };

      if (!navigator.onLine) {
        await enqueue({ type, endpoint, method: 'POST', payload: body });
        setNotice({ type: 'success', text: `${successText} Saved offline and will sync when online.` });
        return body;
      }

      const saved = await api<any>(endpoint, { method: 'POST', body: JSON.stringify(body) });
      setNotice({ type: 'success', text: isGpsUnavailable(gps) ? `${successText} GPS was unavailable on this device.` : successText });
      return saved;
    } catch (error: any) {
      if (isNetworkFailure(error)) {
        const gps = await getGps();
        const body = { ...payload, gps, timestamp: nowIso(), machineId, idempotencyKey: safeUuid() };
        await enqueue({ type, endpoint, method: 'POST', payload: body });
        setNotice({ type: 'success', text: `${successText} Server/network was unavailable, so it was saved locally and will sync later.` });
        return body;
      }
      setNotice({ type: 'error', text: error.message || 'Submission failed. Please try again.' });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function requestFuel() {
    const saved = await submit('/ops/fuel', 'FUEL', { fuelLevel: fuel }, `Fuel request sent for ${machineLabel(machineId)}.`);
    if (saved) setFuel(50);
  }

  async function submitBreakdown() {
    if (!desc.trim() || photos.length < 1) {
      setNotice({ type: 'error', text: 'Description and at least one photo are required.' });
      return;
    }
    if (desc.trim().length < 10) {
      setNotice({ type: 'error', text: 'Breakdown description must be at least 10 characters.' });
      return;
    }

    setBusy('breakdown');
    setNotice({ type: 'info', text: 'Uploading breakdown photos...' });
    try {
      const gps = await getGps();
      const payload = { description: desc.trim(), severity, photos: [], gps, timestamp: nowIso(), machineId, idempotencyKey: safeUuid() };

      if (!navigator.onLine) {
        await enqueue({ type: 'BREAKDOWN', endpoint: '/ops/breakdown', method: 'POST', payload, attachments: photos.map((photo) => ({ field: 'photos', category: 'breakdown' as const, file: photo, fileName: photo.name, contentType: photo.type, array: true })) });
        setNotice({ type: 'success', text: 'Breakdown report saved offline and will sync when online.' });
        setDesc('');
        setPhotos([]);
        return;
      }

      try {
        const keys = await Promise.all(photos.map((photo) => uploadImage(photo, 'breakdown')));
        await api('/ops/breakdown', { method: 'POST', body: JSON.stringify({ ...payload, photos: keys }) });
        setNotice({ type: 'success', text: isGpsUnavailable(gps) ? 'Breakdown report sent. GPS was unavailable on this device.' : 'Breakdown report sent to supervisor/admin.' });
      } catch (sendError: any) {
        if (isNetworkFailure(sendError)) {
          await enqueue({ type: 'BREAKDOWN', endpoint: '/ops/breakdown', method: 'POST', payload, attachments: photos.map((photo) => ({ field: 'photos', category: 'breakdown' as const, file: photo, fileName: photo.name, contentType: photo.type, array: true })) });
          setNotice({ type: 'success', text: 'Breakdown report saved locally because upload/server connection failed. It will sync later.' });
        } else {
          throw sendError;
        }
      }
      setDesc('');
      setPhotos([]);
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Breakdown submission failed.' });
    } finally {
      setBusy(null);
    }
  }

  async function sendEmergency() {
    if (!emergencyNotes.trim()) {
      setNotice({ type: 'error', text: 'Write what emergency you are reporting before sending.' });
      return;
    }
    if (emergencyNotes.trim().length < 10) {
      setNotice({ type: 'error', text: 'Emergency notes must be at least 10 characters.' });
      return;
    }
    const saved = await submit('/ops/emergency', 'EMERGENCY', { type: emergencyType, severity: emergencySeverity, notes: emergencyNotes.trim() }, `Emergency alert sent for ${machineLabel(machineId)}.`);
    if (saved) setEmergencyNotes('');
  }

  return <>
    <Header title="Operations" subtitle="Fuel requests, breakdown reports and emergency alerts." />
    <div className="grid grid-cols-3 gap-2 mb-4">{(['fuel', 'breakdown', 'emergency'] as Tab[]).map((item) => <button key={item} className={`btn capitalize ${tab === item ? 'bg-orange-500 text-black' : 'bg-white/5 border border-white/10'}`} onClick={() => { setTab(item); setNotice(null); }}>{item}</button>)}</div>

    {notice && <div className={`card mb-4 ${notice.type === 'error' ? 'border-red-500/40 text-red-200' : notice.type === 'success' ? 'border-green-500/40 text-green-200' : 'border-orange-500/40 text-orange-200'}`}>{notice.text}</div>}

    <div className="card mb-4">
      <label className="text-xs text-zinc-400 font-bold">Search machine</label>
      <input className="input mt-2 mb-3" value={machineSearch} onChange={(event) => setMachineSearch(event.target.value)} placeholder="Search THA number, type or registration" />
      <label className="text-xs text-zinc-400 font-bold">Machine</label>
      <select className="input mt-2" value={machineId} onChange={(event) => setMachineId(event.target.value)}>
        <option value="">Select machine...</option>
        {machineOptions.map((machine) => <option key={machine.machineId} value={machine.machineId}>{machineLabel(machine.machineId)}</option>)}
      </select>
      {machineId && <p className="text-xs text-zinc-500 mt-3">Selected: {machineLabel(machineId)}</p>}
    </div>

    {tab === 'fuel' && <div className="card-glow">
      <div className="flex items-center gap-3 mb-4"><div className="h-12 w-12 rounded-2xl bg-orange-500/15 grid place-items-center text-orange-500"><FuelIcon /></div><div><h2 className="font-black text-xl">Fuel Request</h2><p className="text-sm text-zinc-400">Indicate current fuel level.</p></div></div>
      <div className="card"><div className="flex justify-between mb-2"><span className="text-sm text-zinc-400">Fuel level</span><strong className={fuel > 50 ? 'text-green-400' : fuel >= 20 ? 'text-yellow-400' : 'text-red-400'}>{fuel}%</strong></div><input type="range" min="0" max="100" value={fuel} onChange={(event) => setFuel(Number(event.target.value))} className="w-full accent-orange-500" /><div className="flex justify-between text-[10px] text-zinc-600 mt-1"><span>E</span><span>F</span></div>{fuel < 20 && <p className="text-red-400 text-sm mt-2">⚠ Low fuel. Please request fuel.</p>}</div>
      <div className="card mt-3 flex items-center gap-3"><MapPin className="text-green-400" /><span className="text-sm text-zinc-300">GPS and timestamp are captured on submit where device permission allows it.</span></div>
      <button className="btn bg-orange-500 text-black w-full mt-4" disabled={busy !== null || !machineId} onClick={requestFuel}>{busy === 'fuel' ? 'Sending fuel request...' : 'Request Fuel'}</button>
    </div>}

    {tab === 'breakdown' && <div className="card-glow">
      <div className="flex items-center gap-3 mb-4"><div className="h-12 w-12 rounded-2xl bg-yellow-500/15 grid place-items-center text-yellow-400"><Wrench /></div><div><h2 className="font-black text-xl">Breakdown Report</h2><p className="text-sm text-zinc-400">Attach photos and describe the fault.</p></div></div>
      <label className="text-xs text-zinc-400 font-bold">Severity</label><select className="input mt-2 mb-3" value={severity} onChange={(event) => setSeverity(event.target.value as any)}><option>Low</option><option>Medium</option><option>High</option></select>
      <label className="text-xs text-zinc-400 font-bold">Description</label><textarea className="input min-h-32 mt-2 mb-3" placeholder="Describe the breakdown in detail..." value={desc} onChange={(event) => setDesc(event.target.value)} />
      <div className="card mb-3"><div className="flex items-center gap-2 mb-3"><Camera className="text-orange-500" /><p className="font-bold">Attach breakdown photos</p></div><PhotoInput label="Add photo" onFile={(file) => setPhotos((current) => [...current, file])} />{photos.length > 0 && <p className="text-sm text-green-400 mt-2">✓ {photos.length} photo(s) attached</p>}</div>
      <button className="btn bg-yellow-500 text-black w-full" disabled={busy !== null || !machineId} onClick={submitBreakdown}>{busy === 'breakdown' ? 'Sending breakdown report...' : 'Submit Breakdown Report'}</button>
    </div>}

    {tab === 'emergency' && <div className="card-glow border-red-500/25">
      <div className="flex items-center gap-3 mb-4"><div className="h-12 w-12 rounded-2xl bg-red-500/15 grid place-items-center text-red-500"><AlertTriangle /></div><div><h2 className="font-black text-xl text-red-300">Emergency Report</h2><p className="text-sm text-zinc-400">Send a GPS-linked alert to supervisors.</p></div></div>
      <p className="section-title mb-2">Emergency type</p><div className="grid grid-cols-3 gap-2 mb-4">{emergencyTypes.map((type) => <button key={type} className={`btn text-sm ${emergencyType === type ? 'bg-red-600' : 'bg-white/5 border border-white/10'}`} onClick={() => setEmergencyType(type)}>{type}</button>)}</div>
      <p className="section-title mb-2">Seriousness level</p><div className="grid grid-cols-4 gap-2 mb-4">{severities.map((item) => <button key={item} className={`rounded-2xl py-2 text-xs font-bold border ${emergencySeverity === item ? 'border-red-500 bg-red-500/15 text-red-300' : 'border-white/10 text-zinc-400'}`} onClick={() => setEmergencySeverity(item)}>{item}</button>)}</div>
      <label className="text-xs text-zinc-400 font-bold">What emergency are you reporting?</label><textarea className="input min-h-36 mt-2 mb-3" placeholder="Example: operator injured while disembarking from machine. Assistance required." value={emergencyNotes} onChange={(event) => setEmergencyNotes(event.target.value)} />
      <div className="card flex items-center gap-3 mb-4"><MapPin className="text-green-400" /><span className="text-sm text-zinc-300">GPS will be attached automatically where device permission allows it.</span></div>
      <button className="btn bg-red-600 w-full" disabled={busy !== null || !machineId} onClick={sendEmergency}>{busy === 'emergency' ? 'Sending emergency alert...' : 'Send Emergency Alert'}</button>
      <p className="text-xs text-zinc-500 mt-3">If offline, the alert is queued and sent when the connection returns. Offline cannot send live alerts.</p>
    </div>}
    <button className="btn bg-white/5 border border-white/10 w-full mt-4" disabled={busy !== null} onClick={onBack}>Back</button>
  </>;
}
