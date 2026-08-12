# WORKFLOW.md — Phase çalışma düzeni

Bu belge bir Phase'in baştan sona nasıl yürütüleceğini tanımlar.
Kurallar için bkz. [AGENTS.md](AGENTS.md).

> **Claude ve Codex eş zamanlı çalışamaz.** Aynı anda yalnızca bir ajan aktif
> geliştiricidir. Diğer ajan reviewer rolündedir ve devir tamamlanmadan
> kod değiştirmez. Aktif ajan [HANDOFF.md](HANDOFF.md) içinde yazılıdır.

---

## 1. Repository ve branch kontrolü

```bash
git status
git branch --show-current
git remote -v
```

- Çalışma ağacı temiz olmalıdır.
- Aktif branch, `HANDOFF.md` içindeki branch ile aynı olmalıdır.
- `main` üzerinde özellik geliştirilmez.

Uyuşmazlık varsa durulur ve kullanıcıya bildirilir.

---

## 2. Dokümantasyon okuma

`CLAUDE.md` §1'deki sırayla tüm belgeler okunur. Bu adım atlanamaz.

---

## 3. Görev sahipliği alma

`HANDOFF.md` güncellenir:

- Task ID
- Aktif ajan
- Branch
- Sahip olunan yollar
- Durum → `Devam ediyor`
- Başlangıç tarihi

---

## 4. Mevcut kodu inceleme

- Değiştirilecek dosyalar ve testleri okunur.
- Aynı işi yapan mevcut bir çözüm olup olmadığı aranır.
- Kullanılan desenler, adlandırma ve klasör düzeni tespit edilir.

---

## 5. Uygulama

- Yalnızca aktif Phase kapsamındaki iş yapılır.
- Çevredeki kodun üslubuna uyulur.
- Placeholder, sahte veri ve geçici hack bırakılmaz.
- Yeni bağımlılık gerekçesiz eklenmez.

---

## 6. Test

```bash
npm run verify
```

`verify` sırayla `lint`, `typecheck`, `test`, `build` çalıştırır.
Kırmızı bir adım varsa görev tamamlanmamıştır. Çıktı **saklanır**;
`SESSION_LOG.md` içine gerçek sonuçlar yazılacaktır.

Veritabanına dokunan bir değişiklik yapıldıysa ek olarak:

```bash
npm run db:check
```

---

## 7. Diff inceleme

```bash
git diff
git status
```

- Diff baştan sona okunur.
- İstenmeyen dosya (derleme çıktısı, `.env`, geçici dosya) var mı bakılır.
- Gizli bilgi taraması yapılır: parola, token, anahtar, gerçek bağlantı adresi.

---

## 8. SESSION_LOG güncelleme

`SESSION_LOG.md` sonuna **yeni** kayıt eklenir. Eski kayıt değiştirilmez.
Kayıt biçimi dosyanın başındaki şablona uyar.

---

## 9. HANDOFF güncelleme

`HANDOFF.md` içinde:

- Durum → `Review bekliyor`
- Yapılan son işlem
- Sonraki beklenen işlem
- Bilinen risk veya engel
- Reviewer

---

## 10. Commit

```bash
git add -A
git commit -m "<tip>: <açıklama>"
```

Conventional Commits kullanılır: `feat`, `fix`, `chore`, `docs`, `refactor`,
`test`, `build`.

---

## 11. Push

```bash
git push -u origin <branch>
```

Force push yapılmaz.

---

## 12. Draft PR

```bash
gh pr create --draft --base main --head <branch> --title "<başlık>" --body-file <dosya>
```

PR açıklamasında yer alması gerekenler:

- Yapılanlar
- Mimari kararlar
- Test sonuçları (gerçek çıktı)
- Veritabanı doğrulama durumu
- Yerel ağ kullanım şekli
- Kapsam dışında bırakılanlar
- Bilinen riskler
- Reviewer'dan beklenen

`gh` yoksa veya yetki yoksa durum açıkça raporlanır, push yine tamamlanır.

---

## 13. Reviewer ajanına devir

- `HANDOFF.md` içinde aktif ajan reviewer olarak güncellenir.
- Devralan ajan için "Sonraki beklenen işlem" net yazılır.
- Aktif ajan bu noktadan sonra kod değiştirmez.
- **Merge yapılmaz.** Merge kararı kullanıcıya aittir.
- **Bir sonraki Phase'e geçilmez.**
