'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, PRIVILEGED, type Deployment, type Finding } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Sev } from '@/components/Shell';

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [list, setList] = useState<Deployment[]>([]);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ service: '', environment: 'production', version: '', commitSha: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState('');
  const privileged = user ? PRIVILEGED.includes(user.role) : false;

  const load = useCallback(() => {
    api<Deployment[]>(`/approvals/deployments${status ? `?status=${status}` : ''}`).then(setList).catch((e) => setError(e.message));
  }, [status]);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { const r = await fn(); setMsg(typeof r === 'string' ? r : ok); setError(''); setOpen(null); setText(''); load(); } catch (e) { setError((e as Error).message); setMsg(''); }
  };

  const exception = async (d: Deployment) => {
    const crit = await api<{ data: Finding[] }>(`/findings?service=${encodeURIComponent(d.service)}&environment=${encodeURIComponent(d.environment)}&severity=CRITICAL&limit=200`);
    const ids = crit.data.filter((f) => f.status === 'OPEN' || f.status === 'IN_PROGRESS').map((f) => f.id);
    await api(`/approvals/deployments/${d.id}/exception`, { method: 'POST', json: { findingIds: ids, justification: text } });
  };

  return (
    <>
      <h1>Deployment approvals</h1>
      {user?.role !== 'AUDITOR' && (
        <form className="card row" style={{ marginBottom: 16 }} onSubmit={(e) => {
          e.preventDefault();
          act(async () => {
            const r = await api<Deployment & { gate: { message: string } }>('/approvals/deployments', { method: 'POST', json: form });
            return `Requested: ${r.status} (${r.gate.message})`;
          }, 'Deployment requested');
        }}>
          <input aria-label="Service" placeholder="Service" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} required />
          <input aria-label="Environment" placeholder="Environment" value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} required />
          <input aria-label="Version" placeholder="Version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} required />
          <input aria-label="Commit SHA" placeholder="Commit SHA" value={form.commitSha} onChange={(e) => setForm({ ...form, commitSha: e.target.value })} required />
          <button type="submit">Request deployment</button>
        </form>
      )}
      <div className="row" style={{ marginBottom: 12 }}>
        <select aria-label="Status filter" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>{['PENDING', 'APPROVED', 'REJECTED', 'DEPLOYED', 'ROLLED_BACK'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {msg && <p className="success">{msg}</p>}
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Service</th><th>Version</th><th>Status</th><th>Findings</th><th>Requested</th><th>Actions</th></tr></thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id}>
                <td>{d.service}<div className="muted">{d.environment}</div></td>
                <td>{d.version}<div className="muted">{d.commitSha.slice(0, 8)}</div></td>
                <td><Sev value={d.status} />{d.rejectionReason && <div className="muted">{d.rejectionReason}</div>}{d.exceptions.length > 0 && <div className="muted">Exception: {d.exceptionReason}</div>}</td>
                <td><span className="CRITICAL">{d.criticalCount} critical</span><div className="muted">{d.highCount} high</div></td>
                <td>{d.requestedBy}<div className="muted">{new Date(d.requestedAt).toLocaleString()}</div></td>
                <td>
                  {privileged && d.requestedBy !== user?.email && (d.status === 'PENDING' || (d.status === 'REJECTED' && d.gateBlocked)) && (
                    open === d.id ? (
                      <div style={{ minWidth: 240 }}>
                        <textarea aria-label="Comment" placeholder={d.status === 'PENDING' ? 'Comment / rejection reason' : 'Exception justification (min 10 chars)'} value={text} onChange={(e) => setText(e.target.value)} />
                        <div className="row">
                          {d.status === 'PENDING' && <button onClick={() => act(() => api(`/approvals/deployments/${d.id}/approve`, { method: 'POST', json: { comments: text || undefined } }), 'Approved')}>Approve</button>}
                          {d.status === 'PENDING' && <button className="danger" onClick={() => act(() => api(`/approvals/deployments/${d.id}/reject`, { method: 'POST', json: { reason: text } }), 'Rejected')}>Reject</button>}
                          {d.status === 'REJECTED' && <button onClick={() => act(() => exception(d), 'Exception granted; deployment is pending approval')}>Grant exception</button>}
                          <button className="secondary" onClick={() => setOpen(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : <button className="secondary" onClick={() => { setOpen(d.id); setText(''); }}>Decide</button>
                  )}
                  {privileged && d.status === 'APPROVED' && <button className="secondary" onClick={() => act(() => api(`/approvals/deployments/${d.id}/deployed`, { method: 'POST' }), 'Marked deployed')}>Mark deployed</button>}
                  {privileged && d.status === 'DEPLOYED' && <button className="secondary" onClick={() => act(() => api(`/approvals/deployments/${d.id}/rollback`, { method: 'POST', json: {} }), 'Rolled back')}>Rollback</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
