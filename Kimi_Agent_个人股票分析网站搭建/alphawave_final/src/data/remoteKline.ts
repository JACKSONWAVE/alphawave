import type { KlineData } from './mockData';

const cache = new Map<string, KlineData[]>();

export async function fetchRemoteKline(code: string): Promise<KlineData[]> {
  if (cache.has(code)) return cache.get(code)!;
  const res = await fetch(`/api/kline?code=${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error(`kline ${code} ${res.status}`);
  const json = await res.json();
  const data = Array.isArray(json?.data) ? json.data : [];
  cache.set(code, data);
  return data;
}
