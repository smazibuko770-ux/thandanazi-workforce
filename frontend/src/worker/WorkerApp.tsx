import { useEffect, useState } from 'react';
import { ClipboardList, Fuel, Home, Timer } from 'lucide-react';
import { Dashboard } from './Dashboard';
import { ClockInFlow } from './ClockInFlow';
import { ActiveShift } from './ActiveShift';
import { ClockOutFlow } from './ClockOutFlow';
import { Operations } from './Operations';
import { AdhocTasks } from './AdhocTasks';
import { ShiftRecord } from '../shared/types/domain';
import { CopyrightFooter } from '../shared/components/CopyrightFooter';
import { api } from '../shared/api/client';
import { clearLocalActiveShift, loadLocalActiveShift, saveLocalActiveShift, saveWorkerMessage, takeWorkerMessage } from '../shared/offline/localShift';
import { syncQueue } from '../shared/offline/syncQueue';
import { useAuth } from '../shared/auth/AuthProvider';
import { connectRealtime, foregroundNotify } from '../shared/realtime/socket';

type Screen='dashboard'|'clockin'|'active'|'clockout'|'ops'|'tasks';
const nav=[['dashboard',Home,'Home'],['active',Timer,'Shift'],['ops',Fuel,'Ops'],['tasks',ClipboardList,'Tasks']] as const;

export function WorkerApp(){
  const { user } = useAuth();
  const[screen,setScreen]=useState<Screen>('dashboard');
  const[activeShift,setActiveShift]=useState<ShiftRecord|null>(()=>loadLocalActiveShift());
  const[loading,setLoading]=useState(true);
  const[notice,setNotice]=useState(()=>takeWorkerMessage());

  useEffect(()=>{
    let cancelled=false;
    async function load(){
      const local=loadLocalActiveShift();
      if(local && !cancelled) setActiveShift(local);
      try{
        await syncQueue();
        const response=await api<{shift:ShiftRecord|null}>('/shifts/active');
        if(cancelled)return;
        if(response.shift){
          setActiveShift(response.shift);
          saveLocalActiveShift(response.shift);
        }else if(!local){
          setActiveShift(null);
          clearLocalActiveShift();
        }
      }catch{
        // Field-first rule: keep the local active shift visible if AWS/API is unreachable.
        if(local && !cancelled) setActiveShift(local);
      }finally{
        if(!cancelled)setLoading(false);
      }
    }
    void load();
    const onOnline=()=>void syncQueue().then(()=>api<{shift:ShiftRecord|null}>('/shifts/active').then(r=>{if(r.shift){setActiveShift(r.shift);saveLocalActiveShift(r.shift);}}).catch(()=>{}));
    window.addEventListener('online',onOnline);
    return()=>{cancelled=true;window.removeEventListener('online',onOnline);};
  },[]);

  useEffect(() => {
    if (!user?.employeeNumber) return;
    const ws = connectRealtime(user.employeeNumber, (event) => {
      if (event.type === 'TASK_ASSIGNED') {
        const payload = event.payload as { title?: string };
        const msg = `New task assigned${payload?.title ? `: ${payload.title}` : ''}. Open My Tasks to view it.`;
        foregroundNotify(msg);
        saveWorkerMessage(msg);
        setNotice(msg);
        window.dispatchEvent(new CustomEvent('thandanazi-task-assigned'));
      }
    });
    return () => ws.close();
  }, [user?.employeeNumber]);

  if(loading)return <main className="phone-frame safe grid place-items-center">Loading shift...</main>;
  const visibleScreen=screen==='active'&&!activeShift?'dashboard':screen;
  return <main className="phone-frame safe p-5 pb-24">
    {notice&&<div className="card mb-4 border-green-500/40 text-green-200">{notice}<button className="ml-3 text-xs text-zinc-400" onClick={()=>setNotice('')}>Dismiss</button></div>}
    {visibleScreen==='dashboard'&&<Dashboard activeShift={activeShift} go={setScreen}/>}
    {visibleScreen==='clockin'&&<ClockInFlow onCancel={()=>setScreen('dashboard')} onStarted={s=>{setActiveShift(s);saveLocalActiveShift(s);setScreen('active')}}/>}
    {visibleScreen==='active'&&activeShift&&<ActiveShift shift={activeShift} go={setScreen}/>}
    {visibleScreen==='clockout'&&activeShift&&<ClockOutFlow shift={activeShift} onCancel={()=>setScreen('active')} onDone={s=>{clearLocalActiveShift();setActiveShift(null);const hours=s.totalHours?.toFixed(2)||'0.00';const msg=`Shift ended. Total hours: ${hours}. If network was unavailable, it is queued for sync.`;saveWorkerMessage(msg);setNotice(msg);setScreen('dashboard')}}/>}
    {visibleScreen==='ops'&&<Operations activeShift={activeShift} onBack={()=>setScreen(activeShift?'active':'dashboard')}/>}
    {visibleScreen==='tasks'&&<AdhocTasks onBack={()=>setScreen('dashboard')}/>}<CopyrightFooter/>
    <nav className="bottom-nav">{nav.map(([key,Icon,label])=>{const active=key==='active'?!!activeShift&&(screen==='active'||screen==='clockout'):screen===key;return <button key={key} className={`rounded-2xl py-2 text-[11px] flex flex-col items-center gap-1 ${active?'text-orange-500 bg-orange-500/10':'text-zinc-500'}`} onClick={()=>setScreen(key==='active'?(activeShift?'active':'clockin'):key)}><Icon size={18}/>{label}</button>})}</nav>
  </main>;
}
