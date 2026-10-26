import { useState } from 'react';
import { Lock, MapPin } from 'lucide-react';
import { Header } from '../shared/components/Header';
import { PhotoInput } from '../shared/components/PhotoInput';
import { ShiftRecord } from '../shared/types/domain';
import { getGps, isGpsUnavailable } from '../shared/hooks/useGps';
import { enqueue } from '../shared/offline/db';
import { api, isNetworkFailure } from '../shared/api/client';
import { uploadImage } from '../shared/api/uploads';
import { safeUuid } from '../shared/utils/id';
import { nowIso } from '../shared/utils/appTime';
import { classifyShift } from '../shared/utils/nightShift';

export function ClockOutFlow({ shift, onDone, onCancel }: { shift: ShiftRecord; onDone: (shift: ShiftRecord) => void; onCancel: () => void }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [closingMeterReading, setClosingMeterReading] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  async function queueClockOut(photoFile: File | null, completed: ShiftRecord, gpsEnd: any, clockOutTime: string, message: string, closingMeterPhoto = `PHOTO_PENDING-${safeUuid()}`) {
    await enqueue({
      type: 'CLOCK_OUT',
      endpoint: '/shifts/clock-out',
      method: 'POST',
      payload: {
        shiftId: shift.shiftId,
        closingMeterReading: Number(closingMeterReading),
        closingMeterPhoto,
        gpsEnd,
        clockOutTime,
        idempotencyKey: safeUuid()
      },
      attachments: photoFile ? [{
        field: 'closingMeterPhoto',
        category: 'meter-end',
        file: photoFile,
        fileName: photoFile.name,
        contentType: photoFile.type
      }] : undefined
    });
    setNotice({ type: 'success', text: message });
    onDone({ ...completed, status: 'PENDING_SYNC', synced: false, closingMeterPhoto });
  }

  async function submit() {
    if (!closingMeterReading.trim()) return setNotice({ type: 'error', text: 'Enter the closing meter/hour reading before clock-out.' });
    if (!photo) return setNotice({ type: 'error', text: 'Closing meter photo is required to end shift.' });
    if (!shift.shiftId) return setNotice({ type: 'error', text: 'Shift ID is missing. Refresh the app and try again.' });

    setBusy(true);
    setNotice({ type: 'info', text: 'Clocking out. Please wait...' });

    const gps = await getGps();
    const clockOutTime = nowIso();
    const shiftClassification = classifyShift(shift.clockInTime, clockOutTime);
    const totalHours = shiftClassification.totalHours;
    const completed: ShiftRecord = {
      ...shift,
      status: 'PENDING_SYNC',
      closingMeterReading: Number(closingMeterReading),
      closingMeterPhoto: photo.name,
      gpsEnd: gps,
      clockOutTime,
      totalHours,
      shiftType: shiftClassification.shiftType,
      nightShift: shiftClassification.nightShift,
      nightHours: shiftClassification.nightHours,
      dayHours: shiftClassification.dayHours,
      payrollDate: shiftClassification.payrollDate,
      shiftWindowLabel: shiftClassification.shiftWindowLabel,
      synced: false
    };

    try {
      if (!navigator.onLine || shift.status === 'PENDING_SYNC') {
        await queueClockOut(photo, completed, gps, clockOutTime, 'Clock-out saved on this device. The worker is no longer in an active shift and the record will sync when AWS is reachable.');
        return;
      }

      let key = '';
      try {
        key = await uploadImage(photo, 'meter-end');
      } catch {
        await queueClockOut(photo, completed, gps, clockOutTime, 'Clock-out saved locally because closing photo upload failed. The worker is no longer in an active shift and the photo will sync later.');
        return;
      }

      try {
        const saved = await api<ShiftRecord>('/shifts/clock-out', {
          method: 'POST',
          body: JSON.stringify({
            shiftId: shift.shiftId,
            closingMeterReading: Number(closingMeterReading),
            closingMeterPhoto: key,
            gpsEnd: gps,
            clockOutTime,
            idempotencyKey: safeUuid()
          })
        });
        setNotice({ type: 'success', text: isGpsUnavailable(gps) ? 'Clock-out completed. Note: GPS was unavailable on this device.' : 'Clock-out completed successfully.' });
        onDone({ ...completed, ...saved, shiftId: saved.shiftId || shift.shiftId, synced: true, status: 'COMPLETED', closingMeterPhoto: saved.closingMeterPhoto || key });
      } catch (apiError: any) {
        // Clock-out is a field-critical action. Do not trap the worker on AWS/CORS/network/server errors.
        await queueClockOut(null, completed, gps, clockOutTime, 'Clock-out saved locally because AWS/API could not confirm the request. The worker is no longer in an active shift and the action will sync later.', key || completed.closingMeterPhoto || `PHOTO_PENDING-${safeUuid()}`);
      }
    } catch (error: any) {
      if (isNetworkFailure(error)) {
        await queueClockOut(photo, completed, gps, clockOutTime, 'Clock-out saved locally after a network failure. The worker is no longer in an active shift and it will sync later.');
        return;
      }
      setNotice({ type: 'error', text: error.message || 'Clock-out failed. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Header title="Clock Out" subtitle="A closing hour-meter photo is mandatory before the shift can be ended." />
    {notice && <div className={`card mb-4 ${notice.type === 'error' ? 'border-red-500/40 text-red-200' : notice.type === 'success' ? 'border-green-500/40 text-green-200' : 'border-orange-500/40 text-orange-200'}`}>{notice.text}</div>}
    <div className="card-glow text-center mb-4"><div className="h-16 w-16 mx-auto rounded-3xl bg-red-500/15 border border-red-500/25 grid place-items-center text-red-400"><Lock size={30} /></div><h2 className="text-2xl font-black mt-4">Closing meter photo required</h2><p className="text-sm text-zinc-400 mt-2">The shift cannot be closed until the hour meter photo is captured.</p></div>
    <div className="card mb-4"><div className="grid grid-cols-2 gap-3 text-sm mb-4"><div className="kpi"><p className="text-zinc-500">Machine</p><p className="font-bold">{shift.machineId}</p></div><div className="kpi"><p className="text-zinc-500">Started</p><p className="font-bold">{new Date(shift.clockInTime).toLocaleTimeString()}</p></div></div>{(shift.shiftType === 'NIGHT' || shift.nightShift) && <div className="mb-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200"><strong>Night shift detected</strong><br/><span className="text-xs text-blue-100/80">This shift will be marked as Night Shift on the timesheet.</span></div>}<label className="text-xs text-zinc-400 font-bold">Closing meter/hour reading</label><input className="input mt-2 mb-3" type="number" min="0" step="0.1" inputMode="decimal" value={closingMeterReading} onChange={(event) => setClosingMeterReading(event.target.value)} placeholder="Example: 12463.5" /><PhotoInput label="Take closing meter photo after entering reading" onFile={setPhoto} />{photo && <p className="text-green-400 mt-3 text-sm">✓ Photo attached: {photo.name}</p>}</div>
    <div className="card flex items-center gap-3 text-sm text-zinc-300 mb-4"><MapPin className="text-green-400" size={18} /><span>GPS and timestamp will be captured automatically when you submit clock-out.</span></div>
    <button className="btn bg-red-600 w-full" disabled={!closingMeterReading.trim() || !photo || busy} onClick={submit}>{busy ? 'Submitting clock-out...' : 'Submit & Clock Out'}</button>
    <button className="btn bg-white/5 border border-white/10 w-full mt-3" disabled={busy} onClick={onCancel}>Cancel</button>
  </>;
}
