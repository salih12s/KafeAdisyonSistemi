/** Tüm REST uçlarının ortak ön eki. Üretimde web ile aynı origin üzerinden sunulur. */
export const API_PREFIX = '/api';

/** Uygulamanın çalıştığı ortam. */
export type AppEnvironment = 'development' | 'test' | 'production';

/** Uygulamanın kullandığı sabit bölgesel ayarlar. Tek şube, tek para birimi. */
export const LOCALE = 'tr-TR';
export const CURRENCY = 'TRY';
export const TIME_ZONE = 'Europe/Istanbul';
