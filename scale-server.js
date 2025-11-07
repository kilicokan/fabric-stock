const express = require("express");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const cors = require("cors");

const app = express();
app.use(cors());

let lastWeight = "0.00";

// ✅ Tartı cihazınızın bağlı olduğu COM portu buradan değiştir
const port = new SerialPort({ path: "COM3", baudRate: 19200 });
const parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

parser.on("data", (data) => {
  const match = data.match(/(\d+[\.,]?\d*)/);
  if (match) {
    lastWeight = parseFloat(match[1].replace(",", ".")).toFixed(2);
    console.log("Tartım:", lastWeight);
  }
});

app.get("/weight", (req, res) => {
  res.json({ weight: lastWeight });
});

app.listen(3002, () => {
  console.log("✅ Tartı servisi çalışıyor: http://localhost:3002/weight");
});
