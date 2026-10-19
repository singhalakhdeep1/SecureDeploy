'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, PRIVILEGED, type Finding, type FindingStatus } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Sev } from '@/components/Shell';

export default function FindingDetail({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [f, setF] = useState<Finding | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<Finding>(`/findings/${params.id}`).then(setF).catch((e) => setError(e.message));
  }, [params.id]);

  if (!f) return <p className={error ? 'error' : 'muted'}>{error || 'Loading...'}</p>;
  const statuses: FindingStatus[] = user && PRIVILEGED.includes(user.role) ? ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED', 'FALSE_POSITIVE'] : ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
  const change = async (status: FindingStatus) => {
    try {
      const updated = await api<Finding>(`/findings/${f.id}/status`, { method: 'PATCH', json: { status, note: note || undefined } });
      setF({ ...f, ...updated });
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <p><Link href="/findings">&larr; Findings</Link></p>
      <h1><Sev value={f.severity} /> {f.title}</h1>
      <div className="card">
        <p>{f.description}</p>
        <div className="grid">
          <div><div className="muted">Service</div>{f.service} / {f.environment}</div>
          <div><div className="muted">Tool</div>{f.tool} ({f.category})</div>
          <div><div className="muted">Status</div><Sev value={f.status} /></div>
          {f.cveId && <div><div className="muted">ID</div>{f.cveId}{f.cvssScore ? ` (CVSS ${f.cvssScore})` : ''}</div>}
          {f.packageName && <div><div className="muted">Package</div>{f.packageName} {f.installedVersion}{f.fixedVersion ? ` → ${f.fixedVersion}` : ''}</div>}
          {f.filePath && <div><div className="muted">Location</div>{f.filePath}{f.lineNumber ? `:${f.lineNumber}` : ''}</div>}
          <div><div className="muted">First / last seen</div>{new Date(f.firstSeenAt).toLocaleDateString()} / {new Date(f.lastSeenAt).toLocaleDateString()}</div>
        </div>
        {f.remediation && <p><b>Remediation:</b> {f.remediation}</p>}
        {f.statusNote && <p className="muted">Note: {f.statusNote}{f.resolvedBy ? ` (by ${f.resolvedBy})` : ''}</p>}
      </div>

      {user?.role !== 'AUDITOR' && (
        <>
          <h2>Change status</h2>
          <textarea aria-label="Note" placeholder="Note / justification (required for IGNORED and FALSE_POSITIVE)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}>
            {statuses.filter((s) => s !== f.status).map((s) => <button key={s} className="secondary" onClick={() => change(s)}>{s}</button>)}
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}

      <h2>Compliance impact</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Framework</th><th>Control</th><th>Clause</th><th>Risk</th></tr></thead>
          <tbody>
            {f.complianceMappings?.map((m) => <tr key={m.id}><td>{m.framework}</td><td>{m.controlTitle}</td><td>{m.clause}</td><td>{m.riskScore}</td></tr>)}
          </tbody>
        </table>
      </div>
    </>
  );
}
