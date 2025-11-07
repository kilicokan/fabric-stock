import type { NextApiRequest, NextApiResponse } from 'next';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { port = 'COM3', baudRate = '9600' } = req.query; // ✅ LP150 için 9600 default

  try {
    const serialPort = new SerialPort({
      path: port as string,
      baudRate: parseInt(baudRate as string),
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
    });

    const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    let lastLine = '';
    let responded = false;

    // ✅ 3 saniye içinde veri gelmezse hata döndür
    const timeout = setTimeout(() => {
      if (!responded) {
        serialPort.close();
        responded = true;
        return res.status(504).json({ error: 'Tartıdan veri gelmedi (timeout)' });
      }
    }, 3000);

    parser.on('data', (line: string) => {
      // Gereksiz büyük veri bloklarını atla
      if (line.length > 50) return;

      console.log('Tartı verisi:', line.trim());
      lastLine = line.trim();

      // ✅ Örnek formatlardan birini yakala
      const match = lastLine.match(/(\d+[.,]?\d*)/);
      if (match && !responded) {
        const weight = parseFloat(match[1].replace(',', '.')).toFixed(2);
        responded = true;
        clearTimeout(timeout);

        serialPort.close((err) => {
          if (err) console.error('Port kapatılırken hata:', err);
          return res.status(200).json({ weight });
        });
      }
    });

    serialPort.on('error', (err) => {
      console.error('Serial port hatası:', err);
      clearTimeout(timeout);
      if (!responded) {
        responded = true;
        return res.status(500).json({ error: 'Tartı bağlı değil veya port hatası' });
      }
    });

    serialPort.on('open', () => {
      console.log(`✅ ${port} portundan ${baudRate} baud ile bağlantı kuruldu`);
      // LP150 continuous modda olduğu için komut göndermeye gerek yok
      // serialPort.write('W\r\n'); // Eğer manuel moddaysa aktif etmek için kullanılabilir
    });
  } catch (error: any) {
    console.error('Tartı bağlantı hatası:', error);
    return res.status(500).json({ error: 'Tartı bağlanamadı' });
  }
}
