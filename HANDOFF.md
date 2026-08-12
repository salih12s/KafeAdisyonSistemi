# HANDOFF.md — Aktif görev ve devir tablosu

Bu dosya **her zaman tek bir aktif görevi** gösterir.
Kurallar için bkz. [AGENTS.md](AGENTS.md) §3 ve §4.

---

## Aktif görev

| Alan | Değer |
| --- | --- |
| **Task ID** | `PHASE0-FOUNDATION` |
| **Phase** | Phase 0 — Yerel proje temeli, ortak ajan iş akışı ve UI altyapısı |
| **Aktif ajan** | Codex (reviewer olarak devraldı) |
| **Reviewer** | Codex |
| **Branch** | `feat/phase-0-foundation` |
| **Sahip olunan yollar** | `apps/**`, `packages/**`, `docs/**`, `scripts/**`, kök yapılandırma ve belge dosyaları |
| **Durum** | **Review bekliyor** |
| **Başlangıç tarihi** | 2026-08-12 |
| **Son güncelleme** | 2026-08-12 |

### Yapılan son işlem

Claude, Phase 0'ın tamamını uyguladı:

- Git bootstrap (`main` üzerinde `chore: initialize repository`), ardından
  `feat/phase-0-foundation` branch'i.
- npm workspaces yapısı: `apps/web`, `apps/api`, `packages/contracts`.
- Express + TypeScript API: ortam doğrulama, merkezî hata yönetimi, 404,
  JSON gövde sınırı, Helmet, geliştirme loglaması, graceful shutdown,
  Prisma yaşam döngüsü, `GET /api/health`, test edilebilir app/server ayrımı.
- React + Vite + Tailwind + React Router + TanStack Query arayüz kabuğu;
  7 rota, masaüstü kenar çubuğu, mobil alt gezinme ve modül çekmecesi,
  canlı sistem durumu göstergesi.
- Ortak ajan belgeleri ve `docs/` dokümantasyonu.
- 30 test (21 API + 9 web), `npm run verify` başarılı.
- PostgreSQL bağlantısı `SELECT 1` ile doğrulandı; destructive işlem yapılmadı.

### Sonraki beklenen işlem

Codex'ten beklenen inceleme:

1. `feat/phase-0-foundation` branch'indeki diff'i baştan sona oku.
2. [AGENTS.md](AGENTS.md) kurallarına uyumu doğrula (özellikle §8 gizli bilgi,
   §9 veritabanı, §11 kod kalitesi).
3. `npm run verify` çıktısını kendi ortamında yeniden üret.
4. `npm run db:check` ile bağlantıyı doğrula.
5. Arayüzü 1440px ve 390px genişlikte gözden geçir
   ([docs/UI_GUIDE.md](docs/UI_GUIDE.md) ölçütleriyle).
6. Bulguları [SESSION_LOG.md](SESSION_LOG.md) içine yeni kayıt olarak ekle.
7. **Merge etme.** Merge kararı kullanıcıya aittir.
8. **Phase 1'e başlama.**

### Bilinen risk ve engeller

| # | Risk | Etki | Durum |
| --- | --- | --- | --- |
| 1 | Windows konsolu varsayılan kod sayfasında Türkçe karakterler bozuk görünebilir (log çıktısı UTF-8'dir, sorun terminal tarafındadır). | Düşük — yalnızca görüntü | Açık, `chcp 65001` ile giderilir |
| 2 | Yerel ağdan erişim için Windows Güvenlik Duvarı'nda 3000 portuna özel ağ izni gerekir. | Orta — izin verilmezse telefonlar bağlanamaz | Açık, README'de anlatıldı |
| 3 | `apps/api/.env` dosyası her geliştirici bilgisayarında elle oluşturulmalıdır. | Düşük | `npm run setup:env` ile azaltıldı |
| 4 | `packages/contracts` hem CJS hem ESM üretir; yeni dosya eklerken göreli içe aktarımlarda `.js` uzantısı zorunludur. | Düşük — unutulursa derleme kırılır | Açık, `docs/ARCHITECTURE.md` içinde belgelendi |
| 5 | Phase 0'da hiçbir domain tablosu yoktur; Prisma şeması yalnızca datasource ve generator içerir. | Bilinçli karar | Kapalı |

---

## Devir geçmişi

| Tarih | Task ID | Devreden | Devralan | Not |
| --- | --- | --- | --- | --- |
| 2026-08-12 | `PHASE0-FOUNDATION` | Claude | Codex | Phase 0 uygulaması tamamlandı, review bekliyor. |
