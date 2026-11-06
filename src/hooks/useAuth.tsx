import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { adminApi, ApiClientError } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { AdminIdentity } from '@/types';

interface AuthState {
  loading: boolean;
  session: Session | null;
  admin: AdminIdentity | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setAdmin(null);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Cek ke server apakah user ini benar-benar admin.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    adminApi
      .me()
      .then((a) => {
        if (!active) return;
        setAdmin(a);
        setError(null);
      })
      .catch(async (e: unknown) => {
        if (!active) return;
        setAdmin(null);
        if (e instanceof ApiClientError && (e.status === 403 || e.status === 401)) {
          setError('Akun ini tidak terdaftar sebagai admin.');
          await supabase.auth.signOut();
        } else {
          setError(e instanceof Error ? e.message : 'Gagal memverifikasi admin.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      throw new Error(err.message === 'Invalid login credentials' ? 'Email atau password salah.' : err.message);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAdmin(null);
  }, []);

  const value = useMemo(
    () => ({ loading, session, admin, error, signIn, signOut }),
    [loading, session, admin, error, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
