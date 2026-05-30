import { buildBacktestSuite } from './backtestLab';
import { calcIndicatorScore } from './analysisEngine';
import { buildMarketContext } from './marketContext';
import { getCoreStockList, getKlineData, getStockInfo } from './mockData';
import { buildStrategyPlan } from './strategyEngine';
import { buildTradeGuard } from './tradeGuard';
import { formatPrice } from './price';

export interface QuantCandidate {
  code: string;
  name: string;
  industry: string;
  rankScore: number;
  winRate: number;
  avgReturn: number;
  maxDrawdown: number;
  bestStrategy: string;
  entry: string;
  exit: string;
  reason: string;
}

export function buildQuantCandidates(): QuantCandidate[] {
  return getCoreStockList().map(stock => {
    const kline = getKlineData(stock.code);
    const latest = kline[kline.length - 1];
    const info = getStockInfo(stock.code);
    const score = calcIndicatorScore(kline);
    const plan = buildStrategyPlan(stock.code, stock.name);
    const market = buildMarketContext(stock.code, kline);
    const backtests = buildBacktestSuite(kline);
    const best = backtests[0];
    const guard = buildTradeGuard({
      currentPrice: latest?.close || info.price,
      plan,
      scoreOverall: score.overall,
      marketHeat: market.heat,
      bestBacktestWinRate: best?.winRate,
    });
    const rankScore = Math.round(
      score.overall * 0.45 +
      (best?.winRate || 0) * 0.35 +
      (best?.avgReturn || 0) * 4 -
      Math.abs(best?.maxDrawdown || 0) * 0.7 +
      (guard.status === 'allow' ? 18 : guard.status === 'wait' ? 4 : -18)
    );

    return {
      code: stock.code,
      name: stock.name,
      industry: stock.industry,
      rankScore,
      winRate: best?.winRate || 0,
      avgReturn: best?.avgReturn || 0,
      maxDrawdown: best?.maxDrawdown || 0,
      bestStrategy: best?.name || '样本不足',
      entry: `${formatPrice(plan.entryZone.low)}-${formatPrice(plan.entryZone.high)}`,
      exit: `${formatPrice(plan.stopLoss)} / ${formatPrice(plan.target1)}`,
      reason: guard.status === 'allow'
        ? `通过交易闸门，优先小仓执行 ${plan.actionText}`
        : guard.reasons[0] || market.riskBudget,
    };
  }).sort((a, b) => b.rankScore - a.rankScore);
}
