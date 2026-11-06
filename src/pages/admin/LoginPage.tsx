import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/Button';
import { useAuth } from '@/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function LoginPage() {
  const { admin, signIn, error: authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (admin) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/admin'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal.');
    } finally {
      setLoading(false);
    }
  }

  const message = error ?? authError;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-accent font-bold text-white">E</span>
          <span className="text-lg font-semibold tracking-tight">Epen License</span>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <h1 className="text-xl font-semibold">Masuk sebagai admin</h1>
            <p className="mt-1 text-sm text-muted">Gunakan akun yang terdaftar di Supabase Auth.</p>
          </div>

          {!isSupabaseConfigured && (
            <p className="flex gap-2 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diatur.
            </p>
          )}

          <div>
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {message && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad" role="alert">{message}</p>}

          <Button type="submit" loading={loading} className="w-full" disabled={!isSupabaseConfigured}>
            {loading ? 'Memeriksa…' : 'Masuk'}
          </Button>
        </form>
      </div>
    </div>
  );
}
