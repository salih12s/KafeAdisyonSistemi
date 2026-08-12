# Ürün Kapsamı

Kafe Adisyon Sistemi'nin **ilk sürüm** kapsamı. Buradaki maddeler ürünün
"tamamlandı" sayılması için gereken işlevlerdir; Phase dağılımı için bkz.
[PHASES.md](PHASES.md).

---

## 1. Kapsam içi

### 1.1 Personel ve roller

- Personel kaydı (ad, kullanıcı adı, bcrypt ile korunan şifreyle giriş)
- Roller: işletme sahibi, kasiyer, garson, mutfak
- Rol bazlı yetki: iskonto verme, adisyon iptali, gün sonu alma gibi
  hassas işlemler yalnızca yetkili rollere açıktır
- Her işlemin hangi personel tarafından yapıldığının kaydı

### 1.2 Salonlar ve masalar

- Birden çok salon tanımı (iç salon, bahçe, teras vb.)
- Salon içinde masa tanımı ve sıralaması
- Masa durumu: boş, dolu, hesap istendi
- Salon bazlı doluluk görünümü

### 1.3 Menü ve kategoriler

- Kategori tanımı ve sıralaması
- Ürün tanımı: ad, kategori, fiyat (kuruş), hazırlık yeri (mutfak/bar)
- Ürünü geçici olarak satışa kapatma
- Fiyat güncelleme

### 1.4 Ürün seçenekleri ve ekstralar

- Zorunlu seçenek grupları (örn. "porsiyon: tam / yarım")
- İsteğe bağlı ekstralar ve fiyat farkı (örn. "ekstra shot")
- Sipariş notu (örn. "az şekerli")

### 1.5 Masa açma

- Boş masayı açma ve garson atama
- Kişi sayısı girişi
- Açık masanın açılış saati ve süresi

### 1.6 Adisyon

- Masaya bağlı adisyon
- Adisyon kalemleri, adetler ve ara toplam
- Adisyon durumu: açık, ödendi, iptal
- Adisyon üzerinde kalem ekleme, adet değiştirme, kalem iptali

### 1.7 Sipariş

- Adisyona sipariş ekleme
- Siparişin mutfağa/bara gönderilmesi
- Sipariş durumu: alındı, hazırlanıyor, hazır, servis edildi
- Sipariş iptali ve gerekçesi

### 1.8 Mutfak / bar ekranı

- Bekleyen siparişlerin sıralı listesi
- Mutfak ve bar ayrımı
- Hazırlanıyor / hazır durum geçişleri
- Bekleme süresi göstergesi

### 1.9 Hesap kapatma

- Adisyon toplamının hesaplanması
- Ödeme alma ve masanın kapanması
- Kapanan adisyonun işlem geçmişine yazılması

### 1.10 Ödeme türleri

- Nakit
- Kart
- Cari hesaba yazma
- Karışık ödeme (tek adisyon için birden çok ödeme satırı)
- Para üstü hesaplama (nakit)

### 1.11 Hesap bölme

- Tutara göre bölme
- Kalemlere göre bölme
- Kişi sayısına göre eşit bölme
- Bölünen her parçanın ayrı ödeme türüyle kapanabilmesi

### 1.12 Masa taşıma ve birleştirme

- Açık adisyonu başka masaya taşıma
- İki açık adisyonu tek masada birleştirme
- Her iki işlemin işlem geçmişine kaydı

### 1.13 İndirim ve ikram

- Adisyon geneline veya tek kaleme yüzde/tutar indirimi
- İkram (ücretsiz) işaretleme
- İndirim ve ikram gerekçesi
- Yetkiye bağlı sınırlama

### 1.14 Müşteri cari hesabı

- Müşteri kartı (ad, telefon, not)
- Adisyonu cariye aktarma
- Tahsilat kaydı
- Cari bakiye ve hesap ekstresi

### 1.15 Temel raporlar

- Gün sonu özeti (toplam ciro, adisyon sayısı, ortalama adisyon)
- Ödeme türüne göre dağılım
- Ürün ve kategori bazlı satış
- İndirim ve ikram dökümü
- Personel bazlı satış
- Tarih aralığı filtresi

### 1.16 İşlem geçmişi

- Kim, ne zaman, hangi işlemi yaptı
- Adisyon iptali, kalem iptali, indirim, masa taşıma/birleştirme kayıtları
- Kayıtlar silinmez (bkz. [../DECISIONS.md](../DECISIONS.md) ADR-010)

---

## 2. Kapsam dışı

Aşağıdakiler **ilk sürümde geliştirilmeyecektir.** Talep gelirse ayrı bir
karar ve Phase gerekir.

| Konu                                        | Neden kapsam dışı                                     |
| ------------------------------------------- | ----------------------------------------------------- |
| Stok ve reçete takibi                       | Kendi başına bir ürün; adisyon akışını geciktirir     |
| Termal yazıcı / fiş yazdırma                | Donanım bağımlılığı ve sürücü çeşitliliği             |
| ÖKC / yazarkasa entegrasyonu                | Yasal sertifikasyon ve donanım gerektirir             |
| Online ödeme                                | Ödeme sağlayıcı entegrasyonu ve uyum yükü             |
| QR menü                                     | Müşteriye açık ayrı bir arayüz gerektirir             |
| Rezervasyon                                 | Ayrı bir domain; masa akışını karmaşıklaştırır        |
| Paket servis platformları (Yemeksepeti vb.) | Dış servis entegrasyonu                               |
| Çoklu işletme ve çoklu şube                 | ADR-007: tek işletme, tek şube                        |
| Offline çalışma / PWA service worker        | İlk sürümde ihtiyaç yok                               |
| Yerel ağ üzerinden IP bağlantısı            | ADR-001: şimdilik yalnızca local geliştirme           |
| Native mobil uygulama, Electron             | Tarayıcı üzerinden erişim yeterlidir                  |
| Docker                                      | Railway doğrudan Node.js servisi çalıştırır (ADR-002) |

> **Not:** Railway'e deployment kapsam **dışı değildir**; production hedefidir
> (ADR-002) ve Phase 7'de yapılır. Bu aşamada yalnızca yapılandırması yazılmaz.

---

## 3. Kısıtlar

- Arayüz dili Türkçe, para birimi TRY, zaman dilimi Europe/Istanbul.
- Para değerleri tam sayı kuruş (ADR-008).
- Şu anda yalnızca local geliştirme yapılır (ADR-001); production hedefi
  Railway'dir (ADR-002).
- Frontend ve backend production'da aynı origin üzerindedir (ADR-004).
- Kullanım dokunmatik tablet ve telefonu kapsar: en küçük dokunma hedefi 44px.
