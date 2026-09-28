/** Bağlantı adresindeki veritabanı adı: `mysql://k:p@host:3306/ad` → `ad`. */
export function databaseNameOf(databaseUrl: string): string {
  return decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
}

/**
 * Demo verisi yalnız adı "demo" içeren bir veritabanına yazılır veya oradan
 * silinir (AGENTS.md §9, ADR-024/026). Gerçek işletme veritabanı bu adı taşımaz.
 */
export function isDemoDatabaseName(name: string): boolean {
  return /demo/i.test(name);
}
