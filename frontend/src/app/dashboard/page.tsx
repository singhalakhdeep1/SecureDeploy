'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, type Deployment, type Score } from '@/lib/api';

interface Stats { total: number; open: number; resolved: number; openBySeverity: Record<string, number>; openByService: Record<string, number> }
interface Mttr { mttrHours: number; sampleSize: number; bySeverity: Record<string, { mttrHours: number; sampleSize: number }> }
interface Status { overallScore: number; byFramework: Record<string, Score> }

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [mttr, setMttr] = useState<Mttr | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [trend, setTrend] = useState<{ date: string; new: number; resolved: number }[]>([]);
  const [pending, setPending] = useState<Deployment[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api<Stats>('/findings/stats/summary').then(setStats),
      api<Mttr>('/findings/stats/mttr').then(setMttr),
      api<Status>('/compliance/status').then(setStatus),
      api<typeof trend>('/findings/stats/trend?days=30').then(setTrend),
      api<Deployment[]>('/approvals/deployments?status=PENDING').then(setPending),
    ]).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <h1>Security posture</h1>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        <div className="card"><div className="muted">Open findings</div><div className="stat">{stats?.open ?? '-'}</div></div>
        <div className="card"><div className="muted">Open critical</div><div className="stat CRITICAL">{stats?.openBySeverity.CRITICAL ?? 0}</div></div>
        <div className="card"><div className="muted">Resolved</div><div className="stat RESOLVED">{stats?.resolved ?? '-'}</div></div>
        <div className="card"><div className="muted">Mean time to remediate</div><div className="stat">{mttr ? `${mttr.mttrHours.toFixed(1)} h` : '-'}</div><div className="muted">{mttr?.sampleSize ?? 0} resolved</div></div>
        <div className="card"><div className="muted">Overall compliance</div><div className="stat">{status ? `${status.overallScore}%` : '-'}</div></div>
        <div className="card"><div className="muted">Pending approvals</div><div className="stat"><Link href="/approvals">{pending.length}</Link></div></div>
      </div>

      <h2>Open findings by severity</h2>
      <div className="card" style={{ height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={SEVERITIES.map((s) => ({ severity: s, open: stats?.openBySeverity[s] ?? 0 }))}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="severity" /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="open" fill="#2457c5" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h2>New vs resolved (30 days)</h2>
      <div className="card" style={{ height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Legend />
            <Line type="monotone" dataKey="new" stroke="#d9480f" dot={false} />
            <Line type="monotone" dataKey="resolved" stroke="#1a7f37" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h2>Compliance by framework</h2>
      <div className="grid">
        {status && Object.values(status.byFramework).map((f) => (
          <Link key={f.framework} href={`/compliance?framework=${f.framework}`} className="card">
            <div className="muted">{f.framework}</div>
            <div className={`stat ${f.score === 100 ? 'PASS' : f.score < 60 ? 'FAIL' : ''}`}>{f.score}%</div>
            <div className="muted">{f.compliantControls}/{f.totalControls} controls, {f.openFindings} open findings</div>
          </Link>
        ))}
      </div>

      <h2>Open findings by service</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Service</th><th>Open</th></tr></thead>
          <tbody>
            {stats && Object.entries(stats.openByService).map(([svc, n]) => (
              <tr key={svc}><td><Link href={`/findings?service=${encodeURIComponent(svc)}`}>{svc}</Link></td><td>{n}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
