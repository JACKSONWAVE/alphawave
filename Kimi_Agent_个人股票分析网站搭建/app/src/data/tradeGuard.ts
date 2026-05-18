import type { TradeRecord } from './mockData';
import type { StrategyPlan } from './strategyEngine';

export interface HoldingPosition {
  code: string;
  name: string;
  shares: number;
  cost: number;
  lastTradeDate: string;
}

export interface TradeGuard {
  status: 'allow' | 'wait' | 'block';
  label: string;
  reasons: string[];
  passed: string[];
  riskDistance: number;
}

export interface HoldingAdvice {
  hasHolding: boolean;
  label: string;
  tone: 'red' | 'yellow' | 'green' | 'blue';
  profitPct: number;
  marketValue: number;
  baseAction: string;
  swingAction: string;
  notes: string[];
}

export function buildHoldingPositions(trades: TradeRecord[]): HoldingPosition[] {
  const map = new Map<string, HoldingPosition>();

  trades.forEach(trade => {
    const current = map.get(trade.code) || {
      code: trade.code,
      name: trade.name,
      shares: 0,
      cost: 0,
      lastTradeDate: trade.date,
    };

    if (trade.type === 'buy') {
      const nextShares = current.shares + trade.shares;
      current.cost = nextShares > 0
        ? (current.cost * current.shares + trade.price * trade.shares) / nextShares
        : trade.price;
      current.shares = nextShares;
    } else {
      current.shares = Math.max(0, current.shares - trade.shares);
    }

    current.name = trade.name;
    current.lastTradeDate = trade.date;
    map.set(trade.code, current);
  });

  return Array.from(map.values()).filter(position => position.shares > 0);
}

export function getHoldingPosition(trades: TradeRecord[], code: string) {
  return buildHoldingPositions(trades).find(position => position.code === code) || null;
}

export function buildTradeGuard(input: {
  currentPrice: number;
  plan: StrategyPlan;
  scoreOverall: number;
  marketHeat: number;
  bestBacktestWinRate?: number;
}) {
  const { currentPrice, plan, scoreOverall, marketHeat, bestBacktestWinRate } = input;
  const riskDistance = currentPrice ? Math.max(0, (currentPrice - plan.stopLoss) / currentPrice * 100) : 0;
  const inEntryZone = currentPrice >= plan.entryZone.low && currentPrice <= plan.entryZone.high;
  const breakoutConfirmed = currentPrice >= plan.addZone.low && scoreOverall >= 20;
  const reasons: string[] = [];
  const passed: string[] = [];

  if (inEntryZone || breakoutConfirmed) {
    passed.push(inEntryZone ? '价格在计划买区' : '价格突破加仓线且趋势分支持');
  } else {
    reasons.push(`价格未到计划买区 ${plan.entryZone.low.toFixed(3)}-${plan.entryZone.high.toFixed(3)}，不追临时波动`);
  }

  if (plan.riskReward >= 1.5) passed.push(`盈亏比 ${plan.riskReward} 合格`);
  else reasons.push(`盈亏比 ${plan.riskReward} 偏低，承担同样风险不划算`);

  if (scoreOverall >= 15) passed.push(`趋势分 ${scoreOverall} 支持行动`);
  else reasons.push(`趋势分 ${scoreOverall} 不足，先等方向更明确`);

  if (riskDistance > 0 && riskDistance <= 9) passed.push(`止损距离 ${riskDistance.toFixed(1)}% 可控`);
  else reasons.push(`止损距离 ${riskDistance.toFixed(1)}% 不合适，仓位容易失控`);

  if (marketHeat < 38) reasons.push('大盘温度偏冷，个股信号需要降级观察');
  else if (marketHeat > 78 && currentPrice > plan.entryZone.high) reasons.push('大盘温度偏热且价格脱离买区，优先防追高');
  else passed.push(`大盘温度 ${marketHeat} 未触发极端风控`);

  if (bestBacktestWinRate !== undefined) {
    if (bestBacktestWinRate >= 55) passed.push(`当前最佳策略历史胜率 ${bestBacktestWinRate}% 可参考`);
    else if (bestBacktestWinRate > 0) reasons.push(`当前最佳策略历史胜率 ${bestBacktestWinRate}% 不够高，降低仓位`);
  }

  const status: TradeGuard['status'] = reasons.length <= 1 && passed.length >= 4 ? 'allow' : reasons.length <= 3 ? 'wait' : 'block';
  const label = status === 'allow' ? '允许小仓执行' : status === 'wait' ? '等待条件补齐' : '今日不交易';

  return { status, label, reasons, passed, riskDistance };
}

export function buildHoldingAdvice(input: {
  position: HoldingPosition | null;
  currentPrice: number;
  plan: StrategyPlan;
  scoreOverall: number;
  marketHeat: number;
}): HoldingAdvice {
  const { position, currentPrice, plan, scoreOverall, marketHeat } = input;
  if (!position) {
    return {
      hasHolding: false,
      label: '未持仓',
      tone: 'blue',
      profitPct: 0,
      marketValue: 0,
      baseAction: '没有底仓，不急着追价',
      swingAction: '只在计划买区或突破确认后小仓试错',
      notes: ['未持仓时先看位置和盈亏比，宁可错过，不做情绪单'],
    };
  }

  const profitPct = position.cost ? (currentPrice - position.cost) / position.cost * 100 : 0;
  const marketValue = currentPrice * position.shares;
  const hitStop = currentPrice <= plan.stopLoss;
  const nearTarget = currentPrice >= plan.target1 || profitPct >= 10;
  const weakScore = scoreOverall <= -15 || marketHeat < 38;

  if (hitStop) {
    return {
      hasHolding: true,
      label: '止损优先',
      tone: 'green',
      profitPct,
      marketValue,
      baseAction: '底仓降到防守仓位',
      swingAction: '波段仓先退出，等重新站回止损线上方',
      notes: ['价格触及计划止损，先控制亏损，再讨论反弹'],
    };
  }

  if (nearTarget) {
    return {
      hasHolding: true,
      label: '保护利润',
      tone: 'red',
      profitPct,
      marketValue,
      baseAction: '底仓继续跟踪趋势',
      swingAction: '波段仓分批止盈，并把止损上移到成本线上方',
      notes: ['盈利扩大后不要让利润回撤成亏损，优先移动止损'],
    };
  }

  if (weakScore) {
    return {
      hasHolding: true,
      label: '防守观察',
      tone: 'yellow',
      profitPct,
      marketValue,
      baseAction: '底仓保留但不加仓',
      swingAction: '波段仓减到轻仓，等待行业和大盘修复',
      notes: ['技术分或大盘温度偏弱，持仓可以看，但新买要降级'],
    };
  }

  return {
    hasHolding: true,
    label: '持仓跟随',
    tone: 'blue',
    profitPct,
    marketValue,
    baseAction: '底仓继续按中期趋势持有',
    swingAction: '波段仓只在回踩计划区时加，不追高',
    notes: ['当前更适合执行计划，不适合临时加大仓位'],
  };
}
