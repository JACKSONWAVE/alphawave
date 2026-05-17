import { useState } from 'react';
import { Plus, Trash2, Bell, BellOff } from 'lucide-react';
import { getStockList, getStockInfo, getAlerts, saveAlerts } from '../data/mockData';
import type { AlertRule } from '../data/mockData';

export default function Alerts() {
  const [showAdd, setShowAdd] = useState(false);
  const [alerts, setAlerts] = useState<AlertRule[]>(getAlerts());
  const [form, setForm] = useState({ code: '', type: 'above' as 'above' | 'below', price: '' });
  const stockList = getStockList();

  const addAlert = () => {
    if (!form.code || !form.price) return;
    const stock = stockList.find(s => s.code === form.code);
    const newAlert: AlertRule = {
      id: Date.now().toString(), code: form.code, name: stock?.name || form.code,
      type: form.type, price: parseFloat(form.price), enabled: true,
    };
    const updated = [...alerts, newAlert];
    setAlerts(updated); saveAlerts(updated);
    setShowAdd(false); setForm({ code: '', type: 'above', price: '' });
  };

  const toggleAlert = (id: string) => {
    const updated = alerts.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
    setAlerts(updated); saveAlerts(updated);
  };

  const removeAlert = (id: string) => {
    const updated = alerts.filter(a => a.id !== id);
    setAlerts(updated); saveAlerts(updated);
  };

  const triggered = alerts.filter(a => {
    if (!a.enabled) return false;
    const info = getStockInfo(a.code);
    return a.type === 'above' ? info.price >= a.price : info.price <= a.price;
  });

  return (
    <div className="space-y-3 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-t-textBright">价格预警</h1>
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 rounded bg-t-blue text-white text-xs hover:bg-blue-500 flex items-center gap-1">
          <Plus className="w-3 h-3" /> 添加预警
        </button>
      </div>

      {triggered.length > 0 && (
        <div className="panel p-3 border border-t-red/30 bg-t-red/5">
          <h3 className="text-sm font-semibold text-t-red mb-2 flex items-center gap-1"><Bell className="w-3.5 h-3.5" /> 已触发预警</h3>
          {triggered.map(a => (
            <div key={a.id} className="flex items-center justify-between text-xs py-1">
              <span className="text-t-text">{a.name} ({a.code})</span>
              <span className="text-t-red font-medium">已{a.type === 'above' ? '突破' : '跌破'} {a.price.toFixed(2)}</span>
              <span className="text-t-textBright data-num">当前: {getStockInfo(a.code).price.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="panel p-3 flex flex-wrap items-end gap-2">
          <select value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none min-w-[140px]">
            <option value="">选择股票</option>
            {stockList.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'above' | 'below' })} className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none">
            <option value="above">价格高于</option>
            <option value="below">价格低于</option>
          </select>
          <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="目标价格" className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none w-24" />
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
              <th className="text-right py-2 font-medium">当前价</th>
              <th className="text-center py-2 font-medium">状态</th>
              <th className="text-center py-2 font-medium">操作</th>
            </tr></thead>
            <tbody>
              {alerts.map(a => {
                const info = getStockInfo(a.code);
                const isTriggered = a.type === 'above' ? info.price >= a.price : info.price <= a.price;
                return <tr key={a.id} className={`border-b border-t-border/50 hover:bg-white/[0.04] ${isTriggered ? 'bg-t-red/5' : ''}`}>
                  <td className="px-3 py-2 text-t-text font-medium">{a.name}</td>
                  <td className="py-2 text-t-textDim">{a.type === 'above' ? '高于' : '低于'}</td>
                  <td className="py-2 text-right data-num text-t-text">{a.price.toFixed(2)}</td>
                  <td className={`py-2 text-right data-num font-bold ${isTriggered ? 'text-t-red' : 'text-t-textBright'}`}>{info.price.toFixed(2)}</td>
                  <td className="py-2 text-center">
                    <button onClick={() => toggleAlert(a.id)} className={`px-2 py-0.5 rounded text-[10px] ${a.enabled ? 'bg-t-green/15 text-t-green' : 'bg-t-textDim/15 text-t-textDim'}`}>
                      {a.enabled ? '启用' : '停用'}
                    </button>
                  </td>
                  <td className="py-2 text-center">
                    <button onClick={() => removeAlert(a.id)} className="text-t-textDim hover:text-t-red"><Trash2 className="w-3.5 h-3.5" /></button>
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
