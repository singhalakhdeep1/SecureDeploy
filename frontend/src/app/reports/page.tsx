'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, download, type Report } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export default function ReportsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ framework: 'DPDP_ACT', startDate: daysAgo(90), endDate: today(), service: '' });
  const [list, setList] = useState<Report[]>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(() => { api<Report[]>('/reporting/history').then(setList).catch((e) => setError(e.message)); }, []);
  useEffect(load, [load]);

  return (
    <>
      <h1>Compliance reports</h1>
      {user?.role !== 'DEVELOPER' && (
        <form className="card row" style={{ marginBottom: 16 }} onSubmit={async (e) => {
          e.preventDefault();
          try {
            const r = await api<{ reportId: string; complianceScore: number }>('/reporting/generate', { method: 'POST', json: { ...form, service: form.service || undefined } });
            setMsg(`Report generated (score ${r.complianceScore}%)`);
            setError('');
            load();
          } catch (err) { setError((err as Error).message); }
        }}>
          <select aria-label="Framework" value={form.framework} onChange={(e) => setForm({ ...form, framework: e.target.value })}>
            {['DPDP_ACT', 'RBI_CYBERSECURITY', 'ISO_27001', 'SOC_2'].map((f) => <option key={f}>{f}</option>)}
          </select>
          <input type="date" aria-label="Start date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <input type="date" aria-label="End date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <input aria-label="Service" placeholder="Service (optional)" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} />
          <button type="submit">Generate PDF</button>
        </form>
      )}
      {msg && <p className="success">{msg}</p>}
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Report</th><th>Period</th><th>Score</th><th>Findings</th><th>Generated</th><th /></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.startDate.slice(0, 10)} to {r.endDate.slice(0, 10)}</td>
                <td>{r.complianceScore}%</td>
                <td>{r.findingsCount}</td>
                <td>{new Date(r.generatedAt).toLocaleString()}<div className="muted">{r.generatedBy}</div></td>
                <td><button className="secondary" onClick={() => download(`/reporting/download/${r.id}`, `report-${r.id}.pdf`).catch((e) => setError(e.message))}>Download</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
