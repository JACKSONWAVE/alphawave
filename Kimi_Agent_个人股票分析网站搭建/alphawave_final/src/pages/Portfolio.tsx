import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowUpRight, BarChart3, BriefcaseBusiness, Gauge, Layers3, ShieldCheck, Target, WalletCards } from 'lucide-react';

import { buildPortfolioWorkbench, type LayeredStrategyPool, type PortfolioPositionPlan, type StrategyLayer } from '../data/portfolioEngine';
import { formatPct, formatPrice } from '../data/price';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { TradeRecord } from '../data/mockData';

const layerTone: Record<StrategyLayer, string> = {
  进攻: 'text-t-red border-t-red/30 bg-t-red/10',
  防守: 'text-t-green border-t-green/30 bg-t-green/10',
  ETF: 'text-t-blue border-t-blue/30 bg-t-blue/10',
  观察: 'text-t-yellow border-t-yellow/30 bg-t-yellow/10',
};

export default function Portfolio() {
  const [trades] = useLocalStorage<TradeRecord[]>('trades', []);
  const workbench = useMemo(() => buildPortfolioWorkbench(trades), [trades]);
  const [activeLayer, setActiveLayer] = useState<StrategyLayer>('进攻');
  const selectedLayer = workbench.layers.find(layer => layer.layer === activeLayer) || workbench.layers[0];

  return (
    <div className="space-y-3">
      <section className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-t-border bg-[#131722] flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-t-textBright flex items-center gap-2">
              <BriefcaseBusiness className="w-4 h-4 text-t-blue" />
              组合仓位中枢
            </h1>
            <p className="text-xs text-t-textDim mt-1">把ETF、个股、现金、候选池和回测可信度放到同一张投研工作台里。</p>
          </div>
          <div className={`px-2.5 py-1 rounded border text-xs font-semibold ${workbench.stance === '进攻' ? layerTone.进攻 : workbench.stance === '防守' ? layerTone.防守 : layerTone.观察}`}>
            今日姿态：{workbench.stance}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 border-b border-t-border">
          <TopMetric icon={Gauge} label="市场温度" value={`${workbench.marketHeat}%`} tone={workbench.marketHeat >= 62 ? 'text-t-red' : workbench.marketHeat <= 38 ? 'text-t-green' : 'text-t-yellow'} detail="决定组合风险预算" />
          <TopMetric icon={WalletCards} label="目标现金" value={`${workbench.targetCashPct}%`} tone="text-t-yellow" detail="现金不是闲置，是期权" />
          <TopMetric icon={Target} label="目标个股" value={`${workbench.targetStockPct}%`} tone="text-t-red" detail="进攻+防守股票仓" />
          <TopMetric icon={ShieldCheck} label="目标ETF" value={`${workbench.targetEtfPct}%`} tone="text-t-blue" detail="宽基、防守、主题ETF" />
          <TopMetric icon={BarChart3} label="可信度" value={`${workbench.credibility.score}`} tone={workbench.credibility.level === '高' ? 'text-t-red' : workbench.credibility.level === '中' ? 'text-t-blue' : 'text-t-yellow'} detail={`${workbench.credibility.level}可信 · ${workbench.credibility.sampleSize}笔`} />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-3">
        <div className="panel p-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2"><Activity className="w-4 h-4 text-t-blue" /> 组合收益曲线</h2>
              <p className="text-[11px] text-t-textDim mt-0.5">模型组合对比沪深300ETF，回撤线用于观察仓位压力。</p>
            </div>
            <span className="text-[10px] text-t-textDim">近180个交易样本</span>
          </div>
          <div className="h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={workbench.curve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3f" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#2a2f3f' }} tickFormatter={value => String(value).slice(5)} />
                <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#2a2f3f' }} domain={['auto', 'auto']} width={46} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#2a2f3f' }} domain={[-20, 0]} width={42} />
                <Tooltip contentStyle={{ background: '#1a1d29', border: '1px solid #2a2f3f', borderRadius: '6px', fontSize: '11px', color: '#d1d5db' }} />
                <Area yAxisId="right" type="monotone" dataKey="drawdown" name="回撤" stroke="#22c55e" fill="#22c55e" fillOpacity={0.12} />
                <Line yAxisId="left" type="monotone" dataKey="portfolio" name="组合" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="benchmark" name="沪深300ETF" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-3">
          <div className="panel p-3">
            <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2 mb-3"><Layers3 className="w-4 h-4 text-t-yellow" /> 目标仓位框架</h2>
            <div className="space-y-2">
              <AllocationBar label="个股" current={workbench.currentStockPct} target={workbench.targetStockPct} tone="bg-t-red" />
              <AllocationBar label="ETF" current={workbench.currentEtfPct} target={workbench.targetEtfPct} tone="bg-t-blue" />
              <AllocationBar label="现金" current={workbench.currentCashPct} target={workbench.targetCashPct} tone="bg-t-yellow" />
            </div>
            <div className="mt-3 space-y-1.5">
              {workbench.rebalanceNotes.map(note => (
                <p key={note} className="text-[11px] text-t-textSecondary leading-relaxed">{note}</p>
              ))}
            </div>
          </div>

          <div className="panel p-3 border border-t-blue/25 bg-t-blue/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-t-textBright">回测可信度</h2>
                <p className="text-[11px] text-t-textDim mt-1">胜率、利润因子、样本数量共同决定能放多大仓位。</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold data-num text-t-blue">{workbench.credibility.score}</div>
                <div className="text-[10px] text-t-textDim">{workbench.credibility.level}可信</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <MiniMetric label="平均胜率" value={`${workbench.credibility.avgWinRate}%`} tone="text-t-red" />
              <MiniMetric label="利润因子" value={String(workbench.credibility.avgProfitFactor)} tone="text-t-blue" />
              <MiniMetric label="最大回撤" value={`${workbench.credibility.maxDrawdown}%`} tone="text-t-green" />
            </div>
            <div className="mt-3 space-y-1">
              {workbench.credibility.notes.map(note => <p key={note} className="text-[11px] text-t-textDim leading-relaxed">{note}</p>)}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-3">
        <div className="panel overflow-hidden">
          <div className="px-3 py-2 border-b border-t-border flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-t-textBright">每日候选池分层</h2>
            <div className="flex flex-wrap gap-1">
              {workbench.layers.map(layer => (
                <button key={layer.layer} onClick={() => setActiveLayer(layer.layer)} className={`px-2 py-0.5 rounded border text-xs ${activeLayer === layer.layer ? layerTone[layer.layer] : 'text-t-textDim border-t-border hover:text-t-text'}`}>
                  {layer.layer}
                </button>
              ))}
            </div>
          </div>
          <LayerPanel layer={selectedLayer} />
        </div>

        <div className="panel overflow-hidden">
          <div className="px-3 py-2 border-b border-t-border flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-t-textBright">持仓再平衡队列</h2>
            <span className="text-[10px] data-num text-t-textDim">市值 {workbench.totalMarketValue.toLocaleString('zh-CN')}</span>
          </div>
          {workbench.positions.length > 0 ? <PositionTable positions={workbench.positions} /> : (
            <div className="p-5 text-xs text-t-textDim leading-relaxed">
              本地交易记录里还没有持仓，先使用上方模型组合做仓位演练。录入交易后，这里会自动显示当前权重、目标权重和再平衡动作。
              <div className="mt-3">
                <Link to="/trades" className="inline-flex items-center gap-1 text-t-blue hover:underline">录入交易 <ArrowUpRight className="w-3 h-3" /></Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function TopMetric({ icon: Icon, label, value, tone, detail }: { icon: typeof Gauge; label: string; value: string; tone: string; detail: string }) {
  return (
    <div className="p-3 border-r border-t-border last:border-r-0 min-w-0">
      <div className="flex items-center gap-2 text-t-textDim text-xs"><Icon className="w-3.5 h-3.5 flex-shrink-0" /> {label}</div>
      <div className={`mt-1 text-xl font-bold data-num truncate ${tone}`}>{value}</div>
      <div className="text-[10px] text-t-textDim mt-0.5 truncate">{detail}</div>
    </div>
  );
}

function AllocationBar({ label, current, target, tone }: { label: string; current: number; target: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs mb-1">
        <span className="text-t-textBright">{label}</span>
        <span className="data-num text-t-textDim">当前 {current.toFixed(1)}% / 目标 {target}%</span>
      </div>
      <div className="h-2 rounded bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded ${tone}`} style={{ width: `${Math.min(100, target)}%` }} />
      </div>
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded border border-t-border bg-white/[0.03] p-2">
      <div className="text-[10px] text-t-textDim">{label}</div>
      <div className={`mt-1 font-bold data-num ${tone}`}>{value}</div>
    </div>
  );
}

function LayerPanel({ layer }: { layer: LayeredStrategyPool }) {
  return (
    <div>
      <div className="p-3 border-b border-t-border bg-white/[0.015]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className={`inline-flex px-2 py-0.5 rounded border text-xs font-semibold ${layerTone[layer.layer]}`}>{layer.title}</div>
            <p className="mt-2 text-xs text-t-textSecondary leading-relaxed">{layer.trigger}</p>
            <p className="mt-1 text-[11px] text-t-yellow leading-relaxed">{layer.riskRule}</p>
          </div>
          <div className="text-right data-num">
            <div className="text-lg font-bold text-t-textBright">{layer.budgetPct}%</div>
            <div className="text-[10px] text-t-textDim">单标上限 {layer.maxSinglePct}%</div>
          </div>
        </div>
      </div>
      <div className="divide-y divide-t-border">
        {layer.picks.slice(0, 8).map(pick => (
          <Link key={pick.code} to={`/analysis?code=${pick.code}`} className="block p-3 hover:bg-white/[0.035]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-t-textBright truncate">{pick.name}</div>
                <div className="text-[10px] text-t-textDim data-num">{pick.code} · {pick.industry}</div>
              </div>
              <div className="text-right data-num">
                <div className={pick.score >= 60 ? 'text-t-red font-bold' : 'text-t-yellow font-bold'}>{pick.score}</div>
                <div className="text-[10px] text-t-textDim">置信 {pick.confidence}%</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-t-textDim">
              <span className="truncate">买区 {pick.entry}</span>
              <span className="truncate text-right">止损 {pick.stop}</span>
            </div>
            <p className="mt-1 text-[11px] text-t-textSecondary line-clamp-2">{pick.reason}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PositionTable({ positions }: { positions: PortfolioPositionPlan[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-t-textDim border-b border-t-border">
            <th className="text-left px-3 py-2 font-medium">持仓</th>
            <th className="text-left py-2 font-medium">层级</th>
            <th className="text-right py-2 font-medium">当前</th>
            <th className="text-right py-2 font-medium">目标</th>
            <th className="text-right py-2 font-medium">偏离</th>
            <th className="text-right py-2 font-medium">盈亏</th>
            <th className="text-left py-2 font-medium">动作</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position, index) => (
            <tr key={position.code} className={`border-b border-t-border/50 ${index % 2 ? 'bg-white/[0.02]' : ''} hover:bg-white/[0.04]`}>
              <td className="px-3 py-2">
                <Link to={`/analysis?code=${position.code}`} className="font-medium text-t-textBright hover:text-t-blue">{position.name}</Link>
                <div className="text-[10px] data-num text-t-textDim">{position.code} · {formatPrice(position.marketValue)}</div>
              </td>
              <td className="py-2"><span className={`px-1.5 py-0.5 rounded border text-[10px] ${layerTone[position.layer]}`}>{position.layer}</span></td>
              <td className="py-2 text-right data-num text-t-text">{position.currentWeight}%</td>
              <td className="py-2 text-right data-num text-t-blue">{position.targetWeight}%</td>
              <td className={`py-2 text-right data-num ${position.drift > 0 ? 'text-t-yellow' : 'text-t-blue'}`}>{position.drift > 0 ? '+' : ''}{position.drift}%</td>
              <td className={`py-2 text-right data-num ${position.profitPct >= 0 ? 'text-t-red' : 'text-t-green'}`}>{formatPct(position.profitPct)}</td>
              <td className="py-2 text-t-textSecondary">
                <div>{position.action}</div>
                <div className="text-[10px] text-t-textDim truncate max-w-[220px]">{position.reason}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
