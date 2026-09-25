<div align="center">

<img src="apps/web/public/icons/icon-192.png" alt="Saydam Cafe" width="84" />

# Saydam Cafe — Kafe Adisyon Sistemi

**Masadan kasaya, tek ekranda.** Bir kafenin günlük operasyonunu uçtan uca
yöneten satış noktası (POS) uygulaması: masa ve adisyon, gerçek zamanlı mutfak
ekranı, ödeme, kasa, stok, QR menü ve raporlar.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-149eca?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express%205-417e38?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-336791?logo=postgresql&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-ger%C3%A7ek%20zamanl%C4%B1-010101?logo=socketdotio&logoColor=white)
![Testler](https://img.shields.io/badge/testler-248%20ge%C3%A7iyor-2f7d4f)

<img src="docs/screenshots/tour-01-servis.gif" alt="Giriş, özet, masa açma, sipariş, mutfak, ödeme ve rapor akışı" width="880" />

<sub>Giriş → özet ekranı → boş masayı açma → seçenekli ürün ve aramayla tatlı ekleme → mutfakta hazırlama → kartla ödeme ve hesabı kapatma → 30 günlük ciro grafiği</sub>

</div>

---

## Proje hakkında

Garsonun masayı açıp sipariş aldığı, siparişin anında mutfak ve bar ekranına
düştüğü, kasiyerin ödemeyi alıp vardiyayı kapattığı ve işletme sahibinin günü
raporlardan izlediği tam bir kafe sistemi. Web arayüzü, REST API, gerçek zamanlı
olay hattı ve ilişkisel veritabanıyla uçtan uca TypeScript olarak geliştirildi;
telefon, tablet ve masaüstünde çalışır.

## Neler yapıyor?

<table>
  <tr>
    <td width="50%" valign="top"><b>Masa ve adisyon</b> — Salon bazlı masa planı, açık süre ve tutar; seçenekli ürünler (süt tipi, ekstra shot), not, adet, gerekçeli iptal, ikram ve indirim.</td>
    <td width="50%" valign="top"><b>Gerçek zamanlı mutfak</b> — Siparişler Socket.IO ile anında mutfak/bar ekranına düşer; Yeni → Hazırlanıyor → Hazır akışı ve bekleme süresi uyarısı.</td>
  </tr>
  <tr>
    <td width="50%" valign="top"><b>Ödeme</b> — Nakit, kart, karma ödeme; tutara, kaleme veya kişiye göre hesap bölme; para üstü; cariye aktarma.</td>
    <td width="50%" valign="top"><b>Kasa (vardiya)</b> — Açılış nakdi, nakit giriş/çıkış, vardiya sonu sayım ve <b>otomatik sayım farkı</b>.</td>
  </tr>
  <tr>
    <td width="50%" valign="top"><b>Stok ve reçete</b> — Ürün reçetesine göre satışta otomatik düşüm, alım/fire/sayım hareketleri, eşik altı uyarısı.</td>
    <td width="50%" valign="top"><b>Raporlar</b> — Gün sonu, günlük ciro grafiği, ödeme türü, ürün/kategori/personel satışları, indirim ve ikram dökümü.</td>
  </tr>
  <tr>
    <td width="50%" valign="top"><b>QR menü</b> — Masadaki koddan açılan, personel ekranlarından ayrı müşteri sayfası: kapak fotoğrafı, öne çıkanlar, fotoğraflı ve açıklamalı ürünler, seçenek fiyatları; ayarlardan yazdırılabilir QR kartı.</td>
    <td width="50%" valign="top"><b>Termal fiş</b> — 80/58 mm adisyon bilgi fişi ve mutfak fişi; ek sürücü gerektirmeden tarayıcıdan.</td>
  </tr>
  <tr>
    <td width="50%" valign="top"><b>Cari hesap</b> — Müşteri bazlı borç, tahsilat ve ekstre; bakiye hareketlerden türetilir.</td>
    <td width="50%" valign="top"><b>Roller ve güvenlik</b> — İşletme sahibi, kasiyer, garson ve mutfak rolleri; yönetim ve para işlemleri işlem geçmişine yazılır.</td>
  </tr>
</table>

## Uygulama turu

Aşağıdaki kayıtların hepsi uygulamanın kendisinden, demo verisiyle ve ilgili
rolün hesabıyla alındı. Her biri bir özelliği baştan sona gösterir.

### Garson telefonu ve müşteri QR menüsü

<table>
  <tr>
    <td width="50%" align="center" valign="top"><img src="docs/screenshots/tour-02-garson.gif" alt="Garson telefonda masa açar, sipariş alır ve masayı taşır" width="300" /></td>
    <td width="50%" align="center" valign="top"><img src="docs/screenshots/tour-11-qr.gif" alt="Müşteri fotoğraflı QR menüde öne çıkanlara, ürün ayrıntısına ve kategorilere bakar" width="300" /></td>
  </tr>
  <tr>
    <td valign="top"><b>Garson</b> — Bahçedeki masayı telefondan açar; Türk kahvesini şeker tercihi, adet ve notla, menemeni kategoriden, latteyi aramayla ekler. Müşteri terasa geçmek isteyince adisyonu tek dokunuşla Teras 1'e taşır.</td>
    <td valign="top"><b>Müşteri</b> — Masadaki QR kodu okutur ve giriş yapmadan kafenin kendi menü sayfasına düşer. Öne çıkanlara göz atar, Türk kahvesinin ayrıntısında şeker seçeneklerini, serpme kahvaltının fotoğrafını ve açıklamasını görür; kategori çubuğu kaydırdıkça bulunduğu bölümü gösterir. Menü ve fiyatlar personel uygulamasıyla aynı veriden anında gelir.</td>
  </tr>
</table>

### Mutfak tableti — gerçek zamanlı sipariş

<img src="docs/screenshots/tour-03-mutfak.gif" alt="Mutfak ekranına canlı sipariş düşer ve durumu ilerletilir" width="880" />

Mutfak hesabıyla açılan tablet: garsonun Teras 2 için girdiği menemen ve tost,
sayfa yenilenmeden ekrana düşer. Aşçı istasyona göre (Mutfak / Bar) süzer,
siparişi **Yeni → Hazırlanıyor → Hazır → Servis edildi** olarak ilerletir.
Mutfak rolü yalnız özet ve mutfak ekranlarını görür.

### İndirim, ikram, hesap bölme ve karma ödeme

<img src="docs/screenshots/tour-04-odeme.gif" alt="Kasiyer indirim ve ikram uygular, hesabı kişiye göre böler, nakit ve kartla tahsil eder" width="880" />

Kasiyer adisyona gerekçeli %10 indirim uygular, tiramisuyu doğum günü ikramı
yapar; toplam anında güncellenir. Hesap **kişiye göre** ikiye bölünür, ilk pay
nakit alınır (para üstü hesaplanır), kalan kartla ödenir ve hesap kapanır.

### Masa birleştirme ve cari hesap

<img src="docs/screenshots/tour-05-cari.gif" alt="İki masa birleştirilir, kalan tutar cariye aktarılır ve tahsilat girilir" width="880" />

Bahçe 4'teki adisyon Bahçe 3'e birleştirilir, kalan tutar şirketin cari
hesabına yazılır ve masa kapanır. Cari ekstrede borç satırı görünür; ay sonu
havalesi tahsilat olarak girilince bakiye hareketlerden yeniden hesaplanır.

### Kasa ve vardiya sonu

<img src="docs/screenshots/tour-06-kasa.gif" alt="Kasadan nakit çıkışı, sayımla kasa kapanışı ve yeni vardiya açılışı" width="880" />

Çekmeceden süt alımı için nakit çıkışı yapılır; beklenen tutar düşer. Vardiya
sonunda sayılan nakit girilirken **sayım farkı canlı hesaplanır**, kasa
gerekçeyle kapatılır, geçmiş tabloya eklenir ve akşam vardiyası yeni açılış
nakdiyle başlar.

### Stok ve reçete

<img src="docs/screenshots/tour-07-stok.gif" alt="Stok alımı, fire, sayım düzeltmesi ve ürün reçetesi" width="880" />

Azalan limon için alım girilir ve uyarı kalkar; kırılan yumurta fire olarak
düşülür; akşam sayımında rafta sayılan süt miktarı yazılır, sistem farkı
düzeltme hareketi olarak kaydeder. Reçeteye malzeme eklenir: adisyon kapandıkça
stok reçeteye göre otomatik düşer.

### Menü yönetimi

<img src="docs/screenshots/tour-08-menu.gif" alt="Yeni ürün, seçenek grubu ve fiyat farklı seçenekler" width="880" />

Tatlılar kategorisine yeni ürün eklenir; ardından zorunlu, tek seçimli bir
seçenek grubu ("Meyve") ve fiyat farkıyla birlikte cevapları tanımlanır. Garson
ekranı bu ürünü eklerken artık meyve seçimini sorar.

### Raporlar

<img src="docs/screenshots/tour-09-rapor.gif" alt="Gün sonu, tarih ön ayarları, günlük ciro grafiği ve satış kırılımları" width="880" />

Gün sonu (nakit, kart, cari, indirim, ikram), saatlik satış dağılımı, son 7 ve
30 günün günlük ciro grafiği (üzerine gelince gün ayrıntısı, erişilebilir tablo
görünümü) ile ürün, kategori ve personel bazında satışlar.

### Ayarlar, personel ve işlem geçmişi

<img src="docs/screenshots/tour-10-ayarlar.gif" alt="Personel ekleme, masa ekleme, yazıcı ve QR kartı, işlem geçmişi filtreleri" width="880" />

İşletme sahibi yeni garsonu rolüyle ve geçici şifreyle ekler, terasa masa açar,
fiş yazıcısının kâğıt genişliğini seçer ve masalara konacak QR menü kartını
görür. İşlem geçmişinde kimin ne zaman ne yaptığı işlem türüne ve personele göre
süzülür.

<details>
<summary><b>Ekran görüntüleri</b></summary>

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/dashboard.png" alt="Özet ekranı" /><br /><sub><b>Özet</b> — açık masalar, mutfak durumu, çekmecedeki nakit ve azalan stok.</sub></td>
    <td width="50%"><img src="docs/screenshots/tables.png" alt="Masa planı" /><br /><sub><b>Masalar</b> — salon bazlı plan; açık masanın tutarı ve açık kalma süresi.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/check.png" alt="Adisyon ekranı" /><br /><sub><b>Adisyon</b> — menüden ürün ekleme, kalem durumları, fiş yazdırma.</sub></td>
    <td><img src="docs/screenshots/kitchen.png" alt="Mutfak ekranı" /><br /><sub><b>Mutfak</b> — yüksek kontrastlı, gerçek zamanlı hazırlık ekranı.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/reports.png" alt="Raporlar" /><br /><sub><b>Raporlar</b> — gün sonu ve günlük ciro grafiği.</sub></td>
    <td><img src="docs/screenshots/cash.png" alt="Kasa" /><br /><sub><b>Kasa</b> — çekmecede olması gereken tutar ve vardiya geçmişi.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/stock.png" alt="Stok" /><br /><sub><b>Stok</b> — satıştan otomatik düşen malzemeler ve uyarılar.</sub></td>
    <td><img src="docs/screenshots/menu.png" alt="Menü yönetimi" /><br /><sub><b>Menü</b> — kategori, ürün, fiyat ve seçenek yönetimi.</sub></td>
  </tr>
</table>

<table>
  <tr>
    <td width="25%"><img src="docs/screenshots/mobile-qr-menu.png" alt="QR menü" /><br /><sub><b>QR menü</b> (müşteri)</sub></td>
    <td width="25%"><img src="docs/screenshots/mobile-tables.png" alt="Mobil masa planı" /><br /><sub><b>Garson telefonu</b></sub></td>
    <td width="25%"><img src="docs/screenshots/mobile-kitchen.png" alt="Mobil mutfak" /><br /><sub><b>Mutfak ekranı (telefon)</b></sub></td>
    <td width="25%" valign="top"><img src="docs/screenshots/receipt.png" alt="Termal adisyon fişi" /><br /><sub><b>80 mm termal fiş</b></sub></td>
  </tr>
</table>

</details>

Tüm ekranlar telefon, tablet ve masaüstüne göre uyarlanır; dokunma hedefleri en
az 44 piksel, yatay taşma yoktur. Uygulama telefona ve tablete ana ekran
uygulaması olarak kurulabilir.

## Teknik olarak öne çıkanlar

- **Para her yerde tam sayı kuruş.** `Float` yok; indirim, hesap bölme ve artık
  kuruşlar deterministik dağıtılır.
- **Fiyat snapshot'ı.** Sipariş anındaki ürün adı, fiyatı ve seçenek farkları
  kaleme yazılır; menü sonradan değişse de geçmiş adisyon ve rapor bozulmaz.
- **Türetilen bakiyeler.** Cari bakiye, stok miktarı ve beklenen kasa nakdi
  mutable kolon değildir; değiştirilemeyen hareketlerden hesaplanır.
- **Eşzamanlılık güvenliği.** Hesap kapatma, masa birleştirme ve ödeme
  serializable transaction ve satır kilitleriyle korunur. Aynı masada tek açık
  adisyon ve tek açık kasa kuralını veritabanı kendisi garanti eder.
- **Gerçek zamanlı ama tutarlı.** Socket.IO yalnız "değişti" sinyali taşır;
  ekranlar veriyi her zaman REST'ten yeniden okur, böylece kaçan bir olay veriyi
  bozmaz.
- **Güvenlik.** HttpOnly oturum çerezi, rol bazlı yetki, giriş hız sınırı, CSRF
  ve WebSocket origin kontrolleri; istemcide ve sunucuda çalışma zamanı tip
  doğrulaması (zod ve tip koruyucuları).
- **Hiçbir şey silinmez.** Domain kayıtları fiziksel olarak silinmez, pasife
  alınır; tüm veritabanı migration'ları yalnız ekleme yapar.
- **Europe/Istanbul ve Türkçe.** Tarih/saat hesapları İstanbul saatine, arayüz
  ve hata mesajları Türkçeye göre tasarlandı.

## Mimari

```mermaid
flowchart LR
  subgraph Client["Tarayıcı · tablet · telefon"]
    UI["React 18 + TanStack Query<br/>apps/web/src/features/*"]
  end
  subgraph Server["Node.js · tek origin"]
    API["Express 5<br/>routes/index.ts"]
    MOD["modules/*<br/>routes · store · calculations"]
    RT["Socket.IO<br/>sipariş olayları"]
  end
  DB[("PostgreSQL<br/>Prisma")]
  C["packages/contracts<br/>ortak tipler"]
  UI -->|"/api · REST · cookie oturumu"| API
  API --> MOD
  MOD --> DB
  MOD --> RT
  RT -.->|değişiklik sinyali| UI
  C -.-> UI
  C -.-> MOD
```

- **Monorepo (npm workspaces):** `apps/web` arayüz, `apps/api` sunucu,
  `packages/contracts` iki tarafın paylaştığı tipler ve sabitler.
- **Alan bazlı modüller:** her iş alanı (adisyon, kasa, stok, menü…) arayüzde
  `features/<alan>/`, sunucuda `modules/<modül>/` altında kendi ekranı, API
  çağrıları, router'ı, veri erişimi ve iş kurallarıyla durur.
- **Tek origin:** Express hem API'yi hem React derlemesini sunar.

Ayrıntılı kod haritası ve bir isteğin uçtan uca yolculuğu:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

| Katman     | Teknoloji                                                                |
| ---------- | ------------------------------------------------------------------------ |
| Arayüz     | React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS 4 |
| Sunucu     | Node.js, Express 5, Socket.IO, Prisma ORM, Zod, Helmet                   |
| Veritabanı | PostgreSQL                                                               |
| Test       | Vitest, Supertest, React Testing Library                                 |
| Araçlar    | npm workspaces, ESLint, Prettier, GitHub Actions                         |

## Kalite ve geliştirme süreci

- **248 otomatik test** (API 166, arayüz 82). İş kuralları gerçek veritabanı
  gerektirmeyen bellek içi store'larla, ekranlar React Testing Library ile test
  edilir. Strict TypeScript ve ESLint her değişiklikte zorunlu.
- **Kod ve güvenlik incelemesi** yapıldı; bulunan her sorun (ör. kasa kapanışı
  ile ödeme arasındaki yarış durumu, CSRF) regresyon testiyle kapatıldı.
- **24 mimari karar kaydı (ADR)** gerekçeleriyle [DECISIONS.md](DECISIONS.md)
  içinde: neden kuruş, neden snapshot, neden türetilen bakiye, neden offline yok.
- **Yapay zekâ destekli, kurallı süreç.** Geliştirme, yapay zekâ kodlama
  ajanlarıyla (Claude ve Codex) bağlayıcı kurallar altında yürütüldü
  ([AGENTS.md](AGENTS.md)): aşama aşama plan, her aşama kendi branch'inde, test
  geçmeden iş bitmiş sayılmaz, veritabanında yıkıcı işlem yasak, her devir
  [HANDOFF.md](HANDOFF.md) ve [SESSION_LOG.md](SESSION_LOG.md) ile kayıtlı.

## Kapsam

Tek şube için tasarlandı. Yazarkasa/ÖKC (mali fiş) entegrasyonu yoktur; fişler
"bilgi fişi"dir. Uygulama çevrimiçi çalışır; POS verisinin güncelliği için
offline önbellek bilinçli olarak kullanılmaz.

---

## English summary

**Saydam Cafe** is a full-stack point-of-sale system for a café: table and check
management with menu options, a real-time kitchen display (Socket.IO), split
payments, customer accounts, cash-drawer shifts with automatic count variance,
recipe-based stock deduction, daily revenue charts, a photo-rich public QR menu page and 80/58 mm
thermal receipts. It is a TypeScript monorepo (React 18 + Vite, Express 5 +
Prisma + PostgreSQL) built around integer money, price snapshots, ledger-derived
balances, serializable transactions and strict typing, covered by 248 automated
tests.

## Lisans

Tüm hakları saklıdır — ayrıntı için [LICENSE](LICENSE). QR menüdeki ürün fotoğrafları
[Unsplash Lisansı](https://unsplash.com/license) ile kullanılır; kaynaklar
[apps/web/public/menu-photos/CREDITS.md](apps/web/public/menu-photos/CREDITS.md).
