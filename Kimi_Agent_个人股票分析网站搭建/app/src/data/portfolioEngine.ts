import { buildBacktestSuite } from './backtestLab';
import { getKlineData, getStockList, type TradeRecord } from './mockData';
import { buildHoldingPositions } from './tradeGuard';
import { isETF } from './etfUniverse';
import { buildDailyStrategyPicks, buildETFStrategyPicks, scoreStrategyStock, type DailyStrategyPick } from './strategyScreener';

export type StrategyLayer = '进攻' | '防守' | 'ETF' | '观察';

export interface LayeredStrategyPool {
  layer: StrategyLayer;
  title: string;
  budgetPct: number;
  maxSinglePct: number;
  trigger: string;
  riskRule: string;
  picks: DailyStrategyPick[];
}

export interface PortfolioPositionPlan {
  code: string;
  name: string;
  layer: StrategyLayer;
  currentWeight: number;
  targetWeight: number;
  drift: number;
  marketValue: number;
  profitPct: number;
  action: string;
  reason: string;
  riskLevel: DailyStrategyPick['riskLevel'];
}

export interface PortfolioCurvePoint {
  date: string;
  portfolio: number;
  benchmark: number;
  drawdown: number;
}

export interface PortfolioCredibility {
  score: number;
  level: '高' | '中' | '低';
  sampleSize: number;
  avgWinRate: number;
  avgProfitFactor: number;
  maxDrawdown: number;
  notes: string[];
}

export interface PortfolioWorkbench {
  marketHeat: number;
  stance: '进攻' | '均衡' | '防守';
  targetStockPct: number;
  targetEtfPct: number;
  targetCashPct: number;
  currentStockPct: number;
  currentEtfPct: number;
  currentCashPct: number;
  totalMarketValue: number;
  layers: LayeredStrategyPool[];
  positions: PortfolioPositionPlan[];
  curve: PortfolioCurvePoint[];
  credibility: PortfolioCredibility;
  rebalanceNotes: string[];
}

const pct = (value: number) => +value.toFixed(2);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function classifyLayer(pick: DailyStrategyPick): StrategyLayer {
  if (isETF(pick.code) || pick.strategy === 'ETF配置') return 'ETF';
  if (pick.riskLevel === 'low' || pick.strategy === '共振低吸' || pick.industry.includes('银行') || pick.industry.includes('红利')) return '防守';
  if (pick.score >= 58 && pick.confidence >= 62 && pick.riskLevel !== 'high') return '进攻';
  return '观察';
}

function marketHeat() {
  const list = getStockList();
  const rising = list.filter(stock => stock.changePct >= 0).length;
  return Math.round(rising / Math.max(1, list.length) * 100);
}

function stanceFromHeat(heat: number): PortfolioWorkbench['stance'] {
  if (heat >= 62) return '进攻';
  if (heat <= 38) return '防守';
  return '均衡';
}

function allocationPolicy(stance: PortfolioWorkbench['stance']) {
  if (stance === '进攻') return { stock: 52, etf: 34, cash: 14 };
  if (stance === '防守') return { stock: 22, etf: 46, cash: 32 };
  return { stock: 38, etf: 38, cash: 24 };
}

export function buildLayeredStrategyPools(): LayeredStrategyPool[] {
  const allScored = getStockList()
    .filter(stock => stock.price > 0 && stock.changePct > -7 && stock.changePct < 9.9)
    .map(scoreStrategyStock)
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  const etfPicks = buildETFStrategyPicks(12);
  const stockPicks = allScored.filter(pick => !isETF(pick.code));

  const attack = stockPicks
    .filter(pick => classifyLayer(pick) === '进攻')
    .slice(0, 10);
  const defense = stockPicks
    .filter(pick => classifyLayer(pick) === '防守')
    .slice(0, 10);
  const observation = stockPicks
    .filter(pick => !attack.some(item => item.code === pick.code) && !defense.some(item => item.code === pick.code))
    .filter(pick => pick.score >= 36 || pick.confidence >= 50)
    .slice(0, 12);

  return [
    {
      layer: '进攻',
      title: '进攻候选',
      budgetPct: 28,
      maxSinglePct: 6,
      trigger: '指数热度不低于50，个股放量站稳买区或突破线。',
      riskRule: '单票先用试错仓，跌破计划止损立即退出波段仓。',
      picks: attack,
    },
    {
      layer: '防守',
      title: '防守候选',
      budgetPct: 20,
      maxSinglePct: 5,
      trigger: '市场震荡或主线不清晰时优先保留低波动、共振低吸标的。',
      riskRule: '不追高，靠近计划买区才分批，承担组合缓冲职责。',
      picks: defense,
    },
    {
      layer: 'ETF',
      title: 'ETF配置',
      budgetPct: 38,
      maxSinglePct: 10,
      trigger: '宽基负责底仓，红利和黄金负责防守，科技ETF只做主题弹性。',
      riskRule: 'ETF不和个股共用追涨仓位，高波动主题ETF单只不超过6%。',
      picks: etfPicks,
    },
    {
      layer: '观察',
      title: '观察名单',
      budgetPct: 14,
      maxSinglePct: 0,
      trigger: '分数够看但位置、风险或资讯尚未确认，只进入观察。',
      riskRule: '观察层默认不买，等技术、资讯和市场温度至少两项转强。',
      picks: observation,
    },
  ];
}

function latestClose(code: string) {
  const data = getKlineData(code, 260);
  return data[data.length - 1]?.close || getStockList().find(stock => stock.code === code)?.price || 0;
}

function targetWeightForPick(pick: DailyStrategyPick, policy: ReturnType<typeof allocationPolicy>, layer: StrategyLayer) {
  const quality = clamp((pick.score + pick.confidence) / 160, 0.25, 0.95);
  if (layer === 'ETF') {
    const base = policy.etf / 5;
    return pct(clamp(base * quality, 3, pick.riskLevel === 'high' ? 6 : 10));
  }
  if (layer === '防守') return pct(clamp(policy.stock / 8 * quality, 2, 5));
  if (layer === '进攻') return pct(clamp(policy.stock / 6 * quality, 2, 6));
  return 0;
}

function buildPositionPlans(trades: TradeRecord[], layers: LayeredStrategyPool[], policy: ReturnType<typeof allocationPolicy>) {
  const holdings = buildHoldingPositions(trades);
  const pickMap = new Map<string, DailyStrategyPick>();
  const layerMap = new Map<string, StrategyLayer>();
  layers.forEach(layer => layer.picks.forEach(pick => {
    pickMap.set(pick.code, pick);
    layerMap.set(pick.code, layer.layer);
  }));
  holdings.forEach(position => {
    if (!pickMap.has(position.code)) {
      const stock = getStockList().find(item => item.code === position.code);
      if (stock) {
        const pick = scoreStrategyStock(stock);
        pickMap.set(position.code, pick);
        layerMap.set(position.code, classifyLayer(pick));
      }
    }
  });

  const positionValues = holdings.map(position => {
    const currentPrice = latestClose(position.code);
    return {
      ...position,
      currentPrice,
      marketValue: currentPrice * position.shares,
      profitPct: position.cost ? (currentPrice - position.cost) / position.cost * 100 : 0,
    };
  });
  const totalMarketValue = positionValues.reduce((sum, item) => sum + item.marketValue, 0);

  return {
    totalMarketValue,
    positions: positionValues.map(position => {
      const pick = pickMap.get(position.code);
      const layer = layerMap.get(position.code) || '观察';
      const currentWeight = totalMarketValue ? position.marketValue / totalMarketValue * 100 : 0;
      const targetWeight = pick ? targetWeightForPick(pick, policy, layer) : 0;
      const drift = pct(currentWeight - targetWeight);
      const action = drift > 2
        ? '减到目标仓'
        : drift < -2 && layer !== '观察'
          ? '等买区补仓'
          : layer === '观察'
            ? '只观察不加'
            : '维持跟踪';
      return {
        code: position.code,
        name: position.name,
        layer,
        currentWeight: pct(currentWeight),
        targetWeight,
        drift,
        marketValue: pct(position.marketValue),
        profitPct: pct(position.profitPct),
        action,
        reason: pick?.execution || '当前不在策略候选前排，先按持仓纪律管理。',
        riskLevel: pick?.riskLevel || 'medium',
      };
    }).sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift)),
  };
}

function buildModelCurve(layers: LayeredStrategyPool[]): PortfolioCurvePoint[] {
  const selected = [
    ...layers.find(layer => layer.layer === 'ETF')!.picks.slice(0, 5).map(pick => ({ code: pick.code, weight: 0.52 })),
    ...layers.find(layer => layer.layer === '进攻')!.picks.slice(0, 4).map(pick => ({ code: pick.code, weight: 0.32 })),
    ...layers.find(layer => layer.layer === '防守')!.picks.slice(0, 3).map(pick => ({ code: pick.code, weight: 0.16 })),
  ];
  const weightSum = selected.reduce((sum, item) => sum + item.weight, 0) || 1;
  const series = selected.map(item => ({ ...item, weight: item.weight / weightSum, data: getKlineData(item.code, 180) }));
  const dates = series[0]?.data.map(day => day.date) || [];
  const benchmark = getKlineData('510300.SH', 180);
  let peak = 100;

  return dates.map((date, index) => {
    const portfolio = series.reduce((sum, item) => {
      const first = item.data[0]?.close || 1;
      const close = item.data[index]?.close || item.data[item.data.length - 1]?.close || first;
      return sum + close / first * 100 * item.weight;
    }, 0);
    const benchmarkFirst = benchmark[0]?.close || 1;
    const benchmarkClose = benchmark[index]?.close || benchmark[benchmark.length - 1]?.close || benchmarkFirst;
    peak = Math.max(peak, portfolio);
    return {
      date,
      portfolio: pct(portfolio),
      benchmark: pct(benchmarkClose / benchmarkFirst * 100),
      drawdown: pct((portfolio - peak) / peak * 100),
    };
  });
}

function buildCredibility(layers: LayeredStrategyPool[]): PortfolioCredibility {
  const sampleCodes = [
    ...layers.find(layer => layer.layer === '进攻')!.picks.slice(0, 3),
    ...layers.find(layer => layer.layer === 'ETF')!.picks.slice(0, 3),
  ].map(pick => pick.code);
  const results = sampleCodes
    .map(code => buildBacktestSuite(getKlineData(code, 2500))[0])
    .filter(Boolean);
  const sampleSize = results.reduce((sum, result) => sum + result.sampleSize, 0);
  const avgWinRate = results.length ? results.reduce((sum, result) => sum + result.winRate, 0) / results.length : 0;
  const avgProfitFactor = results.length ? results.reduce((sum, result) => sum + result.profitFactor, 0) / results.length : 0;
  const maxDrawdown = results.length ? Math.min(...results.map(result => result.maxDrawdown)) : 0;
  const score = Math.round(clamp(sampleSize / 3, 0, 40) + clamp(avgWinRate - 38, 0, 30) + clamp((avgProfitFactor - 0.8) * 25, 0, 30));
  const level: PortfolioCredibility['level'] = score >= 72 ? '高' : score >= 52 ? '中' : '低';

  return {
    score,
    level,
    sampleSize,
    avgWinRate: pct(avgWinRate),
    avgProfitFactor: pct(avgProfitFactor),
    maxDrawdown: pct(maxDrawdown),
    notes: [
      `组合可信度来自前排进攻与ETF候选的历史样本，当前合计 ${sampleSize} 笔交易。`,
      avgWinRate >= 55 ? '胜率达到可参考区间，可以把回测作为仓位上限依据。' : '胜率仍需谨慎，只能作为过滤器，不能替代止损。',
      avgProfitFactor >= 1.2 ? '利润因子支持继续跟踪，但仍要控制连续亏损。' : '利润因子一般，组合需要更依赖ETF和现金缓冲。',
    ],
  };
}

export function buildPortfolioWorkbench(trades: TradeRecord[] = []): PortfolioWorkbench {
  const heat = marketHeat();
  const stance = stanceFromHeat(heat);
  const policy = allocationPolicy(stance);
  const layers = buildLayeredStrategyPools();
  const { totalMarketValue, positions } = buildPositionPlans(trades, layers, policy);
  const currentEtfValue = positions.filter(position => position.layer === 'ETF').reduce((sum, position) => sum + position.marketValue, 0);
  const currentStockValue = positions.filter(position => position.layer !== 'ETF').reduce((sum, position) => sum + position.marketValue, 0);
  const investedPct = totalMarketValue > 0 ? 100 : 0;
  const currentEtfPct = totalMarketValue ? currentEtfValue / totalMarketValue * investedPct : 0;
  const currentStockPct = totalMarketValue ? currentStockValue / totalMarketValue * investedPct : 0;

  return {
    marketHeat: heat,
    stance,
    targetStockPct: policy.stock,
    targetEtfPct: policy.etf,
    targetCashPct: policy.cash,
    currentStockPct: pct(currentStockPct),
    currentEtfPct: pct(currentEtfPct),
    currentCashPct: totalMarketValue ? 0 : 100,
    totalMarketValue: pct(totalMarketValue),
    layers,
    positions,
    curve: buildModelCurve(layers),
    credibility: buildCredibility(layers),
    rebalanceNotes: [
      `当前市场温度 ${heat}，组合姿态设为${stance}，目标股票/ETF/现金为 ${policy.stock}/${policy.etf}/${policy.cash}。`,
      '进攻仓只给技术和资讯共振标的；防守仓和ETF承担波动缓冲，观察层不占用真实仓位。',
      positions.length ? '已有持仓按目标权重偏离度排序，优先处理偏离超过2个百分点的仓位。' : '暂无本地交易持仓时，本页展示模型组合曲线和候选层级。',
    ],
  };
}
