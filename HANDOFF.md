# HANDOFF.md — Geliştiriciler arası devir kaydı

Bu dosya **her zaman tek bir aktif görevi** gösterir ve görev sonunda güncellenir
(bkz. [AGENTS.md](AGENTS.md) §7).

> **Çalışma düzeni (2026-08-12'de değişti):** Phase başına ayrı review adımı
> **yoktur**. Bir Phase; iş bitip testler geçtikten sonra commit + push + draft PR
> ile kapanır, merge edilmez ve **sonraki Phase hemen başlayabilir**. Kapsamlı
> review tüm proje bittikten sonra bir kez yapılacaktır (AGENTS.md §5).
> Bu dosya bir reviewer'a değil, **sonraki geliştiriciye** hazırlanır.

---

## Aktif durum

| Alan | Değer |
| --- | --- |
| **Aktif Phase** | Phase 2 — Menü ve ürün yönetimi |
| **Aktif branch** | `feat/phase-2-menu-products` |
| **Ana geliştirici** | Claude |
| **Durum** | **Tamamlandı — draft PR açık, merge edilmedi** |
| **Base branch / SHA** | `feat/phase-1-identity-tables` / `c4b5e1816a6d44790790aa2aa7d870844a7324bb` |
| **Phase commit** | `feat: complete phase 2 menu and product management` |
| **Son güncelleme** | 2026-08-12 |

### Phase durumu

| Phase | Branch | Ana geliştirici | Durum |
| --- | --- | --- | --- |
| 0 | `feat/phase-0-foundation` | Claude | Tamamlandı · draft PR açık |
| 1 | `feat/phase-1-identity-tables` | Codex | Tamamlandı · draft PR açık |
| 2 | `feat/phase-2-menu-products` | Claude | Tamamlandı · draft PR açık |
| 3 | — | **Codex** | Başlanmadı |

Açık draft PR'lar sonraki Phase'i **bloke etmez**.

---

## Phase 2 teslimi

### Çalışma düzeni değişikliği

Kullanıcı Phase başına Claude/Codex review'unu kaldırdı. `AGENTS.md` §5 yeniden
yazıldı, `WORKFLOW.md` §3/§9/§12/§13 ve `docs/PHASES.md` başlığı güncellendi;
`HANDOFF.md` artık reviewer değil sonraki geliştirici için hazırlanıyor.
`SESSION_LOG.md` append-only kaldı — eski kayıtlara dokunulmadı.

### Veri katmanı

- Additive migration: `20260812085207_phase_2_menu_products`.
- Yalnız `CREATE TYPE` / `CREATE TABLE` / `CREATE INDEX` / `ADD CONSTRAINT`
  içerir. Mevcut tablolara `ALTER`, hiçbir `DROP` veya veri değişikliği yok.
- Yeni enum'lar: `PreparationArea` (KITCHEN/BAR),
  `OptionSelectionType` (SINGLE/MULTIPLE).
- Yeni modeller: `Category`, `Product`, `ProductOptionGroup`,
  `ProductOptionValue`.
- Benzersizlik: `Category.nameKey` global; `Product` kategori içinde;
  `ProductOptionGroup` ürün içinde; `ProductOptionValue` grup içinde.
  `nameKey`, `normalizeNameKey` ile tr-TR küçük harfe indirgenir — "TATLILAR"
  ile "Tatlılar" aynı sayılır.
- Tüm ilişkiler `onDelete: Restrict`. **Hiçbir DELETE ucu yoktur**; pasife alma
  `isActive` ile yapılır.
- Fiyatlar `Int` kuruştur (`priceKurus`, `priceDeltaKurus`); `Float` yok.
  Fiyat farkı negatif olabilir (küçük boy indirimi).

### Backend

- `MenuStore` sınırı `src/features/menu-store.ts`; Prisma uygulaması
  `prisma-menu-store.ts`, `createPrismaStore` içine spread edilir.
- Yeni izinler: `VIEW_MENU` (tüm roller) ve `MANAGE_MENU` (yalnız OWNER).
- `/api/menu` altındaki uçlar:
  - `GET /api/menu` — yalnız aktif kayıtlardan satış görünümü
  - `GET|POST /api/menu/categories`, `PATCH /api/menu/categories/:id`
  - `GET|POST /api/menu/products`, `PATCH /api/menu/products/:id`
  - `GET|POST /api/menu/products/:id/option-groups`
  - `PATCH /api/menu/option-groups/:id`
  - `POST /api/menu/option-groups/:id/values`
  - `PATCH /api/menu/option-values/:id`
- Validation ve duplicate kontrolü **backend'de**: zod ile ad/sıra/fiyat,
  `P2002` → 409, `P2025` → 404.
- Tüm yazma işlemleri `AuditLog` kaydı üretir.
- Ortak `parse` ve `callStore` yardımcıları `features/http.ts` içine taşındı;
  `routes.ts` ve `menu-routes.ts` aynı kopyayı kullanır.

### Frontend

- `/menu` artık gerçek PostgreSQL verisiyle çalışır (`pages/menu-page.tsx`).
  Eski placeholder `module-pages.tsx` içinden kaldırıldı.
- OWNER: kategori, ürün, seçenek grubu ve seçenek değeri ekler/düzenler,
  pasife alır, sıralar.
- OWNER olmayan roller menüyü **yalnız görüntüler**; hiçbir form veya
  "Düzenle" düğmesi render edilmez. Yetki hem API hem arayüzde uygulanır.
- Fiyat arayüzde ₺ olarak girilir, `liraToKurus` ile tam sayı kuruşa çevrilerek
  gönderilir; listede `formatKurus` ile tr-TR biçiminde gösterilir.
- Mevcut cafe UI dili korundu: `Panel`, `EmptyState`, aynı palet, 44px dokunma
  hedefleri, `sm`/`lg`/`xl` kırılımları. Sahte ürün/veri eklenmedi.

---

## Değiştirilen önemli dosyalar

| Yol | Not |
| --- | --- |
| `apps/api/prisma/schema.prisma` | 4 yeni model + 2 enum |
| `apps/api/prisma/migrations/20260812085207_phase_2_menu_products/` | Additive migration |
| `apps/api/src/features/menu-store.ts` | MenuStore sınırı ve write input tipleri |
| `apps/api/src/features/prisma-menu-store.ts` | Prisma uygulaması + audit |
| `apps/api/src/features/menu-routes.ts` | `/api/menu` uçları, zod validation |
| `apps/api/src/features/http.ts` | Ortak `parse` ve `callStore` |
| `apps/api/src/features/permissions.ts` | `VIEW_MENU` tüm rollere |
| `apps/api/src/features/store.ts` | `AppStore extends MenuStore` |
| `packages/contracts/src/menu.ts` | Menü sözleşmeleri ve tip koruyucular |
| `packages/contracts/src/identity.ts` | `VIEW_MENU` / `MANAGE_MENU` |
| `apps/web/src/pages/menu-page.tsx` | Gerçek verili menü ekranı |
| `apps/web/src/lib/api.ts` | Menü istemci fonksiyonları + tip koruyucular |
| `apps/api/tests/helpers/memory-menu-store.ts` | Bellek içi MenuStore |
| `AGENTS.md`, `WORKFLOW.md`, `docs/PHASES.md` | Yeni çalışma düzeni |

---

## Çalıştırılan testler ve sonuçları

| Komut | Sonuç |
| --- | --- |
| `npm run lint` | **PASS** — 0 hata, 0 uyarı |
| `npm run typecheck` | **PASS** — contracts + api + web |
| `npm run test` | **PASS** — 116/116 |
| `npm run build` | **PASS** — `index.js 285.53 kB (gzip 86.16)` |
| `npm run verify` | **PASS** — lint → typecheck → test → build |
| `npx prisma migrate deploy` | **PASS** — migration uygulandı, veri kaybı yok |

```
@kafe/api (vitest 3.2.7)            @kafe/web (vitest 3.2.7)
 ✓ env.test.ts            (10)       ✓ app.test.tsx        (6)
 ✓ error-handler.test.ts   (8)       ✓ mobile-nav.test.tsx (4)
 ✓ health.test.ts          (4)       ✓ auth.test.tsx       (7)
 ✓ not-found.test.ts       (3)       ✓ management.test.tsx (4)
 ✓ password.test.ts        (4)       ✓ menu.test.tsx       (9)
 ✓ phase-one.test.ts      (27)      Test Files 5 passed (5)
 ✓ phase-two.test.ts      (30)           Tests 30 passed (30)
Test Files 7 passed (7)
     Tests 86 passed (86)
```

**Phase 2'de eklenen: 39 test** (30 backend + 9 frontend).

Ayrıca gerçek veritabanına karşı **salt okuma** doğrulaması yapıldı:
`listCategories`, `listProducts` ve `getMenu` (iç içe include zinciriyle)
gerçek şemaya karşı hatasız çalıştı. Doğrulama betiği geçici oluşturuldu ve
silindi; hiçbir kayıt yazılmadı.

---

## Bilinen eksikler

| # | Konu | Etki |
| --- | --- | --- |
| 1 | Veritabanında henüz OWNER yok (`/api/setup/status` → `initialized: false`), bu yüzden **kimlik doğrulamalı menü uçları gerçek DB ile uçtan uca denenmedi**. Testler bellek içi store ile koşar; Prisma tarafı yalnız salt okuma ile doğrulandı. | Orta — `npm run setup:owner` sonrası elle doğrulanmalı |
| 2 | Arayüz 390/768/1440px kurallarına göre yazıldı ve testlerle doğrulandı; **gerçek tarayıcıda görsel inceleme yapılmadı** | Orta |
| 3 | Seçenek grubu/değeri güncellemesi grubu/ürünü taşımaz (tasarım gereği); taşıma gerekirse Phase 3'te ayrı uç gerekir | Düşük |
| 4 | Ürün silme yok (bilinçli, ADR-011); pasife alınan ürün listede `includeInactive` ile görünür | Yok — planlı |
| 5 | `packages/contracts` içinde göreli içe aktarımlarda `.js` uzantısı zorunlu | Düşük |

---

## Sonraki geliştiricinin işi — Phase 3 (Codex)

**Phase 3 — Masa açma, adisyon ve sipariş.**
Branch: `feat/phase-3-orders`, base: `feat/phase-2-menu-products`.

1. `AGENTS.md` → `HANDOFF.md` → `DECISIONS.md` → `docs/PHASES.md` sırasıyla oku.
2. Phase 2'nin bıraktığı sınırları kullan:
   - Ürün fiyatı `priceKurus`, seçenek farkı `priceDeltaKurus` — **tam sayı kuruş**.
   - Adisyon toplamı **sunucuda** hesaplanmalı; seçenek farkları ürün fiyatına eklenir.
   - `preparationArea` (KITCHEN/BAR) sipariş yönlendirmesi için hazırdır.
   - Zorunlu (`isRequired`) ve tek/çok seçimli (`selectionType`) gruplar sipariş
     doğrulamasında kullanılmalıdır.
   - Menü okuması için `GET /api/menu` yalnız aktif kayıtları döner.
3. Yeni modelleri `MenuStore` gibi ayrı bir store sınırı olarak ekle ve
   `AppStore`'a bağla; bellek içi karşılığını `tests/helpers/` altında sağla.
4. Migration additive olmalı; `DELETE` yerine iptal/pasif alanları kullan.
5. Bitince: `npm run verify` → commit → push → draft PR (base
   `feat/phase-2-menu-products`) → **merge etme**.

**Merge yapılmadı. Phase 3'e başlanmadı.**

---

## Devir geçmişi

| Tarih | Phase | Devreden | Devralan | Not |
| --- | --- | --- | --- | --- |
| 2026-08-12 | Phase 0 | Claude | Codex | Proje temeli tamamlandı. |
| 2026-08-12 | Phase 1 | Codex | Claude | Kimlik, personel, salon ve masa tamamlandı. |
| 2026-08-12 | Phase 2 | Claude | **Codex** | Menü, ürün, seçenek ve ekstra yönetimi tamamlandı. |
