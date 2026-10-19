'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, PRIVILEGED } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Sbom { id: string; image: string; service?: string; format: string; componentCount: number; createdBy: string; createdAt: string }

export default function ScansPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ image: '', service: '', environment: 'production' });
  const [sboms, setSboms] = useState<Sbom[]>([]);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api<Sbom[]>('/scans/sboms').then(setSboms).catch(() => undefined); }, []);
  useEffect(load, [load]);
  const privileged = user ? PRIVILEGED.includes(user.role) : false;

  const run = async (kind: 'grype' | 'trivy' | 'sbom') => {
    setBusy(true);
    setResult(`Running ${kind}...`);
    try {
      const r = await api(`/scans/${kind}`, { method: 'POST', json: { image: form.image, service: form.service || undefined, environment: form.environment } });
      setResult(JSON.stringify(r, null, 2));
      load();
    } catch (e) {
      setResult(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Scans &amp; SBOMs</h1>
      {privileged ? (
        <div className="card">
          <p className="muted">Runs Grype, Trivy or Syft on the API host. With a service set, results are ingested as findings (full scan). In-cluster CronJobs and CI post results through the webhooks instead.</p>
          <div className="row">
            <input aria-label="Image" placeholder="Image, e.g. node:22-alpine" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
            <input aria-label="Service" placeholder="Service (optional)" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} />
            <input aria-label="Environment" value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} />
            <button disabled={busy || !form.image} onClick={() => run('grype')}>Grype</button>
            <button disabled={busy || !form.image} onClick={() => run('trivy')}>Trivy</button>
            <button disabled={busy || !form.image} className="secondary" onClick={() => run('sbom')}>Generate SBOM</button>
          </div>
          {result && <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>{result}</pre>}
        </div>
      ) : <p className="muted">Only security leads and admins can run scans.</p>}
      <h2>Stored SBOMs</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Image</th><th>Service</th><th>Format</th><th>Components</th><th>Created</th></tr></thead>
          <tbody>
            {sboms.map((s) => (
              <tr key={s.id}><td>{s.image}</td><td>{s.service ?? ''}</td><td>{s.format}</td><td>{s.componentCount}</td><td>{new Date(s.createdAt).toLocaleString()}<div className="muted">{s.createdBy}</div></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
