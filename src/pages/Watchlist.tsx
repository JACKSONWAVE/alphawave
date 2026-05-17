import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Plus, Trash2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Bell, BellOff } from 'lucide-react';
import { getStockList } from '../data/mockData';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface WatchItem {
  code: string; group: string; note: string; alertPrice?: number; alertEnabled: boolean;
}

const defaultWatchlist: WatchItem[] = [
  { code: '603019.SH', group: '持仓', note: '信创龙头', alertPrice: 80, alertEnabled: true },
  { code: '002594.SZ', group: '持仓', note: '新能源车', alertPrice: 250, alertEnabled: false },
  { code: '688981.SH', group: '关注', note: '国产替代', alertPrice: 50, alertEnabled: true },
  { code: '300750.SZ', group: '关注', note: '锂电池龙头', alertPrice: 180, alertEnabled: false },
  { code: '600519.SH', group: '观察', note: '白酒标杆', alertPrice: 1600, alertEnabled: false },
  { code: '002230.SZ', group: 'AI', note: 'AI应用', alertPrice: 45, alertEnabled: true },
  { code: '601012.SH', group: '观察', note: '光伏龙头', alertPrice: 16, alertEnabled: false },
  { code: '300059.SZ', group: '券商', note: '券商龙头', alertPrice: 15, alertEnabled: true },
];

export default function Watchlist() {
  const stockList = getStockList();
  const [watchlist, setWatchlist] = useLocalStorage<WatchItem[]>('watchlist', defaultWatchlist);
  const [newCode, setNewCode] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newGroup, setNewGroup] = useState('关注');
  const [selectedGroup, setSelectedGroup] = useState('全部');

  const groups = ['全部', ...Array.from(new Set(watchlist.map(w => w.group)))];
  const filtered = selectedGroup === '全部' ? watchlist : watchlist.filter(w => w.group === selectedGroup);

  const addStock = () => {
    if (!newCode) return;
    const found = stockList.find(s => s.code === newCode || s.name === newCode);
    if (!found) return;
    if (watchlist.find(w => w.code === found.code)) return;
    setWatchlist(prev => [...prev, { code: found.code, group: newGroup, note: newNote, alertEnabled: false }]);
    setNewCode(''); setNewNote('');
  };

  const removeStock = (code: string) => setWatchlist(prev => prev.filter(w => w.code !== code));
  const toggleAlert = (code: string) => setWatchlist(prev => prev.map(w => w.code === code ? { ...w, alertEnabled: !w.alertEnabled } : w));

  return (
    <div className="space-y-3">
      {/* Add */}
      <div className="panel p-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs text-t-textDim mb-1 block">股票代码/名称</label>
          <select value={newCode} onChange={e => setNewCode(e.target.value)} className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none min-w-[160px]">
            <option value="">选择股票</option>
            {stockList.filter(s => !watchlist.find(w => w.code === s.code)).map(s =>
              <option key={s.code} value={s.code}>{s.code} {s.name}</option>
            )}
          </select>
        </div>
        <div>
          <label className="text-xs text-t-textDim mb-1 block">分组</label>
          <input value={newGroup} onChange={e => setNewGroup(e.target.value)} className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none w-24" />
        </div>
        <div>
          <label className="text-xs text-t-textDim mb-1 block">备注</label>
          <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="备注..." className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none w-40 placeholder-t-textDim/50" />
        </div>
        <button onClick={addStock} className="px-3 py-1 rounded bg-t-blue text-white text-sm hover:bg-blue-500 transition-colors flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> 添加
        </button>
      </div>

      {/* Group filter */}
      <div className="flex gap-1">
        {groups.map(g => (
          <button key={g} onClick={() => setSelectedGroup(g)}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${selectedGroup === g ? 'bg-t-blue text-white' : 'text-t-textDim hover:text-t-text border border-t-border'}`}>
            {g} ({g === '全部' ? watchlist.length : watchlist.filter(w => w.group === g).length})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="panel">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-t-textDim border-b border-t-border">
                <th className="text-left px-3 py-2 font-medium">分组</th>
                <th className="text-left py-2 font-medium">代码</th>
                <th className="text-left py-2 font-medium">名称</th>
                <th className="text-right py-2 font-medium">现价</th>
                <th className="text-right py-2 font-medium">涨跌</th>
                <th className="text-right py-2 font-medium">涨跌幅</th>
                <th className="text-left py-2 font-medium hidden md:table-cell">备注</th>
                <th className="text-right py-2 font-medium">预警</th>
                <th className="text-center py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w, i) => {
                const stock = stockList.find(s => s.code === w.code);
                if (!stock) return null;
                const up = stock.changePct >= 0;
                return (
                  <tr key={w.code} className={`border-b border-t-border/50 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''} hover:bg-white/[0.04] transition-colors`}>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-t-blue/10 text-t-blue border border-t-blue/20">{w.group}</span>
                    </td>
                    <td className="py-2 data-num text-t-textDim">{w.code}</td>
                    <td className="py-2">
                      <Link to={`/analysis?code=${w.code}`} className="text-t-text hover:text-t-blue font-medium transition-colors">{stock.name}</Link>
                    </td>
                    <td className={`py-2 text-right font-bold data-num ${up ? 'text-t-red' : 'text-t-green'}`}>{stock.price.toFixed(2)}</td>
                    <td className={`py-2 text-right data-num ${up ? 'text-t-red' : 'text-t-green'}`}>{up ? '+' : ''}{stock.change.toFixed(2)}</td>
                    <td className={`py-2 text-right data-num ${up ? 'text-t-red' : 'text-t-green'}`}>{up ? '+' : ''}{stock.changePct.toFixed(2)}%</td>
                    <td className="py-2 text-t-textDim hidden md:table-cell">{w.note}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => toggleAlert(w.code)} className={`${w.alertEnabled ? 'text-t-yellow' : 'text-t-textDim'} hover:text-t-yellow transition-colors`}>
                        {w.alertEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="py-2 text-center">
                      <button onClick={() => removeStock(w.code)} className="text-t-textDim hover:text-t-red transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="py-8 text-center text-t-textDim text-sm">暂无股票，点击上方添加</div>}
      </div>
    </div>
  );
}
