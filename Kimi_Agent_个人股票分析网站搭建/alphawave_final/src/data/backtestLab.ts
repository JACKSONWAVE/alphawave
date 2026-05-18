import { calcBOLL, calcKDJ, calcMA, calcMACD, calcRSI, type KlineData } from './mockData';
import { roundPrice } from './price';

export interface StrategyTrade {
  entryDate: string;
  exitDate: string;
  entry: number;
  exit: number;
  returnPct: number;
  holdingDays: number;
  reason: string;
}

export interface StrategyBacktestResult {
  id: string;
  name: string;
  style: '稳健' | '均衡' | '进攻';
  description: string;
  sampleSize: number;
  winRate: number;
  avgReturn: number;
  bestReturn: number;
  worstReturn: number;
  maxDrawdown: number;
  avgHoldingDays: number;
  trades: StrategyTrade[];
  verdict: string;
}

const pct = (value: number) => +value.toFixed(2);

function maxDrawdown(data: KlineData[]) {
  let peak = data[0]?.close || 0;
  let drawdown = 0;
  for (const day of data) {
    peak = Math.max(peak, day.close);
    if (peak > 0) drawdown = Math.min(drawdown, (day.close - peak) / peak * 100);
  }
  return pct(drawdown);
}

function summarize(
  id: string,
  name: string,
  style: StrategyBacktestResult['style'],
  description: string,
  trades: StrategyTrade[],
  data: KlineData[],
): StrategyBacktestResult {
  const sampleSize = trades.length;
  const returns = trades.map(t => t.returnPct);
  const wins = returns.filter(r => r > 0).length;
  const avgReturn = sampleSize ? returns.reduce((sum, value) => sum + value, 0) / sampleSize : 0;
  const avgHoldingDays = sampleSize ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / sampleSize : 0;
  const winRate = sampleSize ? wins / sampleSize * 100 : 0;
  const verdict = winRate >= 62 && avgReturn > 1
    ? '可作为主策略候选，重点看回撤是否能接受'
    : winRate >= 52
      ? '可作为辅助策略，适合和大盘/行业过滤叠加'
      : '单独使用不稳，需要更严格的过滤条件';

  return {
    id,
    name,
    style,
    description,
    sampleSize,
    winRate: pct(winRate),
    avgReturn: pct(avgReturn),
    bestReturn: sampleSize ? pct(Math.max(...returns)) : 0,
    worstReturn: sampleSize ? pct(Math.min(...returns)) : 0,
    maxDrawdown: maxDrawdown(data),
    avgHoldingDays: pct(avgHoldingDays),
    trades,
    verdict,
  };
}

function exitTrade(data: KlineData[], entryIndex: number, stopPct: number, targetPct: number, maxDays: number, reason: string): StrategyTrade | null {
  const entry = data[entryIndex];
  if (!entry || entryIndex >= data.length - 2) return null;

  const stop = entry.close * (1 - stopPct / 100);
  const target = entry.close * (1 + targetPct / 100);
  const lastIndex = Math.min(data.length - 1, entryIndex + maxDays);
  let exitIndex = lastIndex;
  let exit = data[lastIndex].close;

  for (let i = entryIndex + 1; i <= lastIndex; i++) {
    if (data[i].low <= stop) {
      exitIndex = i;
      exit = stop;
      break;
    }
    if (data[i].high >= target) {
      exitIndex = i;
      exit = target;
      break;
    }
  }

  return {
    entryDate: entry.date,
    exitDate: data[exitIndex].date,
    entry: roundPrice(entry.close),
    exit: roundPrice(exit),
    returnPct: pct((exit - entry.close) / entry.close * 100),
    holdingDays: exitIndex - entryIndex,
    reason,
  };
}

function backtestTrendPullback(data: KlineData[]) {
  const ma20 = calcMA(data, 20);
  const ma60 = calcMA(data, 60);
  const rsi = calcRSI(data, 14);
  const trades: StrategyTrade[] = [];

  for (let i = 61; i < data.length - 2; i++) {
    const inUptrend = ma20[i]! > ma60[i]! && data[i].close >= ma60[i]!;
    const pullback = data[i].low <= ma20[i]! * 1.015 && data[i].close >= ma20[i]! * 0.985;
    const cooled = (rsi[i] || 50) >= 38 && (rsi[i] || 50) <= 62;
    if (inUptrend && pullback && cooled) {
      const trade = exitTrade(data, i, 7, 12, 45, '上升趋势回踩20日线');
      if (trade) trades.push(trade);
      i += 10;
    }
  }

  return summarize('trend_pullback', '趋势回踩', '稳健', '20日线回踩企稳，适合中期底仓加仓', trades.slice(-80), data);
}

function backtestBreakout(data: KlineData[]) {
  const trades: StrategyTrade[] = [];
  for (let i = 31; i < data.length - 2; i++) {
    const high20 = Math.max(...data.slice(i - 20, i).map(d => d.high));
    const avgVolume = data.slice(i - 20, i).reduce((sum, d) => sum + d.volume, 0) / 20;
    if (data[i].close > high20 * 1.01 && data[i].volume > avgVolume * 1.35) {
      const trade = exitTrade(data, i, 8, 15, 30, '放量突破20日新高');
      if (trade) trades.push(trade);
      i += 8;
    }
  }
  return summarize('breakout', '放量突破', '进攻', '突破平台或前高，适合小仓位追强确认', trades.slice(-80), data);
}

function backtestMeanReversion(data: KlineData[]) {
  const boll = calcBOLL(data);
  const { k } = calcKDJ(data);
  const trades: StrategyTrade[] = [];
  for (let i = 30; i < data.length - 2; i++) {
    const lower = boll.lower[i];
    if (lower && data[i].close < lower && (k[i] || 50) < 25) {
      const trade = exitTrade(data, i, 5, 8, 15, '布林下轨+KDJ低位反弹');
      if (trade) trades.push(trade);
      i += 6;
    }
  }
  return summarize('mean_reversion', '超跌反弹', '均衡', '极端回撤后的短线修复，适合做波段', trades.slice(-80), data);
}

function backtestMacd(data: KlineData[]) {
  const { dif, dea } = calcMACD(data);
  const trades: StrategyTrade[] = [];
  for (let i = 35; i < data.length - 2; i++) {
    if (dif[i] > dea[i] && dif[i - 1] <= dea[i - 1] && dif[i] < 0.8) {
      const trade = exitTrade(data, i, 7, 10, 25, 'MACD低位金叉');
      if (trade) trades.push(trade);
      i += 8;
    }
  }
  return summarize('macd_cross', 'MACD低位金叉', '均衡', '动量拐点策略，适合趋势刚转强阶段', trades.slice(-80), data);
}

export function buildBacktestSuite(data: KlineData[]): StrategyBacktestResult[] {
  if (data.length < 80) return [];
  return [
    backtestTrendPullback(data),
    backtestBreakout(data),
    backtestMeanReversion(data),
    backtestMacd(data),
  ].sort((a, b) => (b.winRate + b.avgReturn) - (a.winRate + a.avgReturn));
}
