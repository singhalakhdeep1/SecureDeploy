'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, type Control, type Score } from '@/lib/api';

interface Framework { id: string; name: string; description: string }

function Compliance() {
  const params = useSearchParams();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [fw, setFw] = useState(params.get('framework') ?? 'DPDP_ACT');
  const [service, setService] = useState('');
  const [controls, setControls] = useState<Control[]>([]);
  const [score, setScore] = useState<Score | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { api<Framework[]>('/compliance/frameworks').then(setFrameworks).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    const qs = `framework=${fw}${service ? `&service=${encodeURIComponent(service)}` : ''}`;
    api<Control[]>(`/compliance/controls?${qs}`).then(setControls).catch((e) => setError(e.message));
    api<Score>(`/compliance/score?${qs}`).then(setScore).catch(() => undefined);
  }, [fw, service]);

  return (
    <>
      <h1>Compliance</h1>
      <div className="row" style={{ marginBottom: 12 }}>
        <select aria-label="Framework" value={fw} onChange={(e) => setFw(e.target.value)}>
          {frameworks.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <input aria-label="Service filter" placeholder="Service (optional)" value={service} onChange={(e) => setService(e.target.value)} />
      </div>
      {error && <p className="error">{error}</p>}
      {score && (
        <div className="grid" style={{ marginBottom: 12 }}>
          <div className="card"><div className="muted">Score</div><div className="stat">{score.score}%</div></div>
          <div className="card"><div className="muted">Compliant controls</div><div className="stat">{score.compliantControls}/{score.totalControls}</div></div>
          <div className="card"><div className="muted">Open mapped findings</div><div className="stat">{score.openFindings}</div></div>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Result</th><th>Control</th><th>Clause</th><th>Open findings</th><th>Max risk</th></tr></thead>
          <tbody>
            {controls.map((c) => (
              <tr key={c.id}>
                <td><span className={`badge ${c.compliant ? 'PASS' : 'FAIL'}`}>{c.compliant ? 'PASS' : 'FAIL'}</span></td>
                <td>{c.title}<div className="muted">{c.description}</div></td>
                <td>{c.clause}</td>
                <td>{c.openFindings}</td>
                <td>{c.maxRiskScore || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function CompliancePage() {
  return <Suspense><Compliance /></Suspense>;
}
