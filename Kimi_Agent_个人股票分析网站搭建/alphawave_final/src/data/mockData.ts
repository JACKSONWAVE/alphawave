// 数据层：优先真实数据，fallback到mock
import { stockData } from '../assets/data/stockData';
import { stockUniverse } from '../assets/data/stockUniverse';
import { getETFRecords } from './etfUniverse';

export interface KlineData {
  date: string; open: number; high: number; low: number; close: number;
  volume: number; amount: number;
}

export interface StockInfo {
  code: string; name: string; industry: string; price: number; change: number;
  changePct: number; volume: number; open: number; high: number; low: number;
}

export interface StockListItem {
  code: string; name: string; price: number; change: number; changePct: number;
  volume: string; industry: string; high52w: number; low52w: number;
  pe: number; pb: number; marketCap: number | string; hasKline: boolean;
}

const localStocks = stockData.stocks || {};
const universeStocks = stockUniverse.stocks || {};
const etfStocks = getETFRecords();
let stockListCache: StockListItem[] | null = null;
let coreStockListCache: StockListItem[] | null = null;

function getStockRecord(code: string) {
  return localStocks[code] || universeStocks[code] || etfStocks[code];
}

// ── 获取K线数据 ──
export function getKlineData(code: string, days?: number): KlineData[] {
  const real = localStocks[code]?.kline;
  if (real && real.length > 0) {
    if (days) return real.slice(-days);
    return real;
  }
  // fallback: 生成mock
  const info = getStockRecord(code);
  return generateMockKline(days || 120, info?.latest?.price || 50);
}

function generateMockKline(days: number, basePrice: number): KlineData[] {
  const data: KlineData[] = [];
  let price = basePrice;
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now); date.setDate(date.getDate() - i);
    const wave = Math.sin((days - i) * 0.41) * 0.006 + Math.cos((days - i) * 0.17) * 0.004;
    const c = wave - 0.0005;
    price = Math.max(basePrice * 0.5, price * (1 + c));
    const o = price * (1 + Math.sin(i * 0.23) * 0.003);
    const hi = Math.max(o, price) * (1 + 0.006 + Math.abs(Math.sin(i * 0.13)) * 0.004);
    const lo = Math.min(o, price) * (1 - 0.006 - Math.abs(Math.cos(i * 0.11)) * 0.004);
    const v = Math.floor(350000 + Math.abs(Math.sin(i * 0.37)) * 550000);
    data.push({ date: date.toISOString().split('T')[0], open: +o.toFixed(2), high: +hi.toFixed(2), low: +lo.toFixed(2), close: +price.toFixed(2), volume: v, amount: +(v * price / 10000).toFixed(0) });
  }
  return data;
}

// ── 股票信息 ──
export function getStockInfo(code: string): StockInfo & { high52w: number; low52w: number } {
  const s = getStockRecord(code);
  if (!s) return { code, name: code, industry: '', price: 0, change: 0, changePct: 0, volume: 0, open: 0, high: 0, low: 0, high52w: 0, low52w: 0 };
  const l = s.latest || {};
  return { code, name: s.name, industry: s.industry, price: l.price || 0, change: l.change || 0, changePct: l.changePct || 0, volume: l.volume || 0, open: l.open || 0, high: l.high || 0, low: l.low || 0, high52w: s.high52w || 0, low52w: s.low52w || 0 };
}

export function getAllCodes(): string[] { return Array.from(new Set([...Object.keys(universeStocks), ...Object.keys(localStocks), ...Object.keys(etfStocks)])); }

export function getCoreCodes(): string[] { return Object.keys(localStocks); }

export function getStockName(code: string): string { return getStockRecord(code)?.name || code; }

export function getMarketIndex() {
  return Object.entries(stockData.indexes as Record<string, { name: string; price: number; change: number; changePct: number }>)
    .map(([code, d]) => ({ code, name: d.name, price: d.price, change: d.change, changePct: d.changePct }));
}

// ── 股票列表 ──
export function getStockList() {
  if (stockListCache) return stockListCache;
  stockListCache = getAllCodes().map(code => {
    const s = getStockInfo(code);
    const record = getStockRecord(code);
    const hasKline = (localStocks[code]?.kline?.length || 0) > 0;
    return {
      code, name: s.name, price: s.price, change: s.change, changePct: s.changePct,
      volume: s.volume > 0 ? (s.volume > 100000000 ? (s.volume / 100000000).toFixed(1) + '亿' : (s.volume / 10000).toFixed(0) + '万') : '-',
      industry: s.industry, high52w: s.high52w, low52w: s.low52w,
      pe: record?.pe || 0, pb: record?.pb || 0, marketCap: record?.marketCap || '', hasKline,
    };
  });
  return stockListCache;
}

export function getCoreStockList() {
  if (coreStockListCache) return coreStockListCache;
  coreStockListCache = getCoreCodes().map(code => {
    const s = getStockInfo(code);
    const record = getStockRecord(code);
    return {
      code, name: s.name, price: s.price, change: s.change, changePct: s.changePct,
      volume: s.volume > 0 ? (s.volume > 100000000 ? (s.volume / 100000000).toFixed(1) + '亿' : (s.volume / 10000).toFixed(0) + '万') : '-',
      industry: s.industry, high52w: s.high52w, low52w: s.low52w,
      pe: record?.pe || 0, pb: record?.pb || 0, marketCap: record?.marketCap || '', hasKline: true,
    };
  });
  return coreStockListCache;
}

// ── 技术指标 ──
export function calcMA(data: KlineData[], p: number) { return data.map((_, i) => i < p - 1 ? null : +(data.slice(i - p + 1, i + 1).reduce((s, d) => s + d.close, 0) / p).toFixed(2)); }
export function calcEMA(vals: number[], p: number) { const k = 2 / (p + 1); return vals.map((v, i) => i === 0 ? v : +(vals[i - 1] * (1 - k) + v * k).toFixed(2)); }
export function calcMACD(data: KlineData[]) { const e12 = calcEMA(data.map(d => d.close), 12), e26 = calcEMA(data.map(d => d.close), 26), dif = e12.map((v, i) => +(v - e26[i]).toFixed(3)), dea = calcEMA(dif, 9), macd = dif.map((v, i) => +((v - dea[i]) * 2).toFixed(3)); return { dif, dea, macd }; }
export function calcRSI(data: KlineData[], p = 14) { const r: (number | null)[] = []; for (let i = 0; i < data.length; i++) { if (i < p) { r.push(null); continue; } let g = 0, l = 0; for (let j = i - p + 1; j <= i; j++) { const c = data[j].close - data[j - 1].close; if (c > 0) g += c; else l -= c; } const ag = g / p, al = l / p; r.push(al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(1)); } return r; }
export function calcKDJ(data: KlineData[], n = 9) { const k: (number | null)[] = [], d: (number | null)[] = [], j: (number | null)[] = []; let rk = 50, rd = 50; for (let i = 0; i < data.length; i++) { if (i < n - 1) { k.push(null); d.push(null); j.push(null); continue; } const sl = data.slice(i - n + 1, i + 1), lo = Math.min(...sl.map(d => d.low)), hi = Math.max(...sl.map(d => d.high)), rsv = hi === lo ? 50 : (data[i].close - lo) / (hi - lo) * 100; rk = (rk * 2 + rsv) / 3; rd = (rd * 2 + rk) / 3; k.push(+rk.toFixed(2)); d.push(+rd.toFixed(2)); j.push(+(3 * rk - 2 * rd).toFixed(2)); } return { k, d, j }; }
export function calcBOLL(data: KlineData[], p = 20) { const ma = calcMA(data, p), up: (number | null)[] = [], lo: (number | null)[] = []; for (let i = 0; i < data.length; i++) { if (i < p - 1) { up.push(null); lo.push(null); continue; } const sl = data.slice(i - p + 1, i + 1), mn = sl.reduce((s, d) => s + d.close, 0) / p, sd = Math.sqrt(sl.reduce((s, d) => s + Math.pow(d.close - mn, 2), 0) / p); up.push(+(mn + 2 * sd).toFixed(2)); lo.push(+(mn - 2 * sd).toFixed(2)); } return { mid: ma, upper: up, lower: lo }; }
export function calcCCI(data: KlineData[], p = 14) { const r: (number | null)[] = []; for (let i = 0; i < data.length; i++) { if (i < p - 1) { r.push(null); continue; } const tp = (data[i].high + data[i].low + data[i].close) / 3, sl = data.slice(i - p + 1, i + 1), atp = sl.reduce((s, d) => s + (d.high + d.low + d.close) / 3, 0) / p, md = sl.reduce((s, d) => s + Math.abs((d.high + d.low + d.close) / 3 - atp), 0) / p; r.push(md === 0 ? null : +((tp - atp) / (0.015 * md)).toFixed(2)); } return r; }
export function calcWR(data: KlineData[], p = 14) { const r: (number | null)[] = []; for (let i = 0; i < data.length; i++) { if (i < p - 1) { r.push(null); continue; } const sl = data.slice(i - p + 1, i + 1), hi = Math.max(...sl.map(d => d.high)), lo = Math.min(...sl.map(d => d.low)); r.push(hi === lo ? -50 : +((hi - data[i].close) / (hi - lo) * -100).toFixed(2)); } return r; }

// ── 买卖信号 ──
export interface Signal { type: 'buy' | 'sell'; reason: string; strength: 'strong' | 'medium' | 'weak'; date: string; price: number }
export function generateSignals(data: KlineData[]): Signal[] {
  const sigs: Signal[] = [], ma5 = calcMA(data, 5), ma10 = calcMA(data, 10), { dif, dea } = calcMACD(data), rsi = calcRSI(data, 14), { k, d } = calcKDJ(data), boll = calcBOLL(data), cci = calcCCI(data), wr = calcWR(data);
  for (let i = 30; i < data.length; i++) {
    const reasons: string[] = []; let buy = false, sell = false;
    if (dif[i] > dea[i] && dif[i - 1] <= dea[i - 1]) { buy = true; reasons.push('MACD金叉'); }
    if (dif[i] < dea[i] && dif[i - 1] >= dea[i - 1]) { sell = true; reasons.push('MACD死叉'); }
    if (ma5[i] && ma10[i] && ma5[i - 1] && ma10[i - 1] && ma5[i]! > ma10[i]! && ma5[i - 1]! <= ma10[i - 1]!) { buy = true; reasons.push('MA金叉'); }
    if (k[i] && d[i] && k[i]! > d[i]! && k[i - 1]! <= d[i - 1]! && k[i]! < 30) { buy = true; reasons.push('KDJ低位金叉'); }
    if (k[i] && d[i] && k[i]! < d[i]! && k[i - 1]! >= d[i - 1]! && k[i]! > 80) { sell = true; reasons.push('KDJ高位死叉'); }
    if (rsi[i] !== null && rsi[i]! < 25) { buy = true; reasons.push(`RSI超卖${rsi[i]}`); }
    if (rsi[i] !== null && rsi[i]! > 80) { sell = true; reasons.push(`RSI超买${rsi[i]}`); }
    if (boll.lower[i] && data[i].close < boll.lower[i]!) { buy = true; reasons.push('触及下轨'); }
    if (boll.upper[i] && data[i].close > boll.upper[i]!) { sell = true; reasons.push('触及上轨'); }
    if (cci[i] !== null && cci[i]! < -100) { buy = true; reasons.push(`CCI超卖`); }
    if (cci[i] !== null && cci[i]! > 100) { sell = true; reasons.push(`CCI超买`); }
    if (wr[i] !== null && wr[i]! < -90) { buy = true; reasons.push(`WR超卖`); }
    if (wr[i] !== null && wr[i]! > -10) { sell = true; reasons.push(`WR超买`); }
    if (reasons.length > 0) sigs.push({ type: sell && !buy ? 'sell' : 'buy', reason: reasons.join('+'), strength: reasons.length >= 3 ? 'strong' : reasons.length >= 2 ? 'medium' : 'weak', date: data[i].date, price: data[i].close });
  }
  return sigs.slice(-80);
}

// ── 趋势判断 ──
export function getTrend(data: KlineData[]) { if (data.length < 60) return { trend: 'sideways' as const, strength: 0 }; const ma20 = calcMA(data, 20), ma60 = calcMA(data, 60), i = data.length - 1; if (!ma20[i] || !ma60[i]) return { trend: 'sideways' as const, strength: 0 }; const chg = (data[data.length - 1].close - data[data.length - 60].close) / data[data.length - 60].close * 100; if (ma20[i]! > ma60[i]! && chg > 5) return { trend: 'up' as const, strength: Math.min(Math.abs(chg) / 20, 1) }; if (ma20[i]! < ma60[i]! && chg < -5) return { trend: 'down' as const, strength: Math.min(Math.abs(chg) / 20, 1) }; return { trend: 'sideways' as const, strength: 0.3 }; }

// ── 预警 ──
export interface AlertRule {
  id: string;
  code: string;
  name: string;
  type: 'above' | 'below';
  price: number;
  enabled: boolean;
  mode?: 'price' | 'composite';
  note?: string;
}
export function getAlerts(): AlertRule[] { try { return JSON.parse(localStorage.getItem('alerts') || '[]'); } catch { return []; } }
export function saveAlerts(a: AlertRule[]) {
  localStorage.setItem('alerts', JSON.stringify(a));
  window.dispatchEvent(new CustomEvent('alphawave:alerts-changed'));
}

// ── 交易记录类型 ──
export interface TradeRecord { id: string; code: string; name: string; type: 'buy' | 'sell'; price: number; shares: number; date: string; fee: number; note: string; }
