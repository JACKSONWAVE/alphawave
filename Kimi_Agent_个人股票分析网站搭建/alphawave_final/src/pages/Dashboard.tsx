import { useMemo, useState } from 'react';
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
  Crosshair,
  Database,
  Gauge,
  LineChart,
  Radar,
  RefreshCw,
  ShieldCheck,
  Target,
} from 'lucide-react';

import { calcMA, getCoreStockList, getKlineData, getMarketIndex, getStockList, getTrend, type TradeRecord } from '../data/mockData';
import { calcIndicatorScore, calcSupportResistance } from '../data/analysisEngine';
import { buildMarketContext } from '../data/marketContext';
import { formatPct, formatPrice } from '../data/price';
import { buildStrategyPlan } from '../data/strategyEngine';
import { buildHoldingAdvice, buildHoldingPositions, buildTradeGuard, type HoldingAdvice, type TradeGuard } from '../data/tradeGuard';
import { buildDailyStrategyPicks, buildETFStrategyPicks, type DailyStrategyPick } from '../data/strategyScreener';
import { buildMarketScanner, type IndustryHeat } from '../data/marketScanner';
import { buildDataFreshness, buildRequirementAudit, type SystemAuditItem } from '../data/systemAudit';
import { buildPortfolioWorkbench } from '../data/portfolioEngine';
import { useRealtimeQuotes } from '../hooks/useRealtime';
import { useLocalStorage } from '../hooks/useLocalStorage';
import RealtimeStatus from '../components/RealtimeStatus';

type DeskLane = '可试错' | '持仓观察' | '风险减仓' | '等待回踩';

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
}

const laneOrder: DeskLane[] = ['可试错', '持仓观察', '风险减仓', '等待回踩'];

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

function buildDeskStocks(staticStocks: ReturnType<typeof getCoreStockList>, realtimeQuotes: ReturnType<typeof useRealtimeQuotes>['quotes']): DeskStock[] {
  const rtMap = new Map(realtimeQuotes.map(quote => [quote.code, quote]));
  return staticStocks.map(stock => {
    const realtime = rtMap.get(stock.code);
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
    };
  });
}

export default function Dashboard() {
  const indexData = useMemo(() => getMarketIndex(), []);
  const allStocks = useMemo(() => getStockList(), []);
  const staticStocks = useMemo(() => getCoreStockList(), []);
  const stockOrder = useMemo(() => new Map(staticStocks.map((stock, index) => [stock.code, index])), [staticStocks]);
  const { quotes: realtimeQuotes, loading, refresh } = useRealtimeQuotes({});
  const [trades] = useLocalStorage<TradeRecord[]>('trades', []);
  const [activeLane, setActiveLane] = useState<DeskLane | '全部'>('全部');
  const [selectedCode, setSelectedCode] = useState(staticStocks[0]?.code || '603019.SH');

  const deskStocks = useMemo(() => buildDeskStocks(staticStocks, realtimeQuotes), [staticStocks, realtimeQuotes]);
  const holdings = useMemo(() => buildHoldingPositions(trades), [trades]);
  const portfolioWorkbench = useMemo(() => buildPortfolioWorkbench(trades), [trades]);
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
  const selectedPlan = useMemo(() => selected ? buildStrategyPlan(selected.code, selected.name, selectedRealtime) : null, [selected, selectedRealtime]);
  const selectedPosition = holdings.find(position => position.code === selected?.code) || null;
  const tradeGuard = selected && selectedPlan
    ? buildTradeGuard({ currentPrice: selected.price, plan: selectedPlan, scoreOverall: selected.score, marketHeat })
    : null;
  const holdingAdvice = selected && selectedPlan
    ? buildHoldingAdvice({ position: selectedPosition, currentPrice: selected.price, plan: selectedPlan, scoreOverall: selected.score, marketHeat })
    : null;
  const dailyPicks = useMemo(() => buildDailyStrategyPicks(10), [realtimeQuotes]);
  const etfPicks = useMemo(() => buildETFStrategyPicks(8), []);
  const marketScanner = useMemo(() => buildMarketScanner(), []);
  const auditItems = useMemo(() => buildRequirementAudit(), []);
  const freshness = useMemo(() => buildDataFreshness(), []);
  const doneCount = auditItems.filter(item => item.status === 'done').length;
  const partialCount = auditItems.filter(item => item.status === 'partial').length;
  const tenYearCount = freshness.filter(item => item.isTenYear).length;
  const freshCount = freshness.filter(item => item.isFresh).length;
  const healthyDataCount = freshness.filter(item => item.status === 'healthy').length;
  const dataRiskList = freshness
    .filter(item => item.status !== 'healthy')
    .sort((a, b) => a.qualityScore - b.qualityScore)
    .slice(0, 3);

  return (
    <div className="space-y-3">
      <RealtimeStatus />

      <MarketRadarPanel report={marketScanner} />

      <PortfolioCommandPanel workbench={portfolioWorkbench} />

      <section className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-t-border bg-[#131722] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2">
              <Target className="w-4 h-4 text-t-red" /> 今日全市场 Top 10 策略池
            </h2>
            <p className="text-[11px] text-t-textDim mt-1">从 {allStocks.length} 只沪深京股票中筛选，优先看龙头突破、量价突破、MACD/KDJ/RSI 共振和趋势回踩。</p>
          </div>
          <div className="text-right text-xs data-num">
            <div className="text-t-red font-bold">{dailyPicks.length} 只入选</div>
            <div className="text-t-textDim">全市场热度 {marketHeat}%</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-0">
          {dailyPicks.map((pick, index) => (
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

        <div className="panel p-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2"><Database className="w-4 h-4 text-t-blue" /> 数据与量化体检</h2>
              <p className="text-[11px] text-t-textDim mt-0.5">10 年数据、当日更新和策略胜率都在这里做第一层过滤。</p>
            </div>
            <div className="text-right text-xs data-num">
              <div className="text-t-blue font-bold">{tenYearCount}/{freshness.length} 十年样本</div>
              <div className="text-t-textDim">{freshCount} 只更新到今日 · {healthyDataCount} 健康</div>
            </div>
          </div>
          <div className="space-y-2">
            {dataRiskList.map(item => (
              <div key={item.code} className="grid grid-cols-[1fr_auto] gap-2 border border-t-yellow/25 rounded p-2 bg-t-yellow/5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-t-textBright">{item.name}</span>
                    <span className="text-[10px] text-t-textDim">{item.lastDate}</span>
                  </div>
                  <div className="text-[11px] text-t-textDim truncate">{item.note}</div>
                </div>
                <div className={`text-right data-num font-bold ${item.status === 'bad' ? 'text-t-green' : 'text-t-yellow'}`}>{item.qualityScore}</div>
              </div>
            ))}
            {dailyPicks.slice(0, 3).map(candidate => (
              <div key={candidate.code} className="grid grid-cols-[1fr_auto] gap-2 border border-t-border rounded p-2 bg-white/[0.02]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-t-textBright">{candidate.name}</span>
                    <span className="text-[10px] text-t-textDim">{candidate.strategy}</span>
                  </div>
                  <div className="text-[11px] text-t-textDim truncate">买区 {candidate.entry} · 止损 {candidate.stop} · 目标 {candidate.target}</div>
                </div>
                <div className="text-right data-num">
                  <div className={candidate.score >= 65 ? 'text-t-red font-bold' : 'text-t-yellow font-bold'}>{candidate.score}</div>
                  <div className="text-[10px] text-t-textDim">置信 {candidate.confidence}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
                <p className="text-xs text-t-textDim mt-1">先判断市场能不能做，再看个股是否触发计划。</p>
              </div>
              <button onClick={refresh} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-t-border text-xs text-t-textDim hover:text-t-text hover:bg-t-panelHover">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                同步实时
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-t-border">
            <CommandMetric icon={Activity} label="市场温度" value={`${marketHeat}%`} tone={marketHeat >= 65 ? 'text-t-red' : marketHeat <= 35 ? 'text-t-green' : 'text-t-yellow'} detail={`${rising}/${allStocks.length} 上涨`} />
            <CommandMetric icon={Crosshair} label="Top策略" value={`${dailyPicks.length}只`} tone="text-t-red" detail="全市场模型入选" />
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
                  <div className="text-[11px] text-t-textDim mt-1 truncate">{stock.action}</div>
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
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <ActionLine label="计划买区" value={`${formatPrice(selected.entryLow)}-${formatPrice(selected.entryHigh)}`} />
                      <ActionLine label="止损距离" value={`${selected.riskDistance.toFixed(1)}%`} />
                      <ActionLine label="止损 / 目标" value={`${formatPrice(selected.stopLoss)} / ${formatPrice(selected.target)}`} />
                      <ActionLine label="持仓建议" value={holdingAdvice?.label || selected.trendText} />
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

function MarketRadarPanel({ report }: { report: ReturnType<typeof buildMarketScanner> }) {
  return (
    <section className="panel overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-t-border">
        <CommandMetric icon={Radar} label="全市场热度" value={`${report.heat}%`} tone={report.heat >= 65 ? 'text-t-red' : report.heat <= 35 ? 'text-t-green' : 'text-t-yellow'} detail={`${report.rising}/${report.total} 上涨`} />
        <CommandMetric icon={Activity} label="强弱对比" value={`${report.strongCount}/${report.weakCount}`} tone={report.strongCount >= report.weakCount ? 'text-t-red' : 'text-t-green'} detail="涨超5% / 跌超5%" />
        <CommandMetric icon={Target} label="策略机会" value={`${report.strategyCounts.龙头突破 + report.strategyCounts.共振低吸 + report.strategyCounts.量价突破 + report.strategyCounts.趋势回踩}`} tone="text-t-blue" detail="非观察候选数量" />
        <CommandMetric icon={ShieldCheck} label="高风险候选" value={`${report.highRiskCount}`} tone={report.highRiskCount > report.total * 0.5 ? 'text-t-yellow' : 'text-t-green'} detail="仓位需要压缩" />
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
