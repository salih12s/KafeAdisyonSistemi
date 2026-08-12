import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Eye, EyeOff, ShieldCheck, UtensilsCrossed } from 'lucide-react';
import { AUTH_QUERY_KEY, useCurrentUser } from '../hooks/use-auth';
import { ApiError, fetchSetupStatus, login } from '../lib/api';
import { BrandMark } from '../components/ui/brand-mark';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/field';

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useCurrentUser();
  const setup = useQuery({ queryKey: ['setup-status'], queryFn: fetchSetupStatus, retry: false });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
    <main className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(28rem,0.9fr)_minmax(34rem,1.1fr)]">
      <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16 xl:px-24">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3">
            <BrandMark />
            <h2 className="text-lg font-extrabold">Kafe Adisyon</h2>
          </div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">
            Personel girişi
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Servise kaldığınız yerden devam edin.
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-ink-secondary">
            Masalar, siparişler ve işletme operasyonları tek güvenli çalışma alanında.
          </p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            {setup.data === false ? (
              <div className="rounded-card border border-warning/30 bg-warning-soft p-4 text-sm text-ink">
                <p className="font-bold">İlk yönetici hesabı bekleniyor</p>
                <p className="mt-1 text-ink-secondary">
                  Terminalde{' '}
                  <code className="rounded bg-white px-1.5 py-0.5">npm run setup:owner</code>{' '}
                  komutunu çalıştırın.
                </p>
              </div>
            ) : null}

            <TextField
              id="username"
              name="username"
              label="Kullanıcı adı"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Kullanıcı adınız"
            />
            <TextField
              id="password"
              name="password"
              label="Şifre"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Şifreniz"
              suffix={
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-control text-ink-secondary hover:bg-surface-muted hover:text-ink"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            {loginMutation.isError ? (
              <p
                role="alert"
                className="rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger"
              >
                {loginMutation.error instanceof ApiError
                  ? loginMutation.error.message
                  : 'Giriş tamamlanamadı.'}
              </p>
            ) : null}

            <Button
              type="submit"
              size="large"
              loading={loginMutation.isPending}
              disabled={setup.data === false}
              className="w-full"
            >
              Giriş yap
            </Button>
          </form>

          <div className="mt-8 flex items-center gap-2 border-t border-line pt-5 text-xs text-ink-secondary">
            <span
              className={`h-2 w-2 rounded-full ${setup.isError ? 'bg-danger' : 'bg-success'}`}
            />
            {setup.isError ? 'Sunucu bağlantısı kontrol edilmeli' : 'Yerel sistem bağlantısı hazır'}
          </div>
        </div>
      </section>

      <aside className="hidden bg-[#2B1B14] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-control border border-white/15 px-3 py-1.5 text-xs font-semibold">
            <ShieldCheck className="h-4 w-4 text-[#F4B77C]" /> Bu cihazda, tek merkezde
          </span>
          <h2 className="mt-7 max-w-xl text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
            Sıcak misafirperverlik, sakin operasyon.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/70">
            Kafe ekibinizin yoğun servis anlarında ihtiyaç duyduğu hız, netlik ve ortak çalışma
            düzeni.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-panel border border-white/10 bg-white/[0.07] p-5">
            <UtensilsCrossed className="h-6 w-6 text-[#F4B77C]" />
            <p className="mt-5 text-sm font-bold">Operasyon tek bakışta</p>
            <p className="mt-1 text-sm leading-5 text-white/60">
              Masa, mutfak ve ödeme akışları ekip için görünür.
            </p>
          </div>
          <div className="rounded-panel border border-white/10 bg-white/[0.07] p-5">
            <CheckCircle2 className="h-6 w-6 text-[#78C89A]" />
            <p className="mt-5 text-sm font-bold">Dokunmatik kullanım</p>
            <p className="mt-1 text-sm leading-5 text-white/60">
              Telefon, tablet ve kasa ekranı için tutarlı deneyim.
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
