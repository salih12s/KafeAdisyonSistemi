/**
 * Termal yazıcı kâğıt genişliği cihaz başınadır (kasa 80 mm, bar 58 mm olabilir),
 * bu yüzden sunucuda değil tarayıcıda tutulur. Depolama kapalıysa 80 mm varsayılır.
 */
export const PAPER_WIDTHS = ['80', '58'] as const;
export type PaperWidth = (typeof PAPER_WIDTHS)[number];

const STORAGE_KEY = 'kafe:paper-width';
const DEFAULT_WIDTH: PaperWidth = '80';

function isPaperWidth(value: unknown): value is PaperWidth {
  return typeof value === 'string' && PAPER_WIDTHS.some((width) => width === value);
}

export function readPaperWidth(): PaperWidth {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isPaperWidth(stored) ? stored : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

export function savePaperWidth(width: PaperWidth): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, width);
  } catch {
    // Gizli sekme vb. durumlarda ayar yalnız bu oturum için geçerli kalmaz; zararsızdır.
  }
}
