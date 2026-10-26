import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { api } from '../shared/api/client';
import { Employee, Site } from '../shared/types/domain';

function iso(d: Date) { return d.toISOString().slice(0, 10); }

type FilterResponse = { employees: Employee[]; sites: Site[] };

export function PayrollExport() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const [startDate, setStartDate] = useState(iso(first));
  const [endDate, setEndDate] = useState(iso(now));
  const [site, setSite] = useState('ALL');
  const [workerId, setWorkerId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [filterError, setFilterError] = useState('');

  async function loadFilters() {
    setLoadingFilters(true);
    setFilterError('');
    try {
      const result = await api<FilterResponse>('/supervisor/payroll/filters');
      setEmployees((result.employees || []).filter((x) => x.status !== 'INACTIVE'));
      setSites((result.sites || []).filter((x) => x.status !== 'INACTIVE'));
    } catch (e: any) {
      setEmployees([]);
      setSites([]);
      setFilterError(e.message || 'Could not load payroll filters. Sign in again with an admin or supervisor account.');
    } finally {
      setLoadingFilters(false);
    }
  }

  useEffect(() => { void loadFilters(); }, []);

  const selectedWorker = useMemo(() => employees.find((e) => e.employeeNumber === workerId), [employees, workerId]);
  const selectedSite = useMemo(() => sites.find((s) => s.siteId === site), [sites, site]);

  async function exportPayroll(format: 'csv' | 'xlsx') {
    if (!startDate || !endDate) return alert('Select a start date and end date.');
    if (new Date(startDate) > new Date(endDate)) return alert('Start date cannot be after end date.');
    setBusy(true);
    try {
      const r = await api<{ url: string; count: number; checklistRows?: number; checklistReports?: number }>(
        '/supervisor/payroll/export',
        {
          method: 'POST',
          body: JSON.stringify({
            startDate,
            endDate,
            site: site || 'ALL',
            workerId: workerId || undefined,
            format
          })
        }
      );
      window.location.assign(r.url);
    } catch (e: any) {
      alert(e.message || 'Payroll export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="section-title">Exports</p>
          <h2 className="font-black">Finance, hours & checklist files</h2>
        </div>
        <FileSpreadsheet className="text-orange-400" />
      </div>

      <p className="text-xs text-zinc-400 mb-3">
        CSV downloads the shift summary for finance, including Day/Night Shift, payroll date, night hours and day hours.
        Excel downloads the full evidence pack: shifts, checklist responses, NO GO defect reports, fuel, breakdowns and emergency logs.
      </p>

      {filterError && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-3 mb-3 text-xs text-yellow-100">
          <p className="font-bold mb-1">Payroll filter warning</p>
          <p>{filterError}</p>
          <button className="btn mt-2 bg-yellow-500 text-black flex items-center justify-center gap-2" onClick={loadFilters} disabled={loadingFilters}>
            <RefreshCw size={14} /> Retry loading employees/sites
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-2">
        <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>

      <label className="text-[11px] text-zinc-500 font-bold uppercase">Employee filter</label>
      <select className="input mb-2" value={workerId} onChange={(e) => setWorkerId(e.target.value)} disabled={loadingFilters}>
        <option value="">All workers</option>
        {employees.map((e) => (
          <option key={e.employeeNumber} value={e.employeeNumber}>
            {e.employeeNumber} • {e.fullName}
          </option>
        ))}
      </select>

      <label className="text-[11px] text-zinc-500 font-bold uppercase">Site filter</label>
      <select className="input mb-3" value={site} onChange={(e) => setSite(e.target.value)} disabled={loadingFilters}>
        <option value="ALL">All sites</option>
        {sites.map((s) => (
          <option key={s.siteId} value={s.siteId}>
            {s.name}
          </option>
        ))}
      </select>

      <div className="rounded-2xl bg-black/30 border border-white/10 p-3 text-[11px] text-zinc-400 mb-3">
        <p><span className="font-bold text-zinc-200">Selected employee:</span> {selectedWorker ? `${selectedWorker.employeeNumber} • ${selectedWorker.fullName}` : 'All workers'}</p>
        <p><span className="font-bold text-zinc-200">Selected site:</span> {selectedSite ? selectedSite.name : 'All sites'}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn bg-green-600 flex items-center justify-center gap-2" disabled={busy} onClick={() => exportPayroll('csv')}>
          <Download size={16} /> CSV
        </button>
        <button className="btn bg-orange-500 text-black flex items-center justify-center gap-2" disabled={busy} onClick={() => exportPayroll('xlsx')}>
          <Download size={16} /> Excel evidence pack
        </button>
      </div>

      <div className="mt-3 rounded-2xl bg-black/30 border border-white/10 p-3 text-[11px] text-zinc-400">
        <p className="font-bold text-zinc-200 mb-1">Checklist saving</p>
        <p>Every submitted shift stores the full GO / NO GO checklist with remarks. All NO GO items are also saved as defect reports and appear in the Excel evidence pack.</p>
      </div>
    </section>
  );
}
