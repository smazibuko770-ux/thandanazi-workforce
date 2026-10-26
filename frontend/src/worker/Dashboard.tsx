import { BriefcaseBusiness, ClipboardList, Clock, ShieldCheck } from 'lucide-react';
import { Header } from '../shared/components/Header';
import { useAuth } from '../shared/auth/AuthProvider';
import { ShiftRecord } from '../shared/types/domain';
import { findEmployee } from '../shared/data/companyData';
import { FuelTasksPanel } from './FuelTasksPanel';

type Screen = 'dashboard' | 'clockin' | 'active' | 'ops' | 'tasks';
function daysUntil(date?: string) { if (!date || Number.isNaN(new Date(date).getTime())) return null; return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000); }
function progressFromDays(days: number | null) { if (days === null) return 20; return Math.max(4, Math.min(100, (days / 365) * 100)); }

export function Dashboard({ activeShift, go }: { activeShift: ShiftRecord | null; go: (s: Screen) => void }) {
  const { user } = useAuth();
  const employee = user ? findEmployee(user.employeeNumber) : undefined;
  const isFuelAttendant = user?.employeeNumber === 'Z9000021';
  const medicalDays = daysUntil(employee?.medicalExpiry);
  const permitDays = daysUntil(employee?.permitExpiry);
  const medicalStatus = medicalDays === null ? 'CHECK' : medicalDays >= 0 ? 'VALID' : 'EXPIRED';
  const cards = [
    { label: activeShift ? 'Active Shift' : 'Clock In', icon: Clock, onClick: () => go(activeShift ? 'active' : 'clockin'), sub: activeShift ? `${activeShift.machineId} is running` : 'Start your shift', tone: 'orange' },
    { label: 'Operations', icon: BriefcaseBusiness, onClick: () => go('ops'), sub: 'Fuel, breakdown, emergency', tone: 'orange' },
    { label: 'Ad Hoc Tasks', icon: ClipboardList, onClick: () => go('tasks'), sub: 'View and complete tasks', tone: 'orange' },
    { label: 'Medical / Permit', icon: ShieldCheck, onClick: () => alert(`Medical: ${employee?.medicalExpiry || 'Not captured'}\nPermit: ${employee?.permitExpiry || 'Not captured'}`), sub: medicalDays === null ? 'Needs review' : `${medicalDays} medical days`, tone: medicalStatus === 'VALID' ? 'blue' : 'red' }
  ];
  return <>
    <Header title="Worker Dashboard" subtitle="All key actions are available from this screen." showUser />
    {activeShift && <button className="card-glow w-full text-left mb-4" onClick={() => go('active')}><p className="section-title">Current status</p><div className="flex justify-between items-center mt-2"><div><h2 className="font-black text-xl">Shift in progress</h2><p className="text-sm text-zinc-400">{activeShift.siteId} • {activeShift.machineId}</p></div><span className="badge bg-green-500/15 text-green-400">ACTIVE</span></div></button>}
    {isFuelAttendant && <FuelTasksPanel compact />}
    <section className="grid grid-cols-2 gap-3">
      {cards.map((c) => <button key={c.label} className="card text-left min-h-40 flex flex-col justify-between hover:border-orange-500/30" onClick={c.onClick}>
        <div className={`h-14 w-14 rounded-3xl grid place-items-center ${c.tone === 'blue' ? 'bg-blue-500/15 text-blue-400' : c.tone === 'red' ? 'bg-red-500/15 text-red-400' : 'bg-orange-500/15 text-orange-500'}`}><c.icon size={28} /></div>
        <div><h2 className="font-black leading-tight">{c.label}</h2><p className="text-xs text-zinc-400 mt-1 leading-relaxed">{c.sub}</p></div>
      </button>)}
    </section>
    <div className="card mt-4">
      <div className="flex justify-between items-start gap-3"><div><p className="section-title">Compliance</p><h2 className="font-black mt-1">Medical certificate</h2></div><span className={`badge ${medicalStatus === 'VALID' ? 'bg-green-500/15 text-green-400' : medicalStatus === 'EXPIRED' ? 'bg-red-500/15 text-red-400' : 'bg-yellow-500/15 text-yellow-400'}`}>{medicalStatus}</span></div>
      <p className="text-sm text-zinc-400 mt-2">Medical expiry: <span className="text-white">{employee?.medicalExpiry || 'Not captured'}</span></p>
      <div className="h-2 bg-zinc-800 rounded-full mt-3 overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${progressFromDays(medicalDays)}%` }} /></div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-2xl bg-white/[0.04] p-3"><p className="text-zinc-500 text-xs">Medical remaining</p><p className="font-bold">{medicalDays ?? 'N/A'} days</p></div><div className="rounded-2xl bg-white/[0.04] p-3"><p className="text-zinc-500 text-xs">Permit remaining</p><p className="font-bold">{permitDays ?? 'N/A'} days</p></div></div>
      <p className="mt-3 text-xs text-zinc-500">Allowed equipment: {employee?.permittedMachineTypes?.join(', ') || 'Not captured'}</p>
    </div>
  </>;
}
