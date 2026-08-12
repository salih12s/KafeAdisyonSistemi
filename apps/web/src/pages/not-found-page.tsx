import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Panel } from '../components/ui/panel';

export function NotFoundPage(): JSX.Element {
  return (
    <Panel>
      <div className="flex flex-col items-center px-5 py-12 text-center">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-panel border border-line bg-canvas text-ink-muted">
          <Compass aria-hidden="true" className="h-6 w-6" />
        </span>

        <h2 className="text-base font-semibold">Sayfa bulunamadı</h2>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">
          Aradığınız adres bu uygulamada tanımlı değil.
        </p>

        <Link
          to="/"
          className="mt-6 inline-flex min-h-touch items-center rounded-panel bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-soft"
        >
          Özet ekranına dön
        </Link>
      </div>
    </Panel>
  );
}
