import { getKlineData, getStockList, type KlineData, type TradeRecord } from './mockData';
import { buildStrategyPlanFromData, type StrategyPlan } from './strategyEngine';

export interface TradeReviewRow {
  id: string;
  code: string;
  name: string;
  date: string;
  type: TradeRecord['type'];
  price: number;
  shares: number;
  amount: number;
  score: number;
  label: string;
  tone: 'red' | 'green' | 'yellow' | 'blue';
  problem: boolean;
  reason: string;
  planPrice: string;
}

export interface TradeReviewIssue {
  title: string;
  detail: string;
  tone: 'red' | 'green' | 'yellow' | 'blue';
}

export interface TradeExecutionReview {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  plannedBuyCount: number;
  chaseBuyCount: number;
  disciplinedSellCount: number;
  missingNoteCount: number;
  rows: TradeReviewRow[];
  issues: TradeReviewIssue[];
}

const round = (value: number) => +value.toFixed(2);

function klineUntil(code: string, date: string, tradePrice: number): KlineData[] {
  const source = getKlineData(code, 260);
  const before = source.filter(day => day.date <= date).slice(-250);
  const data = before.length >= 30 ? before : source.slice(-250);
  if (!data.length) return data;
  const latest = data[data.length - 1];
  return [
    ...data.slice(0, -1),
    {
      ...latest,
      close: tradePrice,
      high: Math.max(latest.high, tradePrice),
      low: Math.min(latest.low, tradePrice),
    },
  ];
}

function planForTrade(trade: TradeRecord): StrategyPlan {
  const stock = getStockList().find(item => item.code === trade.code);
  return buildStrategyPlanFromData(trade.code, trade.name || stock?.name || trade.code, klineUntil(trade.code, trade.date, trade.price));
}

function scoreBuy(trade: TradeRecord, plan: StrategyPlan): TradeReviewRow {
  const price = trade.price;
  const inEntry = price >= plan.entryZone.low && price <= plan.entryZone.high;
  const breakout = price >= plan.addZone.low && price <= plan.addZone.high * 1.03 && plan.bias !== 'bearish';
  const chased = price > plan.addZone.high * 1.03 || price > plan.target1 * 0.98;
  const riskDistance = price > plan.stopLoss ? (price - plan.stopLoss) / price * 100 : 0;
  let score = 76;
  if (inEntry) score += 16;
  if (breakout) score += 10;
  if (plan.confidence >= 65) score += 6;
  if (plan.riskReward >= 1.5) score += 6;
  if (plan.bias === 'bearish') score -= 18;
  if (riskDistance > 10) score -= 12;
  if (chased) score -= 24;

  const label = chased
    ? '追高风险'
    : inEntry
      ? '计划内低吸'
      : breakout
        ? '突破确认'
        : plan.bias === 'bearish'
          ? '逆势试错'
          : '计划外试错';
  const tone: TradeReviewRow['tone'] = chased || plan.bias === 'bearish' ? 'yellow' : inEntry || breakout ? 'red' : 'blue';
  const problem = chased || plan.bias === 'bearish' || riskDistance > 12;

  return {
    id: trade.id,
    code: trade.code,
    name: trade.name,
    date: trade.date,
    type: trade.type,
    price,
    shares: trade.shares,
    amount: round(trade.price * trade.shares),
    score: Math.max(20, Math.min(100, Math.round(score))),
    label,
    tone,
    problem,
    reason: `买区 ${plan.entryZone.low.toFixed(3)}-${plan.entryZone.high.toFixed(3)}，止损距 ${riskDistance.toFixed(1)}%，盈亏比 ${plan.riskReward}`,
    planPrice: `${plan.entryZone.low.toFixed(3)}-${plan.entryZone.high.toFixed(3)}`,
  };
}

function scoreSell(trade: TradeRecord, plan: StrategyPlan): TradeReviewRow {
  const price = trade.price;
  const stopSell = price <= plan.stopLoss * 1.015;
  const targetSell = price >= plan.target1 * 0.985;
  const riskReduce = plan.action === 'reduce' || plan.action === 'exit' || plan.bias === 'bearish';
  let score = 68;
  if (stopSell) score += 16;
  if (targetSell) score += 18;
  if (riskReduce) score += 12;
  if (!stopSell && !targetSell && !riskReduce) score -= 10;

  const label = stopSell
    ? '止损执行'
    : targetSell
      ? '目标兑现'
      : riskReduce
        ? '风险减仓'
        : '提前卖出';
  const tone: TradeReviewRow['tone'] = stopSell ? 'green' : targetSell ? 'red' : riskReduce ? 'yellow' : 'blue';

  return {
    id: trade.id,
    code: trade.code,
    name: trade.name,
    date: trade.date,
    type: trade.type,
    price,
    shares: trade.shares,
    amount: round(trade.price * trade.shares),
    score: Math.max(20, Math.min(100, Math.round(score))),
    label,
    tone,
    problem: score < 62,
    reason: `止损 ${plan.stopLoss.toFixed(3)}，目标 ${plan.target1.toFixed(3)}，当时策略 ${plan.actionText}`,
    planPrice: `${plan.stopLoss.toFixed(3)} / ${plan.target1.toFixed(3)}`,
  };
}

function gradeOf(score: number): TradeExecutionReview['grade'] {
  if (score >= 86) return 'A';
  if (score >= 72) return 'B';
  if (score >= 58) return 'C';
  return 'D';
}

export function buildTradeExecutionReview(trades: TradeRecord[]): TradeExecutionReview {
  const sorted = [...trades].sort((a, b) => `${b.date}-${b.id}`.localeCompare(`${a.date}-${a.id}`));
  const rows = sorted.map(trade => {
    const plan = planForTrade(trade);
    return trade.type === 'buy' ? scoreBuy(trade, plan) : scoreSell(trade, plan);
  });
  const tradeCount = rows.length;
  const buyRows = rows.filter(row => row.type === 'buy');
  const sellRows = rows.filter(row => row.type === 'sell');
  const score = tradeCount ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / tradeCount) : 0;
  const plannedBuyCount = buyRows.filter(row => row.label === '计划内低吸' || row.label === '突破确认').length;
  const chaseBuyCount = buyRows.filter(row => row.label === '追高风险').length;
  const disciplinedSellCount = sellRows.filter(row => row.label === '止损执行' || row.label === '目标兑现' || row.label === '风险减仓').length;
  const missingNoteCount = trades.filter(trade => !trade.note?.trim()).length;
  const issues: TradeReviewIssue[] = [];

  if (!tradeCount) {
    issues.push({ title: '还没有交易样本', detail: '录入买卖记录后，系统会按策略计划自动做执行复盘。', tone: 'blue' });
  }
  if (chaseBuyCount > 0) {
    issues.push({ title: '追高买入需要复盘', detail: `${chaseBuyCount} 笔买入高于计划区，后续应等回踩或突破确认。`, tone: 'yellow' });
  }
  if (buyRows.length > 0 && plannedBuyCount / buyRows.length < 0.5) {
    issues.push({ title: '计划内买入占比偏低', detail: '买点多数不在计划区，建议交易前先写好买区、止损和仓位上限。', tone: 'green' });
  }
  if (sellRows.length > 0 && disciplinedSellCount / sellRows.length < 0.6) {
    issues.push({ title: '卖出纪律仍要强化', detail: '卖出没有稳定对应止损、止盈或风险减仓逻辑，容易变成情绪交易。', tone: 'yellow' });
  }
  if (missingNoteCount > Math.max(1, tradeCount * 0.4)) {
    issues.push({ title: '交易备注不足', detail: `${missingNoteCount} 笔交易缺少备注，复盘时很难区分计划交易和情绪交易。`, tone: 'blue' });
  }
  if (!issues.length) {
    issues.push({ title: '执行纪律良好', detail: '当前交易大多能对应计划买区、止损或目标兑现，继续保持记录完整。', tone: 'red' });
  }

  return {
    score,
    grade: gradeOf(score),
    tradeCount,
    buyCount: buyRows.length,
    sellCount: sellRows.length,
    plannedBuyCount,
    chaseBuyCount,
    disciplinedSellCount,
    missingNoteCount,
    rows,
    issues: issues.slice(0, 4),
  };
}
