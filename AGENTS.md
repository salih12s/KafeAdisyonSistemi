# AGENTS.md — Claude ve Codex için bağlayıcı proje kuralları

Bu belge Kafe Adisyon Sistemi üzerinde çalışan tüm yapay zekâ ajanları için
**bağlayıcıdır**. Diğer belgeler bu kuralları tekrar etmez, buraya referans verir.

---

## 1. Her görevden önce okunacak dosyalar (bu sırayla)

1. `AGENTS.md` (bu dosya)
2. `HANDOFF.md`
3. `DECISIONS.md`
4. `docs/PHASES.md`
5. Mevcut kod ve testler

Ek belgeler (gerektiğinde): `WORKFLOW.md`, `SESSION_LOG.md`,
`docs/ARCHITECTURE.md`, `docs/PRODUCT_SCOPE.md`, `docs/UI_GUIDE.md`.

Bu sıra atlanamaz. "Kısa bir değişiklik" gerekçesiyle de atlanamaz.

---

## 2. Kod yazmadan önce mevcut repository incelenir

- Yeni dosya oluşturmadan önce aynı işi yapan bir dosya olup olmadığı aranır.
- Mevcut adlandırma, klasör düzeni ve yorum yoğunluğu korunur.
- Var olan bir yardımcı fonksiyon varsa yenisi yazılmaz.

---

## 3. Aktif Phase dışına çıkılmaz

- Ajan yalnızca aktif Phase'in kapsamındaki işi yapar.
- Kapsam dışı bir ihtiyaç fark edilirse kod yazılmaz; `HANDOFF.md` içindeki
  "Bilinen eksikler" bölümüne not düşülür ve kullanıcıya bildirilir.
- Phase'in tamamlanma kriterleri sağlanmadan Phase "tamamlandı" sayılmaz.

---

## 4. Aynı anda yalnızca bir ajan kod yazar

- O anki ana geliştirici `HANDOFF.md` içinde yazılıdır.
- Ana geliştirici değilken kod değiştirilmez.
- Devir tamamlanmadan diğer ajan çalışmaya başlamaz.

---

## 5. Review düzeni — Phase başına review YOKTUR

Bu kural **2026-08-12 tarihinde kullanıcı tarafından değiştirilmiştir.**

- Phase sonunda **ayrı bir Claude/Codex review adımı beklenmez.**
- Bir Phase şu koşullarda kapanır: iş biter → testler geçer → commit + push →
  draft PR açılır → **merge edilmez**.
- Draft PR açıldıktan sonra **sonraki Phase hemen başlayabilir.** Önceki
  Phase'in açık PR'ı sonraki Phase'i **bloke etmez.**
- Review, **tüm proje bittikten sonra tek kapsamlı review** olarak yapılacaktır.
- `HANDOFF.md` bir reviewer'a değil, **sonraki geliştiriciye** hazırlanır.

Merge kararı her durumda kullanıcıya aittir; ajan merge yapmaz.

---

## 6. Test edilmemiş iş tamamlanmış sayılmaz

- `npm run verify` çalıştırılmadan hiçbir görev "tamamlandı" olarak raporlanmaz.
- `verify` sırayla `lint`, `typecheck`, `test` ve `build` çalıştırır.
- Testler kırmızıyken commit atılmaz.
- Uyarılar görmezden gelinmez; ya giderilir ya da `HANDOFF.md` içinde
  gerekçesiyle kaydedilir.
- Test çıktısı **uydurulmaz.** Yalnızca gerçekten çalıştırılan komutların
  gerçek çıktısı raporlanır.

---

## 7. Her ajan yaptığı işi HANDOFF.md içine kaydeder

`HANDOFF.md` her görev sonunda güncellenir: aktif Phase, aktif branch, ana
geliştirici, son commit, yapılan işler, değiştirilen önemli dosyalar,
çalıştırılan testler, test sonuçları, bilinen eksikler ve **sonraki
geliştiricinin işi**. Reviewer alanı yoktur (bkz. §5).

`SESSION_LOG.md` ayrıntılı oturum kaydı tutar ve **append-only**'dir:
eski kayıtlar değiştirilmez ve silinmez.

---

## 8. Gizli bilgi

- Parola, bağlantı adresi, token, anahtar **hiçbir koşulda commit edilmez.**
- `.env` dosyaları `.gitignore` içindedir ve orada kalır.
- Yalnızca `.env.example` ve `.env.test.example` commit edilir; içlerinde
  gerçek değer değil `CHANGE_ME` yer alır.
- Dokümanlara, README'ye veya yorum satırlarına gerçek parola yazılmaz.
- Commit öncesi diff gizli bilgi taramasından geçirilir.

---

## 9. Destructive database işlemi yapılmaz

Aşağıdakiler **kesinlikle yasaktır**:

- `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`
- `prisma migrate reset`
- `prisma db push --force-reset`
- Tüm tabloları silen veya boşaltan scriptler
- Kullanıcı onayı olmadan çalıştırılan destructive migration

Kurallar:

- Mevcut `CafeAdisyon` veritabanı korunur; silinmez, resetlenmez,
  yeniden oluşturulmaz.
- Bağlantı doğrulaması yalnızca `SELECT 1` gibi **okuma** sorgusuyla yapılır.
- Migration üretilecekse önce kullanıcıya ne yapacağı anlatılır ve onay alınır.
- Domain kayıtları fiziksel olarak silinmez; iptal/pasif alanları kullanılır.

---

## 10. Git kuralları

- `main` branch'ine **doğrudan Phase kodu yazılmaz.** İstisna yalnızca ilk
  bootstrap commit'idir.
- Her Phase kendi branch'inde çalışır: `feat/phase-<n>-<konu>`
- Bir Phase branch'i, bir önceki Phase branch'inden açılır ve PR'ı da ona
  hedeflenir; `main` yalnızca proje sonunda toplanır.
- **Kullanıcı istemeden merge yapılmaz.**
- **Force push yapılmaz.** Push edilmiş commit yeniden yazılmaz; düzeltme
  yeni bir commit ile yapılır.
- Kullanıcının mevcut dosyaları silinmez.
- Commit mesajları Conventional Commits biçimindedir.
- PR'lar **draft** olarak açılır ve açık bırakılır; review beklenmez (§5).

---

## 11. Kod kalitesi

Yasak:

- `any`
- `@ts-ignore`, `@ts-nocheck`
- Gereksiz/kontrolsüz type assertion (`as` ile tip zorlama). Doğrulanmış tip
  koruyucu (`value is T` döndüren fonksiyon) kullanılır.
- Gerçek hatayı gizleyen `eslint-disable`
- Kalıntı `console.log`
- Sahte test veya testi geçirmek için anlamsız mock
- Geçici hack ve "sonra düzeltirim" notuyla bırakılan kod
- Sahte/uydurma veri (`lorem ipsum`, örnek masa listesi, sahte ciro)
- Tıklanınca hiçbir şey yapmayan placeholder buton
- Kullanılmayan dosya, kullanılmayan export

Zorunlu:

- TypeScript `strict` modu açık kalır.
- Arayüz metinleri **Türkçe**dir.
- Para değerleri **tam sayı kuruş** olarak tutulur, `Float` kullanılmaz.
- Frontend API adresini hardcode etmez; göreli `/api` yolları kullanılır.
- Yeni bağımlılık eklemek için gerçek bir gerekçe gerekir.

---

## 12. Arayüz kuralları

Ayrıntılar `docs/UI_GUIDE.md` içindedir. Özet olarak yasak:

- Mor-mavi gradient, glassmorphism, neon glow, arka plan blob'ları
- Aşırı büyük kartlar, her yerde yuvarlak pill kullanımı
- Landing page / hazır AI dashboard görünümü
- İngilizce arayüz metni, lorem ipsum
- Gereksiz animasyon, çalışmayan butonlar
- 44 pikselden küçük dokunma hedefi, mobilde yatay taşma

---

## 13. Şimdilik geliştirilmeyecekler

Kullanıcı açıkça istemedikçe eklenmez:

- Offline çalışma, PWA service worker
- Yerel ağ üzerinden IP bağlantısı
- Native mobil uygulama, Electron
- Docker, Railway deployment yapılandırması
- Çoklu işletme, çoklu şube
- Stok sistemi, yazarkasa/termal yazıcı, QR menü
- Gerçek adisyon özellikleri (aktif Phase kapsamı dışındaysa)
