# CLAUDE.md — Claude için başlangıç belgesi

Bu dosya Claude'un her oturuma nasıl başlayacağını tanımlar.
Proje kuralları burada tekrar edilmez; kural kaynağı tek bir yerdedir:
**[AGENTS.md](AGENTS.md)**.

---

## 1. Oturuma başlarken zorunlu okuma sırası

Kod yazmadan, dosya oluşturmadan ve öneri sunmadan önce şunlar okunur:

1. **[AGENTS.md](AGENTS.md)** — bağlayıcı kurallar
2. **[WORKFLOW.md](WORKFLOW.md)** — Phase çalışma düzeni
3. **[HANDOFF.md](HANDOFF.md)** — aktif görev, aktif ajan, branch, sahiplik
4. **[DECISIONS.md](DECISIONS.md)** — kalıcı teknik kararlar
5. **[SESSION_LOG.md](SESSION_LOG.md)** — en az son iki oturum kaydı
6. İlgili Phase dokümanı — **[docs/PHASES.md](docs/PHASES.md)** ve gerekiyorsa
   [docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md),
   [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
   [docs/UI_GUIDE.md](docs/UI_GUIDE.md)
7. Değiştirilecek kod ve o kodun testleri

---

## 2. Çalışmaya başlamadan önce doğrulanacaklar

- `HANDOFF.md` içinde **aktif ajan Claude mı?** Değilse kod değiştirilmez.
- Aktif branch `HANDOFF.md` içindeki branch ile aynı mı?
- Çalışma ağacı temiz mi? (`git status`)
- Aktif Phase hangisi ve istenen iş bu Phase'in kapsamında mı?

Bu dördünden biri sağlanmıyorsa kullanıcıya durum bildirilir ve beklenir.

---

## 3. Bu projeye özgü hatırlatmalar

- Uygulama **yerel ağda** çalışır. Kasa bilgisayarı ana bilgisayardır;
  telefon ve tabletler onun IPv4 adresine bağlanır. Bulut yoktur.
- Arayüz dili **Türkçe**, para birimi **TRY**, zaman dilimi **Europe/Istanbul**,
  biçimlendirme **tr-TR**.
- Para değerleri **tam sayı kuruş**tur.
- Mevcut `CafeAdisyon` veritabanı korunur; destructive işlem yasaktır
  (bkz. AGENTS.md §9).
- `apps/api/.env` dosyası asla commit edilmez ve içeriği doküman ya da
  sohbet çıktısına yazılmaz.

---

## 4. Sık kullanılan komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run setup:env` | `apps/api/.env` dosyasını sorularla oluşturur |
| `npm run dev` | API (3000) ve web (5173) geliştirme sunucularını başlatır |
| `npm run db:check` | Veritabanı bağlantısını `SELECT 1` ile doğrular |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript tip denetimi |
| `npm run test` | API ve web testleri |
| `npm run build` | Üretim derlemesi |
| `npm run verify` | lint → typecheck → test → build |
| `npm start` | Üretim sunucusu (tek URL: `http://<IP>:3000`) |

---

## 5. Görevi bitirirken

1. `npm run verify` çalıştır, **gerçek** çıktıyı sakla.
2. `git diff` çıktısını baştan sona incele.
3. Gizli bilgi taraması yap.
4. `SESSION_LOG.md` içine yeni kayıt **ekle** (eskiyi değiştirme).
5. `HANDOFF.md` durumunu güncelle ve reviewer'a devret.
6. Commit ve push yap; draft PR aç.
7. Merge etme, bir sonraki Phase'e geçme.

Ayrıntılı adımlar: **[WORKFLOW.md](WORKFLOW.md)**.
