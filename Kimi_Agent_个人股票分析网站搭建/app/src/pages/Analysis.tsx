import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  calcBOLL,
  calcCCI,
  calcKDJ,
  calcMA,
  calcMACD,
  calcRSI,
  calcWR,
  generateSignals,
  getKlineData,
  getStockInfo,
  getStockList,
  getTrend,
} from '../data/mockData';
import { analyzeDaily, calcIndicatorScore, calcSupportResistance } from '../data/analysisEngine';
import { buildBacktestSuite, type StrategyBacktestResult } from '../data/backtestLab';
import { buildIntradayStrategy, type IntradayStrategy } from '../data/intradayStrategy';
import { buildMarketContext, type MarketContext } from '../data/marketContext';
import { formatPct, formatPrice } from '../data/price';
import { fetchIntradayMinutes } from '../data/realtimeApi';
import { intradayToKline, mergeRealtimeQuoteIntoKline, type IntradayPoint } from '../data/realtimeKline';
import { buildStrategyPlan, type StrategyPlan } from '../data/strategyEngine';
import { useRealtimeQuotes } from '../hooks/useRealtime';
import { ProKlineChart } from '../components/ProKlineChart';

type Indicator = 'ma' | 'macd' | 'rsi' | 'kdj' | 'boll' | 'cci' | 'wr';
type Period = 'intraday' | 30 | 60 | 120 | 250 | 'all';
type SideTab = 'plan' | 'signals' | 'backtest' | 'market';

const indicatorOptions: Array<{ key: Indicator; label: string }> = [
  { key: 'ma', label: 'MA均线' },
  { key: 'macd', label: 'MACD' },
  { key: 'rsi', label: 'RSI' },
  { key: 'kdj', label: 'KDJ' },
  { key: 'boll', label: 'BOLL' },
  { key: 'cci', label: 'CCI' },
  { key: 'wr', label: 'WR' },
];

const periods: Array<{ value: Period; label: string }> = [
  { value: 'intraday', label: '分时' },
  { value: 30, label: '月' },
  { value: 60, label: '季' },
  { value: 120, label: '半年' },
  { value: 250, label: '年' },
  { value: 'all', label: '全部' },
];

export default function Analysis() {
  const [searchParams] = useSearchParams();
  const defaultCode = searchParams.get('code') || '603019.SH';
  const [code, setCode] = useState(defaultCode);
  const [period, setPeriod] = useState<Period>(120);
  const [indicators, setIndicators] = useState<Indicator[]>(['ma', 'macd', 'cci']);
  const [sideTab, setSideTab] = useState<SideTab>('plan');
  const [showSignals, setShowSignals] = useState(() => localStorage.getItem('analysis_show_signals') !== '0');
  const [chartMode, setChartMode] = useState<'candle' | 'line'>('candle');
  const [intradayPoints, setIntradayPoints] = useState<IntradayPoint[]>([]);

  const stockList = getStockList();
  const realtimeCodes = useMemo(() => [code], [code]);
  const { quotes: realtimeQuotes, refresh: refreshRealtime } = useRealtimeQuotes({ codes: realtimeCodes, enabled: true });
  const realtimeQuote = realtimeQuotes.find(quote => quote.code === code);
  const days = period === 'all' || period === 'intraday' ? undefined : period;
  const rawKline = useMemo(() => getKlineData(code, days), [code, days]);
  const kline = useMemo(() => {
    if (period === 'intraday' && intradayPoints.length > 0) return intradayToKline(intradayPoints);
    return mergeRealtimeQuoteIntoKline(rawKline, realtimeQuote);
  }, [period, intradayPoints, rawKline, realtimeQuote]);
  const stockInfo = useMemo(() => getStockInfo(code), [code]);

  const calc = useMemo(() => {
    const ma5 = calcMA(kline, 5);
    const ma10 = calcMA(kline, 10);
    const ma20 = calcMA(kline, 20);
    const ma60 = calcMA(kline, 60);
    const macd = calcMACD(kline);
    const rsi = calcRSI(kline, 14);
    const kdj = calcKDJ(kline);
    const boll = calcBOLL(kline);
    const cci = calcCCI(kline);
    const wr = calcWR(kline);
    return { ma5, ma10, ma20, ma60, macd, rsi, kdj, boll, cci, wr };
  }, [kline]);

  const signals = useMemo(() => generateSignals(kline), [kline]);
  const chartData = useMemo(() => {
    const signalMap = new Map(signals.map(signal => [signal.date, signal]));
    return kline.map((item, index) => {
      const signal = signalMap.get(item.date);
      return {
        ...item,
        ma5: calc.ma5[index],
        ma10: calc.ma10[index],
        ma20: calc.ma20[index],
        ma60: calc.ma60[index],
        dif: calc.macd.dif[index],
        dea: calc.macd.dea[index],
        macd: calc.macd.macd[index],
        rsi: calc.rsi[index],
        k: calc.kdj.k[index],
        d: calc.kdj.d[index],
        j: calc.kdj.j[index],
        bollUpper: calc.boll.upper[index],
        bollMid: calc.boll.mid[index],
        bollLower: calc.boll.lower[index],
        cci: calc.cci[index],
        wr: calc.wr[index],
        buySignal: signal?.type === 'buy' ? item.low * 0.985 : null,
        sellSignal: signal?.type === 'sell' ? item.high * 1.015 : null,
      };
    });
  }, [kline, calc, signals]);

  const latest = kline[kline.length - 1];
  const previous = kline[kline.length - 2] || latest;
  const changePct = previous.close ? (latest.close - previous.close) / previous.close * 100 : 0;
  const trend = useMemo(() => getTrend(kline), [kline]);
  const supportResistance = useMemo(() => calcSupportResistance(kline), [kline]);
  const score = useMemo(() => calcIndicatorScore(kline), [kline]);
  const daily = useMemo(() => analyzeDaily(kline), [kline]);
  const plan = useMemo(() => buildStrategyPlan(code, stockInfo.name, realtimeQuote), [code, stockInfo.name, realtimeQuote]);
  const backtests = useMemo(() => buildBacktestSuite(kline), [kline]);
  const marketContext = useMemo(() => buildMarketContext(code, kline), [code, kline]);
  const intradayStrategy = useMemo(() => buildIntradayStrategy(intradayPoints), [intradayPoints]);

  useEffect(() => {
    localStorage.setItem('analysis_show_signals', showSignals ? '1' : '0');
  }, [showSignals]);

  useEffect(() => {
    if (period !== 'intraday') return;
    let active = true;
    fetchIntradayMinutes(code).then(points => {
      if (active) setIntradayPoints(points);
    });
    return () => { active = false; };
  }, [code, period, realtimeQuote?.time]);

  const toggleIndicator = (indicator: Indicator) => {
    setIndicators(current => current.includes(indicator) ? current.filter(item => item !== indicator) : [...current, indicator]);
  };

  return (
    <div className="space-y-3">
      <div className="panel p-3 flex flex-wrap items-center gap-3">
        <select value={code} onChange={event => setCode(event.target.value)} className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none max-w-[210px]">
          {stockList.map(stock => <option key={stock.code} value={stock.code}>{stock.code} {stock.name}</option>)}
        </select>
        <div>
          <span className="text-base font-bold data-num text-t-textBright">{formatPrice(latest.close)}</span>
          <span className={`ml-2 text-xs font-medium data-num ${changePct >= 0 ? 'text-t-red' : 'text-t-green'}`}>{formatPct(changePct)}</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-t-textDim">
          <span>开 <span className="data-num text-t-text">{formatPrice(latest.open)}</span></span>
          <span>高 <span className="data-num text-t-red">{formatPrice(latest.high)}</span></span>
          <span>低 <span className="data-num text-t-green">{formatPrice(latest.low)}</span></span>
          <span>量 <span className="data-num">{(latest.volume / 10000).toFixed(0)}万</span></span>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${trend.trend === 'up' ? 'bg-t-red/15 text-t-red' : trend.trend === 'down' ? 'bg-t-green/15 text-t-green' : 'bg-t-yellow/15 text-t-yellow'}`}>
          {trend.trend === 'up' ? '上升趋势' : trend.trend === 'down' ? '下降趋势' : '横盘震荡'}
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          {periods.map(item => (
            <button key={String(item.value)} onClick={() => setPeriod(item.value)} className={`px-2 py-0.5 rounded text-xs ${period === item.value ? 'bg-t-blue text-white' : 'text-t-textDim hover:text-t-text'}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-3 space-y-3">
          <div className="panel p-2 flex flex-wrap items-center gap-1">
            {indicatorOptions.map(indicator => (
              <button key={indicator.key} onClick={() => toggleIndicator(indicator.key)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${indicators.includes(indicator.key) ? 'bg-t-blue/20 text-t-blue border border-t-blue/30' : 'text-t-textDim border border-t-border hover:text-t-text'}`}>
                {indicator.label}
              </button>
            ))}
            <div className="w-px h-4 bg-t-border mx-1" />
            <button onClick={() => setShowSignals(value => !value)}
              className={`px-2 py-0.5 rounded text-xs transition-colors border ${showSignals ? 'bg-t-green/15 text-t-green border-t-green/30' : 'text-t-textDim border-t-border hover:text-t-text'}`}>
              买卖点
            </button>
            <button onClick={() => setChartMode(value => value === 'candle' ? 'line' : 'candle')}
              className={`px-2 py-0.5 rounded text-xs transition-colors border ${chartMode === 'candle' ? 'bg-t-red/15 text-t-red border-t-red/30' : 'text-t-textDim border-t-border hover:text-t-text'}`}>
              {chartMode === 'candle' ? '蜡烛图' : '收盘线'}
            </button>
            <button onClick={refreshRealtime} className="px-2 py-0.5 rounded text-xs transition-colors border border-t-border text-t-textDim hover:text-t-text flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> 同步实时
            </button>
          </div>

          <div className="panel p-3">
            <ProKlineChart data={chartData} indicators={indicators} showSignals={showSignals} chartMode={chartMode} plan={plan} />
          </div>

          {period === 'intraday' && intradayStrategy && <IntradayPanel strategy={intradayStrategy} />}

          {indicators.includes('macd') && <SubChart data={chartData} dataKey="macd" label="MACD" color="#3b82f6" lines={[{ key: 'dif', color: '#f59e0b' }, { key: 'dea', color: '#8b5cf6' }]} hasZero />}
          {indicators.includes('rsi') && <SubChart data={chartData} dataKey="rsi" label="RSI(14)" color="#3b82f6" domain={[0, 100]} refs={[{ y: 70, color: '#ef4444' }, { y: 30, color: '#22c55e' }]} />}
          {indicators.includes('kdj') && <SubChart data={chartData} label="KDJ(9,3,3)" lines={[{ key: 'k', color: '#f59e0b' }, { key: 'd', color: '#3b82f6' }, { key: 'j', color: '#22c55e' }]} />}
          {indicators.includes('cci') && <SubChart data={chartData} dataKey="cci" label="CCI(14)" color="#ec4899" hasZero refs={[{ y: 100, color: '#ef4444' }, { y: -100, color: '#22c55e' }]} />}
          {indicators.includes('wr') && <SubChart data={chartData} dataKey="wr" label="WR(14)" color="#14b8a6" domain={[-100, 0]} refs={[{ y: -20, color: '#ef4444' }, { y: -80, color: '#22c55e' }]} />}
        </div>

        <div className="space-y-3">
          <div className="flex border-b border-t-border">
            {(['plan', 'signals', 'backtest', 'market'] as SideTab[]).map(tab => (
              <button key={tab} onClick={() => setSideTab(tab)} className={`flex-1 py-1.5 text-xs ${sideTab === tab ? 'text-t-blue border-b-2 border-t-blue' : 'text-t-textDim hover:text-t-text'}`}>
                {tab === 'plan' ? '计划' : tab === 'signals' ? '信号' : tab === 'backtest' ? '回测' : '市场'}
              </button>
            ))}
          </div>
          {sideTab === 'plan' && <PlanPanel plan={plan} supportResistance={supportResistance} score={score} daily={daily} trend={trend} latest={latest} kline={kline} />}
          {sideTab === 'signals' && <SignalsPanel signals={signals} />}
          {sideTab === 'backtest' && <BacktestPanel results={backtests} />}
          {sideTab === 'market' && <MarketPanel context={marketContext} />}
        </div>
      </div>
    </div>
  );
}

function IntradayPanel({ strategy }: { strategy: IntradayStrategy }) {
  return (
    <div className="panel p-3 border border-t-blue/30 bg-t-blue/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-t-textBright">日内波段策略</h3>
          <p className="text-xs text-t-textSecondary mt-1 leading-relaxed">{strategy.action}</p>
        </div>
        <span className={`data-num text-lg font-bold ${strategy.score >= 25 ? 'text-t-red' : strategy.score <= -25 ? 'text-t-green' : 'text-t-yellow'}`}>{strategy.score}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
        <Metric label="触发" value={formatPrice(strategy.entry)} color="text-t-blue" />
        <Metric label="止损" value={formatPrice(strategy.stop)} color="text-t-green" />
        <Metric label="目标" value={formatPrice(strategy.target)} color="text-t-red" />
      </div>
      <div className="mt-2 space-y-1">
        {strategy.notes.map(note => <p key={note} className="text-[11px] text-t-textDim leading-relaxed">{note}</p>)}
      </div>
    </div>
  );
}

function PlanPanel({ plan, supportResistance, score, daily, trend, latest, kline }: {
  plan: StrategyPlan;
  supportResistance: ReturnType<typeof calcSupportResistance>;
  score: ReturnType<typeof calcIndicatorScore>;
  daily: ReturnType<typeof analyzeDaily>;
  trend: ReturnType<typeof getTrend>;
  latest: { close: number };
  kline: Array<{ close: number }>;
}) {
  const baseIndex = Math.max(0, kline.length - 60);
  const change60 = kline[baseIndex]?.close ? (latest.close - kline[baseIndex].close) / kline[baseIndex].close * 100 : 0;
  return (
    <div className="space-y-3">
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
          <Metric label="置信度" value={`${plan.confidence}%`} color="text-t-blue" />
          <Metric label="盈亏比" value={String(plan.riskReward)} color={plan.riskReward >= 1.5 ? 'text-t-red' : 'text-t-yellow'} />
          <Metric label="风险" value={`${plan.riskPct}%`} color="text-t-green" />
        </div>
        <div className="space-y-1.5 text-xs">
          <Row label={plan.entryZone.label} value={`${formatPrice(plan.entryZone.low)}~${formatPrice(plan.entryZone.high)}`} color="text-t-green" />
          <Row label={plan.addZone.label} value={formatPrice(plan.addZone.low)} color="text-t-blue" />
          <Row label="止损 / 目标" value={`${formatPrice(plan.stopLoss)} / ${formatPrice(plan.target1)}`} color="text-t-textBright" />
          <div className="pt-1 text-[11px] text-t-textSecondary leading-relaxed">{plan.positionSize}</div>
        </div>
      </div>

      <div className="panel p-3">
        <h3 className="text-sm font-semibold text-t-textBright mb-2">走势剧本</h3>
        <div className="space-y-2">
          {plan.scenarios.map(scenario => (
            <div key={scenario.name} className="border border-t-border rounded p-2 bg-white/[0.02]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-t-text">{scenario.name}</span>
                <span className="text-[10px] text-t-textDim data-num">{scenario.probability}%</span>
              </div>
              <p className="text-[11px] text-t-textDim leading-relaxed">{scenario.condition}</p>
              <p className="text-[11px] text-t-textSecondary leading-relaxed mt-1">{scenario.action}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-3">
        <h3 className="text-sm font-semibold text-t-textBright mb-2">中期波段策略</h3>
        <div className="flex items-center gap-2 mb-3">
          <div className={`text-2xl font-bold data-num ${score.overall >= 30 ? 'text-t-red' : score.overall <= -30 ? 'text-t-green' : 'text-t-yellow'}`}>{score.overall}</div>
          <div>
            <div className={`text-xs font-medium ${score.overall >= 30 ? 'text-t-red' : score.overall <= -30 ? 'text-t-green' : 'text-t-yellow'}`}>
              {score.signal === 'strong_buy' ? '强烈看多' : score.signal === 'buy' ? '看多' : score.signal === 'strong_sell' ? '强烈看空' : score.signal === 'sell' ? '看空' : '中性观察'}
            </div>
            <div className="w-20 h-1.5 bg-t-border rounded-full overflow-hidden mt-0.5">
              <div className={`h-full rounded-full ${score.overall >= 0 ? 'bg-t-red' : 'bg-t-green'}`} style={{ width: `${Math.abs(score.overall)}%` }} />
            </div>
          </div>
        </div>
        <Row label="强支撑" value={formatPrice(supportResistance.strongSupport)} color="text-t-green" />
        <Row label="弱支撑" value={formatPrice(supportResistance.weakSupport)} color="text-t-green/70" />
        <Row label="当前价" value={formatPrice(supportResistance.currentPrice)} color="text-t-textBright" />
        <Row label="弱压力" value={formatPrice(supportResistance.weakResistance)} color="text-t-red/70" />
        <Row label="强压力" value={formatPrice(supportResistance.strongResistance)} color="text-t-red" />
        <Row label="目标价" value={formatPrice(supportResistance.targetPrice)} color="text-t-blue" />
        <Row label="止损位" value={formatPrice(supportResistance.stopLoss)} color="text-t-red" />
      </div>

      <div className="panel p-3">
        <h3 className="text-sm font-semibold text-t-textBright mb-2">当日分析</h3>
        <div className="space-y-2 text-xs text-t-textSecondary">
          <div>{daily.priceChange}</div>
          <div>{daily.volumeStatus}</div>
          <div className="text-t-text">{daily.keyEvent}</div>
          <div className="text-t-yellow mt-1">{daily.recommendation}</div>
        </div>
      </div>

      <div className="panel p-3">
        <h3 className="text-sm font-semibold text-t-textBright mb-2">趋势分析</h3>
        <Row label="趋势方向" value={trend.trend === 'up' ? '上升' : trend.trend === 'down' ? '下降' : '横盘'} color={trend.trend === 'up' ? 'text-t-red' : trend.trend === 'down' ? 'text-t-green' : 'text-t-yellow'} />
        <Row label="趋势强度" value={`${(trend.strength * 100).toFixed(0)}%`} color="text-t-blue" />
        <Row label="60日涨幅" value={formatPct(change60)} color={change60 >= 0 ? 'text-t-red' : 'text-t-green'} />
      </div>

      <div className="panel p-3">
        <h3 className="text-sm font-semibold text-t-textBright mb-2">飞书触发价</h3>
        <div className="space-y-1.5">
          {plan.triggers.map(trigger => (
            <div key={trigger.label} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className={`font-medium ${trigger.severity === 'danger' ? 'text-t-green' : trigger.severity === 'warning' ? 'text-t-yellow' : 'text-t-blue'}`}>{trigger.label}</div>
                <div className="text-[10px] text-t-textDim truncate">{trigger.message}</div>
              </div>
              <span className="data-num text-t-textBright whitespace-nowrap">{trigger.direction === 'above' ? '>' : '<'} {formatPrice(trigger.price)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SignalsPanel({ signals }: { signals: ReturnType<typeof generateSignals> }) {
  const recentSignals = signals.slice(-40).reverse();
  return (
    <div className="panel">
      <div className="px-3 py-2 border-b border-t-border flex justify-between">
        <h3 className="text-sm font-semibold text-t-textBright">买卖信号</h3>
        <span className="text-xs text-t-textDim">{signals.length}个</span>
      </div>
      <div className="max-h-[560px] overflow-y-auto scrollbar-thin">
        {recentSignals.map((signal, index) => (
          <div key={`${signal.date}-${index}`} className={`px-3 py-2 border-b border-t-border/30 flex gap-2 ${index % 2 ? 'bg-white/[0.02]' : ''}`}>
            <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${signal.type === 'buy' ? 'bg-t-red/20 text-t-red' : 'bg-t-green/20 text-t-green'}`}>
              {signal.type === 'buy' ? '买' : '卖'}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs data-num">{signal.date.slice(5)}</span>
                <span className="text-xs font-bold data-num text-t-textBright">{formatPrice(signal.price)}</span>
                <span className={`text-[10px] px-1 rounded ${signal.strength === 'strong' ? 'bg-t-red/20 text-t-red' : 'bg-t-yellow/20 text-t-yellow'}`}>
                  {signal.strength === 'strong' ? '强' : signal.strength === 'medium' ? '中' : '弱'}
                </span>
              </div>
              <p className="text-[11px] text-t-textDim truncate">{signal.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BacktestPanel({ results }: { results: StrategyBacktestResult[] }) {
  const best = results[0];
  return (
    <div className="space-y-3">
      <div className="panel p-3 border border-t-blue/30 bg-t-blue/5">
        <h3 className="text-sm font-semibold text-t-textBright mb-1">策略回测实验室</h3>
        <p className="text-[11px] text-t-textSecondary leading-relaxed">趋势回踩、放量突破、超跌反弹、MACD低位金叉会在当前历史数据里统一回测，用来判断这只票更适合哪种打法。</p>
      </div>
      {results.length === 0 ? (
        <div className="panel p-3 text-xs text-t-textDim">历史样本不足，补齐10年数据后回测可信度会明显提升。</div>
      ) : results.map(result => (
        <div key={result.id} className={`panel p-3 border ${best?.id === result.id ? 'border-t-red/40' : 'border-t-border'}`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="text-sm font-semibold text-t-textBright">{result.name}</h3>
              <p className="text-[11px] text-t-textDim">{result.description}</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-white/[0.04] text-[10px] text-t-textSecondary">{result.style}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Row label="样本" value={String(result.sampleSize)} color="text-t-text" />
            <Row label="胜率" value={`${result.winRate}%`} color="text-t-red" />
            <Row label="均收" value={`${result.avgReturn}%`} color={result.avgReturn >= 0 ? 'text-t-red' : 'text-t-green'} />
            <Row label="回撤" value={`${result.maxDrawdown}%`} color="text-t-green" />
            <Row label="最好" value={`${result.bestReturn}%`} color="text-t-red" />
            <Row label="最差" value={`${result.worstReturn}%`} color="text-t-green" />
          </div>
          <p className="text-[11px] text-t-yellow mt-2 leading-relaxed">{result.verdict}</p>
        </div>
      ))}
    </div>
  );
}

function MarketPanel({ context }: { context: MarketContext }) {
  return (
    <div className="space-y-3">
      <div className={`panel p-3 border ${context.regime === 'risk_on' ? 'border-t-red/40' : context.regime === 'risk_off' ? 'border-t-green/40' : 'border-t-yellow/40'}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-t-textBright">大盘与行业联动</h3>
          <span className="data-num text-t-blue font-bold">{context.heat}</span>
        </div>
        <p className="text-xs text-t-textSecondary leading-relaxed">{context.summary}</p>
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <Metric label="行业" value={context.sectorName} color="text-t-textBright" />
          <Metric label="行业强弱" value={`${formatPct(context.sectorChange)} · ${context.sectorRank}`} color={context.sectorChange >= 0 ? 'text-t-red' : 'text-t-green'} />
        </div>
        <p className="text-[11px] text-t-yellow mt-2 leading-relaxed">{context.riskBudget}</p>
      </div>
      <InfoBlock title="市场温度" items={context.marketNotes} />
      <InfoBlock title="行业过滤" items={context.sectorNotes} />
      <InfoBlock title="宏观风险" items={context.macroRisks} />
      <InfoBlock title="交易习惯" items={context.tradeDiscipline} />
    </div>
  );
}

function SubChart({ data, dataKey, label, color, lines, hasZero, domain, refs }: {
  data: any[];
  dataKey?: string;
  label: string;
  color?: string;
  lines?: Array<{ key: string; color: string }>;
  hasZero?: boolean;
  domain?: [number, number];
  refs?: Array<{ y: number; color: string }>;
}) {
  return (
    <div className="panel p-3">
      <div className="text-xs text-t-textDim mb-1">{label}</div>
      <div className="h-[100px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3f" />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#2a2f3f' }} tickFormatter={value => String(value).slice(5)} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#2a2f3f' }} domain={domain || ['auto', 'auto']} width={40} />
            <Tooltip contentStyle={{ background: '#1a1d29', border: '1px solid #2a2f3f', borderRadius: '6px', fontSize: '10px', color: '#d1d5db' }} />
            {hasZero && <ReferenceLine y={0} stroke="#353b50" />}
            {refs?.map(ref => <ReferenceLine key={ref.y} y={ref.y} stroke={ref.color} strokeDasharray="3 3" />)}
            {dataKey && <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} connectNulls />}
            {lines?.map(line => <Line key={line.key} type="monotone" dataKey={line.key} stroke={line.color} strokeWidth={1} dot={false} connectNulls />)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="panel p-3">
      <h3 className="text-sm font-semibold text-t-textBright mb-2">{title}</h3>
      <div className="space-y-1.5">
        {items.map(item => <p key={item} className="text-[11px] text-t-textSecondary leading-relaxed">{item}</p>)}
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

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center gap-3 text-xs">
      <span className="text-t-textDim">{label}</span>
      <span className={`data-num font-medium ${color}`}>{value}</span>
    </div>
  );
}
