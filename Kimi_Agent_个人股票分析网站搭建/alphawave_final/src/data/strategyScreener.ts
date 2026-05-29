import {
  calcBOLL,
  calcKDJ,
  calcMA,
  calcMACD,
  calcRSI,
  getKlineData,
  getStockList,
  type KlineData,
  type StockListItem,
} from './mockData';
import { formatPct, formatPrice } from './price';

export type StrategyTag = '龙头突破' | '共振低吸' | '量价突破' | '趋势回踩' | '观察';

export interface DailyStrategyPick {
  code: string;
  name: string;
  industry: string;
  price: number;
  changePct: number;
  score: number;
  confidence: number;
  strategy: StrategyTag;
  entry: string;
  stop: string;
  target: string;
  evidence: string[];
  reason: string;
  hasDeepData: boolean;
}

function last<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

function rangePosition(stock: StockListItem) {
  const high = Number(stock.high52w) || 0;
  const low = Number(stock.low52w) || 0;
  if (!high || !low || high <= low || !stock.price) return 0.5;
  return Math.max(0, Math.min(1, (stock.price - low) / (high - low)));
}

function amountScore(stock: StockListItem) {
  const amount = Number(stock.marketCap) || 0;
  if (amount >= 100000000000) return 10;
  if (amount >= 30000000000) return 6;
  return 2;
}

function calcDeepSignal(stock: StockListItem, kline: KlineData[]) {
  if (kline.length < 80) return null;
  const latest = last(kline)!;
  const prev = kline[kline.length - 2] || latest;
  const ma5 = calcMA(kline, 5);
  const ma10 = calcMA(kline, 10);
  const ma20 = calcMA(kline, 20);
  const ma60 = calcMA(kline, 60);
  const macd = calcMACD(kline);
  const kdj = calcKDJ(kline);
  const rsi = calcRSI(kline);
  const boll = calcBOLL(kline);
  const i = kline.length - 1;
  const avgVol20 = kline.slice(-21, -1).reduce((sum, item) => sum + item.volume, 0) / 20 || latest.volume;
  const volRatio = avgVol20 ? latest.volume / avgVol20 : 1;
  const macdGolden = macd.dif[i] > macd.dea[i] && macd.dif[i - 1] <= macd.dea[i - 1];
  const macdBull = macd.dif[i] > macd.dea[i] && macd.macd[i] > 0;
  const kdjLowCross = (kdj.k[i] || 0) > (kdj.d[i] || 0) && (kdj.k[i - 1] || 0) <= (kdj.d[i - 1] || 0) && (kdj.j[i] || 0) < 55;
  const rsiRecover = (rsi[i] || 50) > 35 && (rsi[i] || 50) < 68 && (rsi[i - 1] || 50) <= (rsi[i] || 50);
  const maBull = Boolean(ma5[i] && ma10[i] && ma20[i] && ma5[i]! > ma10[i]! && ma10[i]! >= ma20[i]!);
  const trendBull = Boolean(ma20[i] && ma60[i] && latest.close > ma20[i]! && ma20[i]! >= ma60[i]! * 0.98);
  const breakout = Boolean(boll.upper[i] && latest.close > boll.upper[i]! * 0.99 && volRatio >= 1.15);
  const pullback = Boolean(ma20[i] && latest.close >= ma20[i]! * 0.98 && latest.close <= ma20[i]! * 1.04 && trendBull);
  const priceMomentum = prev.close ? (latest.close - prev.close) / prev.close * 100 : stock.changePct;

  let strategy: StrategyTag = '观察';
  let score = 0;
  const evidence: string[] = [];

  if (macdGolden || macdBull) {
    score += macdGolden ? 18 : 10;
    evidence.push(macdGolden ? 'MACD 金叉刚出现' : 'MACD 多头排列');
  }
  if (kdjLowCross) {
    score += 16;
    evidence.push('KDJ 低位金叉修复');
  }
  if (rsiRecover) {
    score += 10;
    evidence.push(`RSI 修复到 ${(rsi[i] || 0).toFixed(1)}`);
  }
  if (maBull || trendBull) {
    score += maBull ? 18 : 10;
    evidence.push(maBull ? '5/10/20 日均线多头' : '站上 20 日趋势线');
  }
  if (breakout) {
    score += 20;
    evidence.push(`放量突破，量比约 ${volRatio.toFixed(1)}x`);
  } else if (volRatio >= 1.2 && priceMomentum > 0) {
    score += 10;
    evidence.push(`上涨放量，量比约 ${volRatio.toFixed(1)}x`);
  }
  if (pullback) {
    score += 12;
    evidence.push('趋势内回踩 20 日线附近');
  }

  if (breakout && trendBull) strategy = '龙头突破';
  else if ((macdGolden || macdBull) && kdjLowCross && rsiRecover) strategy = '共振低吸';
  else if (volRatio >= 1.35 && priceMomentum > 1.5) strategy = '量价突破';
  else if (pullback) strategy = '趋势回踩';

  return {
    strategy,
    score,
    evidence,
    entry: `${formatPrice(Math.min(latest.close, (ma20[i] || latest.close) * 1.02))}-${formatPrice(latest.close * 1.015)}`,
    stop: formatPrice(Math.min(latest.close * 0.94, (ma20[i] || latest.close) * 0.96)),
    target: formatPrice(Math.max(latest.close * 1.08, (boll.upper[i] || latest.close) * 1.03)),
  };
}

function calcUniverseSignal(stock: StockListItem) {
  const pos = rangePosition(stock);
  const nearHigh = pos >= 0.82;
  const recovering = pos >= 0.25 && pos <= 0.62 && stock.changePct > 0;
  const strongChange = stock.changePct >= 2 && stock.changePct <= 8.8;
  const peOk = !stock.pe || (stock.pe > 0 && stock.pe < 80);
  let strategy: StrategyTag = '观察';
  let score = 0;
  const evidence: string[] = [];

  if (nearHigh && strongChange) {
    strategy = '龙头突破';
    score += 34;
    evidence.push('接近 52 周新高且当日强势');
  } else if (recovering) {
    strategy = '共振低吸';
    score += 22;
    evidence.push('52 周区间低中位修复');
  } else if (strongChange) {
    strategy = '量价突破';
    score += 24;
    evidence.push('当日涨幅进入强势区间');
  }

  if (stock.changePct > 0) score += Math.min(18, stock.changePct * 2);
  if (peOk) {
    score += 6;
    evidence.push(stock.pe ? `估值未极端，PE ${stock.pe.toFixed(1)}` : '估值数据待补齐');
  }
  score += amountScore(stock);
  if (stock.high52w > 0 && stock.low52w > 0) evidence.push(`52 周位置 ${(pos * 100).toFixed(0)}%`);

  return {
    strategy,
    score,
    evidence,
    entry: `${formatPrice(stock.price * 0.985)}-${formatPrice(stock.price * 1.015)}`,
    stop: formatPrice(stock.price * 0.94),
    target: formatPrice(stock.price * 1.1),
  };
}

export function buildDailyStrategyPicks(limit = 10): DailyStrategyPick[] {
  return getStockList()
    .filter(stock => stock.price > 0 && stock.changePct > -6 && stock.changePct < 9.8)
    .map(stock => {
      const kline = stock.hasKline ? getKlineData(stock.code) : [];
      const deep = stock.hasKline ? calcDeepSignal(stock, kline) : null;
      const fallback = calcUniverseSignal(stock);
      const signal = deep && deep.score >= 28 ? deep : fallback;
      const score = Math.round(signal.score + (stock.hasKline ? 10 : 0));
      const confidence = Math.max(35, Math.min(92, score + (stock.hasKline ? 18 : 8)));
      const evidence = signal.evidence.slice(0, 4);

      return {
        code: stock.code,
        name: stock.name,
        industry: stock.industry,
        price: stock.price,
        changePct: stock.changePct,
        score,
        confidence,
        strategy: signal.strategy,
        entry: signal.entry,
        stop: signal.stop,
        target: signal.target,
        evidence,
        hasDeepData: stock.hasKline,
        reason: evidence.length
          ? evidence.join('；')
          : `涨跌幅 ${formatPct(stock.changePct)}，等待更多量价确认`,
      };
    })
    .filter(item => item.strategy !== '观察' && item.score >= 32)
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
    .slice(0, limit);
}
