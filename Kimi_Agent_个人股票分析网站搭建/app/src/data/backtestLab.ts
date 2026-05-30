import { calcBOLL, calcKDJ, calcMA, calcMACD, calcRSI, type KlineData } from './mockData';
import { roundPrice } from './price';

export interface StrategyTrade {
  entryDate: string;
  exitDate: string;
  entry: number;
  exit: number;
  grossReturnPct: number;
  costPct: number;
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
  avgWin: number;
  avgLoss: number;
  payoffRatio: number;
  profitFactor: number;
  expectancy: number;
  maxConsecutiveLosses: number;
  costModel: string;
  dataDays: number;
  dataStart: string;
  dataEnd: string;
  credibility: '高' | '中' | '低';
  trades: StrategyTrade[];
  verdict: string;
}

const pct = (value: number) => +value.toFixed(2);
const ROUND_TRIP_COST_PCT = 0.18;

function maxDrawdown(data: KlineData[]) {
  let peak = data[0]?.close || 0;
  let drawdown = 0;
  for (const day of data) {
    peak = Math.max(peak, day.close);
    if (peak > 0) drawdown = Math.min(drawdown, (day.close - peak) / peak * 100);
  }
  return pct(drawdown);
}

function maxConsecutiveLosses(returns: number[]) {
  let maxLosses = 0;
  let current = 0;
  returns.forEach(value => {
    if (value <= 0) {
      current += 1;
      maxLosses = Math.max(maxLosses, current);
    } else {
      current = 0;
    }
  });
  return maxLosses;
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
  const returns = trades.map(trade => trade.returnPct);
  const winReturns = returns.filter(value => value > 0);
  const lossReturns = returns.filter(value => value <= 0);
  const wins = winReturns.length;
  const avgReturn = sampleSize ? returns.reduce((sum, value) => sum + value, 0) / sampleSize : 0;
  const avgHoldingDays = sampleSize ? trades.reduce((sum, trade) => sum + trade.holdingDays, 0) / sampleSize : 0;
  const winRate = sampleSize ? wins / sampleSize * 100 : 0;
  const avgWin = winReturns.length ? winReturns.reduce((sum, value) => sum + value, 0) / winReturns.length : 0;
  const avgLoss = lossReturns.length ? lossReturns.reduce((sum, value) => sum + value, 0) / lossReturns.length : 0;
  const grossProfit = winReturns.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(lossReturns.reduce((sum, value) => sum + value, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 9.99 : 0;
  const payoffRatio = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : avgWin > 0 ? 9.99 : 0;
  const expectancy = avgReturn;
  const credibility: StrategyBacktestResult['credibility'] = sampleSize >= 30 ? '高' : sampleSize >= 12 ? '中' : '低';
  const verdict = sampleSize < 12
    ? '样本偏少，只能作为观察策略，不能直接放大仓位。'
    : winRate >= 58 && profitFactor >= 1.35 && expectancy > 0.6
      ? '具备主策略候选价值，重点跟踪回撤和连续亏损是否可接受。'
      : winRate >= 50 && profitFactor >= 1
        ? '可作为辅助策略，适合叠加大盘、行业和风控过滤。'
        : '单独使用不稳定，需要更严格的过滤条件或降低仓位。';

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
    avgWin: pct(avgWin),
    avgLoss: pct(avgLoss),
    payoffRatio: pct(payoffRatio),
    profitFactor: pct(profitFactor),
    expectancy: pct(expectancy),
    maxConsecutiveLosses: maxConsecutiveLosses(returns),
    costModel: `双边滑点与交易成本约${ROUND_TRIP_COST_PCT}%`,
    dataDays: data.length,
    dataStart: data[0]?.date || '-',
    dataEnd: data[data.length - 1]?.date || '-',
    credibility,
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

  for (let index = entryIndex + 1; index <= lastIndex; index++) {
    if (data[index].low <= stop) {
      exitIndex = index;
      exit = stop;
      break;
    }
    if (data[index].high >= target) {
      exitIndex = index;
      exit = target;
      break;
    }
  }

  const grossReturnPct = (exit - entry.close) / entry.close * 100;
  return {
    entryDate: entry.date,
    exitDate: data[exitIndex].date,
    entry: roundPrice(entry.close),
    exit: roundPrice(exit),
    grossReturnPct: pct(grossReturnPct),
    costPct: ROUND_TRIP_COST_PCT,
    returnPct: pct(grossReturnPct - ROUND_TRIP_COST_PCT),
    holdingDays: exitIndex - entryIndex,
    reason,
  };
}

function backtestTrendPullback(data: KlineData[]) {
  const ma20 = calcMA(data, 20);
  const ma60 = calcMA(data, 60);
  const rsi = calcRSI(data, 14);
  const trades: StrategyTrade[] = [];

  for (let index = 61; index < data.length - 2; index++) {
    const inUptrend = ma20[index]! > ma60[index]! && data[index].close >= ma60[index]!;
    const pullback = data[index].low <= ma20[index]! * 1.015 && data[index].close >= ma20[index]! * 0.985;
    const cooled = (rsi[index] || 50) >= 38 && (rsi[index] || 50) <= 62;
    if (inUptrend && pullback && cooled) {
      const trade = exitTrade(data, index, 7, 12, 45, '上升趋势回踩20日线');
      if (trade) trades.push(trade);
      index += 10;
    }
  }

  return summarize('trend_pullback', '趋势回踩', '稳健', '20日线回踩企稳，适合中期底仓加仓。', trades.slice(-80), data);
}

function backtestBreakout(data: KlineData[]) {
  const trades: StrategyTrade[] = [];
  for (let index = 31; index < data.length - 2; index++) {
    const high20 = Math.max(...data.slice(index - 20, index).map(day => day.high));
    const avgVolume = data.slice(index - 20, index).reduce((sum, day) => sum + day.volume, 0) / 20;
    if (data[index].close > high20 * 1.01 && data[index].volume > avgVolume * 1.35) {
      const trade = exitTrade(data, index, 8, 15, 30, '放量突破20日新高');
      if (trade) trades.push(trade);
      index += 8;
    }
  }
  return summarize('breakout', '放量突破', '进攻', '突破平台或前高，适合小仓位追强确认。', trades.slice(-80), data);
}

function backtestMeanReversion(data: KlineData[]) {
  const boll = calcBOLL(data);
  const { k } = calcKDJ(data);
  const trades: StrategyTrade[] = [];
  for (let index = 30; index < data.length - 2; index++) {
    const lower = boll.lower[index];
    if (lower && data[index].close < lower && (k[index] || 50) < 25) {
      const trade = exitTrade(data, index, 5, 8, 15, 'BOLL下轨叠加KDJ低位反弹');
      if (trade) trades.push(trade);
      index += 6;
    }
  }
  return summarize('mean_reversion', '超跌反弹', '均衡', '极端回撤后的短线修复，适合做波段。', trades.slice(-80), data);
}

function backtestMacd(data: KlineData[]) {
  const { dif, dea } = calcMACD(data);
  const trades: StrategyTrade[] = [];
  for (let index = 35; index < data.length - 2; index++) {
    if (dif[index] > dea[index] && dif[index - 1] <= dea[index - 1] && dif[index] < 0.8) {
      const trade = exitTrade(data, index, 7, 10, 25, 'MACD低位金叉');
      if (trade) trades.push(trade);
      index += 8;
    }
  }
  return summarize('macd_cross', 'MACD低位金叉', '均衡', '动量拐点策略，适合趋势刚转强阶段。', trades.slice(-80), data);
}

export function buildBacktestSuite(data: KlineData[]): StrategyBacktestResult[] {
  if (data.length < 80) return [];
  return [
    backtestTrendPullback(data),
    backtestBreakout(data),
    backtestMeanReversion(data),
    backtestMacd(data),
  ].sort((a, b) => (b.profitFactor + b.expectancy + b.winRate / 100) - (a.profitFactor + a.expectancy + a.winRate / 100));
}
