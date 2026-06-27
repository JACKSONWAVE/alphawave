import type { KlineData } from './mockData';
import type { RealtimeQuote } from './realtimeApi';
import type { IntradayPoint } from './realtimeKline';

export type CapitalFlowSource = 'intraday' | 'daily' | 'fallback';
export type CapitalFlowConfidence = '高' | '中' | '低';

export interface CapitalFlowProfile {
  source: CapitalFlowSource;
  confidence: CapitalFlowConfidence;
  dataLabel: string;
  currentPrice: number;
  totalAmountWan: number;
  institutionNetWan: number;
  retailNetWan: number;
  institutionBuyWan: number;
  retailBuyWan: number;
  institutionSharePct: number;
  retailSharePct: number;
  avgCostToday: number;
  avgCost5: number;
  avgCost20: number;
  avgCost60: number;
  priceVsTodayCostPct: number;
  priceVs20CostPct: number;
  profitableChipPct: number;
  overheadAmountWan: number;
  dominant: string;
  action: string;
  notes: string[];
  risks: string[];
}

interface BuildCapitalFlowOptions {
  kline: KlineData[];
  intraday?: IntradayPoint[];
  quote?: RealtimeQuote;
}

const round = (value: number, digits = 2) => +value.toFixed(digits);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function safeAmountWan(day: Pick<KlineData, 'amount' | 'volume' | 'close'>) {
  if (Number.isFinite(day.amount) && day.amount > 0) return day.amount;
  if (Number.isFinite(day.volume) && day.volume > 0 && day.close > 0) return day.volume * day.close / 100;
  return 0;
}

function impliedPrice(day: Pick<KlineData, 'amount' | 'volume' | 'close'>) {
  const amount = safeAmountWan(day);
  if (!amount || !day.volume) return day.close;
  const candidates = [
    amount * 100 / day.volume,
    amount * 10000 / day.volume,
    day.close,
  ].filter(value => Number.isFinite(value) && value > 0);
  return candidates.sort((a, b) => Math.abs(a - day.close) - Math.abs(b - day.close))[0] || day.close;
}

function weightedCost(data: KlineData[], days: number, fallback: number) {
  const slice = data.slice(-days).filter(day => day.close > 0);
  if (!slice.length) return fallback;
  const totalAmount = slice.reduce((sum, day) => sum + safeAmountWan(day), 0);
  if (totalAmount > 0) {
    return slice.reduce((sum, day) => sum + impliedPrice(day) * safeAmountWan(day), 0) / totalAmount;
  }
  return slice.reduce((sum, day) => sum + day.close, 0) / slice.length;
}

function priceVs(price: number, cost: number) {
  return cost > 0 ? (price - cost) / cost * 100 : 0;
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index];
}

function scaleIntradayAmounts(points: IntradayPoint[], quoteAmountWan?: number) {
  const rawAmounts = points.map(point => Math.max(0, point.amount || 0));
  const rawTotal = rawAmounts.reduce((sum, amount) => sum + amount, 0);
  if (!rawTotal) {
    return points.map(point => ({
      ...point,
      amountWan: point.volume && point.price ? point.volume * point.price / 100 : 0,
    }));
  }

  const ratio = quoteAmountWan && quoteAmountWan > 0 ? rawTotal / quoteAmountWan : 1;
  const divisor = ratio > 30 ? 10000 : 1;
  return points.map(point => ({
    ...point,
    amountWan: Math.max(0, (point.amount || 0) / divisor),
  }));
}

function intradayDirection(point: IntradayPoint, previous: IntradayPoint | undefined, runningVwap: number) {
  if (!previous || !previous.price) return point.price >= runningVwap ? 0.35 : -0.35;
  const deltaPct = (point.price - previous.price) / previous.price * 100;
  if (deltaPct > 0.015) return 1;
  if (deltaPct < -0.015) return -1;
  return point.price >= runningVwap ? 0.35 : -0.35;
}

function buildFromIntraday(
  points: IntradayPoint[],
  kline: KlineData[],
  currentPrice: number,
  quote?: RealtimeQuote,
) {
  const scaled = scaleIntradayAmounts(points, quote?.amount);
  const amounts = scaled.map(point => point.amountWan).filter(amount => amount > 0);
  const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);
  const avgAmount = totalAmount / Math.max(amounts.length, 1);
  const p75 = percentile(amounts, 0.75);
  const p9 = percentile(amounts, 0.9);
  const vwap = totalAmount > 0
    ? scaled.reduce((sum, point) => sum + point.price * point.amountWan, 0) / totalAmount
    : currentPrice;

  let runningAmount = 0;
  let runningValue = 0;
  let institutionNet = 0;
  let retailNet = 0;
  let institutionBuy = 0;
  let retailBuy = 0;
  let institutionGross = 0;
  let retailGross = 0;

  scaled.forEach((point, index) => {
    if (!point.amountWan || !point.price) return;
    runningAmount += point.amountWan;
    runningValue += point.price * point.amountWan;
    const runningVwap = runningAmount ? runningValue / runningAmount : point.price;
    const direction = intradayDirection(point, scaled[index - 1], runningVwap);
    const sizeRatio = avgAmount > 0 ? point.amountWan / avgAmount : 1;
    const priceMove = index > 0 && scaled[index - 1].price
      ? Math.abs((point.price - scaled[index - 1].price) / scaled[index - 1].price * 100)
      : 0;
    const activeRate = clamp(0.06 + priceMove * 4.2 + Math.max(0, sizeRatio - 1) * 0.025, 0.06, 0.32);
    const institutionShare = clamp(
      0.38
      + Math.max(-0.12, Math.min(0.2, (sizeRatio - 1) * 0.1))
      + (point.amountWan >= p9 ? 0.12 : point.amountWan >= p75 ? 0.06 : 0)
      + (point.price >= runningVwap ? 0.03 : -0.02),
      0.22,
      0.74,
    );
    const signedNet = direction * point.amountWan * activeRate;
    const inst = signedNet * institutionShare;
    const retail = signedNet * (1 - institutionShare);

    institutionNet += inst;
    retailNet += retail;
    institutionGross += Math.abs(inst);
    retailGross += Math.abs(retail);
    if (inst > 0) institutionBuy += inst;
    if (retail > 0) retailBuy += retail;
  });

  return {
    source: 'intraday' as CapitalFlowSource,
    confidence: points.length >= 120 ? '高' as CapitalFlowConfidence : points.length >= 40 ? '中' as CapitalFlowConfidence : '低' as CapitalFlowConfidence,
    dataLabel: `分时${points.length}笔估算`,
    totalAmountWan: totalAmount || quote?.amount || safeAmountWan(kline[kline.length - 1]),
    institutionNet,
    retailNet,
    institutionBuy,
    retailBuy,
    institutionGross,
    retailGross,
    avgCostToday: vwap || currentPrice,
  };
}

function buildFromDaily(kline: KlineData[], currentPrice: number, quote?: RealtimeQuote) {
  const latest = kline[kline.length - 1];
  const previous = kline[kline.length - 2] || latest;
  const dayAmount = quote?.amount || safeAmountWan(latest);
  const recent = kline.slice(-21, -1);
  const avgAmount = recent.reduce((sum, day) => sum + safeAmountWan(day), 0) / Math.max(recent.length, 1);
  const volumeRatio = avgAmount > 0 ? dayAmount / avgAmount : 1;
  const open = quote?.open || latest.open || previous.close || currentPrice;
  const changePct = quote?.changePct ?? (previous.close ? (currentPrice - previous.close) / previous.close * 100 : 0);
  const intradayPct = open ? (currentPrice - open) / open * 100 : 0;
  const direction = clamp(changePct * 0.65 + intradayPct * 0.35, -8, 8) / 8;
  const activeRate = clamp(0.07 + Math.abs(changePct) * 0.022 + Math.max(0, volumeRatio - 1) * 0.05, 0.05, 0.28);
  const net = dayAmount * direction * activeRate;
  const institutionShare = clamp(
    0.42 + Math.max(-0.08, Math.min(0.2, (volumeRatio - 1) * 0.12)) + (dayAmount > 500000 ? 0.07 : 0),
    0.28,
    0.72,
  );
  const institutionNet = net * institutionShare;
  const retailNet = net * (1 - institutionShare);

  return {
    source: 'daily' as CapitalFlowSource,
    confidence: '低' as CapitalFlowConfidence,
    dataLabel: `日K量价估算`,
    totalAmountWan: dayAmount,
    institutionNet,
    retailNet,
    institutionBuy: Math.max(0, institutionNet),
    retailBuy: Math.max(0, retailNet),
    institutionGross: Math.abs(institutionNet),
    retailGross: Math.abs(retailNet),
    avgCostToday: impliedPrice({ ...latest, close: currentPrice, amount: dayAmount }),
  };
}

function dominantText(institutionNet: number, retailNet: number, priceVsTodayCostPct: number) {
  if (institutionNet > 0 && retailNet < 0) return priceVsTodayCostPct >= 0 ? '机构吸筹，散户兑现' : '机构低位承接';
  if (institutionNet < 0 && retailNet > 0) return '机构派发，散户接盘';
  if (institutionNet > 0 && retailNet > 0) return '资金同步流入';
  if (institutionNet < 0 && retailNet < 0) return '资金同步流出';
  return '资金分歧';
}

function actionText(profile: Pick<CapitalFlowProfile, 'institutionNetWan' | 'retailNetWan' | 'priceVsTodayCostPct' | 'priceVs20CostPct' | 'confidence'>) {
  if (profile.institutionNetWan > 0 && profile.priceVsTodayCostPct >= 0 && profile.priceVs20CostPct >= -2) {
    return profile.confidence === '低'
      ? '资金结构偏正，但样本只够观察，等分时承接确认后再动手。'
      : '机构承接偏强，回踩日内均价不破可按计划低吸，追高仍要看量能。';
  }
  if (profile.institutionNetWan < 0 && profile.priceVsTodayCostPct < 0) {
    return '机构资金偏流出且价格低于日内成本，先防守，反弹到均价附近优先降风险。';
  }
  if (profile.retailNetWan > 0 && profile.institutionNetWan <= 0) {
    return '散户资金更活跃但机构未确认，容易冲高回落，只适合小仓观察。';
  }
  return '资金没有形成单边共识，继续按买区、止损和技术共振执行。';
}

export function buildCapitalFlowProfile(options: BuildCapitalFlowOptions): CapitalFlowProfile {
  const rawKline = options.kline.filter(day => day.close > 0);
  const fallbackPrice = options.quote?.price || rawKline[rawKline.length - 1]?.close || 0;
  const latest = rawKline[rawKline.length - 1] || {
    date: '',
    open: fallbackPrice,
    high: fallbackPrice,
    low: fallbackPrice,
    close: fallbackPrice,
    volume: 0,
    amount: 0,
  };
  const currentPrice = options.quote?.price || latest.close;
  const workingKline = rawKline.length
    ? [...rawKline.slice(0, -1), { ...latest, close: currentPrice, amount: options.quote?.amount || latest.amount, volume: options.quote?.volume || latest.volume }]
    : [latest];
  const intraday = (options.intraday || []).filter(point => point.price > 0);
  const base = intraday.length >= 8
    ? buildFromIntraday(intraday, workingKline, currentPrice, options.quote)
    : buildFromDaily(workingKline, currentPrice, options.quote);

  const avgCost5 = weightedCost(workingKline, 5, currentPrice);
  const avgCost20 = weightedCost(workingKline, 20, currentPrice);
  const avgCost60 = weightedCost(workingKline, 60, currentPrice);
  const chipWindow = workingKline.slice(-120);
  const chipAmount = chipWindow.reduce((sum, day) => sum + safeAmountWan(day), 0);
  const profitableChipAmount = chipWindow.reduce((sum, day) => {
    return sum + (impliedPrice(day) <= currentPrice ? safeAmountWan(day) : 0);
  }, 0);
  const overheadAmount = chipWindow.reduce((sum, day) => {
    const cost = impliedPrice(day);
    return sum + (cost > currentPrice && cost <= currentPrice * 1.08 ? safeAmountWan(day) : 0);
  }, 0);
  const gross = base.institutionGross + base.retailGross;
  const institutionSharePct = gross > 0 ? base.institutionGross / gross * 100 : 50;
  const retailSharePct = 100 - institutionSharePct;
  const priceVsTodayCostPct = priceVs(currentPrice, base.avgCostToday);
  const priceVs20CostPct = priceVs(currentPrice, avgCost20);
  const profitableChipPct = chipAmount > 0 ? profitableChipAmount / chipAmount * 100 : 50;
  const dominant = dominantText(base.institutionNet, base.retailNet, priceVsTodayCostPct);
  const profileForAction = {
    institutionNetWan: base.institutionNet,
    retailNetWan: base.retailNet,
    priceVsTodayCostPct,
    priceVs20CostPct,
    confidence: base.confidence,
  };

  return {
    source: base.source,
    confidence: base.confidence,
    dataLabel: base.dataLabel,
    currentPrice: round(currentPrice, 3),
    totalAmountWan: round(base.totalAmountWan, 0),
    institutionNetWan: round(base.institutionNet, 0),
    retailNetWan: round(base.retailNet, 0),
    institutionBuyWan: round(base.institutionBuy, 0),
    retailBuyWan: round(base.retailBuy, 0),
    institutionSharePct: round(institutionSharePct, 0),
    retailSharePct: round(retailSharePct, 0),
    avgCostToday: round(base.avgCostToday, 3),
    avgCost5: round(avgCost5, 3),
    avgCost20: round(avgCost20, 3),
    avgCost60: round(avgCost60, 3),
    priceVsTodayCostPct: round(priceVsTodayCostPct),
    priceVs20CostPct: round(priceVs20CostPct),
    profitableChipPct: round(profitableChipPct, 0),
    overheadAmountWan: round(overheadAmount, 0),
    dominant,
    action: actionText(profileForAction),
    notes: [
      `今日成交额约${Math.round(base.totalAmountWan).toLocaleString('zh-CN')}万，${base.dataLabel}。`,
      `现价相对日内均价${priceVsTodayCostPct >= 0 ? '高' : '低'}${Math.abs(priceVsTodayCostPct).toFixed(2)}%，相对20日成本${priceVs20CostPct >= 0 ? '高' : '低'}${Math.abs(priceVs20CostPct).toFixed(2)}%。`,
      `近120日估算获利筹码${Math.round(profitableChipPct)}%，上方8%内压力盘约${Math.round(overheadAmount).toLocaleString('zh-CN')}万。`,
    ],
    risks: [
      '机构/散户为量价估算，不是Level-2逐笔账户分类。',
      base.confidence === '低' ? '当前没有足够分时样本，先看方向，不直接按金额下单。' : '若放量但价格跌破均价，说明承接失效，需要降低仓位。',
    ],
  };
}
