# Hostinger'a yayın (canlı demo)

Kafe Adisyon, Hostinger'da **tek bir Node.js web uygulaması** olarak çalışır.
Adresi `https://adisyon.salihsydm.com`. Kararın gerekçesi: [ADR-026](../DECISIONS.md).

```text
adisyon.salihsydm.com ──▶ Hostinger proxy ──▶ node dist/main.cjs (0.0.0.0:$PORT)
                                                ├── /api/*      Express API ──▶ MySQL (127.0.0.1)
                                                ├── /socket.io  gerçek zamanlı sipariş olayları
                                                └── diğer GET'ler → dist/public (React, index.html)
```

- Arayüz API'yi göreli `/api` yoluyla çağırır; CORS gerekmez (ADR-004).
- Oturum HttpOnly çerezdedir; üretimde `Secure` olduğu için site yalnız HTTPS'te çalışır.
- Her şey yerelde derlenir. Host yalnız `npm install` çalıştırır; build komutu bir şey yapmaz.
- `DEMO_MODE=true` ile boş veritabanında şema ve demo verisi **uygulamanın kendisi**
  tarafından kurulur. phpMyAdmin'den içe aktarma ya da uzak bağlantı gerekmez.

## 1. Paketi üret

```powershell
npm run package:hostinger    # deploy/kafe-adisyon-hostinger.zip (deploy/ git dışıdır)
```

| Yol                                      | Ne                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `dist/main.cjs`                          | Giriş dosyası; `WEB_DIST_PATH` ve `MIGRATIONS_PATH`'i paket düzenine ayarlar   |
| `dist/*.js`                              | Derlenmiş API (CommonJS) ve Prisma 7 istemcisi (native motor yok)              |
| `dist/public/`                           | Derlenmiş web uygulaması                                                       |
| `dist/prisma/migrations/`                | Boş veritabanında şemayı kurmak için migration SQL'leri                        |
| `dist/vendor/contracts/`                 | `@kafe/contracts` (npm'de yok; require yolları buraya çevrilir)                |
| `dist/package.json`, `package-lock.json` | NestJS preset'i yalnız `dist`'i yayınladığı için bağımlılıklar burada da durur |

## 2. hPanel: veritabanı

**Veritabanları → MySQL Veritabanları** bölümünde veritabanı ve kullanıcı oluşturun.
Adı **`demo` içermelidir** (ör. `u454177254_kafedemo`): demo modu başka bir adla
açılmayı reddeder, çünkü veriyi her gün silip yeniden üretir. Tabloları elle
oluşturmayın; veritabanı boş kalsın.

## 3. hPanel: Node.js web uygulaması

| Ayar             | Değer                                        |
| ---------------- | -------------------------------------------- |
| Framework preset | **NestJS** (yalnız çıktı klasörünü yayınlar) |
| Node.js sürümü   | **24.x** (en az 20.19; Prisma 7'nin gereği)  |
| Build komutu     | `build` (yalnız "Prebuilt package" yazar)    |
| Çıktı klasörü    | `dist`                                       |
| Giriş dosyası    | `main.cjs`                                   |

### Ortam değişkenleri

| Değişken       | Değer                                                                                                                                                         | Zorunlu |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `DATABASE_URL` | `mysql://KULLANICI:PAROLA@127.0.0.1:3306/VERITABANI`. Host her zaman `127.0.0.1`'dir (`localhost` IPv6'ya gidebilir). Parolada `@ : / # ?` varsa URL kodlanır | evet    |
| `NODE_ENV`     | `production`                                                                                                                                                  | evet    |
| `DEMO_MODE`    | `true` (canlı demo). Gerçek bir işletmede **girilmez**                                                                                                        | demo    |
| `PORT`, `HOST` | Girilmez; Hostinger `PORT`'u verir, üretimde `HOST` 0.0.0.0'dır                                                                                               | –       |
| `CORS_ORIGIN`  | Girilmez (aynı origin)                                                                                                                                        | –       |

hPanel API'si ortam değişkenlerini **toptan değiştirir**: API ile güncellerken
`DATABASE_URL` de listede olmalıdır, yoksa silinir. Panelden tek tek eklemek güvenlidir.

### İlk açılışta ne olur?

1. Uygulama veritabanına bağlanır (`Veritabanı bağlantısı doğrulandı.`).
2. Tablo yoksa migration'ları uygular (`Boş demo veritabanına şema kuruldu.`).
3. Demo verisini üretir (`Demo verisi hazır. {"closedChecks":599,...}`); yerelde
   ~30–50 sn. Bu sürede iş uçları **503** "Demo verisi yenileniyor" döner; giriş
   ekranı bekler ve hazır olunca düğmeleri açar.

### Yayından sonra kontrol

```bash
curl https://adisyon.salihsydm.com/api/health   # {"status":"ok","database":"connected",...}
curl https://adisyon.salihsydm.com/api/demo     # {"enabled":true,"resetting":false,...}
```

Ardından siteyi açıp **Demo ile gir**'e basın; Özet ekranı dolu gelmelidir.

| Günlükte                                   | Sebep                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `DATABASE_URL "mysql://" ile başlamalıdır` | Değer tırnakla girilmiş ya da başı eksik                                      |
| `DEMO_MODE: yalnız adı "demo" içeren…`     | Veritabanı adında `demo` yok                                                  |
| `Access denied for user`                   | Kullanıcı adı/parola yanlış; kullanıcı adı `u454177254_` önekiyle tam yazılır |
| `Unknown database`                         | Veritabanı adı yanlış                                                         |
| `ECONNREFUSED` / `ETIMEDOUT`               | Host `127.0.0.1` değil                                                        |

## 4. Günlük yenileme ve cron

Demo, Istanbul'da yeni gün başlayıp saat **05:00**'i geçince ilk API isteğinde
kendini siler ve yeniden üretir (ADR-026). Hostinger boştaki süreci durdurabildiği
için bir cron işi her 10 dakikada `/api/health`'e istek atar; hem süreci uyanık
tutar hem de yenilemeyi ziyaretçi gelmeden tetikler:

```text
*/10 * * * *   curl -s -o /dev/null https://adisyon.salihsydm.com/api/health
```

Açık masalar ve mutfak siparişleri 10 dakikada bir 25–75 dakika yaşa çekilir;
demo günün her saatinde "canlı" görünür. Elle sıfırlamak gerekirse: hPanel'den
uygulamayı durdurun, phpMyAdmin'de `User` tablosunda `username = 'demo'` satırının
`createdAt` değerini dünden önceye çekin ve uygulamayı başlatın.

## 5. Sonraki migration'lar

Canlıda Prisma CLI yoktur. Yeni bir migration:

1. Yerelde `npx prisma migrate dev --name aciklama` (apps/api) ile üretilir ve test edilir.
2. **Önce veritabanı, sonra paket.** Demo veritabanı için en kolayı: phpMyAdmin'de
   tüm tabloları silip yeni paketi yüklemek; uygulama boş veritabanında şemayı
   sıfırdan kurar ve veriyi yeniden üretir (demo verisi zaten her gün yenilenir).
3. Gerçek veri taşıyan bir veritabanında ise `migration.sql` phpMyAdmin'den
   uygulanır ve `_prisma_migrations`'a kayıt eklenir (checksum dosyanın SHA-256'sı).

## Yerel veritabanı

Yerelde MariaDB 11.4 kullanılır; SS Filo ve FitnessApp ile aynı taşınabilir sunucu
(`..\SercanFitness\scripts\local-db.ps1 start`, 127.0.0.1:3306). Bu projenin
veritabanları: `kafe_adisyon_demo` (uygulama), `kafe_adisyon_shadow` (`migrate dev`),
`kafe_adisyon_test_demo` (`npm run test:db`); hepsine yalnız `kafe` kullanıcısının
yetkisi vardır. Bağlantılar `apps/api/.env` ve `apps/api/.env.test` içindedir
(şablonlar: `.env.example`, `.env.test.example`). Eski PostgreSQL ayarları
`apps/api/.env.postgres` dosyasında saklanır; PostgreSQL migration geçmişi
`apps/api/prisma/migrations-postgres-archive` altında yalnız kayıt içindir.

Windows'taki MariaDB tablo adlarını küçük harfle saklar (`lower_case_table_names=1`);
Hostinger Linux'ta büyük/küçük harf ayrımı vardır. Bu yüzden Windows'tan alınan
bir SQL dökümü canlıya **taşınmaz**: şemayı migration dosyası, veriyi uygulama kurar.

## Bu paket nasıl doğrulandı

Yerelde (2026-09-28):

1. Zip repo dışındaki bir klasöre açıldı, `dist` içinde `npm ci --omit=dev` çalıştı.
2. **Hiç tablosu olmayan** yeni bir veritabanıyla `node main.cjs` başlatıldı:
   şema 1 sn'de kuruldu, 599 kapanmış adisyonluk demo 27 sn'de üretildi, bu sürede
   giriş 503, sonra 200 döndü. `prisma migrate status`: "Database schema is up to date".
3. API duman testi (17 kontrol): demo hesap kilidi 403, aynı masaya eşzamanlı 5
   açılıştan 1'i 201 / 4'ü 409, nakit ödeme ve kapanış, raporlar, mutfak, kasa, cari
   araması, stok, işlem geçmişi.
4. Chromium'da giriş ekranı, dört rolün demo girişi, masalar, mutfak ve raporlar;
   konsolda CSP ihlali yok.
5. Aynı veritabanına bağlı iki süreçle günlük yenileme: yalnız biri yeniledi
   (`GET_LOCK`), ikisi de bu sürede 503 döndü, sonra ikisi de çalıştı.

Test **edilmeyen**: Hostinger'ın kendi Linux ortamı ve proxy'sinin WebSocket desteği.
Socket.IO WebSocket açamazsa kendiliğinden long-polling'e düşer.
