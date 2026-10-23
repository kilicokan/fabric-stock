// API Response Test Script
// Node.js ile çalıştırın: node test-api-response.js

const http = require('http');

// Örnek token (gerçekte giriş yaparak almalısınız)
const TOKEN = 'your-test-token-here';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/fason/workshops-capacity',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
};

console.log('API Test Başlıyor...');
console.log(`URL: http://${options.hostname}:${options.port}${options.path}`);
console.log(`Token: ${TOKEN ? 'Var' : 'Yok'}`);
console.log('---');

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  console.log('---');

  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const parsedData = JSON.parse(data);
      console.log('Response Yapısı:');
      console.log(JSON.stringify(parsedData, null, 2));

      // Kontrol
      if (parsedData.success) {
        console.log('\n✅ Success: true');
        if (parsedData.data && parsedData.data.workshops) {
          console.log(`✅ Workshops: ${parsedData.data.workshops.length} atölye`);
        } else {
          console.log('❌ data.workshops bulunamadı');
        }
      } else {
        console.log('❌ Success: false');
      }
    } catch (e) {
      console.error('JSON Parse Hatası:', e);
      console.error('Raw Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request Hatası:', error);
});

req.end();

console.log('Not: Token yerine gerçek bir token kullanın!');
console.log('Login yaparak token alın:');
console.log('  POST http://localhost:3000/api/auth/login');
console.log('  {"email":"admin@example.com","password":"password"}');
