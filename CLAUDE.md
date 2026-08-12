# CLAUDE.md — Claude için başlangıç belgesi

Bu dosya Claude'un her çalışmaya nasıl başlayacağını tanımlar.
Proje kuralları burada tekrar edilmez; kural kaynağı tek bir yerdedir:
**[AGENTS.md](AGENTS.md)**.

---

## 1. Çalışmaya başlamadan önce zorunlu okuma sırası

Kod yazmadan, dosya oluşturmadan ve öneri sunmadan önce şunlar okunur:

1. **[AGENTS.md](AGENTS.md)** — bağlayıcı kurallar
2. **[HANDOFF.md](HANDOFF.md)** — aktif Phase, aktif branch, ana geliştirici,
   reviewer, son durum
3. **[DECISIONS.md](DECISIONS.md)** — kalıcı teknik kararlar
4. **[docs/PHASES.md](docs/PHASES.md)** — Phase planı ve aktif Phase kapsamı
5. **Mevcut kod ve testler** — değiştirilecek dosyalar ve o dosyaların testleri

Gerektiğinde ek belgeler: [WORKFLOW.md](WORKFLOW.md) (adım adım Phase düzeni),
[SESSION_LOG.md](SESSION_LOG.md) (ayrıntılı oturum kayıtları),
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md),
[docs/UI_GUIDE.md](docs/UI_GUIDE.md).

---

## 2. Başlamadan önce doğrulanacaklar

- `HANDOFF.md` içinde **ana geliştirici Claude mı?** Değilse kod değiştirilmez.
- Aktif branch `HANDOFF.md` içindeki branch ile aynı mı?
- Çalışma ağacı temiz mi? (`git status`)
- İstenen iş aktif Phase'in kapsamında mı?

Bu dördünden biri sağlanmıyorsa kullanıcıya durum bildirilir ve beklenir.

---

## 3. Bu projeye özgü hatırlatmalar

- Şu anda **yalnızca local geliştirme** yapılıyor:
  frontend `http://localhost:5173`, backend `http://localhost:3000`,
  PostgreSQL `localhost:5432/CafeAdisyon`.
- Production hedefi **Railway**'dir (bkz. DECISIONS.md). Ancak Railway
  yapılandırması bu aşamada yazılmaz.
- Production'da Express, React build çıktısını da sunar — frontend ve API
  **aynı origin** üzerindedir.
- Frontend API adresini **hardcode etmez**; göreli `/api` yolları kullanılır.
- Arayüz dili **Türkçe**; tarih/saat işlemlerinde **Europe/Istanbul** esas alınır.
- Para değerleri **tam sayı kuruş** olarak tutulur.
- Veritabanı bağlantısı **environment değişkeninden** alınır.
- Mevcut `CafeAdisyon` veritabanı korunur; destructive işlem yasaktır
  (AGENTS.md §9).
- `apps/api/.env` asla commit edilmez ve içeriği çıktıya yazılmaz.

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
| `npm start` | Production sunucusu (Express + React build, tek origin) |

---

## 5. Görevi bitirirken

1. `npm run verify` çalıştır, **gerçek** çıktıyı sakla.
2. `git diff` çıktısını baştan sona incele.
3. Gizli bilgi taraması yap.
4. Uygulamayı başlat, `/api/health` ve frontend'i kontrol et.
5. `HANDOFF.md` dosyasını güncelle ve reviewer'a devret.
6. `SESSION_LOG.md` sonuna yeni kayıt **ekle** (eskiyi değiştirme).
7. Commit ve push yap; draft PR aç.
8. Merge etme, bir sonraki Phase'e geçme.

Adım adım düzen: **[WORKFLOW.md](WORKFLOW.md)**.
