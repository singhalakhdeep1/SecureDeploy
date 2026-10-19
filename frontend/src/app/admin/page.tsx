'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type Role, type User } from '@/lib/api';

const ROLES: Role[] = ['ADMIN', 'SECURITY_LEAD', 'DEVELOPER', 'AUDITOR'];

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const load = useCallback(() => { api<User[]>('/users').then(setUsers).catch((e) => setError(e.message)); }, []);
  useEffect(load, [load]);
  const act = (fn: () => Promise<unknown>) => fn().then(() => { setError(''); load(); }).catch((e) => setError(e.message));

  return (
    <>
      <h1>Users &amp; roles</h1>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Role</th><th>Owned services (comma separated)</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}<div className="muted">{u.email}</div></td>
                <td>
                  <select aria-label={`Role of ${u.email}`} value={u.role} onChange={(e) => act(() => api(`/users/${u.id}/role`, { method: 'PATCH', json: { role: e.target.value } }))}>
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td className="row">
                  <input aria-label={`Services of ${u.email}`} value={edits[u.id] ?? u.services.join(', ')} onChange={(e) => setEdits({ ...edits, [u.id]: e.target.value })} />
                  <button className="secondary" onClick={() => act(() => api(`/users/${u.id}/services`, { method: 'POST', json: { services: (edits[u.id] ?? u.services.join(',')).split(',').map((s) => s.trim()).filter(Boolean) } }))}>Save</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
