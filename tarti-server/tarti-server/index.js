const express = require("express");
const SerialPort = require("serialport").SerialPort;
const Readline = require("@serialport/parser-readline").ReadlineParser;
const cors = require("cors");

const app = express();
app.use(cors());

let lastWeight = "0.00";

// Seri portu başlat (COM3 portunu tartına göre değiştir!)
try {
  const port = new SerialPort({
    path: "COM3",
    baudRate: 9600,
  });

  const parser = port.pipe(new Readline({ delimiter: "\r\n" }));

  parser.on("data", (data) => {
    // Tartının gönderdiği veri örneği: "W: 0123.45 kg"
    const match = data.match(/(\d+[\.,]?\d*)/);
    if (match) {
      lastWeight = parseFloat(match[1].replace(",", ".")).toFixed(2);
      console.log("Tartım:", lastWeight);
    }
  });

  port.on('error', (err) => {
    console.error('Tartı bağlantı hatası:', err.message);
    lastWeight = "Tartı bağlı değil";
  });
} catch (error) {
  console.error('Tartı bağlantısı kurulamadı:', error.message);
  lastWeight = "Tartı bağlı değil";
}

// API endpoint
app.get("/weight", (req, res) => {
  res.json({ weight: lastWeight });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Tartı sunucusu ${PORT} portunda çalışıyor...`);
});
