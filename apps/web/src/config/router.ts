/**
 * React Router v7 davranışlarına şimdiden geçilir.
 * Aksi hâlde kütüphane her çalıştırmada geçiş uyarısı yazar ve
 * ileride sürüm yükseltmesi davranış değişikliği getirir.
 */
export const ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;
