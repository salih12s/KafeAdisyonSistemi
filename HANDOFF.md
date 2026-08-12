# HANDOFF.md — Geliştiriciler arası devir kaydı

Bu dosya her zaman tek aktif görevi gösterir (bkz. [AGENTS.md](AGENTS.md) §7).
Phase başına ayrı review yoktur; tamamlanan Phase draft PR ile açık bırakılır ve
sonraki geliştiriciye devredilir.

---

## Aktif durum

Frontend redesign complete — comprehensive final review pending

- Branch: `feat/frontend-experience-redesign`
- Base: `feat/phase-7-reports-deployment` (`2f7066d`)
- Frontend-only kapsam: backend, contracts, Prisma schema ve migration değişmedi.
- `npm run verify`: PASS — 182/182 test (API 131, web 51).
- Chrome: Özet, Masalar, KDS ve Raporlar 390/768/1024/1440px genişliklerde
  yatay taşma olmadan doğrulandı.
- Security scan çalıştırılmadı; merge yapılmadı.

| Alan                  | Değer                                              |
| --------------------- | -------------------------------------------------- |
| **Tamamlanan Phase**  | Phase 7 — Raporlar ve production hazırlığı          |
| **Branch**            | `feat/phase-7-reports-deployment`                   |
| **Ana geliştirici**   | Codex                                              |
| **Durum**             | **Tamamlandı — draft PR açık, merge edilmedi** |
| **Base branch / SHA** | `feat/phase-6-accounts-adjustments-tables` / `6a698f0` |
| **Phase commit**      | `feat: complete phase 7 reports and production readiness` |
| **Son güncelleme**    | 2026-08-12                                         |

### Phase durumu

| Phase | Branch                         | Ana geliştirici | Durum                          |
| ----- | ------------------------------ | --------------- | ------------------------------ |
| 0     | `feat/phase-0-foundation`      | Claude          | Tamamlandı · draft PR açık     |
| 1     | `feat/phase-1-identity-tables` | Codex           | Tamamlandı · draft PR açık     |
| 2     | `feat/phase-2-menu-products`   | Claude          | Tamamlandı · draft PR açık     |
| 3     | `feat/phase-3-orders`          | Codex           | Tamamlandı · draft PR açık     |
| 4     | `feat/phase-4-realtime-kitchen` | Codex          | Tamamlandı · draft PR açık     |
| 5     | `feat/phase-5-payments`          | Codex          | Tamamlandı · draft PR açık     |
| 6     | `feat/phase-6-accounts-adjustments-tables` | Codex | Tamamlandı · draft PR açık |
| 7     | `feat/phase-7-reports-deployment` | Codex | Tamamlandı · draft PR açık |

---

## Phase 7 teslimi

- `/raporlar`; tarih aralığına göre yalnız `PAID` adisyonlardan ciro, adisyon
  sayısı, ortalama, nakit/kart/cari dağılımı, ürün/kategori/personel satışları,
  indirim, ikram, iptal ve saatlik dağılımı backend'de tam sayı kuruşla hesaplar.
  `MERGED` ve `CANCELLED` adisyonlar ciroya dahil edilmez.
- Gün sonu görünümü bugünün ciro/ödeme/indirim/ikram özetini, açık adisyonları ve
  ledger'dan türetilen pozitif açık cari bakiyeyi gösterir; fiskal Z raporu değildir.
- Ayarlar içindeki salt okunur işlem geçmişi OWNER erişimine açıktır; tarih,
  personel, işlem ve entity filtreleri vardır. Secret niteliğindeki metadata
  anahtarları API cevabından çıkarılır.
- `railway.json`; Railpack build, güvenli `prisma migrate deploy` pre-deploy,
  `npm start` ve `/api/health` kontrolünü tanımlar. Express React SPA, API ve
  Socket.IO'yu aynı production origin/port üzerinden sunar.
- README; Railway PostgreSQL/reference değişkenleri, custom domain, environment,
  migration deployment ve `pg_dump`/`pg_restore`/`psql` yönergelerini içerir.
- Additive `20260812163000_phase_7_report_snapshots` migration'ı sipariş kalemine
  kategori kimliği/adı snapshot'ı ekler ve mevcut kalemleri bağlı ürün/kategoriden
  backfill eder; böylece ürün sonradan taşınsa da geçmiş kategori satışı değişmez.
- Yedi migration günceldir; pre-deploy komutu gerçek yerel DB'de güvenli
  `prisma migrate deploy` akışıyla doğrulandı.
- `npm run verify`: PASS — 181/181 test (API 131, web 50); web JS 378.01 kB,
  gzip 110.51 kB. Production smoke test
  `0.0.0.0:3107` üzerinde health/DB, root, `/raporlar` SPA fallback ve Socket.IO
  polling hattı için 200 döndürdü.

Kalan risk: Railway üzerinde gerçek deployment/custom domain oluşturulmadı;
production hazırlığı yerel build/runtime ve resmi Railway yapılandırma biçimiyle
doğrulandı. Rapor UI'ı responsive kod/jsdom ile doğrulandı, gerçek mobil cihazda
görsel inceleme yapılmadı.

**Development phases complete — comprehensive final review pending**

---

## Phase 6 teslimi

- Additive `20260812150000_phase_6_accounts_adjustments_tables` migration'ı
  müşteri/cari ledger, indirim, ikram ve adisyon birleştirme alanlarını ekler;
  destructive SQL içermez. Gerçek `CafeAdisyon` veritabanına uygulandı, altı
  migration güncel ve `SELECT 1` başarılıdır.
- Cari bakiye mutable kolon değildir; `DEBT`, `COLLECTION`, `REFUND` ve
  `CORRECTION` hareketlerinden hesaplanır. Cariye aktarım adisyona immutable
  `ACCOUNT` ödeme satırı ve müşteriye `DEBT` hareketi yazar.
- Yüzde/sabit indirim ile gerekçeli ikram backend'de kuruş üzerinden hesaplanır;
  toplam negatif veya alınmış ödeme tutarının altına inemez.
- Masa taşıma ve iki açık adisyonu birleştirme serializable transaction ve satır
  kilitleriyle yapılır. Kaynak adisyon `MERGED` olarak korunur; kalem, ödeme,
  indirim ve cari hareketleri hedef adisyona aktarılır.
- `/cariler` müşteri arama/oluşturma/düzenleme, bakiye, tahsilat ve ekstreyi;
  adisyon ekranı indirim, ikram, cariye aktarma, taşıma ve birleştirmeyi sunar.
  Audit kayıtları ve küçük Socket.IO invalidation event'leri eklenmiştir.
- `npm run verify`: PASS — 169/169 test (API 123, web 46); production health ve
  root `0.0.0.0:3106` üzerinde 200.

Kalan risk: Gerçek veritabanında müşteri/adisyon verisi bulunmadığı için
authenticated Prisma mutation E2E yapılmadı; migration gerçek DB'de, kurallar HTTP
bellek-store testlerinde doğrulandı. Gerçek telefon/tablet görsel incelemesi yapılmadı.

---

## Phase 5 teslimi

- Additive `20260812133000_phase_5_payments` migration'ı `Payment`,
  `PaymentMethod`, `PAID` ve nullable kapanış alanlarını ekler; gerçek DB'ye
  uygulandı, beş migration güncel ve `SELECT 1` başarılıdır.
- Nakit, kart ve karma ödeme immutable satırlardır. Kalan bakiye backend'de
  hesaplanır; fazla ödeme, yetersiz nakit ve ödenenden düşük yeni toplam reddedilir.
- Tutar/kalem/kişi bölme ana adisyonu parçalamaz; kuruş artıkları deterministik
  dağıtılır. Ödeme ve kapanış audit'e yazılır.
- Kapanış aynı adisyon satırını kilitleyen serializable transaction içindedir;
  yalnız bakiye sıfırken `PAID` olur ve masa yeniden boş görünür.
- Adisyon ekranında toplam/ödenen/kalan, ödeme türü, nakit/para üstü, bölme,
  ödeme geçmişi ve kapatma akışları çalışır. Ödeme/kapanış Socket.IO sinyaliyle
  REST cache'lerini yeniler.
- `npm run verify`: PASS — 160/160 test (API 117, web 43); production health ve
  root `0.0.0.0:3105` üzerinde 200.

Kalan risk: Gerçek DB'de ödeme/adisyon verisi olmadığı için authenticated Prisma
mutation E2E yapılmadı; transaction SQL'i, gerçek migration ve HTTP bellek-store
testleri doğrulandı. Gerçek telefon/tablet görsel incelemesi yapılmadı.

---

## Phase 4 teslimi

### Veri modeli ve migration

- Additive migration: `20260812114500_phase_4_realtime_kitchen`.
- Yeni enum: `OrderItemStatus` (`SENT`, `PREPARING`, `READY`, `SERVED`).
- `OrderItem.preparationAreaSnapshot` ve `preparationStatus` alanları eklendi.
- Mevcut Phase 3 kalemlerinin istasyonu bağlı ürünün alanından güvenli şekilde
  backfill edilir; tablo/sütun/veri silme yoktur.
- Migration gerçek `CafeAdisyon` veritabanına uygulandı; dört migration güncel,
  `SELECT 1` başarılı ve Phase 4 alanları gerçek Prisma sorgusuyla okundu.

### Backend ve realtime

- Socket.IO Express ile aynı HTTP server üzerinde ve aynı HttpOnly cookie
  session'ıyla çalışır; oturumsuz bağlantılar reddedilir, token loglanmaz.
- Hazırlık listesi `KITCHEN`/`BAR` filtresiyle yalnız açık, iptal edilmemiş ve
  servis edilmemiş kalemleri döndürür.
- Yalnız sıralı `SENT → PREPARING → READY → SERVED` geçişi kabul edilir;
  iptal edilmiş kalem ve atlanan/geri geçişler `409` alır.
- Ekleme, adet/not değişimi, iptal ve hazırlık durumu değişimlerinde küçük
  invalidation event'leri yayınlanır. Hazırlık geçişleri actor ile audit'e yazılır.

### Frontend

- `/mutfak` Mutfak/Bar/Tümü filtreli gerçek operasyon ekranıdır; Yeni,
  Hazırlanıyor ve Hazır sütunlarında masa, ürün, adet, seçenek, not, istasyon ve
  bekleme süresi gösterilir.
- Hazırlamaya başla, Hazır ve Servis edildi aksiyonları backend durum ucuna gider.
- Socket.IO otomatik reconnect eder; ilk bağlantı, reconnect ve event sonrasında
  mutfak, masa planı ve açık adisyon TanStack Query cache'leri REST'ten yenilenir.
- Vite `/socket.io` websocket proxy'si ve `0.0.0.0` geliştirme/preview erişimi
  telefon/tablet kullanımını destekler.

### Kalite kanıtı

| Komut                       | Sonuç                                      |
| --------------------------- | ------------------------------------------ |
| `npm run lint`              | PASS — 0 hata, 0 uyarı                     |
| `npm run typecheck`         | PASS — contracts + api + web               |
| `npm run test`              | PASS — 150/150 (API 110, web 40)           |
| `npm run build`             | PASS — web JS 346.95 kB, gzip 103.98 kB    |
| `npm run verify`            | PASS — lint → typecheck → test → build     |
| `npm run db:check`          | PASS — PostgreSQL `SELECT 1`               |
| `npm run db:migrate:status` | PASS — 4 migration, schema up to date      |
| Production runtime         | PASS — health/DB/root 200, `0.0.0.0:3104` |

Phase 4 için 7 backend ve 4 frontend testi eklendi; Socket auth, event, filtre,
geçiş, iptal koruması, audit ve reconnect/refetch davranışları kapsandı.

### Bilinen riskler

1. Yerel veritabanında sipariş kalemi bulunmadığından backfill sorgusunun dolu
   veri üzerindeki sonucu gözlenemedi; migration SQL'i ürün istasyonunu koruyacak
   şekilde incelendi ve boş şemada başarıyla uygulandı.
2. Responsive düzen kod/test ile doğrulandı; gerçek telefon/tablet üzerinde
   görsel inceleme yapılmadı.

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

## Sonraki iş — kapsamlı final review

Tüm geliştirme phase'leri tamamlandı. Yeni Phase başlatılmamalı; sıradaki çalışma
branch zinciri, production güvenliği, gerçek veri senaryoları ve uçtan uca kullanıcı
akışlarını kapsayan tek kapsamlı final review olmalıdır.

**Merge yapılmadı. Yeni Phase başlatılmadı.**

---

## Devir geçmişi

| Tarih      | Phase   | Devreden | Devralan | Not                                                       |
| ---------- | ------- | -------- | -------- | --------------------------------------------------------- |
| 2026-08-12 | Phase 0 | Claude   | Codex    | Proje temeli tamamlandı.                                  |
| 2026-08-12 | Phase 1 | Codex    | Claude   | Kimlik, personel, salon ve masa tamamlandı.               |
| 2026-08-12 | Phase 2 | Claude   | Codex    | Menü, ürün, seçenek ve ekstra yönetimi tamamlandı.        |
| 2026-08-12 | Phase 3 | Codex    | Codex    | Masa açma, adisyon ve sipariş tamamlandı; Phase 4 sırada. |
| 2026-08-12 | Phase 4 | Codex    | Codex    | Realtime mutfak/bar tamamlandı; Phase 5 sırada.           |
| 2026-08-12 | Phase 5 | Codex    | Codex    | Ödeme ve hesap kapatma tamamlandı; Phase 6 sırada.         |
| 2026-08-12 | Phase 6 | Codex    | Codex    | Cari, indirim/ikram ve masa işlemleri tamamlandı; Phase 7 sırada. |
| 2026-08-12 | Phase 7 | Codex    | Final reviewer | Raporlar ve production hazırlığı tamamlandı; kapsamlı final review bekleniyor. |
