# Kafe Adisyon Sistemi

Tek şubeli bir kafe için **yerel ağda** çalışan adisyon ve satış noktası (POS)
uygulaması.

Uygulama buluta bağlı değildir. Kasa bilgisayarı ana bilgisayardır: React
arayüzü, Express sunucusu ve PostgreSQL bu bilgisayarda çalışır. Telefonlar,
tabletler ve diğer bilgisayarlar aynı yerel ağ üzerinden kasa bilgisayarının
IPv4 adresine bağlanır. **İnternet bağlantısı gerekmez.**

> **Phase durumu:** Phase 0 tamamlandı (temel kurulum), Codex review'u
> bekliyor. Masa açma, sipariş, ödeme ve raporlama işlevleri henüz yoktur.
> Plan: [docs/PHASES.md](docs/PHASES.md)

---

## 1. Amaç

Kafede masa açmak, adisyon tutmak, sipariş almak, mutfağa iletmek, hesabı
kapatmak ve gün sonunu görmek. Kesintiye tahammülü olmayan bir iş için
internete bağımlı olmayan bir çözüm.

Kapsamın tamamı: [docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md)

---

## 2. Teknik mimari

| Katman | Teknoloji |
| --- | --- |
| Arayüz | React 18, TypeScript, Vite 6, React Router, TanStack Query, Tailwind CSS 4, lucide-react |
| Sunucu | Node.js, Express 5, TypeScript, Helmet, zod |
| Veri | PostgreSQL 15, Prisma ORM |
| Paylaşım | `packages/contracts` (ortak tipler ve sabitler) |
| Test | Vitest, Supertest, React Testing Library |
| Depo | npm workspaces |

```
apps/api   → Express sunucusu (üretimde arayüzü de sunar)
apps/web   → React arayüzü
packages/contracts → web ve api'nin paylaştığı tipler
```

Ayrıntı: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## 3. Gereksinimler

| Gereksinim | Sürüm |
| --- | --- |
| Windows | 10 / 11 |
| Node.js | 20.10 veya üzeri |
| npm | 10 veya üzeri |
| PostgreSQL | 14 veya üzeri (15 ile doğrulandı) |
| Git | güncel |

Kontrol:

```powershell
node -v
npm -v
git --version
```

---

## 4. Windows kurulumu

### 4.1 Depoyu alın

```powershell
git clone https://github.com/salih12s/KafeAdisyonSistemi.git
cd KafeAdisyonSistemi
```

### 4.2 Bağımlılıkları kurun

```powershell
npm install
```

Kurulum sonunda Prisma istemcisi otomatik üretilir.

### 4.3 PostgreSQL veritabanını hazırlayın

Veritabanı adı: **`CafeAdisyon`**

Yoksa pgAdmin ile ya da şu komutla oluşturun:

```powershell
& "C:\Program Files\PostgreSQL\15\bin\createdb.exe" -U postgres CafeAdisyon
```

> Veritabanı zaten varsa **hiçbir şey yapmayın.** Mevcut veritabanı silinmez,
> sıfırlanmaz. Bkz. §11.

### 4.4 .env dosyasını oluşturun

En kolayı:

```powershell
npm run setup:env
```

Betik parolanızı sorar ve `apps/api/.env` dosyasını yazar.
**Parola betiğin içinde yazılı değildir ve depoya gönderilmez.**

Elle yapmak isterseniz `apps/api/.env.example` dosyasını `apps/api/.env`
olarak kopyalayın ve `CHANGE_ME` yerine kendi PostgreSQL parolanızı yazın:

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
DATABASE_URL="postgresql://postgres:PAROLANIZ@localhost:5432/CafeAdisyon"
LOG_LEVEL=info
JSON_BODY_LIMIT=1mb
```

> Parolanızda `@ : / ? # [ ] %` gibi karakterler varsa URL kodlaması
> gerekir. `npm run setup:env` bunu kendisi yapar.

`HOST=0.0.0.0` yerel ağdaki cihazların bağlanabilmesi içindir. Yalnızca kasa
bilgisayarından erişim istiyorsanız `127.0.0.1` yazın.

### 4.5 Bağlantıyı doğrulayın

```powershell
npm run db:check
```

Beklenen çıktı:

```
PostgreSQL bağlantısı başarılı (SELECT 1).
```

Bu komut yalnızca okuma yapar; hiçbir tablo oluşturmaz veya değiştirmez.

---

## 5. Geliştirme ortamında çalıştırma

```powershell
npm run dev
```

| Adres | Ne |
| --- | --- |
| `http://localhost:5173` | Arayüz (Vite, anlık yenileme) |
| `http://localhost:3000/api/health` | API sağlık ucu |

Vite, `/api` çağrılarını Express'e iletir; ayrıca yapılandırma gerekmez.

---

## 6. Üretim (kasa bilgisayarı) çalıştırma

```powershell
npm run build
npm start
```

Uygulama **tek adresten** açılır:

```
http://localhost:3000
```

Express hem arayüzü hem API'yi aynı porttan sunar. Başlangıçta konsola yerel
ağ adresleri yazılır:

```
API sunucusu dinlemede. {"host":"0.0.0.0","port":3000,"environment":"production"}
Bu bilgisayarda: http://localhost:3000
Yerel ağdan: http://192.168.1.25:3000
PostgreSQL bağlantısı doğrulandı.
```

> Konsolda Türkçe karakterler bozuk görünüyorsa terminalin kod sayfasını
> değiştirin: `chcp 65001`. Sorun çıktıda değil, terminaldedir.

---

## 7. Telefon ve tablette açma

1. **Kasa bilgisayarının IPv4 adresini öğrenin:**

   ```powershell
   ipconfig
   ```

   `IPv4 Adresi` satırındaki değeri alın (örn. `192.168.1.25`).
   Sunucu açılışta bu adresleri zaten yazdırır.

2. **Cihazı aynı Wi-Fi ağına bağlayın.** Misafir ağı çoğu modemde cihazları
   birbirinden yalıtır; kasa ile aynı ağ olmalıdır.

3. **Tarayıcıdan açın:**

   ```
   http://192.168.1.25:3000
   ```

   Kurulum yoktur, uygulama tarayıcıda çalışır.

4. **Öneri:** Modem arayüzünden kasa bilgisayarına **sabit yerel IP** verin.
   Aksi hâlde DHCP adresi değişince tüm cihazlarda adres değişir.

### Windows Güvenlik Duvarı notu

İlk çalıştırmada Windows izin sorar. **"Özel ağlar" (private network)**
kutusunu işaretleyip izin verin. Genel ağ (public) profiline izin vermeyin.

Sonradan kural eklemek gerekirse (yönetici PowerShell):

```powershell
New-NetFirewallRule -DisplayName "Kafe Adisyon (3000)" `
  -Direction Inbound -Protocol TCP -LocalPort 3000 `
  -Profile Private -Action Allow
```

Ağ profilinizin `Private` olduğunu doğrulayın:

```powershell
Get-NetConnectionProfile
```

> Uygulamayı internete açmayın. Modemde 3000 portu için port yönlendirmesi
> yapmayın; sistem yalnızca yerel ağ için tasarlanmıştır.

---

## 8. Test ve kalite komutları

| Komut | Ne yapar |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript tip denetimi (strict) |
| `npm run test` | API ve web testleri |
| `npm run build` | Üretim derlemesi |
| `npm run verify` | lint → typecheck → test → build |
| `npm run db:check` | Veritabanı bağlantısı (`SELECT 1`) |
| `npm run format` | Prettier ile biçimlendirme |

Testler veritabanına bağlanmaz; bu yüzden PostgreSQL kapalıyken de çalışırlar.

---

## 9. Phase durumu

| Phase | Konu | Durum |
| --- | --- | --- |
| 0 | Yerel proje temeli, ajan iş akışı, UI altyapısı | **Tamamlandı — review bekliyor** |
| 1–7 | Veri modeli, menü, adisyon, mutfak, ödeme, cari, raporlar | Başlanmadı |

Ayrıntı: [docs/PHASES.md](docs/PHASES.md)

Phase 0'da modül sayfaları bilinçli olarak boştur. Çalışmayan buton veya
sahte veri konmamıştır; her ekran ne olduğunu ve ileride ne geleceğini yazar.

---

## 10. Gizli bilgi güvenliği

- `apps/api/.env` **asla commit edilmez**; `.gitignore` içindedir.
- Depoda yalnızca `.env.example` ve `.env.test.example` bulunur; içlerinde
  gerçek değer değil `CHANGE_ME` yer alır.
- PostgreSQL parolanız bu README'de, dokümanlarda veya kodda yazılı değildir.
- `scripts/set-local-env.ps1` parolayı içinde tutmaz; çalışırken sorar.
- Commit öncesi diff gizli bilgi taramasından geçirilir
  (bkz. [AGENTS.md](AGENTS.md) §8).

Parolanız sızdıysa PostgreSQL'de değiştirin ve `.env` dosyasını güncelleyin.

---

## 11. Veritabanı sıfırlama yasağı

Bu depoda aşağıdakiler **yasaktır** ve hiçbir script bunları çalıştırmaz:

- `DROP DATABASE`
- `DROP TABLE`
- `TRUNCATE`
- `prisma migrate reset`
- `prisma db push --force-reset`
- Tüm tabloları silen veya boşaltan scriptler
- Onay alınmadan çalıştırılan destructive migration

Mevcut `CafeAdisyon` veritabanı korunur. Bağlantı doğrulaması yalnızca
`SELECT 1` ile yapılır. Domain kayıtları ileride de fiziksel olarak silinmez;
iptal ve pasife alma alanları kullanılır
(bkz. [DECISIONS.md](DECISIONS.md) ADR-010).

Migration gerektiren bir değişiklik yapılacaksa önce ne yapılacağı anlatılır
ve onay alınır.

---

## 12. Proje belgeleri

| Belge | İçerik |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Claude ve Codex için bağlayıcı kurallar |
| [CLAUDE.md](CLAUDE.md) | Claude'un oturum başlangıcı |
| [WORKFLOW.md](WORKFLOW.md) | Phase çalışma düzeni |
| [HANDOFF.md](HANDOFF.md) | Aktif görev ve devir tablosu |
| [SESSION_LOG.md](SESSION_LOG.md) | Oturum kayıtları (append-only) |
| [DECISIONS.md](DECISIONS.md) | Kalıcı teknik kararlar (ADR) |
| [docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md) | Ürün kapsamı |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Mimari |
| [docs/PHASES.md](docs/PHASES.md) | Phase 0–7 planı |
| [docs/UI_GUIDE.md](docs/UI_GUIDE.md) | Arayüz rehberi |
