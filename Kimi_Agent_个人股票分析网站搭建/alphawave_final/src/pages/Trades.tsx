import { useMemo, useState } from 'react';
import { AlertTriangle, DollarSign, Percent, Plus, Shield, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { getKlineData, getStockList } from '../data/mockData';
import type { TradeRecord } from '../data/mockData';
import { calcIndicatorScore } from '../data/analysisEngine';
import { calcTradeFee } from '../data/appSettings';
import { buildMarketContext } from '../data/marketContext';
import { buildMultiTimeframeReport } from '../data/multiTimeframe';
import { formatPct, formatPrice } from '../data/price';
import { buildStrategyPlan } from '../data/strategyEngine';
import { buildHoldingAdvice } from '../data/tradeGuard';
import { useLocalStorage } from '../hooks/useLocalStorage';
import StockPicker from '../components/StockPicker';

export default function Trades() {
  const stockList = useMemo(() => getStockList(), []);
  const [trades, setTrades] = useLocalStorage<TradeRecord[]>('trades', []);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ code: '', type: 'buy' as 'buy' | 'sell', price: '', shares: '', date: '', note: '' });

  const addTrade = () => {
    if (!form.code || !form.price || !form.shares || !form.date) return;
    const stock = stockList.find(s => s.code === form.code);
    const price = parseFloat(form.price);
    const shares = parseInt(form.shares);
    const fee = calcTradeFee(price, shares, form.type);
    setTrades(prev => [...prev, {
      id: Date.now().toString(), code: form.code, name: stock?.name || form.code,
      type: form.type, price, shares, date: form.date, fee, note: form.note,
    }]);
    setShowAdd(false);
    setForm({ code: '', type: 'buy', price: '', shares: '', date: '', note: '' });
  };

  const removeTrade = (id: string) => setTrades(prev => prev.filter(t => t.id !== id));

  // Calculate PnL
  const holdings = new Map<string, { shares: number; cost: number; trades: TradeRecord[] }>();
  trades.forEach(t => {
    const h = holdings.get(t.code) || { shares: 0, cost: 0, trades: [] };
    if (t.type === 'buy') {
      h.cost = (h.cost * h.shares + t.price * t.shares) / (h.shares + t.shares);
      h.shares += t.shares;
    } else {
      h.shares -= t.shares;
    }
    h.trades.push(t);
    holdings.set(t.code, h);
  });

  const totalBuy = trades.filter(t => t.type === 'buy').reduce((s, t) => s + t.price * t.shares, 0);
  const totalSell = trades.filter(t => t.type === 'sell').reduce((s, t) => s + t.price * t.shares, 0);

  const currentValue = Array.from(holdings.entries()).reduce((sum, [code, h]) => {
    if (h.shares <= 0) return sum;
    const stock = stockList.find(s => s.code === code);
    return sum + (stock?.price || h.cost) * h.shares;
  }, 0);

  const totalCost = Array.from(holdings.entries()).reduce((sum, [, h]) => {
    if (h.shares <= 0) return sum;
    return sum + h.cost * h.shares;
  }, 0);

  const unrealizedPnL = currentValue - totalCost;
  const totalReturn = totalCost > 0 ? (unrealizedPnL / totalCost * 100) : 0;
  const holdingRiskRows = Array.from(holdings.entries()).flatMap(([code, h]) => {
    if (h.shares <= 0) return [];
    const stock = stockList.find(s => s.code === code);
    const price = stock?.price || h.cost;
    const kline = getKlineData(code);
    const plan = buildStrategyPlan(code, stock?.name || code);
    const score = calcIndicatorScore(kline);
    const market = buildMarketContext(code, kline);
    const multiTimeframe = buildMultiTimeframeReport(kline);
    const position = { code, name: stock?.name || code, shares: h.shares, cost: h.cost, lastTradeDate: h.trades[h.trades.length - 1]?.date || '' };
    const advice = buildHoldingAdvice({
      position,
      currentPrice: price,
      plan,
      scoreOverall: score.overall,
      marketHeat: market.heat,
    });
    const marketValue = price * h.shares;
    const stopLossRisk = Math.max(0, price - plan.stopLoss) * h.shares;
    const concentration = currentValue > 0 ? marketValue / currentValue * 100 : 0;
    return [{
      ...position,
      price,
      marketValue,
      stopLoss: plan.stopLoss,
      stopLossRisk,
      concentration,
      advice,
      score: score.overall,
      multiScore: multiTimeframe.score,
      multiBias: multiTimeframe.bias,
    }];
  }).sort((a, b) => b.stopLossRisk - a.stopLossRisk);
  const riskCapital = holdingRiskRows.reduce((sum, row) => sum + row.stopLossRisk, 0);
  const riskCapitalPct = currentValue > 0 ? riskCapital / currentValue * 100 : 0;
  const maxConcentration = holdingRiskRows.reduce((max, row) => Math.max(max, row.concentration), 0);
  const stopHitCount = holdingRiskRows.filter(row => row.price <= row.stopLoss).length;
  const protectProfitCount = holdingRiskRows.filter(row => row.advice.label === '保护利润').length;

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: '总投入', value: totalBuy.toLocaleString('zh-CN', { maximumFractionDigits: 0 }), suffix: '元', color: 'text-t-text', icon: DollarSign },
          { label: '持仓市值', value: currentValue.toLocaleString('zh-CN', { maximumFractionDigits: 0 }), suffix: '元', color: 'text-t-blue', icon: TrendingUp },
          { label: '浮动盈亏', value: (unrealizedPnL >= 0 ? '+' : '') + unrealizedPnL.toLocaleString('zh-CN', { maximumFractionDigits: 0 }), suffix: '元', color: unrealizedPnL >= 0 ? 'text-t-red' : 'text-t-green', icon: unrealizedPnL >= 0 ? TrendingUp : TrendingDown },
          { label: '总收益率', value: (totalReturn >= 0 ? '+' : '') + totalReturn.toFixed(2), suffix: '%', color: totalReturn >= 0 ? 'text-t-red' : 'text-t-green', icon: Percent },
        ].map(s => (
          <div key={s.label} className="panel p-3 flex items-center gap-3">
            <s.icon className={`w-5 h-5 ${s.color}`} />
            <div>
              <div className="text-xs text-t-textDim">{s.label}</div>
              <div className={`text-sm font-bold ${s.color}`}>{s.value}{s.suffix}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="panel p-3 border border-t-blue/25">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-1">
              <Shield className="w-4 h-4 text-t-blue" /> 持仓风控中控
            </h2>
            <p className="text-[11px] text-t-textDim mt-0.5">按止损风险、单票集中度和多周期状态统一看组合风险。</p>
          </div>
          <div className={`text-right ${riskCapitalPct > 12 || stopHitCount > 0 ? 'text-t-green' : riskCapitalPct > 7 ? 'text-t-yellow' : 'text-t-blue'}`}>
            <div className="text-lg font-bold data-num">{riskCapitalPct.toFixed(1)}%</div>
            <div className="text-[10px]">组合止损风险</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
          <Metric label="风险资金" value={riskCapital.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} color={riskCapitalPct > 12 ? 'text-t-green' : 'text-t-textBright'} />
          <Metric label="最大单票" value={`${maxConcentration.toFixed(1)}%`} color={maxConcentration > 35 ? 'text-t-yellow' : 'text-t-blue'} />
          <Metric label="止损触发" value={`${stopHitCount}只`} color={stopHitCount > 0 ? 'text-t-green' : 'text-t-textBright'} />
          <Metric label="保护利润" value={`${protectProfitCount}只`} color={protectProfitCount > 0 ? 'text-t-red' : 'text-t-textDim'} />
        </div>
        {holdingRiskRows.length === 0 ? (
          <div className="rounded border border-t-border bg-white/[0.02] p-3 text-xs text-t-textDim">暂无持仓，风控中控会在记录买入后自动生成。</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {holdingRiskRows.slice(0, 3).map(row => (
              <div key={row.code} className="rounded border border-t-border bg-white/[0.03] p-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-t-textBright">{row.name}</div>
                    <div className="text-[10px] text-t-textDim data-num">{row.code}</div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${row.multiBias === 'bullish' ? 'bg-t-red/15 text-t-red' : row.multiBias === 'bearish' ? 'bg-t-green/15 text-t-green' : 'bg-t-yellow/15 text-t-yellow'}`}>
                    多周期 {row.multiScore > 0 ? '+' : ''}{row.multiScore}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-[11px]">
                  <Row label="止损" value={formatPrice(row.stopLoss)} color="text-t-green" />
                  <Row label="风险" value={row.stopLossRisk.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} color="text-t-yellow" />
                  <Row label="占比" value={`${row.concentration.toFixed(1)}%`} color="text-t-blue" />
                  <Row label="建议" value={row.advice.label} color={row.advice.tone === 'red' ? 'text-t-red' : row.advice.tone === 'green' ? 'text-t-green' : row.advice.tone === 'yellow' ? 'text-t-yellow' : 'text-t-blue'} />
                </div>
              </div>
            ))}
          </div>
        )}
        {(riskCapitalPct > 12 || stopHitCount > 0) && (
          <p className="text-[11px] text-t-yellow leading-relaxed mt-2 flex items-start gap-1">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> 组合风险偏高，优先降低止损已触发或多周期偏空的仓位。
          </p>
        )}
      </div>

      {/* Holdings */}
      <div className="panel">
        <div className="px-3 py-2 border-b border-t-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-t-textBright">当前持仓</h2>
          <span className="text-xs text-t-textDim">{Array.from(holdings.values()).filter(h => h.shares > 0).length}只</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-t-textDim border-b border-t-border">
              <th className="text-left px-3 py-2 font-medium">代码</th>
              <th className="text-left py-2 font-medium">名称</th>
              <th className="text-right py-2 font-medium">持仓</th>
              <th className="text-right py-2 font-medium">成本价</th>
              <th className="text-right py-2 font-medium">现价</th>
              <th className="text-right py-2 font-medium">市值</th>
              <th className="text-right py-2 font-medium">盈亏</th>
              <th className="text-right py-2 font-medium">盈亏率</th>
              <th className="text-left py-2 font-medium">持仓建议</th>
            </tr></thead>
            <tbody>
              {Array.from(holdings.entries()).map(([code, h]) => {
                if (h.shares <= 0) return null;
                const stock = stockList.find(s => s.code === code);
                const price = stock?.price || h.cost;
                const pnl = (price - h.cost) * h.shares;
                const pnlPct = h.cost > 0 ? ((price - h.cost) / h.cost * 100) : 0;
                const up = pnl >= 0;
                const kline = getKlineData(code);
                const plan = buildStrategyPlan(code, stock?.name || code);
                const score = calcIndicatorScore(kline);
                const market = buildMarketContext(code, kline);
                const advice = buildHoldingAdvice({
                  position: { code, name: stock?.name || code, shares: h.shares, cost: h.cost, lastTradeDate: h.trades[h.trades.length - 1]?.date || '' },
                  currentPrice: price,
                  plan,
                  scoreOverall: score.overall,
                  marketHeat: market.heat,
                });
                return <tr key={code} className="border-b border-t-border/50 hover:bg-white/[0.04]">
                  <td className="px-3 py-2 data-num text-t-textDim">{code}</td>
                  <td className="py-2 text-t-text font-medium">{stock?.name || code}</td>
                  <td className="py-2 text-right data-num text-t-text">{h.shares}</td>
                  <td className="py-2 text-right data-num text-t-textDim">{formatPrice(h.cost)}</td>
                  <td className={`py-2 text-right data-num font-bold ${price >= h.cost ? 'text-t-red' : 'text-t-green'}`}>{formatPrice(price)}</td>
                  <td className="py-2 text-right data-num text-t-textBright">{(price * h.shares).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</td>
                  <td className={`py-2 text-right data-num font-medium ${up ? 'text-t-red' : 'text-t-green'}`}>{up ? '+' : ''}{pnl.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</td>
                  <td className={`py-2 text-right data-num font-medium ${up ? 'text-t-red' : 'text-t-green'}`}>{formatPct(pnlPct)}</td>
                  <td className="py-2 text-t-textSecondary">
                    <div className="text-xs">{advice.label}</div>
                    <div className="text-[10px] text-t-textDim truncate max-w-[220px]">{advice.swingAction}</div>
                  </td>
                </tr>;
              })}
              {Array.from(holdings.values()).every(h => h.shares <= 0) && <tr><td colSpan={9} className="py-8 text-center text-t-textDim">暂无持仓</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trade Records */}
      <div className="panel">
        <div className="px-3 py-2 border-b border-t-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-t-textBright">交易记录</h2>
          <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1 rounded bg-t-blue text-white text-xs hover:bg-blue-500 transition-colors flex items-center gap-1">
            <Plus className="w-3 h-3" /> 记录交易
          </button>
        </div>

        {showAdd && (
          <div className="p-3 border-b border-t-border bg-white/[0.02]">
            <div className="flex flex-wrap items-end gap-2">
              <StockPicker stocks={stockList} value={form.code} onChange={code => setForm({ ...form, code })} className="w-64" />
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'buy' | 'sell' })} className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none">
                <option value="buy">买入</option>
                <option value="sell">卖出</option>
              </select>
              <input type="number" placeholder="价格" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none w-20 placeholder-t-textDim" />
              <input type="number" placeholder="股数" value={form.shares} onChange={e => setForm({ ...form, shares: e.target.value })} className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none w-20 placeholder-t-textDim" />
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none" />
              <input placeholder="备注" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none w-32 placeholder-t-textDim" />
              <button onClick={addTrade} className="px-3 py-1 rounded bg-t-green text-white text-xs hover:bg-green-600 transition-colors">保存</button>
              <button onClick={() => setShowAdd(false)} className="px-3 py-1 rounded text-t-textDim text-xs hover:text-t-text">取消</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-t-textDim border-b border-t-border">
              <th className="text-left px-3 py-2 font-medium">日期</th>
              <th className="text-left py-2 font-medium">代码</th>
              <th className="text-left py-2 font-medium">名称</th>
              <th className="text-center py-2 font-medium">方向</th>
              <th className="text-right py-2 font-medium">价格</th>
              <th className="text-right py-2 font-medium">股数</th>
              <th className="text-right py-2 font-medium">金额</th>
              <th className="text-right py-2 font-medium">手续费</th>
              <th className="text-left py-2 font-medium hidden md:table-cell">备注</th>
              <th className="text-center py-2 font-medium">操作</th>
            </tr></thead>
            <tbody>
              {[...trades].reverse().map((t, i) => (
                <tr key={t.id} className={`border-b border-t-border/50 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''} hover:bg-white/[0.04]`}>
                  <td className="px-3 py-2 data-num text-t-textDim">{t.date}</td>
                  <td className="py-2 data-num text-t-textDim">{t.code}</td>
                  <td className="py-2 text-t-text font-medium">{t.name}</td>
                  <td className="py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.type === 'buy' ? 'bg-t-red/15 text-t-red' : 'bg-t-green/15 text-t-green'}`}>
                      {t.type === 'buy' ? '买入' : '卖出'}
                    </span>
                  </td>
                  <td className="py-2 text-right data-num text-t-text">{formatPrice(t.price)}</td>
                  <td className="py-2 text-right data-num text-t-text">{t.shares}</td>
                  <td className="py-2 text-right data-num text-t-textBright">{(t.price * t.shares).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</td>
                  <td className="py-2 text-right data-num text-t-textDim">{formatPrice(t.fee)}</td>
                  <td className="py-2 text-t-textDim hidden md:table-cell">{t.note}</td>
                  <td className="py-2 text-center">
                    <button onClick={() => removeTrade(t.id)} className="text-t-textDim hover:text-t-red transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
              {trades.length === 0 && <tr><td colSpan={10} className="py-8 text-center text-t-textDim">暂无交易记录</td></tr>}
            </tbody>
          </table>
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

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-t-textDim">{label}</span>
      <span className={`data-num font-medium text-right ${color}`}>{value}</span>
    </div>
  );
}
