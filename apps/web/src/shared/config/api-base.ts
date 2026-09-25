/**
 * API'nin nerede olduğunu belirler.
 *
 * Varsayılan (boş): API ve arayüz aynı origin üzerindedir; Express React
 * derlemesini de sunar (bkz. DECISIONS.md ADR-004). Göreli `/api` yolları
 * kullanılır ve çerez aynı site içinde kalır.
 *
 * `VITE_API_URL` derleme sırasında verilirse arayüz ayrı bir yerde barındırılıyor
 * demektir (örneğin statik hosting) ve istekler bu mutlak adrese gider. Bu durumda
 * sunucuda `CORS_ORIGIN` tanımlı olmalıdır; aksi hâlde tarayıcı istekleri engeller.
 */
const configured = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

/** Mutlak API adresi; aynı origin kullanılıyorsa boş dizedir. */
export const API_BASE_URL = configured;

/** Arayüz ile API farklı origin'lerdeyse true. */
export const IS_CROSS_ORIGIN = API_BASE_URL.length > 0;

/** Göreli bir API yolunu, yapılandırmaya uygun tam adrese çevirir. */
export function apiUrl(path: string): string {
  return IS_CROSS_ORIGIN ? `${API_BASE_URL}${path}` : path;
}

/**
 * Çerezli isteklerde kullanılacak kip. Farklı origin'de çerezin gidebilmesi için
 * `include` gerekir; aynı origin'de daha dar olan `same-origin` korunur.
 */
export const CREDENTIALS_MODE: RequestCredentials = IS_CROSS_ORIGIN ? 'include' : 'same-origin';
