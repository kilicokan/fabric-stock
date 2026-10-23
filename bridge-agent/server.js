/* eslint-disable @typescript-eslint/no-require-imports */
const express = require("express");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const DEFAULT_BAUD_RATE = 19200;
const ALLOWED_BAUD_RATES = new Set([1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200]);
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
];

const parseWeight = (raw) => {
  const match = raw.match(/([+-]?\s*\d+(?:[.,]\d+)?)\s*(kg|g)?/i);
  if (!match) return null;

  const parsed = Number(match[1].replace(",", ".").replace(/\s/g, ""));
  if (!Number.isFinite(parsed)) return null;

  const unit = match[2]?.toLowerCase();
  return {
    weight: unit === "g" ? parsed / 1000 : parsed,
    stable: /\b(?:ST|GS|STABLE)\b/i.test(raw),
    raw: raw.trim(),
    receivedAt: new Date().toISOString(),
  };
};

const createBridgeApp = ({
  SerialPortClass = SerialPort,
  createParser = (port) => port.pipe(new ReadlineParser({ delimiter: "\r\n" })),
  reconnectDelayMs = 1000,
} = {}) => {
  const app = express();
  const allowedOrigins = new Set(
    (process.env.BRIDGE_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  let scale = null;

  const scheduleReconnect = (connection) => {
    if (!connection.desired || scale !== connection || connection.retryTimer) return;
    connection.retryTimer = setTimeout(() => {
      connection.retryTimer = null;
      openScale(connection);
    }, reconnectDelayMs);
  };

  const openScale = (connection, onInitialError) => {
    if (!connection.desired || scale !== connection) return;
    const serialPort = new SerialPortClass({
      path: connection.requestedPort,
      baudRate: connection.baudRate,
      autoOpen: false,
    });
    connection.port = serialPort;
    serialPort.on("error", (error) => {
      connection.error = error.message;
      console.error("Tartı seri port hatası:", error);
    });
    serialPort.on("close", () => {
      if (scale !== connection || connection.port !== serialPort) return;
      connection.reading = null;
      connection.error = "Tartı bağlantısı kesildi.";
      if (connection.desired && connection.hasOpened) scheduleReconnect(connection);
      else if (!connection.desired) scale = null;
    });

    serialPort.open((error) => {
      if (scale !== connection || connection.port !== serialPort) return;
      if (error) {
        connection.error = error.message;
        console.error("Tartı bağlantı hatası:", error);
        if (connection.hasOpened) {
          scheduleReconnect(connection);
          return;
        }
        connection.desired = false;
        scale = null;
        return onInitialError?.(error);
      }

      connection.error = null;
      connection.hasOpened = true;
      connection.parser = createParser(serialPort);
      connection.parser.on("data", (data) => {
        const raw = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
        connection.reading = parseWeight(raw);
      });
      connection.parser.on("error", (parserError) => {
        connection.error = parserError.message;
        console.error("Tartı veri ayrıştırma hatası:", parserError);
      });
      connection.parser.on("close", () => {
        if (connection.port === serialPort && connection.desired) scheduleReconnect(connection);
      });
      if (onInitialError) onInitialError(null);
    });
  };

  app.disable("x-powered-by");
  app.use(express.json({ limit: "4kb" }));
  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin && !allowedOrigins.has(origin)) {
      return res.status(403).json({ ok: false, error: "Bu origin bridge erişim listesinde değil." });
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "cutting-bridge",
      scaleConnected: Boolean(scale?.port.isOpen),
    });
  });

  app.post("/scale/connect", (req, res) => {
    const { port, baudRate = DEFAULT_BAUD_RATE } = req.body || {};
    if (typeof port !== "string" || !port.trim() || port.length > 128 || port.includes("\0")) {
      return res.status(400).json({ ok: false, error: "Geçerli bir seri port (ör. COM3) gerekli." });
    }
    if (!Number.isInteger(baudRate) || !ALLOWED_BAUD_RATES.has(baudRate)) {
      return res.status(400).json({ ok: false, error: "Desteklenmeyen baud rate." });
    }
    if (scale) {
      if (scale.requestedPort === port.trim() && scale.baudRate === baudRate) {
        return res.json({ ok: true, port: scale.requestedPort, baudRate: scale.baudRate });
      }
      return res.status(409).json({ ok: false, error: "Bir tartı bağlantısı zaten açık." });
    }

    const connection = {
      port: null,
      requestedPort: port.trim(),
      baudRate,
      reading: null,
      error: null,
      parser: null,
      retryTimer: null,
      desired: true,
      hasOpened: false,
    };
    scale = connection;
    openScale(connection, (error) => {
      if (error) {
        return res.status(502).json({ ok: false, error: `Tartıya bağlanılamadı: ${error.message}` });
      }
      return res.json({ ok: true, port: port.trim(), baudRate });
    });
  });

  app.get("/scale/weight", (_req, res) => {
    if (!scale?.port.isOpen) {
      return res.status(503).json({ ok: false, error: "Tartı bağlı değil." });
    }
    if (scale.error) {
      return res.status(502).json({ ok: false, error: scale.error });
    }
    if (!scale.reading) {
      return res.status(503).json({ ok: false, error: "Tartıdan henüz geçerli veri alınmadı." });
    }
    return res.json({ ok: true, ...scale.reading });
  });

  app.post("/scale/disconnect", (_req, res) => {
    if (!scale) return res.json({ ok: true, disconnected: false });

    const connection = scale;
    connection.desired = false;
    if (connection.retryTimer) clearTimeout(connection.retryTimer);
    scale = null;
    if (!connection.port?.isOpen) return res.json({ ok: true, disconnected: true });

    connection.port.close((error) => {
      if (error) {
        console.error("Tartı bağlantısı kesilemedi:", error);
        return res.status(502).json({ ok: false, error: `Tartı bağlantısı kesilemedi: ${error.message}` });
      }
      return res.json({ ok: true, disconnected: true });
    });
  });

  return app;
};

if (require.main === module) {
  const port = Number(process.env.BRIDGE_PORT || 7001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("BRIDGE_PORT 1-65535 arasında bir port olmalıdır.");
  }
  createBridgeApp().listen(port, "127.0.0.1", () => {
    console.log(`Cutting Bridge çalışıyor: http://127.0.0.1:${port}`);
  });
}

module.exports = { createBridgeApp, parseWeight };
