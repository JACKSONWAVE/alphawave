import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  Crosshair,
  Database,
  Gauge,
  History,
  LineChart,
  ListChecks,
  Radar,
  RefreshCw,
  ShieldCheck,
  Target,
  WalletCards,
} from 'lucide-react';

import { calcMA, getCoreStockList, getKlineData, getMarketIndex, getStockList, getTrend, type StockListItem, type TradeRecord } from '../data/mockData';
import { calcIndicatorScore, calcSupportResistance } from '../data/analysisEngine';
import { buildMarketContext } from '../data/marketContext';
import { formatPct, formatPrice } from '../data/price';
import { buildStrategyPlan } from '../data/strategyEngine';
import { buildHoldingAdvice, buildHoldingPositions, buildTradeGuard, type HoldingAdvice, type TradeGuard } from '../data/tradeGuard';
import { buildDailyStrategyPicks, buildETFStrategyPicks, scoreStrategyStock, type DailyStrategyPick } from '../data/strategyScreener';
import { buildMarketScanner, type IndustryHeat, type MarketScannerReport } from '../data/marketScanner';
import { buildDataFreshness, buildKlineHealthReport, buildRequirementAudit, type KlineHealthReport, type SystemAuditItem } from '../data/systemAudit';
import { buildPortfolioWorkbench } from '../data/portfolioEngine';
import { buildAccountPerformance, buildAccountSummary, type AccountSummary } from '../data/accountEngine';
import { buildStrategySnapshot, diffStrategySnapshots, type StrategyPoolLog, type StrategyPoolSnapshotItem } from '../data/strategyJournal';
import { buildTradeExecutionReview } from '../data/tradeReview';
import { buildDailyOperationsBrief, type DailyOperationsBrief, type BriefTone } from '../data/dailyBrief';
import { buildCapitalFlowProfile } from '../data/capitalFlow';
import { useRealtimeQuotes } from '../hooks/useRealtime';
import { useLocalStorage } from '../hooks/useLocalStorage';
import RealtimeStatus from '../components/RealtimeStatus';

type DeskLane = '可试错' | '持仓观察' | '风险减仓' | '等待回踩';
type DeskSource = 'auto' | 'core';
type DeskMode = 'premarket' | 'intraday' | 'review';

interface DeskStock {
  code: string;
  name: string;
  industry: string;
  price: number;
  change: number;
  changePct: number;
  lane: DeskLane;
  laneTone: string;
  action: string;
  score: number;
  riskDistance: number;
  riskReward: number;
  entryLow: number;
  entryHigh: number;
  stopLoss: number;
  target: number;
  trendText: string;
  spark: number[];
  isRealtime: boolean;
  strategy: string;
  confidence: number;
  pickReason: string;
  intelScore: number;
  intelLabel: string;
  modeReason: string;
  autoRank: number;
}

const laneOrder: DeskLane[] = ['可试错', '持仓观察', '风险减仓', '等待回踩'];
const deskModeMeta: Record<DeskMode, { label: string; hint: string }> = {
  premarket: { label: '盘前', hint: '盘前先定候选和计划价，少看短线波动。' },
  intraday: { label: '盘中', hint: '盘中看实时触发、量价延续和止损距离。' },
  review: { label: '复盘', hint: '复盘看降级原因、风险票和第二天观察名单。' },
};

function pickLane(score: number, changePct: number, price: number, entryLow: number, entryHigh: number, stopLoss: number): DeskLane {
  if (price <= stopLoss || score <= -30 || changePct <= -4) return '风险减仓';
  if (price >= entryLow && price <= entryHigh && score >= 15) return '可试错';
  if (score >= 0 && changePct > -3) return '持仓观察';
  return '等待回踩';
}

function laneTone(lane: DeskLane) {
  if (lane === '可试错') return 'text-t-red border-t-red/35 bg-t-red/10';
  if (lane === '风险减仓') return 'text-t-green border-t-green/35 bg-t-green/10';
  if (lane === '等待回踩') return 'text-t-yellow border-t-yellow/35 bg-t-yellow/10';
  return 'text-t-blue border-t-blue/35 bg-t-blue/10';
}

function laneAction(lane: DeskLane, entryLow: number, entryHigh: number, stopLoss: number, target: number) {
  if (lane === '可试错') return `分批试错 ${formatPrice(entryLow)}-${formatPrice(entryHigh)}`;
  if (lane === '风险减仓') return `跌破 ${formatPrice(stopLoss)} 控仓`;
  if (lane === '等待回踩') return `等回到 ${formatPrice(entryLow)} 附近`;
  return `持有观察，目标 ${formatPrice(target)}`;
}

function calcIndustryIntel(stock: StockListItem, report: MarketScannerReport) {
  const hot = report.hotIndustries.find(item => item.industry === stock.industry);
  const risk = report.riskIndustries.find(item => item.industry === stock.industry);
  if (hot && hot.heat >= 58) {
    const score = Math.min(12, Math.max(3, Math.round((hot.heat - 45) / 4)));
    return { score, label: `主题+${score}` };
  }
  if (risk && risk.heat <= 35) {
    const score = -Math.min(10, Math.max(3, Math.round((42 - risk.heat) / 3)));
    return { score, label: `行业${score}` };
  }
  return { score: 0, label: '资讯0' };
}

function modeReason(mode: DeskMode, lane: DeskLane, pick?: DailyStrategyPick) {
  if (mode === 'premarket') return pick ? `盘前按${pick.strategy}、计划买区和风控线入池` : '盘前只保留核心跟踪，等待策略分确认';
  if (mode === 'intraday') return lane === '可试错' ? '盘中已接近触发区，优先观察成交和回落承接' : '盘中未触发，只保留价格监控';
  return lane === '风险减仓' ? '复盘优先检查降级和止损纪律' : '复盘记录明日是否继续观察';
}

function buildDeskStocks(
  staticStocks: StockListItem[],
  realtimeQuotes: ReturnType<typeof useRealtimeQuotes>['quotes'],
  pickMap: Map<string, DailyStrategyPick>,
  scanner: MarketScannerReport,
  mode: DeskMode,
): DeskStock[] {
  const rtMap = new Map(realtimeQuotes.map(quote => [quote.code, quote]));
  return staticStocks.map(stock => {
    const realtime = rtMap.get(stock.code);
    const pick = pickMap.get(stock.code) || scoreStrategyStock(stock);
    const intel = calcIndustryIntel(stock, scanner);
    const kline = getKlineData(stock.code);
    const latest = kline[kline.length - 1];
    const price = realtime?.price ?? stock.price;
    const change = realtime?.change ?? stock.change;
    const changePct = realtime?.changePct ?? stock.changePct;
    const ma20List = calcMA(kline, 20);
    const ma60List = calcMA(kline, 60);
    const ma20 = ma20List[ma20List.length - 1];
    const ma60 = ma60List[ma60List.length - 1];
    const trend = getTrend(kline);
    const score = calcIndicatorScore(kline);
    const sr = calcSupportResistance(kline);
    const plan = buildStrategyPlan(stock.code, stock.name, realtime);
    const lane = pickLane(score.overall, changePct, price, plan.entryZone.low, plan.entryZone.high, plan.stopLoss);
    const riskDistance = price ? Math.max(0, (price - plan.stopLoss) / price * 100) : 0;
    const spark = kline.slice(-34).map(item => item.close);
    const trendText = trend.trend === 'up' ? '上升' : trend.trend === 'down' ? '下降' : ma20 && ma60 && ma20 > ma60 ? '修复' : '震荡';
    const autoRank = score.overall + pick.score * 0.65 + pick.confidence * 0.25 + intel.score + (lane === '可试错' ? 12 : lane === '风险减仓' ? -18 : 0);

    return {
      code: stock.code,
      name: stock.name,
      industry: stock.industry,
      price,
      change,
      changePct,
      lane,
      laneTone: laneTone(lane),
      action: laneAction(lane, plan.entryZone.low, plan.entryZone.high, plan.stopLoss, plan.target1),
      score: score.overall,
      riskDistance,
      riskReward: plan.riskReward,
      entryLow: plan.entryZone.low,
      entryHigh: plan.entryZone.high,
      stopLoss: plan.stopLoss,
      target: sr.targetPrice || plan.target1,
      trendText,
      spark,
      isRealtime: Boolean(realtime),
      strategy: pick.strategy,
      confidence: pick.confidence,
      pickReason: pick.reason,
      intelScore: intel.score,
      intelLabel: intel.label,
      modeReason: modeReason(mode, lane, pick),
      autoRank,
    };
  }).sort((a, b) => b.autoRank - a.autoRank);
}

export default function Dashboard() {
  const indexData = useMemo(() => getMarketIndex(), []);
  const allStocks = useMemo(() => getStockList(), []);
  const staticStocks = useMemo(() => getCoreStockList(), []);
  const { quotes: realtimeQuotes, loading, refresh } = useRealtimeQuotes({});
  const [trades] = useLocalStorage<TradeRecord[]>('trades', []);
  const [initialCapital, setInitialCapital] = useLocalStorage<number>('account_initial_capital', 1000000);
  const [poolSnapshot, setPoolSnapshot] = useLocalStorage<StrategyPoolSnapshotItem[]>('strategy_pool_snapshot', []);
  const [poolLogs, setPoolLogs] = useLocalStorage<StrategyPoolLog[]>('strategy_pool_logs', []);
  const [activeLane, setActiveLane] = useState<DeskLane | '全部'>('全部');
  const [deskSource, setDeskSource] = useLocalStorage<DeskSource>('dashboard_desk_source', 'auto');
  const [deskMode, setDeskMode] = useLocalStorage<DeskMode>('dashboard_desk_mode', 'intraday');
  const [selectedCode, setSelectedCode] = useState(staticStocks[0]?.code || '603019.SH');

  const holdings = useMemo(() => buildHoldingPositions(trades), [trades]);
  const accountSummary = useMemo(() => buildAccountSummary(trades, initialCapital, realtimeQuotes), [initialCapital, realtimeQuotes, trades]);
  const accountPerformance = useMemo(() => buildAccountPerformance(trades, initialCapital), [initialCapital, trades]);
  const tradeReview = useMemo(() => buildTradeExecutionReview(trades), [trades]);
  const portfolioWorkbench = useMemo(() => buildPortfolioWorkbench(trades), [trades]);
  const dailyPicks = useMemo(() => buildDailyStrategyPicks(16), [realtimeQuotes]);
  const etfPicks = useMemo(() => buildETFStrategyPicks(8), []);
  const marketScanner = useMemo(() => buildMarketScanner(), []);
  const currentPoolSnapshot = useMemo(() => buildStrategySnapshot(
    dailyPicks,
    pick => {
      const stock = allStocks.find(item => item.code === pick.code);
      return stock ? calcIndustryIntel(stock, marketScanner).label : '资讯0';
    },
  ), [allStocks, dailyPicks, marketScanner]);
  const pickMap = useMemo(() => new Map([...dailyPicks, ...etfPicks].map(pick => [pick.code, pick])), [dailyPicks, etfPicks]);
  const deskUniverse = useMemo(() => {
    if (deskSource === 'core') return staticStocks;
    const attackCodes = portfolioWorkbench.layers.flatMap(layer => layer.layer === '进攻' || layer.layer === '防守' ? layer.picks.slice(0, 5).map(pick => pick.code) : []);
    const riskCodes = dailyPicks.filter(pick => pick.riskLevel === 'high').slice(0, 4).map(pick => pick.code);
    const modeCodes = deskMode === 'review'
      ? [...riskCodes, ...dailyPicks.slice(0, 8).map(pick => pick.code)]
      : deskMode === 'premarket'
        ? [...dailyPicks.slice(0, 10).map(pick => pick.code), ...etfPicks.slice(0, 4).map(pick => pick.code)]
        : [...dailyPicks.map(pick => pick.code), ...attackCodes];
    const codes = Array.from(new Set([
      ...modeCodes,
      ...holdings.map(position => position.code),
    ]));
    const stockMap = new Map(allStocks.map(stock => [stock.code, stock]));
    return codes.map(code => stockMap.get(code)).filter((stock): stock is StockListItem => Boolean(stock)).slice(0, 18);
  }, [allStocks, dailyPicks, deskMode, deskSource, etfPicks, holdings, portfolioWorkbench.layers, staticStocks]);
  const stockOrder = useMemo(() => new Map(deskUniverse.map((stock, index) => [stock.code, index])), [deskUniverse]);
  const deskStocks = useMemo(() => buildDeskStocks(deskUniverse, realtimeQuotes, pickMap, marketScanner, deskMode), [deskMode, deskUniverse, marketScanner, pickMap, realtimeQuotes]);
  const selected = deskStocks.find(stock => stock.code === selectedCode) || deskStocks[0];
  const visibleStocks = useMemo(() => (
    activeLane === '全部' ? deskStocks : deskStocks.filter(stock => stock.lane === activeLane)
  ), [activeLane, deskStocks]);
  const actionStocks = useMemo(() => deskStocks
    .filter(stock => stock.lane === '可试错')
    .sort((a, b) => b.score - a.score || (stockOrder.get(a.code) || 0) - (stockOrder.get(b.code) || 0)), [deskStocks, stockOrder]);
  const riskStocks = useMemo(() => deskStocks
    .filter(stock => stock.lane === '风险减仓')
    .sort((a, b) => a.score - b.score || (stockOrder.get(a.code) || 0) - (stockOrder.get(b.code) || 0)), [deskStocks, stockOrder]);
  const rising = allStocks.filter(stock => stock.changePct >= 0).length;
  const marketHeat = Math.round(rising / Math.max(allStocks.length, 1) * 100);
  const marketContext = useMemo(() => selected ? buildMarketContext(selected.code, getKlineData(selected.code)) : null, [selected]);
  const command = actionStocks[0] || selected;
  const selectedRealtime = realtimeQuotes.find(quote => quote.code === selected?.code);
  const selectedCapitalFlow = useMemo(() => selected ? buildCapitalFlowProfile({ kline: getKlineData(selected.code), quote: selectedRealtime }) : null, [selected?.code, selectedRealtime]);
  const selectedPlan = useMemo(() => selected ? buildStrategyPlan(selected.code, selected.name, selectedRealtime) : null, [selected, selectedRealtime]);
  const selectedPosition = holdings.find(position => position.code === selected?.code) || null;
  const tradeGuard = selected && selectedPlan
    ? buildTradeGuard({ currentPrice: selected.price, plan: selectedPlan, scoreOverall: selected.score, marketHeat })
    : null;
  const holdingAdvice = selected && selectedPlan
    ? buildHoldingAdvice({ position: selectedPosition, currentPrice: selected.price, plan: selectedPlan, scoreOverall: selected.score, marketHeat })
    : null;
  const auditItems = useMemo(() => buildRequirementAudit(), []);
  const freshness = useMemo(() => buildDataFreshness(), []);
  const klineHealth = useMemo(() => buildKlineHealthReport(freshness), [freshness]);
  const doneCount = auditItems.filter(item => item.status === 'done').length;
  const partialCount = auditItems.filter(item => item.status === 'partial').length;

  useEffect(() => {
    if (!deskStocks.length) return;
    if (!deskStocks.some(stock => stock.code === selectedCode)) {
      setSelectedCode(deskStocks[0].code);
    }
  }, [deskStocks, selectedCode]);

  useEffect(() => {
    if (!currentPoolSnapshot.length) return;
    const previousKey = poolSnapshot.map(item => `${item.code}:${item.rank}:${item.score}:${item.confidence}:${item.riskLevel}:${item.intelLabel}:${item.rankDriver}:${item.dataDate}`).join('|');
    const currentKey = currentPoolSnapshot.map(item => `${item.code}:${item.rank}:${item.score}:${item.confidence}:${item.riskLevel}:${item.intelLabel}:${item.rankDriver}:${item.dataDate}`).join('|');
    if (previousKey === currentKey) return;

    const logs = diffStrategySnapshots(poolSnapshot, currentPoolSnapshot);
    if (logs.length) {
      setPoolLogs(previous => [...logs, ...previous].slice(0, 40));
    }
    setPoolSnapshot(currentPoolSnapshot);
  }, [currentPoolSnapshot, poolSnapshot, setPoolLogs, setPoolSnapshot]);

  const dailyBrief = useMemo(() => buildDailyOperationsBrief({
    scanner: marketScanner,
    portfolio: portfolioWorkbench,
    account: accountSummary,
    performance: accountPerformance,
    tradeReview,
    dailyPicks,
    etfPicks,
    poolLogs,
    deskMode,
  }), [accountPerformance, accountSummary, dailyPicks, deskMode, etfPicks, marketScanner, poolLogs, portfolioWorkbench, tradeReview]);

  return (
    <div className="space-y-3">
      <RealtimeStatus />

      <DailyBriefPanel brief={dailyBrief} />

      <MarketRadarPanel report={marketScanner} deskMode={deskMode} />

      <AccountOverviewPanel summary={accountSummary} initialCapital={initialCapital} onCapitalChange={setInitialCapital} />

      <PortfolioCommandPanel workbench={portfolioWorkbench} />

      <StrategyJournalPanel logs={poolLogs} current={currentPoolSnapshot} />

      <section className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-t-border bg-[#131722] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2">
              <Target className="w-4 h-4 text-t-red" /> 今日全市场 Top 10 策略池
            </h2>
            <p className="text-[11px] text-t-textDim mt-1">从 {allStocks.length} 只沪深京股票中筛选，优先看龙头突破、量价突破、MACD/KDJ/RSI 共振和趋势回踩。</p>
          </div>
          <div className="text-right text-xs data-num">
            <div className="text-t-red font-bold">{Math.min(10, dailyPicks.length)} 只入选</div>
            <div className="text-t-textDim">全市场热度 {marketHeat}%</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-0">
          {dailyPicks.slice(0, 10).map((pick, index) => (
            <Link key={pick.code} to={`/analysis?code=${pick.code}`} className="p-3 border-r border-b border-t-border hover:bg-white/[0.035] transition-colors min-h-[154px]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] data-num text-t-textDim">#{index + 1} {pick.code}</div>
                  <div className="text-sm font-semibold text-t-textBright truncate">{pick.name}</div>
                </div>
                <span className={`text-lg font-bold data-num ${pick.score >= 70 ? 'text-t-red' : 'text-t-yellow'}`}>{pick.score}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                <span className="px-1.5 py-0.5 rounded bg-t-blue/10 text-t-blue border border-t-blue/20">{pick.strategy}</span>
                <span className={pick.changePct >= 0 ? 'text-t-red data-num' : 'text-t-green data-num'}>{formatPct(pick.changePct)}</span>
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-t-textDim">
                <div className="truncate">买区 {pick.entry}</div>
                <div className="truncate">止损 {pick.stop} · 目标 {pick.target}</div>
                <div className="truncate text-t-textSecondary">{pick.execution}</div>
                <div className="truncate text-t-textSecondary">{pick.reason}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-t-textDim">
                <span>{pick.hasDeepData ? '10 年 K 线共振' : '全市场快筛，待补深度 K 线'}</span>
                <span className={pick.riskLevel === 'high' ? 'text-t-yellow' : pick.riskLevel === 'medium' ? 'text-t-blue' : 'text-t-green'}>风险 {pick.riskLevel}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-t-border bg-[#131722] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-t-yellow" /> ETF 配置池
            </h2>
            <p className="text-[11px] text-t-textDim mt-1">把宽基、红利低波、黄金、芯片/存储链和行业 ETF 单独做资产配置，不和个股共用一套追涨逻辑。</p>
          </div>
          <Link to="/screener" className="text-xs text-t-blue hover:underline">进入智能选股器筛 ETF</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-0">
          {etfPicks.map(pick => <ETFPickCard key={pick.code} pick={pick} />)}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-3">
        <div className="panel p-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-t-green" /> 需求闭环巡检</h2>
              <p className="text-[11px] text-t-textDim mt-0.5">把你提出的 14 项要求直接放到交易台上，哪些已落地、哪些还需要外部数据源一眼能看到。</p>
            </div>
            <div className="text-right text-xs data-num">
              <div className="text-t-green font-bold">{doneCount}/14 已完成</div>
              <div className="text-t-yellow">{partialCount} 项依赖外部源</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {auditItems.slice(0, 6).map(item => <AuditRow key={item.id} item={item} />)}
          </div>
        </div>

        <KlineHealthPanel report={klineHealth} picks={dailyPicks} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.9fr] gap-3">
        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-t-border bg-[#131722]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-t-textBright">
                  <Gauge className="w-4 h-4 text-t-blue" />
                  <h1 className="text-base font-semibold">交易驾驶舱</h1>
                </div>
                <p className="text-xs text-t-textDim mt-1">{deskSource === 'auto' ? `${deskModeMeta[deskMode].hint} 自动池会解释每只票为何入选。` : '核心池模式，固定跟踪你的长期重点票。'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded border border-t-border overflow-hidden">
                  {(Object.keys(deskModeMeta) as DeskMode[]).map(mode => (
                    <button key={mode} onClick={() => setDeskMode(mode)} className={`px-2.5 py-1 text-xs ${deskMode === mode ? 'bg-t-yellow text-black' : 'text-t-textDim hover:text-t-text hover:bg-t-panelHover'} ${mode !== 'premarket' ? 'border-l border-t-border' : ''}`}>
                      {deskModeMeta[mode].label}
                    </button>
                  ))}
                </div>
                <div className="inline-flex rounded border border-t-border overflow-hidden">
                  <button onClick={() => setDeskSource('auto')} className={`px-2.5 py-1 text-xs ${deskSource === 'auto' ? 'bg-t-blue text-white' : 'text-t-textDim hover:text-t-text hover:bg-t-panelHover'}`}>自动策略池</button>
                  <button onClick={() => setDeskSource('core')} className={`px-2.5 py-1 text-xs border-l border-t-border ${deskSource === 'core' ? 'bg-t-blue text-white' : 'text-t-textDim hover:text-t-text hover:bg-t-panelHover'}`}>核心池</button>
                </div>
                <button onClick={refresh} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-t-border text-xs text-t-textDim hover:text-t-text hover:bg-t-panelHover">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  同步实时
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-t-border">
            <CommandMetric icon={Activity} label="市场温度" value={`${marketHeat}%`} tone={marketHeat >= 65 ? 'text-t-red' : marketHeat <= 35 ? 'text-t-green' : 'text-t-yellow'} detail={`${rising}/${allStocks.length} 上涨`} />
            <CommandMetric icon={Crosshair} label="驾驶舱池" value={`${deskStocks.length}只`} tone="text-t-red" detail={deskSource === 'auto' ? '自动候选入舱' : '核心票固定跟踪'} />
            <CommandMetric icon={ShieldCheck} label="风险票" value={`${riskStocks.length}只`} tone={riskStocks.length ? 'text-t-green' : 'text-t-text'} detail="需减仓/止损关注" />
            <CommandMetric icon={Bot} label="持仓跟踪" value={`${holdings.length}只`} tone="text-t-blue" detail="按底仓/波段处理" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[0.72fr_1fr] gap-0">
            <div className="border-r border-t-border p-3 space-y-2">
              <div className="text-xs font-semibold text-t-textBright flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-t-red" />
                今日行动队列
              </div>
              {(actionStocks.length ? actionStocks.slice(0, 5) : deskStocks.slice(0, 5)).map(stock => (
                <button key={stock.code} onClick={() => setSelectedCode(stock.code)} className={`w-full text-left border rounded p-2 transition-colors ${selected?.code === stock.code ? 'border-t-blue bg-t-blue/10' : 'border-t-border hover:bg-white/[0.03]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-t-textBright">{stock.name}</span>
                    <span className={`text-xs data-num ${stock.changePct >= 0 ? 'text-t-red' : 'text-t-green'}`}>{formatPct(stock.changePct)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                    <span className="px-1 rounded bg-t-blue/10 text-t-blue">{stock.strategy}</span>
                    <span className={stock.intelScore >= 0 ? 'text-t-red' : 'text-t-green'}>{stock.intelLabel}</span>
                    <span className="text-t-textDim">置信{stock.confidence}%</span>
                  </div>
                  <div className="text-[11px] text-t-textDim mt-1 truncate">{stock.modeReason}</div>
                </button>
              ))}
            </div>

            <div className="p-3">
              {command && selected && (
                <div className="h-full min-h-[244px] flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-t-textDim">{selected.code} · {selected.industry}</div>
                        <Link to={`/analysis?code=${selected.code}`} className="text-2xl font-bold text-t-textBright hover:text-t-blue">{selected.name}</Link>
                      </div>
                      <span className={`px-2 py-1 rounded border text-xs font-semibold ${selected.laneTone}`}>{selected.lane}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <QuoteBlock label="现价" value={formatPrice(selected.price)} tone={selected.changePct >= 0 ? 'text-t-red' : 'text-t-green'} />
                      <QuoteBlock label="策略分" value={String(selected.score)} tone={selected.score >= 15 ? 'text-t-red' : selected.score <= -15 ? 'text-t-green' : 'text-t-yellow'} />
                      <QuoteBlock label="交易许可" value={tradeGuard?.label || '-'} tone={tradeGuard?.status === 'allow' ? 'text-t-red' : tradeGuard?.status === 'block' ? 'text-t-green' : 'text-t-yellow'} />
                    </div>
                  </div>

                  <div className="mt-4">
                    <MiniSparkline values={selected.spark} up={selected.changePct >= 0} />
                    {selectedCapitalFlow && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <QuoteBlock label="机构净额" value={formatDashboardMoneyWan(selectedCapitalFlow.institutionNetWan)} tone={selectedCapitalFlow.institutionNetWan >= 0 ? 'text-t-red' : 'text-t-green'} />
                        <QuoteBlock label="散户净额" value={formatDashboardMoneyWan(selectedCapitalFlow.retailNetWan)} tone={selectedCapitalFlow.retailNetWan >= 0 ? 'text-t-red' : 'text-t-green'} />
                        <QuoteBlock label="平均成本" value={formatPrice(selectedCapitalFlow.avgCostToday)} tone={selected.price >= selectedCapitalFlow.avgCostToday ? 'text-t-red' : 'text-t-green'} />
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <ActionLine label="计划买区" value={`${formatPrice(selected.entryLow)}-${formatPrice(selected.entryHigh)}`} />
                      <ActionLine label="止损距离" value={`${selected.riskDistance.toFixed(1)}%`} />
                      <ActionLine label="止损 / 目标" value={`${formatPrice(selected.stopLoss)} / ${formatPrice(selected.target)}`} />
                      <ActionLine label="持仓建议" value={holdingAdvice?.label || selected.trendText} />
                      <ActionLine label="入选解释" value={selected.modeReason} />
                      <ActionLine label="资金判断" value={selectedCapitalFlow?.dominant || selected.pickReason} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`/analysis?code=${selected.code}`} className="px-3 py-1.5 rounded bg-t-blue text-white text-xs font-medium">进入分析</Link>
                    <Link to="/alerts" className="px-3 py-1.5 rounded border border-t-border text-xs text-t-textDim hover:text-t-text">设置预警</Link>
                    <Link to="/feishu" className="px-3 py-1.5 rounded border border-t-border text-xs text-t-textDim hover:text-t-text">飞书策略</Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="panel p-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2"><Radar className="w-4 h-4 text-t-yellow" /> 大盘与行业雷达</h2>
              <span className="text-[10px] text-t-textDim">{realtimeQuotes.length ? '实时行情已接入' : '静态+实时混合'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {indexData.slice(0, 3).map(index => (
                <IndexTile key={index.code} name={index.name} price={index.price} changePct={index.changePct} />
              ))}
            </div>
            {marketContext && (
              <div className="mt-3 space-y-2 text-xs">
                <ActionLine label="市场状态" value={marketContext.summary} />
                <ActionLine label="行业强弱" value={`${marketContext.sectorName} ${formatPct(marketContext.sectorChange)}`} />
                <ActionLine label="风险预算" value={marketContext.riskBudget} />
              </div>
            )}
          </div>

          {holdingAdvice && <HoldingCard advice={holdingAdvice} />}
          {tradeGuard && <TradeGuardCard guard={tradeGuard} />}

          <div className="panel p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-t-green" />
              <h2 className="text-sm font-semibold text-t-textBright">风险清单</h2>
            </div>
            <div className="space-y-2">
              {(riskStocks.length ? riskStocks.slice(0, 5) : deskStocks.filter(stock => stock.score < 10).slice(0, 5)).map(stock => (
                <RiskRow key={stock.code} stock={stock} onPick={() => setSelectedCode(stock.code)} />
              ))}
            </div>
          </div>

          <div className="panel p-3 border border-t-yellow/25 bg-t-yellow/5">
            <div className="flex items-center gap-2 mb-2">
              <BellRing className="w-4 h-4 text-t-yellow" />
              <h2 className="text-sm font-semibold text-t-textBright">资讯雷达工作台</h2>
            </div>
            <div className="space-y-2 text-xs text-t-textSecondary">
              <p>重大资讯会被整理成交易姿态、主题热度、自选股影响矩阵和行动队列。</p>
              <p>盘中重点盯：宏观冲击、行业突发、个股利空、放量突破和跌破止损。</p>
              <div className="flex flex-wrap gap-3">
                <Link to="/intel" className="inline-flex items-center gap-1 text-t-yellow hover:underline">打开工作台 <ArrowUpRight className="w-3 h-3" /></Link>
                <Link to="/feishu" className="inline-flex items-center gap-1 text-t-blue hover:underline">检查飞书推送 <ArrowUpRight className="w-3 h-3" /></Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="px-3 py-2 border-b border-t-border flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2"><LineChart className="w-4 h-4 text-t-blue" /> 股票池作战台</h2>
          <div className="flex flex-wrap gap-1">
            <span className="px-2 py-0.5 rounded text-xs text-t-textDim border border-t-border">{deskSource === 'auto' ? `${deskModeMeta[deskMode].label}自动更新` : '核心池'}</span>
            {(['全部', ...laneOrder] as Array<DeskLane | '全部'>).map(lane => (
              <button key={lane} onClick={() => setActiveLane(lane)} className={`px-2 py-0.5 rounded text-xs ${activeLane === lane ? 'bg-t-blue text-white' : 'text-t-textDim hover:text-t-text'}`}>{lane}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-t-textDim border-b border-t-border">
                <th className="text-left px-3 py-2 font-medium">股票</th>
                <th className="text-left py-2 font-medium">状态</th>
                <th className="text-right py-2 font-medium">现价</th>
                <th className="text-right py-2 font-medium">涨跌幅</th>
                <th className="text-right py-2 font-medium">策略分</th>
                <th className="text-right py-2 font-medium">止损距</th>
                <th className="text-left py-2 font-medium">入选解释</th>
                <th className="text-left py-2 font-medium">今日动作</th>
                <th className="text-right py-2 pr-3 font-medium">入口</th>
              </tr>
            </thead>
            <tbody>
              {visibleStocks.map((stock, index) => (
                <tr key={stock.code} onClick={() => setSelectedCode(stock.code)} className={`border-b border-t-border/50 cursor-pointer ${selected?.code === stock.code ? 'bg-t-blue/10' : index % 2 ? 'bg-white/[0.015]' : ''} hover:bg-white/[0.04]`}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-t-textBright">{stock.name}</div>
                    <div className="text-[10px] text-t-textDim data-num">{stock.code} {stock.isRealtime && <span className="text-t-green">●</span>}</div>
                  </td>
                  <td className="py-2"><span className={`px-2 py-0.5 rounded border text-[10px] ${stock.laneTone}`}>{stock.lane}</span></td>
                  <td className={`py-2 text-right data-num font-semibold ${stock.changePct >= 0 ? 'text-t-red' : 'text-t-green'}`}>{formatPrice(stock.price)}</td>
                  <td className={`py-2 text-right data-num ${stock.changePct >= 0 ? 'text-t-red' : 'text-t-green'}`}>{formatPct(stock.changePct)}</td>
                  <td className={`py-2 text-right data-num ${stock.score >= 15 ? 'text-t-red' : stock.score <= -15 ? 'text-t-green' : 'text-t-yellow'}`}>{stock.score}</td>
                  <td className="py-2 text-right data-num text-t-textDim">{stock.riskDistance.toFixed(1)}%</td>
                  <td className="py-2 text-t-textSecondary">
                    <div className="truncate max-w-[260px]">{stock.modeReason}</div>
                    <div className="text-[10px] text-t-textDim truncate max-w-[260px]">{stock.intelLabel} · {stock.pickReason}</div>
                  </td>
                  <td className="py-2 text-t-textSecondary">{stock.action}</td>
                  <td className="py-2 pr-3 text-right"><Link onClick={event => event.stopPropagation()} to={`/analysis?code=${stock.code}`} className="text-t-blue hover:underline">分析</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatMoney(value: number) {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(2)}亿`;
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}万`;
  return `${sign}${abs.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function formatSignedMoney(value: number) {
  return value > 0 ? `+${formatMoney(value)}` : formatMoney(value);
}

function valueTone(value: number) {
  if (value > 0) return 'text-t-red';
  if (value < 0) return 'text-t-green';
  return 'text-t-textBright';
}

function briefTextTone(tone: BriefTone) {
  if (tone === 'red') return 'text-t-red';
  if (tone === 'green') return 'text-t-green';
  if (tone === 'yellow') return 'text-t-yellow';
  return 'text-t-blue';
}

function briefSurfaceTone(tone: BriefTone) {
  if (tone === 'red') return 'border-t-red/30 bg-t-red/5';
  if (tone === 'green') return 'border-t-green/30 bg-t-green/5';
  if (tone === 'yellow') return 'border-t-yellow/30 bg-t-yellow/5';
  return 'border-t-blue/30 bg-t-blue/5';
}

function DailyBriefPanel({ brief }: { brief: DailyOperationsBrief }) {
  const metricIcons = [Radar, BriefcaseBusiness, LineChart, ClipboardCheck];
  const postureTone = brief.posture === '进攻' ? 'text-t-red border-t-red/35 bg-t-red/10' : brief.posture === '防守' ? 'text-t-green border-t-green/35 bg-t-green/10' : 'text-t-yellow border-t-yellow/35 bg-t-yellow/10';

  return (
    <section className="panel overflow-hidden">
      <div className="px-4 py-3 border-b border-t-border bg-[#131722] flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-t-blue" /> 今日作战简报
          </h2>
          <p className="text-[11px] text-t-textDim mt-1 max-w-4xl">{brief.headline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-2 py-1 rounded border data-num ${postureTone}`}>{brief.posture}</span>
          <span className="text-t-textDim data-num">{brief.generatedAt}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-t-border">
        {brief.metrics.map((metric, index) => {
          const Icon = metricIcons[index] || Activity;
          return <CommandMetric key={metric.label} icon={Icon} label={metric.label} value={metric.value} tone={briefTextTone(metric.tone)} detail={metric.detail} />;
        })}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-0">
        <div className="p-3 border-r border-t-border">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-xs font-semibold text-t-textBright flex items-center gap-2"><ListChecks className="w-3.5 h-3.5 text-t-blue" /> 先做什么</h3>
            <span className="text-[10px] text-t-textDim">{brief.riskBudget}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {brief.actions.map(action => (
              <Link key={`${action.title}-${action.tag}`} to={action.href} className={`rounded border p-2 hover:bg-white/[0.04] transition-colors ${briefSurfaceTone(action.tone)}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-t-textBright leading-snug">{action.title}</span>
                  <span className={`shrink-0 text-[10px] data-num ${briefTextTone(action.tone)}`}>{action.tag}</span>
                </div>
                <div className="mt-1 text-[11px] text-t-textSecondary leading-relaxed line-clamp-2">{action.detail}</div>
              </Link>
            ))}
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-xs font-semibold text-t-textBright flex items-center gap-2"><Crosshair className="w-3.5 h-3.5 text-t-red" /> 重点盯盘</h3>
            <Link to="/intel" className="text-[11px] text-t-blue hover:underline">联动资讯雷达</Link>
          </div>
          <div className="space-y-2">
            {brief.focus.map(item => (
              <Link key={`${item.label}-${item.code}-${item.name}`} to={item.href} className="flex items-center justify-between gap-3 rounded border border-t-border bg-white/[0.02] p-2 hover:bg-white/[0.04]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-t-textBright truncate">{item.name}</span>
                    <span className="text-[10px] data-num text-t-textDim shrink-0">{item.code}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-t-textDim truncate">{item.detail}</div>
                </div>
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${briefSurfaceTone(item.tone)} ${briefTextTone(item.tone)}`}>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AccountOverviewPanel({
  summary,
  initialCapital,
  onCapitalChange,
}: {
  summary: AccountSummary;
  initialCapital: number;
  onCapitalChange: (value: number) => void;
}) {
  const topPositions = summary.positions.slice(0, 4);

  return (
    <section className="panel overflow-hidden">
      <div className="px-4 py-3 border-b border-t-border bg-[#131722] flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2">
            <WalletCards className="w-4 h-4 text-t-blue" /> 资金账户总览
          </h2>
          <p className="text-[11px] text-t-textDim mt-1">交易记录自动汇总现金、持仓、市值和浮盈亏，给组合仓位管理一个真实账户底座。</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-t-textDim">
          初始资金
          <input
            type="number"
            min={0}
            step={10000}
            value={initialCapital}
            onChange={event => {
              const value = Number(event.currentTarget.value);
              if (Number.isFinite(value) && value >= 0) onCapitalChange(value);
            }}
            className="w-28 rounded border border-t-border bg-[#0f131b] px-2 py-1 text-right text-t-textBright data-num outline-none focus:border-t-blue"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-t-border">
        <CommandMetric icon={WalletCards} label="账户总资产" value={formatMoney(summary.totalAssets)} tone={valueTone(summary.totalPnL)} detail={`总收益 ${formatSignedMoney(summary.totalPnL)} / ${formatPct(summary.totalReturnPct)}`} />
        <CommandMetric icon={Activity} label="今日盈亏" value={formatSignedMoney(summary.todayPnL)} tone={valueTone(summary.todayPnL)} detail={`已实现 ${formatSignedMoney(summary.realizedPnL)}`} />
        <CommandMetric icon={LineChart} label="持仓市值" value={formatMoney(summary.marketValue)} tone="text-t-blue" detail={`仓位 ${summary.investedPct.toFixed(1)}%`} />
        <CommandMetric icon={ShieldCheck} label="可用现金" value={formatMoney(summary.cash)} tone={summary.cash >= 0 ? 'text-t-yellow' : 'text-t-green'} detail={`现金 ${summary.availableCashPct.toFixed(1)}%`} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-0">
        <div className="p-3 border-r border-t-border">
          <h3 className="text-xs font-semibold text-t-textBright mb-2">账户仓位结构</h3>
          <div className="space-y-2">
            <AccountAllocationBar label="持仓" value={summary.investedPct} tone="bg-t-red" />
            <AccountAllocationBar label="现金" value={summary.availableCashPct} tone="bg-t-yellow" />
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <ActionLine label="浮动盈亏" value={formatSignedMoney(summary.unrealizedPnL)} />
              <ActionLine label="持仓数量" value={`${summary.positions.length}只`} />
            </div>
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-xs font-semibold text-t-textBright">持仓权重前列</h3>
            <Link to="/trades" className="text-[11px] text-t-blue hover:underline">维护交易记录</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {topPositions.length ? topPositions.map(position => (
              <Link key={position.code} to={`/analysis?code=${position.code}`} className="rounded border border-t-border bg-white/[0.02] p-2 hover:bg-white/[0.04]">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-t-textBright truncate">{position.name}</div>
                    <div className="text-[10px] text-t-textDim data-num">{position.code} · {position.shares}股</div>
                  </div>
                  <div className="text-right data-num">
                    <div className={`text-xs font-bold ${valueTone(position.unrealizedPnL)}`}>{formatPct(position.unrealizedPct)}</div>
                    <div className="text-[10px] text-t-textDim">{position.weight.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-t-textDim">
                  <span>市值 {formatMoney(position.marketValue)}</span>
                  <span className={valueTone(position.todayPnL)}>今日 {formatSignedMoney(position.todayPnL)}</span>
                </div>
              </Link>
            )) : (
              <Link to="/trades" className="md:col-span-2 rounded border border-dashed border-t-border bg-white/[0.02] p-3 text-xs text-t-textDim hover:text-t-text">
                暂无持仓。录入买卖记录后，这里会自动生成资金、仓位和持仓收益。
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AccountAllocationBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-t-textDim">{label}</span>
        <span className="data-num text-t-textBright">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function logToneClass(tone: StrategyPoolLog['tone']) {
  if (tone === 'red') return 'border-t-red/30 bg-t-red/5 text-t-red';
  if (tone === 'green') return 'border-t-green/30 bg-t-green/5 text-t-green';
  if (tone === 'yellow') return 'border-t-yellow/30 bg-t-yellow/5 text-t-yellow';
  return 'border-t-blue/30 bg-t-blue/5 text-t-blue';
}

function StrategyJournalPanel({ logs, current }: { logs: StrategyPoolLog[]; current: StrategyPoolSnapshotItem[] }) {
  return (
    <section className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-3">
      <div className="panel p-3">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2">
              <History className="w-4 h-4 text-t-yellow" /> 策略池换票日志
            </h2>
            <p className="text-[11px] text-t-textDim mt-0.5">自动池每次发生入选、出池、升级或降级，都会留下解释。</p>
          </div>
          <span className="text-[10px] text-t-textDim data-num">{logs.length} 条</span>
        </div>
        <div className="space-y-2">
          {logs.slice(0, 4).map(log => (
            <Link key={log.id} to={`/analysis?code=${log.code}`} className={`block rounded border p-2 hover:bg-white/[0.04] ${logToneClass(log.tone)}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-t-textBright truncate">{log.title}</span>
                <span className="text-[10px] data-num">{log.time}</span>
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-t-textSecondary line-clamp-2">{log.detail}</div>
            </Link>
          ))}
          {!logs.length && (
            <div className="rounded border border-t-border bg-white/[0.02] p-3 text-xs text-t-textDim">
              首次快照已建立。下一次行情或策略分变化导致名单变动时，会自动记录换票原因。
            </div>
          )}
        </div>
      </div>

      <div className="panel p-3">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2">
            <Target className="w-4 h-4 text-t-red" /> 当前候选触发层
          </h2>
          <Link to="/screener" className="text-[11px] text-t-blue hover:underline">进入筛选器</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {current.slice(0, 6).map(item => (
            <Link key={item.code} to={`/analysis?code=${item.code}`} className="rounded border border-t-border bg-white/[0.02] p-2 hover:bg-white/[0.04]">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] text-t-textDim data-num">#{item.rank} {item.code}</div>
                  <div className="text-xs font-semibold text-t-textBright truncate">{item.name}</div>
                </div>
                <span className={`text-sm font-bold data-num ${item.score >= 70 ? 'text-t-red' : 'text-t-yellow'}`}>{item.score}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                <span className="px-1 rounded bg-t-blue/10 text-t-blue">{item.strategy}</span>
                <span className={item.intelLabel.startsWith('行业') ? 'text-t-green' : item.intelLabel === '资讯0' ? 'text-t-textDim' : 'text-t-red'}>{item.intelLabel}</span>
                <span className="text-t-textDim">置信{item.confidence}%</span>
              </div>
              <div className="mt-1 text-[11px] text-t-textDim truncate">{item.reason}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ETFPickCard({ pick }: { pick: DailyStrategyPick }) {
  return (
    <Link to={`/analysis?code=${pick.code}`} className="p-3 min-h-[154px] border-r border-b border-t-border hover:bg-white/[0.035] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] data-num text-t-textDim">{pick.code}</div>
          <div className="text-sm font-semibold text-t-textBright truncate">{pick.name}</div>
          <div className="text-[11px] text-t-textDim mt-0.5">{pick.industry}</div>
        </div>
        <span className={`text-lg font-bold data-num ${pick.riskLevel === 'high' ? 'text-t-yellow' : pick.riskLevel === 'low' ? 'text-t-green' : 'text-t-blue'}`}>{pick.confidence}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="px-1.5 py-0.5 rounded bg-t-yellow/10 text-t-yellow border border-t-yellow/20">{pick.strategy}</span>
        <span className={pick.changePct >= 0 ? 'text-t-red data-num' : 'text-t-green data-num'}>{formatPct(pick.changePct)}</span>
      </div>
      <div className="mt-2 space-y-1 text-[11px] text-t-textDim">
        <div className="truncate">{pick.reason}</div>
        <div className="truncate">配置区 {pick.entry}</div>
        <div className="truncate">止损 {pick.stop} · 目标 {pick.target}</div>
        <div className="text-t-textSecondary line-clamp-2">{pick.execution}</div>
      </div>
    </Link>
  );
}

function CommandMetric({ icon: Icon, label, value, tone, detail }: { icon: typeof Activity; label: string; value: string; tone: string; detail: string }) {
  return (
    <div className="p-3 border-r border-t-border last:border-r-0">
      <div className="flex items-center gap-2 text-t-textDim text-xs"><Icon className="w-3.5 h-3.5" /> {label}</div>
      <div className={`mt-1 text-xl font-bold data-num ${tone}`}>{value}</div>
      <div className="text-[10px] text-t-textDim mt-0.5">{detail}</div>
    </div>
  );
}

function MarketRadarPanel({ report, deskMode }: { report: ReturnType<typeof buildMarketScanner>; deskMode: DeskMode }) {
  const mode = deskModeMeta[deskMode];
  return (
    <section className="panel overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-t-border">
        <CommandMetric icon={Radar} label="全市场热度" value={`${report.heat}%`} tone={report.heat >= 65 ? 'text-t-red' : report.heat <= 35 ? 'text-t-green' : 'text-t-yellow'} detail={`${report.rising}/${report.total} 上涨`} />
        <CommandMetric icon={Activity} label="强弱对比" value={`${report.strongCount}/${report.weakCount}`} tone={report.strongCount >= report.weakCount ? 'text-t-red' : 'text-t-green'} detail="涨超5% / 跌超5%" />
        <CommandMetric icon={Target} label="策略机会" value={`${report.strategyCounts.龙头突破 + report.strategyCounts.共振低吸 + report.strategyCounts.量价突破 + report.strategyCounts.趋势回踩}`} tone="text-t-blue" detail="非观察候选数量" />
        <CommandMetric icon={ShieldCheck} label="当前节奏" value={mode.label} tone="text-t-yellow" detail={mode.hint} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_0.9fr] gap-0">
        <div className="p-3 border-r border-t-border">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-semibold text-t-textBright">行业热度雷达</h2>
            <span className="text-[10px] text-t-textDim">按上涨占比、均涨幅、策略分排序</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {report.hotIndustries.slice(0, 4).map(item => <IndustryHeatRow key={item.industry} item={item} hot />)}
          </div>
        </div>
        <div className="p-3">
          <h2 className="text-sm font-semibold text-t-textBright mb-2">市场执行提示</h2>
          <div className="space-y-2">
            {report.notes.map(note => (
              <p key={note} className="text-xs text-t-textSecondary leading-relaxed">{note}</p>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {report.riskIndustries.slice(0, 2).map(item => <IndustryHeatRow key={item.industry} item={item} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

function PortfolioCommandPanel({ workbench }: { workbench: ReturnType<typeof buildPortfolioWorkbench> }) {
  const attack = workbench.layers.find(layer => layer.layer === '进攻');
  const defense = workbench.layers.find(layer => layer.layer === '防守');
  const etf = workbench.layers.find(layer => layer.layer === 'ETF');
  const watch = workbench.layers.find(layer => layer.layer === '观察');
  const stanceTone = workbench.stance === '进攻' ? 'text-t-red' : workbench.stance === '防守' ? 'text-t-green' : 'text-t-yellow';

  return (
    <section className="panel overflow-hidden">
      <div className="px-4 py-3 border-b border-t-border bg-[#131722] flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2">
            <BriefcaseBusiness className="w-4 h-4 text-t-blue" /> 组合级仓位管理
          </h2>
          <p className="text-[11px] text-t-textDim mt-1">把每日候选池拆成进攻、防守、ETF、观察四层，再用市场温度决定股票/ETF/现金目标仓。</p>
        </div>
        <Link to="/portfolio" className="inline-flex items-center gap-1 text-xs text-t-blue hover:underline">
          进入组合中枢 <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-t-border">
        <CommandMetric icon={Gauge} label="组合姿态" value={workbench.stance} tone={stanceTone} detail={`市场温度 ${workbench.marketHeat}%`} />
        <CommandMetric icon={Target} label="目标个股" value={`${workbench.targetStockPct}%`} tone="text-t-red" detail={`进攻${attack?.picks.length || 0} / 防守${defense?.picks.length || 0}`} />
        <CommandMetric icon={ShieldCheck} label="目标ETF" value={`${workbench.targetEtfPct}%`} tone="text-t-blue" detail={`${etf?.picks.length || 0}只ETF候选`} />
        <CommandMetric icon={Database} label="可信度" value={`${workbench.credibility.score}`} tone={workbench.credibility.level === '高' ? 'text-t-red' : workbench.credibility.level === '中' ? 'text-t-blue' : 'text-t-yellow'} detail={`${workbench.credibility.level}可信 · 观察${watch?.picks.length || 0}`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-0">
        <div className="p-3 border-r border-t-border">
          <h3 className="text-xs font-semibold text-t-textBright mb-2">仓位红绿灯</h3>
          <div className="space-y-2">
            <PortfolioBar label="个股" target={workbench.targetStockPct} current={workbench.currentStockPct} tone="bg-t-red" />
            <PortfolioBar label="ETF" target={workbench.targetEtfPct} current={workbench.currentEtfPct} tone="bg-t-blue" />
            <PortfolioBar label="现金" target={workbench.targetCashPct} current={workbench.currentCashPct} tone="bg-t-yellow" />
          </div>
        </div>
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {workbench.layers.map(layer => (
            <Link key={layer.layer} to="/portfolio" className="rounded border border-t-border bg-white/[0.02] p-2 hover:bg-white/[0.04]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-t-textBright">{layer.title}</span>
                <span className="data-num text-xs text-t-blue">{layer.budgetPct}%</span>
              </div>
              <div className="mt-1 text-[11px] text-t-textDim truncate">{layer.picks[0]?.name || '等待候选'} · {layer.riskRule}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function PortfolioBar({ label, target, current, tone }: { label: string; target: number; current: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-t-textDim">{label}</span>
        <span className="data-num text-t-textBright">当前 {current.toFixed(1)}% / 目标 {target}%</span>
      </div>
      <div className="h-1.5 rounded bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded ${tone}`} style={{ width: `${Math.min(100, target)}%` }} />
      </div>
    </div>
  );
}

function IndustryHeatRow({ item, hot = false }: { item: IndustryHeat; hot?: boolean }) {
  return (
    <Link to={`/screener`} className={`block rounded border p-2 ${hot ? 'border-t-red/25 bg-t-red/5' : 'border-t-border bg-white/[0.02]'} hover:bg-white/[0.04]`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-t-textBright truncate">{item.industry}</span>
        <span className={`data-num text-xs font-bold ${item.heat >= 60 ? 'text-t-red' : item.heat <= 35 ? 'text-t-green' : 'text-t-yellow'}`}>{item.heat}%</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-t-textDim truncate">{item.topName}</span>
        <span className={item.avgChange >= 0 ? 'text-t-red data-num' : 'text-t-green data-num'}>{formatPct(item.avgChange)}</span>
      </div>
    </Link>
  );
}

function KlineHealthPanel({ report, picks }: { report: KlineHealthReport; picks: DailyStrategyPick[] }) {
  const tone = report.status === 'healthy'
    ? 'text-t-green border-t-green/30'
    : report.status === 'watch'
      ? 'text-t-yellow border-t-yellow/30'
      : 'text-t-red border-t-red/30';
  const toneText = tone.split(' ')[0];
  const bestPicks = picks.slice(0, 3);

  return (
    <div className={`panel p-3 border ${tone}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2"><Database className="w-4 h-4 text-t-blue" /> 数据与量化体检</h2>
          <p className="text-[11px] text-t-textDim mt-0.5">{report.headline}</p>
        </div>
        <div className="text-right text-xs data-num">
          <div className={`font-bold ${toneText}`}>{report.avgQualityScore}</div>
          <div className="text-[10px] text-t-textDim">质量分</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3 text-[10px]">
        <Metric label="10年样本" value={`${report.tenYearCount}/${report.total}`} color="text-t-blue" />
        <Metric label="今日新鲜" value={`${report.freshCount}`} color="text-t-green" />
        <Metric label="需巡检" value={`${report.staleCount}`} color={report.staleCount ? 'text-t-yellow' : 'text-t-textBright'} />
        <Metric label="异常" value={`${report.badCount}`} color={report.badCount ? 'text-t-red' : 'text-t-textBright'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="rounded border border-t-border bg-white/[0.02] p-2">
          <div className="text-[10px] text-t-textDim mb-1">数据动作</div>
          <p className="text-xs text-t-textSecondary leading-relaxed">{report.action}</p>
        </div>
        <div className="rounded border border-t-border bg-white/[0.02] p-2">
          <div className="text-[10px] text-t-textDim mb-1">候选联动</div>
          <div className="space-y-1">
            {bestPicks.map(pick => (
              <div key={pick.code} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-t-textBright truncate">{pick.name}</span>
                <span className="data-num text-t-yellow">{pick.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded bg-white/[0.03] p-2">
      <div className="text-t-textDim">{label}</div>
      <div className={`data-num font-medium ${color}`}>{value}</div>
    </div>
  );
}

function AuditRow({ item }: { item: SystemAuditItem }) {
  const tone = item.status === 'done'
    ? 'text-t-green bg-t-green/10 border-t-green/25'
    : item.status === 'partial'
      ? 'text-t-yellow bg-t-yellow/10 border-t-yellow/25'
      : 'text-t-textDim bg-white/[0.02] border-t-border';
  const label = item.status === 'done' ? '完成' : item.status === 'partial' ? '部分' : '待做';
  return (
    <div className="border border-t-border rounded p-2 bg-white/[0.02]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-t-textBright truncate">{item.id}. {item.title}</span>
        <span className={`px-1.5 py-0.5 rounded border text-[10px] ${tone}`}>{label}</span>
      </div>
      <p className="mt-1 text-[11px] text-t-textDim leading-relaxed">{item.detail}</p>
    </div>
  );
}

function formatDashboardMoneyWan(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}亿`;
  return `${sign}${abs.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}万`;
}

function QuoteBlock({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <div className="text-[10px] text-t-textDim">{label}</div>
      <div className={`text-lg font-bold data-num ${tone}`}>{value}</div>
    </div>
  );
}

function ActionLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-t-textDim">{label}</span>
      <span className="text-t-textBright data-num text-right">{value}</span>
    </div>
  );
}

function IndexTile({ name, price, changePct }: { name: string; price: number; changePct: number }) {
  const up = changePct >= 0;
  return (
    <div className="border border-t-border rounded p-2 bg-white/[0.02]">
      <div className="text-[10px] text-t-textDim">{name}</div>
      <div className="text-sm font-semibold data-num text-t-textBright">{price.toLocaleString()}</div>
      <div className={`text-xs data-num flex items-center ${up ? 'text-t-red' : 'text-t-green'}`}>
        {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {formatPct(changePct)}
      </div>
    </div>
  );
}

function RiskRow({ stock, onPick }: { stock: DeskStock; onPick: () => void }) {
  return (
    <button onClick={onPick} className="w-full text-left flex items-center justify-between gap-2 border border-t-border rounded p-2 hover:bg-white/[0.03]">
      <div className="min-w-0">
        <div className="text-xs font-medium text-t-textBright truncate">{stock.name}</div>
        <div className="text-[10px] text-t-textDim truncate">{stock.action}</div>
      </div>
      <span className={`text-xs data-num ${stock.changePct >= 0 ? 'text-t-red' : 'text-t-green'}`}>{formatPct(stock.changePct)}</span>
    </button>
  );
}

function HoldingCard({ advice }: { advice: HoldingAdvice }) {
  const tone = advice.tone === 'red' ? 'text-t-red border-t-red/30' : advice.tone === 'green' ? 'text-t-green border-t-green/30' : advice.tone === 'yellow' ? 'text-t-yellow border-t-yellow/30' : 'text-t-blue border-t-blue/30';
  return (
    <div className={`panel p-3 border ${tone}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold text-t-textBright">持仓模式</h2>
        <span className={`text-xs font-bold ${tone.split(' ')[0]}`}>{advice.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
        <ActionLine label="浮盈亏" value={formatPct(advice.profitPct)} />
        <ActionLine label="市值" value={advice.marketValue ? advice.marketValue.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '-'} />
      </div>
      <div className="space-y-1.5 text-xs text-t-textSecondary">
        <p>{advice.baseAction}</p>
        <p>{advice.swingAction}</p>
        {advice.notes.map(note => <p key={note} className="text-[11px] text-t-textDim">{note}</p>)}
      </div>
    </div>
  );
}

function TradeGuardCard({ guard }: { guard: TradeGuard }) {
  const tone = guard.status === 'allow' ? 'text-t-red border-t-red/30' : guard.status === 'block' ? 'text-t-green border-t-green/30' : 'text-t-yellow border-t-yellow/30';
  return (
    <div className={`panel p-3 border ${tone}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold text-t-textBright">今日不可交易原因</h2>
        <span className={`text-xs font-bold ${tone.split(' ')[0]}`}>{guard.label}</span>
      </div>
      <div className="space-y-1.5 text-xs">
        {guard.reasons.length > 0 ? guard.reasons.slice(0, 4).map(reason => (
          <div key={reason} className="text-t-textSecondary">· {reason}</div>
        )) : <div className="text-t-textSecondary">主要条件通过，但仍按计划价和仓位上限执行。</div>}
      </div>
    </div>
  );
}

function MiniSparkline({ values, up }: { values: number[]; up: boolean }) {
  const width = 520;
  const height = 92;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = values.map((value, index) => {
    const x = values.length <= 1 ? 0 : index / (values.length - 1) * width;
    const y = height - (value - min) / range * (height - 10) - 5;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 rounded border border-t-border bg-[#0f131b]">
      <defs>
        <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={up ? '#ef4444' : '#22c55e'} stopOpacity="0.22" />
          <stop offset="100%" stopColor={up ? '#ef4444' : '#22c55e'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill="url(#sparkFill)" />
      <path d={path} fill="none" stroke={up ? '#ef4444' : '#22c55e'} strokeWidth="2" />
    </svg>
  );
}
