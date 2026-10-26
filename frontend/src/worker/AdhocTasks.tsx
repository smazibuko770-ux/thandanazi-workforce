import { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, Clock, Fuel, RefreshCw } from 'lucide-react';
import { Header } from '../shared/components/Header';
import { PhotoInput } from '../shared/components/PhotoInput';
import { api } from '../shared/api/client';
import { uploadImage } from '../shared/api/uploads';
import { useAuth } from '../shared/auth/AuthProvider';

type Task={taskId:string;title:string;description:string;priority:'Normal'|'Urgent';status:'Unread'|'Read'|'Completed';createdAt:string;sourceEntity?:string;sourceId?:string;fuelLitres?:number;fuelPhotos?:string[]};
type FuelDraft={litres:string;notes:string;photos:File[]};

const FUEL_ATTENDANT='Z9000021';

export function AdhocTasks({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [tasks,setTasks]=useState<Task[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [stock,setStock]=useState<{balanceLitres:number;updatedAt?:string}|null>(null);
  const [busyTask,setBusyTask]=useState('');
  const [drafts,setDrafts]=useState<Record<string,FuelDraft>>({});
  const isFuelAttendant=user?.employeeNumber===FUEL_ATTENDANT;

  async function load(){
    setLoading(true);setError('');
    try{
      const r=await api<{items:Task[]}>('/tasks');
      const visibleItems=isFuelAttendant?(r.items||[]):(r.items||[]).filter(t=>t.sourceEntity!=='FUEL');
      setTasks(visibleItems);
      const hasFuelTask=visibleItems.some(t=>t.sourceEntity==='FUEL');
      if(isFuelAttendant||hasFuelTask){
        try{setStock(await api<{balanceLitres:number;updatedAt?:string}>('/tasks/fuel-stock'));}catch{setStock(null)}
      }
    }catch(e:any){setError(e.message||'Tasks could not be loaded')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[]);
  useEffect(()=>{
    const onTask=()=>void load();
    const interval=window.setInterval(()=>void load(),10000);
    window.addEventListener('thandanazi-task-assigned',onTask);
    window.addEventListener('focus',onTask);
    return()=>{window.clearInterval(interval);window.removeEventListener('thandanazi-task-assigned',onTask);window.removeEventListener('focus',onTask);};
  },[]);

  const fuelTasks=useMemo(()=>tasks.filter(t=>t.sourceEntity==='FUEL'),[tasks]);
  function draftFor(taskId:string){return drafts[taskId]||{litres:'',notes:'',photos:[]};}
  function updateDraft(taskId:string,patch:Partial<FuelDraft>){setDrafts(current=>({ ...current, [taskId]: { ...draftFor(taskId), ...patch } }));}

  async function enableAlerts(){
    try{if('Notification'in window&&Notification.permission==='default')await Notification.requestPermission();navigator.vibrate?.([120,60,120]);alert('Task alerts enabled where supported by this phone/browser. Keep the app open for instant vibration alerts.');}
    catch{alert('This browser does not support task alert permissions. In-app alerts will still show.');}
  }

  async function update(taskId:string,action:'read'|'complete'){
    try{await api(`/tasks/${taskId}/${action}`,{method:'PATCH'});await load()}catch(e:any){alert(e.message||'Task update failed')}
  }

  async function completeFuelTask(task:Task){
    const draft=draftFor(task.taskId);
    const litres=Number(draft.litres);
    if(!task.sourceId)return alert('Fuel request ID missing on this task. Refresh and try again.');
    if(!Number.isFinite(litres)||litres<=0)return alert('Enter litres distributed.');
    if(draft.photos.length<1)return alert('Take at least one fuel delivery photo.');
    setBusyTask(task.taskId);
    try{
      const photos=await Promise.all(draft.photos.map(photo=>uploadImage(photo,'fuel-distribution')));
      await api(`/tasks/${task.taskId}/fuel-complete`,{method:'POST',body:JSON.stringify({fuelId:task.sourceId,litres,photos,notes:draft.notes})});
      setDrafts(current=>{const copy={...current};delete copy[task.taskId];return copy});
      navigator.vibrate?.([120,60,120]);
      alert('Fuel distribution captured, stock balance updated, and request marked resolved.');
      await load();
    }catch(e:any){alert(e.message||'Fuel completion failed. Refresh and try again.')}
    finally{setBusyTask('')}
  }

  return <><Header title="My Tasks" subtitle="Supervisor messages and assigned work."/>
    {stock&&<div className="card mb-3 border-blue-500/30 bg-blue-500/10"><div className="flex items-center gap-3"><Fuel className="text-blue-300"/><div><p className="text-xs uppercase tracking-[0.2em] text-blue-200">Fuel stock balance</p><h2 className="text-2xl font-black">{stock.balanceLitres.toLocaleString()} L</h2>{stock.updatedAt&&<p className="text-[11px] text-blue-100/70">Updated {new Date(stock.updatedAt).toLocaleString()}</p>}</div></div></div>}
    <div className="grid grid-cols-2 gap-2 mb-3"><button className="btn bg-white/5 border border-white/10 flex items-center gap-2" onClick={load}><RefreshCw size={16}/>{loading?'Loading...':'Refresh'}</button><button className="btn bg-orange-500 text-black" onClick={enableAlerts}>Enable alerts</button></div>
    {isFuelAttendant&&fuelTasks.length===0&&<div className="card text-zinc-400 mb-3">No fuel requests assigned to Themba at the moment.</div>}
    {error&&<div className="card border-red-500/30 text-red-300 mb-3">{error}</div>}
    {!loading&&!error&&!tasks.length&&<div className="card text-zinc-400 mb-3">No tasks assigned.</div>}
    {tasks.map(t=>{const draft=draftFor(t.taskId);const isFuel=t.sourceEntity==='FUEL';return <div className="card mb-3" key={`${t.taskId}-${t.createdAt}`}><div className="flex justify-between gap-3"><div><h2 className="font-black">{t.title}</h2><p className="text-sm text-zinc-400 mt-2">{t.description}</p></div><span className={`badge h-fit ${t.priority==='Urgent'?'bg-red-500/15 text-red-400':'bg-yellow-500/15 text-yellow-400'}`}>{t.priority}</span></div><div className="flex justify-between mt-4 text-xs"><span className="flex gap-1 text-zinc-500"><Clock size={13}/>{new Date(t.createdAt).toLocaleString()}</span><span className="text-orange-400">{t.status}</span></div>
      {isFuelAttendant&&isFuel&&t.status!=='Completed'&&<div className="mt-3 rounded-2xl border border-blue-500/25 bg-blue-500/10 p-3"><p className="font-black text-blue-100 mb-2">Fuel distribution capture</p><label className="text-xs text-zinc-400 font-bold">Litres distributed</label><input className="input mt-2 mb-3" type="number" min="0" step="0.1" inputMode="decimal" value={draft.litres} onChange={e=>updateDraft(t.taskId,{litres:e.target.value})} placeholder="Example: 200"/><label className="text-xs text-zinc-400 font-bold">Notes / machine condition</label><textarea className="input min-h-24 mt-2 mb-3" value={draft.notes} onChange={e=>updateDraft(t.taskId,{notes:e.target.value})} placeholder="Optional note about fuel issued"/><div className="card bg-black/20 mb-3"><div className="flex items-center gap-2 mb-3"><Camera className="text-orange-500"/><p className="font-bold">Fuel delivery photo</p></div><PhotoInput label="Take fuel photo" onFile={file=>updateDraft(t.taskId,{photos:[...draft.photos,file]})}/>{draft.photos.length>0&&<p className="text-green-400 text-sm mt-2">✓ {draft.photos.length} photo(s) attached</p>}</div><button className="btn bg-blue-600 w-full" disabled={busyTask===t.taskId} onClick={()=>completeFuelTask(t)}>{busyTask===t.taskId?'Saving fuel record...':'Save litres & resolve fuel request'}</button></div>}
      <div className="grid grid-cols-2 gap-2 mt-3"><button className="btn bg-white/5 border border-white/10" disabled={t.status!=='Unread'} onClick={()=>update(t.taskId,'read')}>Mark Read</button>{isFuel?<button className="btn bg-white/5 border border-white/10" disabled>Use fuel form above</button>:<button className="btn bg-green-600" disabled={t.status==='Completed'} onClick={()=>update(t.taskId,'complete')}><CheckCircle2 size={16}/> Complete</button>}</div></div>})}
    <button className="btn bg-white/5 border border-white/10 w-full" onClick={onBack}>Back</button>
  </>;
}
