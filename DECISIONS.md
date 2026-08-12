# DECISIONS.md — Kalıcı teknik kararlar

Bu dosya alınan **kalıcı** teknik kararları kayıt altına alır.
Bir karar değişirse eski kayıt silinmez; durumu güncellenir ve yeni kayıt eklenir.

Biçim: `ADR-<numara> — <başlık>` · Tarih · Durum · Karar · Gerekçe · Sonuç

---

## ADR-001 — Uygulama şu anda local geliştirilecek

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Geliştirme yalnızca yerel bilgisayarda yapılır:

```
Frontend:   http://localhost:5173
Backend:    http://localhost:3000
PostgreSQL: localhost:5432/CafeAdisyon
```

Sunucu geliştirmede yalnızca `127.0.0.1` üzerinde dinler.

**Gerekçe.** Temel sağlam kurulmadan dağıtım ortamıyla uğraşmak, hem hata
kaynaklarını çoğaltır hem de Phase 0'ın kapsamını dağıtır.

**Sonuç.** Yerel ağ üzerinden IP ile erişim, offline çalışma, PWA service
worker, Docker ve Railway yapılandırması bu aşamada geliştirilmez.

---

## ADR-002 — Production ortamında Railway kullanılacak

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi (uygulama ileriki bir Phase'te)

**Karar.** Hedef production mimarisi:

```
Custom domain
    ↓
Railway Node.js servisi
    ├── Express API
    └── React production build
    ↓
Railway PostgreSQL
```

**Gerekçe.** Tek servis içinde hem API hem statik dosya sunumu, yönetimi en
basit ve en ucuz seçenektir; ayrı bir CDN/statik barındırma katmanı gerekmez.

**Sonuç.** Kod bugünden bu modele uygun yazılır: port ve veritabanı adresi
environment değişkeninden okunur, production'da sunucu tüm arayüzlerden
(`0.0.0.0`) dinler. Railway'e özel yapılandırma dosyaları **henüz yazılmaz.**

---

## ADR-003 — React build'i Express tarafından sunulacak

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Production'da Express, `apps/web/dist` içeriğini statik olarak sunar.
Bilinmeyen GET yolları `index.html`'e düşürülür (React Router SPA fallback);
`/api` altındaki bilinmeyen yollar ise her zaman JSON 404 döner.

**Gerekçe.** Tek çalışan süreç, tek dağıtım birimi, tek log akışı.

**Sonuç.** `/api` 404 katmanı statik dosya katmanından **önce** gelir; aksi
hâlde tanımsız bir API ucu HTML döndürürdü.

---

## ADR-004 — Frontend ve backend production'da aynı origin üzerinde olacak

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Arayüz ve API aynı domain üzerinden sunulur. Frontend kodunda
`localhost:3000` gibi mutlak adres **hardcode edilmez**; yalnızca göreli
`/api/...` yolları kullanılır.

**Gerekçe.** Aynı origin CORS'u tamamen ortadan kaldırır ve aynı kodun
geliştirmede de production'da da değişmeden çalışmasını sağlar.

**Sonuç.** Geliştirmede Vite proxy'si `/api` isteklerini `localhost:3000`
adresine iletir. Ortam farkı yalnızca proxy yapılandırmasındadır.

---

## ADR-005 — PostgreSQL: local geliştirmede bilgisayarda, production'da Railway'de

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Veri deposu PostgreSQL, erişim katmanı Prisma ORM'dir. Geliştirmede
bilgisayardaki `CafeAdisyon` veritabanı, production'da Railway PostgreSQL
kullanılır.

**Gerekçe.** Aynı veritabanı motoru her iki ortamda kullanıldığı için
davranış farkı oluşmaz.

**Sonuç.** Mevcut `CafeAdisyon` veritabanı korunur. Bağlantı doğrulaması
yalnızca `SELECT 1` ile yapılır. Phase 0'da domain tablosu oluşturulmaz.

---

## ADR-006 — Veritabanı bağlantısı environment değişkeninden alınacak

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Bağlantı adresi yalnızca `DATABASE_URL` ortam değişkeninden okunur.
Kodda, dokümanda veya commit'te gerçek parola bulunmaz. Ortam değişkenleri
uygulama açılmadan `zod` ile doğrulanır.

**Gerekçe.** Aynı kodun farklı ortamlarda değişmeden çalışması ve parolanın
depoya sızmaması.

**Sonuç.** Doğrulama başarısız olursa sunucu stack trace yerine hangi
değişkenin neden geçersiz olduğunu yazar ve 1 koduyla çıkar. Doldurulmamış
`CHANGE_ME` değeri de reddedilir.

---

## ADR-007 — Çoklu işletme ve çoklu şube ilk sürüm kapsamında olmayacak

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Uygulama tek işletme ve tek şube içindir. Çok kiracılı (multi-tenant)
mimari kurulmaz; veri modeline `tenantId` / `branchId` gibi alanlar eklenmez.

**Gerekçe.** Çok kiracılılık, her sorguya ve her yetki kontrolüne kalıcı bir
karmaşıklık ekler. İhtiyaç doğmadan ödenmesi gereken bir maliyet değildir.

**Sonuç.** İleride gerekirse ayrı bir karar ve göç planıyla ele alınır.

---

## ADR-008 — Para değerleri tam sayı kuruş olarak tutulacak

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Tüm para değerleri tam sayı **kuruş** olarak saklanır ve taşınır.
`Float`/`Double` kullanılmaz. Veritabanında `Int`, TypeScript'te `Kurus`
(`number`) kullanılır. Biçimlendirme yalnızca görüntüleme anında yapılır.

**Gerekçe.** Kayan noktalı sayılarla `0.1 + 0.2 !== 0.3`'tür. Adisyon toplamı,
hesap bölme ve indirim hesaplarında bu hatalar birikir ve kasa tutmaz.

**Sonuç.** `packages/contracts/src/money.ts` içinde `formatKurus` ve
`liraToKurus` yardımcıları tanımlıdır.

---

## ADR-009 — Tarih ve saat işlemlerinde Europe/Istanbul dikkate alınacak

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Zaman damgaları UTC olarak saklanır ve taşınır (ISO 8601);
arayüzde `Europe/Istanbul` saatine çevrilerek `tr-TR` biçiminde gösterilir.

**Gerekçe.** UTC saklamak, sunucu ve cihaz saat dilimi farklarından ve yaz
saati uygulamasından bağımsızdır. Kullanıcı tek bir yerel saat görür.

**Sonuç.** Sabitler `packages/contracts/src/common.ts` içinde; çevrim
`apps/web/src/lib/datetime.ts` içinde tek noktadan yapılır. Gün sonu raporu
gibi gün sınırı hesapları da bu saat dilimine göre yapılacaktır.

---

## ADR-010 — Arayüz dili Türkçe olacak

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Kullanıcıya görünen tüm metinler Türkçedir: başlıklar, etiketler,
boş durumlar ve hata mesajları. Para birimi TRY, biçimlendirme `tr-TR`'dir.

**Gerekçe.** Kullanıcı kafe personelidir; İngilizce arayüz doğrudan hata ve
yavaşlık üretir.

**Sonuç.** Hata mesajları kullanıcıya **ne yapacağını** söyler; teknik stack
trace gösterilmez. Kod içindeki tanımlayıcılar İngilizce kalır.

---

## ADR-011 — Domain kayıtları doğrudan silinmeyecek

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Adisyon, sipariş, ödeme ve müşteri gibi domain kayıtları fiziksel
olarak silinmez; iptal, pasife alma ve durum alanları kullanılır. Destructive
veritabanı işlemleri yasaktır (bkz. [AGENTS.md](AGENTS.md) §9).

**Gerekçe.** Kasa denetimi ve anlaşmazlık çözümü için işlem geçmişi eksiksiz
kalmalıdır. Silinen bir adisyon ciro raporunu sessizce bozar.

**Sonuç.** Raporlar iptal edilmiş kayıtları ayrı gösterir.

---

## ADR-012 — Vitest 3 ve çift biçimli contracts paketi

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi (uygulama sırasında zorunluluktan doğdu)

**Karar.**
(a) Test koşucusu Vitest 3'tür.
(b) `packages/contracts` hem CommonJS hem ESM çıktı üretir; paket içi göreli
içe aktarımlarda `.js` uzantısı zorunludur.

**Gerekçe.**
(a) Vitest 2 kendi içinde Vite 5 taşıdığı için Vite 6 kullanan
`vite.config.ts` tip denetimi çakıştı.
(b) Rollup, TypeScript'in CommonJS `export *` çıktısını statik olarak
çözemedi ve production build kırıldı.

**Sonuç.** Node/Express `dist/cjs`, Vite/Rollup `dist/esm` çıktısını kullanır.
Uzantı unutulursa ESM derlemesi kırılır — bu kural
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) içinde de yazılıdır.

---

## ADR-013 — Kimlik doğrulama veritabanı session'ı ve sabit rollerle yapılacak

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Kullanıcılar normalize edilmiş kullanıcı adı ve bcrypt (cost 12) ile
hashlenen şifreyle giriş yapar. Tarayıcıda 12 saatlik HttpOnly, SameSite=Strict
`kafe_session` cookie bulunur; veritabanında yalnız ham token'ın SHA-256 hash'i
tutulur. Roller `OWNER`, `CASHIER`, `WAITER`, `KITCHEN` olarak sabittir ve
permission matrisi sunucu tarafında uygulanır.

**Gerekçe.** İlk sürüm tek işletme ve sınırlı rol kümesine sahiptir. Veritabanı
session'ı; çıkış, personeli pasife alma ve şifre değişiminde oturumların anında
iptal edilmesini sağlar. Generic rol/permission tabloları gereksiz karmaşıklık
ekler.

**Sonuç.** Web üzerinden açık owner oluşturma endpoint'i yoktur; ilk owner
yalnız `npm run setup:owner` interaktif komutuyla oluşturulur. Son aktif owner
kuralı serializable transaction ile korunur. Audit kayıtları parola, hash,
cookie veya session token içermez.

---

## ADR-014 — Sipariş fiyatları snapshot olarak saklanacak ve sunucuda hesaplanacak

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Sipariş kalemi oluşturulurken ürün adı, ürün birim fiyatı, seçenek
grubu/değeri adları ve seçenek fiyat farkları snapshot olarak saklanır. Kalem
tutarı `(ürün fiyatı + seçenek farkları) × adet`, adisyon toplamı ise iptal
edilmemiş kalemlerin toplamı olarak yalnız backend transaction'larında hesaplanır.

**Gerekçe.** Menüdeki ad veya fiyat daha sonra değiştiğinde geçmiş adisyonların
mali kaydı değişmemelidir. İstemciden gelen fiyat/toplam değerleri güvenilir
değildir ve kasa tutarlılığını bozamamalıdır.

**Sonuç.** Para alanları tam sayı kuruştur. Aynı masada yalnız bir `OPEN` adisyon
bulunması hem serializable transaction hem koşullu unique PostgreSQL indeksiyle
korunur. Sipariş kalemleri fiziksel olarak silinmez; gerekçe, aktör ve zaman ile
iptal edilir ve iptal edilen kalem toplamdan çıkarılır.
