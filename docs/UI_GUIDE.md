# Arayüz Rehberi

Bu belge tasarım kararlarını ve bağlayıcı arayüz kurallarını tanımlar.
Amaç net: uygulama **gerçek bir cafe POS/adisyon sistemi** gibi görünmelidir.
Jenerik bir yapay zekâ dashboard'u, landing page veya hazır admin şablonu
gibi görünmemelidir.

---

## 1. Tasarım ilkesi

Bu bir **çalışma aracıdır**, bir tanıtım sayfası değil. Garson yoğun serviste
masaya bakıp iki saniyede durumu anlamalıdır. Buna göre:

- Bilgi yoğunluğu yüksek, boşluk ölçülü — kompakt ama sıkışık değil
- Durum renkleri net ve az sayıda
- Tipografi küçük ama okunaklı; süs yok
- Her ekranın tek bir işi var
- Animasyon yalnızca durum geçişini anlatıyorsa var

---

## 2. Kesinlikle kaçınılacaklar

| Yasak | Neden |
| --- | --- |
| Mor-mavi neon gradient | Jenerik AI şablonu izlenimi verir |
| Glassmorphism / bulanık cam yüzey | Okunabilirliği düşürür, ucuz görünür |
| Glow ve parlama efektleri | POS ekranında dikkat dağıtır |
| Arka planda rastgele blob şekilleri | Anlamsız görsel gürültü |
| Her şeyi dev kartlara bölmek | Ekran başına bilgi miktarını düşürür |
| Gereksiz yuvarlak "pill" tasarımlar | Süs; hizalamayı bozar |
| Büyük pazarlama başlıkları | Burası bir ürün sayfası değil |
| Lorem ipsum / sahte veri | Gerçek durumu gizler, güven kırar |
| İngilizce arayüz metni | Kullanıcı Türkçe konuşur |
| Sahte "AI destekli" açıklamalar | Yanıltıcı |
| Landing page görünümü | Yanlış ürün algısı |
| Değiştirilmemiş hazır şablon görünümü | Ürüne ait değil |
| Çalışmayan/disabled placeholder buton | Kullanıcıyı yanıltır |

**Boş bölüm kuralı:** Bir modül henüz çalışmıyorsa oraya devre dışı buton
konmaz. Yalnızca durumu ve ileride ne olacağını anlatan **anlamlı bir boş
durum** gösterilir (`EmptyState` bileşeni).

---

## 3. Renk paleti

| Rol | Değer | Kullanım |
| --- | --- | --- |
| Ana koyu | `#2B2118` | Kenar çubuğu, birincil düğme zemini |
| Ana koyu (yumuşak) | `#3A2E22` | Kenar çubuğunda aktif/hover satır |
| Arka plan | `#F6F2EA` | Sayfa zemini |
| Yüzey | `#FFFFFF` | Paneller, listeler, tablolar |
| Vurgu | `#C76B2A` | Aktif göstergesi, odak halkası, seçili durum |
| Başarılı | `#2E7D4F` | Bağlı, ödendi, hazır |
| Tehlike | `#B83A3A` | Bağlantı yok, iptal, hata |
| Kenarlık | `#DED6CA` | Panel ve satır ayırıcıları |
| Metin | `#241E19` | Birincil metin |
| İkincil metin | `#71675E` | Etiket, açıklama, meta |

Kurallar:

- Vurgu rengi **eylem ve seçim** içindir; dekorasyon için kullanılmaz.
- Renk tek başına anlam taşımaz; yanında her zaman metin bulunur
  (renk körlüğü ve parlak ışık altında okunabilirlik).
- Gradient yoktur. Gölge yoktur; ayrım kenarlıkla yapılır.

Belirteçler `apps/web/src/styles/index.css` içinde `@theme` bloğunda
tanımlıdır. Renk değeri bileşen içine doğrudan yazılmaz.

---

## 4. Tipografi

Font yığını (Windows ve mobil cihazlarda güvenilir, indirme yok):

```
'Segoe UI', 'Segoe UI Variable Text', system-ui, -apple-system,
'Helvetica Neue', Arial, 'Noto Sans', sans-serif
```

- Temel gövde: 15px / 1.45
- Sayfa başlığı: 16–18px, yarı kalın
- Panel başlığı: 13px, büyük harf, harf aralığı geniş, ikincil renk
- Meta ve açıklama: 12–13px, ikincil renk
- Dış font indirilmez — internet yokken de aynı görünmelidir.
- Sayısal sütunlarda `font-variant-numeric: tabular-nums` (`.tabular` sınıfı)
  kullanılır; tutarlar alt alta hizalı okunur.

---

## 5. Yerleşim

### Masaüstü (≥1024px)

```
┌────────────┬──────────────────────────────────────────┐
│            │  Üst bar: başlık · saat · sistem durumu  │
│  Sabit sol ├──────────────────────────────────────────┤
│  navigasyon│                                          │
│  (224px)   │  İçerik alanı                            │
│            │                                          │
└────────────┴──────────────────────────────────────────┘
```

- Kenar çubuğu sabittir, kaydırılmaz (`sticky`, tam yükseklik).
- Aktif öğe: sol kenarında vurgu rengi çubuk + koyu yumuşak zemin + beyaz metin.
- Üst bar `sticky`; içerik kaydırılırken başlık ve durum görünür kalır.
- 1440px genişlikte içerik alanı verimli kullanılır; ortada dar bir sütuna
  sıkıştırılmaz.

### Tablet (~768px)

- Kenar çubuğu henüz görünmez; alt gezinme kullanılır.
- Üst barda saat ve tarih görünür hâle gelir.
- Durum paneli iki sütundan dört sütuna geçer (`md` kırılımı).
- Dokunma hedefleri masaüstünde de 44px altına düşmez.

### Mobil (<768px)

- Kenar çubuğu **gizlenir**. Daraltılıp ikon şeridine sıkıştırılmaz.
- Alt gezinme çubuğu: en sık kullanılan 4 modül (Özet, Masalar, Menü, Mutfak)
  ve **Tümü** düğmesi.
- **Tümü**, alttan açılan bir çekmece açar; çekmecede **yedi modülün tamamı**
  ad ve açıklamasıyla, tam okunabilir biçimde listelenir.
- Çekmece `Esc` ile, arka plana dokunarak ve kapat düğmesiyle kapanır;
  rota değişince kendiliğinden kapanır.
- İçerik alanının altında, alt çubuğun altında kalmaması için boşluk bırakılır.
- `env(safe-area-inset-bottom)` dikkate alınır (çentikli ekranlar).

Kontrol genişlikleri: **390px** (telefon), **768px** (tablet),
**1440px** (masaüstü).

---

## 6. Dokunma ve erişilebilirlik

- **En küçük dokunma hedefi 44px** (`min-h-touch` = 2.75rem). Gezinme öğeleri,
  liste satırları ve düğmeler bu ölçüye uyar.
- Odak durumu her yerde görünür: 2px vurgu rengi çerçeve, 2px offset.
  `outline: none` kullanılmaz.
- İkonlar `aria-hidden`; anlam her zaman metinle taşınır.
- Yalnızca ikondan oluşan düğmelerde `sr-only` metin bulunur.
- Çekmece `role="dialog"` + `aria-modal` + `aria-label` taşır.
- Gezinme bölgeleri ayrı `aria-label` ile adlandırılır ("Ana menü",
  "Alt gezinme", "Tüm modüller listesi").
- Sayfa başına tek `<h1>`; başlık düzeyi atlanmaz.
- `lang="tr"`.

---

## 7. Taşma ve duyarlılık

- **Mobilde yatay taşma olmaz.** `body` üzerinde `overflow-x: hidden`,
  esnek kutularda `min-w-0`, uzun metinlerde `truncate`.
- Genişliği sabit bileşen kullanılmaz; ölçüler `rem` ve yüzdedir.
- Geniş içerik (ileride tablo/rapor) kendi kapsayıcısı içinde yatay kaydırılır,
  sayfayı kaydırmaz.

---

## 8. Bileşen sözlüğü

| Bileşen | Görev |
| --- | --- |
| `AppLayout` | Kenar çubuğu + üst bar + içerik + alt gezinme kabuğu |
| `Sidebar` | Masaüstü sol navigasyon |
| `TopBar` | Sayfa başlığı, saat, sistem durumu |
| `MobileNav` | Alt gezinme çubuğu ve tüm modüller çekmecesi |
| `HealthIndicator` | Canlı sunucu/veritabanı durumu rozeti |
| `Panel` | Kenarlıklı içerik yüzeyi; isteğe bağlı başlık ve meta |
| `EmptyState` | Veri/işlev yokken durumu anlatan blok |

Yeni bileşen yazmadan önce bu listeye bakılır; aynı işi yapan ikinci bir
bileşen üretilmez.

---

## 9. Metin dili

- Tüm arayüz metinleri **Türkçe**dir.
- Metin dürüsttür: bir şey çalışmıyorsa "yakında" denmez, ne olduğu yazılır.
- Hata mesajı kullanıcıya **ne yapacağını** söyler:
  *"API sunucusuna ulaşılamıyor. Sunucunun çalıştığını ve bağlantı ayarlarını
  doğrulayın."*
- Teknik terim gerekiyorsa Türkçe karşılığıyla birlikte kullanılır.
- Tarih, saat ve sayı biçimi `tr-TR`; saat dilimi `Europe/Istanbul`;
  para birimi `TRY`.

---

## 10. Durum renkleri sözlüğü

Bu eşleme Phase'ler boyunca korunur:

| Durum | Renk | Örnek |
| --- | --- | --- |
| İyi / bağlı / ödendi / hazır | Başarılı `#2E7D4F` | Sistem bağlı, hesap kapandı |
| Dikkat / seçili / aktif | Vurgu `#C76B2A` | Aktif menü, seçili masa |
| Hata / kopuk / iptal | Tehlike `#B83A3A` | Veritabanı yok, adisyon iptal |
| Nötr / boş / bekliyor | İkincil metin `#71675E` | Boş masa, kontrol ediliyor |
