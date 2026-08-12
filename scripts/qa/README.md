# Final UAT yardımcıları

Bu dizindeki scriptler, kapsamlı kabul testinin gerçek HTTP, PostgreSQL,
Socket.IO ve Chrome akışlarını tekrar çalıştırmak için kalıcı QA araçlarıdır.
Fixture verisini doğrudan veritabanına yazmazlar; kullanıcı ve domain kayıtları
resmî kurulum/API/arayüz akışlarından oluşturulur.

Scriptler yalnızca görev için oluşturulmuş izole veritabanlarıyla çalıştırılmalıdır.
Mevcut `CafeAdisyon` veritabanına karşı çalıştırılmamalıdır. Parola, cookie veya
`DATABASE_URL` komut satırına ya da repository içindeki bir dosyaya yazılmamalıdır.

## Ortak ortam değişkenleri

| Değişken             | Amaç                                               |
| -------------------- | -------------------------------------------------- |
| `UAT_BASE_URL`       | Çalışan UAT API adresi                             |
| `UAT_WEB_URL`        | Vite üzerinden çalışan UAT arayüz adresi           |
| `UAT_PRODUCTION_URL` | Yerel production smoke adresi                      |
| `UAT_OWNER_PASSWORD` | Runtime'da sağlanan UAT owner parolası             |
| `UAT_STAFF_PASSWORD` | Runtime'da sağlanan UAT personel parolası          |
| `UAT_OUTPUT_DIR`     | Repository dışında veya ignore edilen çıktı dizini |
| `UAT_CHROME_PATH`    | İsteğe bağlı Chrome executable yolu                |

## Scriptler

- `final-uat-api.mjs`: UAT işletmesini, dört rolü, salon/masa/menü fixture'ını,
  gerçek sipariş-ödeme-cari akışlarını, Socket.IO eventlerini ve finansal oracle'yı
  doğrular. Sonucu `api-uat-result.json` olarak yazar.
- `final-uat-browser.mjs`: üç bağımsız Chrome context'iyle gerçek arayüz işlemleri,
  realtime KDS, responsive matris, focus, touch target, reduced motion ve ekran
  görüntülerini doğrular. Sonucu `browser-uat-result.json` olarak yazar.
- `final-uat-edge.mjs`: concurrency, modifier/snapshot, split ve büyük fixture
  senaryolarını doğrular. Sonucu `edge-uat-result.json` olarak yazar.
- `final-uat-security.mjs`: ayrı bir security scan başlatmadan temel auth,
  injection-shaped input, body limit, rate limit ve production header kontrollerini
  yapar. Sonucu `security-baseline-result.json` olarak yazar.

Bu scriptler destructive migration, reset, `DROP`, `TRUNCATE` veya production
deployment işlemi yapmaz. Browser ekran görüntüleri ve JSON sonuçları commit
edilmez.
