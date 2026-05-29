import { getStockList, type StockListItem } from './mockData';
import { scoreStrategyStock, type StrategyTag } from './strategyScreener';

export interface IndustryHeat {
  industry: string;
  count: number;
  rising: number;
  heat: number;
  avgChange: number;
  topCode: string;
  topName: string;
  topScore: number;
}

export interface MarketScannerReport {
  total: number;
  rising: number;
  falling: number;
  flat: number;
  heat: number;
  strongCount: number;
  weakCount: number;
  highRiskCount: number;
  strategyCounts: Record<StrategyTag, number>;
  hotIndustries: IndustryHeat[];
  riskIndustries: IndustryHeat[];
  notes: string[];
}

function pct(value: number) {
  return +value.toFixed(2);
}

function buildIndustryHeat(stocks: StockListItem[]) {
  const groups = new Map<string, StockListItem[]>();
  stocks.forEach(stock => {
    const key = stock.industry || '未分类';
    groups.set(key, [...(groups.get(key) || []), stock]);
  });

  return Array.from(groups.entries()).map(([industry, items]) => {
    const scored = items.map(stock => ({ stock, pick: scoreStrategyStock(stock) }));
    const top = scored.sort((a, b) => b.pick.score - a.pick.score || b.stock.changePct - a.stock.changePct)[0];
    const rising = items.filter(stock => stock.changePct > 0).length;
    const avgChange = items.reduce((sum, stock) => sum + stock.changePct, 0) / Math.max(items.length, 1);
    return {
      industry,
      count: items.length,
      rising,
      heat: Math.round(rising / Math.max(items.length, 1) * 100),
      avgChange: pct(avgChange),
      topCode: top?.stock.code || '',
      topName: top?.stock.name || '-',
      topScore: top?.pick.score || 0,
    };
  }).filter(item => item.count >= 3);
}

export function buildMarketScanner(): MarketScannerReport {
  const stocks = getStockList().filter(stock => stock.price > 0);
  const picks = stocks.map(stock => scoreStrategyStock(stock));
  const rising = stocks.filter(stock => stock.changePct > 0).length;
  const falling = stocks.filter(stock => stock.changePct < 0).length;
  const strongCount = stocks.filter(stock => stock.changePct >= 5).length;
  const weakCount = stocks.filter(stock => stock.changePct <= -5).length;
  const highRiskCount = picks.filter(pick => pick.riskLevel === 'high').length;
  const heat = Math.round(rising / Math.max(stocks.length, 1) * 100);
  const strategyCounts = picks.reduce((acc, pick) => {
    acc[pick.strategy] = (acc[pick.strategy] || 0) + 1;
    return acc;
  }, { 龙头突破: 0, 共振低吸: 0, 量价突破: 0, 趋势回踩: 0, 观察: 0 } as Record<StrategyTag, number>);
  const industryHeat = buildIndustryHeat(stocks);
  const hotIndustries = [...industryHeat]
    .sort((a, b) => b.heat - a.heat || b.avgChange - a.avgChange || b.topScore - a.topScore)
    .slice(0, 6);
  const riskIndustries = [...industryHeat]
    .sort((a, b) => a.heat - b.heat || a.avgChange - b.avgChange)
    .slice(0, 5);
  const notes = [
    heat >= 65 ? '全市场赚钱效应偏强，可优先看放量突破与龙头延续。' : heat <= 35 ? '市场偏弱，仓位应收缩，低吸也要等确认。' : '市场分化，按行业热度和个股触发价筛选。',
    strongCount > weakCount * 1.5 ? '强势股数量明显多于大跌股，短线风险偏可控。' : weakCount > strongCount ? '大跌股数量压过强势股，避免无计划抄底。' : '涨跌结构接近平衡，重点看策略分和止损距离。',
    highRiskCount > stocks.length * 0.5 ? '高风险候选占比较高，Top10 也需要压低单票仓位。' : '高风险候选占比可控，策略池可继续精选。',
  ];

  return {
    total: stocks.length,
    rising,
    falling,
    flat: stocks.length - rising - falling,
    heat,
    strongCount,
    weakCount,
    highRiskCount,
    strategyCounts,
    hotIndustries,
    riskIndustries,
    notes,
  };
}
