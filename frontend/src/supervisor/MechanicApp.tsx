import { RefreshCw, Wrench } from 'lucide-react';
import { Header } from '../shared/components/Header';
import { CopyrightFooter } from '../shared/components/CopyrightFooter';
import { OperationsMonitor } from './OperationsMonitor';

export function MechanicApp() {
  return <main className="phone-frame supervisor-web safe p-5 pb-16">
    <Header title="Mechanic View" subtitle="Breakdowns and checklist faults: acknowledge, in progress, resolved." showUser/>
    <section className="grid grid-cols-2 gap-3 mb-4">
      <div className="kpi"><Wrench className="text-yellow-400"/><p className="text-zinc-500 text-xs mt-3">Access</p><p className="text-xl font-black">Breakdowns</p></div>
      <div className="kpi"><RefreshCw className="text-orange-400"/><p className="text-zinc-500 text-xs mt-3">Access</p><p className="text-xl font-black">Checklist faults</p></div>
    </section>
    <OperationsMonitor readOnly mechanicOnly/>
    <CopyrightFooter/>
  </main>;
}
