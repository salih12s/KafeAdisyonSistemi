import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Panel } from '../components/ui/panel';
import { buttonStyles } from '../components/ui/button-styles';

export function NotFoundPage(): JSX.Element {
  return (
    <Panel variant="elevated" className="mx-auto max-w-xl">
      <div className="flex flex-col items-center px-5 py-12 text-center">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-primary-soft text-primary">
          <Compass aria-hidden="true" className="h-6 w-6" />
        </span>

        <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-primary">404</p>
        <h2 className="mt-2 text-xl font-bold">Sayfa bulunamadı</h2>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">
          Aradığınız adres bu uygulamada tanımlı değil.
        </p>

        <Link to="/" className={`${buttonStyles('primary')} mt-6`}>
          Özet ekranına dön
        </Link>
      </div>
    </Panel>
  );
}
