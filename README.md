# Şantiye Defteri

Gayrimenkul portföy, inşaat şantiye ve ortaklık masraf takip sistemi.
Vite + React 19 + TypeScript · Tailwind CSS v4 · shadcn/ui tarzı bileşenler (Radix) · Zustand · TanStack Table · Recharts · lucide-react

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # mahsuplaşma motoru + kira + para birimi testleri
npm run build      # üretim derlemesi (dist/)
```

## Canlıya alma (gerçek kullanım)

Adım adım rehber: **[KURULUM.md](KURULUM.md)** — Supabase (veritabanı + giriş) ve Netlify (adres).
`.env` dosyasına `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` yazıldığında uygulama
**bulut moduna** geçer: Supabase Auth ile giriş, satır düzeyinde yetki (RLS), canlı güncelleme,
çevrimdışı kuyruk ve telefona kurulabilir uygulama (PWA). Anahtarlar yoksa yerel demo modunda çalışır.

## Giriş ve yetkiler (yerel demo modu)

Uygulama şifre ile açılır. Demo hesapları (ilk iş şifreleri değiştirin):

| Kullanıcı | Şifre | Erişim |
|---|---|---|
| `yonetici` | 1234 | Her yer + Kullanıcılar & Şifreler |
| `santiye` | 1111 | Şantiye Günlüğü, İnşaatlar · ekler, silemez |
| `muhasebe` | 2222 | Genel Bakış, Kiracılar, Mülkler, İşlemler |

Yönetici **Kullanıcılar & Şifreler** sayfasından kişi ekler, şifre belirler, her elemanın girebileceği
sayfaları ve "ekleyebilir / düzenleyip silebilir" yetkilerini kutucuklarla seçer. 5 hatalı denemede giriş
30 sn kilitlenir. Şifreler tuzlu SHA-256 ile saklanır.

> ⚠️ Bu kilit tarayıcı içindedir: aynı bilgisayardaki meraklılara karşı korur, ama teknik bilgisi olan biri
> tarayıcı verisini okuyabilir. Ayrıca veriler yalnızca o tarayıcıda durur; elemanlar kendi telefonlarından
> aynı veriyi göremez. Çok kişili gerçek kullanım için Supabase Auth'a geçin (aşağıda).

İlk açılışta demo verisi yüklenir (tarihler bugüne göre üretilir). **Ortaklar & Ayarlar** sayfasından
temizleyebilir, JSON yedek alıp geri yükleyebilirsiniz.

## Sayfalar

| Rota | İçerik |
|---|---|
| `/gunluk` | **Şantiye günlüğü**: gün gün "ne oldu, ne harcandı, kim ödedi"; tek formda not + birden çok gider |
| `/kiracilar` | **Sade kiracı ekleme** (6 alan, gerisi isteğe bağlı), "Kira aldım" butonu, gecikenler filtresi |
| `/kullanicilar` | Kullanıcılar, şifreler, sayfa yetkileri (yalnızca yönetici) |
| `/dashboard` | 4 ana metrik, acil uyarılar (geciken kira, bekleyen ortak ödemesi, bütçe aşımı, biten sözleşme), nakit akışı ve proje harcama grafikleri |
| `/insaatlar`, `/insaatlar/:id` | Proje kartları; bütçe vs. gerçekleşen, giderler, taşeron hakedişleri, hisse dağılımı |
| `/mahsuplasma` | Kim kime ne ödemeli, net pozisyonlar, ortak bazlı cari hesap defteri, CSV/yazdır |
| `/mulkler-ve-kiralar` | Aylık kira ödeme matrisi, kiracı kartları, mülk/tapu bilgisi, mülk giderleri |
| `/yeni-islem` | Hızlı işlem modalı (her sayfadan "Yeni İşlem" ile de açılır) |
| `/islemler`, `/ayarlar` | Tüm defter (filtre, düzenle, sil) · ortaklar, yedekleme |

## Mimari

```
src/
  types/            Alan modeli (tüm TypeScript arayüzleri)
  lib/
    settlement.ts   MAHSUPLAŞMA MOTORU (saf fonksiyonlar + testler)
    rent.ts         Kira takvimi, artış, gecikme durumu
    metrics.ts      Dashboard metrikleri
    money.ts        Kuruş aritmetiği, kuruşu kaybetmeyen hisse dağıtımı
    repository.ts   Depolama adaptörü (localStorage → Supabase)
  store/            Zustand (kalıcı veri + arayüz durumu)
  components/ui     shadcn tarzı temel bileşenler
  features/         Sayfa bazlı modüller
supabase/schema.sql PostgreSQL şeması + RLS
```

### Finansal doğruluk kuralları
- **Tüm tutarlar tam sayı kuruş** (`100.000 TL = 10_000_000`). Float yuvarlama hatası yok.
- Hisseler **baz puan** (`%50 = 5000`), proje kaydında toplam tam %100 olmak zorunda.
- Bir gider ortaklara bölünürken **en büyük kalan yöntemi** kullanılır: parçaların toplamı her zaman faturaya eşittir.
- Değişmez: her projede `Σ ortak net bakiyesi = 0` (testle doğrulanır).

### Mahsuplaşma mantığı
Her işlemde 3 seçim zorunludur: **gider türü** (ortak/şahsi), **ödeyen** (ortak kasa veya bir ortağın cebi),
ve sistem **mahsuplaşma etkisini** otomatik hesaplayıp formda canlı gösterir.

Örnek: Kardeşiniz cebinden 100.000 TL demir öderse (hisseler %50/%30/%20) → kardeşiniz +50.000 alacaklı,
Ortak 1 −30.000, Ortak 2 −20.000 borçlu. Kasaya sermaye koyma, ortak geliri cebe alma, kasadan şahsi
harcama ve ortaklar arası ödeme de aynı motorla işlenir (kurallar tablosu `src/lib/settlement.ts` başında).
"Kim kime ödemeli" listesi, bakiyeleri en az sayıda transferle sıfırlar.

## Supabase'e geçiş
1. `supabase/schema.sql`'i SQL editörde çalıştırın.
2. `npm i @supabase/supabase-js`
3. Hızlı yol: `src/lib/repository.ts` içindeki `supabaseStorage` örneğini persist `storage`'ı olarak verin (tek kullanıcı).
4. Doğru yol (çok kullanıcı): store aksiyonlarında (`addTransaction`, `upsert`, `remove`) ilgili tabloya yazın,
   açılışta tabloları okuyun. İş mantığı (`lib/`) saf olduğu için değişmez.
