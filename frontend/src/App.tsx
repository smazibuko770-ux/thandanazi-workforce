import { useState } from 'react';
import { Eye, EyeOff, Lock, UserRound, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';
import { AuthProvider, useAuth } from './shared/auth/AuthProvider';
import { WorkerApp } from './worker/WorkerApp';
import { SupervisorApp } from './supervisor/SupervisorApp';
import { MechanicApp } from './supervisor/MechanicApp';
import { COMPANY_NAME } from './shared/data/companyData';
import { CopyrightFooter } from './shared/components/CopyrightFooter';
import { ErrorBoundary } from './shared/components/ErrorBoundary';

type LoginMode='signin'|'forgot'|'confirm';
function validPassword(value:string){return value.length>=8&&/[A-Z]/.test(value)&&/[a-z]/.test(value)&&/[0-9]/.test(value);}

function Login() {
  const { login, completeNewPassword, challenge, requestPasswordReset, confirmPasswordReset, authNotice } = useAuth();
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode,setVerificationCode]=useState('');
  const [mode,setMode]=useState<LoginMode>('signin');
  const [delivery,setDelivery]=useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice,setNotice]=useState('');

  async function signIn() {
    setBusy(true); setError(''); setNotice('');
    try { await login(employeeNumber, password); }
    catch (e:any) { setError(e.message || 'Sign in failed'); }
    finally { setBusy(false); }
  }
  async function createPassword() {
    if (!validPassword(newPassword)) return setError('Password must be 8+ characters with uppercase, lowercase and a number.');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');
    setBusy(true); setError('');
    try { await completeNewPassword(newPassword); }
    catch (e:any) { setError(e.message || 'Password setup failed'); }
    finally { setBusy(false); }
  }
  async function requestReset(){
    if(!employeeNumber.trim())return setError('Enter your Z-number.');
    setBusy(true);setError('');setNotice('');
    try{const destination=await requestPasswordReset(employeeNumber);setDelivery(destination);setMode('confirm');}
    catch(e:any){setError(e.message||'Password reset could not be started. Ask an administrator to reset your password.');}
    finally{setBusy(false);}
  }
  async function confirmReset(){
    if(!verificationCode.trim())return setError('Enter the verification code.');
    if(!validPassword(newPassword))return setError('Password must be 8+ characters with uppercase, lowercase and a number.');
    if(newPassword!==confirmPassword)return setError('Passwords do not match.');
    setBusy(true);setError('');
    try{await confirmPasswordReset(employeeNumber,verificationCode.trim(),newPassword);setNotice('Password updated. Sign in with your new password.');setMode('signin');setPassword('');setNewPassword('');setConfirmPassword('');setVerificationCode('');}
    catch(e:any){setError(e.message||'Password reset failed.');}
    finally{setBusy(false);}
  }

  const back=()=>{setMode('signin');setError('');setNotice('');setNewPassword('');setConfirmPassword('');setVerificationCode('');};
  return <main className="login-shell safe">
    <section className="login-hero hidden lg:flex">
      <div className="relative z-10 max-w-xl">
        <p className="section-title text-orange-400">THANDANAZI Workforce</p>
        <h1 className="text-5xl font-black leading-tight mt-4">Construction workforce control centre</h1>
        <p className="text-zinc-400 mt-5 text-lg">Clock-ins, machine checklists, defects, fuel requests, active shifts and payroll exports in one private company app.</p>
        <div className="grid grid-cols-3 gap-3 mt-8"><div className="kpi"><p className="text-2xl font-black text-orange-400">A/B/C</p><p className="text-xs text-zinc-500">Defect classes</p></div><div className="kpi"><p className="text-2xl font-black text-orange-400">GPS</p><p className="text-xs text-zinc-500">Timestamped shifts</p></div><div className="kpi"><p className="text-2xl font-black text-orange-400">AWS</p><p className="text-xs text-zinc-500">Private backend</p></div></div>
      </div>
    </section>
    <section className="login-panel relative z-10 w-full">
      <div className="flex items-center gap-3 mb-8"><div className="h-12 w-12 rounded-2xl bg-orange-500/15 border border-orange-500/25 grid place-items-center text-orange-500 text-2xl font-black">T</div><div><p className="font-black leading-tight">{COMPANY_NAME}</p><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Private workforce app</p></div></div>
      {challenge ? <div className="card-glow">
        <div className="flex items-center gap-3 mb-5"><div className="h-12 w-12 rounded-2xl bg-green-500/15 grid place-items-center text-green-400"><ShieldCheck/></div><div><p className="text-sm text-zinc-400">First login</p><h1 className="text-xl font-black">Create your password</h1></div></div>
        <input className="input mb-3" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Create password"/><input className="input mb-4" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Confirm password"/>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}<button className="btn bg-orange-500 text-black w-full" disabled={busy} onClick={createPassword}>{busy?'Saving...':'Continue'}</button>
      </div> : mode==='signin' ? <div className="card-glow">
        <h1 className="text-3xl font-black">Secure sign in</h1><p className="text-zinc-400 mt-2 mb-6">Use your company Z-number and password.</p>
        <label className="text-xs text-zinc-400 font-bold">Employee number</label><div className="relative mt-2 mb-4"><UserRound className="absolute left-4 top-3.5 text-zinc-500" size={18}/><input className="input pl-11" value={employeeNumber} onChange={e=>setEmployeeNumber(e.target.value.toUpperCase())}/></div>
        <label className="text-xs text-zinc-400 font-bold">Password</label><div className="relative mt-2 mb-3"><Lock className="absolute left-4 top-3.5 text-zinc-500" size={18}/><input className="input pl-11 pr-12" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} /><button className="absolute right-4 top-3.5 text-zinc-500" onClick={()=>setShowPassword(!showPassword)} type="button">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
        <button type="button" className="text-sm font-bold text-orange-400 mb-5" onClick={()=>{setMode('forgot');setError('');setNotice('')}}>Forgot password?</button>
        {authNotice&&<p className="text-yellow-300 text-sm mb-3">{authNotice}</p>}{notice&&<p className="text-green-400 text-sm mb-3">{notice}</p>}{error && <p className="text-red-400 text-sm mb-3">{error}</p>}<button className="btn bg-orange-500 text-black w-full" disabled={busy} onClick={signIn}>{busy?'Signing in...':'Sign In'}</button>
      </div> : mode==='forgot' ? <div className="card-glow">
        <button className="flex items-center gap-2 text-zinc-400 text-sm mb-5" onClick={back}><ArrowLeft size={17}/>Back to sign in</button><div className="h-12 w-12 rounded-2xl bg-orange-500/15 grid place-items-center text-orange-400 mb-4"><KeyRound/></div><h1 className="text-2xl font-black">Reset password</h1><p className="text-zinc-400 mt-2 mb-5">Enter your Z-number. A verification code will be sent to your registered recovery contact.</p><input className="input mb-4" value={employeeNumber} onChange={e=>setEmployeeNumber(e.target.value.toUpperCase())} placeholder="Z-number"/>{error&&<p className="text-red-400 text-sm mb-3">{error}</p>}<button className="btn bg-orange-500 text-black w-full" disabled={busy} onClick={requestReset}>{busy?'Sending...':'Send verification code'}</button><p className="text-xs text-zinc-500 mt-4">No recovery email or phone? Ask an administrator for a temporary password.</p>
      </div> : <div className="card-glow">
        <button className="flex items-center gap-2 text-zinc-400 text-sm mb-5" onClick={back}><ArrowLeft size={17}/>Back to sign in</button><h1 className="text-2xl font-black">Enter verification code</h1><p className="text-zinc-400 mt-2 mb-5">Code sent to {delivery}.</p><input className="input mb-3" inputMode="numeric" value={verificationCode} onChange={e=>setVerificationCode(e.target.value)} placeholder="Verification code"/><input className="input mb-3" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="New password"/><input className="input mb-4" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Confirm new password"/>{error&&<p className="text-red-400 text-sm mb-3">{error}</p>}<button className="btn bg-orange-500 text-black w-full" disabled={busy} onClick={confirmReset}>{busy?'Updating...':'Update password'}</button>
      </div>}
    </section><CopyrightFooter/>
  </main>;
}
function Shell(){const {user,loading}=useAuth();if(loading)return <main className="phone-frame safe grid place-items-center">Loading...</main>;if(!user)return <Login/>;if(user.role==='mechanic')return <MechanicApp/>;if(user.role==='supervisor'||user.role==='admin')return <SupervisorApp role={user.role}/>;return <WorkerApp/>;}
export function App(){return <ErrorBoundary><AuthProvider><Shell/></AuthProvider></ErrorBoundary>;}
