"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface CounterRun {
  id?: number;
  currentLayer: number | null;
  layerSet: number | null;
  status: string;
  source?: string;
  sourceUpdatedAt?: string | null;
}

interface LayerCounterProps {
  orderId: number;
  run: CounterRun;
  getHeaders: () => Record<string, string>;
  onRunChange: (run: CounterRun) => void;
  onPendingChange: (count: number) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  localOnly?: boolean;
}

const REASONS = ["Sayaçla fark", "Yanlış basış", "Sensör hatası", "Diğer"];
const FLUSH_DELAY_MS = 250;
const RETRY_DELAY_MS = 3000;

function createRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function LayerCounter({
  orderId,
  run,
  getHeaders,
  onRunChange,
  onPendingChange,
  onError,
  disabled,
  localOnly = false,
}: LayerCounterProps) {
  const serverLayer = run.currentLayer ?? 0;
  const [count, setCount] = useState(serverLayer);
  const [pending, setPending] = useState(0);
  const [correcting, setCorrecting] = useState(false);
  const [correctionValue, setCorrectionValue] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [retryPaused, setRetryPaused] = useState(false);
  const pendingRef = useRef<string[]>([]);
  const initialServerLayerRef = useRef(serverLayer);
  const inflightRef = useRef(false);
  const requestIdRef = useRef<string | null>(null);
  const requestIdsRef = useRef<string[] | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const reportErrorRef = useRef(true);
  const flushRef = useRef<() => void>(() => undefined);
  const queueKey = `cutting_layer_queue_${orderId}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(queueKey) || "[]");
      pendingRef.current = Array.isArray(saved)
        ? saved.filter((id): id is string => typeof id === "string")
        : [];
    } catch (error) {
      console.error("Bekleyen kat sayacı verisi okunamadı:", error);
      pendingRef.current = [];
    }
    setPending(pendingRef.current.length);
    onPendingChange(pendingRef.current.length);
    if (localOnly) {
      setPending(0);
      onPendingChange(0);
      setCount(initialServerLayerRef.current);
      return;
    }
    setCount(initialServerLayerRef.current + pendingRef.current.length);
    if (pendingRef.current.length > 0) {
      timerRef.current = window.setTimeout(() => flushRef.current(), FLUSH_DELAY_MS);
    }
    return () => window.clearTimeout(timerRef.current);
  }, [localOnly, onPendingChange, queueKey]);

  useEffect(() => {
    if (localOnly || (pendingRef.current.length === 0 && !inflightRef.current)) setCount(serverLayer);
  }, [localOnly, serverLayer, orderId]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const send = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/spreading-runs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getHeaders() },
      body: JSON.stringify({ orderId, ...payload }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw Object.assign(new Error(body?.error || `İşlem başarısız (HTTP ${response.status})`), {
        status: response.status,
      });
    }
    if (!body?.data) throw new Error("Sunucudan güncel kat bilgisi alınamadı.");
    return body.data as CounterRun;
  }, [getHeaders, orderId]);

  const flush = useCallback(async () => {
    if (inflightRef.current || pendingRef.current.length === 0) return;
    const requestIds = requestIdsRef.current ?? pendingRef.current.slice(0, 50);
    const delta = requestIds.length;
    const requestId = requestIdRef.current || `layer-${requestIds[0]}-${requestIds[requestIds.length - 1]}`;
    requestIdRef.current = requestId;
    requestIdsRef.current = requestIds;
    inflightRef.current = true;
    let succeeded = false;
    let shouldRetry = true;
    try {
      const updatedRun = await send({ action: "increment", delta, requestId });
      pendingRef.current = pendingRef.current.slice(delta);
      requestIdRef.current = null;
      requestIdsRef.current = null;
      setPending(pendingRef.current.length);
      onPendingChange(pendingRef.current.length);
      try {
        localStorage.setItem(queueKey, JSON.stringify(pendingRef.current));
      } catch (error) {
        console.error("Bekleyen kat sayacı verisi güncellenemedi:", error);
      }
      setCount(Number(updatedRun.currentLayer ?? 0) + pendingRef.current.length);
      onRunChange(updatedRun);
      reportErrorRef.current = true;
      setRetryPaused(false);
      succeeded = true;
    } catch (error) {
      const status =
        error && typeof error === 'object' && 'status' in error
          ? Number((error as { status: unknown }).status)
          : null;
      if (status !== null && status >= 400 && status < 500) {
        shouldRetry = false;
        setRetryPaused(true);
        if (status === 400) {
          pendingRef.current = pendingRef.current.slice(requestIdsRef.current?.length ?? 0);
          requestIdRef.current = null;
          requestIdsRef.current = null;
          setPending(pendingRef.current.length);
          onPendingChange(pendingRef.current.length);
          setCount(Number(run.currentLayer ?? 0) + pendingRef.current.length);
          try {
            localStorage.setItem(queueKey, JSON.stringify(pendingRef.current));
          } catch (storageError) {
            console.error("Bekleyen kat sayacı güncellenemedi:", storageError);
          }
        }
      }
      if (reportErrorRef.current) {
        onError(error instanceof Error ? error.message : "Kat sayısı gönderilemedi; tekrar denenecek.");
        reportErrorRef.current = false;
      }
    } finally {
      inflightRef.current = false;
      if (pendingRef.current.length > 0 && shouldRetry) {
        timerRef.current = window.setTimeout(flush, succeeded ? 0 : RETRY_DELAY_MS);
      }
    }
  }, [onError, onPendingChange, onRunChange, queueKey, run.currentLayer, send]);
  flushRef.current = () => { void flush(); };

  const addLayers = (amount = 1) => {
    if (disabled) return;
    const delta = Math.min(Math.floor(amount), 9999 - count);
    if (!Number.isInteger(delta) || delta < 1) return;
    if (localOnly) {
      const nextLayer = count + delta;
      setCount(nextLayer);
      onRunChange({ ...run, currentLayer: nextLayer });
      return;
    }
    pendingRef.current = [...pendingRef.current, ...Array.from({ length: delta }, createRequestId)];
    setPending(pendingRef.current.length);
    setRetryPaused(false);
    onPendingChange(pendingRef.current.length);
    try {
      localStorage.setItem(queueKey, JSON.stringify(pendingRef.current));
    } catch (error) {
      console.error("Bekleyen kat sayacı kaydedilemedi:", error);
      onError("Kat sayısı yerel kuyruğa kaydedilemedi; lütfen bağlantıyı kontrol edin.");
    }
    setCount(value => value + 1);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(15);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, FLUSH_DELAY_MS);
  };

  const retryPending = () => {
    setRetryPaused(false);
    reportErrorRef.current = true;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, 0);
  };

  const applyCorrection = async (action: "decrement" | "set", value?: number) => {
    if (pendingRef.current.length > 0 || inflightRef.current) {
      onError("Bekleyen katlar kaydedilene kadar düzeltme yapılamaz.");
      return;
    }
    if (localOnly) {
      const nextLayer = action === "decrement" ? Math.max(0, count - 1) : value;
      if (nextLayer === undefined) return;
      setCount(nextLayer);
      onRunChange({ ...run, currentLayer: nextLayer });
      setCorrecting(false);
      setCorrectionValue("");
      return;
    }
    setBusy(true);
    try {
      const updatedRun = await send({
        action,
        value,
        reason: action === "set" ? reason : "Bir kat geri alındı",
      });
      setCount(Number(updatedRun.currentLayer ?? 0));
      onRunChange(updatedRun);
      setCorrecting(false);
      setCorrectionValue("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Düzeltme kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const layerSet = run.layerSet ?? 0;
  const percent = layerSet > 0 ? Math.min(100, (count / layerSet) * 100) : 0;
  const remaining = layerSet > 0 ? layerSet - count : null;
  const overPlan = remaining !== null && remaining < 0;
  const locked = disabled || busy;
  const parsedCorrection = Number(correctionValue);
  const correctionValid = correctionValue !== "" && Number.isInteger(parsedCorrection) &&
    parsedCorrection >= 0 && parsedCorrection <= 9999;

  return (
    <section style={styles.card} aria-label="Kat sayacı">
      <div style={styles.header}>
        <strong style={styles.title}>Manuel kat sayacı</strong>
        <span style={{ ...styles.badge, ...(run.source === "SENSOR" ? styles.sensor : styles.manual) }}>
          {run.source === "SENSOR" ? "Sensör verisi" : "Operatör sayımı"}
        </span>
      </div>
      <div style={styles.readout} aria-live="polite">
        <strong style={styles.count}>{count}</strong>
        <span style={styles.plan}>{layerSet > 0 ? `/ ${layerSet} kat` : "Plan katı girilmemiş"}</span>
      </div>
      {layerSet > 0 && (
        <div
          style={styles.track}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={layerSet}
          aria-valuenow={Math.min(count, layerSet)}
        >
          <div style={{ ...styles.fill, width: `${percent}%`, background: overPlan ? "#f59e0b" : "#3b82f6" }} />
        </div>
      )}
      <div style={styles.sub}>
        {remaining === null
          ? "Kat planı girilmemiş"
          : overPlan
            ? `Plan ${Math.abs(remaining)} kat aşıldı`
            : remaining === 0
              ? "Plan tamamlandı"
              : `${remaining} kat kaldı`}
        {pending > 0 && <span style={styles.pending}> · {pending} kat bekliyor/senkronize ediliyor</span>}
      </div>
      {pending > 0 && retryPaused && (
        <button type="button" onClick={retryPending} style={styles.secondary}>
          Bekleyen katları yeniden dene
        </button>
      )}
      <button
        type="button"
        onClick={() => addLayers()}
        disabled={disabled}
        style={{ ...styles.plus, ...(disabled ? styles.disabled : {}) }}
        aria-label="Bir kat ekle"
      >
        +1 KAT
      </button>
      <div style={styles.row}>
        <button
          type="button"
          onClick={() => void applyCorrection("decrement")}
          disabled={locked || count <= 0 || pending > 0}
          style={{ ...styles.secondary, ...(locked || count <= 0 || pending > 0 ? styles.disabled : {}) }}
        >
          1 kat geri al
        </button>
        <button
          type="button"
          onClick={() => {
            setCorrecting(value => !value);
            setCorrectionValue(String(count));
          }}
          disabled={locked || pending > 0}
          style={{ ...styles.secondary, ...(locked || pending > 0 ? styles.disabled : {}) }}
        >
          Sayıyı düzelt
        </button>
      </div>
      {correcting && (
        <div style={styles.panel}>
          <label htmlFor="layer-correction" style={styles.label}>Doğru kat sayısı</label>
          <input
            id="layer-correction"
            type="number"
            inputMode="numeric"
            min={0}
            max={9999}
            step={1}
            value={correctionValue}
            onChange={event => setCorrectionValue(event.target.value)}
            style={styles.input}
          />
          <div style={styles.chips}>
            {REASONS.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setReason(item)}
                aria-pressed={reason === item}
                style={{ ...styles.chip, ...(reason === item ? styles.chipSelected : {}) }}
              >
                {item}
              </button>
            ))}
          </div>
          <div style={styles.row}>
            <button type="button" onClick={() => setCorrecting(false)} style={styles.secondary}>Vazgeç</button>
            <button
              type="button"
              onClick={() => void applyCorrection("set", parsedCorrection)}
              disabled={!correctionValid || busy}
              style={{ ...styles.save, ...(!correctionValid || busy ? styles.disabled : {}) }}
            >
              Düzeltmeyi kaydet
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: "#111827", border: "1px solid #1e293b", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 12 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontSize: 14, color: "#e2e8f0" },
  badge: { fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 99 },
  manual: { background: "rgba(245,158,11,0.16)", color: "#fcd34d" },
  sensor: { background: "rgba(16,185,129,0.16)", color: "#6ee7b7" },
  readout: { display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  count: { fontSize: 72, lineHeight: 1, fontWeight: 900, color: "#f8fafc", fontVariantNumeric: "tabular-nums" },
  plan: { fontSize: 16, color: "#94a3b8", fontWeight: 700 },
  track: { height: 10, background: "#0b1220", borderRadius: 99, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 99, transition: "width 200ms ease" },
  sub: { fontSize: 13, color: "#94a3b8", fontWeight: 600 },
  pending: { color: "#fcd34d" },
  plus: { minHeight: 100, borderRadius: 16, border: 0, background: "linear-gradient(135deg,#2563eb,#3b82f6)", color: "#fff", fontSize: 32, fontWeight: 900, cursor: "pointer", touchAction: "manipulation" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  secondary: { minHeight: 52, borderRadius: 12, border: "1px solid #334155", background: "transparent", color: "#cbd5e1", fontSize: 14, fontWeight: 800, cursor: "pointer" },
  save: { minHeight: 52, borderRadius: 12, border: 0, background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" },
  disabled: { opacity: 0.4, cursor: "not-allowed" },
  panel: { display: "flex", flexDirection: "column", gap: 10, padding: 12, background: "#0b1220", border: "1px solid #334155", borderRadius: 12 },
  label: { fontSize: 12, fontWeight: 700, color: "#94a3b8" },
  input: { minHeight: 52, background: "#111827", border: "1px solid #334155", borderRadius: 10, padding: "0 14px", color: "#f1f5f9", fontSize: 24, fontWeight: 800 },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { padding: "9px 12px", borderRadius: 99, border: "1px solid #334155", background: "transparent", color: "#cbd5e1", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  chipSelected: { background: "#2563eb", borderColor: "#2563eb", color: "#fff" },
};
