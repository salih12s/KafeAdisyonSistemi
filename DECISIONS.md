# DECISIONS.md — Kalıcı teknik kararlar

Bu dosya alınan **kalıcı** teknik kararları kayıt altına alır.
Bir karar değişecekse eski kayıt silinmez; yeni bir kayıt eklenir ve eski
kaydın durumu "Değiştirildi" olarak işaretlenir.

Biçim: `ADR-<numara> — <başlık>` · Tarih · Durum · Karar · Gerekçe · Sonuç

---

## ADR-001 — Local-first mimari ve tek şube

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Uygulama buluta bağımlı olmayacaktır. Kasa bilgisayarı ana
bilgisayardır; React, Express ve PostgreSQL bu bilgisayarda çalışır. Diğer
cihazlar aynı yerel ağ üzerinden kasa bilgisayarının IPv4 adresine bağlanır.
Sistem tek cafe ve tek şube içindir.

**Gerekçe.** Kafe, internet kesintisinde de satış yapabilmelidir. Adisyon
sistemi kesintiye tahammül edemez. Tek şube için çok kiracılı mimarinin
karmaşıklığı gereksiz maliyet üretir.

**Sonuç.** Çok kiracılılık, bulut dağıtımı, Docker ve dış servis bağımlılığı
kapsam dışıdır. Sunucu `0.0.0.0` üzerinde dinler.

---

## ADR-002 — React + TypeScript + Vite

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Arayüz React ve TypeScript ile yazılır, Vite ile derlenir.

**Gerekçe.** Vite'ın geliştirme sunucusu hızlıdır ve `host: 0.0.0.0` ile
yerel ağa doğrudan açılabilir; bu, tablet üzerinde geliştirme sırasında test
yapmayı kolaylaştırır. TypeScript, adisyon ve para hesapları gibi hata
toleransı düşük alanlarda derleme zamanı güvence sağlar.

**Sonuç.** `apps/web`, Vite üretim derlemesini `apps/web/dist` içine üretir.

---

## ADR-003 — Node.js + Express + TypeScript

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Sunucu Node.js üzerinde Express ve TypeScript ile yazılır.
Uygulama kurulumu (`createApp`) ile sunucu başlatma (`server.ts`) ayrılır.

**Gerekçe.** Express küçük, öngörülebilir ve Windows üzerinde sorunsuz
çalışır. App/server ayrımı, gerçek port açmadan HTTP testi yazmayı mümkün
kılar.

**Sonuç.** Testler `supertest` ile `createApp` çıktısını doğrudan sürer.

---

## ADR-004 — PostgreSQL + Prisma ORM

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Veri deposu PostgreSQL, erişim katmanı Prisma ORM'dir.
Veritabanı adı `CafeAdisyon`, bağlantı `localhost:5432` üzerindendir.

**Gerekçe.** PostgreSQL, eşzamanlı adisyon güncellemelerinde ihtiyaç
duyulacak işlem (transaction) garantilerini verir. Prisma şema tabanlı
migration ve tip güvenli sorgu üretir.

**Sonuç.** Bağlantı doğrulaması yalnızca `SELECT 1` ile yapılır. Phase 0'da
domain tablosu oluşturulmaz.

---

## ADR-005 — REST API

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** İstemci-sunucu iletişimi REST üzerinden, `/api` ön ekiyle yapılır.
Hata yanıtları tek ve değişmez bir gövde biçimindedir:
`{ error: { code, message, details? } }`.

**Gerekçe.** REST bu ölçekte yeterlidir; GraphQL'in şema ve önbellek
karmaşıklığı gerekmez. Sabit hata biçimi, istemcinin metne değil koda göre
davranmasını sağlar.

**Sonuç.** Hata kodları `packages/contracts` içinde tanımlıdır.

---

## ADR-006 — npm workspaces

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Depo, npm workspaces ile tek repo olarak yönetilir:
`apps/web`, `apps/api`, `packages/contracts`.

**Gerekçe.** İstemci ve sunucu aynı tipleri paylaşır. Ek bir araç (Turborepo,
pnpm, Lerna) kurmadan npm'in kendi desteği yeterlidir.

**Sonuç.** `packages/contracts` hem CommonJS (Node için) hem ESM (paketleyici
için) çıktı üretir; göreli içe aktarımlarda `.js` uzantısı zorunludur.

---

## ADR-007 — Para değerleri tam sayı kuruş olarak tutulur

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Tüm para değerleri tam sayı **kuruş** olarak saklanır ve taşınır.
`Float`/`Double` kullanılmaz. Veritabanında `Int`, TypeScript'te `number`
(`Kurus` takma adı) kullanılır. Biçimlendirme yalnızca görüntüleme anında
yapılır.

**Gerekçe.** Kayan noktalı sayılarla `0.1 + 0.2 !== 0.3`'tür. Adisyon
toplamı, hesap bölme ve indirim hesaplarında bu hatalar birikir ve kasa
tutmaz.

**Sonuç.** `packages/contracts/src/money.ts` içinde `formatKurus` ve
`liraToKurus` yardımcıları tanımlıdır.

---

## ADR-008 — Europe/Istanbul zaman dilimi ve tr-TR biçimlendirme

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Zaman damgaları UTC olarak saklanır (`ISO 8601`), arayüzde
`Europe/Istanbul` saatine çevrilerek `tr-TR` biçiminde gösterilir. Arayüz
dili Türkçe, para birimi TRY'dir.

**Gerekçe.** UTC saklamak yaz saati ve cihaz saati farklarından bağımsızdır.
Kullanıcı tek bir yerel saat görür.

**Sonuç.** Sabitler `packages/contracts/src/common.ts` içindedir; çevrim
`apps/web/src/lib/datetime.ts` içinde tek noktadan yapılır.

---

## ADR-009 — Üretimde tek origin

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Üretimde Express, React derleme çıktısını (`apps/web/dist`) kendisi
sunar. Uygulama tek URL'den açılır: `http://<KASA_IP>:3000`. Bilinmeyen GET
yolları `index.html`'e düşer; `/api` altındaki bilinmeyen yollar JSON 404 döner.

**Gerekçe.** Tek origin CORS'u tamamen ortadan kaldırır, güvenlik yüzeyini
küçültür ve kullanıcının tek bir adres ezberlemesi yeterli olur.

**Sonuç.** Geliştirmede Vite proxy'si `/api` çağrılarını Express'e iletir;
böylece geliştirme ve üretim aynı göreli yolları kullanır.

---

## ADR-010 — Domain kayıtları doğrudan silinmez

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Adisyon, sipariş, ödeme ve müşteri gibi domain kayıtları fiziksel
olarak silinmez. İptal, pasife alma ve durum alanları kullanılır. Destructive
veritabanı işlemleri yasaktır (bkz. [AGENTS.md](AGENTS.md) §9).

**Gerekçe.** Kasa denetimi ve anlaşmazlık çözümü için işlem geçmişi eksiksiz
kalmalıdır. Silinen bir adisyon ciro raporunu sessizce bozar.

**Sonuç.** Raporlar iptal edilmiş kayıtları ayrı gösterir; `İşlem geçmişi`
ilk sürüm kapsamındadır.

---

## ADR-011 — Bulut servisleri kapsam dışıdır

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Supabase, Firebase, Railway, Vercel ve benzeri bulut servisleri;
Docker; Electron; native mobil uygulama; PWA/offline senkronizasyon kapsam
dışıdır.

**Gerekçe.** ADR-001'in doğrudan sonucudur. Her dış bağımlılık, internet
kesintisinde kasanın durması riskini geri getirir.

**Sonuç.** Bu kararın değişmesi kullanıcı onayı gerektirir.

---

## ADR-012 — Socket.IO sonraki bir Phase'e ertelendi

- **Tarih:** 2026-08-12
- **Durum:** Kabul edildi

**Karar.** Gerçek zamanlı iletişim (Socket.IO) Phase 0'a dâhil edilmez;
mutfak ekranı ve masa durumu senkronizasyonunun gerektiği Phase'te eklenir.

**Gerekçe.** Phase 0'da eşzamanlı güncellenecek bir domain durumu yoktur.
Kullanılmayan bir bağımlılık, altyapıyı bugünden karmaşıklaştırır.

**Sonuç.** Sağlık durumu şimdilik TanStack Query ile 30 saniyede bir
yeniden sorgulanır.
