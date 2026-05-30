import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Plus, Trash2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Bell, BellOff } from 'lucide-react';
import { getAlerts, getStockList, saveAlerts } from '../data/mockData';
import { formatPct, formatPrice } from '../data/price';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useRealtimeQuotes } from '../hooks/useRealtime';

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
  { code: '510210.SH', group: 'ETF', note: '上证指数底仓', alertPrice: 0.86, alertEnabled: false },
  { code: '510300.SH', group: 'ETF', note: '沪深300底仓', alertPrice: 4.0, alertEnabled: false },
  { code: '512890.SH', group: 'ETF', note: '红利低波防守', alertPrice: 1.16, alertEnabled: false },
  { code: '518880.SH', group: 'ETF', note: '黄金避险', alertPrice: 6.2, alertEnabled: false },
  { code: '512760.SH', group: 'ETF', note: '芯片/存储弹性', alertPrice: 1.18, alertEnabled: false },
];

export default function Watchlist() {
  const stockList = useMemo(() => getStockList(), []);
  const [watchlist, setWatchlist] = useLocalStorage<WatchItem[]>('watchlist', defaultWatchlist);
  const [newCode, setNewCode] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newGroup, setNewGroup] = useState('关注');
  const [selectedGroup, setSelectedGroup] = useState('全部');

  const groups = ['全部', ...Array.from(new Set(watchlist.map(w => w.group)))];
  const filtered = selectedGroup === '全部' ? watchlist : watchlist.filter(w => w.group === selectedGroup);
  const { quotes } = useRealtimeQuotes({ codes: watchlist.map(w => w.code) });
  const quoteMap = new Map(quotes.map(quote => [quote.code, quote]));
  const watchCodes = useMemo(() => new Set(watchlist.map(item => item.code)), [watchlist]);
  const stockMap = useMemo(() => new Map(stockList.map(stock => [stock.code, stock])), [stockList]);
  const candidates = useMemo(() => {
    const keyword = newCode.trim().toLowerCase();
    if (!keyword) return [];
    return stockList
      .filter(stock => !watchCodes.has(stock.code))
      .filter(stock =>
        stock.code.toLowerCase().includes(keyword) ||
        stock.name.toLowerCase().includes(keyword) ||
        stock.industry.toLowerCase().includes(keyword)
      )
      .slice(0, 30);
  }, [newCode, stockList, watchCodes]);

  const addStock = () => {
    if (!newCode) return;
    const keyword = newCode.trim().toLowerCase();
    const found = stockList.find(s => s.code.toLowerCase() === keyword || s.name.toLowerCase() === keyword) || candidates[0];
    if (!found) return;
    if (watchlist.find(w => w.code === found.code)) return;
    setWatchlist(prev => [...prev, { code: found.code, group: newGroup, note: newNote, alertEnabled: false }]);
    setNewCode(''); setNewNote('');
  };

  const removeStock = (code: string) => setWatchlist(prev => prev.filter(w => w.code !== code));
  const toggleAlert = (code: string) => {
    const item = watchlist.find(w => w.code === code);
    if (!item) return;
    const nextEnabled = !item.alertEnabled;
    setWatchlist(prev => prev.map(w => w.code === code ? { ...w, alertEnabled: nextEnabled } : w));

    const stock = stockMap.get(code);
    const currentPrice = quoteMap.get(code)?.price ?? stock?.price ?? item.alertPrice ?? 0;
    const alerts = getAlerts();
    const watchAlertId = `watchlist-${code}`;
    const withoutExisting = alerts.filter(alert => alert.id !== watchAlertId);
    const nextAlerts = nextEnabled
      ? [...withoutExisting, {
        id: watchAlertId,
        code,
        name: stock?.name || code,
        type: 'above' as const,
        price: item.alertPrice || +(currentPrice * 1.03).toFixed(3),
        enabled: true,
      }]
      : withoutExisting;
    saveAlerts(nextAlerts);
    window.dispatchEvent(new CustomEvent('alphawave:alerts-changed'));
  };

  return (
    <div className="space-y-3">
      {/* Add */}
      <div className="panel p-3 flex flex-wrap items-end gap-2">
        <div className="relative">
          <label className="text-xs text-t-textDim mb-1 block">股票代码/名称</label>
          <input
            value={newCode}
            onChange={event => setNewCode(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') addStock();
              if (event.key === 'Escape') setNewCode('');
            }}
            placeholder="输入代码/名称/行业"
            className="bg-t-bg border border-t-border rounded px-2 py-1 text-sm text-t-text outline-none min-w-[220px] placeholder-t-textDim/60"
          />
          {candidates.length > 0 && (
            <div className="absolute left-0 top-[58px] z-50 w-[320px] max-h-72 overflow-y-auto rounded border border-t-border bg-t-panel shadow-xl scrollbar-thin">
              {candidates.map(stock => (
                <button
                  key={stock.code}
                  type="button"
                  onMouseDown={event => {
                    event.preventDefault();
                    setNewCode(stock.code);
                  }}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-white/[0.04] flex items-center justify-between gap-3"
                >
                  <span className="text-t-text truncate">{stock.name}</span>
                  <span className="data-num text-t-textDim whitespace-nowrap">{stock.code}</span>
                </button>
              ))}
            </div>
          )}
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
                const stock = stockMap.get(w.code);
                if (!stock) return null;
                const realtime = quoteMap.get(w.code);
                const price = realtime?.price ?? stock.price;
                const change = realtime?.change ?? stock.change;
                const changePct = realtime?.changePct ?? stock.changePct;
                const up = changePct >= 0;
                return (
                  <tr key={w.code} className={`border-b border-t-border/50 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''} hover:bg-white/[0.04] transition-colors`}>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-t-blue/10 text-t-blue border border-t-blue/20">{w.group}</span>
                    </td>
                    <td className="py-2 data-num text-t-textDim">{w.code}</td>
                    <td className="py-2">
                      <Link to={`/analysis?code=${w.code}`} className="text-t-text hover:text-t-blue font-medium transition-colors">{stock.name}</Link>
                    </td>
                    <td className={`py-2 text-right font-bold data-num ${up ? 'text-t-red' : 'text-t-green'}`}>{formatPrice(price)}</td>
                    <td className={`py-2 text-right data-num ${up ? 'text-t-red' : 'text-t-green'}`}>{formatPrice(change)}</td>
                    <td className={`py-2 text-right data-num ${up ? 'text-t-red' : 'text-t-green'}`}>{formatPct(changePct)}</td>
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
