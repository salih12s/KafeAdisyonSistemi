# Phase Planı (0–7)

Her Phase kendi branch'inde çalışır ve **draft PR** ile kapanır.

> **Çalışma düzeni (2026-08-12'de değişti):** Phase başına ayrı Claude/Codex
> review adımı **yoktur**. Bir Phase; iş bitip testler geçtikten sonra
> commit + push + draft PR ile kapanır ve **merge edilmez**. Açık bir draft PR
> sonraki Phase'i **bloke etmez**; kullanıcı istediğinde sonraki Phase hemen
> başlayabilir. Kapsamlı review **tüm proje bittikten sonra bir kez** yapılır.
> Kural kaynağı: [../AGENTS.md](../AGENTS.md) §5.

Branch adı kalıbı: `feat/phase-<n>-<konu>`
Her Phase branch'i bir önceki Phase branch'inden açılır; PR'ı da ona hedeflenir.

| Phase | Konu                                                   | Ana geliştirici | Durum            |
| ----- | ------------------------------------------------------ | --------------- | ---------------- |
| 0     | Proje temeli                                           | Claude          | Tamamlandı — draft PR açık |
| 1     | Authentication, personel, işletme, salon ve masa       | Codex           | Tamamlandı — draft PR açık |
| 2     | Kategoriler, ürünler, seçenekler ve ekstralar          | Claude          | **Devam ediyor** |
| 3     | Masa açma, adisyon ve sipariş                          | Codex           | Başlanmadı       |
| 4     | Mutfak/bar ve gerçek zamanlı güncelleme                | Codex           | Başlanmadı       |
| 5     | Ödeme, hesap bölme ve hesap kapatma                    | Codex           | Başlanmadı       |
| 6     | Cari hesap, indirim, ikram, masa taşıma ve birleştirme | Codex           | Başlanmadı       |
| 7     | Raporlar, audit ekranı ve Railway deployment           | Codex           | Başlanmadı       |

**Phase 3'ten itibaren ana geliştirici Codex'tir.**

---

## Phase 0 — Proje temeli ve arayüz altyapısı

**Branch:** `feat/phase-0-foundation`

**Kapsam**

- Git bootstrap: `main` başlangıç commit'i ve Phase branch'i
- npm workspaces: `apps/web`, `apps/api`, `packages/contracts`
- Ortak ajan belgeleri ve `docs/`
- Express temeli: app/server ayrımı, environment doğrulaması, merkezî hata
  yönetimi, 404, Helmet, JSON body limiti, geliştirme loglaması, graceful
  shutdown, Prisma client yönetimi, `GET /api/health`
- React kabuğu: 7 rota, masaüstü sol menü, mobil navigasyon, boş durumlar,
  sistem bağlantı durumu göstergesi
- Production'da Express'in React build'ini sunması + SPA fallback
- Testler ve `npm run verify`

**Kapsam dışı:** domain tabloları, migration, iş kuralları, Socket.IO,
Railway yapılandırması

**Tamamlanma ölçütü:** `npm run verify` yeşil, production build tek origin
üzerinden açılıyor, veritabanı bağlantısı `SELECT 1` ile doğrulanmış, gerçek
secret commit edilmemiş, belgeler hazır, draft PR açılmış.

---

## Phase 1 — Authentication, personel, işletme, salon ve masa

**Branch:** `feat/phase-1-identity-tables`

- İlk işletme sahibini terminalden güvenli oluşturma
- Kullanıcı adı/şifre ile giriş, güvenli session cookie ve çıkış
- Sabit personel rolleri ve sunucu tarafı yetki kontrolü
- Personel ve işletme bilgileri yönetimi
- Salon ve masa yönetimi; `/masalar` ekranının gerçek verilerle çalışması
- Yönetim işlemleri için audit kayıt altyapısı
- İlk additive Prisma migration
- Backend ve frontend testleri

**Kapsam dışı:** kategori, ürün, adisyon, sipariş, ödeme, cari ve audit ekranı

---

## Phase 2 — Kategoriler, ürünler, seçenekler ve ekstralar

**Branch:** `feat/phase-2-menu-products` (base: `feat/phase-1-identity-tables`)

- **Kategori:** ekle, düzenle, pasife al, sırala, aynı ad tekrarını engelle
- **Ürün:** ad, kategori, fiyat (kuruş), hazırlık yeri (`KITCHEN` / `BAR`),
  aktif/pasif, sıralama, ekle/düzenle
- **Seçenek grubu:** tekli/çoklu seçim, zorunlu/isteğe bağlı, aktif/pasif, sıra
- **Seçenek değeri:** fiyat farkı (kuruş), aktif/pasif, sıra
  (ekstralar da çoklu seçimli bir grup olarak modellenir)
- Validation ve duplicate kontrolleri **backend'de**
- `/menu` ekranının gerçek PostgreSQL verisiyle çalışması; OWNER yönetir,
  diğer roller yalnız görüntüler
- Additive Prisma migration; `DELETE` yok, pasife alma var

**Kapsam dışı:** masa açma, adisyon, sipariş, Socket.IO, mutfak sipariş akışı,
ödeme, cari, stok, rapor, Railway deployment, security scan

---

## Phase 3 — Masa açma, adisyon ve sipariş

**Branch:** `feat/phase-3-orders`

- Masa açma, garson atama, kişi sayısı
- Adisyon oluşturma ve kalem ekleme
- Seçenek/ekstraların fiyata yansıması, sipariş notu
- Kalem adedi değiştirme ve kalem iptali (gerekçeli)
- Adisyon toplamının **sunucuda** hesaplanması
- Sipariş durum akışı: alındı → hazırlanıyor → hazır → servis edildi

**Kapsam dışı:** ödeme alma, hesap bölme

---

## Phase 4 — Gerçek zamanlı mutfak/bar ekranı

**Branch:** `feat/phase-4-realtime`

- Gerçek zamanlı iletişimin eklenmesi (Socket.IO)
- Yeni siparişlerin mutfak/bar ekranına anlık düşmesi
- Durum değişikliklerinin tüm cihazlarda anlık güncellenmesi
- Bağlantı kopması ve yeniden bağlanma davranışı
- Mutfak/bar ayrımı ve bekleme süresi göstergesi

---

## Phase 5 — Hesap kapatma, ödeme ve hesap bölme

**Branch:** `feat/phase-5-payments`

- Adisyon toplamı ve hesap kapatma
- Nakit, kart, karışık ödeme; para üstü
- Hesap bölme: tutara, kaleme ve kişiye göre
- Ödeme kayıtlarının değişmezliği
- Kuruş yuvarlama kurallarının tek noktada toplanması
- Kapsamlı para hesabı testleri

---

## Phase 6 — Cari hesap, indirim ve masa işlemleri

**Branch:** `feat/phase-6-accounts`

- Müşteri kartı ve cari hesap; adisyonu cariye aktarma, tahsilat, ekstre
- Yüzde/tutar indirimi ve ikram; yetki sınırı ve gerekçe
- Masa taşıma ve masa birleştirme
- Tüm bu işlemlerin işlem geçmişine yazılması

---

## Phase 7 — Raporlar, işlem geçmişi ve Railway deployment

**Branch:** `feat/phase-7-reports-deploy`

- Gün sonu özeti; ödeme türü dağılımı
- Ürün, kategori ve personel bazlı satış raporları
- İndirim/ikram dökümü; tarih aralığı filtresi
- İşlem geçmişi ekranı ve arama
- **Railway deployment** (ADR-002): Node.js servisi + Railway PostgreSQL,
  production environment değişkenleri, custom domain bağlama
- Yedekleme ve geri yükleme yönergesi
- Kullanım kılavuzu
