import { useEffect,useState } from 'react';
import { api } from '../shared/api/client';
import { ShiftRecord } from '../shared/types/domain';
import { classifyShift } from '../shared/utils/nightShift';
import { nowIso } from '../shared/utils/appTime';

export function ActiveShifts(){
  const[items,setItems]=useState<ShiftRecord[]>([]);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{api<{items:ShiftRecord[]}>('/supervisor/active-shifts').then(r=>setItems(r.items)).finally(()=>setLoading(false))},[]);
  return <section className="card mb-4"><div className="flex justify-between mb-3"><div><p className="section-title">Live</p><h2 className="font-black">Active Shifts</h2></div><span className="badge bg-green-500/15 text-green-400">{items.length} active</span></div>{loading?<p className="text-zinc-500">Loading...</p>:items.length===0?<p className="text-zinc-500">No workers currently on shift.</p>:<div className="space-y-2">{items.map(s=>{const c=classifyShift(s.clockInTime,nowIso());const night=s.shiftType==='NIGHT'||s.nightShift||c.nightShift;return <div className="kpi" key={s.shiftId}><div className="flex items-start justify-between gap-2"><p className="font-bold">{s.employeeNumber}</p>{night&&<span className="badge bg-blue-500/15 text-blue-300">Night</span>}</div><p className="text-xs text-zinc-400">{s.siteId} • {s.machineId}</p><p className="text-xs text-green-400 mt-1">Started {new Date(s.clockInTime).toLocaleString()}</p></div>})}</div>}</section>
}
