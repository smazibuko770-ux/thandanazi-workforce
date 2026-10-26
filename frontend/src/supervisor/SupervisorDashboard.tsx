import { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardCheck, Fuel, UsersRound, Wrench } from 'lucide-react';
import { Header } from '../shared/components/Header';
import { ActiveShifts } from './ActiveShifts';
import { ShiftRecords } from './ShiftRecords';
import { PayrollExport } from './PayrollExport';
import { OperationsMonitor } from './OperationsMonitor';
import { AdhocComposer } from './AdhocComposer';
import { api } from '../shared/api/client';

type Overview={activeWorkers:number;openEmergencies:number;openBreakdowns:number;pendingFuel:number;checklistReports?:number};
export function SupervisorDashboard(){
 const [o,setO]=useState<Overview>({activeWorkers:0,openEmergencies:0,openBreakdowns:0,pendingFuel:0,checklistReports:0});
 const [error,setError]=useState('');
 useEffect(()=>{api<Overview>('/supervisor/overview').then(setO).catch(e=>setError(e.message))},[]);
 const cards=[['Currently on shift',String(o.activeWorkers),UsersRound,'text-green-400'],['Open emergencies',String(o.openEmergencies),AlertTriangle,'text-red-400'],['Open breakdowns',String(o.openBreakdowns),Wrench,'text-yellow-400'],['Pending fuel',String(o.pendingFuel),Fuel,'text-blue-400'],['Checklist defects',String(o.checklistReports||0),ClipboardCheck,'text-orange-400']] as const;
 return <><Header title="Supervisor Dashboard" subtitle="Live control centre for workers, machines, operations and payroll." showUser/>{error&&<div className="card border-red-500/30 text-red-300 mb-4">Live data error: {error}</div>}<section className="grid grid-cols-2 gap-3 mb-4">{cards.map(([k,v,Icon,c])=><div className="kpi" key={k}><Icon className={c} size={24}/><p className="text-zinc-500 text-xs mt-3">{k}</p><p className="text-3xl font-black">{v}</p></div>)}</section><ActiveShifts/><ShiftRecords/><PayrollExport/><OperationsMonitor/><AdhocComposer/></>
}
