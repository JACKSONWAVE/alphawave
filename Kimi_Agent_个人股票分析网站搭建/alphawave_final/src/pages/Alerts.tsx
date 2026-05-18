import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { getAlerts, getStockInfo, getStockList, saveAlerts } from '../data/mockData';
import type { AlertRule } from '../data/mockData';
import { formatPrice } from '../data/price';
import { useRealtimeQuotes } from '../hooks/useRealtime';

export default function Alerts() {
  const [showAdd, setShowAdd] = useState(false);
  const [alerts, setAlerts] = useState<AlertRule[]>(getAlerts());
  const [form, setForm] = useState({ code: '', type: 'above' as 'above' | 'below', price: '' });
  const [lastFired, setLastFired] = useState('');
  const stockList = getStockList();
  const codes = useMemo(() => Array.from(new Set(alerts.map(alert => alert.code))), [alerts]);
  const { quotes, loading, lastUpdate, refresh } = useRealtimeQuotes({ codes });

  const quoteMap = useMemo(() => new Map(quotes.map(quote => [quote.code, quote])), [quotes]);
  const priceOf = (code: string) => quoteMap.get(code)?.price ?? getStockInfo(code).price;

  const persist = (next: AlertRule[]) => {
    setAlerts(next);
    saveAlerts(next);
    window.dispatchEvent(new CustomEvent('alphawave:alerts-changed'));
  };

  const addAlert = () => {
    if (!form.code || !form.price) return;
    const stock = stockList.find(s => s.code === form.code);
    const newAlert: AlertRule = {
      id: Date.now().toString(),
      code: form.code,
      name: stock?.name || form.code,
      type: form.type,
      price: parseFloat(form.price),
      enabled: true,
    };
    persist([...alerts, newAlert]);
    setShowAdd(false);
    setForm({ code: '', type: 'above', price: '' });
  };

  const toggleAlert = (id: string) => {
    persist(alerts.map(alert => alert.id === id ? { ...alert, enabled: !alert.enabled } : alert));
  };

  const removeAlert = (id: string) => {
    persist(alerts.filter(alert => alert.id !== id));
  };

  const triggered = alerts.filter(alert => {
    if (!alert.enabled) return false;
    const price = priceOf(alert.code);
    return alert.type === 'above' ? price >= alert.price : price <= alert.price;
  });

  useEffect(() => {
    const onFired = (event: Event) => {
      const detail = (event as CustomEvent<{ rule: AlertRule }>).detail;
      if (detail?.rule) setLastFired(`${detail.rule.name} ${detail.rule.type === 'above' ? '突破' : '跌破'} ${formatPrice(detail.rule.price)}`);
    };
    window.addEventListener('alphawave:alert-fired', onFired);
    return () => window.removeEventListener('alphawave:alert-fired', onFired);
  }, []);

  return (
    <div className="space-y-3 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-t-textBright">价格预警</h1>
          <div className="text-[11px] text-t-textDim">
            {loading ? '实时行情同步中' : lastUpdate ? `最后同步 ${new Date(lastUpdate).toLocaleTimeString('zh-CN')}` : '等待实时行情'}
            {lastFired && <span className="text-t-red ml-2">{lastFired}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="px-3 py-1.5 rounded border border-t-border text-t-textDim text-xs hover:text-t-text flex items-center gap-1">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> 同步
          </button>
          <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 rounded bg-t-blue text-white text-xs hover:bg-blue-500 flex items-center gap-1">
            <Plus className="w-3 h-3" /> 添加预警
          </button>
        </div>
      </div>

      {triggered.length > 0 && (
        <div className="panel p-3 border border-t-red/30 bg-t-red/5">
          <h3 className="text-sm font-semibold text-t-red mb-2 flex items-center gap-1"><Bell className="w-3.5 h-3.5" /> 实时触发</h3>
          {triggered.map(alert => (
            <div key={alert.id} className="flex items-center justify-between gap-3 text-xs py-1">
              <span className="text-t-text">{alert.name} ({alert.code})</span>
              <span className="text-t-red font-medium">{alert.type === 'above' ? '突破' : '跌破'} {formatPrice(alert.price)}</span>
              <span className="text-t-textBright data-num">当前: {formatPrice(priceOf(alert.code))}</span>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="panel p-3 flex flex-wrap items-end gap-2">
          <select value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none min-w-[160px]">
            <option value="">选择股票</option>
            {stockList.map(stock => <option key={stock.code} value={stock.code}>{stock.code} {stock.name}</option>)}
          </select>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'above' | 'below' })} className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none">
            <option value="above">价格高于</option>
            <option value="below">价格低于</option>
          </select>
          <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="目标价格" className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none w-28" />
          <button onClick={addAlert} className="px-3 py-1 rounded bg-t-green text-white text-xs">保存</button>
          <button onClick={() => setShowAdd(false)} className="px-3 py-1 rounded text-t-textDim text-xs">取消</button>
        </div>
      )}

      <div className="panel">
        {alerts.length === 0 ? <div className="py-8 text-center text-t-textDim text-sm">暂无预警规则，点击上方添加</div> : (
          <table className="w-full text-xs">
            <thead><tr className="text-t-textDim border-b border-t-border">
              <th className="text-left px-3 py-2 font-medium">股票</th>
              <th className="text-left py-2 font-medium">条件</th>
              <th className="text-right py-2 font-medium">目标价</th>
              <th className="text-right py-2 font-medium">实时价</th>
              <th className="text-center py-2 font-medium">状态</th>
              <th className="text-center py-2 font-medium">操作</th>
            </tr></thead>
            <tbody>
              {alerts.map(alert => {
                const currentPrice = priceOf(alert.code);
                const isTriggered = alert.enabled && (alert.type === 'above' ? currentPrice >= alert.price : currentPrice <= alert.price);
                return <tr key={alert.id} className={`border-b border-t-border/50 hover:bg-white/[0.04] ${isTriggered ? 'bg-t-red/5' : ''}`}>
                  <td className="px-3 py-2">
                    <div className="text-t-text font-medium">{alert.name}</div>
                    <div className="text-[10px] text-t-textDim data-num">{alert.code}</div>
                  </td>
                  <td className="py-2 text-t-textDim">{alert.type === 'above' ? '高于' : '低于'}</td>
                  <td className="py-2 text-right data-num text-t-text">{formatPrice(alert.price)}</td>
                  <td className={`py-2 text-right data-num font-bold ${isTriggered ? 'text-t-red' : 'text-t-textBright'}`}>{formatPrice(currentPrice)}</td>
                  <td className="py-2 text-center">
                    <button onClick={() => toggleAlert(alert.id)} className={`px-2 py-0.5 rounded text-[10px] ${alert.enabled ? 'bg-t-green/15 text-t-green' : 'bg-t-textDim/15 text-t-textDim'}`}>
                      {alert.enabled ? '启用' : '停用'}
                    </button>
                  </td>
                  <td className="py-2 text-center">
                    <button onClick={() => removeAlert(alert.id)} className="text-t-textDim hover:text-t-red"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
