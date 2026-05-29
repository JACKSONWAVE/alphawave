import { getCoreStockList, getMarketIndex, type KlineData } from './mockData';
import { formatPct } from './price';

export interface MarketContext {
  regime: 'risk_on' | 'neutral' | 'risk_off';
  heat: number;
  summary: string;
  sectorName: string;
  sectorChange: number;
  sectorRank: string;
  riskBudget: string;
  marketNotes: string[];
  sectorNotes: string[];
  macroRisks: string[];
  tradeDiscipline: string[];
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function buildMarketContext(code: string, data: KlineData[]): MarketContext {
  const indexes = getMarketIndex();
  const stocks = getCoreStockList();
  const stock = stocks.find(item => item.code === code);
  const sectorPeers = stocks.filter(item => item.industry === stock?.industry);
  const marketChange = avg(indexes.map(index => index.changePct || 0));
  const sectorChange = avg(sectorPeers.map(item => item.changePct || 0));
  const last = data[data.length - 1];
  const prev = data[data.length - 2] || last;
  const stockChange = prev?.close ? (last.close - prev.close) / prev.close * 100 : 0;
  const relativeStrength = stockChange - marketChange;
  const totalVolumeProxy = indexes.reduce((sum, index) => sum + Math.abs(index.price * (index.changePct || 0)), 0);
  const heat = Math.max(0, Math.min(100, Math.round(50 + marketChange * 9 + sectorChange * 5 + relativeStrength * 3)));
  const regime = heat >= 62 ? 'risk_on' : heat <= 42 ? 'risk_off' : 'neutral';
  const sectorRank = sectorChange >= marketChange + 1 ? '强于大盘' : sectorChange <= marketChange - 1 ? '弱于大盘' : '跟随大盘';
  const riskBudget = regime === 'risk_on'
    ? '底仓可持有，波段仓最多30%，追高只允许小仓试错'
    : regime === 'risk_off'
      ? '底仓保护优先，波段仓暂停加仓，跌破止损先降风险'
      : '维持中性仓位，只在计划买区或突破确认后行动';

  const summary = regime === 'risk_on'
    ? '市场热度偏高，持仓可以顺势，但连续放量大涨后要警惕一致性过热'
    : regime === 'risk_off'
      ? '市场防守优先，个股信号需要等待大盘和行业止跌确认'
      : '市场处在中性区间，适合按个股计划做高胜率位置';

  return {
    regime,
    heat,
    summary,
    sectorName: stock?.industry || '当前行业',
    sectorChange,
    sectorRank,
    riskBudget,
    marketNotes: [
      `主要指数平均涨跌 ${formatPct(marketChange)}，个股相对强弱 ${formatPct(relativeStrength)}`,
      totalVolumeProxy > 12000 ? '成交热度偏高，连续放量大涨后需要警惕一致性过热' : '成交热度未到极端区，策略仍以价位触发为主',
      '若指数连续放量上涨后缩量滞涨，优先降低追高仓位并上移止损',
      '若成交额进入3.5万亿/4万亿级别，系统应从进攻切到“保护利润+减少追高”',
    ],
    sectorNotes: [
      `${stock?.industry || '当前行业'} 今日均值 ${formatPct(sectorChange)}，状态：${sectorRank}`,
      '预警股触发买点时，若同板块多数个股走弱，则信号降级为观察',
      '行业强于大盘且个股强于行业时，突破信号才允许提高优先级',
    ],
    macroRisks: [
      '地缘冲突、能源价格急涨、汇率波动会压制高估值科技成长股',
      '如果外围风险升温但A股放量冲高回落，优先保护已有利润而不是加仓',
      '黑天鹅无法预测，但可以用大盘热度、行业强弱和止损纪律降低冲击',
    ],
    tradeDiscipline: [
      '核心仓偏中期，按月级别趋势持有；波段仓只在计划区和突破确认后行动',
      '短线做几天到几周，必须提前定义触发价、止损价和止盈区',
      '激进追高只允许小仓位试错，必须用当日低点或计划止损约束风险',
      riskBudget,
    ],
  };
}
