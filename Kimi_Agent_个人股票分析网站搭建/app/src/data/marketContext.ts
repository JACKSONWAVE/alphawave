import { getMarketIndex, getStockList, type KlineData } from './mockData';
import { formatPct } from './price';

export interface MarketContext {
  regime: 'risk_on' | 'neutral' | 'risk_off';
  heat: number;
  summary: string;
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
  const stock = getStockList().find(item => item.code === code);
  const marketChange = avg(indexes.map(index => index.changePct || 0));
  const last = data[data.length - 1];
  const prev = data[data.length - 2] || last;
  const stockChange = prev?.close ? (last.close - prev.close) / prev.close * 100 : 0;
  const relativeStrength = stockChange - marketChange;
  const totalVolumeProxy = indexes.reduce((sum, index) => sum + Math.abs(index.price * (index.changePct || 0)), 0);
  const heat = Math.max(0, Math.min(100, Math.round(50 + marketChange * 9 + relativeStrength * 4)));
  const regime = heat >= 62 ? 'risk_on' : heat <= 42 ? 'risk_off' : 'neutral';

  const summary = regime === 'risk_on'
    ? '市场热度偏高，持仓可以顺势，但追高需要降低单笔仓位'
    : regime === 'risk_off'
      ? '市场防守优先，个股信号需要等待大盘止跌确认'
      : '市场处在中性区间，适合按个股计划做高胜率位置';

  return {
    regime,
    heat,
    summary,
    marketNotes: [
      `主要指数平均涨跌 ${formatPct(marketChange)}，个股相对强弱 ${formatPct(relativeStrength)}`,
      totalVolumeProxy > 12000 ? '成交热度偏高，连续放量大涨后需要警惕一致性过热' : '成交热度未到极端区，策略仍以价位触发为主',
      '若指数连续放量上涨后缩量滞涨，优先降低追高仓位并上移止损',
    ],
    sectorNotes: [
      `${stock?.industry || '当前行业'} 需要和指数同看：行业强于大盘时才提高买入优先级`,
      '预警股触发买点时，若同板块多数个股走弱，则信号降级为观察',
    ],
    macroRisks: [
      '地缘冲突、能源价格急涨、汇率波动会压制高估值科技成长股',
      '市场成交额极端放大后，若指数冲高回落，优先保护利润而不是加仓',
    ],
    tradeDiscipline: [
      '核心仓偏中期，按月级别趋势持有；波段仓只在计划区和突破确认后行动',
      '激进追高只允许小仓位试错，必须用当日低点或计划止损约束风险',
    ],
  };
}
