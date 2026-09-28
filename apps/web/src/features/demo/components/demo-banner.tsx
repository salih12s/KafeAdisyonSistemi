import { useDemoInfo } from '../use-demo-info';

/** Canlı demoda uygulamanın üstünde duran ince bilgi şeridi. Demo kapalıyken görünmez. */
export function DemoBanner(): JSX.Element | null {
  const demo = useDemoInfo();
  if (demo.data?.enabled !== true) return null;

  return (
    <p className="border-b border-primary/20 bg-primary-soft px-3 py-1.5 text-center text-xs text-ink lg:px-6">
      <span className="font-bold">Canlı demo</span>
      <span className="text-ink-secondary">
        {' '}
        · Örnek verilerle çalışıyorsunuz; yaptığınız değişiklikler her sabah sıfırlanır.
      </span>
    </p>
  );
}
