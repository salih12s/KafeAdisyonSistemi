# AGENTS.md — Claude ve Codex için bağlayıcı proje kuralları

Bu belge Kafe Adisyon Sistemi üzerinde çalışan tüm yapay zekâ ajanları için
**bağlayıcıdır**. Claude ve Codex bu kuralların tamamına uymak zorundadır.
Diğer belgeler bu kuralları tekrar etmez, buraya referans verir.

---

## 1. Her görevden önce okunacak dosyalar (bu sırayla)

1. `AGENTS.md` (bu dosya)
2. `WORKFLOW.md`
3. `HANDOFF.md`
4. `DECISIONS.md`
5. `SESSION_LOG.md` (en az son iki kayıt)
6. İlgili Phase dokümanı → `docs/PHASES.md` ve ilgili `docs/` dosyaları
7. Değiştirilecek kod ve o kodun testleri

Bu sıra atlanamaz. "Kısa bir değişiklik" gerekçesiyle de atlanamaz.

---

## 2. Phase disiplini

- Ajan yalnızca **aktif Phase'in kapsamındaki** işi yapar.
- Kapsam dışı bir ihtiyaç fark edilirse kod yazılmaz; `SESSION_LOG.md` içine
  "Kalan riskler" başlığı altında not düşülür ve kullanıcıya bildirilir.
- Bir sonraki Phase'e **kullanıcı açıkça istemeden geçilmez.**
- Phase'in tamamlanma kriterleri sağlanmadan Phase "tamamlandı" sayılmaz.

---

## 3. Aynı anda tek ajan

- Aynı anda **yalnızca bir ajan** aktif geliştirici olabilir.
- Aktif ajan ve reviewer `HANDOFF.md` içinde yazılıdır.
- Aktif ajan değilken kod değiştirilmez; yalnızca inceleme ve rapor yazılır.
- Devir tamamlanmadan diğer ajan çalışmaya başlamaz.

---

## 4. Görev sahipliği

- Çalışmaya başlamadan önce `HANDOFF.md` içindeki Task ID, branch ve
  "Sahip olunan yollar" alanları güncellenir.
- Bir ajan yalnızca kendi sahip olduğu yollarda değişiklik yapar.
- Sahiplik dışı bir dosyada değişiklik gerekiyorsa önce `HANDOFF.md` güncellenir.

---

## 5. Kod yazmadan önce mevcut kodu inceleme

- Yeni dosya oluşturmadan önce aynı işi yapan bir dosya olup olmadığı aranır.
- Mevcut adlandırma, klasör düzeni ve yorum yoğunluğu korunur.
- Var olan bir yardımcı fonksiyon varsa yenisi yazılmaz.

---

## 6. Test edilmeden görev tamamlanmış sayılmaz

- `npm run verify` çalıştırılmadan hiçbir görev "tamamlandı" olarak raporlanmaz.
- `verify` sırayla `lint`, `typecheck`, `test` ve `build` çalıştırır.
- Testler kırmızıyken commit atılmaz.
- Uyarılar görmezden gelinmez; ya giderilir ya da `SESSION_LOG.md` içinde
  gerekçesiyle birlikte kayıt altına alınır.
- Test çıktısı **uydurulmaz**. Yalnızca gerçekten çalıştırılan komutların
  gerçek çıktısı raporlanır.

---

## 7. SESSION_LOG.md

- Append-only'dir. Eski kayıtlar **değiştirilmez ve silinmez.**
- Her oturum için yeni kayıt eklenir.
- Kayıt en az şunları içerir: tarih/saat, ajan, Task ID, branch, incelenen
  dosyalar, değiştirilen dosyalar, alınan kararlar, çalıştırılan komutlar,
  komutların gerçek sonuçları, test sonuçları, kalan riskler, devir notu.

---

## 8. Gizli bilgi

- Parola, bağlantı adresi, token, anahtar **hiçbir koşulda commit edilmez.**
- `.env` dosyaları `.gitignore` içindedir ve orada kalır.
- Yalnızca `.env.example` ve `.env.test.example` commit edilir; içlerinde
  gerçek değer değil `CHANGE_ME` yer alır.
- Dokümanlara, README'ye veya yorum satırlarına gerçek parola yazılmaz.
- Commit öncesi diff gizli bilgi taramasından geçirilir.

---

## 9. Veritabanı güvenliği

Aşağıdakiler **kesinlikle yasaktır**:

- `DROP DATABASE`
- `DROP TABLE`
- `TRUNCATE`
- `prisma migrate reset`
- `prisma db push --force-reset`
- Tüm tabloları silen veya boşaltan scriptler
- Kullanıcı onayı olmadan çalıştırılan destructive migration

Kurallar:

- Mevcut `CafeAdisyon` veritabanı korunur.
- Bağlantı doğrulaması yalnızca `SELECT 1` gibi **okuma** sorgusuyla yapılır.
- Migration üretilecekse önce kullanıcıya ne yapacağı anlatılır ve onay alınır.
- Domain kayıtları fiziksel olarak silinmez; iptal/pasif alanları kullanılır.

---

## 10. Git kuralları

- `main` branch'ine **doğrudan özellik geliştirilmez.** İstisna yalnızca ilk
  bootstrap commit'idir.
- Her Phase kendi branch'inde çalışır: `feat/phase-<n>-<konu>`
- **Kullanıcı istemeden merge yapılmaz.**
- **Force push yapılmaz.**
- Branch silinmez.
- Commit mesajları Conventional Commits biçimindedir.
- PR'lar draft olarak açılır ve reviewer ajanı beklenir.

---

## 11. Kod kalitesi

Yasak:

- `any`
- `@ts-ignore`, `@ts-nocheck`
- Kontrolsüz type assertion (`as` ile tip zorlama). Doğrulanmış tip koruyucu
  (`value is T` döndüren fonksiyon) kullanılır.
- Gerçek hatayı gizleyen `eslint-disable`
- Kalıntı `console.log`
- Geçici hack ve "sonra düzeltirim" notuyla bırakılan kod
- Sahte/uydurma veri (`lorem ipsum`, örnek masa listesi, sahte ciro)
- Tıklanınca hiçbir şey yapmayan placeholder buton
- Kullanılmayan dosya, kullanılmayan export

Zorunlu:

- TypeScript `strict` modu açık kalır.
- Arayüz metinleri **Türkçe**dir.
- Para değerleri **tam sayı kuruş** olarak tutulur, `Float` kullanılmaz.
- Yeni bağımlılık eklemek için gerçek bir gerekçe gerekir; küçük bir yardımcı
  fonksiyonla çözülebilen şey için paket eklenmez.
- Eklenen her bağımlılık `SESSION_LOG.md` içinde gerekçesiyle kaydedilir.

---

## 12. Arayüz kuralları

Ayrıntılar `docs/UI_GUIDE.md` içindedir. Özet olarak yasak:

- Mor-mavi neon gradient, glassmorphism, glow, arka plan blob'ları
- Landing page / pazarlama görünümü, dev başlıklar
- Hazır admin şablonu görünümü
- İngilizce arayüz metni
- 44 pikselden küçük dokunma hedefi
- Mobilde yatay taşma

---

## 13. Kapsam dışı teknolojiler

Kullanıcı açıkça istemedikçe eklenmez:

- Docker
- Supabase, Firebase, Railway, Vercel veya herhangi bir bulut servisi
- Electron, native mobil uygulama
- PWA / offline senkronizasyon
- Çok kiracılı (multi-tenant) SaaS mimarisi
- Socket.IO (ilgili Phase'e kadar)
