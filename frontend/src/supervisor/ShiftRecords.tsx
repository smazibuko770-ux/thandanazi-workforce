import { MACHINES } from '../shared/data/companyData';
export function ShiftRecords() {
  return <section className="card mb-4"><div className="flex items-center justify-between mb-3"><div><p className="section-title">Fleet</p><h2 className="font-black">Machine Register</h2></div><span className="badge bg-orange-500/15 text-orange-400">{MACHINES.length} units</span></div>
    <div className="grid grid-cols-2 gap-2 mb-3"><input className="input" type="date" /><input className="input" type="date" /></div>
    <div className="max-h-72 overflow-y-auto pr-1 space-y-2">{MACHINES.map((machine) => <div key={machine.machineId} className="kpi"><div className="flex justify-between gap-3"><div><p className="font-bold">{machine.machineId} • {machine.machineType}</p><p className="text-xs text-zinc-400">Reg/Model: {machine.regNo || 'Not supplied'}</p></div><span className="badge bg-green-500/15 text-green-400 h-fit">Active</span></div></div>)}</div></section>;
}
