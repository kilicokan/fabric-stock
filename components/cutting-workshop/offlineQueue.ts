/**
 * Offline / başarısız kayıt kuyruğu (localStorage).
 * Ağ gelince flushOfflineQueue ile yeniden dener.
 */

import type { OfflineQueueItem, WorkOrderUpdateBody } from './types';

const STORAGE_KEY = 'mira_cutting_offline_queue_v1';
const MAX_ATTEMPTS = 8;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function loadOfflineQueue(): OfflineQueueItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(items: OfflineQueueItem[]): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // quota — sessizce yut
  }
}

export function enqueueOfflineSave(params: {
  orderId: number;
  orderNo: string;
  url: string;
  body: WorkOrderUpdateBody;
  token?: string | null;
}): OfflineQueueItem {
  const item: OfflineQueueItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    orderId: params.orderId,
    orderNo: params.orderNo,
    method: 'PUT',
    url: params.url,
    body: params.body,
    attempts: 0,
  };
  const queue = loadOfflineQueue();
  // Aynı iş emri için eski kaydı güncelle (son yazma kazanır)
  const filtered = queue.filter(q => q.orderId !== params.orderId);
  filtered.push(item);
  saveOfflineQueue(filtered);
  return item;
}

export function removeOfflineItem(id: string): void {
  saveOfflineQueue(loadOfflineQueue().filter(q => q.id !== id));
}

export function getOfflineQueueCount(): number {
  return loadOfflineQueue().length;
}

export async function flushOfflineQueue(getToken: () => string | null): Promise<{
  sent: number;
  failed: number;
  remaining: number;
}> {
  const queue = loadOfflineQueue();
  if (!queue.length) return { sent: 0, failed: 0, remaining: 0 };

  let sent = 0;
  let failed = 0;
  const next: OfflineQueueItem[] = [];

  for (const item of queue) {
    if (item.attempts >= MAX_ATTEMPTS) {
      failed += 1;
      next.push(item);
      continue;
    }
    try {
      const token = getToken();
      const response = await fetch(item.url, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(item.body),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      sent += 1;
    } catch (err) {
      failed += 1;
      next.push({
        ...item,
        attempts: item.attempts + 1,
        lastError: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  saveOfflineQueue(next);
  return { sent, failed, remaining: next.length };
}

/** Ağ online olunca flush dene */
export function bindOfflineQueueAutoFlush(getToken: () => string | null): () => void {
  if (typeof window === 'undefined') return () => {};

  const onOnline = () => {
    void flushOfflineQueue(getToken);
  };
  window.addEventListener('online', onOnline);
  return () => window.removeEventListener('online', onOnline);
}
