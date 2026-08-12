import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coffee } from 'lucide-react';
import { AUTH_QUERY_KEY, useCurrentUser } from '../hooks/use-auth';
import { ApiError, fetchSetupStatus, login } from '../lib/api';

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useCurrentUser();
  const setup = useQuery({ queryKey: ['setup-status'], queryFn: fetchSetupStatus, retry: false });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = useMutation({
    mutationFn: () => login(username, password),
    onSuccess: (user) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user);
      navigate('/', { replace: true });
    },
  });

  if (auth.isSuccess) return <Navigate to="/" replace />;

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (username.trim().length === 0 || password.length === 0) return;
    loginMutation.mutate();
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-8">
      <section className="w-full max-w-sm rounded-panel border border-line bg-surface">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-panel bg-espresso text-white">
            <Coffee aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Kafe Adisyon</h1>
            <p className="text-[13px] text-ink-muted">Personel girişi</p>
          </div>
        </div>

        <form className="space-y-4 p-5" onSubmit={onSubmit}>
          {setup.data === false ? (
            <p className="rounded-panel border border-line bg-accent-soft p-3 text-sm">
              İlk yönetici hesabı henüz oluşturulmadı. Terminalde <code>npm run setup:owner</code>{' '}
              komutunu çalıştırın.
            </p>
          ) : null}

          <label className="block text-sm font-medium">
            Kullanıcı adı
            <input
              name="username"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1.5 min-h-touch w-full rounded-panel border border-line bg-white px-3 text-ink"
            />
          </label>

          <label className="block text-sm font-medium">
            Şifre
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 min-h-touch w-full rounded-panel border border-line bg-white px-3 text-ink"
            />
          </label>

          {loginMutation.isError ? (
            <p role="alert" className="text-sm text-danger">
              {loginMutation.error instanceof ApiError
                ? loginMutation.error.message
                : 'Giriş tamamlanamadı.'}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loginMutation.isPending || setup.data === false}
            className="min-h-touch w-full rounded-panel bg-espresso px-4 text-sm font-semibold text-white hover:bg-espresso-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loginMutation.isPending ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
        </form>
      </section>
    </main>
  );
}
