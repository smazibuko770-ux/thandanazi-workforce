import { useEffect, useState } from 'react';
import { BriefcaseBusiness, ClipboardList, Home, Settings, UsersRound } from 'lucide-react';
import { Role } from '../shared/types/domain';
import { SupervisorDashboard } from './SupervisorDashboard';
import { AdminManagement } from './AdminManagement';
import { ActiveShifts } from './ActiveShifts';
import { OperationsMonitor } from './OperationsMonitor';
import { PayrollExport } from './PayrollExport';
import { CopyrightFooter } from '../shared/components/CopyrightFooter';
import { Header } from '../shared/components/Header';
import { useAuth } from '../shared/auth/AuthProvider';
import { connectRealtime, foregroundNotify } from '../shared/realtime/socket';

type Screen='dashboard'|'team'|'ops'|'payroll'|'admin';
export function SupervisorApp({ role }: { role: Extract<Role, 'supervisor' | 'admin'> }) {
 const { user } = useAuth();
 const [screen,setScreen]=useState<Screen>('dashboard');
 const [notice,setNotice]=useState('');
 const isAdmin=role==='admin';
 const nav=[
  {id:'dashboard' as Screen,label:'Dashboard',icon:Home,show:true},
  {id:'team' as Screen,label:'Team',icon:UsersRound,show:true},
  {id:'ops' as Screen,label:'Ops',icon:BriefcaseBusiness,show:true},
  {id:'payroll' as Screen,label:'Payroll',icon:ClipboardList,show:true},
  {id:'admin' as Screen,label:'Admin',icon:Settings,show:isAdmin}
 ].filter(n=>n.show);
 useEffect(() => {
  if (!user?.employeeNumber) return;
  const ws = connectRealtime(user.employeeNumber, (event) => {
   if (['FUEL_REQUEST_CREATED','EMERGENCY_CREATED','BREAKDOWN_CREATED','CHECKLIST_DEFECT_REPORTED','FUEL_REQUEST_ASSIGNED','FUEL_REQUEST_RESOLVED','FUEL_STOCK_UPDATED','MECHANIC_STATUS_UPDATED'].includes(event.type)) {
    const message = event.type === 'FUEL_REQUEST_CREATED' ? 'New fuel request received and automatically sent to Themba.' : event.type === 'FUEL_STOCK_UPDATED' ? 'Fuel stock balance updated.' : event.type === 'FUEL_REQUEST_RESOLVED' ? 'Fuel request resolved.' : event.type === 'MECHANIC_STATUS_UPDATED' ? 'Mechanic updated a breakdown or checklist fault.' : 'New operations alert received.';
    foregroundNotify(message);
    setNotice(message);
    window.dispatchEvent(new CustomEvent('thandanazi-ops-updated'));
   }
  });
  return () => ws.close();
 }, [user?.employeeNumber]);
 return <main className="phone-frame supervisor-web safe p-5 pb-24">
  {notice&&<div className="card mb-4 border-green-500/40 text-green-200">{notice}<button className="ml-3 text-xs text-zinc-400" onClick={()=>setNotice('')}>Dismiss</button></div>}
  {screen==='dashboard'&&<SupervisorDashboard/>}
  {screen==='team'&&<><Header title="Team & Active Shifts" subtitle="Live worker shift visibility." showUser/><ActiveShifts/></>}
  {screen==='ops'&&<><Header title="Operations Control" subtitle="Fuel, emergency, breakdown and checklist defect reports." showUser/><OperationsMonitor/></>}
  {screen==='payroll'&&<><Header title="Payroll Reports" subtitle="Export hours, shifts and evidence packs for finance." showUser/><PayrollExport/></>}
  {screen==='admin'&&isAdmin&&<AdminManagement/>}
  {screen==='admin'&&!isAdmin&&<div className="card border-red-500/30 text-red-300">Admin access required.</div>}
  <CopyrightFooter/>
  <nav className="bottom-nav" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
   {nav.map(({id,label,icon:Icon})=><button key={id} className={`rounded-2xl py-2 text-[11px] flex flex-col items-center gap-1 ${screen===id?'text-orange-500 bg-orange-500/10':'text-zinc-500'}`} onClick={()=>setScreen(id)}><Icon size={18}/>{label}</button>)}
  </nav>
 </main>;
}
