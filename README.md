# Kafe Adisyon Sistemi

Cafe için adisyon ve satış noktası (POS) uygulaması.

Şu anda **yalnızca local geliştirme** yapılmaktadır. Production ortamında
uygulama bir custom domain üzerinden Railway'de çalışacak; Express hem API'yi
hem React production build'ini aynı origin üzerinden sunacaktır.

> **Phase durumu:** Phase 0–7 ve frontend deneyim tasarımı tamamlandı. Uygulama
> kapsamlı final review ve izole UAT'tan geçti; kullanıcı kabulü ve merge kararı
> bekleniyor. Kanıtlar: [docs/FINAL_ACCEPTANCE_REPORT.md](docs/FINAL_ACCEPTANCE_REPORT.md)
> Plan: [docs/PHASES.md](docs/PHASES.md)

---

## 1. Amaç

Kafede masa açmak, adisyon tutmak, sipariş almak, mutfağa iletmek, hesabı
kapatmak ve gün sonunu görmek. Kapsamın tamamı:
[docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md)

---

## 2. Teknik yapı

| Katman     | Teknoloji                                                                                |
| ---------- | ---------------------------------------------------------------------------------------- |
| Frontend   | React 18, TypeScript, Vite 6, React Router, TanStack Query, Tailwind CSS 4, Lucide React |
| Backend    | Node.js, Express 5, Socket.IO, TypeScript, Prisma ORM, Zod, Helmet                       |
| Veritabanı | PostgreSQL                                                                               |
| Paylaşım   | `packages/contracts` (ortak tipler ve sabitler)                                          |
| Test       | Vitest, Supertest, React Testing Library                                                 |
| Depo       | npm workspaces, TypeScript strict, ESLint, Prettier                                      |

```
apps/api            → Express sunucusu (production'da React build'ini de sunar)
apps/web            → React arayüzü
packages/contracts  → web ve api'nin paylaştığı tipler
```

### Local geliştirme

```
Frontend:   http://localhost:5173
Backend:    http://localhost:3000
PostgreSQL: localhost:5432/CafeAdisyon
```

### Hedeflenen production yapısı

```
Custom domain
    ↓
Railway Node.js servisi
    ├── Express API              → /api/*
    └── React production build   → /*
    ↓
Railway PostgreSQL
```

Frontend ve backend production'da **aynı origin** üzerindedir; bu yüzden
arayüz kodu API adresini hardcode etmez, yalnızca göreli `/api` yollarını
kullanır. Ayrıntı: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## 3. Gereksinimler

| Gereksinim | Sürüm                             |
| ---------- | --------------------------------- |
| Node.js    | 20.10 veya üzeri                  |
| npm        | 10 veya üzeri                     |
| PostgreSQL | 14 veya üzeri (15 ile doğrulandı) |
| Git        | güncel                            |

```powershell
node -v
npm -v
git --version
```

---

## 4. Kurulum

### 4.1 Depoyu alın ve bağımlılıkları kurun

```powershell
git clone https://github.com/salih12s/KafeAdisyonSistemi.git
cd KafeAdisyonSistemi
npm install
```

Kurulum sonunda Prisma client otomatik üretilir.

### 4.2 Local PostgreSQL kurulumu

PostgreSQL kurulu değilse [postgresql.org](https://www.postgresql.org/download/windows/)
üzerinden kurun. Kurulumda belirlediğiniz `postgres` parolasını not edin.

Veritabanı adı: **`CafeAdisyon`**

Yoksa pgAdmin ile ya da şu komutla oluşturun:

```powershell
& "C:\Program Files\PostgreSQL\15\bin\createdb.exe" -U postgres CafeAdisyon
```

> Veritabanı zaten varsa **hiçbir şey yapmayın.** Mevcut veritabanı silinmez
> veya resetlenmez — bkz. §10.

### 4.3 .env oluşturma

En kolayı:

```powershell
npm run setup:env
```

Betik parolanızı sorar ve `apps/api/.env` dosyasını yazar.
**Parola betiğin içinde yazılı değildir ve depoya gönderilmez.**

Elle yapmak isterseniz `apps/api/.env.example` dosyasını `apps/api/.env`
olarak kopyalayın ve `CHANGE_ME` yerine kendi parolanızı yazın:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:PAROLANIZ@localhost:5432/CafeAdisyon?schema=public
```

> Parolanızda `@ : / ? # [ ] %` gibi karakterler varsa URL kodlaması gerekir.
> `npm run setup:env` bunu kendisi yapar.

### 4.4 Migration'ı uygulayın ve bağlantıyı doğrulayın

Mevcut veritabanını sıfırlamadan, repodaki additive migration'ları uygulayın:

```powershell
npm run db:migrate:deploy
npm run db:migrate:status
```

Ardından bağlantıyı doğrulayın:

```powershell
npm run db:check
```

Beklenen çıktı:

```
PostgreSQL bağlantısı başarılı (SELECT 1).
```

`db:check` yalnızca okuma yapar; hiçbir tablo oluşturmaz veya değiştirmez.

### 4.5 İlk işletme sahibini oluşturun

İlk kurulumda bir kez çalıştırın:

```powershell
npm run setup:owner
```

Komut işletme adı, ad soyad, kullanıcı adı ve maskeli şifreyi terminalde sorar.
Aktif bir işletme sahibi zaten varsa yeni kayıt oluşturmayı reddeder. Varsayılan
veya demo hesap üretilmez.

---

## 5. Development çalıştırma

```powershell
npm run dev
```

| Adres                              | Ne                            |
| ---------------------------------- | ----------------------------- |
| `http://localhost:5173`            | Arayüz (Vite, anlık yenileme) |
| `http://localhost:3000/api/health` | API sağlık ucu                |

Vite, `/api` ve `/socket.io` çağrılarını Express'e iletir; ek yapılandırma gerekmez.
Local geliştirme servisleri varsayılan olarak bu cihazdan kullanılır. Yerel ağ/IP
üzerinden erişim bu projenin mevcut kapsamına dahil değildir.

---

## 6. Test komutları

| Komut                       | Ne yapar                                                   |
| --------------------------- | ---------------------------------------------------------- |
| `npm run lint`              | ESLint                                                     |
| `npm run typecheck`         | TypeScript tip denetimi (strict)                           |
| `npm run test`              | API ve web testleri                                        |
| `npm run build`             | Production derlemesi                                       |
| `npm run verify`            | lint → typecheck → test → build                            |
| `npm run db:check`          | Veritabanı bağlantısı (`SELECT 1`)                         |
| `npm run db:migrate:status` | Uygulanmış/bekleyen Prisma migration durumu                |
| `npm run db:migrate:deploy` | Repodaki bekleyen additive migration'ları uygular          |
| `npm run setup:owner`       | İlk işletme sahibi ve işletme kaydını interaktif oluşturur |
| `npm run format`            | Prettier ile biçimlendirme                                 |

Testler veritabanına bağlanmaz; PostgreSQL kapalıyken de çalışırlar.

---

## 7. Production build çalıştırma

```powershell
npm run build
npm start
```

Uygulama **tek adresten** açılır:

```
http://localhost:3000
```

Express hem arayüzü hem API'yi aynı porttan sunar; React Router için SPA
fallback çalışır (örneğin `/masalar` doğrudan açılabilir).

> Konsolda Türkçe karakterler bozuk görünüyorsa terminalin kod sayfasını
> değiştirin: `chcp 65001`. Sorun çıktıda değil, terminaldedir.

---

## 8. Railway deployment

Repo kökündeki `railway.json`, Railpack ile `npm ci && npm run build` çalıştırır,
deployment başlamadan önce yalnız güvenli `prisma migrate deploy` komutunu uygular
ve servisi `npm start` ile açar. Health check yolu `/api/health`'tir.

### 8.1 Proje ve PostgreSQL

1. Railway'de yeni proje oluşturup bu GitHub reposunu Node.js servisi olarak ekleyin.
2. Aynı projeye PostgreSQL servisi ekleyin.
3. Node.js servisinde `DATABASE_URL` değişkenini PostgreSQL servisinin sağladığı
   bağlantı değişkenine reference olarak bağlayın. Değeri README'ye veya GitHub'a
   kopyalamayın.
4. Aşağıdaki production değişkenlerini tanımlayın:

| Değişken          | Değer / kaynak                                            |
| ----------------- | --------------------------------------------------------- |
| `NODE_ENV`        | `production`                                              |
| `DATABASE_URL`    | Railway PostgreSQL reference                              |
| `PORT`            | Railway otomatik sağlar; elle sabitlemeyin                |
| `HOST`            | İsteğe bağlı; verilmezse production varsayılanı `0.0.0.0` |
| `LOG_LEVEL`       | `info` veya ihtiyaca göre `warn`                          |
| `JSON_BODY_LIMIT` | `1mb`                                                     |

Railway pre-deploy adımı her release'te `npm run db:migrate:deploy` çalıştırır.
Bu komut yalnız repodaki bekleyen migration'ları uygular; `migrate reset`, `DROP`
ve `TRUNCATE` kullanılmaz. Migration başarısızsa yeni deployment başlamaz.

### 8.2 Tek servis ve custom domain

Express aynı process/port üzerinde `/api`, `/socket.io` ve React production
build'ini sunar. Frontend göreli `/api` ve `/socket.io` yollarını kullandığından
hardcoded localhost veya CORS gerekmez; cookie production'da HttpOnly, Secure ve
SameSite=Strict'tir.

Deployment sağlıklı olduktan sonra Railway servisinin Networking/Custom Domain
bölümünden domaini ekleyin ve Railway'in gösterdiği DNS kaydını sağlayıcınızda
tanımlayın. Domain hazır olduğunda `/api/health`, `/masalar` doğrudan SPA açılışı
ve Socket.IO bağlantısını aynı HTTPS origin üzerinden kontrol edin.

### 8.3 Manuel doğrulama

Railway ile aynı akışı yerelde doğrulamak için:

```powershell
npm ci
npm run build
npm run db:migrate:deploy
$env:NODE_ENV="production"
npm start
```

`PORT` verilmezse 3000, `HOST` verilmezse production'da `0.0.0.0` kullanılır.

### 8.4 PostgreSQL backup ve restore

Backup dosyasını uygulama sunucusunda değil güvenli, erişimi sınırlı bir konumda
tutun. Railway PostgreSQL bağlantı adresini terminal ortam değişkeni olarak verin;
komut geçmişine açık parola yazmayın.

Custom-format backup:

```powershell
$env:PGDATABASE_URL="RAILWAY_DATABASE_URL"
pg_dump --format=custom --no-owner --no-acl --file=kafe-adisyon.dump $env:PGDATABASE_URL
```

Boş ve doğrulanmış hedef veritabanına custom-format restore:

```powershell
pg_restore --no-owner --no-acl --dbname=$env:PGDATABASE_URL kafe-adisyon.dump
```

Plain SQL tercih edilirse:

```powershell
pg_dump --no-owner --no-acl --file=kafe-adisyon.sql $env:PGDATABASE_URL
psql $env:PGDATABASE_URL --file=kafe-adisyon.sql
```

Restore mevcut veriyi etkileyebilir. Önce hedefi ve backup tarihini doğrulayın,
bakım penceresi belirleyin ve production restore işleminden önce ayrı bir test
veritabanında geri yükleme denemesi yapın.

---

## 9. Gizli bilgi güvenliği

- `apps/api/.env` **asla commit edilmez**; `.gitignore` içindedir.
- Depoda yalnızca `.env.example` ve `.env.test.example` bulunur; içlerinde
  gerçek değer değil `CHANGE_ME` yer alır.
- PostgreSQL parolanız bu README'de, dokümanlarda veya kodda yazılı değildir.
- `scripts/set-local-env.ps1` parolayı içinde tutmaz; çalışırken sorar.
- Commit öncesi diff gizli bilgi taramasından geçirilir
  (bkz. [AGENTS.md](AGENTS.md) §8).

Parolanız sızdıysa PostgreSQL'de değiştirin ve `.env` dosyasını güncelleyin.

---

## 10. Mevcut veritabanı resetlenmez

Bu depoda aşağıdakiler **yasaktır** ve hiçbir script bunları çalıştırmaz:

- `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`
- `prisma migrate reset`
- `prisma db push --force-reset`
- Tüm tabloları silen veya boşaltan scriptler
- Onay alınmadan çalıştırılan destructive migration

Mevcut `CafeAdisyon` veritabanı korunur; silinmez, resetlenmez, yeniden
oluşturulmaz. Bağlantı doğrulaması yalnızca `SELECT 1` ile yapılır. Domain
kayıtları ileride de fiziksel olarak silinmez; iptal ve pasife alma alanları
kullanılır (bkz. [DECISIONS.md](DECISIONS.md) ADR-011).

Yeni migration gerektiren bir değişiklikte SQL önce create-only üretilir ve
baştan sona incelenir. Phase 0–7 boyunca eklenen yedi migration additive olarak
tasarlanmıştır; final kabulde tamamen boş izole veritabanına sırasıyla uygulanmış
ve destructive SQL içermedikleri doğrulanmıştır.

---

## 11. Proje belgeleri

| Belge                                                              | İçerik                                  |
| ------------------------------------------------------------------ | --------------------------------------- |
| [AGENTS.md](AGENTS.md)                                             | Claude ve Codex için bağlayıcı kurallar |
| [CLAUDE.md](CLAUDE.md)                                             | Claude'un çalışma başlangıcı            |
| [HANDOFF.md](HANDOFF.md)                                           | Aktif Phase, branch ve devir kaydı      |
| [DECISIONS.md](DECISIONS.md)                                       | Kalıcı teknik kararlar (ADR)            |
| [WORKFLOW.md](WORKFLOW.md)                                         | Phase çalışma düzeni                    |
| [SESSION_LOG.md](SESSION_LOG.md)                                   | Oturum kayıtları (append-only)          |
| [docs/PHASES.md](docs/PHASES.md)                                   | Phase 0–7 planı                         |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                       | Mimari                                  |
| [docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md)                     | Ürün kapsamı                            |
| [docs/UI_GUIDE.md](docs/UI_GUIDE.md)                               | Arayüz rehberi                          |
| [docs/FINAL_ACCEPTANCE_REPORT.md](docs/FINAL_ACCEPTANCE_REPORT.md) | Final review ve UAT kanıtları           |
| [scripts/qa/README.md](scripts/qa/README.md)                       | Tekrarlanabilir final UAT yardımcıları  |
