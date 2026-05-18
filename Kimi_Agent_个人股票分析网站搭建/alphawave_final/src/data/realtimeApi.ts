// ============================================================
// 免费实时股票数据API - 腾讯财经接口
// 智能刷新：A股+港股交易时段，节假日/周末自动停刷
// 节假日支持任意年份动态计算
// ============================================================

import { isHoliday, isTradingDay, getNextTradingDayHint } from './holidays';

export interface RealtimeQuote {
  code: string; name: string; price: number; open: number;
  prevClose: number; high: number; low: number;
  change: number; changePct: number; volume: number;
  amount: number; pe: number; pb: number;
  turnover: number; marketCap: number; time: string;
}

// 代码格式转换
function toTencentCode(code: string): string {
  if (code.startsWith('sh') || code.startsWith('sz') || code.startsWith('hk')) return code;
  const [num, market] = code.split('.');
  if (!market) return code;
  switch (market) {
    case 'SH': return `sh${num}`;
    case 'SZ': return `sz${num}`;
    case 'HK': return `hk${num}`;
    case 'BJ': return `bj${num}`;
    default: return code;
  }
}

function fromTencentCode(tc: string): string {
  const prefix = tc.substring(0, 2);
  const num = tc.substring(2);
  switch (prefix) {
    case 'sh': return `${num}.SH`;
    case 'sz': return `${num}.SZ`;
    case 'hk': return `${num}.HK`;
    case 'bj': return `${num}.BJ`;
    default: return tc;
  }
}

const ALL_CODES = [
  'sh600519','sh603019','sz002594','sh601888','sh600276','sz300058',
  'sh601689','sz300115','sh601066','sh600030','sh601288','sz159937',
  'sh518880','sh512890','sz159980','sz159545','hk00700','hk01810',
  'hk09988','hk02800','hk03110','hk02828','hk03033','sz000977',
  'sh688981','sz300750','sz000858','sh601012','sz300059','sz002475',
  'sh600036','sz002230','sh600900','sz000333','sz002415',
];

let cache: Map<string, RealtimeQuote> = new Map();
let lastUpdate = 0;

// ── 用户自定义间隔 ──
const INTERVAL_KEY = 'refresh_interval';
const DEFAULT_INTERVAL = 60;

export const INTERVAL_PRESETS = [
  { label: '极速 5s', value: 5 },
  { label: '高速 10s', value: 10 },
  { label: '快速 30s', value: 30 },
  { label: '标准 1分', value: 60 },
  { label: '慢速 3分', value: 180 },
  { label: '省流 5分', value: 300 },
];

export function getUserInterval(): number {
  try {
    const v = parseInt(localStorage.getItem(INTERVAL_KEY) || '', 10);
    return isNaN(v) ? DEFAULT_INTERVAL : v;
  } catch { return DEFAULT_INTERVAL; }
}

export function setUserInterval(seconds: number) {
  localStorage.setItem(INTERVAL_KEY, String(seconds));
}

export function getIntervalPresets() { return INTERVAL_PRESETS; }

// ── A股+港股交易时段 ──
// 港股集合竞价: 9:00-9:30
// A股集合竞价: 9:15-9:25（集合竞价结果9:25公布）
// A股连续竞价: 9:30-11:30, 13:00-15:00
// 港股连续竞价: 9:30-12:00, 13:00-16:00
// 并集（含集合竞价）: 9:00-12:00, 13:00-16:00
function inTradingHours(d: Date = new Date()): boolean {
  const h = d.getHours();
  const m = d.getMinutes();
  const t = h * 60 + m;
  return (t >= 540 && t <= 720) || (t >= 780 && t <= 960);
}

// ── 是否在开市时段 ──
export function isMarketOpen(): boolean {
  const now = new Date();
  return isTradingDay(now) && inTradingHours(now);
}

// ── 交易时段描述 ──
export function getMarketPhase(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const t = h * 60 + m;

  // 先判断是否为交易日
  if (!isTradingDay(now)) {
    return isHoliday(now) ? '节假日休市' : '周末休市';
  }

  if (t < 540) return '盘前等待';
  if (t >= 540 && t <= 555) return '集合竞价(港)';
  if (t > 555 && t < 570) return '集合竞价(深沪)';
  if (t >= 570 && t <= 600) return '开盘冲刺';
  if (t > 600 && t <= 630) return '早盘活跃';
  if (t > 630 && t <= 720) return '上午平稳';
  if (t > 720 && t < 780) return '午间休市';
  if (t >= 780 && t <= 810) return '午后开盘';
  if (t > 810 && t <= 900) return '下午交易';
  if (t > 900 && t <= 960) return '尾盘冲刺';
  return '已收盘';
}

// ── 下一次交易时间提示 ──
export function getNextSessionHint(): string {
  const now = new Date();
  if (isTradingDay(now) && inTradingHours(now)) return '交易中';

  // 非交易日
  if (!isTradingDay(now)) {
    return getNextTradingDayHint();
  }

  const t = now.getHours() * 60 + now.getMinutes();

  // 盘前
  if (t < 570) {
    const toOpen = 570 - t;
    const h = Math.floor(toOpen / 60);
    const m = toOpen % 60;
    return `${h}时${m}分后开盘`;
  }
  // 午间
  if (t > 720 && t < 780) {
    const toOpen = 780 - t;
    return `${toOpen}分后下午开盘`;
  }
  // 收盘后
  if (t > 960) return '今日已收盘';
  return '休市';
}

// ── 智能刷新间隔 ──
// 非交易时间 => 0（停刷）
// 交易时间 => 用户设定间隔
export function getSmartInterval(): number {
  const now = new Date();
  
  // 非交易日 => 停刷
  if (!isTradingDay(now)) return 0;
  
  // 非开市时段 => 停刷
  if (!inTradingHours(now)) return 0;
  
  // 交易时段 => 用户设定
  const user = getUserInterval();
  return user > 0 ? user : DEFAULT_INTERVAL;
}

// ── 获取实时行情 ──
export async function fetchRealtimeQuotes(codes?: string[]): Promise<RealtimeQuote[]> {
  const targetCodes = codes || ALL_CODES;
  const tcCodes = targetCodes.map(toTencentCode);
  
  try {
    const url = `https://qt.gtimg.cn/q=${tcCodes.join(',')}`;
    const r = await fetch(url, {
      method: 'GET',
      // @ts-ignore
      referrerPolicy: 'no-referrer',
    });
    const text = await r.text();
    
    const quotes: RealtimeQuote[] = [];
    for (const line of text.split(';')) {
      if (!line.trim()) continue;
      const match = line.match(/v_(\w+)="([^"]*)"/);
      if (!match) continue;
      const tcCode = match[1];
      const fields = match[2].split('~');
      if (fields.length < 35) continue;
      
      const prevClose = parseFloat(fields[4]) || 0;
      const price = parseFloat(fields[3]) || 0;
      
      quotes.push({
        code: fromTencentCode(tcCode),
        name: fields[1] || '',
        price,
        open: parseFloat(fields[5]) || 0,
        prevClose,
        high: parseFloat(fields[33]) || 0,
        low: parseFloat(fields[34]) || 0,
        change: prevClose > 0 ? +(price - prevClose).toFixed(2) : 0,
        changePct: prevClose > 0 ? +((price - prevClose) / prevClose * 100).toFixed(2) : 0,
        volume: parseFloat(fields[6]) || 0,
        amount: parseFloat(fields[37]) || 0,
        pe: parseFloat(fields[39]) || 0,
        pb: parseFloat(fields[46]) || 0,
        turnover: parseFloat(fields[38]) || 0,
        marketCap: parseFloat(fields[44]) || 0,
        time: fields[30] || '',
      });
    }
    
    quotes.forEach(q => cache.set(q.code, q));
    lastUpdate = Date.now();
    return quotes;
  } catch {
    return [];
  }
}

export async function fetchIntradayMinutes(code: string) {
  try {
    const tcCode = toTencentCode(code);
    const url = `https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${tcCode}`;
    const res = await fetch(url, {
      method: 'GET',
      // @ts-ignore
      referrerPolicy: 'no-referrer',
    });
    const json = await res.json();
    const rows: string[] = json?.data?.[tcCode]?.data?.data || [];
    return rows.map(row => {
      const [rawTime, price, volume, amount] = row.split(' ');
      return {
        time: `${rawTime.slice(0, 2)}:${rawTime.slice(2)}`,
        price: parseFloat(price) || 0,
        volume: parseFloat(volume) || 0,
        amount: parseFloat(amount) || 0,
      };
    }).filter(point => point.price > 0);
  } catch {
    return [];
  }
}

export function getCachedQuote(code: string): RealtimeQuote | null {
  return cache.get(code) || null;
}

export function getAllCachedQuotes(): RealtimeQuote[] {
  return Array.from(cache.values());
}

export function getLastUpdateTime(): number { return lastUpdate; }

// 导出节假日函数给外部使用
export { isHoliday, isTradingDay, getHolidayList } from './holidays';
