'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';

const PUBLIC = ['/login', '/register'];
const LINKS: { href: string; label: string; roles?: string[] }[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/findings', label: 'Findings' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/compliance', label: 'Compliance' },
  { href: '/reports', label: 'Reports' },
  { href: '/scans', label: 'Scans & SBOMs' },
  { href: '/audit', label: 'Audit trail', roles: ['ADMIN', 'SECURITY_LEAD', 'AUDITOR'] },
  { href: '/admin', label: 'Users', roles: ['ADMIN'] },
];

export function Shell({ children }: { children: ReactNode }) {
  const { user, ready, logout } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC.includes(path);

  useEffect(() => {
    if (ready && !user && !isPublic) router.replace('/login');
  }, [ready, user, isPublic, router]);

  if (isPublic) return <div className="center">{children}</div>;
  if (!ready || !user) return <div className="center muted">Loading...</div>;

  return (
    <div className="shell">
      <nav className="side">
        <Link href="/dashboard" className="brand">SecureDeploy</Link>
        {LINKS.filter((l) => !l.roles || l.roles.includes(user.role)).map((l) => (
          <Link key={l.href} href={l.href} className={path.startsWith(l.href) ? 'active' : ''}>{l.label}</Link>
        ))}
        <div style={{ marginTop: 'auto' }} className="muted">
          {user.name}<br />{user.role}
        </div>
        <button className="secondary" onClick={() => { logout(); router.push('/login'); }}>Log out</button>
      </nav>
      <main>{children}</main>
    </div>
  );
}

export function Sev({ value }: { value: string }) {
  return <span className={`badge ${value}`}>{value}</span>;
}
