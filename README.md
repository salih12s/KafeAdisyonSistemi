# Kafe Adisyon Sistemi

Cafe için adisyon ve satış noktası (POS) uygulaması.

Şu anda **yalnızca local geliştirme** yapılmaktadır. Production ortamında
uygulama bir custom domain üzerinden Railway'de çalışacak; Express hem API'yi
hem React production build'ini aynı origin üzerinden sunacaktır.

> **Phase durumu:** Phase 0 (proje temeli) tamamlandı, Codex review'u bekliyor.
> Masa açma, sipariş, ödeme ve raporlama işlevleri henüz yoktur.
> Plan: [docs/PHASES.md](docs/PHASES.md)

---

## 1. Amaç

Kafede masa açmak, adisyon tutmak, sipariş almak, mutfağa iletmek, hesabı
kapatmak ve gün sonunu görmek. Kapsamın tamamı:
[docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md)

---

## 2. Teknik yapı

| Katman | Teknoloji |
| --- | --- |
| Frontend | React 18, TypeScript, Vite 6, React Router, TanStack Query, Tailwind CSS 4, Lucide React |
| Backend | Node.js, Express 5, TypeScript, Prisma ORM, Zod, Helmet |
| Veritabanı | PostgreSQL |
| Paylaşım | `packages/contracts` (ortak tipler ve sabitler) |
| Test | Vitest, Supertest, React Testing Library |
| Depo | npm workspaces, TypeScript strict, ESLint, Prettier |

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

### Gelecekteki production yapısı

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

| Gereksinim | Sürüm |
| --- | --- |
| Node.js | 20.10 veya üzeri |
| npm | 10 veya üzeri |
| PostgreSQL | 14 veya üzeri (15 ile doğrulandı) |
| Git | güncel |

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

### 4.4 Bağlantıyı doğrulayın

```powershell
npm run db:check
```

Beklenen çıktı:

```
PostgreSQL bağlantısı başarılı (SELECT 1).
```

Bu komut yalnızca okuma yapar; hiçbir tablo oluşturmaz veya değiştirmez.

---

## 5. Development çalıştırma

```powershell
npm run dev
```

| Adres | Ne |
| --- | --- |
| `http://localhost:5173` | Arayüz (Vite, anlık yenileme) |
| `http://localhost:3000/api/health` | API sağlık ucu |

Vite, `/api` çağrılarını Express'e iletir; ek yapılandırma gerekmez.

---

## 6. Test komutları

| Komut | Ne yapar |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript tip denetimi (strict) |
| `npm run test` | API ve web testleri |
| `npm run build` | Production derlemesi |
| `npm run verify` | lint → typecheck → test → build |
| `npm run db:check` | Veritabanı bağlantısı (`SELECT 1`) |
| `npm run format` | Prettier ile biçimlendirme |

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

## 8. Gelecekte Railway deployment modeli

Deployment **Phase 7'de** yapılacaktır (bkz. [DECISIONS.md](DECISIONS.md)
ADR-002). Planlanan model:

- Railway üzerinde **tek Node.js servisi** çalışır: `npm run build` ile
  derlenir, `npm start` ile başlatılır.
- Aynı servis hem `/api/*` uçlarını hem `apps/web/dist` içeriğini sunar —
  ayrı bir frontend barındırma katmanı yoktur.
- **Railway PostgreSQL** eklentisi bağlanır; `DATABASE_URL` Railway tarafından
  environment değişkeni olarak sağlanır.
- `PORT` de Railway tarafından verilir; uygulama bu değeri environment'tan okur.
- Production'da sunucu `0.0.0.0` üzerinde dinler (varsayılan davranış).
- Custom domain Railway servisine bağlanır; frontend ve API aynı domain
  üzerinde olduğu için CORS yapılandırması gerekmez.

> Railway'e özel yapılandırma dosyaları bu aşamada **bilinçli olarak
> yazılmamıştır.**

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

Migration gerektiren bir değişiklik yapılacaksa önce ne yapılacağı anlatılır
ve onay alınır.

---

## 11. Proje belgeleri

| Belge | İçerik |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Claude ve Codex için bağlayıcı kurallar |
| [CLAUDE.md](CLAUDE.md) | Claude'un çalışma başlangıcı |
| [HANDOFF.md](HANDOFF.md) | Aktif Phase, branch ve devir kaydı |
| [DECISIONS.md](DECISIONS.md) | Kalıcı teknik kararlar (ADR) |
| [WORKFLOW.md](WORKFLOW.md) | Phase çalışma düzeni |
| [SESSION_LOG.md](SESSION_LOG.md) | Oturum kayıtları (append-only) |
| [docs/PHASES.md](docs/PHASES.md) | Phase 0–7 planı |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Mimari |
| [docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md) | Ürün kapsamı |
| [docs/UI_GUIDE.md](docs/UI_GUIDE.md) | Arayüz rehberi |
