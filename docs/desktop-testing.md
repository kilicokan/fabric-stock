# Masaüstü uygulamasını yerelde çalıştırma

Masaüstü paketi Next.js sunucusunu ve Node.js çalışma ortamını içerir. Veritabanı bağlantı bilgileri ve JWT anahtarı güvenlik nedeniyle kurulum dosyasına dahil edilmez.

## Geliştirme ve Windows paketi oluşturma

Windows'ta masaüstü geliştirme ve paketleme komutları MSVC Rust toolchain'ini ve Visual Studio C++ build tools ortamını kullanır:

```powershell
npm run dev:tauri
npm run build:desktop
```

Yalnızca masaüstü çalıştırılabilir dosyasını üretip MSI/NSIS kurulum paketi oluşturmamak için:

```powershell
npm run build:desktop:nobundle
```

Derleme betikleri Visual Studio C++ ortamını otomatik yükler ve Rust MSVC target'ını seçer.

Windows'ta geliştirme ortamınızdaki yerel ayar dosyasını uygulamanın kullanıcı yapılandırma klasörüne kopyalayın:

```powershell
$configDir = Join-Path $env:APPDATA "com.mira.fabricstock"
New-Item -ItemType Directory -Path $configDir -Force | Out-Null
Copy-Item .env.local (Join-Path $configDir ".env")
```

Yapılandırmada en az `DATABASE_URL` ve `JWT_SECRET` bulunmalıdır. `.env` dosyasını kurulum dosyasıyla paylaşmayın veya Git'e eklemeyin. Bu dosya yoksa arayüz açılır, ancak veritabanına bağlı giriş ve API işlemleri çalışmaz. Sunucu başlangıç mesajları `%LOCALAPPDATA%\com.mira.fabricstock\logs\next-server.log` dosyasına yazılır.
