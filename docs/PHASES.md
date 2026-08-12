# Phase Planı (0–7)

Her Phase kendi branch'inde çalışır ve draft PR ile kapanır.
**Bir Phase tamamlanmadan ve kullanıcı açıkça istemeden sonrakine geçilmez**
(bkz. [../AGENTS.md](../AGENTS.md) §2).

Branch adı kalıbı: `feat/phase-<n>-<konu>`

| Phase | Konu | Durum |
| --- | --- | --- |
| 0 | Yerel proje temeli, ajan iş akışı, UI altyapısı | **Tamamlandı — review bekliyor** |
| 1 | Veri modeli, personel ve yetkilendirme | Başlanmadı |
| 2 | Salon, masa ve menü yönetimi | Başlanmadı |
| 3 | Masa açma, adisyon ve sipariş | Başlanmadı |
| 4 | Gerçek zamanlı mutfak/bar ekranı | Başlanmadı |
| 5 | Hesap kapatma, ödeme ve hesap bölme | Başlanmadı |
| 6 | Cari hesap, indirim, masa taşıma/birleştirme | Başlanmadı |
| 7 | Raporlar, işlem geçmişi ve kurulum paketi | Başlanmadı |

---

## Phase 0 — Yerel proje temeli, ajan iş akışı ve UI altyapısı

**Branch:** `feat/phase-0-foundation`

**Kapsam**

- Git bootstrap: `main` başlangıç commit'i ve Phase branch'i
- npm workspaces: `apps/web`, `apps/api`, `packages/contracts`
- Ortak ajan belgeleri: AGENTS, CLAUDE, WORKFLOW, HANDOFF, SESSION_LOG, DECISIONS
- `docs/`: ürün kapsamı, mimari, Phase planı, UI rehberi
- Express temeli: ortam doğrulama, merkezî hata yönetimi, 404, gövde sınırı,
  Helmet, geliştirme loglaması, graceful shutdown, Prisma yaşam döngüsü,
  `GET /api/health`, app/server ayrımı
- React kabuğu: 7 rota, masaüstü kenar çubuğu, mobil gezinme, boş durumlar,
  canlı sistem durumu göstergesi
- Üretimde tek origin: Express, React derlemesini sunar
- Yerel ağ erişimi: `0.0.0.0`
- Testler: API 21, web 9
- `npm run verify` yeşil

**Kapsam dışı**

- Domain tabloları, kullanıcı tablosu, migration
- Socket.IO
- Herhangi bir iş kuralı

**Tamamlanma ölçütü**

`npm run verify` yeşil, üretim derlemesi tek URL'den açılıyor, veritabanı
bağlantısı `SELECT 1` ile doğrulanmış, gizli bilgi commit edilmemiş,
belgeler eksiksiz, draft PR açılmış.

---

## Phase 1 — Veri modeli, personel ve yetkilendirme

**Branch:** `feat/phase-1-data-model`

**Kapsam**

- Prisma şeması: personel, rol, salon, masa, kategori, ürün, adisyon,
  adisyon kalemi, ödeme, cari, işlem geçmişi
- İlk migration (kullanıcı onayıyla, mevcut veri korunarak)
- Para alanları `Int` (kuruş)
- Personel giriş akışı (PIN), oturum yönetimi
- Rol bazlı yetki kontrolü — sunucu tarafında
- Personel yönetim ekranı
- Şema ve yetki testleri

**Kapsam dışı:** sipariş akışı, ödeme, rapor

---

## Phase 2 — Salon, masa ve menü yönetimi

**Branch:** `feat/phase-2-catalog`

**Kapsam**

- Salon ve masa CRUD; masa sıralaması
- Kategori ve ürün CRUD; fiyat güncelleme
- Ürün seçenek grupları ve ekstralar
- Ürünü satışa kapatma
- Menü ve masalar ekranlarının gerçek verilerle çalışması
- Salon doluluk görünümünün iskeleti

**Kapsam dışı:** adisyon açma, sipariş

---

## Phase 3 — Masa açma, adisyon ve sipariş

**Branch:** `feat/phase-3-orders`

**Kapsam**

- Masa açma, garson atama, kişi sayısı
- Adisyon oluşturma ve kalem ekleme
- Seçenek ve ekstraların fiyata yansıması
- Sipariş notu
- Kalem adedi değiştirme ve kalem iptali (gerekçeli)
- Adisyon ara toplamının sunucuda hesaplanması
- Sipariş durum akışı: alındı → hazırlanıyor → hazır → servis edildi

**Kapsam dışı:** ödeme alma, hesap bölme

---

## Phase 4 — Gerçek zamanlı mutfak/bar ekranı

**Branch:** `feat/phase-4-realtime`

**Kapsam**

- Socket.IO'nun eklenmesi (ADR-012)
- Yeni siparişlerin mutfak/bar ekranına anlık düşmesi
- Durum değişikliklerinin tüm cihazlarda anlık güncellenmesi
- Bağlantı kopması ve yeniden bağlanma davranışı
- Mutfak/bar ayrımı ve bekleme süresi göstergesi

**Kapsam dışı:** ödeme, rapor

---

## Phase 5 — Hesap kapatma, ödeme ve hesap bölme

**Branch:** `feat/phase-5-payments`

**Kapsam**

- Adisyon toplamı ve hesap kapatma
- Nakit, kart, karışık ödeme; para üstü
- Hesap bölme: tutara, kaleme ve kişiye göre
- Ödeme kayıtlarının değişmezliği
- Kuruş yuvarlama kurallarının tek noktada toplanması
- Kapsamlı para hesabı testleri

**Kapsam dışı:** cari hesap, indirim

---

## Phase 6 — Cari hesap, indirim ve masa işlemleri

**Branch:** `feat/phase-6-accounts`

**Kapsam**

- Müşteri kartı ve cari hesap
- Adisyonu cariye aktarma, tahsilat, ekstre
- Yüzde/tutar indirimi ve ikram; yetki sınırı ve gerekçe
- Masa taşıma ve masa birleştirme
- Tüm bu işlemlerin işlem geçmişine yazılması

**Kapsam dışı:** raporlama ekranları

---

## Phase 7 — Raporlar, işlem geçmişi ve kurulum paketi

**Branch:** `feat/phase-7-reports`

**Kapsam**

- Gün sonu özeti; ödeme türü dağılımı
- Ürün, kategori ve personel bazlı satış raporları
- İndirim/ikram dökümü; tarih aralığı filtresi
- İşlem geçmişi ekranı ve arama
- Yedekleme ve geri yükleme yönergesi
- Kasa bilgisayarı için kurulum ve otomatik başlatma yönergesi
- Kullanım kılavuzu

**Kapsam dışı:** ADR-011'de sayılan tüm bulut ve donanım entegrasyonları
