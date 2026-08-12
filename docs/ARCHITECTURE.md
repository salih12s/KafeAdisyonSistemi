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
│   │   │   ├── errors/app-error.ts  AppError, NotFoundError, ValidationError
│   │   │   ├── lib/
│   │   │   │   ├── database.ts      Prisma client yönetimi + DatabaseProbe
│   │   │   │   └── logger.ts        seviye tabanlı kayıt tutucu
│   │   │   ├── middleware/          error-handler, not-found, request-logger
│   │   │   ├── routes/              health ve /api toplayıcısı
│   │   │   └── scripts/check-database.ts
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
│           ├── config/              navigation, app-info, router
│           ├── hooks/use-health.ts
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
createApp({ env, logger, database, webDistPath? })
```

`database` bir `DatabaseProbe`'dur (`ping(): Promise<boolean>`). Testlerde
gerçek PostgreSQL yerine sahte bir sonda verilir; test paketi veritabanına
ihtiyaç duymaz.

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
- **Sunucu durumu:** TanStack Query; sağlık durumu 30 saniyede bir tazelenir.
- **Stil:** Tailwind CSS v4. Tasarım belirteçleri `src/styles/index.css` içinde
  `@theme` bloğundadır; ayrı `tailwind.config` dosyası yoktur.
- **İkonlar:** lucide-react.
- **Ağ katmanı:** `src/lib/api.ts`. Yalnızca göreli `/api` yolları kullanılır.
  Gelen gövde `as` ile zorlanmaz; `isHealthResponse` tip koruyucusuyla doğrulanır.

Yerleşim: masaüstünde sabit sol menü + kompakt üst bar + içerik;
mobilde alt navigasyon ve tüm modülleri listeleyen çekmece.
Ayrıntı: [UI_GUIDE.md](UI_GUIDE.md).

---

## 6. packages/contracts

Web ve API'nin paylaştığı tipler, sabitler ve saf yardımcılar. İçinde ağ
çağrısı, React veya Express bağımlılığı **bulunmaz**.

İçerik: `API_PREFIX`, `HEALTH_ENDPOINT`, `HealthResponse`, `isHealthResponse`,
`API_ERROR_CODES`, `ApiErrorResponse`, `LOCALE`, `CURRENCY`, `TIME_ZONE`,
`Kurus`, `formatKurus`, `liraToKurus`.

### Çift biçimli derleme (ADR-012)

| Çıktı | Kim kullanır | Neden |
| --- | --- | --- |
| `dist/cjs` | Node.js / Express (`require`) | API CommonJS'tir |
| `dist/esm` | Vite / Rollup (`import`) | Paketleyici `export *` zincirini CJS üzerinden çözemez |

> **Kural:** `packages/contracts/src` içindeki **göreli içe aktarımlar `.js`
> uzantısı taşımak zorundadır** (`from './common.js'`). Uzantı unutulursa ESM
> çıktısı geçersiz olur ve `npm run build` kırılır.

---

## 7. Environment değişkenleri

`apps/api/.env` (commit edilmez):

| Değişken | Zorunlu | Varsayılan | Açıklama |
| --- | --- | --- | --- |
| `DATABASE_URL` | **Evet** | — | `postgresql://...` |
| `NODE_ENV` | Hayır | `development` | `development` \| `test` \| `production` |
| `PORT` | Hayır | `3000` | API portu; production'da arayüz de buradan sunulur |
| `HOST` | Hayır | dev `127.0.0.1`, prod `0.0.0.0` | Dinlenecek arayüz |
| `LOG_LEVEL` | Hayır | `info` | `debug` \| `info` \| `warn` \| `error` |
| `JSON_BODY_LIMIT` | Hayır | `1mb` | JSON gövde üst sınırı |

Doğrulama `zod` ile uygulama açılmadan yapılır. Değer eksik veya hatalıysa
sunucu stack trace yerine hangi değişkenin neden geçersiz olduğunu yazar ve
1 koduyla çıkar. `CHANGE_ME` içeren bir `DATABASE_URL` de reddedilir.

Şablonlar: `apps/api/.env.example`, `apps/api/.env.test.example`.
Oluşturmak için: `npm run setup:env`.

---

## 8. API sınırları

- Tüm REST uçları `/api` altındadır; başka ön ek kullanılmaz.
- İstemci hiçbir zaman veritabanına doğrudan erişmez.
- İş kuralları (fiyat hesabı, indirim sınırı, yetki kontrolü) **sunucuda**
  uygulanır. Arayüzdeki kontroller yalnızca kullanıcı deneyimi içindir.
- Paylaşılan tipler `packages/contracts` üzerinden gider; API tipleri arayüz
  koduna elle kopyalanmaz.

---

## 9. Güvenlik ve veri bütünlüğü ilkeleri

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
