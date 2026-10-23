import type { NextApiRequest, NextApiResponse } from 'next';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import type { ScaleReadFailure, ScaleReadResponse, ScaleReadSuccess } from '@/lib/scale';

export const config = {
  api: {
    responseLimit: false,
  },
};

const DEFAULT_BAUD_RATE = 19200;
const TIMEOUT_MS = 3000;

const toPortName = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] || "";
  if (typeof value !== "string") return "";
  return value.trim();
};

const toBaudRate = (value: string | string[] | undefined): number => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BAUD_RATE;
};

const parseWeight = (line: string): string | null => {
  if (line.length > 50) return null;
  const match = line.trim().match(/(\d+[.,]?\d*)/);
  if (!match) return null;
  return Number.parseFloat(match[1].replace(",", ".")).toFixed(2);
};

const closePort = async (serialPort: SerialPort): Promise<void> => {
  if (!serialPort.isOpen) return;
  await new Promise<void>((resolve) => {
    serialPort.close(() => resolve());
  });
};

const readWeightFromPort = (portPath: string, baudRate: number): Promise<ScaleReadResponse> => {
  return new Promise((resolve) => {
    let settled = false;

    const serialPort = new SerialPort({
      path: portPath,
      baudRate,
      dataBits: 8,
      parity: "none",
      stopBits: 1,
    });

    const parser = serialPort.pipe(new ReadlineParser({ delimiter: "\r\n" }));

    const finish = async (response: ScaleReadResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      try {
        await closePort(serialPort);
      } catch {
        // Ignore close errors and return the reading result.
      }
      resolve(response);
    };

    const timeoutHandle = setTimeout(() => {
      void finish({
        ok: false,
        error: "Tartıdan veri gelmedi (timeout)",
        port: portPath,
        baudRate,
      } satisfies ScaleReadFailure);
    }, TIMEOUT_MS);

    parser.on("data", (line: string) => {
      const weight = parseWeight(line);
      if (!weight) return;

      void finish({
        ok: true,
        weight,
        port: portPath,
        baudRate,
      } satisfies ScaleReadSuccess);
    });

    serialPort.on("error", (error) => {
      void finish({
        ok: false,
        error: error instanceof Error ? error.message : "Tartı bağlı değil veya port hatası",
        port: portPath,
        baudRate,
      } satisfies ScaleReadFailure);
    });
  });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ScaleReadResponse>) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const requestedPort = toPortName(req.query.port);
  const baudRate = toBaudRate(req.query.baudRate);

  try {
    const availablePorts = await SerialPort.list();
    const availablePaths = availablePorts.map((candidate) => candidate.path).filter(Boolean);

    const selectedPort = requestedPort
      ? availablePaths.find((path) => path.toUpperCase() === requestedPort.toUpperCase())
      : availablePaths[0];

    if (!selectedPort) {
      return res.status(200).json({
        ok: false,
        error: requestedPort
          ? `Seçilen port bulunamadı: ${requestedPort}`
          : "Tartı portu bulunamadı",
        port: requestedPort || undefined,
        baudRate,
        availablePorts: availablePaths,
      });
    }

    const reading = await readWeightFromPort(selectedPort, baudRate);
    return res.status(200).json(reading);
  } catch (error) {
    console.error("Tartı bağlantı hatası:", error);
    return res.status(200).json({
      ok: false,
      error: error instanceof Error ? error.message : "Tartı bağlanamadı",
      port: requestedPort || undefined,
      baudRate,
    });
  }
}
