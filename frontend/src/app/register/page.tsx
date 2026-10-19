'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  return (
    <form className="stack card" style={{ width: 360 }} onSubmit={async (e) => {
      e.preventDefault();
      try { await register(form.name, form.email, form.password); router.push('/dashboard'); } catch (err) { setError((err as Error).message); }
    }}>
      <h1>Create account</h1>
      <p className="muted">The first account becomes the administrator; later accounts start as developers.</p>
      <input aria-label="Name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <input type="email" aria-label="Email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      <input type="password" aria-label="Password" placeholder="Password (min 8)" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
      <button type="submit">Register</button>
      {error && <p className="error">{error}</p>}
      <p className="muted"><Link href="/login">Back to login</Link></p>
    </form>
  );
}
