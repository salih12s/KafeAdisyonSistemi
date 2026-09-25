# Mimari

Kararların gerekçeleri için bkz. [../DECISIONS.md](../DECISIONS.md).

---

## 1. Local geliştirme (şu anki durum)

```
   ┌──────────────── Geliştirme bilgisayarı ────────────────┐
   │                                                        │
   │   Vite dev sunucusu  http://localhost:5173             │
   │        │                                               │
   │        │  /api/*  → proxy                              │
   │        ▼                                               │
   │   Express (tsx watch)  http://localhost:3000           │
   │        │                                               │
   │        │  Prisma                                       │
   │        ▼                                               │
   │   PostgreSQL  localhost:5432 / CafeAdisyon             │
   │                                                        │
   └────────────────────────────────────────────────────────┘
```

Vite, `/api` ile başlayan istekleri Express'e iletir. Böylece arayüz kodu
geliştirmede de production'da da aynı **göreli** yolu (`/api/health`) kullanır;
API adresi hiçbir yerde hardcode edilmez ve CORS'a gerek kalmaz.

---

## 2. Production yapısı (ADR-002)

```
   Custom domain
        │
        ▼
   Railway Node.js servisi
   ├── Express API          → /api/*
   └── React production build → /* (apps/web/dist)
        │
        ▼
   Railway PostgreSQL
```

Tek servis, tek origin. Express hem API uçlarını hem statik dosyaları sunar.

`railway.json` build, migration pre-deploy, start ve health check komutlarını
tanımlar. `PORT` ve `DATABASE_URL` environment'tan okunur; production'da sunucu
`0.0.0.0` üzerinde dinler. Ayrıntılı kurulum ve backup/restore adımları README'dedir.

---

## 3. Depo yapısı ve kod haritası

Kod **alana (feature/module) göre** düzenlenir: bir iş alanının (kasa, stok,
menü, adisyon…) arayüz ekranı, bileşenleri ve API çağrıları tek klasörde; API
tarafında router'ı, store arayüzü, Prisma uygulaması ve hesaplamaları tek
klasörde durur. Ortak parçalar `shared/`, uygulama iskeleti `app/` altındadır.
Testler kaynak koddan ayrı `tests/` klasöründe, yine alana göre gruplanır.

### 3.1 Kök

```
/
├── apps/
│   ├── api/                  Express + Prisma sunucusu (bkz. 3.2)
│   └── web/                  React + Vite arayüzü (bkz. 3.3)
├── packages/contracts/       Web ve API'nin paylaştığı tipler, sabitler, saf yardımcılar
├── docs/                     Mimari, ürün kapsamı, UI rehberi, phase planı
├── scripts/                  set-local-env / set-production-env, qa/ kabul betikleri
└── kök belgeler              AGENTS, CLAUDE, HANDOFF, DECISIONS, WORKFLOW,
                              SESSION_LOG, README
```

### 3.2 apps/api

```
apps/api/
├── prisma/
│   ├── schema.prisma         Veri modeli (tek kaynak)
│   └── migrations/           İncelenmiş, yalnız ekleme yapan migration'lar
├── src/
│   ├── server.ts             Ortamı okur, store'u kurar, dinler; kapanışı yönetir
│   ├── app.ts                createApp(): middleware sırası, /api, statik dosyalar
│   ├── config/               env.ts (zod doğrulaması), paths.ts
│   ├── errors/               AppError türleri ve HTTP eşlemesi
│   ├── lib/                  database.ts (Prisma client, sağlık sondası), logger.ts
│   ├── middleware/           cors (CSRF dahil), error-handler, not-found, request-logger
│   ├── routes/
│   │   ├── index.ts          ★ Tüm modül router'larının bağlandığı yer
│   │   └── health.ts         GET /api/health
│   ├── shared/
│   │   ├── http.ts           parse, callStore, requireAuthentication, requirePermission
│   │   ├── schemas.ts        Birden çok router'ın kullandığı zod şemaları
│   │   ├── store.ts          ★ AppStore = tüm modül store'larının birleşimi, StoreError
│   │   ├── prisma-store.ts   Üretim store'u: modüllerin Prisma uygulamalarını birleştirir
│   │   └── prisma-errors.ts  P2002/P2025/P2034 kontrolleri
│   ├── modules/              ★ İş alanları — her biri aynı kalıpta
│   │   ├── identity/         Giriş/oturum, personel, işletme, roller ve yetkiler
│   │   ├── floor/            Salon, masa, yönetim masa planı
│   │   ├── menu/             Kategori, ürün, seçenek grupları
│   │   ├── orders/           Adisyon, kalem, ödeme, hesap bölme, mutfak akışı,
│   │   │                     Socket.IO (order-realtime.ts, order-events.ts)
│   │   ├── accounts/         Cari müşteri ve cari hareketler
│   │   ├── reports/          Satış raporu, gün sonu, işlem geçmişi
│   │   ├── cash/             Kasa oturumu (vardiya)
│   │   ├── stock/            Stok kalemi, reçete, stok hareketi
│   │   └── public-menu/      Oturumsuz QR menü ucu
│   ├── scripts/              db:check, setup:owner
│   └── types/                Express Request genişletmesi (req.auth)
└── tests/
    ├── helpers/              Bellek içi store'lar, test uygulaması, ortak kurulumlar
    ├── app/                  Sağlık, 404, hata yönetimi, env, CORS/CSRF, production
    └── <modül>/              identity, menu, orders, accounts, reports, cash, stock,
                              public-menu — modül klasörleriyle aynı adlar
```

Her modül klasörü aynı dosya kalıbını izler; bir modülü açan kişi nereye
bakacağını bilir:

| Dosya                     | Görevi                                                             |
| ------------------------- | ------------------------------------------------------------------ |
| `<modül>-routes.ts`       | HTTP uçları: zod ile doğrulama, yetki kontrolü, store çağrısı      |
| `<modül>-store.ts`        | Store **arayüzü** ve giriş tipleri (veritabanından bağımsız)       |
| `prisma-<modül>-store.ts` | Arayüzün Prisma uygulaması: transaction, kilit, audit kaydı        |
| `<modül>-calculations.ts` | Saf iş kuralları (para, stok, rapor); hem Prisma hem test kullanır |

Testlerde gerçek veritabanı kullanılmaz: `tests/helpers/memory-*.ts` aynı
arayüzleri bellekte uygular ve aynı `*-calculations.ts` fonksiyonlarını çağırır.

### 3.3 apps/web

```
apps/web/
├── index.html                Başlık, PWA manifest ve ikon bağlantıları
├── public/                   favicon, manifest.webmanifest, icons/
├── vite.config.ts            Dev proxy (/api, /socket.io) ve vitest ayarı
├── src/
│   ├── main.tsx              React kökü: QueryClient, Router, stiller
│   ├── styles/index.css      Tailwind tasarım belirteçleri, yazdırma stilleri
│   ├── app/                  Uygulama iskeleti
│   │   ├── app.tsx           ★ Tüm rotalar ve rol korumaları
│   │   ├── navigation.ts     Menü öğeleri ve hangi rolün neyi göreceği
│   │   ├── query-client.ts   TanStack Query ayarı, oturum düşünce temizlik
│   │   ├── layout/           Kenar çubuğu, üst bar, mobil alt gezinme
│   │   └── pages/            Yetkisiz ve bulunamadı sayfaları
│   ├── shared/               Alan bilmeyen ortak parçalar
│   │   ├── api/http.ts       ★ requestPayload, ApiError, yanıt doğrulama yardımcıları
│   │   ├── ui/               Button, Panel, Dialog, FormDialog, TextField, Badge…
│   │   ├── lib/              cn, datetime (Europe/Istanbul), money-input, error-message
│   │   ├── config/           app-info (marka), api-base (API adresi)
│   │   └── health/           Sunucu sağlık sorgusu ve göstergesi
│   └── features/             ★ İş alanları — her biri aynı kalıpta
│       ├── auth/             Giriş sayfası, oturum hook'u, rol koruması
│       ├── dashboard/        Özet ekranı
│       ├── tables/           Masa planı ekranı
│       ├── orders/           Adisyon ekranı, ürün seçimi, kalem satırı, realtime
│       ├── payments/         Ödeme ve hesap bölme paneli
│       ├── menu/             Menü yönetimi
│       ├── kitchen/          Mutfak/bar ekranı
│       ├── accounts/         Cariler
│       ├── reports/          Raporlar ve günlük ciro grafiği
│       ├── cash/             Kasa
│       ├── stock/            Stok ve reçeteler
│       ├── settings/         Personel, salon/masa, yazıcı/QR, işlem geçmişi
│       ├── printing/         Fiş yazdırma altyapısı ve fiş şablonları
│       └── qr-menu/          Oturumsuz QR menü sayfası ve QR kod çizimi
└── tests/
    ├── setup.ts              jest-dom ve temizlik
    ├── helpers/render.tsx    renderWithProviders, API isteklerini taklit eden stubAppFetch
    └── <alan>/               app, auth, orders, menu, kitchen, accounts, reports,
                              cash, stock, settings, qr-menu
```

Her `features/<alan>/` klasörünün kalıbı:

| Yol            | Görevi                                                             |
| -------------- | ------------------------------------------------------------------ |
| `api.ts`       | O alanın sunucu çağrıları ve yanıt tip koruyucuları                |
| `pages/`       | Rotaya bağlanan ekran bileşeni (`app/app.tsx` buradan içe aktarır) |
| `components/`  | Yalnız bu alanda kullanılan bileşenler                             |
| `hooks/`       | Bu alanın React hook'ları                                          |
| `*.ts` (kökte) | Bileşen olmayan sabitler ve biçimlendirme (ör. `cash-format.ts`)   |

Kural: bir alan başka bir alanın `api.ts`'sini veya bileşenini kullanabilir
(ör. `tables` → `orders`), ancak `shared/` hiçbir alana bağımlı olmaz.

### 3.4 Bir isteğin yolculuğu (örnek: kasayı kapatma)

```
features/cash/components/close-form.tsx      Kullanıcı sayılan tutarı girer
  → features/cash/api.ts  closeCashSession()  POST /api/cash/current/close
    → shared/api/http.ts  requestPayload()    fetch + hata/401 yönetimi
      → apps/api/src/app.ts                   helmet, CORS/CSRF, JSON gövde
        → routes/index.ts                     /cash → modules/cash/cash-routes.ts
          → cash-routes.ts                    zod doğrulaması, MANAGE_CASH yetkisi
            → shared/store.ts (AppStore)      closeCashSession()
              → modules/cash/prisma-cash-store.ts   kilit + transaction + audit
                → cash-calculations.ts        beklenen nakit ve fark
  ← features/cash/api.ts isCashSession()      yanıt tipi çalışma zamanında doğrulanır
```

### 3.5 Yeni bir özellik eklerken

1. **Sözleşme:** yanıt/istek tipleri `packages/contracts/src/<alan>.ts`.
2. **Veri modeli** gerekiyorsa `apps/api/prisma/schema.prisma` ve yeni bir
   additive migration (AGENTS.md §9: önce kullanıcı onayı).
3. **API modülü:** `apps/api/src/modules/<alan>/` altında store arayüzü, Prisma
   uygulaması, hesaplamalar ve router; store'u `shared/store.ts` ve
   `shared/prisma-store.ts` içine, router'ı `routes/index.ts` içine ekleyin.
   Test için `tests/helpers/memory-*.ts` uygulamasını genişletin.
4. **Web alanı:** `apps/web/src/features/<alan>/` altında `api.ts`, `pages/`,
   `components/`; rotayı `app/app.tsx`, menü öğesini `app/navigation.ts` içine
   ekleyin.
5. **Testler:** `apps/api/tests/<alan>/` ve `apps/web/tests/<alan>/`.

---

## 4. apps/api

### 4.1 App / server ayrımı

`createApp(deps)` yalnızca Express uygulamasını kurar ve döndürür; port açmaz.
`server.ts` environment'ı okur, bağımlılıkları üretir, `createApp` çağırır ve
`listen` eder. Bu ayrım sayesinde testler gerçek port açmadan HTTP isteği sürer.

```ts
createApp({ env, logger, database, store?, webDistPath? })
```

`database` bir `DatabaseProbe`'dur (`ping(): Promise<boolean>`). `store`, Phase 1
iş kurallarına özgü veri erişim sınırıdır ve production'da Prisma ile uygulanır.
Testlerde her ikisi de bellek içi karşılıklarıyla değiştirilir; varsayılan test
paketi gerçek PostgreSQL'i değiştirmez.

### 4.2 Middleware sırası

1. `helmet`
2. CORS/CSRF katmanı (yalnız `CORS_ORIGIN` doluysa; ADR-020)
3. `express.json({ limit })` — form gövdesi (urlencoded) bilinçli olarak ayrıştırılmaz
4. istek kaydı (yalnızca `development`)
5. `/api` yönlendiricisi (`routes/index.ts`)
6. `/api` için 404 → **her zaman JSON**
7. statik dosyalar + SPA fallback (yalnızca production)
8. genel 404
9. merkezî hata yönetimi

Sıra önemlidir: `/api` 404'ü statik dosyalardan **önce** gelir, böylece
tanımsız bir API ucu HTML yerine JSON döner.

### 4.3 Hata yönetimi

Tüm hatalar tek yerde normalize edilir ve sabit gövdeyle döner:

```json
{ "error": { "code": "NOT_FOUND", "message": "...", "details": ["..."] } }
```

- `AppError` ve türevleri kendi durum kodu ve hata kodunu taşır
- Bozuk JSON → `400 VALIDATION_ERROR`
- Gövde sınırı aşımı → `413 PAYLOAD_TOO_LARGE`
- Bilinmeyen hata → `500 INTERNAL_ERROR`
- **Stack trace hiçbir ortamda istemciye gönderilmez.** Production'da hata
  mesajı da gizlenir; sunucu tarafında tam ayrıntı loglanır.

### 4.4 Sağlık ucu

`GET /api/health`

```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-08-12T06:35:16.229Z"
}
```

- Veritabanı erişilebilir → HTTP 200, `status: "ok"`
- Erişilemez → HTTP 503, `status: "degraded"`, `database: "disconnected"`

Gövde biçimi her iki durumda aynıdır. Bağlantı denemesi yalnızca `SELECT 1`'dir;
hiçbir veri değiştirilmez.

### 4.5 Graceful shutdown

`SIGINT` / `SIGTERM` alındığında: yeni bağlantılar durdurulur (`server.close`),
Prisma bağlantısı kapatılır (`$disconnect`), süreç 0 ile çıkar. 10 saniyede
tamamlanmazsa süreç zorla sonlandırılır; asılı kalmaz.

---

## 5. apps/web

- **Yönlendirme:** React Router. Rotalar `src/app/app.tsx`, gezinme öğeleri
  `src/app/navigation.ts` içinde tek kaynaktan tanımlıdır. Rol koruması tek
  bileşendir: `RoleRoute` (`features/auth/components/protected-route.tsx`).
- **Kimlik:** HttpOnly `kafe_session` cookie tarayıcı tarafından gönderilir;
  arayüz oturum bilgisini `GET /api/auth/me` ile alır. `/ayarlar` hem route hem
  API katmanında yalnız işletme sahibine açıktır.
- **Sunucu durumu:** TanStack Query; sağlık durumu 30 saniyede bir tazelenir.
- **Stil:** Tailwind CSS v4. Tasarım belirteçleri `src/styles/index.css` içinde
  `@theme` bloğundadır; ayrı `tailwind.config` dosyası yoktur.
- **İkonlar:** lucide-react.
- **Ağ katmanı:** `src/shared/api/http.ts` ortak istek altyapısı; her alanın
  çağrıları `src/features/<alan>/api.ts` içindedir. Varsayılan kurulumda göreli
  `/api` yolları kullanılır. Gelen gövdeler çalışma zamanında tip koruyucularıyla
  doğrulanır.

Yerleşim: masaüstünde sabit sol menü + kompakt üst bar + içerik;
mobilde alt navigasyon ve tüm modülleri listeleyen çekmece.
Ayrıntı: [UI_GUIDE.md](UI_GUIDE.md).

---

## 6. packages/contracts

Web ve API'nin paylaştığı tipler, sabitler ve saf yardımcılar. İçinde ağ
çağrısı, React veya Express bağımlılığı **bulunmaz**.

İçerik: API/health sözleşmeleri, hata kodları, locale/para/zaman sabitleri,
Phase 1 kullanıcı rolleri, merkezi permission adları ve güvenli response tipleri.

### Çift biçimli derleme (ADR-012)

| Çıktı      | Kim kullanır                  | Neden                                                  |
| ---------- | ----------------------------- | ------------------------------------------------------ |
| `dist/cjs` | Node.js / Express (`require`) | API CommonJS'tir                                       |
| `dist/esm` | Vite / Rollup (`import`)      | Paketleyici `export *` zincirini CJS üzerinden çözemez |

> **Kural:** `packages/contracts/src` içindeki **göreli içe aktarımlar `.js`
> uzantısı taşımak zorundadır** (`from './common.js'`). Uzantı unutulursa ESM
> çıktısı geçersiz olur ve `npm run build` kırılır.

---

## 7. Phase 1 kimlik ve veri modeli

- `User`: normalize edilmiş unique kullanıcı adı, bcrypt hash, sabit rol ve
  aktif/pasif yaşam döngüsü.
- `Session`: tarayıcıdaki ham token'ın yalnız SHA-256 hash'i, 12 saatlik bitiş
  zamanı ve son görülme zamanı. Şifre değişimi veya pasife alma gerekli
  session'ları iptal eder.
- `BusinessSettings`: sabit `business` kimlikli tek işletme kaydı.
- `DiningArea` / `CafeTable`: fiziksel silme olmadan aktiflik ve sıra değeri;
  normalize edilmiş ad anahtarları duplicate kaydı engeller.
- `AuditLog`: yönetim işlemlerinin aktör ve hedef kaydı; parola veya session
  verisi metadata içine alınmaz.

Roller (`OWNER`, `CASHIER`, `WAITER`, `KITCHEN`) ve permission matrisi kodda
sabittir. Yönetim permission'ları yalnız `OWNER` rolündedir; tüm roller aktif
session ile floor plan'ı görebilir. Koruma Express middleware'inde uygulanır.

İlk owner web endpoint'iyle değil, `npm run setup:owner` interaktif terminal
komutuyla oluşturulur. Owner ve işletme kaydı tek transaction içindedir.

---

## 8. Environment değişkenleri

`apps/api/.env` (commit edilmez):

| Değişken          | Zorunlu  | Varsayılan                      | Açıklama                                           |
| ----------------- | -------- | ------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`    | **Evet** | —                               | `postgresql://...`                                 |
| `NODE_ENV`        | Hayır    | `development`                   | `development` \| `test` \| `production`            |
| `PORT`            | Hayır    | `3000`                          | API portu; production'da arayüz de buradan sunulur |
| `HOST`            | Hayır    | dev `127.0.0.1`, prod `0.0.0.0` | Dinlenecek arayüz                                  |
| `LOG_LEVEL`       | Hayır    | `info`                          | `debug` \| `info` \| `warn` \| `error`             |
| `JSON_BODY_LIMIT` | Hayır    | `1mb`                           | JSON gövde üst sınırı                              |
| `CORS_ORIGIN`     | Hayır    | boş                             | Yalnız ayrı barındırmada izinli origin listesi     |

Doğrulama `zod` ile uygulama açılmadan yapılır. Değer eksik veya hatalıysa
sunucu stack trace yerine hangi değişkenin neden geçersiz olduğunu yazar ve
1 koduyla çıkar. `CHANGE_ME` içeren bir `DATABASE_URL` de reddedilir.

Şablonlar: `apps/api/.env.example`, `apps/api/.env.test.example`.
Oluşturmak için: `npm run setup:env`.

---

## 9. API sınırları

- Tüm REST uçları `/api` altındadır; başka ön ek kullanılmaz.
- İstemci hiçbir zaman veritabanına doğrudan erişmez.
- İş kuralları (fiyat hesabı, indirim sınırı, yetki kontrolü) **sunucuda**
  uygulanır. Arayüzdeki kontroller yalnızca kullanıcı deneyimi içindir.
- Paylaşılan tipler `packages/contracts` üzerinden gider; API tipleri arayüz
  koduna elle kopyalanmaz.

---

## 10. Güvenlik ve veri bütünlüğü ilkeleri

- **Gizli bilgi:** `.env` commit edilmez; şablonlarda yalnızca `CHANGE_ME`
  bulunur (bkz. [../AGENTS.md](../AGENTS.md) §8).
- **Başlıklar:** `helmet`; `x-powered-by` kapalı.
- **Gövde sınırı:** JSON istekleri `JSON_BODY_LIMIT` ile sınırlıdır.
- **Hata sızıntısı:** stack trace istemciye gitmez.
- **Tek origin:** production'da CORS yüzeyi yoktur.
- **Veri kaybı:** destructive veritabanı işlemleri yasaktır; domain kayıtları
  silinmez (ADR-011).
- **Para bütünlüğü:** tam sayı kuruş; `Float` kullanılmaz (ADR-008).
- **Zaman bütünlüğü:** UTC saklanır, `Europe/Istanbul` gösterilir (ADR-009).

---

## 11. Phase 3 adisyon ve sipariş modeli

- `Check`: masa, açan personel, kişi sayısı, `OPEN`/`CANCELLED`, açılış zamanı ve
  sunucuda tutulan toplam. PostgreSQL koşullu unique indeksi her masada en fazla
  bir `OPEN` adisyon bulunmasını sağlar.
- `OrderItem`: ürün referansına ek olarak ürün adı/birim fiyat snapshot'ı, adet,
  not, kalem toplamı, oluşturan personel ve gerekçeli iptal alanları.
- `OrderItemOption`: seçenek grup/değer referansları ile ad ve fiyat farkı
  snapshot'ları.

Adisyon store'u `OrderStore` sınırıyla kimlik ve menü store'larından ayrılır;
production uygulaması Prisma transaction'ları, test uygulaması bellek içi store
kullanır. Tüm fiyatlar tam sayı kuruş olarak backend'de hesaplanır. İstemcinin
gönderdiği fiyat veya toplam alanları kullanılmaz. Kalem iptali fiziksel silme
yapmaz ve toplam yalnız `cancelledAt IS NULL` kalemlerden yeniden hesaplanır.
