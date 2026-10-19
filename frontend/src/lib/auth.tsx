'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, type User } from './api';

interface AuthState {
  user: User | null;
  ready: boolean;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) return setUser(null);
    try {
      setUser(await api<User>('/users/profile'));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setReady(true));
  }, [load]);

  const value: AuthState = {
    user,
    ready,
    async login(email, password) {
      const r = await api<{ token: string; user: User }>('/users/login', { method: 'POST', json: { email, password } });
      setToken(r.token);
      setUser(r.user);
    },
    async register(name, email, password) {
      const r = await api<{ token: string; user: User }>('/users/register', { method: 'POST', json: { name, email, password } });
      setToken(r.token);
      setUser(r.user);
    },
    logout() {
      setToken(null);
      setUser(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
