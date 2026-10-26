import { useEffect, useMemo, useState } from 'react';
import { AlertOctagon, Camera, CheckCircle2, ChevronRight, HardHat, MapPin, Send } from 'lucide-react';
import { Header } from '../shared/components/Header';
import { PhotoInput } from '../shared/components/PhotoInput';
import { ChecklistDecision, Machine, ShiftRecord, Site } from '../shared/types/domain';
import { getGps, isGpsUnavailable } from '../shared/hooks/useGps';
import { enqueue } from '../shared/offline/db';
import { api, isNetworkFailure } from '../shared/api/client';
import { uploadImage } from '../shared/api/uploads';
import { useAuth } from '../shared/auth/AuthProvider';
import { SITES, MACHINES, checklistForMachineType, machineOptionsForSite } from '../shared/data/companyData';
import { getClockInWeatherWarning, WeatherClockInWarning } from '../shared/weather/openMeteo';
import { safeUuid } from '../shared/utils/id';
import { nowIso } from '../shared/utils/appTime';
import { classifyShift } from '../shared/utils/nightShift';

const steps = ['Site', 'Machine', 'Checklist', 'Clock In'];

function uniqueMachines(list: Machine[]) {
  const map = new Map<string, Machine>();
  list.forEach((machine) => {
    if (!machine.machineId) return;
    map.set(machine.machineId, {
      ...machine,
      machineId: machine.machineId.toUpperCase(),
      machineType: (machine.machineType || 'GENERAL').toUpperCase(),
      status: machine.status || 'ACTIVE',
      label: machine.label || [machine.machineId, machine.machineType, machine.regNo].filter(Boolean).join(' - ')
    });
  });
  return [...map.values()].sort((a, b) => a.machineId.localeCompare(b.machineId, undefined, { numeric: true }));
}

function machineLabel(machine?: Machine) {
  if (!machine) return 'No machine selected';
  return [machine.machineId, machine.machineType, machine.regNo].filter(Boolean).join(' - ');
}

export function ClockInFlow({ onCancel, onStarted }: { onCancel: () => void; onStarted: (shift: ShiftRecord) => void }) {
  const { user } = useAuth();
  const fallbackSites = SITES.filter((s) => s.siteId !== 'ALL' && s.siteId !== 'SUPERVISOR');
  const [sites, setSites] = useState<Site[]>(fallbackSites);
  const [machines, setMachines] = useState<Machine[]>(uniqueMachines(MACHINES));
  const [step, setStep] = useState(0);
  const [siteId, setSiteId] = useState(fallbackSites[0]?.siteId || 'DEMO-SITE-A');
  const [machineId, setMachineId] = useState('');
  const [machineSearch, setMachineSearch] = useState('');
  const [machineLoadNotice, setMachineLoadNotice] = useState('');

  useEffect(() => {
    if (!navigator.onLine) return;
    api<{ items: Site[] }>('/sites')
      .then((response) => {
        const liveSites = response.items.filter((site) => site.siteId !== 'ALL' && site.siteId !== 'SUPERVISOR' && site.status !== 'INACTIVE');
        if (liveSites.length) {
          setSites(liveSites);
          setSiteId((current) => liveSites.some((site) => site.siteId === current) ? current : liveSites[0].siteId);
        }
      })
      .catch(() => setSites(fallbackSites));
  }, []);

  useEffect(() => {
    const fallback = uniqueMachines([...machineOptionsForSite(siteId), ...MACHINES]);
    setMachineLoadNotice('Loading machines...');

    const applyMachines = (list: Machine[], notice = '') => {
      const active = uniqueMachines(list).filter((machine) => machine.status !== 'OUT_OF_SERVICE' && machine.status !== 'INACTIVE');
      const finalList = active.length ? active : fallback;
      setMachines(finalList);
      setMachineId((current) => finalList.some((machine) => machine.machineId === current) ? current : '');
      setMachineLoadNotice(notice);
    };

    if (!navigator.onLine) {
      applyMachines(fallback, 'Offline mode: showing saved fleet list.');
      return;
    }

    api<{ items: Machine[] }>(`/sites/${siteId}/machines`)
      .then((response) => {
        const live = response.items || [];
        applyMachines(live.length ? [...live, ...fallback] : fallback, live.length ? '' : 'No live site allocation found. Showing full fleet list.');
      })
      .catch(() => applyMachines(fallback, 'Could not load live machines. Showing full fleet list.'));
  }, [siteId]);

  const filteredMachines = useMemo(() => {
    const search = machineSearch.trim().toLowerCase();
    if (!search) return machines;
    return machines.filter((machine) => machineLabel(machine).toLowerCase().includes(search));
  }, [machines, machineSearch]);

  const selectedMachine = useMemo(() => machines.find((machine) => machine.machineId === machineId) || MACHINES.find((machine) => machine.machineId === machineId), [machineId, machines]);
  const checklist = useMemo(() => checklistForMachineType(selectedMachine?.machineType), [selectedMachine?.machineType]);
  const [decisions, setDecisions] = useState<Record<string, ChecklistDecision>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [checklistReportId, setChecklistReportId] = useState<string | undefined>();
  const [photo, setPhoto] = useState<File | null>(null);
  const [startMeterReading, setStartMeterReading] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [weatherWarning, setWeatherWarning] = useState<WeatherClockInWarning | null>(null);

  const answeredCount = checklist.filter((item) => !!decisions[item.id]).length;
  const noGoItems = checklist.filter((item) => decisions[item.id] === 'NO_GO');
  const criticalNoGo = noGoItems.filter((item) => item.defectClass === 'A');
  const allAnswered = checklist.every((item) => !item.required || !!decisions[item.id]);
  const allNoGoHaveRemarks = noGoItems.every((item) => (remarks[item.id] || '').trim().length >= 5);

  function resetChecklistForMachine(nextMachineId: string) {
    setMachineId(nextMachineId);
    setDecisions({});
    setRemarks({});
    setReportSubmitted(false);
    setChecklistReportId(undefined);
    setWeatherWarning(null);
    setNotice(null);
  }

  function setDecision(id: string, decision: ChecklistDecision) {
    setDecisions((current) => ({ ...current, [id]: decision }));
    setReportSubmitted(false);
    setChecklistReportId(undefined);
    setWeatherWarning(null);
    setNotice(null);
  }

  async function submitDefectReport(): Promise<boolean> {
    if (!noGoItems.length) return true;
    if (!allNoGoHaveRemarks) {
      setNotice({ type: 'error', text: 'Add a short remark for every NO GO item.' });
      return false;
    }

    setBusy(true);
    setNotice({ type: 'info', text: 'Saving checklist defect report...' });
    const gps = await getGps();
    const newReportId = checklistReportId || `CHECK-${safeUuid()}`;
    const payload = {
      reportId: newReportId,
      siteId,
      machineId,
      gps,
      timestamp: nowIso(),
      items: noGoItems.map((item) => ({ id: item.id, label: item.label, decision: 'NO_GO', defectClass: item.defectClass, remarks: remarks[item.id] })),
      idempotencyKey: safeUuid()
    };

    try {
      if (!navigator.onLine) {
        await enqueue({ type: 'CHECKLIST_REPORT', endpoint: '/checklists/report', method: 'POST', payload });
        setReportSubmitted(true);
        setChecklistReportId(newReportId);
        setNotice({ type: 'success', text: 'Defect report saved on this device. It will sync when online.' });
        return true;
      }

      const saved = await api<any>('/checklists/report', { method: 'POST', body: JSON.stringify(payload) });
      setReportSubmitted(true);
      setChecklistReportId(saved.reportId || newReportId);
      setNotice({ type: 'success', text: 'Checklist defect report sent to supervisor/admin.' });
      return true;
    } catch (error: any) {
      if (isNetworkFailure(error)) {
        await enqueue({ type: 'CHECKLIST_REPORT', endpoint: '/checklists/report', method: 'POST', payload });
        setReportSubmitted(true);
        setChecklistReportId(newReportId);
        setNotice({ type: 'success', text: 'Defect report saved locally because the server was unreachable. It will sync later.' });
        return true;
      }
      setNotice({ type: 'error', text: error.message || 'Could not submit defect report.' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function continueFromChecklist() {
    if (!allAnswered) return setNotice({ type: 'error', text: 'Choose GO or NO GO for every required checklist item.' });
    if (noGoItems.length && !reportSubmitted) {
      const sent = await submitDefectReport();
      if (!sent) return;
    }
    if (criticalNoGo.length) return setNotice({ type: 'error', text: 'This machine has a Class A NO GO defect and may not be operated. The report has been sent and the machine is blocked.' });
    if (!startMeterReading.trim()) return setNotice({ type: 'error', text: 'Enter the opening meter/hour reading before taking the photo.' });
    if (!photo) return setNotice({ type: 'error', text: 'Start-hour meter photo is required before clock-in.' });
    setNotice(null);
    setStep(3);
  }

  async function queueClockIn(payload: ShiftRecord, photoFile: File, message: string, startMeterPhoto = `PHOTO_PENDING-${safeUuid()}`) {
    const queuedPayload = { ...payload, status: 'PENDING_SYNC' as const, synced: false, startMeterPhoto, idempotencyKey: safeUuid() };
    await enqueue({
      type: 'CLOCK_IN',
      endpoint: '/shifts/clock-in',
      method: 'POST',
      payload: queuedPayload,
      attachments: [{ field: 'startMeterPhoto', category: 'meter-start', file: photoFile, fileName: photoFile.name, contentType: photoFile.type }]
    });
    setNotice({ type: 'success', text: message });
    onStarted({ ...payload, status: 'PENDING_SYNC', startMeterPhoto, synced: false });
  }

  async function submit(skipWeatherWarning = false) {
    if (!selectedMachine || !machineId) return setNotice({ type: 'error', text: 'Select a machine before clocking in.' });
    if (!allAnswered) return setNotice({ type: 'error', text: 'Choose GO or NO GO for every required checklist item.' });
    if (criticalNoGo.length) return setNotice({ type: 'error', text: 'This machine has a Class A NO GO defect and may not be operated. Choose another machine.' });
    if (!startMeterReading.trim()) return setNotice({ type: 'error', text: 'Enter the opening meter/hour reading before clock-in.' });
    if (!photo) return setNotice({ type: 'error', text: 'Start-hour meter photo is required before clock-in.' });

    setBusy(true);
    setNotice({ type: 'info', text: 'Clocking in. Please wait...' });
    try {
      if (noGoItems.length && !reportSubmitted) {
        const sent = await submitDefectReport();
        if (!sent) return;
        setBusy(true);
        setNotice({ type: 'info', text: 'Clocking in. Please wait...' });
      }

      setNotice({ type: 'info', text: 'Checking GPS and weather before clock-in...' });
      const gps = await getGps();
      if (!skipWeatherWarning) {
        const weather = await getClockInWeatherWarning(gps);
        if (weather.level !== 'none') {
          setWeatherWarning(weather);
          setNotice({ type: 'info', text: weather.message });
          return;
        }
        setNotice({ type: 'info', text: 'Weather checked. Clocking in. Please wait...' });
      }

      const clockInTime = nowIso();
      const shiftClassification = classifyShift(clockInTime);
      const checklistPayload = checklist.map((item) => ({ ...item, decision: decisions[item.id], remarks: remarks[item.id], reportSubmitted: noGoItems.some((noGo) => noGo.id === item.id) ? reportSubmitted : undefined }));
      const payload: ShiftRecord = {
        shiftId: `SHIFT-${safeUuid()}`,
        employeeNumber: user!.employeeNumber,
        fullName: user!.fullName,
        siteId,
        machineId,
        status: 'PENDING_SYNC',
        checklist: checklistPayload,
        checklistReportId,
        startMeterReading: Number(startMeterReading),
        startMeterPhoto: `PHOTO_PENDING-${safeUuid()}`,
        gpsStart: gps,
        clockInTime,
        shiftType: shiftClassification.shiftType,
        nightShift: shiftClassification.nightShift,
        nightHours: shiftClassification.nightHours,
        dayHours: shiftClassification.dayHours,
        payrollDate: shiftClassification.payrollDate,
        shiftWindowLabel: shiftClassification.shiftWindowLabel,
        synced: false
      };

      if (!navigator.onLine) {
        await queueClockIn(payload, photo, 'Clock-in saved offline. You are now clocked in on this device and it will sync when online.', payload.startMeterPhoto);
        return;
      }

      let key = '';
      try {
        key = await uploadImage(photo, 'meter-start');
      } catch (uploadError: any) {
        await queueClockIn(payload, photo, 'Clock-in saved locally because the meter photo upload was blocked. You are now clocked in and the photo will sync later.', payload.startMeterPhoto);
        return;
      }

      try {
        const saved = await api<ShiftRecord>('/shifts/clock-in', { method: 'POST', body: JSON.stringify({ ...payload, status: 'ACTIVE', synced: true, startMeterPhoto: key, idempotencyKey: safeUuid() }) });
        setNotice({ type: 'success', text: isGpsUnavailable(gps) ? 'Clock-in completed. Note: GPS was unavailable on this device.' : 'Clock-in completed successfully.' });
        onStarted({ ...payload, ...saved, shiftId: saved.shiftId || payload.shiftId, startMeterPhoto: saved.startMeterPhoto || key, status: 'ACTIVE', synced: true });
      } catch (apiError: any) {
        if (isNetworkFailure(apiError)) {
          await enqueue({ type: 'CLOCK_IN', endpoint: '/shifts/clock-in', method: 'POST', payload: { ...payload, startMeterPhoto: key, idempotencyKey: safeUuid() } });
          setNotice({ type: 'success', text: 'Clock-in saved locally because the server could not be reached. You are now clocked in on this device and it will sync later.' });
          onStarted({ ...payload, status: 'PENDING_SYNC', startMeterPhoto: key, synced: false });
          return;
        }
        throw apiError;
      }
    } catch (error: any) {
      if (isNetworkFailure(error) && photo) {
        const gps = await getGps();
        const fallbackClockInTime = nowIso();
        const shiftClassification = classifyShift(fallbackClockInTime);
        const payload: ShiftRecord = {
          shiftId: `SHIFT-${safeUuid()}`,
          employeeNumber: user!.employeeNumber,
          fullName: user!.fullName,
          siteId,
          machineId,
          status: 'PENDING_SYNC',
          checklist: checklist.map((item) => ({ ...item, decision: decisions[item.id], remarks: remarks[item.id] })),
          checklistReportId,
          startMeterReading: Number(startMeterReading),
          startMeterPhoto: `PHOTO_PENDING-${safeUuid()}`,
          gpsStart: gps,
          clockInTime: fallbackClockInTime,
          shiftType: shiftClassification.shiftType,
          nightShift: shiftClassification.nightShift,
          nightHours: shiftClassification.nightHours,
          dayHours: shiftClassification.dayHours,
          payrollDate: shiftClassification.payrollDate,
          shiftWindowLabel: shiftClassification.shiftWindowLabel,
          synced: false
        };
        await queueClockIn(payload, photo, 'Clock-in saved locally after a network failure. You are now clocked in on this device and it will sync later.', payload.startMeterPhoto);
        return;
      }
      setNotice({ type: 'error', text: error.message || 'Clock-in failed. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Header title="Clock In" subtitle="Select the site and machine, complete every GO / NO GO inspection, then capture the meter photo." />
    <div className="card mb-4"><div className="grid grid-cols-4 gap-2">{steps.map((label, index) => <div key={label} className="text-center"><div className={`mx-auto h-9 w-9 rounded-full grid place-items-center border ${index <= step ? 'bg-orange-500 border-orange-500 text-black' : 'border-zinc-700 text-zinc-500'}`}>{index + 1}</div><p className={`mt-1 text-[10px] ${index <= step ? 'text-white' : 'text-zinc-500'}`}>{label}</p></div>)}</div></div>
    {notice && <div className={`card mb-4 ${notice.type === 'error' ? 'border-red-500/40 text-red-200' : notice.type === 'success' ? 'border-green-500/40 text-green-200' : 'border-orange-500/40 text-orange-200'}`}>{notice.text}</div>}

    {weatherWarning && <div className="card mb-4 border-yellow-500/50 bg-yellow-500/10"><div className="flex gap-3 items-start"><AlertOctagon className={weatherWarning.level === 'danger' ? 'text-red-400' : 'text-yellow-400'} /><div><h3 className="font-black">{weatherWarning.title}</h3><p className="text-sm text-zinc-200 mt-1">{weatherWarning.message}</p><ul className="text-xs text-zinc-400 mt-3 space-y-1">{weatherWarning.details.map((detail) => <li key={detail}>• {detail}</li>)}</ul><p className="text-[11px] text-zinc-500 mt-2">Source: {weatherWarning.source}</p></div></div><div className="grid grid-cols-2 gap-3 mt-4"><button className="btn bg-white/5 border border-white/10" onClick={() => { setWeatherWarning(null); setNotice({ type: 'info', text: 'Clock-in cancelled because of weather warning.' }); }}>Cancel</button><button className="btn bg-orange-500 text-black" onClick={() => { setWeatherWarning(null); submit(true); }}>Continue clock-in</button></div></div>}

    {step === 0 && <section className="space-y-3"><p className="section-title">Select active site</p>{sites.map((site) => <button key={site.siteId} className={`card w-full flex items-center gap-3 text-left ${siteId === site.siteId ? 'border-orange-500/60' : ''}`} onClick={() => { setSiteId(site.siteId); setNotice(null); }}><MapPin className="text-orange-500" /><span className="font-bold">{site.name}</span>{siteId === site.siteId && <CheckCircle2 className="ml-auto text-green-400" />}</button>)}<button className="btn bg-orange-500 text-black w-full" onClick={() => setStep(1)}>Continue</button><button className="btn bg-white/5 border border-white/10 w-full" onClick={onCancel}>Cancel</button></section>}

    {step === 1 && <section className="space-y-3">
      <p className="section-title">Choose machine</p>
      <div className="card-glow">
        <div className="flex items-center gap-3 mb-4"><div className="h-12 w-12 rounded-2xl bg-orange-500/15 grid place-items-center text-orange-500"><HardHat /></div><div><h2 className="font-black text-xl">Machine selection</h2><p className="text-sm text-zinc-400">Use the dropdown like the breakdown report screen.</p></div></div>
        {machineLoadNotice && <p className="text-xs text-yellow-300 mb-3">{machineLoadNotice}</p>}
        <label className="text-xs text-zinc-400 font-bold">Search machine</label>
        <input className="input mt-2 mb-3" value={machineSearch} onChange={(event) => setMachineSearch(event.target.value)} placeholder="Search THA number, type or registration" />
        <label className="text-xs text-zinc-400 font-bold">Machine</label>
        <select className="input mt-2" value={machineId} onChange={(event) => resetChecklistForMachine(event.target.value)}>
          <option value="">Select machine...</option>
          {filteredMachines.map((machine) => <option key={machine.machineId} value={machine.machineId}>{machineLabel(machine)}</option>)}
        </select>
        {selectedMachine && <div className="kpi mt-4"><p className="text-zinc-500 text-sm">Selected machine</p><p className="font-black">{machineLabel(selectedMachine)}</p><p className="text-xs text-zinc-500 mt-1">Checklist: {selectedMachine.machineType || 'GENERAL'} • {checklist.length} items</p></div>}
      </div>
      <div className="grid grid-cols-2 gap-3"><button className="btn bg-white/5 border border-white/10" onClick={() => setStep(0)}>Back</button><button className="btn bg-orange-500 text-black" disabled={!machineId || !selectedMachine} onClick={() => { setNotice(null); setStep(2); }}>Continue</button></div>
    </section>}

    {step === 2 && <section><div className="card mb-4"><div className="flex justify-between items-start gap-3 mb-3"><div><p className="section-title">Machine inspection</p><h2 className="font-black">{selectedMachine?.machineType || 'General'} checklist</h2><p className="text-xs text-zinc-400">Class A NO GO defects block machine use. Class B/C defects are reported for maintenance.</p></div><span className="badge bg-orange-500/15 text-orange-400">{answeredCount}/{checklist.length}</span></div><div className="max-h-[500px] overflow-y-auto pr-1">{checklist.map((item) => <div key={item.id} className="py-3 border-b border-zinc-800 last:border-b-0"><div className="flex gap-3 items-center"><span className={`badge shrink-0 ${item.defectClass === 'A' ? 'bg-red-500/15 text-red-400' : item.defectClass === 'B' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-blue-500/15 text-blue-400'}`}>Class {item.defectClass}</span><span className="text-sm leading-snug flex-1">{item.label}</span><button className={`decision-btn ${decisions[item.id] === 'GO' ? 'bg-green-500 text-black border-green-500' : 'border-green-500/40 text-green-400'}`} onClick={() => setDecision(item.id, 'GO')}>GO</button><button className={`decision-btn ${decisions[item.id] === 'NO_GO' ? 'bg-red-500 text-white border-red-500' : 'border-red-500/40 text-red-400'}`} onClick={() => setDecision(item.id, 'NO_GO')}>NO GO</button></div>{decisions[item.id] === 'NO_GO' && <textarea className="input mt-3 min-h-20" value={remarks[item.id] || ''} onChange={(event) => { setRemarks({ ...remarks, [item.id]: event.target.value }); setReportSubmitted(false); setChecklistReportId(undefined); }} placeholder="Describe the defect or unsafe condition..." />}</div>)}</div></div>
      {noGoItems.length > 0 && <div className={`card mb-4 ${criticalNoGo.length ? 'border-red-500/40' : 'border-yellow-500/40'}`}><div className="flex gap-3"><AlertOctagon className={criticalNoGo.length ? 'text-red-400' : 'text-yellow-400'} /><div><h3 className="font-black">{criticalNoGo.length ? 'Machine use blocked' : 'Maintenance report required'}</h3><p className="text-xs text-zinc-400 mt-1">{criticalNoGo.length ? 'One or more Class A items are NO GO. The driver must not operate this machine.' : 'Class B/C defects automatically create a maintenance report for supervisor/admin attention but do not automatically block operation.'}</p></div></div><button className="btn bg-red-500 text-white w-full mt-4 flex items-center justify-center gap-2" disabled={busy || !allNoGoHaveRemarks} onClick={() => submitDefectReport()}><Send size={17} />{busy ? 'Sending...' : reportSubmitted ? 'Report sent' : 'Send defect report to admin'}</button></div>}
      <div className="card mb-4"><div className="flex justify-between"><div className="flex gap-2 items-center"><Camera className="text-orange-500" /><h2 className="font-black">Opening meter reading & photo</h2></div><span className="text-red-400 text-xs font-bold">MANDATORY</span></div><p className="text-xs text-zinc-400 my-3">First punch in the opening hour/meter reading, then take the meter photo before starting the shift.</p><label className="text-xs text-zinc-400 font-bold">Opening meter/hour reading</label><input className="input mt-2 mb-3" type="number" min="0" step="0.1" inputMode="decimal" value={startMeterReading} onChange={(event) => setStartMeterReading(event.target.value)} placeholder="Example: 12450.5" /><PhotoInput label="Take meter photo after entering reading" onFile={setPhoto} />{photo && <p className="text-green-400 text-sm mt-2">✓ Photo attached: {photo.name}</p>}</div><div className="grid grid-cols-2 gap-3"><button className="btn bg-white/5 border border-white/10" onClick={() => setStep(1)}>Back</button><button className="btn bg-orange-500 text-black" disabled={!allAnswered || !startMeterReading.trim() || !photo || (noGoItems.length > 0 && !allNoGoHaveRemarks) || busy} onClick={continueFromChecklist}>Continue</button></div></section>}

    {step === 3 && <section className="card-glow"><p className="section-title">Ready to clock in</p><h2 className="text-2xl font-black mt-1">Confirm shift start</h2><div className="grid gap-3 mt-5 text-sm"><div className="kpi"><p className="text-zinc-500">Worker</p><p className="font-bold">{user?.fullName} • {user?.employeeNumber}</p></div><div className="kpi"><p className="text-zinc-500">Site</p><p className="font-bold">{sites.find((site) => site.siteId === siteId)?.name || SITES.find((site) => site.siteId === siteId)?.name}</p></div><div className="kpi"><p className="text-zinc-500">Machine</p><p className="font-bold">{machineLabel(selectedMachine)}</p></div><div className="kpi"><p className="text-zinc-500">Inspection</p><p className="font-bold text-green-400">{noGoItems.length ? `${noGoItems.length} defect(s) reported` : 'All items GO'}</p></div></div><button className="btn bg-orange-500 text-black w-full mt-5 flex items-center justify-center gap-2" disabled={busy} onClick={() => submit(false)}>{busy ? 'Clocking in...' : 'Clock In'} <ChevronRight size={18} /></button><button className="btn bg-white/5 border border-white/10 w-full mt-3" disabled={busy} onClick={() => setStep(2)}>Back</button></section>}
  </>;
}
