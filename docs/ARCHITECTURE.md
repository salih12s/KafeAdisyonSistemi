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

## 2. Gelecekteki production yapısı (ADR-002)

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

> Railway'e özel yapılandırma dosyaları **bu aşamada yazılmaz** (Phase 7).
> Kod bugünden bu modele uygundur: `PORT` ve `DATABASE_URL` environment'tan
> okunur, production'da sunucu `0.0.0.0` üzerinde dinler.

---

## 3. Depo yapısı

```
/
├── apps/
│   ├── api/                 Express + TypeScript sunucusu
│   │   ├── prisma/schema.prisma
│   │   ├── src/
│   │   │   ├── app.ts               createApp() — dinlemez, test edilebilir
│   │   │   ├── server.ts            listen + graceful shutdown
│   │   │   ├── config/
│   │   │   │   ├── env.ts           zod ile environment doğrulaması
│   │   │   │   └── paths.ts         .env ve web/dist yolları
│   │   │   ├── errors/app-error.ts  Uygulama hata türleri ve HTTP eşlemesi
│   │   │   ├── features/            Kimlik, yetki ve Prisma store sınırı
│   │   │   ├── lib/
│   │   │   │   ├── database.ts      Prisma client yönetimi + DatabaseProbe
│   │   │   │   └── logger.ts        seviye tabanlı kayıt tutucu
│   │   │   ├── middleware/          error-handler, not-found, request-logger
│   │   │   ├── routes/              health ve /api toplayıcısı
│   │   │   └── scripts/             DB kontrolü ve interaktif owner kurulumu
│   │   ├── prisma/migrations/        İncelenmiş additive migration'lar
│   │   ├── tests/                   vitest + supertest
│   │   ├── .env.example
│   │   └── .env.test.example
│   │
│   └── web/                 React + Vite arayüzü
│       ├── index.html
│       ├── vite.config.ts   dev proxy + vitest yapılandırması
│       └── src/
│           ├── main.tsx             React kökü, sağlayıcılar
│           ├── App.tsx              rota tanımları
│           ├── components/          layout, ui, health-indicator
│           ├── config/              navigation ve app-info
│           ├── hooks/               auth ve health sorguları
│           ├── lib/                 api, query-client, datetime, cn
│           ├── pages/
│           ├── styles/index.css     Tailwind + tasarım belirteçleri
│           ├── test/                test yardımcıları
│           └── __tests__/
│
├── packages/contracts/      Web ve API'nin paylaştığı tipler ve sabitler
├── docs/
├── scripts/                 set-local-env (.ps1 / .bat)
└── kök belgeler             AGENTS, CLAUDE, HANDOFF, DECISIONS,
                             WORKFLOW, SESSION_LOG, README
```

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
2. `express.json({ limit })` ve `express.urlencoded`
3. istek kaydı (yalnızca `development`)
4. `/api` yönlendiricisi
5. `/api` için 404 → **her zaman JSON**
6. statik dosyalar + SPA fallback (yalnızca production)
7. genel 404
8. merkezî hata yönetimi

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

- **Yönlendirme:** React Router. Rotalar `App.tsx`, gezinme öğeleri
  `src/config/navigation.ts` içinde tek kaynaktan tanımlıdır.
- **Kimlik:** HttpOnly `kafe_session` cookie tarayıcı tarafından gönderilir;
  arayüz oturum bilgisini `GET /api/auth/me` ile alır. `/ayarlar` hem route hem
  API katmanında yalnız işletme sahibine açıktır.
- **Sunucu durumu:** TanStack Query; sağlık durumu 30 saniyede bir tazelenir.
- **Stil:** Tailwind CSS v4. Tasarım belirteçleri `src/styles/index.css` içinde
  `@theme` bloğundadır; ayrı `tailwind.config` dosyası yoktur.
- **İkonlar:** lucide-react.
- **Ağ katmanı:** `src/lib/api.ts`. Yalnızca göreli `/api` yolları kullanılır.
  Gelen gövdeler çalışma zamanında tip koruyucularıyla doğrulanır.

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
