import { useMemo } from 'react';
import { encode } from 'uqr';

/**
 * Verilen metnin QR kodunu SVG olarak çizer. Matris kütüphaneden gelir; çizim
 * React ile yapılır, innerHTML kullanılmaz. Yazdırıldığında da keskin kalır.
 */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}): JSX.Element {
  const qr = useMemo(() => encode(value, { ecc: 'M', border: 2 }), [value]);
  const path = useMemo(() => {
    const segments: string[] = [];
    qr.data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) segments.push(`M${x} ${y}h1v1h-1z`);
      });
    });
    return segments.join('');
  }, [qr]);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
