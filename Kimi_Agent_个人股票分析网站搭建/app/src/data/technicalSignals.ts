import {
  calcBOLL,
  calcCCI,
  calcKDJ,
  calcMA,
  calcMACD,
  calcRSI,
  calcWR,
  type KlineData,
} from './mockData';
import { formatPrice } from './price';

export type TechnicalSignalType = 'buy' | 'sell';
export type TechnicalBias = 'bullish' | 'neutral' | 'bearish';
export type TechnicalEventTag =
  | 'trend'
  | 'ma-cross'
  | 'macd'
  | 'kdj'
  | 'rsi'
  | 'boll'
  | 'cci'
  | 'wr'
  | 'volume'
  | 'position';

export interface TechnicalEvent {
  name: string;
  side: 'bullish' | 'bearish' | 'neutral';
  weight: number;
  detail: string;
  tag: TechnicalEventTag;
}

export interface TechnicalSignal {
  type: TechnicalSignalType;
  date: string;
  price: number;
  score: number;
  strength: 'strong' | 'medium';
  title: string;
  reason: string;
  tags: string[];
  action: string;
}

export interface TechnicalSignalReport {
  score: number;
  bias: TechnicalBias;
  verdict: string;
  action: string;
  risk: string;
  buyPlan: string;
  sellPlan: string;
  events: TechnicalEvent[];
  signals: TechnicalSignal[];
}

interface IndicatorSet {
  ma5: Array<number | null>;
  ma10: Array<number | null>;
  ma20: Array<number | null>;
  ma60: Array<number | null>;
  macd: ReturnType<typeof calcMACD>;
  rsi: Array<number | null>;
  kdj: ReturnType<typeof calcKDJ>;
  boll: ReturnType<typeof calcBOLL>;
  cci: Array<number | null>;
  wr: Array<number | null>;
}

interface ScoredSignal extends TechnicalSignal {
  sourceIndex: number;
}

function buildIndicatorSet(data: KlineData[]): IndicatorSet {
  return {
    ma5: calcMA(data, 5),
    ma10: calcMA(data, 10),
    ma20: calcMA(data, 20),
    ma60: calcMA(data, 60),
    macd: calcMACD(data),
    rsi: calcRSI(data, 14),
    kdj: calcKDJ(data),
    boll: calcBOLL(data),
    cci: calcCCI(data),
    wr: calcWR(data),
  };
}

function valueAt(values: Array<number | null> | number[], index: number, fallback = 0) {
  const value = values[index];
  return value === null || value === undefined || Number.isNaN(value) ? fallback : value;
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function crossedUp(a: Array<number | null> | number[], b: Array<number | null> | number[], index: number) {
  return index > 0
    && valueAt(a, index) > valueAt(b, index)
    && valueAt(a, index - 1) <= valueAt(b, index - 1);
}

function crossedDown(a: Array<number | null> | number[], b: Array<number | null> | number[], index: number) {
  return index > 0
    && valueAt(a, index) < valueAt(b, index)
    && valueAt(a, index - 1) >= valueAt(b, index - 1);
}

function pctDistance(price: number, anchor: number) {
  return anchor > 0 ? (price - anchor) / anchor * 100 : 0;
}

function volumeRatio(data: KlineData[], index: number) {
  const start = Math.max(0, index - 20);
  const base = data.slice(start, index);
  const average = avg(base.map(item => item.volume));
  return average > 0 ? data[index].volume / average : 1;
}

function recentHigh(data: KlineData[], index: number, days: number) {
  const start = Math.max(0, index - days + 1);
  return Math.max(...data.slice(start, index + 1).map(item => item.high));
}

function recentLow(data: KlineData[], index: number, days: number) {
  const start = Math.max(0, index - days + 1);
  return Math.min(...data.slice(start, index + 1).map(item => item.low));
}

function sortedNames(events: TechnicalEvent[], side: TechnicalEvent['side'], count = 3) {
  return events
    .filter(event => event.side === side)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, count)
    .map(event => event.name);
}

function buildEvents(data: KlineData[], indicators: IndicatorSet, index: number): TechnicalEvent[] {
  const { ma5, ma10, ma20, ma60, macd, rsi, kdj, boll, cci, wr } = indicators;
  const close = data[index].close;
  const previousClose = data[index - 1]?.close || close;
  const ma5v = valueAt(ma5, index, close);
  const ma10v = valueAt(ma10, index, close);
  const ma20v = valueAt(ma20, index, close);
  const ma60v = valueAt(ma60, index, close);
  const ma20Prev = valueAt(ma20, index - 5, ma20v);
  const difNow = valueAt(macd.dif, index);
  const deaNow = valueAt(macd.dea, index);
  const macdNow = valueAt(macd.macd, index);
  const macdPrev = valueAt(macd.macd, index - 1);
  const macdPrev2 = valueAt(macd.macd, index - 2);
  const rsiNow = valueAt(rsi, index, 50);
  const rsiPrev = valueAt(rsi, index - 1, 50);
  const kNow = valueAt(kdj.k, index, 50);
  const dNow = valueAt(kdj.d, index, 50);
  const cciNow = valueAt(cci, index, 0);
  const cciPrev = valueAt(cci, index - 1, 0);
  const wrNow = valueAt(wr, index, -50);
  const upper = valueAt(boll.upper, index, close * 1.08);
  const mid = valueAt(boll.mid, index, ma20v);
  const lower = valueAt(boll.lower, index, close * 0.92);
  const volRatio = volumeRatio(data, index);
  const high60 = recentHigh(data, index, 60);
  const low60 = recentLow(data, index, 60);
  const distHigh = pctDistance(close, high60);
  const distLow = pctDistance(close, low60);
  const events: TechnicalEvent[] = [];
  const add = (event: TechnicalEvent) => events.push(event);

  if (ma5v > ma10v && ma10v > ma20v && ma20v >= ma60v * 0.99) {
    add({ name: '均线多头排列', side: 'bullish', weight: 16, tag: 'trend', detail: 'MA5、MA10、MA20同向向上，趋势结构偏多。' });
  } else if (ma5v < ma10v && ma10v < ma20v && close < ma20v) {
    add({ name: '均线空头排列', side: 'bearish', weight: 18, tag: 'trend', detail: '短中期均线压制价格，反弹先按压力位处理。' });
  }

  if (crossedUp(ma5, ma10, index) && close >= ma20v * 0.97) {
    add({ name: 'MA5金叉MA10', side: 'bullish', weight: 12, tag: 'ma-cross', detail: '短线动能转强，需要位置和量能继续确认。' });
  }
  if (crossedDown(ma5, ma10, index) && close <= ma20v * 1.03) {
    add({ name: 'MA5死叉MA10', side: 'bearish', weight: 12, tag: 'ma-cross', detail: '短线动能转弱，若跌破MA20要降低仓位。' });
  }

  if (crossedUp(macd.dif, macd.dea, index)) {
    add({
      name: difNow < 0 ? 'MACD低位金叉' : 'MACD金叉',
      side: 'bullish',
      weight: difNow < 0 ? 18 : 10,
      tag: 'macd',
      detail: difNow < 0 ? '零轴下金叉属于动能修复，适合等回踩确认。' : '零轴上金叉偏趋势延续，但不单独追高。',
    });
  }
  if (crossedDown(macd.dif, macd.dea, index)) {
    add({
      name: difNow > 0 ? 'MACD高位死叉' : 'MACD死叉',
      side: 'bearish',
      weight: difNow > 0 ? 18 : 10,
      tag: 'macd',
      detail: difNow > 0 ? '零轴上死叉说明上涨动能衰减，优先看减仓。' : '弱势区死叉，反弹失败概率提高。',
    });
  }
  if (macdNow > macdPrev && macdPrev > macdPrev2) {
    add({ name: 'MACD柱体连续放大', side: 'bullish', weight: 8, tag: 'macd', detail: '动能连续增强，可作为持仓加分项。' });
  }
  if (macdNow < macdPrev && macdPrev < macdPrev2) {
    add({ name: 'MACD柱体连续收缩', side: 'bearish', weight: 8, tag: 'macd', detail: '动能连续衰减，追高胜率下降。' });
  }

  if (crossedUp(kdj.k, kdj.d, index) && kNow < 35) {
    add({ name: 'KDJ低位金叉', side: 'bullish', weight: 18, tag: 'kdj', detail: '短线从超卖区修复，是低吸观察信号。' });
  } else if (crossedUp(kdj.k, kdj.d, index)) {
    add({ name: 'KDJ金叉', side: 'bullish', weight: 8, tag: 'kdj', detail: '短线转强，但位置不低时不单独作为买点。' });
  }
  if (crossedDown(kdj.k, kdj.d, index) && kNow > 75) {
    add({ name: 'KDJ高位死叉', side: 'bearish', weight: 18, tag: 'kdj', detail: '高位拐头，优先锁定利润。' });
  } else if (kNow > 85) {
    add({ name: 'KDJ超买钝化', side: 'bearish', weight: 10, tag: 'kdj', detail: '强势股可以钝化，但新开仓风险变高。' });
  }
  if (kNow < 18 && dNow < 25) {
    add({ name: 'KDJ深度超卖', side: 'bullish', weight: 10, tag: 'kdj', detail: '只代表跌深，必须等止跌K线确认。' });
  }

  if (rsiPrev < 35 && rsiNow >= 35) {
    add({ name: 'RSI脱离超卖', side: 'bullish', weight: 14, tag: 'rsi', detail: '弱势修复信号，适合结合支撑位观察。' });
  } else if (rsiNow < 30) {
    add({ name: 'RSI超卖', side: 'bullish', weight: 8, tag: 'rsi', detail: '具备反弹条件，但不能单独抄底。' });
  }
  if (rsiPrev > 70 && rsiNow <= 70) {
    add({ name: 'RSI高位回落', side: 'bearish', weight: 14, tag: 'rsi', detail: '高位热度下降，短线要防回撤。' });
  } else if (rsiNow > 76) {
    add({ name: 'RSI超买', side: 'bearish', weight: 10, tag: 'rsi', detail: '涨速偏快，适合分批止盈而不是追买。' });
  }

  if (data[index].low <= lower * 1.01 && close > lower && close > previousClose) {
    add({ name: 'BOLL下轨止跌', side: 'bullish', weight: 14, tag: 'boll', detail: '触及下轨后收回，属于超跌修复信号。' });
  }
  if (close > mid && previousClose <= mid && ma20v >= ma20Prev) {
    add({ name: '站回BOLL中轨', side: 'bullish', weight: 12, tag: 'boll', detail: '重新站回中轨，趋势修复质量提高。' });
  }
  if (data[index].high >= upper * 0.99 && close < upper && close < previousClose) {
    add({ name: 'BOLL上轨冲高回落', side: 'bearish', weight: 14, tag: 'boll', detail: '上轨附近失败，短线容易回踩中轨。' });
  }
  if (close > upper && volRatio > 1.25 && ma20v >= ma20Prev) {
    add({ name: '放量突破BOLL上轨', side: 'bullish', weight: 12, tag: 'boll', detail: '强势突破信号，次日必须守住突破区。' });
  }

  if (cciPrev < -100 && cciNow >= -100) {
    add({ name: 'CCI超卖修复', side: 'bullish', weight: 12, tag: 'cci', detail: '情绪从极弱区恢复，适合做反弹确认。' });
  }
  if (cciPrev > 100 && cciNow <= 100) {
    add({ name: 'CCI超买回落', side: 'bearish', weight: 12, tag: 'cci', detail: '短线过热回落，适合降低进攻仓位。' });
  }
  if (wrNow < -85) {
    add({ name: 'WR超卖', side: 'bullish', weight: 6, tag: 'wr', detail: '价格处于短线低位，等待其他指标共振。' });
  }
  if (wrNow > -15) {
    add({ name: 'WR超买', side: 'bearish', weight: 6, tag: 'wr', detail: '价格处于短线高位，不适合追高。' });
  }

  if (close >= ma20v && ma20v > ma20Prev && volRatio >= 1.15) {
    add({ name: '量价趋势确认', side: 'bullish', weight: 12, tag: 'volume', detail: `量能为20日均量的${volRatio.toFixed(1)}倍，趋势确认度提高。` });
  }
  if (close < ma20v * 0.98 && volRatio >= 1.2) {
    add({ name: '放量跌破MA20', side: 'bearish', weight: 18, tag: 'volume', detail: '放量跌破中期生命线，优先防守。' });
  }
  if (distHigh > -4 && rsiNow > 68 && kNow > 75) {
    add({ name: '接近60日高位过热', side: 'bearish', weight: 16, tag: 'position', detail: '价格接近阶段高位且动量过热，追高性价比低。' });
  }
  if (distLow < 8 && rsiNow < 45 && close > previousClose) {
    add({ name: '接近60日低位止跌', side: 'bullish', weight: 10, tag: 'position', detail: '靠近阶段低位出现止跌，适合观察低吸条件。' });
  }

  return events;
}

function scoreEvents(events: TechnicalEvent[]) {
  const bullish = events.filter(event => event.side === 'bullish').reduce((sum, event) => sum + event.weight, 0);
  const bearish = events.filter(event => event.side === 'bearish').reduce((sum, event) => sum + event.weight, 0);
  return { bullish, bearish, net: clamp(bullish - bearish, -100, 100) };
}

function hasConfirmation(events: TechnicalEvent[], side: 'bullish' | 'bearish') {
  const keyTags: TechnicalEventTag[] = ['macd', 'kdj', 'boll', 'volume', 'ma-cross'];
  return events.filter(event => event.side === side && keyTags.includes(event.tag)).length >= 2;
}

function buildSignal(data: KlineData[], indicators: IndicatorSet, index: number, events: TechnicalEvent[]): ScoredSignal | null {
  const { bullish, bearish } = scoreEvents(events);
  const close = data[index].close;
  const ma20 = valueAt(indicators.ma20, index, close);
  const high20 = recentHigh(data, index, 20);
  const low20 = recentLow(data, index, 20);
  const tooExtended = pctDistance(close, ma20) > 10;
  const breakingDown = close < ma20 * 0.97;
  const buyConfirmed = hasConfirmation(events, 'bullish');
  const sellConfirmed = hasConfirmation(events, 'bearish');
  const buyQualified = bullish >= 50 && bullish - bearish >= 22 && buyConfirmed && !tooExtended && !breakingDown;
  const sellQualified = bearish >= 50 && bearish - bullish >= 22 && sellConfirmed;

  if (!buyQualified && !sellQualified) return null;

  if (buyQualified) {
    const names = sortedNames(events, 'bullish');
    const score = clamp(Math.round(bullish - bearish * 0.45), 55, 96);
    return {
      type: 'buy',
      sourceIndex: index,
      date: data[index].date,
      price: close,
      score,
      strength: score >= 72 ? 'strong' : 'medium',
      title: score >= 72 ? '高置信买点' : '观察买点',
      reason: names.join(' + '),
      tags: names,
      action: `仅在${formatPrice(Math.max(low20, ma20 * 0.97))}~${formatPrice(close)}区间分批，跌破${formatPrice(ma20 * 0.96)}撤退。`,
    };
  }

  const names = sortedNames(events, 'bearish');
  const score = clamp(Math.round(bearish - bullish * 0.45), 55, 96);
  return {
    type: 'sell',
    sourceIndex: index,
    date: data[index].date,
    price: close,
    score,
    strength: score >= 72 ? 'strong' : 'medium',
    title: score >= 72 ? '高置信卖点' : '减仓信号',
    reason: names.join(' + '),
    tags: names,
    action: `反弹不能收复${formatPrice(Math.min(high20, ma20 * 1.04))}先减仓，跌破${formatPrice(ma20 * 0.96)}控风险。`,
  };
}

function compactSignals(signals: ScoredSignal[]) {
  const result: ScoredSignal[] = [];
  for (const signal of signals) {
    const last = result[result.length - 1];
    if (last && last.type === signal.type && signal.sourceIndex - last.sourceIndex <= 6) {
      if (signal.score > last.score) result[result.length - 1] = signal;
      continue;
    }
    result.push(signal);
  }
  return result.map(({ sourceIndex, ...signal }) => signal);
}

export function buildTechnicalSignalReport(data: KlineData[]): TechnicalSignalReport {
  if (data.length < 80) {
    return {
      score: 0,
      bias: 'neutral',
      verdict: '样本不足，暂不生成专业买卖点。',
      action: '补足至少80根K线后再评估。',
      risk: '样本不足。',
      buyPlan: '-',
      sellPlan: '-',
      events: [],
      signals: [],
    };
  }

  const indicators = buildIndicatorSet(data);
  const rawSignals: ScoredSignal[] = [];
  for (let index = 60; index < data.length; index++) {
    const events = buildEvents(data, indicators, index);
    const signal = buildSignal(data, indicators, index, events);
    if (signal) rawSignals.push(signal);
  }

  const latestIndex = data.length - 1;
  const latestEvents = buildEvents(data, indicators, latestIndex);
  const { bullish, bearish, net } = scoreEvents(latestEvents);
  const latest = data[latestIndex];
  const ma20 = valueAt(indicators.ma20, latestIndex, latest.close);
  const high20 = recentHigh(data, latestIndex, 20);
  const low20 = recentLow(data, latestIndex, 20);
  const bias: TechnicalBias = net >= 24 && latest.close >= ma20
    ? 'bullish'
    : net <= -24 || latest.close < ma20 * 0.96
      ? 'bearish'
      : 'neutral';
  const verdict = bias === 'bullish'
    ? '多指标偏多，但仍按回踩和突破条件执行。'
    : bias === 'bearish'
      ? '技术面偏弱，反弹先看减仓或等待重新站回关键均线。'
      : '指标分歧，当前更适合等待共振信号。';
  const action = bias === 'bullish'
    ? `回踩不破${formatPrice(Math.max(low20, ma20 * 0.97))}可分批，放量突破${formatPrice(high20)}可跟随。`
    : bias === 'bearish'
      ? `跌破${formatPrice(ma20 * 0.96)}控仓，站回${formatPrice(ma20)}前不追高。`
      : `等待MACD、KDJ、量能至少两项同向，区间${formatPrice(low20)}~${formatPrice(high20)}。`;
  const risk = bearish > bullish * 0.8
    ? '空头信号接近或超过多头信号，仓位要保守。'
    : latest.close > ma20 * 1.1
      ? '价格偏离MA20较大，追高风险上升。'
      : '风险可控，但仍以触发价执行。';

  return {
    score: net,
    bias,
    verdict,
    action,
    risk,
    buyPlan: `买点只认共振：MACD、KDJ、RSI、量能至少两项转多，且价格不跌破${formatPrice(ma20 * 0.96)}。`,
    sellPlan: '卖点优先级：高位死叉、放量跌破MA20、BOLL上轨失败，任两项出现先降仓。',
    events: latestEvents.sort((a, b) => b.weight - a.weight),
    signals: compactSignals(rawSignals).slice(-80),
  };
}
