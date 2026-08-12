# HANDOFF.md — Ajanlar arası devir kaydı

Bu dosya **her zaman tek bir aktif görevi** gösterir ve her ajan tarafından
görev sonunda güncellenir (bkz. [AGENTS.md](AGENTS.md) §7).

---

## Aktif durum

| Alan | Değer |
| --- | --- |
| **Aktif Phase** | Phase 0 — Proje Temeli ve Arayüz Altyapısı |
| **Aktif branch** | `feat/phase-0-foundation` |
| **Ana geliştirici** | Claude |
| **Reviewer** | Codex |
| **Durum** | **Codex review bekliyor** |
| **Son commit** | `chore: establish phase 0 application foundation` (bu belgeyi içeren commit) |
| **Önceki commit'ler** | `365a907` (Phase 0 ilk kurulum) · `f4ed982` (`main` bootstrap) |
| **Son güncelleme** | 2026-08-12 |

---

## Yapılan işler

### Depo ve iş akışı
- `main` üzerinde bootstrap commit'i (`chore: initialize repository`), ardından
  `feat/phase-0-foundation` branch'i. `main`'e Phase kodu yazılmadı.
- Ortak ajan belgeleri: `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`, `DECISIONS.md`,
  ek olarak `WORKFLOW.md` ve append-only `SESSION_LOG.md`.
- `docs/PHASES.md` (Phase 0–7) ve destek belgeleri (`ARCHITECTURE`,
  `PRODUCT_SCOPE`, `UI_GUIDE`).

### Workspace
- npm workspaces: `apps/web`, `apps/api`, `packages/contracts`.
- TypeScript `strict` + `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`.
- ESLint 9 flat config: `no-explicit-any`, `ban-ts-comment`, `no-console`
  istisnasız hata seviyesinde. Prettier + `.editorconfig` + `.prettierignore`.
- Kök komutlar: `dev`, `lint`, `typecheck`, `test`, `build`, `start`, `verify`
  (+ `db:check`, `setup:env`).

### Backend (`apps/api`)
- Express 5 + TypeScript; `createApp(deps)` / `server.ts` ayrımı.
- `zod` ile environment doğrulaması; hata hâlinde stack trace yerine hangi
  değişkenin neden geçersiz olduğu yazılır.
- Merkezî hata yönetimi (sabit `{ error: { code, message, details? } }`),
  JSON 404, Helmet, JSON body limiti, geliştirme loglaması,
  graceful shutdown, Prisma client yönetimi.
- `GET /api/health` → bağlıyken 200/`ok`, kopukken 503/`degraded`.
- Production'da `apps/web/dist` sunumu + SPA fallback.

### Frontend (`apps/web`)
- React 18 + Vite 6 + React Router + TanStack Query + Tailwind 4 + lucide.
- Rotalar: `/`, `/masalar`, `/menu`, `/mutfak`, `/cariler`, `/raporlar`,
  `/ayarlar` + 404. API adresi hardcode edilmedi (göreli `/api`).
- Masaüstünde sabit sol menü + kompakt üst bar; mobilde alt navigasyon ve
  tüm modülleri listeleyen çekmece.
- Sistem durumu görünür: "Sistem hazır" / "Veritabanı bağlantısı aktif";
  bağlantı yoksa Türkçe, stack trace içermeyen açıklama.
- Boş modüllerde çalışmayan buton yok; yalnızca anlamlı boş durumlar.

---

## Değiştirilen önemli dosyalar

| Yol | Not |
| --- | --- |
| `apps/api/src/app.ts` | Middleware sırası; `/api` 404 statikten önce |
| `apps/api/src/server.ts` | Dinleme, graceful shutdown, başlangıç doğrulaması |
| `apps/api/src/config/env.ts` | `zod` doğrulama; HOST dev'de `127.0.0.1`, prod'da `0.0.0.0` |
| `apps/api/src/middleware/error-handler.ts` | Merkezî hata yönetimi |
| `apps/api/src/routes/health.ts` | `GET /api/health` |
| `apps/api/src/lib/database.ts` | Prisma yaşam döngüsü + `DatabaseProbe` |
| `apps/api/prisma/schema.prisma` | Yalnızca datasource + generator; domain tablosu yok |
| `apps/web/vite.config.ts` | `/api` proxy → `localhost:3000`; vitest ayarları |
| `apps/web/src/lib/api.ts` | Göreli `/api` çağrısı, tip koruyucu ile doğrulama |
| `apps/web/src/pages/dashboard-page.tsx` | Sistem durumu ve modül listesi |
| `apps/web/src/components/layout/*` | Masaüstü/mobil uygulama kabuğu |
| `packages/contracts/src/health.ts` | `HealthResponse` + `isHealthResponse` |
| `apps/api/.env.example` | `CHANGE_ME` şablonu; gerçek parola yok |

---

## Çalıştırılan testler ve sonuçları

| Komut | Sonuç |
| --- | --- |
| `npm run lint` | **PASS** — çıktı yok (0 hata, 0 uyarı) |
| `npm run typecheck` | **PASS** — contracts + api + web |
| `npm run test` | **PASS** — 35/35 |
| `npm run build` | **PASS** — `index.js 243.79 kB (gzip 77.81)` |
| `npm run verify` | **PASS** — lint → typecheck → test → build |
| `npm run db:check` | **PASS** — `PostgreSQL bağlantısı başarılı (SELECT 1).` |

```
@kafe/api (vitest 3.2.7)          @kafe/web (vitest 3.2.7)
 ✓ env.test.ts           (10)      ✓ app.test.tsx        (6)
 ✓ error-handler.test.ts  (8)      ✓ mobile-nav.test.tsx (4)
 ✓ health.test.ts         (4)     Test Files 2 passed (2)
 ✓ not-found.test.ts      (3)          Tests 10 passed (10)
Test Files 4 passed (4)
     Tests 25 passed (25)
```

Çalışan uygulama üzerinde doğrulananlar (production build):

| İstek | Sonuç |
| --- | --- |
| `GET /api/health` | **200** `{"status":"ok","database":"connected","timestamp":"2026-08-12T06:35:16.229Z"}` |
| `GET /` | **200**, `index.html` |
| `GET /masalar` | **200** → SPA fallback çalışıyor |
| `GET /assets/index-*.css` | **200**, 14 197 bayt → statik sunum çalışıyor |
| `GET /api/yok` | **404** → `/api` altında JSON, HTML değil |

Geliştirme proxy'si: `http://localhost:5173/api/health` → **200**.

---

## Bilinen eksikler

| # | Konu | Etki |
| --- | --- | --- |
| 1 | Arayüz 390/768/1440px kurallarına göre yazıldı ve davranışı testlerle doğrulandı; **gerçek tarayıcıda görsel inceleme yapılmadı** | Orta — Codex doğrulamalı |
| 2 | Testler veritabanına bağlanmıyor (bilinçli, deterministik); gerçek Prisma sorgu davranışı kapsam dışı | Orta — Phase 1'de test veritabanı kararı gerekecek |
| 3 | `packages/contracts` içinde göreli içe aktarımlarda `.js` uzantısı zorunlu; unutulursa build kırılır | Düşük — ARCHITECTURE §5'te yazılı |
| 4 | `.env` her makinede elle gerekir (`npm run setup:env` ile azaltıldı) | Düşük |
| 5 | Windows konsolunda Türkçe karakterler bozuk görünebilir (çıktı UTF-8, sorun terminalde; `chcp 65001`) | Düşük |
| 6 | `365a907` push edilmiş olduğu için düzeltmeler ayrı bir commit olarak geldi; geçmiş yeniden yazılmadı (force push yasak) | Düşük |
| 7 | Railway deployment yapılandırması bilinçli olarak yazılmadı (ADR-002) | Yok — planlı |
| 8 | `react-router-dom` v7'ye yükseltildi; v6'ya özel `future` bayrakları kaldırıldı. Bundle 229 kB → 244 kB | Düşük — verify ve çalışan uygulama ile doğrulandı |

---

## Sonraki ajanın yapması gereken iş

**Codex (reviewer), `feat/phase-0-foundation` branch'i üzerinde:**

1. Diff'i baştan sona oku.
2. [AGENTS.md](AGENTS.md) uyumunu doğrula — özellikle §8 (gizli bilgi),
   §9 (destructive DB), §11 (kod kalitesi: `any`, `@ts-ignore`, placeholder yok).
3. `npm run verify` ve `npm run db:check` çıktısını **kendi ortamında yeniden üret.**
4. Arayüzü **390px, 768px ve 1440px** genişlikte görsel olarak incele
   ([docs/UI_GUIDE.md](docs/UI_GUIDE.md) ölçütleriyle) — bilinen eksik #1.
5. Yalnızca **gerçek hata** bulursan düzelt (AGENTS.md §5); üslup tercihi için
   çalışan kodu değiştirme.
6. Bulguları bu dosyaya ve [SESSION_LOG.md](SESSION_LOG.md) içine **yeni kayıt**
   olarak ekle.

> **Merge yapma. Phase 1'e başlama.** Merge kararı kullanıcıya aittir.

---

## Devir geçmişi

| Tarih | Phase | Devreden | Devralan | Not |
| --- | --- | --- | --- | --- |
| 2026-08-12 | Phase 0 | Claude | Codex | Phase 0 uygulandı, `npm run verify` yeşil, review bekliyor. |
