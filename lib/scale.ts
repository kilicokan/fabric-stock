export type ScaleSettings = {
  port: string;
  baudRate: number;
};

export type ScaleReadSuccess = {
  ok: true;
  weight: string;
  port: string;
  baudRate: number;
};

export type ScaleReadFailure = {
  ok: false;
  error: string;
  port?: string;
  baudRate?: number;
  availablePorts?: string[];
};

export type ScaleReadResponse = ScaleReadSuccess | ScaleReadFailure;

export const SCALE_SETTINGS_STORAGE_KEY = "fabric-stock:scale-settings";

export const DEFAULT_SCALE_SETTINGS: ScaleSettings = {
  port: "",
  baudRate: 19200,
};

const normalizeBaudRate = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SCALE_SETTINGS.baudRate;
};

export const readScaleSettings = (): ScaleSettings => {
  if (typeof window === "undefined") {
    return DEFAULT_SCALE_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SCALE_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SCALE_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<ScaleSettings>;
    return {
      port: typeof parsed.port === "string" ? parsed.port.trim() : "",
      baudRate: normalizeBaudRate(parsed.baudRate),
    };
  } catch {
    return DEFAULT_SCALE_SETTINGS;
  }
};

export const saveScaleSettings = (settings: ScaleSettings): void => {
  if (typeof window === "undefined") return;

  const sanitized = {
    port: settings.port.trim(),
    baudRate: normalizeBaudRate(settings.baudRate),
  };

  window.localStorage.setItem(SCALE_SETTINGS_STORAGE_KEY, JSON.stringify(sanitized));
};

export const buildScaleQueryParams = (settings?: ScaleSettings): { port?: string; baudRate?: number } => {
  const normalizedPort = settings?.port.trim() || "";
  const normalizedBaudRate = normalizeBaudRate(settings?.baudRate);

  return {
    ...(normalizedPort ? { port: normalizedPort } : {}),
    baudRate: normalizedBaudRate,
  };
};

// ---------------------------------------------------------------------------
// Web Serial API (browser-side, Chrome / Edge)
// ---------------------------------------------------------------------------

export type ScaleReading = {
  weight: number;
  unit: 'kg' | 'g';
  stable: boolean;
  raw: string;
};

export type WebSerialPort = {
  open: (options: { baudRate: number; dataBits?: number; stopBits?: number; parity?: string }) => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  close: () => Promise<void>;
};

const LOCAL_BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://127.0.0.1:7001";

export const hasLocalBridge = (): boolean =>
  process.env.NEXT_PUBLIC_BRIDGE_ENABLED === "true" && typeof window !== "undefined";

const bridgeRequest = async (path: string, init?: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1000);
  try {
    return await fetch(`${LOCAL_BRIDGE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } finally {
    window.clearTimeout(timeout);
  }
};

const readBridgeError = async (response: Response): Promise<string> => {
  try {
    const body = await response.json();
    if (typeof body.error === "string") return body.error;
  } catch {
    // Preserve the HTTP status when the bridge did not return JSON.
  }
  return `Bridge isteği başarısız oldu (HTTP ${response.status}).`;
};

export const bridgeConnectScale = async (settings: ScaleSettings): Promise<void> => {
  if (!settings.port.trim()) throw new Error("Bridge bağlantısı için tartı COM portunu ayarlayın.");
  const response = await bridgeRequest("/scale/connect", {
    method: "POST",
    body: JSON.stringify({ port: settings.port, baudRate: settings.baudRate }),
  });
  if (!response.ok) throw new Error(await readBridgeError(response));
};

export const bridgeReadWeight = async (): Promise<ScaleReading> => {
  const response = await bridgeRequest("/scale/weight");
  if (!response.ok) throw new Error(await readBridgeError(response));

  const body = await response.json();
  const weight = Number(body.weight);
  if (!Number.isFinite(weight) || weight < 0) throw new Error("Bridge geçerli bir tartı değeri döndürmedi.");
  return {
    weight,
    unit: "kg",
    stable: Boolean(body.stable),
    raw: typeof body.raw === "string" ? body.raw : `${weight} kg`,
  };
};

export const bridgeDisconnectScale = async (): Promise<void> => {
  const response = await bridgeRequest("/scale/disconnect", { method: "POST" });
  if (!response.ok) throw new Error(await readBridgeError(response));
};

const DEFAULT_SCALE_BAUD_RATE = 9600;

export const connectScale = async (
  baudRate: number = DEFAULT_SCALE_BAUD_RATE,
  onMessage?: (msg: string) => void,
): Promise<WebSerialPort | null> => {
  if (!('serial' in navigator)) {
    const msg = 'Bu tarayıcı Web Serial desteklemiyor. Chrome veya Edge kullanın.';
    onMessage?.(msg);
    alert(msg);
    return null;
  }

  try {
    const nav = navigator as unknown as {
      serial: {
        requestPort: () => Promise<WebSerialPort>;
      };
    };
    const port = await nav.serial.requestPort();
    await port.open({
      baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
    });
    return port;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tartı bağlantısı iptal edildi.';
    onMessage?.(msg);
    console.error(e);
    return null;
  }
};

export const readScaleWeight = async (
  port: WebSerialPort,
  timeoutMs: number = 2000,
): Promise<ScaleReading | null> => {
  const reader = port.readable?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    const timeout = setTimeout(() => {
      reader.cancel().catch(() => { });
    }, timeoutMs);

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const match = buffer.match(/([+-]?\s*\d+[.,]\d+)\s*(kg|g)?/i);
      if (match) {
        clearTimeout(timeout);
        const weight = parseFloat(match[1].replace(',', '.').replace(/\s/g, ''));
        const unit = (match[2]?.toLowerCase() === 'g' ? 'g' : 'kg') as 'kg' | 'g';
        return {
          weight: unit === 'g' ? weight / 1000 : weight,
          unit: 'kg',
          stable: /ST|GS|S/i.test(buffer),
          raw: buffer.trim(),
        };
      }
    }

    clearTimeout(timeout);
  } catch (e) {
    console.error('Tartı okuma hatası', e);
  } finally {
    reader.releaseLock();
  }
  return null;
};
