'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, type Finding } from '@/lib/api';
import { Sev } from '@/components/Shell';

function FindingsList() {
  const params = useSearchParams();
  const [filters, setFilters] = useState({ service: params.get('service') ?? '', environment: '', severity: '', status: 'OPEN', search: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ data: Finding[]; pagination: { total: number; totalPages: number } } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const qs = new URLSearchParams({ page: String(page), limit: '50' });
    Object.entries(filters).forEach(([k, v]) => v && qs.set(k, v));
    api<typeof data>(`/findings?${qs}`).then(setData).catch((e) => setError(e.message));
  }, [filters, page]);
  useEffect(load, [load]);

  const set = (k: keyof typeof filters) => (e: { target: { value: string } }) => { setPage(1); setFilters({ ...filters, [k]: e.target.value }); };

  return (
    <>
      <h1>Findings</h1>
      <div className="row" style={{ marginBottom: 12 }}>
        <input aria-label="Search" placeholder="Search title, CVE, package" value={filters.search} onChange={set('search')} />
        <input aria-label="Service" placeholder="Service" value={filters.service} onChange={set('service')} />
        <input aria-label="Environment" placeholder="Environment" value={filters.environment} onChange={set('environment')} />
        <select aria-label="Severity" value={filters.severity} onChange={set('severity')}>
          <option value="">All severities</option>{['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label="Status" value={filters.status} onChange={set('status')}>
          <option value="">All statuses</option>{['OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED', 'FALSE_POSITIVE'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <p className="muted">{data?.pagination.total ?? 0} findings</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Severity</th><th>Title</th><th>Service</th><th>Tool</th><th>Status</th><th>Last seen</th></tr></thead>
          <tbody>
            {data?.data.map((f) => (
              <tr key={f.id}>
                <td><Sev value={f.severity} /></td>
                <td><Link href={`/findings/${f.id}`}>{f.title}</Link>{f.packageName && <div className="muted">{f.packageName} {f.installedVersion}</div>}</td>
                <td>{f.service}<div className="muted">{f.environment}</div></td>
                <td>{f.tool}</td>
                <td><Sev value={f.status} /></td>
                <td>{new Date(f.lastSeenAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.pagination.totalPages > 1 && (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="muted">Page {page} of {data.pagination.totalPages}</span>
          <button className="secondary" disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}

export default function FindingsPage() {
  return <Suspense><FindingsList /></Suspense>;
}
