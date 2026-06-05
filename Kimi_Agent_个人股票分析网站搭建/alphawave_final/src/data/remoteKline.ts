import type { KlineData } from './mockData';

const cache = new Map<string, KlineData[]>();
const MAX_FRESH_GAP_DAYS = 7;

function daysBetween(start: string, end: string) {
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;
  return Math.max(0, Math.round((endTime - startTime) / 86400000));
}

function requestUrls(code: string) {
  const path = `/api/kline?code=${encodeURIComponent(code)}`;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  return isLocal ? [path, `https://alphawave-lake.vercel.app${path}`] : [path];
}

export function latestKlineDate(data: KlineData[]): string {
  return data[data.length - 1]?.date || '';
}

export function isKlineStale(data: KlineData[], referenceDate = new Date().toISOString().slice(0, 10), maxGapDays = MAX_FRESH_GAP_DAYS): boolean {
  const latest = latestKlineDate(data);
  if (!latest) return true;
  return daysBetween(latest, referenceDate) > maxGapDays;
}

export async function fetchRemoteKline(code: string): Promise<KlineData[]> {
  if (cache.has(code)) return cache.get(code)!;
  let lastError = '';
  for (const url of requestUrls(code)) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastError = `kline ${code} ${res.status}`;
        continue;
      }
      const json = await res.json();
      const data = Array.isArray(json?.data) ? json.data : [];
      cache.set(code, data);
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'unknown error';
    }
  }
  throw new Error(lastError || `kline ${code} failed`);
}
