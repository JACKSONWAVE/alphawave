import {
  calcBOLL,
  calcKDJ,
  calcMA,
  calcMACD,
  calcRSI,
  type KlineData,
} from './mockData';
import { formatPrice } from './price';

export type TimeframeLabel = '日线' | '周线' | '月线';
export type TimeframeBias = 'bullish' | 'neutral' | 'bearish';

export interface TimeframeView {
  label: TimeframeLabel;
  bias: TimeframeBias;
  score: number;
  close: number;
  ma20: number;
  ma60: number;
  notes: string[];
}

export interface MultiTimeframeReport {
  score: number;
  bias: TimeframeBias;
  confidence: number;
  alignment: '三周期共振' | '双周期共振' | '分歧观察' | '空头压制';
  action: string;
  risk: string;
  views: TimeframeView[];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lastValue(values: Array<number | null> | number[], fallback: number) {
  for (let index = values.length - 1; index >= 0; index--) {
    const value = values[index];
    if (value !== null && value !== undefined && !Number.isNaN(value)) return value;
  }
  return fallback;
}

function latestCrossScore(line: number[], signal: number[]) {
  const index = line.length - 1;
  if (index <= 0) return 0;
  if (line[index] > signal[index] && line[index - 1] <= signal[index - 1]) return 14;
  if (line[index] < signal[index] && line[index - 1] >= signal[index - 1]) return -14;
  return line[index] >= signal[index] ? 8 : -8;
}

export function compressKline(data: KlineData[], size: number): KlineData[] {
  if (size <= 1) return data;
  const result: KlineData[] = [];
  for (let index = 0; index < data.length; index += size) {
    const group = data.slice(index, index + size);
    if (!group.length) continue;
    result.push({
      date: group[group.length - 1].date,
      open: group[0].open,
      high: Math.max(...group.map(item => item.high)),
      low: Math.min(...group.map(item => item.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, item) => sum + item.volume, 0),
      amount: group.reduce((sum, item) => sum + item.amount, 0),
    });
  }
  return result;
}

function analyzeTimeframe(data: KlineData[], label: TimeframeLabel): TimeframeView {
  const latest = data[data.length - 1];
  if (!latest || data.length < 30) {
    return {
      label,
      bias: 'neutral',
      score: 0,
      close: latest?.close || 0,
      ma20: latest?.close || 0,
      ma60: latest?.close || 0,
      notes: ['样本不足，暂不参与共振判断'],
    };
  }

  const close = latest.close;
  const ma20 = lastValue(calcMA(data, 20), close);
  const ma60 = lastValue(calcMA(data, 60), ma20);
  const ma20Prev = lastValue(calcMA(data.slice(0, -5), 20), ma20);
  const macd = calcMACD(data);
  const kdj = calcKDJ(data);
  const rsi = lastValue(calcRSI(data), 50);
  const boll = calcBOLL(data);
  const bollMid = lastValue(boll.mid, ma20);
  const k = lastValue(kdj.k, 50);
  const d = lastValue(kdj.d, 50);

  let score = 0;
  const notes: string[] = [];

  if (close >= ma20) {
    score += 12;
    notes.push(`收盘站上MA20 ${formatPrice(ma20)}`);
  } else {
    score -= 12;
    notes.push(`收盘低于MA20 ${formatPrice(ma20)}`);
  }

  if (ma20 >= ma60) {
    score += 14;
    notes.push('MA20位于MA60上方');
  } else {
    score -= 14;
    notes.push('MA20仍受MA60压制');
  }

  if (ma20 >= ma20Prev) {
    score += 8;
    notes.push('MA20斜率向上');
  } else {
    score -= 8;
    notes.push('MA20斜率走弱');
  }

  const macdScore = latestCrossScore(macd.dif, macd.dea);
  score += macdScore;
  notes.push(macdScore >= 0 ? 'MACD在多头侧' : 'MACD在空头侧');

  if (k >= d && k <= 82) {
    score += 8;
    notes.push('KDJ保持修复');
  } else if (k < d || k > 88) {
    score -= 8;
    notes.push(k > 88 ? 'KDJ高位过热' : 'KDJ转弱');
  }

  if (rsi >= 45 && rsi <= 68) {
    score += 8;
    notes.push(`RSI健康区 ${rsi.toFixed(1)}`);
  } else if (rsi > 76 || rsi < 35) {
    score -= 7;
    notes.push(rsi > 76 ? `RSI过热 ${rsi.toFixed(1)}` : `RSI偏弱 ${rsi.toFixed(1)}`);
  }

  if (close >= bollMid) {
    score += 6;
    notes.push('价格在BOLL中轨上方');
  } else {
    score -= 6;
    notes.push('价格未收复BOLL中轨');
  }

  const finalScore = clamp(Math.round(score), -100, 100);
  return {
    label,
    bias: finalScore >= 24 ? 'bullish' : finalScore <= -24 ? 'bearish' : 'neutral',
    score: finalScore,
    close,
    ma20,
    ma60,
    notes,
  };
}

export function buildMultiTimeframeReport(data: KlineData[]): MultiTimeframeReport {
  const cleanData = data.filter(item => item.close > 0);
  const daily = analyzeTimeframe(cleanData.slice(-250), '日线');
  const weekly = analyzeTimeframe(compressKline(cleanData, 5).slice(-160), '周线');
  const monthly = analyzeTimeframe(compressKline(cleanData, 20).slice(-100), '月线');
  const views = [daily, weekly, monthly];
  const score = clamp(Math.round(daily.score * 0.45 + weekly.score * 0.35 + monthly.score * 0.2), -100, 100);
  const bullishCount = views.filter(view => view.bias === 'bullish').length;
  const bearishCount = views.filter(view => view.bias === 'bearish').length;
  const bias: TimeframeBias = score >= 24 && bullishCount >= 2 ? 'bullish' : score <= -24 || bearishCount >= 2 ? 'bearish' : 'neutral';
  const alignment = bullishCount === 3
    ? '三周期共振'
    : bullishCount >= 2 && bearishCount === 0
      ? '双周期共振'
      : bearishCount >= 2
        ? '空头压制'
        : '分歧观察';
  const confidence = clamp(Math.round(Math.abs(score) * 0.7 + Math.max(bullishCount, bearishCount) * 10), 20, 92);
  const action = bias === 'bullish'
    ? '日周至少双周期偏多，只在回踩不破或放量突破时执行。'
    : bias === 'bearish'
      ? '多周期偏空，反弹先按减仓和止损处理。'
      : '周期之间仍有分歧，等待日线与周线同向再提高仓位。';
  const risk = bearishCount > 0
    ? '存在高一级别压制，低周期买点需要降低仓位。'
    : score > 55
      ? '共振较强但要防短线过热，突破后看回踩确认。'
      : '风险中性，按计划价执行，不做盘中情绪单。';

  return { score, bias, confidence, alignment, action, risk, views };
}
