import { useState, useMemo, useCallback, useRef } from 'react';
import { Pencil, Move, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ComposedChart, Line, Bar, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from 'recharts';

import { getKlineData, getStockInfo, getStockList, calcMA, calcMACD, calcRSI, calcKDJ, calcBOLL, calcCCI, calcWR, generateSignals, getTrend } from '../data/mockData';
import { calcSupportResistance, calcIndicatorScore, analyzeDaily } from '../data/analysisEngine';
import { buildStrategyPlan } from '../data/strategyEngine';

type Indicator = 'ma' | 'macd' | 'rsi' | 'kdj' | 'boll' | 'cci' | 'wr';
type Period = 30 | 60 | 120 | 250 | 'all';
type DrawMode = 'line' | 'horizontal' | 'fibonacci' | 'clear';

interface DrawLine {
  id: string; type: DrawMode; points: { x: number; y: number }[];
  startX?: string; endX?: string; startY?: number; endY?: number;
}

export default function Analysis() {
  const [sp] = useSearchParams();
  const stockList = getStockList();
  const defaultCode = sp.get('code') || '603019.SH';
  const stock = getStockInfo(defaultCode);

  const [code, setCode] = useState(defaultCode);
  const [period, setPeriod] = useState<Period>(120);
  const [indicators, setIndicators] = useState<Indicator[]>(['ma', 'macd', 'cci']);
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null);
  const [drawLines, setDrawLines] = useState<DrawLine[]>([]);
  const [fibLevels, setFibLevels] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'chart' | 'signals'>('chart');
  const chartRef = useRef<HTMLDivElement>(null);

  const days = period === 'all' ? undefined : period;
  const kline = useMemo(() => getKlineData(code, days), [code, days]);
  const info = useMemo(() => getStockInfo(code), [code]);

  // 技术指标
  const calc = useMemo(() => {
    const ma5 = calcMA(kline, 5), ma10 = calcMA(kline, 10), ma20 = calcMA(kline, 20), ma60 = calcMA(kline, 60);
    const macd = calcMACD(kline); const rsi = calcRSI(kline, 14); const kdj = calcKDJ(kline);
    const boll = calcBOLL(kline); const cci = calcCCI(kline); const wr = calcWR(kline);
    return { ma5, ma10, ma20, ma60, macd, rsi, kdj, boll, cci, wr };
  }, [kline]);

  const signals = useMemo(() => generateSignals(kline), [kline]);
  const trend = useMemo(() => getTrend(kline), [kline]);
  const sr = useMemo(() => calcSupportResistance(kline), [kline]);
  const score = useMemo(() => calcIndicatorScore(kline), [kline]);
  const daily = useMemo(() => analyzeDaily(kline), [kline]);
  const plan = useMemo(() => buildStrategyPlan(code, info.name), [code, info.name]);

  // 构建图表数据
  const chartData = useMemo(() => {
    const signalMap = new Map(signals.map(s => [s.date, s]));
    return kline.map((d, i) => {
      const sig = signalMap.get(d.date);
      return {
        ...d, ma5: calc.ma5[i], ma10: calc.ma10[i], ma20: calc.ma20[i], ma60: calc.ma60[i],
        dif: calc.macd.dif[i], dea: calc.macd.dea[i], macd: calc.macd.macd[i],
        rsi: calc.rsi[i], k: calc.kdj.k[i], d: calc.kdj.d[i], j: calc.kdj.j[i],
        bollUpper: calc.boll.upper[i], bollMid: calc.boll.mid[i], bollLower: calc.boll.lower[i],
        cci: calc.cci[i], wr: calc.wr[i],
        buySignal: sig?.type === 'buy' ? d.low * 0.985 : null,
        sellSignal: sig?.type === 'sell' ? d.high * 1.015 : null,
      };
    });
  }, [kline, calc, signals]);

  const latest = kline[kline.length - 1];
  const prev = kline[kline.length - 2];
  const changePct = ((latest.close - prev.close) / prev.close * 100);

  const toggleIndicator = useCallback((ind: Indicator) => {
    setIndicators(prev => prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]);
  }, []);

  // 画线交互
  const handleChartClick = useCallback((e: any) => {
    if (!drawMode || !e || !e.activePayload) return;
    const payload = e.activePayload[0]?.payload;
    if (!payload) return;
    const idx = chartData.findIndex(d => d.date === payload.date);
    if (idx === -1) return;

    if (drawMode === 'clear') {
      setDrawLines([]); setFibLevels([]); setDrawMode(null); return;
    }

    if (drawMode === 'fibonacci') {
      const high = Math.max(...kline.slice(idx - 20, idx + 1).map(d => d.high));
      const low = Math.min(...kline.slice(idx - 20, idx + 1).map(d => d.low));
      setFibLevels([high, high - (high - low) * 0.236, high - (high - low) * 0.382, high - (high - low) * 0.5, high - (high - low) * 0.618, high - (high - low) * 0.786, low]);
      setDrawMode(null); return;
    }

    // 趋势线和水平线
    const yVal = drawMode === 'horizontal' ? payload.close : undefined;
    const newLine: DrawLine = { id: Date.now().toString(), type: drawMode, points: [{ x: idx, y: payload.close }], startX: payload.date, startY: yVal };
    setDrawLines(prev => [...prev, newLine]);
    if (drawLines.length > 0 && drawMode === 'line') {
      const last = drawLines[drawLines.length - 1];
      if (last.type === 'line' && last.points.length === 1) {
        setDrawLines(prev => prev.map((l, i) => i === prev.length - 1 ? { ...l, endX: payload.date, endY: payload.close } : l));
      }
    }
    setDrawMode(null);
  }, [drawMode, chartData, kline, drawLines]);

  const indsList: { key: Indicator; label: string }[] = [
    { key: 'ma', label: '均线' }, { key: 'macd', label: 'MACD' },
    { key: 'rsi', label: 'RSI' }, { key: 'kdj', label: 'KDJ' },
    { key: 'boll', label: '布林带' }, { key: 'cci', label: 'CCI' },
    { key: 'wr', label: 'WR' },
  ];

  const recentSignals = signals.slice(-10).reverse();

  return (
    <div className="space-y-3" ref={chartRef}>
      {/* 股票头部信息 */}
      <div className="panel p-3 flex flex-wrap items-center gap-3">
        <select value={code} onChange={e => setCode(e.target.value)} className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none max-w-[180px]">
          {stockList.map(s => <option key={s.code} value={s.code}>{s.code} {s.name}</option>)}
        </select>
        <div>
          <span className="text-base font-bold data-num text-t-textBright">{latest.close.toFixed(2)}</span>
          <span className={`ml-2 text-xs font-medium data-num ${changePct >= 0 ? 'text-t-red' : 'text-t-green'}`}>
            {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        </div>
        <div className="flex gap-2 text-xs text-t-textDim">
          {['open:开', 'high:高', 'low:低'].map(k => {
            const [key, label] = k.split(':');
            const val = latest[key as keyof typeof latest] as number;
            const color = key === 'high' ? 'text-t-red' : key === 'low' ? 'text-t-green' : 'text-t-text';
            return <span key={key}>{label} <span className={`${color} data-num`}>{val.toFixed(2)}</span></span>;
          })}
          <span>量 <span className="data-num">{(latest.volume / 10000).toFixed(0)}万</span></span>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${trend.trend === 'up' ? 'bg-t-red/15 text-t-red' : trend.trend === 'down' ? 'bg-t-green/15 text-t-green' : 'bg-t-yellow/15 text-t-yellow'}`}>
          {trend.trend === 'up' ? '上升趋势' : trend.trend === 'down' ? '下降趋势' : '横盘震荡'}
        </span>
        <div className="ml-auto flex gap-1">
          {([30, 60, 120, 250, 'all'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-2 py-0.5 rounded text-xs ${period === p ? 'bg-t-blue text-white' : 'text-t-textDim hover:text-t-text'}`}>
              {p === 'all' ? '全部' : p === 250 ? '年' : p === 120 ? '半' : p === 60 ? '季' : '月'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* 左侧：图表区域 */}
        <div className="lg:col-span-3 space-y-3">
          {/* 指标开关 */}
          <div className="panel p-2 flex flex-wrap items-center gap-1">
            {indsList.map(ind => (
              <button key={ind.key} onClick={() => toggleIndicator(ind.key)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${indicators.includes(ind.key) ? 'bg-t-blue/20 text-t-blue border border-t-blue/30' : 'text-t-textDim border border-t-border hover:text-t-text'}`}>
                {ind.label}
              </button>
            ))}
            <div className="w-px h-4 bg-t-border mx-1" />
            {/* 画线工具 */}
            {[
              { m: 'line' as DrawMode, l: '趋势线', icon: <Pencil className="w-3 h-3" /> },
              { m: 'horizontal' as DrawMode, l: '水平线', icon: <Move className="w-3 h-3" /> },
              { m: 'fibonacci' as DrawMode, l: '黄金分割', icon: <span className="text-[10px]">FIB</span> },
              { m: 'clear' as DrawMode, l: '清除', icon: <Trash2 className="w-3 h-3" /> },
            ].map(({ m, l, icon }) => (
              <button key={m} onClick={() => setDrawMode(drawMode === m ? null : m)}
                className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 ${drawMode === m ? 'bg-t-yellow/20 text-t-yellow border border-t-yellow/30' : 'text-t-textDim border border-t-border hover:text-t-text'}`}>
                {icon}{l}
              </button>
            ))}
          </div>

          {/* K线图 */}
          <div className="panel p-3">
            {drawMode && <div className="text-xs text-t-yellow mb-1">画线模式: {drawMode === 'line' ? '点击两点画趋势线' : drawMode === 'horizontal' ? '点击画水平线' : drawMode === 'fibonacci' ? '点击应用黄金分割' : '点击清除所有线'}</div>}
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} onClick={handleChartClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3f" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#2a2f3f' }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#2a2f3f' }} domain={['auto', 'auto']} width={50} />
                  <Tooltip contentStyle={{ background: '#1a1d29', border: '1px solid #2a2f3f', borderRadius: '6px', fontSize: '11px', color: '#d1d5db' }} />
                  <ReferenceArea y1={plan.entryZone.low} y2={plan.entryZone.high} fill="#22c55e" fillOpacity={0.06} />
                  <ReferenceArea y1={plan.target1} y2={plan.target2} fill="#3b82f6" fillOpacity={0.05} />
                  <ReferenceLine y={plan.entryZone.low} stroke="#22c55e" strokeDasharray="6 4" strokeOpacity={0.55} />
                  <ReferenceLine y={plan.entryZone.high} stroke="#22c55e" strokeDasharray="6 4" strokeOpacity={0.55} />
                  <ReferenceLine y={plan.stopLoss} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.75} />
                  <ReferenceLine y={plan.target1} stroke="#3b82f6" strokeDasharray="4 4" strokeOpacity={0.75} />

                  {fibLevels.map((level, i) => (
                    <ReferenceLine key={`fib-${i}`} y={level} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5} />
                  ))}

                  {indicators.includes('boll') && <>
                    <Line type="monotone" dataKey="bollUpper" stroke="#8b5cf6" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="bollMid" stroke="#6b7280" strokeWidth={1} dot={false} />
                    <Line type="monotone" dataKey="bollLower" stroke="#8b5cf6" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                  </>}

                  {indicators.includes('ma') && <>
                    <Line type="monotone" dataKey="ma5" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="MA5" />
                    <Line type="monotone" dataKey="ma10" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="MA10" />
                    <Line type="monotone" dataKey="ma20" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="MA20" />
                    <Line type="monotone" dataKey="ma60" stroke="#06b6d4" strokeWidth={1} dot={false} strokeDasharray="4 4" name="MA60" />
                  </>}

                  <Bar dataKey="volume" fill="#2a2f3f" fillOpacity={0.3} yAxisId="vol" />
                  <Line type="monotone" dataKey="close" stroke={changePct >= 0 ? '#ef4444' : '#22c55e'} strokeWidth={1.5} dot={false} name="收盘价" />
                  <Scatter dataKey="buySignal" fill="#ef4444" shape="triangle" name="买点" />
                  <Scatter dataKey="sellSignal" fill="#22c55e" shape="triangle" name="卖点" />
                  <YAxis yAxisId="vol" orientation="right" hide domain={[0, 'auto']} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 副图指标 */}
          {indicators.includes('macd') && <SubChart data={chartData} dataKey="macd" label="MACD" color="#3b82f6" lines={[{ key: 'dif', color: '#f59e0b' }, { key: 'dea', color: '#8b5cf6' }]} hasZero />}
          {indicators.includes('rsi') && <SubChart data={chartData} dataKey="rsi" label="RSI(14)" color="#3b82f6" domain={[0, 100]} refs={[{ y: 70, color: '#ef4444' }, { y: 30, color: '#22c55e' }]} />}
          {indicators.includes('kdj') && <SubChart data={chartData} label="KDJ(9,3,3)" lines={[{ key: 'k', color: '#f59e0b' }, { key: 'd', color: '#3b82f6' }, { key: 'j', color: '#22c55e' }]} />}
          {indicators.includes('cci') && <SubChart data={chartData} dataKey="cci" label="CCI(14)" color="#ec4899" hasZero refs={[{ y: 100, color: '#ef4444' }, { y: -100, color: '#22c55e' }]} />}
          {indicators.includes('wr') && <SubChart data={chartData} dataKey="wr" label="WR(14)" color="#14b8a6" domain={[-100, 0]} refs={[{ y: -20, color: '#ef4444' }, { y: -80, color: '#22c55e' }]} />}

        </div>

        {/* 右侧边栏 */}
        <div className="space-y-3">
          {/* 标签页切换 */}
          <div className="flex border-b border-t-border">
            {(['chart', 'signals'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-1.5 text-xs ${activeTab === tab ? 'text-t-blue border-b-2 border-t-blue' : 'text-t-textDim hover:text-t-text'}`}>
                {tab === 'chart' ? '关键价位' : '买卖信号'}
              </button>
            ))}
          </div>

          {activeTab === 'signals' ? (
            <div className="panel">
              <div className="px-3 py-2 border-b border-t-border flex justify-between">
                <h3 className="text-sm font-semibold text-t-textBright">买卖信号</h3>
                <span className="text-xs text-t-textDim">{signals.length}个</span>
              </div>
              <div className="max-h-[450px] overflow-y-auto scrollbar-thin">
                {recentSignals.map((sig, i) => (
                  <div key={i} className={`px-3 py-2 border-b border-t-border/30 flex gap-2 ${i % 2 ? 'bg-white/[0.02]' : ''}`}>
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${sig.type === 'buy' ? 'bg-t-red/20 text-t-red' : 'bg-t-green/20 text-t-green'}`}>
                      {sig.type === 'buy' ? '买' : '卖'}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs data-num">{sig.date.slice(5)}</span>
                        <span className="text-xs font-bold data-num text-t-textBright">{sig.price.toFixed(2)}</span>
                        <span className={`text-[10px] px-1 rounded ${sig.strength === 'strong' ? 'bg-t-red/20 text-t-red' : 'bg-t-yellow/20 text-t-yellow'}`}>
                          {sig.strength === 'strong' ? '强' : '中'}
                        </span>
                      </div>
                      <p className="text-[11px] text-t-textDim truncate">{sig.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 今日交易计划 */}
              <div className={`panel p-3 border ${plan.action === 'exit' || plan.action === 'reduce' ? 'border-t-green/40' : plan.bias === 'bullish' ? 'border-t-red/40' : 'border-t-yellow/40'}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-t-textBright">今日交易计划</h3>
                    <p className="text-[11px] text-t-textDim mt-0.5">{plan.summary}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap ${plan.bias === 'bullish' ? 'bg-t-red/15 text-t-red' : plan.bias === 'bearish' ? 'bg-t-green/15 text-t-green' : 'bg-t-yellow/15 text-t-yellow'}`}>
                    {plan.actionText}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px] mb-3">
                  <div className="bg-white/[0.03] rounded p-2">
                    <div className="text-t-textDim">置信度</div>
                    <div className="text-t-blue font-bold data-num text-sm">{plan.confidence}%</div>
                  </div>
                  <div className="bg-white/[0.03] rounded p-2">
                    <div className="text-t-textDim">盈亏比</div>
                    <div className={`font-bold data-num text-sm ${plan.riskReward >= 1.5 ? 'text-t-red' : 'text-t-yellow'}`}>{plan.riskReward}</div>
                  </div>
                  <div className="bg-white/[0.03] rounded p-2">
                    <div className="text-t-textDim">风险</div>
                    <div className="text-t-green font-bold data-num text-sm">{plan.riskPct}%</div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="text-t-textDim">{plan.entryZone.label}</span>
                    <span className="data-num text-t-green font-medium">{plan.entryZone.low}~{plan.entryZone.high}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-t-textDim">{plan.addZone.label}</span>
                    <span className="data-num text-t-blue font-medium">{plan.addZone.low}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-t-textDim">止损 / 目标</span>
                    <span className="data-num text-t-textBright">{plan.stopLoss} / {plan.target1}</span>
                  </div>
                  <div className="pt-1 text-[11px] text-t-textSecondary leading-relaxed">{plan.positionSize}</div>
                </div>
              </div>

              {/* 条件剧本 */}
              <div className="panel p-3">
                <h3 className="text-sm font-semibold text-t-textBright mb-2">走势剧本</h3>
                <div className="space-y-2">
                  {plan.scenarios.map(s => (
                    <div key={s.name} className="border border-t-border rounded p-2 bg-white/[0.02]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-t-text">{s.name}</span>
                        <span className="text-[10px] text-t-textDim data-num">{s.probability}%</span>
                      </div>
                      <p className="text-[11px] text-t-textDim leading-relaxed">{s.condition}</p>
                      <p className="text-[11px] text-t-textSecondary leading-relaxed mt-1">{s.action}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 波段策略 - 综合评分 */}
              <div className="panel p-3">
                <h3 className="text-sm font-semibold text-t-textBright mb-2">中期波段策略</h3>
                {/* 综合评分 */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`text-2xl font-bold data-num ${score.overall >= 30 ? 'text-t-red' : score.overall <= -30 ? 'text-t-green' : 'text-t-yellow'}`}>
                    {score.overall}
                  </div>
                  <div>
                    <div className={`text-xs font-medium ${score.overall >= 30 ? 'text-t-red' : score.overall <= -30 ? 'text-t-green' : 'text-t-yellow'}`}>
                      {score.signal === 'strong_buy' ? '强烈看多' : score.signal === 'buy' ? '看多' : score.signal === 'strong_sell' ? '强烈看空' : score.signal === 'sell' ? '看空' : '中性观望'}
                    </div>
                    <div className="w-20 h-1.5 bg-t-border rounded-full overflow-hidden mt-0.5">
                      <div className={`h-full rounded-full ${score.overall >= 0 ? 'bg-t-red' : 'bg-t-green'}`} style={{ width: `${Math.abs(score.overall)}%` }} />
                    </div>
                  </div>
                </div>
                {/* 关键价位 */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-t-textDim">🟢 强支撑</span>
                    <span className="text-t-green data-num font-bold">{sr.strongSupport}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-t-textDim">🟢 弱支撑</span>
                    <span className="text-t-green/70 data-num">{sr.weakSupport}</span>
                  </div>
                  <div className="h-px bg-t-border my-1" />
                  <div className="flex justify-between items-center">
                    <span className="text-t-textDim">⚪ 当前价</span>
                    <span className="text-t-textBright data-num font-bold">{sr.currentPrice}</span>
                  </div>
                  <div className="h-px bg-t-border my-1" />
                  <div className="flex justify-between items-center">
                    <span className="text-t-textDim">🔴 弱压力</span>
                    <span className="text-t-red/70 data-num">{sr.weakResistance}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-t-textDim">🔴 强压力</span>
                    <span className="text-t-red data-num font-bold">{sr.strongResistance}</span>
                  </div>
                  <div className="h-px bg-t-border my-1" />
                  <div className="flex justify-between items-center">
                    <span className="text-t-textDim">🎯 目标价</span>
                    <span className="text-t-blue data-num font-bold">{sr.targetPrice}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-t-textDim">🛑 止损位</span>
                    <span className="text-t-red data-num">{sr.stopLoss}</span>
                  </div>
                </div>
                {/* 指标分 */}
                <div className="mt-3 pt-2 border-t border-t-border">
                  <div className="text-[10px] text-t-textDim mb-1">指标评分</div>
                  <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-[10px]">
                    <div className="flex justify-between"><span className="text-t-textDim">MACD</span><span className={`data-num ${score.macdScore >= 0 ? 'text-t-red' : 'text-t-green'}`}>{score.macdScore}</span></div>
                    <div className="flex justify-between"><span className="text-t-textDim">RSI</span><span className={`data-num ${score.rsiScore >= 0 ? 'text-t-red' : 'text-t-green'}`}>{score.rsiScore}</span></div>
                    <div className="flex justify-between"><span className="text-t-textDim">KDJ</span><span className={`data-num ${score.kdjScore >= 0 ? 'text-t-red' : 'text-t-green'}`}>{score.kdjScore}</span></div>
                    <div className="flex justify-between"><span className="text-t-textDim">BOLL</span><span className={`data-num ${score.bollScore >= 0 ? 'text-t-red' : 'text-t-green'}`}>{score.bollScore}</span></div>
                    <div className="flex justify-between"><span className="text-t-textDim">MA</span><span className={`data-num ${score.maScore >= 0 ? 'text-t-red' : 'text-t-green'}`}>{score.maScore}</span></div>
                    <div className="flex justify-between"><span className="text-t-textDim">CCI</span><span className={`data-num ${score.cciScore >= 0 ? 'text-t-red' : 'text-t-green'}`}>{score.cciScore}</span></div>
                  </div>
                </div>
                {/* 策略建议 */}
                <div className="mt-3 pt-2 border-t border-t-border">
                  <div className="text-[10px] text-t-textDim mb-1">操作建议</div>
                  <div className="text-[11px] text-t-textSecondary leading-relaxed">
                    {score.overall >= 60 ? (
                      <>
                        <span className="text-t-red">📌 买入：</span>可在 {sr.weakSupport}~{sr.currentPrice} 分批建仓，目标 {sr.targetPrice}，止损 {sr.stopLoss}
                      </>
                    ) : score.overall >= 30 ? (
                      <>
                        <span className="text-t-red/70">📌 关注：</span>等回调至 {sr.weakSupport} 附近考虑，目标 {sr.targetPrice}
                      </>
                    ) : score.overall <= -60 ? (
                      <>
                        <span className="text-t-green">📌 卖出：</span>跌破 {sr.weakSupport} 减仓，止损 {sr.stopLoss}，反弹至 {sr.weakResistance} 减仓
                      </>
                    ) : score.overall <= -30 ? (
                      <>
                        <span className="text-t-green/70">📌 减仓：</span>趋势走弱，注意 {sr.stopLoss} 止损位
                      </>
                    ) : (
                      <>
                        <span className="text-t-yellow">📌 观望：</span>等待方向明确，支撑位 {sr.weakSupport}，压力位 {sr.weakResistance}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 当日分析 */}
              <div className="panel p-3">
                <h3 className="text-sm font-semibold text-t-textBright mb-2">当日分析</h3>
                <div className="space-y-2 text-xs text-t-textSecondary">
                  <div>{daily.priceChange}</div>
                  <div>{daily.volumeStatus}</div>
                  <div className="text-t-text">{daily.keyEvent}</div>
                  <div className="text-t-yellow mt-1">{daily.recommendation}</div>
                  <div className={`inline-flex px-1.5 py-0.5 rounded text-[10px] mt-1 ${daily.riskLevel === 'high' ? 'bg-t-red/15 text-t-red' : daily.riskLevel === 'medium' ? 'bg-t-yellow/15 text-t-yellow' : 'bg-t-green/15 text-t-green'}`}>
                    风险等级：{daily.riskLevel === 'high' ? '高' : daily.riskLevel === 'medium' ? '中' : '低'}
                  </div>
                </div>
              </div>

              {/* 趋势分析 */}
              <div className="panel p-3">
                <h3 className="text-sm font-semibold text-t-textBright mb-2">趋势分析</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-t-textDim">趋势方向</span>
                    <span className={trend.trend === 'up' ? 'text-t-red' : trend.trend === 'down' ? 'text-t-green' : 'text-t-yellow'}>
                      {trend.trend === 'up' ? '↑ 上升' : trend.trend === 'down' ? '↓ 下降' : '→ 横盘'}
                    </span>
                  </div>
                  <div className="flex justify-between"><span className="text-t-textDim">趋势强度</span>
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-1.5 bg-t-border rounded-full overflow-hidden">
                        <div className="h-full bg-t-blue rounded-full" style={{ width: `${trend.strength * 100}%` }} />
                      </div>
                      <span className="data-num">{(trend.strength * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between"><span className="text-t-textDim">60日涨幅</span>
                    {(() => { const chg = (latest.close - kline[Math.max(0, kline.length - 60)].close) / kline[Math.max(0, kline.length - 60)].close * 100; return <span className={chg >= 0 ? 'text-t-red' : 'text-t-green'}>{chg >= 0 ? '+' : ''}{chg.toFixed(1)}%</span>; })()}
                  </div>
                </div>
              </div>

              {/* 策略触发价 */}
              <div className="panel p-3">
                <h3 className="text-sm font-semibold text-t-textBright mb-2">飞书触发价</h3>
                <div className="space-y-1.5">
                  {plan.triggers.map(t => (
                    <div key={t.label} className="flex items-start justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className={`font-medium ${t.severity === 'danger' ? 'text-t-green' : t.severity === 'warning' ? 'text-t-yellow' : 'text-t-blue'}`}>{t.label}</div>
                        <div className="text-[10px] text-t-textDim truncate">{t.message}</div>
                      </div>
                      <span className="data-num text-t-textBright whitespace-nowrap">
                        {t.direction === 'above' ? '>' : '<'} {t.price}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 信号统计 */}
              <div className="panel p-3">
                <h3 className="text-sm font-semibold text-t-textBright mb-2">信号统计</h3>
                {(() => {
                  const bs = signals.filter(s => s.type === 'buy');
                  const ss = signals.filter(s => s.type === 'sell');
                  return <>
                    <div className="flex justify-between text-xs mb-1"><span className="text-t-textDim">买入</span><span className="text-t-red data-num">{bs.length}</span></div>
                    <div className="flex justify-between text-xs mb-2"><span className="text-t-textDim">卖出</span><span className="text-t-green data-num">{ss.length}</span></div>
                    <div className="h-2 bg-t-green/20 rounded-full overflow-hidden flex">
                      <div className="h-full bg-t-red rounded-l-full" style={{ width: `${(bs.length / Math.max(signals.length, 1) * 100) || 50}%` }} />
                    </div>
                  </>;
                })()}
              </div>

              {/* 回测参考 */}
              <div className="panel p-3">
                <h3 className="text-sm font-semibold text-t-textBright mb-2">回测参考</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between"><span className="text-t-textDim">样本</span><span className="data-num text-t-text">{plan.backtest.sampleSize}</span></div>
                  <div className="flex justify-between"><span className="text-t-textDim">胜率</span><span className="data-num text-t-red">{plan.backtest.winRate}%</span></div>
                  <div className="flex justify-between"><span className="text-t-textDim">平均收益</span><span className={`data-num ${plan.backtest.avgReturn >= 0 ? 'text-t-red' : 'text-t-green'}`}>{plan.backtest.avgReturn}%</span></div>
                  <div className="flex justify-between"><span className="text-t-textDim">平均持仓</span><span className="data-num text-t-text">{plan.backtest.avgHoldingDays}天</span></div>
                  <div className="flex justify-between"><span className="text-t-textDim">最好</span><span className="data-num text-t-red">{plan.backtest.bestReturn}%</span></div>
                  <div className="flex justify-between"><span className="text-t-textDim">最差</span><span className="data-num text-t-green">{plan.backtest.worstReturn}%</span></div>
                </div>
                <p className="text-[10px] text-t-textDim mt-2 leading-relaxed">回测只衡量历史技术信号表现，用来过滤低质量信号，不等同未来收益承诺。</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 副图组件
function SubChart({ data, dataKey, label, color, lines, hasZero, domain, refs }: {
  data: any[]; dataKey?: string; label: string; color?: string;
  lines?: { key: string; color: string }[]; hasZero?: boolean; domain?: [number, number]; refs?: { y: number; color: string }[];
}) {
  return (
    <div className="panel p-3">
      <div className="text-xs text-t-textDim mb-1">{label}</div>
      <div className="h-[100px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3f" />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#2a2f3f' }} tickFormatter={v => v.slice(5)} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#2a2f3f' }} domain={domain || ['auto', 'auto']} width={40} />
            <Tooltip contentStyle={{ background: '#1a1d29', border: '1px solid #2a2f3f', borderRadius: '6px', fontSize: '10px', color: '#d1d5db' }} />
            {hasZero && <ReferenceLine y={0} stroke="#353b50" />}
            {refs?.map(r => <ReferenceLine key={r.y} y={r.y} stroke={r.color} strokeDasharray="3 3" />)}
            {dataKey && <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} />}
            {lines?.map(l => <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={1} dot={false} />)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
