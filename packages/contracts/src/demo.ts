import type { UserRole } from './identity.js';

/**
 * Canlı demo (ADR-026). Sunucuda DEMO_MODE açıkken giriş ekranı her rol için
 * şifresiz "Demo ile gir" sunar; veri her gün kendiliğinden yeniden üretilir.
 */
export const DEMO_ENDPOINT = '/api/demo';
export const DEMO_LOGIN_ENDPOINT = '/api/auth/demo-login';

/** Demo verisini üreten ve silen işlem sürerken API'nin döndürdüğü hata mesajı. */
export const DEMO_RESETTING_MESSAGE =
  'Demo verisi yenileniyor. Lütfen bir iki dakika sonra tekrar deneyin.';

export interface DemoAccount {
  role: UserRole;
  fullName: string;
  username: string;
}

/** GET /api/demo yanıtı. Demo kapalıyken `enabled: false` ve boş hesap listesi döner. */
export interface DemoInfoResponse {
  enabled: boolean;
  /** Demo verisi şu an siliniyor/üretiliyor mu? */
  resetting: boolean;
  accounts: DemoAccount[];
}

/** POST /api/auth/demo-login gövdesi. */
export interface DemoLoginRequest {
  role: UserRole;
}
