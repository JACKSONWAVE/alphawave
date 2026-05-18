// ============================================================
// 个股深度分析引擎 - 中期波段操作策略
// 适用：持股10天~数月的波段操作
// ============================================================

import { getKlineData, calcMA, calcMACD, calcRSI, calcKDJ, calcBOLL, calcCCI, calcWR, getTrend, type KlineData } from './mockData';
import type { RealtimeQuote } from './realtimeApi';

// ── 支撑位/压力位计算 ──
export interface SupportResistance {
  strongSupport: number;   // 强支撑
  weakSupport: number;     // 弱支撑
  currentPrice: number;    // 当前价
  weakResistance: number;  // 弱压力
  strongResistance: number;// 强压力
  targetPrice: number;     // 目标价位
  stopLoss: number;        // 止损位
}

export function calcSupportResistance(data: KlineData[]): SupportResistance {
  const closes = data.map(d => d.close);
  const current = closes[closes.length - 1];
  const period = Math.min(60, closes.length);
  const recent = closes.slice(-period);
  
  // 强支撑/压力：取近60日的极值
  const strongSupport = Math.min(...recent);
  const strongResistance = Math.max(...recent);
  
  // 弱支撑/压力：基于成交量加权的价格分布
  const volumes = data.slice(-period).map(d => d.volume);
  const totalVol = volumes.reduce((a, b) => a + b, 0);
  const vwap = data.slice(-period).reduce((sum, d) => sum + d.close * d.volume, 0) / totalVol;
  
  const weakSupport = Math.max(strongSupport, vwap * 0.96);
  const weakResistance = Math.min(strongResistance, vwap * 1.04);
  
  // 中期目标价：基于前期高点和均线趋势
  const ma20 = calcMA(data, 20);
  const ma60 = calcMA(data, 60);
  const lastMA20 = ma20[ma20.length - 1] || current;
  const lastMA60 = ma60[ma60.length - 1] || current;
  
  // 如果上升趋势，目标设在压力位附近；如果下降，目标设在弱阻力
  const trendUp = lastMA20 > (lastMA60 * 1.02);
  const targetPrice = trendUp 
    ? strongResistance * 0.95  // 接近前高
    : weakResistance * 0.98;   // 保守目标
    
  // 止损位：基于ATR（平均真实波幅）
  const atr = calcATR(data, 14);
  const stopLoss = current - atr * 2.5;
  
  return {
    strongSupport: +strongSupport.toFixed(3),
    weakSupport: +weakSupport.toFixed(3),
    currentPrice: +current.toFixed(3),
    weakResistance: +weakResistance.toFixed(3),
    strongResistance: +strongResistance.toFixed(3),
    targetPrice: +targetPrice.toFixed(3),
    stopLoss: +Math.max(stopLoss, strongSupport * 0.95).toFixed(3),
  };
}

// ATR计算
function calcATR(data: KlineData[], period: number): number {
  if (data.length < period + 1) return data[data.length - 1].close * 0.02;
  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close)
    );
    sum += tr;
  }
  return sum / period;
}

// ── 多指标综合评分 ──
export interface IndicatorScore {
  macdScore: number;   // -100~100
  rsiScore: number;    // -100~100
  kdjScore: number;    // -100~100
  bollScore: number;   // -100~100
  maScore: number;     // -100~100
  cciScore: number;    // -100~100
  overall: number;     // -100~100
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
}

export function calcIndicatorScore(data: KlineData[]): IndicatorScore {
  const i = data.length - 1;
  const { dif, dea } = calcMACD(data);
  const rsi = calcRSI(data, 14);
  const { k, d } = calcKDJ(data);
  const boll = calcBOLL(data);
  const cci = calcCCI(data);
  const ma5 = calcMA(data, 5);
  const ma10 = calcMA(data, 10);
  const ma20 = calcMA(data, 20);
  const ma60 = calcMA(data, 60);

  // MACD评分：DIF>DEA为正向，差值越大越强烈
  const macdDiff = dif[i] - dea[i];
  const macdScore = Math.max(-100, Math.min(100, macdDiff * 200));

  // RSI评分：50为中性，<30超卖(正向)，>70超买(负向)
  const rsiVal = rsi[i] || 50;
  const rsiScore = rsiVal < 30 ? (30 - rsiVal) * 3.3 : rsiVal > 70 ? (70 - rsiVal) * 3.3 : (rsiVal - 50) * 1;

  // KDJ评分：K>D正向，K<30超卖(强正向)
  const kVal = k[i] || 50;
  const dVal = d[i] || 50;
  const kdjDiff = (kVal as number) - (dVal as number);
  let kdjScore = kdjDiff * 5;
  if (kVal < 20) kdjScore += 30;
  if (kVal > 80) kdjScore -= 30;
  kdjScore = Math.max(-100, Math.min(100, kdjScore));

  // 布林带评分：接近下轨正向，接近上轨负向
  const close = data[i].close;
  let bollScore = 0;
  if (boll.upper[i] && boll.lower[i]) {
    const mid = (boll.upper[i]! + boll.lower[i]!) / 2;
    const range = boll.upper[i]! - boll.lower[i]!;
    bollScore = range > 0 ? ((mid - close) / range * 200) : 0;
  }
  bollScore = Math.max(-100, Math.min(100, bollScore));

  // 均线评分：多头排列正向
  let maScore = 0;
  if (ma5[i] && ma10[i]) {
    const ma5Val = ma5[i]!;
    const ma10Val = ma10[i]!;
    const ma20Val = ma20[i] || ma10Val;
    const ma60Val = ma60[i] || ma20Val;
    // 多头排列加分
    if (ma5Val > ma10Val && ma10Val > ma20Val) maScore = 40;
    else if (ma5Val > ma10Val) maScore = 20;
    else if (ma5Val < ma10Val && ma10Val < ma20Val) maScore = -40;
    else if (ma5Val < ma10Val) maScore = -20;
    // 突破60日线
    if (close > (ma60Val * 1.02)) maScore += 20;
    else if (close < (ma60Val * 0.98)) maScore -= 20;
  }

  // CCI评分：<-100超卖正向，>100超买负向
  const cciVal = cci[i] || 0;
  const cciScore = cciVal < -100 ? Math.min(100, (-100 - cciVal) * 1) : cciVal > 100 ? Math.max(-100, (100 - cciVal) * 1) : cciVal;

  // 综合评分（加权）
  const overall = Math.round(
    macdScore * 0.20 + 
    rsiScore * 0.15 + 
    kdjScore * 0.15 + 
    bollScore * 0.15 + 
    maScore * 0.20 + 
    cciScore * 0.15
  );

  let signal: IndicatorScore['signal'] = 'neutral';
  if (overall >= 60) signal = 'strong_buy';
  else if (overall >= 30) signal = 'buy';
  else if (overall <= -60) signal = 'strong_sell';
  else if (overall <= -30) signal = 'sell';

  return {
    macdScore: Math.round(macdScore),
    rsiScore: Math.round(rsiScore),
    kdjScore: Math.round(kdjScore),
    bollScore: Math.round(bollScore),
    maScore: Math.round(maScore),
    cciScore: Math.round(cciScore),
    overall,
    signal,
  };
}

// ── 当日行情分析 ──
export interface DailyAnalysis {
  priceChange: string;       // 价格变动描述
  volumeStatus: string;      // 量能状态
  keyEvent: string;          // 今日关键事件
  sectorRank: string;        // 板块排名
  recommendation: string;    // 操作建议
  riskLevel: 'low' | 'medium' | 'high'; // 风险等级
}

export function analyzeDaily(data: KlineData[], quote?: RealtimeQuote): DailyAnalysis {
  const today = data[data.length - 1];
  const yesterday = data[data.length - 2];
  const prev5 = data[data.length - 6];
  const changePct = quote ? quote.changePct : ((today.close - yesterday.close) / yesterday.close * 100);
  const volumeRatio = today.volume / (data.slice(-6, -1).reduce((s, d) => s + d.volume, 0) / 5);

  // 价格变动
  let priceChange = '';
  if (changePct > 5) priceChange = `📈 大涨 ${changePct.toFixed(2)}%，突破前期平台`;
  else if (changePct > 2) priceChange = `📈 中涨 ${changePct.toFixed(2)}%，多头强势`;
  else if (changePct > 0) priceChange = `📈 小涨 ${changePct.toFixed(2)}%，温和上行`;
  else if (changePct > -2) priceChange = `📉 小跌 ${changePct.toFixed(2)}%，正常回调`;
  else if (changePct > -5) priceChange = `📉 中跌 ${changePct.toFixed(2)}%，需要关注`;
  else priceChange = `📉 大跌 ${changePct.toFixed(2)}%，风险较大`;

  // 量能
  let volumeStatus = '';
  if (volumeRatio > 2) volumeStatus = '🔥 放量明显，资金关注度极高';
  else if (volumeRatio > 1.5) volumeStatus = '🔥 温和放量，资金流入';
  else if (volumeRatio > 0.8) volumeStatus = '⚖️ 量能平稳，正常波动';
  else volumeStatus = '❄️ 缩量整理，观望情绪浓';

  // 关键事件
  const ma20 = calcMA(data, 20);
  const ma60 = calcMA(data, 60);
  const lastMA20 = ma20[ma20.length - 1];
  const lastMA60 = ma60[ma60.length - 1];
  const high20 = Math.max(...data.slice(-20).map(d => d.high));
  
  let keyEvent = '';
  if (today.close > high20) keyEvent = '🎯 突破20日新高，趋势转强';
  else if (lastMA20 && today.close > lastMA20 && yesterday.close <= (ma20[ma20.length - 2] || 0)) keyEvent = '📊 站上20日均线，中期趋势好转';
  else if (lastMA60 && today.close > lastMA60 && yesterday.close <= (ma60[ma60.length - 2] || 0)) keyEvent = '📊 站上60日均线，中长期趋势好转';
  else if (today.close < (lastMA20 || 0) * 0.97) keyEvent = '⚠️ 跌破20日均线支撑';
  else keyEvent = '⚖️ 正常波动，无重大技术信号';

  // 风险等级
  let riskLevel: DailyAnalysis['riskLevel'] = 'low';
  if (Math.abs(changePct) > 5 || volumeRatio > 3) riskLevel = 'high';
  else if (Math.abs(changePct) > 3 || volumeRatio > 2) riskLevel = 'medium';

  // 操作建议
  let recommendation = '';
  if (changePct > 3 && volumeRatio > 1.5) recommendation = '💡 建议：如已持仓可继续持有；未持仓等回调至20日线附近再考虑';
  else if (changePct < -3 && volumeRatio > 1.5) recommendation = '💡 建议：密切关注支撑位，跌破则减仓；如已大幅回调可考虑分批低吸';
  else if (lastMA20 && today.close > lastMA20 && volumeRatio > 1) recommendation = '💡 建议：趋势向好，可持仓或逢低加仓';
  else recommendation = '💡 建议：中期持仓为主，等待明确信号再操作';

  return { priceChange, volumeStatus, keyEvent, sectorRank: '', recommendation, riskLevel };
}

// ── 完整分析报告生成（用于飞书推送） ──
export interface FullAnalysisReport {
  code: string;
  name: string;
  price: number;
  changePct: number;
  supportResistance: SupportResistance;
  score: IndicatorScore;
  daily: DailyAnalysis;
  strategy: string;  // 中期波段策略
  timestamp: string;
}

export function generateFullReport(code: string, name: string, quote?: RealtimeQuote): FullAnalysisReport {
  const data = getKlineData(code, 120);
  const price = quote?.price || data[data.length - 1].close;
  const changePct = quote?.changePct || 0;
  
  const sr = calcSupportResistance(data);
  const score = calcIndicatorScore(data);
  const daily = analyzeDaily(data, quote);
  
  // 中期策略
  const strategy = generateMidTermStrategy(sr, score, daily);
  
  return {
    code, name, price, changePct,
    supportResistance: sr,
    score,
    daily,
    strategy,
    timestamp: new Date().toLocaleString('zh-CN'),
  };
}

function generateMidTermStrategy(sr: SupportResistance, score: IndicatorScore, daily: DailyAnalysis): string {
  const parts: string[] = [];
  
  parts.push(`【中期波段策略】`);
  parts.push(`当前位置：${sr.currentPrice}元`);
  parts.push(`强支撑：${sr.strongSupport} | 弱支撑：${sr.weakSupport}`);
  parts.push(`弱压力：${sr.weakResistance} | 强压力：${sr.strongResistance}`);
  parts.push(`目标价：${sr.targetPrice} | 止损位：${sr.stopLoss}`);
  parts.push(``);
  parts.push(`综合评分：${score.overall}/100 (${signalToText(score.signal)})`);
  parts.push(`MACD:${score.macdScore} RSI:${score.rsiScore} KDJ:${score.kdjScore} MA:${score.maScore} BOLL:${score.bollScore}`);
  parts.push(``);
  
  // 买卖建议
  if (score.signal === 'strong_buy' || score.signal === 'buy') {
    parts.push(`📌 买入策略：`);
    parts.push(`- 如未持仓：可在 ${sr.weakSupport}~${sr.currentPrice} 区间分批建仓`);
    parts.push(`- 如已持仓：继续持有，目标 ${sr.targetPrice}，止损 ${sr.stopLoss}`);
  } else if (score.signal === 'strong_sell' || score.signal === 'sell') {
    parts.push(`📌 卖出策略：`);
    parts.push(`- 跌破 ${sr.weakSupport} 减仓50%`);
    parts.push(`- 跌破 ${sr.strongSupport} 清仓`);
    parts.push(`- 反弹至 ${sr.weakResistance} 可考虑减仓`);
  } else {
    parts.push(`📌 观望策略：`);
    parts.push(`- 等待明确方向，回调至 ${sr.weakSupport} 附近可考虑低吸`);
    parts.push(`- 突破 ${sr.weakResistance} 可考虑追入`);
  }
  
  parts.push(``);
  parts.push(`⚠️ 风险提示：${daily.riskLevel === 'high' ? '高波动，控制仓位' : daily.riskLevel === 'medium' ? '中度波动，注意节奏' : '低波动，安心持仓'}`);
  
  return parts.join('\n');
}

function signalToText(s: IndicatorScore['signal']): string {
  const map = { strong_buy: '强烈看多', buy: '看多', neutral: '中性', sell: '看空', strong_sell: '强烈看空' };
  return map[s];
}

// ── 飞书消息格式化 ──
export function formatFeishuReport(report: FullAnalysisReport): string {
  const up = report.changePct >= 0;
  const sr = report.supportResistance;
  const s = report.score;
  
  let md = `## 📊 ${report.name} (${report.code}) 波段分析\n\n`;
  md += `**${up ? '📈' : '📉'} 现价 ${report.price.toFixed(2)} ${up ? '+' : ''}${report.changePct.toFixed(2)}%**\n\n`;
  
  md += `**综合评分：${s.overall}/100** ${s.overall >= 30 ? '🟢' : s.overall <= -30 ? '🔴' : '🟡'}\n`;
  md += `信号：**${signalToText(s.signal)}**\n\n`;
  
  md += `---\n`;
  md += `### 📐 关键价位\n\n`;
  md += `- 强支撑：**${sr.strongSupport}**\n`;
  md += `- 弱支撑：**${sr.weakSupport}**\n`;
  md += `- 当前价：**${sr.currentPrice}**\n`;
  md += `- 弱压力：**${sr.weakResistance}**\n`;
  md += `- 强压力：**${sr.strongResistance}**\n`;
  md += `- 🎯 目标价：**${sr.targetPrice}**\n`;
  md += `- 🛑 止损位：**${sr.stopLoss}**\n\n`;
  
  md += `---\n`;
  md += `### 📋 当日分析\n\n`;
  md += `${report.daily.priceChange}\n`;
  md += `${report.daily.volumeStatus}\n`;
  md += `${report.daily.keyEvent}\n\n`;
  md += `${report.daily.recommendation}\n\n`;
  
  md += `---\n`;
  md += `### 🎯 波段策略\n\n`;
  md += `${report.strategy}\n\n`;
  
  md += `---\n*更新时间：${report.timestamp}*`;
  
  return md;
}
