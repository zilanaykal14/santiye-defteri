# Şantiye Defteri — Kurulum Rehberi

Toplam süre: yaklaşık 15 dakika. Bilgisayardan yapmanız daha kolay olur.
Sonunda herkesin telefonunda çalışan, şifreli, ortak verili bir uygulamanız olacak.

---

## 1. Supabase hesabı ve proje (veritabanı)

1. **supabase.com** adresine gidin → **Start your project** → GitHub veya e-posta ile ücretsiz hesap açın.
2. **New project** deyin:
   - **Name:** `santiye-defteri`
   - **Database Password:** güçlü bir şifre yazın ve bir yere kaydedin (uygulamada kullanılmaz ama saklayın).
   - **Region:** `Central EU (Frankfurt)` (Türkiye'ye en yakın).
   - **Create new project** → 1-2 dakika hazırlanmasını bekleyin.

## 2. Tabloları oluşturun (tek seferlik)

1. Sol menüden **SQL Editor** → **New query**.
2. Size gönderdiğim `supabase/schema.sql` dosyasının **tamamını** kopyalayıp yapıştırın.
3. Sağ alttaki **Run** düğmesine basın. "Success. No rows returned" görmelisiniz.

## 3. E-posta onayını kapatın (önemli)

Kullanıcılar e-posta değil **kullanıcı adı** ile giriş yapacak; bu yüzden onay e-postası gönderilmemeli.

1. Sol menü **Authentication** → **Sign In / Providers** → **Email**.
2. **Confirm email** anahtarını **kapatın** → **Save**.
3. Aynı Authentication ayarlarında **Allow new users to sign up** **açık** kalmalı
   (yeni elemanları siz uygulamadan eklerken bu kullanılır; yabancı biri kayıt olsa bile
   siz onaylamadan hiçbir şey göremez).

## 4. İki bilgiyi bana gönderin

1. Üstteki **Connect** düğmesine basın (veya **Project Settings → API Keys**).
2. Şu ikisini kopyalayıp bana yazın:
   - **Project URL** → `https://xxxxxxxx.supabase.co` gibi
   - **Publishable key** → `sb_publishable_...` ile başlar (yoksa **anon public** anahtarı)

Bu iki bilgi tarayıcıda kullanılmak üzere tasarlanmıştır, paylaşmanız güvenlidir.
**`service_role` / `secret` anahtarını kimseye vermeyin, bana da göndermeyin.**

Ben bu bilgilerle uygulamayı hazırlayıp size **`santiye-defteri-yayin.zip`** göndereceğim.

## 5. Netlify ile yayına alın

1. **app.netlify.com** → ücretsiz hesap açın.
2. **Add new project → Deploy manually** (veya **app.netlify.com/drop**).
3. Gönderdiğim zip'i açın, içindeki **`dist`** klasörünü sürükleyip bırakın.
4. Birkaç saniyede adresiniz hazır olur: `https://rastgele-isim.netlify.app`
5. İsterseniz **Project configuration → Change project name** ile adı `santiye-defteri` gibi yapın.

**Güncelleme geldiğinde:** Netlify'da projenize girin → **Deploys** sekmesindeki
**Production deploys** alanına yeni `dist` klasörünü sürükleyin. Herkesin uygulaması kendiliğinden güncellenir.

## 6. İlk giriş: yönetici hesabınız

1. Adresi açın → **İlk kurulum** ekranı çıkar.
2. Adınızı, kullanıcı adınızı ve şifrenizi (en az 6 karakter) girin.
   **İlk oluşturulan hesap otomatik yöneticidir** — bu yüzden yayına alır almaz bu adımı siz yapın.
3. **Ortaklar & Ayarlar** → ortakları ekleyin (kardeşiniz, ortaklar…).
4. **İnşaatlar → Yeni proje** → ortakları ve hisse oranlarını girin.
5. **Kullanıcılar & Şifreler → Kullanıcı ekle** → şantiye şefi, muhasebe vb.
   Her kişinin kartında hangi sayfalara girebileceğini işaretleyin.
6. Kişiye **adresi, kullanıcı adını ve şifresini** iletin.

## 7. Telefona uygulama olarak ekleyin

- **iPhone:** Adresi **Safari**'de açın → alttaki **Paylaş** (□↑) → **Ana Ekrana Ekle**.
- **Android:** Adresi **Chrome**'da açın → çıkan **Yükle** düğmesine basın
  (çıkmazsa sağ üst ⋮ → **Uygulamayı yükle / Ana ekrana ekle**).

Ana ekranda turuncu baret ikonu belirir; uygulama gibi tam ekran açılır, oturum açık kalır.

---

## Bilmeniz gerekenler

- **İnternet yokken:** Şantiyede çekmese de kayıt girebilirsiniz. Sol alttaki durum
  "İnternet yok · 3 kayıt bekliyor" der; bağlantı gelince kendiliğinden gönderilir.
  Bekleyen kayıt varken **çıkış yapmayın**.
- **Aynı anda kullanım:** Biri kayıt girdiğinde diğerlerinin ekranına birkaç saniye içinde düşer.
- **Kim ne yaptı:** Silinen ve değiştirilen her kayıt, kim tarafından ne zaman yapıldığıyla
  Supabase'de `audit_log` tablosunda saklanır (Table Editor → audit_log).
- **Şifre unutulursa:** Yönetici, **Kullanıcılar & Şifreler**'de o kişiye **Şifre belirle** der.
- **İşten ayrılan eleman:** Kartından **Hesabı kapat** — anında hiçbir şey göremez.
- **Yedek:** Ayda bir **Ortaklar & Ayarlar → Yedek indir** ile JSON yedeği alın.
- **Ücret:** Bu kullanım ölçeğinde Supabase ve Netlify'ın ücretsiz planları yeterlidir.
  Supabase ücretsiz projeyi **bir hafta hiç kullanılmazsa** uyku moduna alır;
  panelden **Restore** ile tekrar açılır. Her gün kullanılan bir sistemde sorun olmaz.
