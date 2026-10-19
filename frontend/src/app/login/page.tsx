'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  return (
    <form className="stack card" style={{ width: 360 }} onSubmit={async (e) => {
      e.preventDefault();
      try { await login(email, password); router.push('/dashboard'); } catch (err) { setError((err as Error).message); }
    }}>
      <h1>SecureDeploy</h1>
      <input type="email" aria-label="Email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" aria-label="Password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button type="submit">Log in</button>
      {error && <p className="error">{error}</p>}
      <p className="muted">No account? <Link href="/register">Register</Link></p>
    </form>
  );
}
