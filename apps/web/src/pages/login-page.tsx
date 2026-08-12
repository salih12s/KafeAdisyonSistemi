import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { AUTH_QUERY_KEY, useCurrentUser } from '../hooks/use-auth';
import { ApiError, fetchCurrentUser, fetchSetupStatus, login } from '../lib/api';
import { APP_NAME, APP_SUBTITLE } from '../config/app-info';
import { IS_CROSS_ORIGIN } from '../config/api-base';

/**
 * Şifre doğru ama tarayıcı oturum çerezini saklamadı. Ayrı barındırmada bunun
 * nedeni neredeyse her zaman üçüncü taraf çerez engelidir.
 */
const SESSION_NOT_STORED_MESSAGE = IS_CROSS_ORIGIN
  ? 'Kullanıcı adı ve şifre doğru, ancak tarayıcınız oturum çerezini saklamadı. ' +
    'Bunun nedeni genellikle üçüncü taraf çerezlerin engellenmesidir (gizli sekme ' +
    'veya katı gizlilik ayarı). Bu site için çerezlere izin verin ya da uygulamayı ' +
    'sunucuyla aynı adresten açın.'
  : 'Kullanıcı adı ve şifre doğru, ancak tarayıcınız oturum çerezini saklamadı. ' +
    'Tarayıcınızın çerez ayarlarını kontrol edin.';
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
    mutationFn: async () => {
      await login(username, password);
      // Şifre doğru olsa bile oturum çerezi saklanmamış olabilir (üçüncü taraf
      // çerez engeli). Doğrulamadan içeri alırsak kullanıcı sebebini anlamadan
      // giriş ekranına geri düşer; bu yüzden oturumu burada teyit ediyoruz.
      try {
        return await fetchCurrentUser();
      } catch {
        throw new ApiError(SESSION_NOT_STORED_MESSAGE);
      }
    },
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
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10 sm:px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          <BrandMark className="h-11 w-11 text-primary" />
          <span className="min-w-0">
            <span className="block truncate text-lg font-extrabold tracking-tight">{APP_NAME}</span>
            <span className="block truncate text-[13px] text-ink-secondary">{APP_SUBTITLE}</span>
          </span>
        </div>

        <div className="surface-card mt-5 p-5 sm:p-6">
          <h1 className="text-xl font-extrabold tracking-tight">Personel girişi</h1>
          <p className="mt-1.5 text-sm leading-6 text-ink-secondary">
            Masaları, siparişleri ve günlük operasyonu güvenli şekilde yönetin.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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

          <p className="mt-5 flex items-center gap-2 border-t border-line pt-4 text-xs text-ink-secondary">
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${setup.isError ? 'bg-danger' : 'bg-success'}`}
            />
            {setup.isError ? 'Sunucu bağlantısı kontrol edilmeli' : 'Sistem bağlantısı hazır'}
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-ink-secondary">
          Oturumunuz 12 saat sonra güvenlik için sona erer.
        </p>
      </div>
    </main>
  );
}
