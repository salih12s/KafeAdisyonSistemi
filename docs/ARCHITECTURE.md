# Mimari

Kafe Adisyon Sistemi'nin teknik yapısı. Kararların gerekçeleri için bkz.
[../DECISIONS.md](../DECISIONS.md).

---

## 1. Genel görünüm

```
                    KASA BİLGİSAYARI (Windows)
   ┌──────────────────────────────────────────────────────────┐
   │                                                          │
   │   Express (Node.js)  :3000                               │
   │   ├── /api/*      → REST uçları                          │
   │   └── /*          → apps/web/dist (React derlemesi)      │
   │                          │                               │
   │                          │ Prisma                        │
   │                          ▼                               │
   │   PostgreSQL :5432  ·  veritabanı: CafeAdisyon           │
   │                                                          │
   └──────────────────────────┬───────────────────────────────┘
                              │ yerel ağ (Wi-Fi / Ethernet)
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
      Telefon              Tablet          Diğer bilgisayar
   http://<KASA_IP>:3000  (tarayıcı üzerinden, kurulum yok)
```

Uygulama buluta bağlanmaz. Kasa bilgisayarı kapalıysa sistem çalışmaz;
bu bilinçli bir karardır (ADR-001).

---

## 2. Depo yapısı

```
/
├── apps/
│   ├── api/                 Express + TypeScript sunucusu
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── app.ts               createApp() — dinlemez, test edilebilir
│   │   │   ├── server.ts            listen + graceful shutdown
│   │   │   ├── config/
│   │   │   │   ├── env.ts           zod ile ortam doğrulama
│   │   │   │   └── paths.ts         .env ve web/dist yolları
│   │   │   ├── errors/app-error.ts  AppError, NotFoundError, ValidationError
│   │   │   ├── lib/
│   │   │   │   ├── database.ts      Prisma yaşam döngüsü + DatabaseProbe
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
├── packages/
│   └── contracts/           Web ve API'nin paylaştığı tipler ve sabitler
│
├── docs/
├── scripts/                 set-local-env (.ps1 / .bat)
└── kök belgeler             AGENTS, CLAUDE, WORKFLOW, HANDOFF, SESSION_LOG,
                             DECISIONS, README
```

---

## 3. apps/api

### 3.1 App / server ayrımı

`createApp(deps)` yalnızca Express uygulamasını kurar ve döndürür; port
açmaz. `server.ts` ortamı okur, bağımlılıkları üretir, `createApp` çağırır ve
`listen` eder. Bu ayrım sayesinde testler gerçek bir port açmadan HTTP
isteği sürebilir.

Bağımlılıklar dışarıdan verilir:

```ts
createApp({ env, logger, database, webDistPath? })
```

`database` bir `DatabaseProbe`'dur (`ping(): Promise<boolean>`). Testlerde
gerçek PostgreSQL yerine sahte bir sonda verilir; bu yüzden test paketi
veritabanına ihtiyaç duymaz.

### 3.2 Middleware sırası

1. `helmet` — güvenlik başlıkları
2. `express.json({ limit })` ve `express.urlencoded`
3. istek kaydı (yalnızca `development`)
4. `/api` yönlendiricisi
5. `/api` için 404 → **her zaman JSON**
6. statik dosyalar + SPA fallback (yalnızca üretimde)
7. genel 404
8. merkezî hata yönetimi

Sıra önemlidir: `/api` 404'ü statik dosyalardan **önce** gelir, böylece
tanımsız bir API ucu HTML yerine JSON döner.

### 3.3 Hata yönetimi

Tüm hatalar tek bir yerde normalize edilir ve sabit gövdeyle döner:

```json
{ "error": { "code": "NOT_FOUND", "message": "...", "details": ["..."] } }
```

- `AppError` ve türevleri kendi durum kodu ve hata kodunu taşır.
- Bozuk JSON → `400 VALIDATION_ERROR`
- Gövde sınırı aşımı → `413 PAYLOAD_TOO_LARGE`
- Bilinmeyen hata → `500 INTERNAL_ERROR`
- **Stack trace hiçbir ortamda istemciye gönderilmez.** Üretimde hata mesajı
  da gizlenir; sunucu tarafında tam ayrıntı loglanır.

### 3.4 Sağlık ucu

`GET /api/health`

```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-08-12T06:09:58.867Z",
  "environment": "production"
}
```

- Veritabanı erişilebilir → HTTP 200, `status: "ok"`
- Erişilemez → HTTP 503, `status: "degraded"`, `database: "disconnected"`

Her iki durumda gövde biçimi aynıdır; arayüz durumu okuyup gösterebilir.
Bağlantı denemesi yalnızca `SELECT 1`'dir — hiçbir veri değiştirilmez.

### 3.5 Graceful shutdown

`SIGINT` / `SIGTERM` alındığında:

1. Yeni bağlantılar durdurulur (`server.close`)
2. Prisma bağlantısı kapatılır (`$disconnect`)
3. Süreç 0 ile çıkar

10 saniye içinde tamamlanmazsa süreç zorla sonlandırılır; asılı kalmaz.

---

## 4. apps/web

- **Yönlendirme:** React Router. Rotalar `App.tsx` içinde, gezinme öğeleri
  `src/config/navigation.ts` içinde tek kaynaktan tanımlıdır.
- **Sunucu durumu:** TanStack Query. Sağlık durumu 30 saniyede bir tazelenir.
- **Stil:** Tailwind CSS v4. Tasarım belirteçleri `src/styles/index.css`
  içinde `@theme` bloğunda tanımlıdır; ayrı bir `tailwind.config` dosyası yoktur.
- **İkonlar:** lucide-react.
- **Ağ katmanı:** `src/lib/api.ts`. Gelen gövde `as` ile zorlanmaz;
  `isHealthResponse` gibi tip koruyucularla doğrulanır.

Yerleşim: masaüstünde sabit sol kenar çubuğu + üst çubuk + içerik;
telefonda alt gezinme çubuğu ve tüm modülleri listeleyen çekmece.
Ayrıntı: [UI_GUIDE.md](UI_GUIDE.md).

---

## 5. packages/contracts

Web ve API'nin paylaştığı tipler, sabitler ve saf yardımcı fonksiyonlar.
İçinde ağ çağrısı, React veya Express bağımlılığı **bulunmaz**.

İçerik: `API_PREFIX`, `HEALTH_ENDPOINT`, `HealthResponse`,
`isHealthResponse`, `API_ERROR_CODES`, `ApiErrorResponse`, `LOCALE`,
`CURRENCY`, `TIME_ZONE`, `Kurus`, `formatKurus`, `liraToKurus`.

### Çift biçimli derleme

Paket iki çıktı üretir:

| Çıktı | Kim kullanır | Neden |
| --- | --- | --- |
| `dist/cjs` | Node.js / Express (`require`) | API CommonJS'tir |
| `dist/esm` | Vite / Rollup (`import`) | Paketleyici `export *` zincirini CJS üzerinden çözemez |

> **Kural:** `packages/contracts/src` içindeki **göreli içe aktarımlar
> `.js` uzantısı taşımak zorundadır** (`from './common.js'`). Uzantı
> unutulursa ESM çıktısı geçersiz olur ve `npm run build` kırılır.

---

## 6. Geliştirme ortamı

```bash
npm run dev
```

| Süreç | Adres | Not |
| --- | --- | --- |
| Express API | `http://0.0.0.0:3000` | `tsx watch` ile yeniden başlar |
| Vite dev sunucusu | `http://0.0.0.0:5173` | HMR |

Vite, `/api` ile başlayan istekleri Express'e proxy'ler. Böylece arayüz kodu
geliştirmede de üretimde de aynı göreli yolu (`/api/health`) kullanır;
CORS'a hiç ihtiyaç duyulmaz.

Proxy hedefi `VITE_API_PROXY_TARGET` ortam değişkeniyle değiştirilebilir;
varsayılan `http://127.0.0.1:3000`.

---

## 7. Üretim ortamı

```bash
npm run build
npm start
```

- `npm run build`: contracts → api (tsc) → web (vite build)
- `npm start`: `NODE_ENV=production` ile `apps/api/dist/server.js`
- Express hem `/api/*` uçlarını hem `apps/web/dist` içeriğini sunar
- Tek adres: `http://<KASA_IP>:3000`

React Router istemci tarafında çalıştığı için `/masalar` gibi doğrudan
açılan adresler `index.html`'e düşürülür ve uygulama içinden çözülür.

---

## 8. Yerel ağ bağlantısı

- Sunucu `HOST=0.0.0.0` ile dinler; yalnızca `localhost` değil, kasa
  bilgisayarının tüm ağ arayüzleri üzerinden erişilebilir.
- Başlangıçta kullanılabilir IPv4 adresleri loglanır.
- Cihazlar tarayıcıdan `http://<KASA_IP>:3000` adresini açar; kurulum yoktur.
- Windows Güvenlik Duvarı'nda 3000 portuna **özel ağ (private network)** izni
  gerekir. Genel ağ profiline izin verilmemelidir.
- Kasa bilgisayarına **sabit yerel IP** verilmesi önerilir; aksi hâlde DHCP
  adresi değiştiğinde tüm cihazların adresi değişir.

---

## 9. Ortam değişkenleri

`apps/api/.env` (commit edilmez):

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `3000` | API portu; üretimde arayüz de buradan sunulur |
| `HOST` | `0.0.0.0` | `127.0.0.1` yaparsanız yerel ağ erişimi kapanır |
| `DATABASE_URL` | — | **Zorunlu.** `postgresql://...` |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `JSON_BODY_LIMIT` | `1mb` | JSON gövde üst sınırı |

Doğrulama `zod` ile uygulama açılmadan yapılır. Değer eksik veya hatalıysa
sunucu stack trace yerine hangi değişkenin neden geçersiz olduğunu yazar ve
1 koduyla çıkar. `CHANGE_ME` içeren bir `DATABASE_URL` de reddedilir.

Şablonlar: `apps/api/.env.example`, `apps/api/.env.test.example`.
Oluşturmak için: `npm run setup:env`.

---

## 10. API sınırları

- Tüm REST uçları `/api` altındadır; başka bir ön ek kullanılmaz.
- İstemci hiçbir zaman veritabanına doğrudan erişmez.
- İş kuralları (fiyat hesabı, indirim sınırı, yetki kontrolü) **sunucuda**
  uygulanır. Arayüzdeki kontroller yalnızca kullanıcı deneyimi içindir.
- Paylaşılan tipler `packages/contracts` üzerinden gider; API tipleri
  arayüz koduna elle kopyalanmaz.

---

## 11. Güvenlik ve veri bütünlüğü ilkeleri

- **Gizli bilgi:** `.env` commit edilmez; şablonlarda yalnızca `CHANGE_ME`
  bulunur (bkz. [../AGENTS.md](../AGENTS.md) §8).
- **Başlıklar:** `helmet`; `x-powered-by` kapalı.
- **Gövde sınırı:** JSON istekleri `JSON_BODY_LIMIT` ile sınırlıdır.
- **Hata sızıntısı:** stack trace istemciye gitmez.
- **Tek origin:** üretimde CORS yüzeyi yoktur.
- **Veri kaybı:** destructive veritabanı işlemleri yasaktır; domain kayıtları
  silinmez, iptal/pasif alanlarıyla yönetilir (ADR-010).
- **Para bütünlüğü:** tam sayı kuruş; `Float` kullanılmaz (ADR-007).
- **Zaman bütünlüğü:** UTC saklanır, `Europe/Istanbul` gösterilir (ADR-008).
- **Ağ yüzeyi:** uygulama yalnızca yerel ağa açılır; internete açık port
  yönlendirmesi yapılmamalıdır.
