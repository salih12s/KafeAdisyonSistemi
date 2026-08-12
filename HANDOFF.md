# HANDOFF.md — Geliştiriciler arası devir kaydı

Bu dosya her zaman tek aktif görevi gösterir (bkz. [AGENTS.md](AGENTS.md) §7).
Phase başına ayrı review yoktur; tamamlanan Phase draft PR ile açık bırakılır ve
sonraki geliştiriciye devredilir.

---

## Aktif durum

| Alan                  | Değer                                              |
| --------------------- | -------------------------------------------------- |
| **Tamamlanan Phase**  | Phase 3 — Masa, adisyon ve sipariş                 |
| **Branch**            | `feat/phase-3-orders`                              |
| **Ana geliştirici**   | Codex                                              |
| **Durum**             | **Tamamlandı — draft PR açık, merge edilmedi** |
| **Base branch / SHA** | `feat/phase-2-menu-products` / `7241d17`           |
| **Phase commit**      | `feat: complete phase 3 table checks and ordering` |
| **Son güncelleme**    | 2026-08-12                                         |

### Phase durumu

| Phase | Branch                         | Ana geliştirici | Durum                          |
| ----- | ------------------------------ | --------------- | ------------------------------ |
| 0     | `feat/phase-0-foundation`      | Claude          | Tamamlandı · draft PR açık     |
| 1     | `feat/phase-1-identity-tables` | Codex           | Tamamlandı · draft PR açık     |
| 2     | `feat/phase-2-menu-products`   | Claude          | Tamamlandı · draft PR açık     |
| 3     | `feat/phase-3-orders`          | Codex           | Tamamlandı · draft PR açık     |
| 4     | `feat/phase-4-realtime`        | Codex           | Başlanmadı                     |

---

## Phase 3 teslimi

### Veri modeli ve migration

- Additive migration: `20260812092542_phase_3_orders`.
- Yeni enum: `CheckStatus` (`OPEN`, `CANCELLED`).
- Yeni modeller: `Check`, `OrderItem`, `OrderItemOption`.
- Migration yalnız yeni enum/tablo/index/constraint/foreign key oluşturur; `DROP`,
  `TRUNCATE`, `DELETE FROM`, reset veya mevcut veriyi dönüştüren işlem yoktur.
- Tüm ilişkiler `ON DELETE RESTRICT`; sipariş kalemi iptali fiziksel silme yapmaz.
- `Check_one_open_per_table_key` koşullu unique indeksi aynı masada yalnız bir
  `OPEN` adisyon bulunmasını veritabanı seviyesinde korur.
- Migration gerçek `CafeAdisyon` veritabanına `prisma migrate deploy` ile
  uygulandı; migration durumu günceldir ve `SELECT 1` başarılıdır.

### Backend

- `OrderStore` sınırı ve Prisma/bellek içi uygulamaları eklendi.
- Uçlar `/api/orders` altında: operasyon floor plan, masa açma, adisyon okuma,
  masanın açık adisyonunu okuma, kalem ekleme, adet/not güncelleme ve gerekçeli
  kalem iptali.
- OWNER, CASHIER ve WAITER sipariş mutation'ı yapabilir; KITCHEN yalnız okur.
- Zorunlu seçenek, SINGLE/MULTIPLE, aktif ürün/grup/değer ve seçeneğin ürüne
  aidiyeti backend'de doğrulanır; geçersiz seçim `400` döner.
- Ürün adı/fiyatı ile seçenek adı/fiyat farkları sipariş anında snapshot alınır.
  `(ürün + seçenekler) × adet` ve adisyon toplamı yalnız backend transaction'ında
  tam sayı kuruşla hesaplanır; istemci fiyat/toplam alanları kullanılmaz.
- Açma, kalem ekleme, değiştirme ve iptal işlemleri audit kaydı üretir.

### Frontend

- `/masalar` gerçek operasyon ekranıdır: salonlar, boş/açık durumu, kişi,
  toplam ve açık süre gösterilir.
- Boş masa kişi sayısıyla açılır; açık masa adisyon ekranına geçer.
- Adisyon ekranı kategori/ürün menüsü, SINGLE/MULTIPLE seçenekler, ürün ekleme,
  snapshot kalemleri, adet/not güncelleme, gerekçeli iptal ve toplamı içerir.
- KITCHEN salt okuma görünümü alır. Dokunma hedefleri en az 44px, gridler
  telefon/tablet/masaüstü kırılımlarına uygundur ve yatay taşma oluşturan sabit
  genişlik eklenmemiştir.

### Kalite kanıtı

| Komut                       | Sonuç                                  |
| --------------------------- | -------------------------------------- |
| `npm run lint`              | PASS — 0 hata, 0 uyarı                 |
| `npm run typecheck`         | PASS — contracts + api + web           |
| `npm run test`              | PASS — 139/139 (API 103, web 36)       |
| `npm run build`             | PASS — web JS 300.24 kB, gzip 89.26 kB |
| `npm run verify`            | PASS — lint → typecheck → test → build |
| `npm run db:check`          | PASS — PostgreSQL `SELECT 1`           |
| `npm run db:migrate:status` | PASS — 3 migration, schema up to date  |

Phase 3'te 23 test eklendi: 17 backend + 6 frontend.

### Bilinen riskler

1. Gerçek veritabanında OWNER ve domain verisi yoktur; Prisma operasyon floor
   plan sorgusu gerçek şemada salt-okuma olarak doğrulandı, authenticated gerçek-DB
   mutation E2E yapılmadı.
2. Responsive kurallar ve kullanıcı akışları jsdom testleriyle doğrulandı;
   390/768/1440px gerçek tarayıcı görsel incelemesi yapılmadı.
3. Adisyonun tamamını `CANCELLED` durumuna geçiren kullanıcı akışı bu Phase'in
   minimum API kapsamına dahil edilmedi; enum Phase 5 kapanış/iptal akışına hazırdır.

---

## Sonraki geliştiricinin işi — Phase 4 (Codex)

Phase 4: mutfak/bar ekranı, hazırlık durumları ve Socket.IO gerçek zamanlı
güncellemeler. `feat/phase-4-realtime` branch'i bu branch'ten açılmalıdır.

- Phase 3 `preparationArea` değerini değiştirmedi; mutfak/bar yönlendirmesinde
  ürün referansından veya gerekli yeni snapshot kararından yararlanılmalıdır.
- Phase 3 kalemlerinde hazırlık durum alanı yoktur; Phase 4 migration'ı additive
  olmalıdır.
- Ödeme, hesap kapatma/bölme, cari, indirim ve Railway kapsam dışı kalır.
- Phase 4'e bu teslim sırasında başlanmadı.

**Merge yapılmadı. Phase 4'e başlanmadı.**

---

## Devir geçmişi

| Tarih      | Phase   | Devreden | Devralan | Not                                                       |
| ---------- | ------- | -------- | -------- | --------------------------------------------------------- |
| 2026-08-12 | Phase 0 | Claude   | Codex    | Proje temeli tamamlandı.                                  |
| 2026-08-12 | Phase 1 | Codex    | Claude   | Kimlik, personel, salon ve masa tamamlandı.               |
| 2026-08-12 | Phase 2 | Claude   | Codex    | Menü, ürün, seçenek ve ekstra yönetimi tamamlandı.        |
| 2026-08-12 | Phase 3 | Codex    | Codex    | Masa açma, adisyon ve sipariş tamamlandı; Phase 4 sırada. |
