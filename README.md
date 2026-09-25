<div align="center">

<img src="apps/web/public/icons/icon-192.png" alt="Joker Cafe" width="84" />

# Joker Cafe — Kafe Adisyon Sistemi

**Masadan kasaya, tek ekranda.** Masa ve adisyon yönetimi, gerçek zamanlı mutfak
ekranı, kasa, stok, QR menü ve raporlar için uçtan uca bir satış noktası (POS)
uygulaması.

[![CI](https://github.com/salih12s/KafeAdisyonSistemi/actions/workflows/ci.yml/badge.svg)](https://github.com/salih12s/KafeAdisyonSistemi/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-149eca?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-417e38?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)
![Testler](https://img.shields.io/badge/testler-243%20ge%C3%A7iyor-2f7d4f)

<img src="docs/screenshots/demo.gif" alt="Masa açma, sipariş, mutfak, ödeme ve rapor akışı" width="880" />

<sub>Boş masayı açma → seçenekli ürün ekleme → mutfakta hazırlama → kartla ödeme ve hesabı kapatma → 30 günlük ciro grafiği</sub>

</div>

---

## Neler yapıyor?

|                                                                                                                                                            |                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Masa ve adisyon** — Salon bazlı masa planı, açık süre ve tutar; seçenekli ürünler (süt tipi, ekstra shot), not, adet, gerekçeli iptal, ikram ve indirim. | **Gerçek zamanlı mutfak** — Siparişler Socket.IO ile anında mutfak/bar ekranına düşer; Yeni → Hazırlanıyor → Hazır akışı ve bekleme süresi uyarısı. |
| **Ödeme** — Nakit, kart, karma ödeme; tutara, kaleme veya kişiye göre hesap bölme; para üstü; cariye aktarma.                                              | **Kasa (vardiya)** — Açılış nakdi, nakit giriş/çıkış, vardiya sonu sayım ve **otomatik sayım farkı**.                                               |
| **Stok ve reçete** — Ürün reçetesine göre satışta otomatik düşüm, alım/fire/sayım hareketleri, eşik altı uyarısı.                                          | **Raporlar** — Gün sonu, günlük ciro grafiği, ödeme türü, ürün/kategori/personel satışları, indirim ve ikram dökümü.                                |
| **QR menü** — Masadaki koddan açılan, oturumsuz, mobil uyumlu menü; ayarlardan yazdırılabilir QR kartı.                                                    | **Termal fiş** — 80/58 mm adisyon bilgi fişi ve mutfak fişi; ek sürücü gerektirmeden tarayıcıdan.                                                   |
| **Cari hesap** — Müşteri bazlı borç, tahsilat ve ekstre; bakiye hareketlerden türetilir.                                                                   | **Roller ve güvenlik** — İşletme sahibi, kasiyer, garson ve mutfak rolleri; yönetim ve para işlemleri işlem geçmişine yazılır.                      |

## Ekranlar

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
    <td width="25%"><img src="docs/screenshots/mobile-kitchen.png" alt="Mobil mutfak" /><br /><sub><b>Mutfak tableti</b></sub></td>
    <td width="25%" valign="top"><img src="docs/screenshots/receipt.png" alt="Termal adisyon fişi" /><br /><sub><b>80 mm termal fiş</b></sub></td>
  </tr>
</table>

## Teknik olarak öne çıkanlar

- **Para her yerde tam sayı kuruş.** `Float` yok; indirim, bölme ve artık
  kuruşlar deterministik dağıtılır.
- **Fiyat snapshot'ı.** Sipariş anındaki ürün adı, fiyatı ve seçenek farkları
  kaleme yazılır; menü sonradan değişse de geçmiş adisyon ve rapor bozulmaz.
- **Türetilen bakiyeler.** Cari bakiye, stok miktarı ve beklenen kasa nakdi
  mutable kolon değildir; değiştirilemeyen hareketlerden hesaplanır.
- **Eşzamanlılık güvenliği.** Hesap kapatma, masa birleştirme ve ödeme
  serializable transaction ve satır kilitleriyle korunur. Aynı masada tek açık
  adisyon ve tek açık kasa kuralını veritabanı kendisi garanti eder.
- **Güvenlik.** HttpOnly oturum çerezi, rol bazlı yetki, giriş hız sınırı, CSRF
  ve WebSocket origin kontrolleri, istemcide ve sunucuda çalışma zamanı tip
  doğrulaması (zod ve tip koruyucuları).
- **Hiçbir şey silinmez.** Domain kayıtları fiziksel olarak silinmez; pasife
  alınır. Tüm migration'lar yalnız ekleme yapar.
- **Kalite.** Strict TypeScript, ESLint, **243 test** (API 164 + arayüz 79) ve her
  push'ta çalışan CI. Gerçek veritabanı gerektirmeyen bellek içi store'larla
  hızlı testler.
- **Kararlar kayıtlı.** 24 mimari karar kaydı (ADR) gerekçeleriyle
  [DECISIONS.md](DECISIONS.md) içinde.

## Mimari

```mermaid
flowchart LR
  subgraph Tarayıcı["Tarayıcı / tablet / telefon"]
    UI["React 18 + TanStack Query<br/>features/&lt;alan&gt;/"]
  end
  subgraph Sunucu["Node.js — tek origin"]
    API["Express 5<br/>routes/index.ts"]
    MOD["modules/&lt;modül&gt;<br/>routes · store · calculations"]
    RT["Socket.IO<br/>sipariş olayları"]
  end
  DB[("PostgreSQL<br/>Prisma")]
  C["packages/contracts<br/>ortak tipler"]
  UI -- "/api (REST, cookie oturumu)" --> API --> MOD --> DB
  RT -. "değişiklik sinyali" .-> UI
  MOD --> RT
  C -.-> UI
  C -.-> MOD
```

Web ve API aynı depoda (npm workspaces) ve aynı origin üzerinden sunulur. Kod
alana göre modüllenmiştir: arayüzde `apps/web/src/features/<alan>/`, sunucuda
`apps/api/src/modules/<modül>/`. Ayrıntılı kod haritası ve bir isteğin uçtan uca
yolculuğu: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

| Katman     | Teknoloji                                                                |
| ---------- | ------------------------------------------------------------------------ |
| Arayüz     | React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS 4 |
| Sunucu     | Node.js, Express 5, Socket.IO, Prisma ORM, Zod, Helmet                   |
| Veritabanı | PostgreSQL                                                               |
| Test       | Vitest, Supertest, React Testing Library                                 |
| Araçlar    | npm workspaces, ESLint, Prettier, GitHub Actions                         |

## Hızlı başlangıç (demo verisiyle)

Gereksinimler: **Node.js 20+** ve **PostgreSQL 14+**.

```bash
git clone https://github.com/salih12s/KafeAdisyonSistemi.git
cd KafeAdisyonSistemi
npm install

# Ayrı bir demo veritabanı oluşturun (gerçek verinize dokunmaz)
createdb -U postgres KafeAdisyonDemo
export DATABASE_URL="postgresql://postgres:PAROLANIZ@localhost:5432/KafeAdisyonDemo?schema=public"
# Windows PowerShell: $env:DATABASE_URL = "postgresql://..."

npm run db:migrate:deploy   # şemayı kurar
npm run demo:seed           # 30 günlük örnek işletme verisi
npm run dev                 # http://localhost:5173
```

| Kullanıcı | Rol            | Şifre       |
| --------- | -------------- | ----------- |
| `demo`    | İşletme sahibi | `Demo1234!` |
| `elif`    | Kasiyer        | `Demo1234!` |
| `mert`    | Garson         | `Demo1234!` |
| `mutfak`  | Mutfak         | `Demo1234!` |

Demo komutu yalnız adı `demo` içeren boş bir veritabanına yazar. Gerçek işletme
kurulumu (ilk yönetici, ortam değişkenleri, yedekleme, dağıtım):
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

```bash
npm run verify   # lint → typecheck → test → build
```

## Geliştirme süreci

Proje, yapay zekâ kodlama ajanlarıyla (Claude ve Codex) **kurallı bir süreçle**
geliştirildi. Bağlayıcı kurallar [AGENTS.md](AGENTS.md) içindedir: aynı anda tek
ajan kod yazar, her iş kendi branch'inde ilerler, test geçmeden iş bitmiş sayılmaz,
veritabanında yıkıcı işlem yasaktır. Her teknik karar [DECISIONS.md](DECISIONS.md)
içinde gerekçesiyle kayıtlıdır; devir notları [HANDOFF.md](HANDOFF.md), oturum
kayıtları [SESSION_LOG.md](SESSION_LOG.md) içindedir.

## Kapsam

Tek şube için tasarlandı. Yazarkasa/ÖKC (mali fiş) entegrasyonu yoktur; fişler
"bilgi fişi"dir. Uygulama çevrimiçi çalışır; POS verisinin güncelliği için
offline önbellek bilinçli olarak kullanılmaz.

---

## English summary

**Joker Cafe** is a full-stack point-of-sale system for a café: table and check
management with menu options, a real-time kitchen display (Socket.IO), split
payments, customer accounts, cash-drawer shifts with automatic count variance,
recipe-based stock deduction, daily revenue charts, a public QR menu and 80/58 mm
thermal receipts. It is a TypeScript monorepo (React 18 + Vite, Express 5 +
Prisma + PostgreSQL) with money stored as integer minor units, price snapshots,
ledger-derived balances, serializable transactions, strict typing and 243
automated tests. Run it locally with `npm run demo:seed` and log in as
`demo` / `Demo1234!`.

## Lisans

Tüm hakları saklıdır — ayrıntı için [LICENSE](LICENSE).
