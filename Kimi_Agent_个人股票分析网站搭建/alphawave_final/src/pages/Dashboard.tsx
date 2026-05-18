import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  Bot,
  Crosshair,
  Gauge,
  LineChart,
  Radar,
  RefreshCw,
  ShieldCheck,
  Target,
} from 'lucide-react';

import { calcMA, getKlineData, getMarketIndex, getStockList, getTrend } from '../data/mockData';
import { calcIndicatorScore, calcSupportResistance } from '../data/analysisEngine';
import { buildMarketContext } from '../data/marketContext';
import { formatPct, formatPrice } from '../data/price';
import { buildStrategyPlan } from '../data/strategyEngine';
import { useRealtimeQuotes } from '../hooks/useRealtime';
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

function buildDeskStocks(staticStocks: ReturnType<typeof getStockList>, realtimeQuotes: ReturnType<typeof useRealtimeQuotes>['quotes']): DeskStock[] {
  const rtMap = new Map(realtimeQuotes.map(quote => [quote.code, quote]));
  return staticStocks.map(stock => {
    const realtime = rtMap.get(stock.code);
    const kline = getKlineData(stock.code);
    const latest = kline[kline.length - 1];
    const price = realtime?.price ?? stock.price;
    const change = realtime?.change ?? stock.change;
    const changePct = realtime?.changePct ?? stock.changePct;
    const ma20 = calcMA(kline, 20).at(-1);
    const ma60 = calcMA(kline, 60).at(-1);
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
  const indexData = getMarketIndex();
  const staticStocks = getStockList();
  const { quotes: realtimeQuotes, loading, refresh } = useRealtimeQuotes({});
  const [activeLane, setActiveLane] = useState<DeskLane | '全部'>('全部');
  const [selectedCode, setSelectedCode] = useState(staticStocks[0]?.code || '603019.SH');

  const deskStocks = useMemo(() => buildDeskStocks(staticStocks, realtimeQuotes), [staticStocks, realtimeQuotes]);
  const selected = deskStocks.find(stock => stock.code === selectedCode) || deskStocks[0];
  const visibleStocks = activeLane === '全部' ? deskStocks : deskStocks.filter(stock => stock.lane === activeLane);
  const actionStocks = deskStocks.filter(stock => stock.lane === '可试错').sort((a, b) => b.score - a.score);
  const riskStocks = deskStocks.filter(stock => stock.lane === '风险减仓').sort((a, b) => a.score - b.score);
  const rising = deskStocks.filter(stock => stock.changePct >= 0).length;
  const marketHeat = Math.round(rising / Math.max(deskStocks.length, 1) * 100);
  const marketContext = useMemo(() => selected ? buildMarketContext(selected.code, getKlineData(selected.code)) : null, [selected]);
  const command = actionStocks[0] || selected;

  return (
    <div className="space-y-3">
      <RealtimeStatus />

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
            <CommandMetric icon={Activity} label="市场温度" value={`${marketHeat}%`} tone={marketHeat >= 65 ? 'text-t-red' : marketHeat <= 35 ? 'text-t-green' : 'text-t-yellow'} detail={`${rising}/${deskStocks.length} 上涨`} />
            <CommandMetric icon={Crosshair} label="可操作" value={`${actionStocks.length}只`} tone="text-t-red" detail="符合试错条件" />
            <CommandMetric icon={ShieldCheck} label="风险票" value={`${riskStocks.length}只`} tone={riskStocks.length ? 'text-t-green' : 'text-t-text'} detail="需减仓/止损关注" />
            <CommandMetric icon={Bot} label="飞书状态" value="待命" tone="text-t-blue" detail="策略/资讯推送入口" />
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
                      <QuoteBlock label="盈亏比" value={String(selected.riskReward)} tone={selected.riskReward >= 1.5 ? 'text-t-red' : 'text-t-yellow'} />
                    </div>
                  </div>

                  <div className="mt-4">
                    <MiniSparkline values={selected.spark} up={selected.changePct >= 0} />
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <ActionLine label="计划买区" value={`${formatPrice(selected.entryLow)}-${formatPrice(selected.entryHigh)}`} />
                      <ActionLine label="止损距离" value={`${selected.riskDistance.toFixed(1)}%`} />
                      <ActionLine label="止损 / 目标" value={`${formatPrice(selected.stopLoss)} / ${formatPrice(selected.target)}`} />
                      <ActionLine label="趋势状态" value={selected.trendText} />
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

          <div className="panel p-3">
            <div className="flex items-center gap-2 mb-2">
              <BellRing className="w-4 h-4 text-t-blue" />
              <h2 className="text-sm font-semibold text-t-textBright">资讯/预警待办</h2>
            </div>
            <div className="space-y-2 text-xs text-t-textSecondary">
              <p>关注池出现重大资讯时，优先推送：事件性质、影响方向、对应仓位动作。</p>
              <p>盘中重点盯：放量突破、跌破止损、行业异动、大盘成交额过热。</p>
              <Link to="/feishu" className="inline-flex items-center gap-1 text-t-blue hover:underline">检查飞书推送 <ArrowUpRight className="w-3 h-3" /></Link>
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

function CommandMetric({ icon: Icon, label, value, tone, detail }: { icon: typeof Activity; label: string; value: string; tone: string; detail: string }) {
  return (
    <div className="p-3 border-r border-t-border last:border-r-0">
      <div className="flex items-center gap-2 text-t-textDim text-xs"><Icon className="w-3.5 h-3.5" /> {label}</div>
      <div className={`mt-1 text-xl font-bold data-num ${tone}`}>{value}</div>
      <div className="text-[10px] text-t-textDim mt-0.5">{detail}</div>
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
