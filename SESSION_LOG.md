# SESSION_LOG.md — Oturum kayıtları

> **Bu dosya append-only'dir.** Eski kayıtlar değiştirilmez ve silinmez.
> Her yeni oturum dosyanın **sonuna** eklenir.
> Kural kaynağı: [AGENTS.md](AGENTS.md) §7.

## Kayıt şablonu

```markdown
## <Tarih> <Saat> — <Ajan> — <Task ID>

- **Branch:**
- **İncelenen dosyalar:**
- **Değiştirilen dosyalar:**
- **Alınan kararlar:**
- **Çalıştırılan komutlar ve gerçek sonuçları:**
- **Test sonuçları:**
- **Kalan riskler:**
- **Sonraki ajana devir:**
```

---

## 2026-08-12 08:45–09:25 (Europe/Istanbul) — Claude — PHASE0-FOUNDATION

- **Branch:** `feat/phase-0-foundation`

### İncelenen dosyalar

Oturum başında depo **boştu** (çalışma dizininde dosya yok, `.git` yok).
İncelenecek mevcut kod bulunmadığı için inceleme adımı ortam tespitiyle
sınırlı kaldı:

- `git status` → `fatal: not a git repository`
- Çalışma dizini listesi → boş
- `git ls-remote origin` → boş çıktı (GitHub deposu gerçekten boş)
- Kurulu araç sürümleri ve PostgreSQL servis durumu

### Değiştirilen dosyalar

**Bootstrap commit'i (`main`, `f4ed982`):** `README.md`, `.gitignore`

**Phase commit'i (`feat/phase-0-foundation`), 84 dosya:**

- Kök yapılandırma: `package.json`, `package-lock.json`, `tsconfig.base.json`,
  `eslint.config.mjs`, `.editorconfig`, `.prettierrc.json`, `.prettierignore`,
  `.gitattributes`
- Ajan belgeleri: `AGENTS.md`, `CLAUDE.md`, `WORKFLOW.md`, `HANDOFF.md`,
  `SESSION_LOG.md`, `DECISIONS.md`, `README.md`
- Dokümantasyon: `docs/PRODUCT_SCOPE.md`, `docs/ARCHITECTURE.md`,
  `docs/PHASES.md`, `docs/UI_GUIDE.md`
- `packages/contracts`: `src/{index,common,errors,health,money}.ts`,
  `tsconfig.json`, `tsconfig.esm.json`, `scripts/mark-esm.mjs`, `package.json`
- `apps/api`: `src/app.ts`, `src/server.ts`, `src/config/{env,paths}.ts`,
  `src/errors/app-error.ts`, `src/lib/{database,logger}.ts`,
  `src/middleware/{error-handler,not-found,request-logger}.ts`,
  `src/routes/{health,index}.ts`, `src/scripts/check-database.ts`,
  `prisma/schema.prisma`, `tests/` (4 dosya + yardımcı),
  `.env.example`, `.env.test.example`, `vitest.config.ts`, tsconfig'ler
- `apps/web`: `index.html`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`,
  `src/components/` (7 bileşen), `src/config/` (3 dosya), `src/hooks/`,
  `src/lib/` (4 dosya), `src/pages/` (3 dosya), `src/styles/index.css`,
  `src/test/`, `src/__tests__/` (2 test dosyası), tsconfig'ler
- `scripts/set-local-env.ps1`, `scripts/set-local-env.bat`

### Alınan kararlar

Tamamı [DECISIONS.md](DECISIONS.md) içinde ADR-001…ADR-012 olarak kayıtlı.
Bu oturumda ayrıca şu uygulama kararları alındı:

1. **App/server ayrımı.** `createApp(deps)` port açmaz; bağımlılıklar
   (`env`, `logger`, `database`) dışarıdan verilir. Sağlık kontrolü
   `DatabaseProbe` arayüzü üzerinden çalışır, böylece **test paketi gerçek
   PostgreSQL'e ihtiyaç duymaz**.
2. **`packages/contracts` çift biçimli derlenir** (CJS + ESM). Gerekçe:
   Rollup, tsc'nin CommonJS `__exportStar` çıktısındaki `export *` zincirini
   statik olarak çözemedi ve `npm run build` kırıldı (aşağıda kayıtlı).
   Sonuç olarak paket içi göreli içe aktarımlarda `.js` uzantısı zorunlu hâle
   geldi.
3. **Vitest 3'e geçildi.** Vitest 2 kendi içinde Vite 5 taşıdığı için
   `vite.config.ts` tip denetimi çakıştı (aşağıda kayıtlı).
4. **`no-console` kuralı istisnasız.** Kayıt tutucu `process.stdout/stderr`
   akışlarına yazar; hiçbir dosyada `eslint-disable` yok.
5. **React Router v7 future bayrakları açıldı.** Testlerde çıkan geçiş
   uyarıları bastırılmadı, kaynağında giderildi.
6. **Sağlık ucu veritabanı yokken 503 + `degraded` döner**, gövde biçimi
   aynı kalır. Arayüz bunu hata değil, gösterilecek durum olarak işler.
7. **Boş modül sayfalarında buton yok.** Disabled buton yerine ne olduğunu ve
   ne geleceğini anlatan `EmptyState` kullanıldı.

### Çalıştırılan komutlar ve gerçek sonuçları

| Komut | Sonuç |
| --- | --- |
| `git init -b main` | `Initialized empty Git repository` |
| `git remote add origin …/KafeAdisyonSistemi.git` | Başarılı |
| `git ls-remote origin` | Boş çıktı → depo gerçekten boş, üzerine yazma riski yok |
| `git commit -m "chore: initialize repository"` | `[main (root-commit) f4ed982] 2 files changed, 61 insertions(+)` |
| `git push -u origin main` | `* [new branch] main -> main` |
| `git checkout -b feat/phase-0-foundation` | `Switched to a new branch` |
| `npm install` | `added 591 packages in 2m`; `postinstall` → `✔ Generated Prisma Client (v6.19.3)` |
| `npm run lint` | Çıktı yok → **temiz** (0 hata, 0 uyarı) |
| `npm run typecheck` (1. deneme) | **BAŞARISIZ** — `vite.config.ts(8,13): error TS2769` (Vitest 2 içindeki Vite 5 ile Vite 6 tip çakışması) |
| `npm pkg set devDependencies.vitest="^3.2.4"` + `npm install` | `added 101 packages, removed 11` |
| `npm run typecheck` (2. deneme) | **Temiz** — contracts, api, web hepsi hatasız |
| `npm run build` (1. deneme) | **BAŞARISIZ** — `"HEALTH_ENDPOINT" is not exported by "../../packages/contracts/dist/index.js"` (Rollup, CJS `export *` zincirini çözemedi) |
| `npm run build` (2. deneme, çift biçimli contracts ile) | **Başarılı** — `dist/index.html 0.60 kB`, `index.css 14.20 kB (gzip 3.91)`, `index.js 229.09 kB (gzip 72.99)`, `built in 1.39s` |
| `npm run db:check` | `PostgreSQL bağlantısı başarılı (SELECT 1).` |
| `npm start` (üretim, NODE_ENV=production) | `GET /api/health` → **HTTP 200** `{"status":"ok","database":"connected","timestamp":"2026-08-12T06:09:58.867Z","environment":"production"}` |
| Üretimde `GET /` | HTTP 200, `index.html` (597 bayt) |
| Üretimde `GET /masalar` | HTTP 200 → SPA fallback çalışıyor |
| Üretimde `GET /api/yok` | HTTP 404 → `/api` altında HTML değil JSON dönüyor |
| Sunucu açılış logu | `dinlemede {"host":"0.0.0.0","port":3000}` · `http://192.168.56.1:3000` · `http://172.20.10.2:3000` · `PostgreSQL bağlantısı doğrulandı.` |
| `npm run dev` (proxy testi) | `http://localhost:5173/api/health` → **HTTP 200** `{"status":"ok","database":"connected",…,"environment":"development"}`; Vite `Network: http://192.168.56.1:5173/` |
| `npm run verify` (son) | **Tamamı yeşil** — lint → typecheck → test → build |
| `git diff --cached` gizli bilgi taraması | Gerçek parola/token **yok**. Yalnızca `PAROLANIZ` yer tutucusu, test sabitleri (`ornek`, `test`) ve `package-lock` paket adları eşleşti |
| `git check-ignore -v apps/api/.env` | `.gitignore:12:.env  apps/api/.env` → **.env commit edilmiyor** |

### Test sonuçları

```
@kafe/api  (vitest 3.2.7)
 ✓ tests/env.test.ts            (7 tests)
 ✓ tests/error-handler.test.ts  (8 tests)
 ✓ tests/health.test.ts         (3 tests)
 ✓ tests/not-found.test.ts      (3 tests)
 Test Files  4 passed (4)
      Tests  21 passed (21)

@kafe/web  (vitest 3.2.7)
 ✓ src/__tests__/app.test.tsx        (5 tests)
 ✓ src/__tests__/mobile-nav.test.tsx (4 tests)
 Test Files  2 passed (2)
      Tests  9 passed (9)
```

**Toplam: 30 test, 30 başarılı, 0 başarısız, 0 uyarı.**

Kapsanan davranışlar: sağlık ucu (bağlı/kopuk/zaman damgası), 404 (API/POST/
SPA yolu), merkezî hata yönetimi (500, mesaj sızdırmama, eşzamansız hata,
bilinen hata, özel durum kodu, bozuk JSON→400, 413, geliştirme modu),
ortam doğrulama (varsayılanlar, eksik/hatalı DATABASE_URL, CHANGE_ME reddi,
geçersiz PORT/NODE_ENV); arayüz render'ı, gezinme, sağlık durumu gösterimi
(bağlı/veritabanı yok/sunucu yok), 404 sayfası, mobil alt gezinme ve
tüm modülleri listeleyen çekmece.

### Kalan riskler

1. **Windows konsol kod sayfası.** Loglardaki Türkçe karakterler varsayılan
   kod sayfasında bozuk görünür (`baÄŸlantÄ±`). Çıktı UTF-8'dir; sorun
   terminaldedir. Çözüm: `chcp 65001`. Düşük etki.
2. **Güvenlik duvarı.** Yerel ağdan erişim için 3000 portuna **özel ağ**
   izni gerekir. Verilmezse telefonlar bağlanamaz. README §7'de anlatıldı.
3. **`contracts` içinde `.js` uzantısı zorunluluğu.** Yeni dosya eklerken
   göreli içe aktarımda uzantı unutulursa ESM derlemesi kırılır.
   `docs/ARCHITECTURE.md` §5'te uyarı olarak yazıldı.
4. **`.env` her makinede elle gerekir.** `npm run setup:env` ile azaltıldı
   ama otomatik değil.
5. **Testler veritabanına bağlanmaz.** Bu bilinçlidir (deterministik test),
   ancak gerçek Prisma sorgu davranışı test kapsamında değildir. Phase 1'de
   şema geldiğinde ayrı bir test veritabanı kararı gerekecek.
6. **Bundle boyutu 229 kB (gzip 73 kB).** Şu an sorun değil; Phase'ler
   ilerledikçe rota bazlı kod bölme gerekebilir.
7. **Arayüz ölçü kontrolü.** 1440px ve 390px için düzen kuralları
   uygulandı ve testlerle davranış doğrulandı; **gerçek tarayıcıda görsel
   inceleme yapılmadı.** Codex'in bunu doğrulaması bekleniyor.

### Sonraki ajana devir

**Codex'e devredildi (reviewer).** Ayrıntılar [HANDOFF.md](HANDOFF.md)
içindedir. Beklenen: diff incelemesi, `npm run verify` ve `npm run db:check`
çıktısının bağımsız olarak yeniden üretilmesi, 1440px/390px görsel kontrol,
bulguların bu dosyaya **yeni kayıt** olarak eklenmesi.

**Merge yapılmadı. Phase 1'e başlanmadı.**

---

## 2026-08-12 09:28–09:55 (Europe/Istanbul) — Claude — PHASE0-FOUNDATION (revizyon)

- **Branch:** `feat/phase-0-foundation`

### Neden bu oturum var

Kullanıcı Phase 0 tanımını güncelledi. Yeni tanım, önceki oturumda uygulanan
bazı kararlarla **doğrudan çelişiyordu**. Bu oturum kod tabanını yeni tanıma
hizaladı. `365a907` push edilmiş olduğu için geçmiş yeniden yazılmadı
(force push yasak, AGENTS.md §10); düzeltmeler ayrı bir commit olarak geldi.

### Değişen kararlar (önceki oturuma göre)

| Konu | Önceki | Yeni |
| --- | --- | --- |
| Production hedefi | Bulut yok, kasa bilgisayarı ana bilgisayar | **Railway** + custom domain |
| Yerel ağ / IP erişimi | Uygulandı (0.0.0.0, LAN IP logu, firewall yönergesi) | **Şimdilik geliştirilmeyecek** — kaldırıldı |
| `HOST` varsayılanı | Her ortamda `0.0.0.0` | Geliştirmede `127.0.0.1`, production'da `0.0.0.0` |
| `/api/health` gövdesi | `status, database, timestamp, environment` | **`status, database, timestamp`** (yeni tanımdaki biçim) |
| `.env` biçimi | Tırnaklı URL + HOST/LOG_LEVEL/JSON_BODY_LIMIT | Tırnaksız + `?schema=public`; diğerleri isteğe bağlı |
| Belge okuma sırası | AGENTS → WORKFLOW → HANDOFF → DECISIONS → SESSION_LOG → Phase | **AGENTS → HANDOFF → DECISIONS → docs/PHASES.md → kod** |
| HANDOFF rolü | Kısa devir tablosu | Yapılan işler, dosyalar, testler ve sonuçları da içeriyor |
| Kontrol genişlikleri | 390 / 1440 | **390 / 768 / 1440** |

### İncelenen dosyalar

Önceki oturumda üretilen tüm kaynak ve belgeler; özellikle
`packages/contracts/src/health.ts`, `apps/api/src/config/env.ts`,
`apps/api/src/server.ts`, `apps/api/src/routes/health.ts`,
`apps/web/src/pages/dashboard-page.tsx`,
`apps/web/src/components/health-indicator.tsx` ve kök belgeler.

### Değiştirilen dosyalar

- **Sözleşme:** `packages/contracts/src/health.ts` — `environment` alanı
  kaldırıldı; `isHealthResponse` üç alan doğruluyor.
- **API:** `src/routes/health.ts`, `src/routes/index.ts`, `src/app.ts`
  (`env` artık health router'a geçmiyor), `src/config/env.ts`
  (`HOST` isteğe bağlı, ortama göre varsayılan), `src/server.ts`
  (LAN IP listeleme kaldırıldı), `.env.example`, `.env.test.example`.
- **API testleri:** `tests/health.test.ts` (alan kümesi testi eklendi),
  `tests/env.test.ts` (HOST varsayılanları için 3 yeni test),
  `tests/helpers/test-app.ts`.
- **Web:** `health-indicator.tsx` ("Sistem hazır"), `dashboard-page.tsx`
  ("Veritabanı bağlantısı aktif" + veritabanı kopukken ayrı uyarı),
  `module-pages.tsx` (boş durumlar ilgili Phase'i adıyla söylüyor),
  `test/render.tsx`, `__tests__/app.test.tsx` (hata gösterimi testi
  stack trace içermediğini de doğruluyor).
- **Betikler:** `scripts/set-local-env.ps1` — yeni `.env` biçimi.
- **Belgeler:** `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`, `DECISIONS.md`
  (ADR-001…ADR-012 yeni karar listesine göre yeniden yazıldı), `README.md`
  (Railway bölümü eklendi, yerel ağ bölümü kaldırıldı), `WORKFLOW.md`,
  `docs/PHASES.md`, `docs/ARCHITECTURE.md`, `docs/PRODUCT_SCOPE.md`,
  `docs/UI_GUIDE.md` (768px kırılımı).

### Alınan kararlar

1. **`/api/health` tam olarak üç alan döner.** Yeni tanımdaki gövde birebir
   uygulandı; `environment` alanı sözleşmeden çıkarıldı. Ortam bilgisi
   arayüzde artık gösterilmiyor, sunucu logunda kalıyor.
2. **`HOST` ortama göre varsayılan alır.** Geliştirmede `127.0.0.1` (yerel ağ
   erişimi geliştirilmeyecek), production'da `0.0.0.0` (Railway gereği).
   Açıkça verilirse verilen değer korunur.
3. **Geçmiş yeniden yazılmadı.** `365a907` push edilmişti; amend + force push
   yerine ikinci bir commit tercih edildi.
4. **Ek belgeler silinmedi.** `WORKFLOW.md`, `SESSION_LOG.md`,
   `docs/ARCHITECTURE.md`, `docs/PRODUCT_SCOPE.md`, `docs/UI_GUIDE.md` yeni
   tanımın zorunlu listesinde yok ama içerik değeri taşıyor; silinmek yerine
   yeni kararlarla **tutarlı hâle getirildi**.

### Çalıştırılan komutlar ve gerçek sonuçları

| Komut | Sonuç |
| --- | --- |
| `npm run verify` (1. deneme) | **BAŞARISIZ** — `'Logger' is defined but never used` (server.ts'te LAN fonksiyonu kaldırılınca artık kullanılmayan import) |
| İlgili import kaldırıldı → `npm run verify` | **PASS** — lint → typecheck → test → build |
| `npm run db:check` | `PostgreSQL bağlantısı başarılı (SELECT 1).` |
| `npm start` → `GET /api/health` | **200** `{"status":"ok","database":"connected","timestamp":"2026-08-12T06:35:16.229Z"}` — tam üç alan |
| `GET /` | **200**, `index.html` (597 bayt) |
| `GET /masalar` | **200** → SPA fallback |
| `GET /assets/index-*.css` | **200**, 14 197 bayt → statik sunum |
| `GET /api/yok` | **404** JSON |
| Sunucu logu | `{"host":"0.0.0.0","port":3000,"environment":"production"}` · `Adres: http://localhost:3000` · `PostgreSQL bağlantısı doğrulandı.` (LAN IP listesi artık yok) |

### Test sonuçları

```
@kafe/api (vitest 3.2.7)          @kafe/web (vitest 3.2.7)
 ✓ env.test.ts           (10)      ✓ app.test.tsx        (6)
 ✓ error-handler.test.ts  (8)      ✓ mobile-nav.test.tsx (4)
 ✓ health.test.ts         (4)     Test Files 2 passed (2)
 ✓ not-found.test.ts      (3)          Tests 10 passed (10)
Test Files 4 passed (4)
     Tests 25 passed (25)
```

**Toplam: 35 test, 35 başarılı, 0 başarısız, 0 uyarı.** (Önceki oturum: 30)

Yeni testler: `/api/health` alan kümesinin tam olarak
`['database','status','timestamp']` olduğu; `HOST` varsayılanının geliştirmede
`127.0.0.1`, production'da `0.0.0.0` olduğu ve açık değerin korunduğu;
veritabanı kopukken Türkçe açıklamanın göründüğü; sunucu hatası mesajının
`Error` ve stack trace içermediği.

### Commit öncesi fark edilen tutarsızlık: react-router-dom

Staged diff incelenirken `apps/web/package.json` içinde **bu oturumda
yapılmayan** bir değişiklik görüldü: `react-router-dom` aralığı `^6.28.0`
yerine `^7.18.2` idi ve `package-lock.json` da 7.18.2 gösteriyordu; ancak
`node_modules` hâlâ **6.30.4** taşıyordu.

Yani manifest/lock ile kurulu sürüm ayrışmıştı: o ana kadarki tüm testler
v6 üzerinde koşmuştu, temiz bir `npm install` ise v7 kuracaktı. Denenmemiş bir
major sürüm sessizce commit edilmedi.

Çözüm — Phase 0 tanımındaki "birbiriyle uyumlu güncel ve kararlı sürümler"
kuralı doğrultusunda gerçekten v7'ye geçildi:

| Adım | Sonuç |
| --- | --- |
| `npm install` | `added 98 packages, removed 1` → kurulu sürüm **7.18.2** |
| `apps/web/src/config/router.ts` silindi | `v7_startTransition` ve `v7_relativeSplatPath` bayrakları v7'de **varsayılan davranıştır**; `future` prop'u artık gereksiz |
| `main.tsx`, `test/render.tsx` | `future={...}` kullanımları kaldırıldı |
| `npm run verify` | **PASS** — 35/35 test, 0 uyarı |
| `npm start` → `GET /api/health` | **200** `{"status":"ok","database":"connected","timestamp":"2026-08-12T06:44:46.277Z"}` |
| `GET /mutfak` | **200** → SPA fallback v7 ile de çalışıyor |

Bundle boyutu 229.42 kB → **243.79 kB** (gzip 73.01 → 77.81) çıktı; artış
react-router v7'den geliyor.

### Kalan riskler

Önceki oturumun 1, 3, 4, 5, 6 numaralı riskleri geçerliliğini koruyor
(Windows konsol kod sayfası, `.js` uzantı zorunluluğu, elle `.env`,
DB'siz testler, bundle boyutu). Yerel ağ / güvenlik duvarı riski **artık
geçerli değil** (özellik kapsamdan çıktı).

Yeni/güncel riskler:

1. **Görsel inceleme hâlâ yapılmadı.** 390/768/1440px için düzen kuralları
   uygulandı ve davranış testlerle doğrulandı; gerçek tarayıcıda göz kontrolü
   Codex'ten bekleniyor.
2. **İki commit'lik geçmiş.** `365a907` ilk tanıma, bu commit güncel tanıma
   göre. Depo son hâliyle tutarlı; ancak `365a907` tek başına okunursa eski
   kararları yansıtır.
3. **Railway yapılandırması yok.** Bilinçli (ADR-002, Phase 7). Deployment
   sırasında `PORT`/`DATABASE_URL` sağlayıcı tarafından verilecek şekilde
   kodlandı ama uçtan uca denenmedi.

### Sonraki ajana devir

**Codex'e devredildi (reviewer).** Ayrıntı ve kontrol listesi
[HANDOFF.md](HANDOFF.md) içindedir.

**Merge yapılmadı. Phase 1'e başlanmadı.**

---

## 2026-08-12 — Codex — Phase 1 identity ve masa yönetimi geliştirmesi

### Başlangıç ve koruma

- Başlangıç: `feat/phase-0-foundation` / `6aaa1169ddd417984821d068befdc52fb90a17fe`.
- Önceki başarısız review'un kirli çalışma ağacı silinmeden
  `stash@{0}: backup: failed Codex security review before phase 1` altında
  korundu; stash Phase 1'e uygulanmadı veya silinmedi.
- Branch: `feat/phase-1-identity-tables`; base: `feat/phase-0-foundation`.
- Zorunlu belgeler, package manifestleri, backend/frontend kaynakları ve
  testleri belirtilen sırayla tamamen okundu.
- Codex Security, security scan, threat model veya ayrı güvenlik artefact
  workflow'u çalıştırılmadı.

### Plan, veri modeli ve migration

- Yerel ağ/kasa sunucusu anlatımları local geliştirme + gelecekte
  Railway/custom domain kararıyla uyumlu hale getirildi. Vite dev/preview
  `127.0.0.1`; production Express `0.0.0.0` ve aynı-origin olarak kaldı.
- Phase 1 auth/personel/işletme/salon/masa ile sınırlandı; sonraki Phase kapsamı
  PHASES belgesinde düzeltildi.
- Prisma'ya yalnız `UserRole`, `User`, `Session`, `BusinessSettings`,
  `DiningArea`, `CafeTable`, `AuditLog` eklendi; Phase 2 modeli veya sahte masa
  durumu eklenmedi.
- Migration: `20260812074504_phase_1_identity_tables`. SQL baştan sona okundu;
  yalnız enum, altı domain tablosu, index ve foreign key oluşturuyor. DROP,
  TRUNCATE, DELETE veya reset yok.
- Migration öncesi beklenmeyen tablo/drift yoktu. Deploy sonrası schema
  up-to-date ve `SELECT 1` başarılıdır. Gerçek DB'de altı Phase 1 tablosu ile
  `_prisma_migrations` var; tüm domain sayaçları sıfırdır.

### Authentication, authorization ve özellikler

- bcryptjs cost 12; 8–72 karakter şifre; normalize unique username.
- Ham 32-byte session token yalnız 12 saatlik HttpOnly, SameSite=Strict
  `kafe_session` cookie'ye gider; DB'de SHA-256 hash bulunur. Secure yalnız
  production'dır.
- Login üzerinde 15 dakika/IP başına 10 başarısız deneme limiti vardır;
  bulunmayan kullanıcı ve yanlış şifre aynı 401 mesajını döndürür.
- OWNER/CASHIER/WAITER/KITCHEN ve merkezi permission matrisi Express
  guard'larında 401/403 ile uygulanır.
- Son owner/eşzamanlı owner güncellemeleri serializable transaction ile
  korunur. Pasife alma ve şifre reset'i session'ları iptal eder.
- Backend'e auth/session, staff, business, area, table, floor-plan, audit ve
  Zod validation eklendi. DELETE veya açık owner bootstrap web endpoint'i yok.
- `npm run setup:owner` işletme adı prompt'una kadar interaktif açıldı; gerçek
  bilgi bilinmediğinden kapatıldı ve DB sayaçları sıfır kaldı.
- Frontend'e login/setup, protected/owner routes, logout, top bar kimliği,
  owner-only ayarlar, işletme/personel/salon/masa formları ve gerçek floor plan
  eklendi. Şifre reset'i maskeli ekran içi formdur; son giriş görünür.
- `/masalar` sahte doluluk, tutar, süre veya çalışmayan aksiyon göstermez.
- ADR-013 kimlik/session/sabit rol kararını kaydeder.

### Kalite, runtime ve UI kanıtı

| Komut | Gerçek sonuç |
| --- | --- |
| `npm ci` | PASS — 549 paket, audit 0 vulnerability |
| `npm ls` | PASS — invalid/extraneous/missing yok |
| `npm ls react-router-dom react-router` | PASS — 7.18.2 / 7.18.2 |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS — contracts, api, web |
| `npm run test` | PASS — 10 dosya, 77/77 (API 56, web 21) |
| `npm run build` | PASS — web JS 269.07 kB, gzip 83.37 kB |
| `npm run verify` | PASS — lint → typecheck → test → build |
| Prisma validate / migrate status | PASS — valid ve up to date |
| `npm run db:check` | PASS — PostgreSQL `SELECT 1` |

Production build gerçek PostgreSQL ile `0.0.0.0:3101` üzerinde çalıştırıldı:
health 200/connected, setup 200/false, session olmadan auth/me ve floor-plan
401 JSON, bilinmeyen API 404 JSON; `/`, `/login`, `/masalar` 200 HTML ve SPA
fallback başarılıdır.

Microsoft Edge/CDP ile login 390/768/1440 CSS px'de incelendi. Üçünde de
`scrollWidth === innerWidth`; input/buton 44px. Tab ile kullanıcı adı
`:focus-visible` oldu ve 2px solid turuncu outline aldı. Gerçek owner olmadığı
için authenticated browser E2E yerine 21 frontend kullanıcı akışı testi yapıldı.

### Commit öncesi kontrol, risk ve devir

- Tracked gerçek `.env`, gerçek secret, destructive SQL/komut, scan artefact,
  node_modules, dist veya coverage commit kapsamında yoktur. Manuel eşleşmeler
  yalnız test placeholder'ları ve dinamik env setup scriptidir. Diff check temiz.
- Kalan riskler: ayrı izole gerçek-DB mutation integration paketi yok; owner
  olmadığı için login sonrası browser E2E yapılmadı; Railway/custom domain
  Phase 7'ye bırakıldı.
- Phase 1 `feat: complete phase 1 identity and table management` commit'i ve
  draft PR ile Claude review'una devrediliyor. Merge yapılmadı, Phase 2
  başlatılmadı.
