const http = require('http');
const token = 'test-token';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  const q = 'Stok sorgula';
  const r = await post('/api/erp-assistant/chat', { query: q, context: { path: '/dashboard' } });
  console.log('stok status', r.status);
  console.log(r.data?.data?.text || JSON.stringify(r.data).slice(0, 200));

  const q2 = 'Kesim emirleri';
  const r2 = await post('/api/erp-assistant/chat', { query: q2, context: { path: '/dashboard' } });
  console.log('kesim status', r2.status);
  console.log(r2.data?.data?.text || JSON.stringify(r2.data).slice(0, 200));
  process.exit(0);
})();
