'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  flushOfflineQueue,
  getOfflineQueueCount,
  loadOfflineQueue,
  removeOfflineItem,
} from './offlineQueue';
import type { OfflineQueueItem } from './types';

type Props = {
  getToken: () => string | null;
  styles: Record<string, CSSProperties>;
  onFlushed?: (sent: number) => void;
  onMessage?: (msg: string) => void;
};

export function OfflineQueuePanel({ getToken, styles, onFlushed, onMessage }: Props) {
  const [items, setItems] = useState<OfflineQueueItem[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setItems(loadOfflineQueue());
  }, []);

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 5000);
    const onOnline = () => refresh();
    window.addEventListener('online', onOnline);
    window.addEventListener('storage', refresh);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const count = items.length;
  if (count === 0 && !open) return null;

  const handleFlush = async () => {
    setBusy(true);
    try {
      const result = await flushOfflineQueue(getToken);
      refresh();
      if (result.sent > 0) {
        onFlushed?.(result.sent);
        onMessage?.(`${result.sent} kayıt gönderildi. Kalan: ${result.remaining}`);
      } else if (result.remaining > 0) {
        onMessage?.(`Gönderilemedi. Kuyrukta ${result.remaining} kayıt var.`);
      } else {
        onMessage?.('Kuyruk boş.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = (id: string) => {
    removeOfflineItem(id);
    refresh();
  };

  return (
    <div style={panelShell}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={toggleBtn}
        aria-expanded={open}
      >
        <span style={badge}>{count}</span>
        <span>Çevrimdışı kuyruk</span>
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div style={body}>
          {count === 0 ? (
            <p style={empty}>Bekleyen kayıt yok.</p>
          ) : (
            <ul style={list}>
              {items.map(item => (
                <li key={item.id} style={row}>
                  <div>
                    <strong style={{ fontSize: 13 }}>{item.orderNo}</strong>
                    <div style={meta}>
                      {new Date(item.createdAt).toLocaleString('tr-TR')}
                      {' · '}
                      deneme {item.attempts}
                      {item.lastError ? ` · ${item.lastError}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    style={removeBtn}
                    aria-label="Kuyruktan sil"
                  >
                    Sil
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={handleFlush}
            disabled={busy || count === 0}
            style={{
              ...styles.primaryButton,
              marginTop: 10,
              opacity: busy || count === 0 ? 0.55 : 1,
            }}
          >
            {busy ? 'Gönderiliyor...' : 'Şimdi gönder'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Dışarıdan sayı rozeti için */
export function useOfflineQueueCount(pollMs = 5000): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const tick = () => setCount(getOfflineQueueCount());
    tick();
    const t = window.setInterval(tick, pollMs);
    return () => window.clearInterval(t);
  }, [pollMs]);
  return count;
}

const panelShell: CSSProperties = {
  position: 'fixed',
  left: 16,
  bottom: 20,
  zIndex: 19,
  width: 'min(340px, calc(100vw - 32px))',
  background: '#0f172a',
  color: '#fff',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '0 12px 40px rgba(15,23,42,0.4)',
  overflow: 'hidden',
};

const toggleBtn: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 14px',
  border: 'none',
  background: 'transparent',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  textAlign: 'left',
};

const badge: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  minWidth: 22,
  height: 22,
  borderRadius: 999,
  background: '#f59e0b',
  color: '#111',
  fontSize: 11,
  fontWeight: 800,
};

const body: CSSProperties = {
  padding: '0 12px 12px',
  borderTop: '1px solid rgba(255,255,255,0.08)',
};

const list: CSSProperties = {
  listStyle: 'none',
  margin: '10px 0 0',
  padding: 0,
  maxHeight: 180,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.06)',
};

const meta: CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.55)',
  marginTop: 2,
};

const empty: CSSProperties = {
  margin: '12px 0 0',
  fontSize: 12,
  color: 'rgba(255,255,255,0.55)',
};

const removeBtn: CSSProperties = {
  border: '1px solid rgba(248,113,113,0.4)',
  background: 'rgba(248,113,113,0.15)',
  color: '#fca5a5',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  flexShrink: 0,
};
