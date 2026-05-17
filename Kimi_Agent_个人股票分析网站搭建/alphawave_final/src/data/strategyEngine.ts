import {
  calcBOLL,
  calcCCI,
  calcKDJ,
  calcMA,
  calcMACD,
  calcRSI,
  generateSignals,
  getKlineData,
  getTrend,
  type KlineData,
} from './mockData';
import { analyzeDaily, calcIndicatorScore, calcSupportResistance } from './analysisEngine';
import type { RealtimeQuote } from './realtimeApi';

export type StrategyBias = 'bullish' | 'neutral' | 'bearish';
export type StrategyAction = 'buy_zone' | 'hold' | 'wait_pullback' | 'watch_breakout' | 'reduce' | 'exit';
export type TriggerSeverity = 'info' | 'warning' | 'danger';

export interface PriceZone {
  label: string;
  low: number;
  high: number;
  note: string;
}

export interface StrategyScenario {
  name: string;
  condition: string;
  action: string;
  probability: number;
}

export interface StrategyTrigger {
  label: string;
  price: number;
  direction: 'above' | 'below';
  severity: TriggerSeverity;
  message: string;
}

export interface StrategyBacktest {
  sampleSize: number;
  winRate: number;
  avgReturn: number;
  bestReturn: number;
  worstReturn: number;
  expectancy: number;
  avgHoldingDays: number;
  lastSignalDate: string;
  lastSignalType: 'buy' | 'sell' | 'none';
}

export interface StrategyPlan {
  code: string;
  name: string;
  currentPrice: number;
  bias: StrategyBias;
  action: StrategyAction;
  actionText: string;
  confidence: number;
  riskReward: number;
  rewardPct: number;
  riskPct: number;
  positionSize: string;
  entryZone: PriceZone;
  addZone: PriceZone;
  reduceZone: PriceZone;
  stopLoss: number;
  target1: number;
  target2: number;
  support: ReturnType<typeof calcSupportResistance>;
  score: ReturnType<typeof calcIndicatorScore>;
  daily: ReturnType<typeof analyzeDaily>;
  trend: ReturnType<typeof getTrend>;
  scenarios: StrategyScenario[];
  triggers: StrategyTrigger[];
  reasons: string[];
  risks: string[];
  backtest: StrategyBacktest;
  summary: string;
}

const round2 = (n: number) => +n.toFixed(2);
const pct = (n: number) => +n.toFixed(2);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function calcATR(data: KlineData[], period = 14): number {
  if (data.length < period + 1) return data[data.length - 1].close * 0.02;
  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    );
    sum += tr;
  }
  return sum / period;
}

function lastValue(values: Array<number | null>, fallback: number): number {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] !== null && values[i] !== undefined) return values[i] as number;
  }
  return fallback;
}

function volumeRatio(data: KlineData[]): number {
  const latest = data[data.length - 1];
  const base = data.slice(-21, -1);
  const avg = base.reduce((sum, d) => sum + d.volume, 0) / Math.max(base.length, 1);
  return avg > 0 ? latest.volume / avg : 1;
}

function momentum(data: KlineData[], days: number): number {
  if (data.length <= days) return 0;
  const latest = data[data.length - 1].close;
  const base = data[data.length - 1 - days].close;
  return base > 0 ? (latest - base) / base * 100 : 0;
}

function buildBacktest(data: KlineData[]): StrategyBacktest {
  const signals = generateSignals(data);
  const signalByDate = new Map(signals.map(s => [s.date, s]));
  const buySignals = signals.filter(s => s.type === 'buy').slice(-24);
  const returns: number[] = [];
  const holdingDays: number[] = [];

  for (const sig of buySignals) {
    const entryIndex = data.findIndex(d => d.date === sig.date);
    if (entryIndex < 0 || entryIndex >= data.length - 2) continue;

    const entry = data[entryIndex].close;
    const stop = entry * 0.92;
    const target = entry * 1.12;
    const maxExit = Math.min(data.length - 1, entryIndex + 30);
    let exit = data[maxExit].close;
    let exitIndex = maxExit;

    for (let i = entryIndex + 1; i <= maxExit; i++) {
      const daySignal = signalByDate.get(data[i].date);
      if (data[i].low <= stop) {
        exit = stop;
        exitIndex = i;
        break;
      }
      if (data[i].high >= target) {
        exit = target;
        exitIndex = i;
        break;
      }
      if (daySignal?.type === 'sell') {
        exit = data[i].close;
        exitIndex = i;
        break;
      }
    }

    returns.push((exit - entry) / entry * 100);
    holdingDays.push(exitIndex - entryIndex);
  }

  const sampleSize = returns.length;
  const wins = returns.filter(r => r > 0).length;
  const avgReturn = sampleSize ? returns.reduce((a, b) => a + b, 0) / sampleSize : 0;
  const avgHoldingDays = holdingDays.length ? holdingDays.reduce((a, b) => a + b, 0) / holdingDays.length : 0;
  const lastSignal = signals[signals.length - 1];

  return {
    sampleSize,
    winRate: sampleSize ? pct(wins / sampleSize * 100) : 0,
    avgReturn: pct(avgReturn),
    bestReturn: sampleSize ? pct(Math.max(...returns)) : 0,
    worstReturn: sampleSize ? pct(Math.min(...returns)) : 0,
    expectancy: pct(avgReturn),
    avgHoldingDays: pct(avgHoldingDays),
    lastSignalDate: lastSignal?.date || '-',
    lastSignalType: lastSignal?.type || 'none',
  };
}

function chooseAction(score: number, rr: number, current: number, weakSupport: number, weakResistance: number): StrategyAction {
  const nearSupport = current <= weakSupport * 1.025;
  const nearResistance = current >= weakResistance * 0.985;

  if (score <= -60) return 'exit';
  if (score <= -30) return 'reduce';
  if (score >= 45 && nearSupport && rr >= 1.4) return 'buy_zone';
  if (score >= 30 && nearResistance) return 'watch_breakout';
  if (score >= 30) return 'wait_pullback';
  if (score > -30 && score < 30) return 'hold';
  return 'hold';
}

function actionText(action: StrategyAction): string {
  const map: Record<StrategyAction, string> = {
    buy_zone: '支撑区分批买入',
    hold: '持仓观察',
    wait_pullback: '等待回踩低吸',
    watch_breakout: '观察突破确认',
    reduce: '反弹减仓',
    exit: '破位离场',
  };
  return map[action];
}

function inferBias(score: number, ma20: number, ma60: number, current: number, m20: number): StrategyBias {
  if (score >= 30 && ma20 >= ma60 && m20 >= 0 && current >= ma20 * 0.98) return 'bullish';
  if (score <= -30 || current < ma20 * 0.96 || ma20 < ma60 * 0.98) return 'bearish';
  return 'neutral';
}

function positionByRisk(action: StrategyAction, confidence: number, rr: number, riskLevel: string): string {
  if (action === 'exit') return '0%，先离场等重新站回关键均线';
  if (action === 'reduce') return '20%~40%，反弹到压力区优先降风险';
  if (riskLevel === 'high') return '10%~20%，高波动只做试探仓';
  if (action === 'buy_zone' && confidence >= 65 && rr >= 1.8) return '30%~50%，分2~3笔进场';
  if (action === 'wait_pullback' || action === 'watch_breakout') return '10%~30%，等触发条件再加';
  return '20%~40%，以持仓观察为主';
}

export function buildStrategyPlan(code: string, name: string, quote?: RealtimeQuote): StrategyPlan {
  const data = getKlineData(code, 250);
  const current = quote?.price || data[data.length - 1].close;
  const latest = { ...data[data.length - 1], close: current };
  const workingData = [...data.slice(0, -1), latest];
  const sr = { ...calcSupportResistance(workingData.slice(-120)), currentPrice: round2(current) };
  const score = calcIndicatorScore(workingData.slice(-120));
  const daily = analyzeDaily(workingData.slice(-120), quote);
  const trend = getTrend(workingData);
  const atr = calcATR(workingData);
  const ma20 = lastValue(calcMA(workingData, 20), current);
  const ma60 = lastValue(calcMA(workingData, 60), current);
  const m20 = momentum(workingData, 20);
  const m60 = momentum(workingData, 60);
  const volRatio = volumeRatio(workingData);

  const stopLoss = round2(Math.min(sr.stopLoss, current - atr * 1.2, sr.weakSupport * 0.985));
  const target1 = round2(Math.max(sr.weakResistance, current + atr * 1.8));
  const target2 = round2(Math.max(sr.strongResistance, target1 + atr * 1.4));
  const riskPct = current > stopLoss ? (current - stopLoss) / current * 100 : 0;
  const rewardPct = target1 > current ? (target1 - current) / current * 100 : 0;
  const rr = riskPct > 0 ? rewardPct / riskPct : 0;

  const bias = inferBias(score.overall, ma20, ma60, current, m20);
  const action = chooseAction(score.overall, rr, current, sr.weakSupport, sr.weakResistance);
  const confidence = Math.round(clamp(
    Math.abs(score.overall) * 0.52 +
    trend.strength * 28 +
    clamp(rr, 0, 3) * 8 +
    (volRatio > 1.2 ? 6 : 0) +
    (Math.sign(m20) === Math.sign(score.overall) ? 6 : 0),
    20,
    92,
  ));

  const rawEntryLow = Math.max(sr.strongSupport, sr.weakSupport - atr * 0.45);
  const rawEntryHigh = Math.min(current, sr.weakSupport + atr * 0.35);
  const entryLow = round2(Math.min(rawEntryLow, rawEntryHigh));
  const entryHigh = round2(Math.max(rawEntryLow, rawEntryHigh));
  const breakoutLine = round2(Math.max(sr.weakResistance, ma20 * 1.01));
  const reduceLow = round2(Math.max(sr.weakResistance, current + atr * 0.8));
  const reduceHigh = round2(Math.max(sr.strongResistance, reduceLow + atr * 0.8));

  const scenarios: StrategyScenario[] = [
    {
      name: '转强剧本',
      condition: `放量站上 ${breakoutLine}，且收盘不跌回20日线`,
      action: `可加到计划仓位，第一目标 ${target1}，强势再看 ${target2}`,
      probability: bias === 'bullish' ? 42 : bias === 'neutral' ? 32 : 22,
    },
    {
      name: '震荡剧本',
      condition: `${entryLow}~${breakoutLine} 区间内缩量整理`,
      action: `持仓不追高，靠近 ${entryLow}~${entryHigh} 才分批低吸`,
      probability: bias === 'neutral' ? 45 : 34,
    },
    {
      name: '走弱剧本',
      condition: `跌破 ${stopLoss} 或放量跌破 ${sr.strongSupport}`,
      action: `先减仓/离场，等重新站回 ${sr.weakSupport} 后再评估`,
      probability: bias === 'bearish' ? 44 : 24,
    },
  ];

  const triggers: StrategyTrigger[] = [
    {
      label: '突破压力',
      price: breakoutLine,
      direction: 'above',
      severity: 'info',
      message: `站上 ${breakoutLine} 后观察是否放量，确认后才考虑追随`,
    },
    {
      label: '回踩买区',
      price: entryHigh,
      direction: 'below',
      severity: 'info',
      message: `回到 ${entryLow}~${entryHigh} 是计划内低吸区，不追涨`,
    },
    {
      label: '跌破止损',
      price: stopLoss,
      direction: 'below',
      severity: 'danger',
      message: `跌破 ${stopLoss} 代表波段计划失效，优先控制仓位`,
    },
    {
      label: '接近止盈',
      price: target1,
      direction: 'above',
      severity: 'warning',
      message: `到达 ${target1} 后分批止盈或上移止损`,
    },
  ];

  const reasons = [
    `综合评分 ${score.overall}/100，信号为 ${score.signal}`,
    `20日动量 ${pct(m20)}%，60日动量 ${pct(m60)}%`,
    `MA20 ${round2(ma20)}，MA60 ${round2(ma60)}，趋势强度 ${Math.round(trend.strength * 100)}%`,
    `量能约为20日均量的 ${pct(volRatio)} 倍`,
  ];

  const risks = [
    `止损到当前价距离 ${pct(riskPct)}%，超过计划仓位会放大回撤`,
    volRatio > 2 ? '近期放量较大，若放量滞涨要防止冲高回落' : '量能未明显放大，突破需要成交量确认',
    current > sr.weakResistance ? '现价靠近压力区，追高的盈亏比会变差' : '未突破前仍可能在支撑压力间震荡',
    '策略基于技术数据，不包含突发公告、业绩预告和政策消息',
  ];

  const backtest = buildBacktest(workingData);
  const positionSize = positionByRisk(action, confidence, rr, daily.riskLevel);
  const summary = `${actionText(action)}；盈亏比 ${pct(rr)}，置信度 ${confidence}%，仓位建议 ${positionSize}`;

  return {
    code,
    name,
    currentPrice: round2(current),
    bias,
    action,
    actionText: actionText(action),
    confidence,
    riskReward: pct(rr),
    rewardPct: pct(rewardPct),
    riskPct: pct(riskPct),
    positionSize,
    entryZone: {
      label: '计划买区',
      low: entryLow,
      high: entryHigh,
      note: '只在回踩不破、量能稳定时分批执行',
    },
    addZone: {
      label: '突破加仓线',
      low: breakoutLine,
      high: round2(breakoutLine + atr * 0.6),
      note: '放量站稳后加仓，不做无量突破',
    },
    reduceZone: {
      label: '止盈/减仓区',
      low: reduceLow,
      high: reduceHigh,
      note: '到区间后分批兑现，或把止损上移到成本上方',
    },
    stopLoss,
    target1,
    target2,
    support: sr,
    score,
    daily,
    trend,
    scenarios,
    triggers,
    reasons,
    risks,
    backtest,
    summary,
  };
}

export function formatStrategyMarkdown(plan: StrategyPlan): string {
  const biasText = plan.bias === 'bullish' ? '偏多' : plan.bias === 'bearish' ? '偏空' : '中性';
  const lines = [
    `### ${plan.name} (${plan.code}) 今日策略`,
    `- 结论：${plan.actionText}，方向 ${biasText}，置信度 ${plan.confidence}%`,
    `- 当前价：${plan.currentPrice}，买区：${plan.entryZone.low}~${plan.entryZone.high}`,
    `- 止损：${plan.stopLoss}，目标：${plan.target1}/${plan.target2}，盈亏比：${plan.riskReward}`,
    `- 仓位：${plan.positionSize}`,
    `- 触发：上破 ${plan.addZone.low} 看突破；跌破 ${plan.stopLoss} 先控风险`,
    '',
    `情景预案：`,
    ...plan.scenarios.map(s => `- ${s.name}：${s.condition}；${s.action}`),
    '',
    `回测参考：近${plan.backtest.sampleSize}次买入信号，胜率${plan.backtest.winRate}%，平均收益${plan.backtest.avgReturn}%`,
  ];
  return lines.join('\n');
}
