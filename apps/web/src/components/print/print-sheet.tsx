import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { readPaperWidth } from '../../lib/print-settings';

/**
 * İçeriği yazdırma için body altına taşır ve tarayıcının yazdırma penceresini
 * açar. Ekranda görünmez; yazdırırken uygulamanın geri kalanı gizlenir
 * (bkz. styles/index.css `.print-sheet`). Termal yazıcı sistemde yazıcı olarak
 * kurulu olduğu sürece ek sürücü veya uygulama gerekmez.
 */
export function PrintSheet({
  children,
  onDone,
}: {
  children: ReactNode;
  onDone: () => void;
}): JSX.Element {
  const width = readPaperWidth();
  useEffect(() => {
    const finish = (): void => onDone();
    window.addEventListener('afterprint', finish);
    // Portal DOM'a yerleştikten sonra yazdır.
    const timer = window.setTimeout(() => window.print(), 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', finish);
    };
  }, [onDone]);
  return createPortal(
    <div className="print-sheet" data-paper={width}>
      <style>{`@page { size: ${width}mm auto; margin: 0; }`}</style>
      <div className="print-sheet__content" style={{ width: `${width === '80' ? 72 : 48}mm` }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
