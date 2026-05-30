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
import { getETFProfile, isETF } from './etfUniverse';
import { etfProfiles } from './etfUniverse';

export type StrategyTag = '龙头突破' | '共振低吸' | '量价突破' | '趋势回踩' | 'ETF配置' | '观察';

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
  riskLevel: 'low' | 'medium' | 'high';
  execution: string;
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

function calcETFSignal(stock: StockListItem, kline: KlineData[]) {
  const profile = getETFProfile(stock.code);
  const latest = kline.length ? last(kline)! : null;
  const price = latest?.close || stock.price;
  const ma20 = kline.length ? calcMA(kline, 20) : [];
  const ma60 = kline.length ? calcMA(kline, 60) : [];
  const macd = kline.length ? calcMACD(kline) : null;
  const rsi = kline.length ? calcRSI(kline) : [];
  const i = kline.length - 1;
  const above20 = Boolean(ma20[i] && price >= ma20[i]! * 0.985);
  const above60 = Boolean(ma60[i] && price >= ma60[i]! * 0.98);
  const macdBull = Boolean(macd && macd.dif[i] > macd.dea[i]);
  const rsiValue = rsi[i] || 50;
  const range = rangePosition(stock);
  const defensive = profile?.role === '防守现金流' || profile?.role === '商品避险';

  let score = defensive ? 24 : 18;
  const evidence = [profile?.role || 'ETF资产配置'];

  if (above20) {
    score += 14;
    evidence.push('站稳20日配置线');
  }
  if (above60) {
    score += 12;
    evidence.push('中期趋势未破');
  }
  if (macdBull) {
    score += 10;
    evidence.push('MACD处于多头侧');
  }
  if (rsiValue >= 42 && rsiValue <= 68) {
    score += 8;
    evidence.push(`RSI ${rsiValue.toFixed(1)} 未过热`);
  }
  if (stock.changePct > 0) score += Math.min(12, stock.changePct * (defensive ? 2 : 1.6));
  if (range < 0.82) {
    score += 8;
    evidence.push(`52周位置 ${(range * 100).toFixed(0)}%，尚未极端拥挤`);
  } else {
    evidence.push('接近52周高位，避免追价');
  }

  const riskBuffer = profile?.risk === 'low' ? 0.965 : profile?.risk === 'medium' ? 0.94 : 0.91;
  const targetLift = profile?.risk === 'low' ? 1.055 : profile?.risk === 'medium' ? 1.085 : 1.13;
  const entryLow = Math.min(price * 0.985, (ma20[i] || price) * 0.995);
  const entryHigh = Math.max(price * 1.005, (ma20[i] || price) * 1.015);

  return {
    strategy: 'ETF配置' as StrategyTag,
    score,
    evidence: evidence.slice(0, 5),
    entry: `${formatPrice(entryLow)}-${formatPrice(entryHigh)}`,
    stop: formatPrice(Math.min(price * riskBuffer, (ma60[i] || price) * 0.985)),
    target: formatPrice(Math.max(price * targetLift, stock.high52w || price * targetLift)),
  };
}

function riskLevelOf(stock: StockListItem, score: number, hasDeepData: boolean): DailyStrategyPick['riskLevel'] {
  const etf = getETFProfile(stock.code);
  if (etf?.risk === 'low') return score >= 45 ? 'low' : 'medium';
  if (etf?.risk === 'medium') return score >= 58 ? 'low' : 'medium';
  const pos = rangePosition(stock);
  if (stock.changePct >= 7.5 || pos >= 0.92 || score < 32) return 'high';
  if (!hasDeepData || stock.changePct >= 4.5 || pos >= 0.82 || score < 58) return 'medium';
  return 'low';
}

function executionText(strategy: StrategyTag, riskLevel: DailyStrategyPick['riskLevel']) {
  if (strategy === 'ETF配置') return riskLevel === 'high' ? '只做小仓观察，等回踩配置线' : '按资产配置分批，不用个股追涨打法';
  if (strategy === '龙头突破') return riskLevel === 'high' ? '只等放量回封/回踩确认' : '突破后分批跟随，失败立即撤';
  if (strategy === '共振低吸') return '只在计划买区低吸，不追高';
  if (strategy === '量价突破') return '看量能延续，缩量回落先观察';
  if (strategy === '趋势回踩') return '贴近20日线分批，跌破趋势线止损';
  return '等待更清晰的共振信号';
}

export function scoreStrategyStock(stock: StockListItem): DailyStrategyPick {
  const kline = stock.hasKline ? getKlineData(stock.code) : [];
  const etfSignal = isETF(stock.code) ? calcETFSignal(stock, getKlineData(stock.code, 250)) : null;
  const deep = stock.hasKline ? calcDeepSignal(stock, kline) : null;
  const fallback = calcUniverseSignal(stock);
  const signal = etfSignal || (deep && deep.score >= 28 ? deep : fallback);
  const score = Math.round(signal.score + (stock.hasKline || etfSignal ? 10 : 0));
  const confidence = Math.max(35, Math.min(92, score + (stock.hasKline || etfSignal ? 18 : 8)));
  const evidence = signal.evidence.slice(0, 4);
  const riskLevel = riskLevelOf(stock, score, stock.hasKline || Boolean(etfSignal));
  const etfProfile = getETFProfile(stock.code);

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
    hasDeepData: stock.hasKline || Boolean(etfSignal),
    riskLevel,
    execution: executionText(signal.strategy, riskLevel),
    reason: evidence.length
      ? evidence.join('；')
      : etfProfile
        ? `${etfProfile.theme} ETF，${etfProfile.strategyNote}`
      : `涨跌幅 ${formatPct(stock.changePct)}，等待更多量价确认`,
  };
}

export function buildDailyStrategyPicks(limit = 10): DailyStrategyPick[] {
  return getStockList()
    .filter(stock => stock.price > 0 && stock.changePct > -6 && stock.changePct < 9.8)
    .map(scoreStrategyStock)
    .filter(item => item.strategy !== '观察' && item.score >= 32)
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
    .slice(0, limit);
}

export function buildETFStrategyPicks(limit = 8): DailyStrategyPick[] {
  const etfCodes = new Set(etfProfiles.map(item => item.code));
  return getStockList()
    .filter(stock => etfCodes.has(stock.code))
    .map(scoreStrategyStock)
    .sort((a, b) => b.confidence - a.confidence || b.score - a.score)
    .slice(0, limit);
}
