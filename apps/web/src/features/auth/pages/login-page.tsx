import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { AUTH_QUERY_KEY, useCurrentUser } from '../hooks/use-auth';
import { ApiError } from '../../../shared/api/http';
import type { UserRole } from '@kafe/contracts';
import { fetchCurrentUser, fetchSetupStatus, login } from '../api';
import { demoLogin } from '../../demo/api';
import { DemoLoginPanel } from '../../demo/components/demo-login-panel';
import { useDemoInfo } from '../../demo/use-demo-info';
import { APP_NAME, APP_SUBTITLE } from '../../../shared/config/app-info';
import { IS_CROSS_ORIGIN } from '../../../shared/config/api-base';
import { BrandMark } from '../../../shared/ui/brand-mark';
import { Button } from '../../../shared/ui/button';
import { TextField } from '../../../shared/ui/field';

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

/** Şifreli personel girişi ya da canlı demoda rol seçerek şifresiz giriş. */
type LoginRequest = { kind: 'password' } | { kind: 'demo'; role: UserRole };

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useCurrentUser();
  const setup = useQuery({ queryKey: ['setup-status'], queryFn: fetchSetupStatus, retry: false });
  const demo = useDemoInfo();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async (request: LoginRequest) => {
      if (request.kind === 'demo') await demoLogin(request.role);
      else await login(username, password);
      // Şifre doğru olsa bile oturum çerezi saklanmamış olabilir (üçüncü taraf
      // çerez engeli). Doğrulamadan içeri alırsak kullanıcı sebebini anlamadan
      // giriş ekranına geri düşer; bu yüzden oturumu burada teyit ediyoruz.
      // Yalnız 401 çerezin gitmediğini gösterir; ağ/sunucu hataları olduğu gibi iletilir.
      try {
        return await fetchCurrentUser();
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 401) {
          throw new ApiError(SESSION_NOT_STORED_MESSAGE, 401);
        }
        throw error;
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
    loginMutation.mutate({ kind: 'password' });
  };

  const failedRequest = loginMutation.isError ? loginMutation.variables : undefined;
  const loginError =
    loginMutation.error instanceof ApiError ? loginMutation.error.message : 'Giriş tamamlanamadı.';
  const demoEnabled = demo.data?.enabled === true;

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

          {demoEnabled ? (
            <div className="mt-5">
              <DemoLoginPanel
                accounts={demo.data?.accounts ?? []}
                resetting={demo.data?.resetting === true}
                pendingRole={
                  loginMutation.isPending && loginMutation.variables.kind === 'demo'
                    ? loginMutation.variables.role
                    : null
                }
                error={failedRequest?.kind === 'demo' ? loginError : null}
                onSelect={(role) => loginMutation.mutate({ kind: 'demo', role })}
              />
              <p className="mt-5 text-center text-xs font-semibold text-ink-secondary">
                veya personel hesabıyla giriş yapın
              </p>
            </div>
          ) : null}

          <form className={demoEnabled ? 'mt-3 space-y-4' : 'mt-6 space-y-4'} onSubmit={onSubmit}>
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

            {failedRequest?.kind === 'password' ? (
              <p
                role="alert"
                className="rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger"
              >
                {loginError}
              </p>
            ) : null}

            <Button
              type="submit"
              variant={demoEnabled ? 'secondary' : 'primary'}
              size="large"
              loading={loginMutation.isPending && loginMutation.variables.kind === 'password'}
              disabled={setup.data === false || loginMutation.isPending}
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
