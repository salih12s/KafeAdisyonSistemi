import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonStyles } from '../components/ui/button-styles';
import { Panel } from '../components/ui/panel';

export function AccessDeniedPage(): JSX.Element {
  return (
    <Panel variant="elevated" className="mx-auto max-w-xl">
      <div className="flex flex-col items-center px-5 py-12 text-center">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-warning-soft text-warning">
          <ShieldAlert aria-hidden="true" className="h-6 w-6" />
        </span>
        <h2 className="text-xl font-bold">Bu bölüme erişim yetkiniz yok</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-secondary">
          Rolünüz bu ekranı görüntüleme yetkisine sahip değil. Günlük operasyona masalar ekranından
          devam edebilirsiniz.
        </p>
        <Link to="/masalar" className={`${buttonStyles('primary')} mt-6`}>
          Masalara dön
        </Link>
      </div>
    </Panel>
  );
}
