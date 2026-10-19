'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Event { id: string; actor: string; action: string; entityType: string; entityId?: string; details?: { description?: string }; createdAt: string }

export default function AuditPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api<Event[]>(`/audit?limit=200${action ? `&action=${encodeURIComponent(action)}` : ''}`).then(setEvents).catch((e) => setError(e.message));
  }, [action]);
  return (
    <>
      <h1>Audit trail</h1>
      <select aria-label="Action filter" value={action} onChange={(e) => setAction(e.target.value)} style={{ marginBottom: 12 }}>
        <option value="">All actions</option>
        {['deployment', 'finding', 'findings', 'report', 'user', 'sbom'].map((a) => <option key={a} value={a}>{a}.*</option>)}
      </select>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}><td>{new Date(e.createdAt).toLocaleString()}</td><td>{e.actor}</td><td>{e.action}</td><td>{e.details?.description}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
