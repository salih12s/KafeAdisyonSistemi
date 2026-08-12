/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Arayüz API'den ayrı barındırıldığında kullanılacak mutlak API adresi.
   * Örnek: https://kafeadisyonsistemi-production.up.railway.app
   * Boş bırakılırsa aynı origin varsayılır.
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
