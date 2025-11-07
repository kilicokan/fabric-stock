const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

console.log('🔍 Tartı cihazı debug aracı');
console.log('Mevcut seri portlar:');

// List available ports
SerialPort.list().then(ports => {
  ports.forEach(port => {
    console.log(`- ${port.path}: ${port.manufacturer || 'Unknown'} (${port.serialNumber || 'No SN'})`);
  });

  // Test COM3 with 19200 baud rate (working one)
  console.log('\n📡 COM3 portuna 9600 baud rate ile bağlanıyor...');

  const port = new SerialPort({
    path: 'COM3',
    baudRate:9600,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

  port.on('open', () => {
    console.log('✅ Port 9600 baud ile açıldı');
    console.log('⏳ Tartıya bir şey koyup kaldırın, veri gelip gelmediğini kontrol edin...');

    // Listen for 30 seconds
    setTimeout(() => {
      console.log('⏰ 30 saniye dinleme tamamlandı');
      port.close();
      process.exit(0);
    }, 30000);
  });

  parser.on('data', (data) => {
    console.log('📨 Gelen veri:', data);
    console.log('📨 Ham buffer:', data.toString());
    console.log('📨 Veri uzunluğu:', data.length);
    console.log('📨 Hex:', data.toString('hex'));
  });

  port.on('error', (err) => {
    console.error('❌ Hata:', err.message);
    process.exit(1);
  });

}).catch(err => {
  console.error('Port listesi alınamadı:', err);
});
