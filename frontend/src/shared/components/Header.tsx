import { Bell, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { COMPANY_NAME } from '../data/companyData';
import { useAuth } from '../auth/AuthProvider';

export function Header({ title, subtitle, showUser = false }: { title: string; subtitle?: string; showUser?: boolean }) {
  const online = useOnlineStatus();
  const { user, logout } = useAuth();
  return <header className="mb-5 relative z-10">
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 shrink-0 rounded-2xl bg-orange-500/15 border border-orange-500/25 grid place-items-center text-orange-500 font-black">T</div>
        <div className="min-w-0">
          <p className="text-sm font-extrabold truncate">{COMPANY_NAME}</p>
          <p className="text-[11px] text-zinc-500 uppercase tracking-[0.16em]">Workforce control</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`badge flex items-center gap-1 ${online ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>{online ? <Wifi size={12}/> : <WifiOff size={12}/>} {online ? 'Online' : 'Offline'}</span>
        <button className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 grid place-items-center"><Bell size={18}/></button>
      </div>
    </div>
    {showUser && user && <div className="card-glow mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-12 w-12 rounded-2xl bg-zinc-800 grid place-items-center text-lg font-black text-zinc-300">{user.fullName.charAt(0)}</div>
        <div className="min-w-0"><p className="text-sm text-zinc-400">Welcome back,</p><h2 className="font-black truncate">{user.fullName}</h2><p className="text-xs text-zinc-500">{user.employeeNumber} • {user.role}</p></div>
      </div>
      <button className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 grid place-items-center" onClick={logout}><LogOut size={17}/></button>
    </div>}
    <div>
      <h1 className="text-2xl font-black tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{subtitle}</p>}
    </div>
  </header>;
}
