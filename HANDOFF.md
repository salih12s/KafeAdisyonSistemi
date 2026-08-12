# HANDOFF.md — Ajanlar arası devir kaydı

Bu dosya **her zaman tek bir aktif görevi** gösterir ve görev sonunda güncellenir
(bkz. [AGENTS.md](AGENTS.md) §7).

---

## Aktif durum

| Alan                  | Değer                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| **Aktif Phase**       | Phase 1 — Authentication, Personel, İşletme, Salon ve Masa             |
| **Aktif branch**      | `feat/phase-1-identity-tables`                                         |
| **Ana geliştirici**   | Codex                                                                  |
| **Reviewer**          | Claude                                                                 |
| **Durum**             | **Claude review bekliyor**                                             |
| **Base branch / SHA** | `feat/phase-0-foundation` / `6aaa1169ddd417984821d068befdc52fb90a17fe` |
| **Phase commit**      | `feat: complete phase 1 identity and table management`                 |
| **Son güncelleme**    | 2026-08-12                                                             |

---

## Phase 1 teslimi

### Veri ve backend

- İlk additive Prisma migration: `20260812074504_phase_1_identity_tables`.
- Yalnız `User`, `Session`, `BusinessSettings`, `DiningArea`, `CafeTable`,
  `AuditLog` ve sabit `UserRole` enum'u eklendi; destructive SQL yok.
- `npm run setup:owner` işletme ve ilk OWNER kaydını tek serializable transaction
  içinde, maskeli şifreyle oluşturur; açık web bootstrap endpoint'i yoktur.
- bcryptjs cost 12, 8–72 karakter şifre; 12 saatlik HttpOnly,
  SameSite=Strict `kafe_session`; production'da Secure.
- Ham session token yalnız cookie'dedir; veritabanında SHA-256 hash bulunur.
- Login rate limit'i yalnız `/api/auth/login` üzerinde, 15 dakikada 10
  başarısız denemedir.
- Sabit roller/permission matrisi ve Express tarafında 401/403 guard'ları.
- Personel, işletme, salon ve masa endpoint'leri; DELETE endpoint'i yoktur.
- Son aktif OWNER ve eşzamanlı güncelleme riski serializable transaction ile
  korunur. Pasife alma ve şifre sıfırlama session'ları iptal eder.
- Yönetim işlemleri audit kaydı üretir; parola/session/secret metadata'ya girmez.

### Frontend

- `/login`, setup durumu, cookie tabanlı session yenileme, protected route,
  logout ve 401 sonrası güvenli login yönlendirmesi.
- Top bar'da personel adı, Türkçe rol ve çıkış; OWNER olmayan kullanıcı Ayarlar
  navigasyonunu göremez ve `/ayarlar` route'una erişemez.
- İşletme, personel, salon ve masa yönetim formları; personel son giriş bilgisi
  ve ekran içi maskeli şifre sıfırlama formu.
- `/masalar` gerçek `/api/floor-plan` verisini gösterir; doluluk, tutar, süre,
  sipariş veya çalışmayan aksiyon uydurmaz.
- Menünün Phase 2, mutfağın Phase 4, carilerin Phase 6 ve raporların Phase 7
  olduğu boş durumlarda açıkça belirtilir.

### Belgeler ve önceki çalışma ağacı

- Başlangıçtaki kirli Phase 0 değişiklikleri silinmeden şu stash'te korundu ve
  Phase 1'e uygulanmadı: `backup: failed Codex security review before phase 1`.
- `docs/PHASES.md` Phase 0–7 kapsam dağılımına göre düzeltildi.
- README, ARCHITECTURE, PRODUCT_SCOPE, UI_GUIDE ve aktif kod yorumları local
  geliştirme + gelecekte Railway/custom domain kararına uyumlu hale getirildi.
- ADR-013 kimlik/session/sabit rol kararını kaydeder.
- Codex Security veya başka bir security scan workflow'u çalıştırılmadı.

---

## Doğrulama sonuçları

| Kontrol                                | Sonuç                                       |
| -------------------------------------- | ------------------------------------------- |
| `npm ci`                               | **PASS** — 549 paket, audit 0 vulnerability |
| `npm ls`                               | **PASS** — invalid/extraneous/missing yok   |
| `npm ls react-router-dom react-router` | **PASS** — ikisi de 7.18.2                  |
| `npm run lint`                         | **PASS**                                    |
| `npm run typecheck`                    | **PASS** — contracts + api + web strict     |
| `npm run test`                         | **PASS** — 10 dosya, 77/77 (API 56, web 21) |
| `npm run build`                        | **PASS**                                    |
| `npm run verify`                       | **PASS** — lint → typecheck → test → build  |
| Prisma validate                        | **PASS**                                    |
| Prisma migrate status                  | **PASS** — database schema up to date       |
| `npm run db:check`                     | **PASS** — `SELECT 1`                       |

Gerçek PostgreSQL'de yalnız Phase 1'in altı domain tablosu ve
`_prisma_migrations` vardır. Owner/işletme/salon/masa/session/audit kayıt
sayıları sıfırdır; kullanıcıya ait veri uydurulmadı.

Production build canlı HTTP sonuçları:

| İstek                               | Sonuç                         |
| ----------------------------------- | ----------------------------- |
| `GET /api/health`                   | **200**, connected            |
| `GET /api/setup/status`             | **200**, `initialized: false` |
| `GET /api/auth/me` (session yok)    | **401** JSON                  |
| `GET /api/floor-plan` (session yok) | **401** JSON                  |
| `GET /api/bilinmeyen`               | **404** JSON                  |
| `GET /`                             | **200** HTML                  |
| `GET /login`                        | **200** HTML                  |
| `GET /masalar`                      | **200** HTML, SPA fallback    |
| Production listen                   | `0.0.0.0:3101` ile doğrulandı |

Gerçek Microsoft Edge ile login ekranı 390/768/1440 CSS px genişliklerde
incelendi. Üçünde de `scrollWidth === innerWidth`; input ve butonlar 44px.
Tab tuşuyla kullanıcı adı alanı `:focus-visible` oldu ve 2px turuncu outline
aldı. Gerçek owner oluşturulmadığı için authenticated yönetim ekranlarının
görsel kontrolü DOM/kullanıcı akışı testleriyle sınırlıdır.

---

## Bilinen riskler ve Claude review odağı

1. Varsayılan test paketi bilinçli olarak gerçek local DB'de mutation yapmaz;
   Prisma store üretimde canlı runtime/read kontrolleriyle, iş kuralları bellek
   store'uyla test edildi. Ayrı izole integration DB testi yoktur.
2. Kullanıcıya ait gerçek işletme bilgisi bilinmediği için owner oluşturulmadı;
   login sonrası gerçek tarayıcı uçtan uca akışı çalıştırılmadı.
3. Railway deployment ve custom domain Phase 7 kapsamındadır; deploy edilmedi.
4. Claude migration SQL'ini, Prisma store transaction sınırlarını, auth cookie
   davranışını ve OWNER permission matrisini bağımsız olarak yeniden incelemeli.

---

## Sonraki ajanın yapması gereken iş

**Claude reviewer olarak bu Phase 1 branch'i üzerinde:**

1. `feat/phase-0-foundation...feat/phase-1-identity-tables` diff'ini ve migration
   SQL'ini baştan sona incele.
2. `npm run verify`, Prisma status ve `npm run db:check` sonuçlarını yeniden üret.
3. Authentication, server-side authorization, son OWNER, audit ve Phase 2 kapsam
   sızıntısı kontrollerini yap.
4. Gerçek sorun varsa aynı branch'te minimal repair commit'i oluştur; merge yapma.

**Merge yapılmadı. Phase 2 başlatılmadı.**

---

## Devir geçmişi

| Tarih      | Phase   | Devreden | Devralan | Not                                                                              |
| ---------- | ------- | -------- | -------- | -------------------------------------------------------------------------------- |
| 2026-08-12 | Phase 0 | Claude   | Codex    | Phase 0 uygulandı ve review'a devredildi.                                        |
| 2026-08-12 | Phase 1 | Codex    | Claude   | Identity, personel, işletme, salon ve masa yönetimi tamamlandı; review bekliyor. |
