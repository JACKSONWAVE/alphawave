import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Eye, ArrowUpRight, ArrowDownRight, DollarSign } from 'lucide-react';
import { getMarketIndex, getStockList } from '../data/mockData';
import { useRealtimeQuotes } from '../hooks/useRealtime';
import RealtimeStatus from '../components/RealtimeStatus';

export default function Dashboard() {
  const indexData = getMarketIndex();
  const staticStocks = getStockList();
  const { quotes: realtimeQuotes, loading } = useRealtimeQuotes({});
  const [sortKey, setSortKey] = useState<'changePct' | 'price'>('changePct');

  // 合并实时数据
  const stocks = useMemo(() => {
    if (realtimeQuotes.length === 0) return staticStocks;
    const rtMap = new Map(realtimeQuotes.map(q => [q.code, q]));
    return staticStocks.map(s => {
      const rt = rtMap.get(s.code);
      if (!rt) return s;
      return {
        ...s,
        price: rt.price,
        change: rt.change,
        changePct: rt.changePct,
      };
    });
  }, [staticStocks, realtimeQuotes]);

  const sorted = useMemo(() => {
    return [...stocks].sort((a, b) => {
      const v = sortKey === 'changePct' ? b.changePct - a.changePct : b.price - a.price;
      return v;
    });
  }, [stocks, sortKey]);

  const rising = stocks.filter(s => s.changePct >= 0).length;

  return (
    <div className="space-y-3">
      {/* 实时状态 */}
      <RealtimeStatus />

      {/* 大盘指数 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {indexData.map(m => {
          const up = m.changePct >= 0;
          return (
            <div key={m.code} className="panel p-3">
              <div className="text-xs text-t-textDim">{m.name}</div>
              <div className={`text-base font-bold data-num mt-1 ${up ? 'text-t-red' : 'text-t-green'}`}>{m.price.toLocaleString()}</div>
              <span className={`inline-flex items-center text-xs data-num ${up ? 'text-t-red' : 'text-t-green'}`}>
                {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {up ? '+' : ''}{m.changePct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: '股票池', value: `${stocks.length}只`, icon: Eye, color: 'text-t-blue' },
          { label: '上涨', value: `${rising}只`, icon: TrendingUp, color: 'text-t-red' },
          { label: '下跌', value: `${stocks.length - rising}只`, icon: TrendingDown, color: 'text-t-green' },
          { label: '实时数据', value: loading ? '刷新中...' : `${realtimeQuotes.length}只`, icon: DollarSign, color: 'text-t-yellow' },
        ].map(s => (
          <div key={s.label} className="panel p-3 flex items-center gap-3">
            <s.icon className={`w-5 h-5 ${s.color}`} />
            <div>
              <div className="text-xs text-t-textDim">{s.label}</div>
              <div className={`text-sm font-bold ${s.color}`}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 行情表 */}
      <div className="panel">
        <div className="flex items-center justify-between px-3 py-2 border-b border-t-border">
          <h2 className="text-sm font-semibold text-t-textBright">
            市场行情 {realtimeQuotes.length > 0 && <span className="text-t-green text-xs font-normal ml-1">● 实时</span>}
          </h2>
          <div className="flex gap-1">
            {[{ k: 'changePct' as const, l: '涨跌幅' }, { k: 'price' as const, l: '价格' }].map(s => (
              <button key={s.k} onClick={() => setSortKey(s.k)} className={`px-2 py-0.5 rounded text-xs ${sortKey === s.k ? 'bg-t-blue text-white' : 'text-t-textDim'}`}>{s.l}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-t-textDim border-b border-t-border">
              <th className="text-left px-3 py-2 font-medium">代码</th>
              <th className="text-left py-2 font-medium">名称</th>
              <th className="text-left py-2 font-medium">行业</th>
              <th className="text-right py-2 font-medium">现价</th>
              <th className="text-right py-2 font-medium">涨跌</th>
              <th className="text-right py-2 font-medium">涨跌幅</th>
              <th className="text-right py-2 font-medium hidden md:table-cell">52周高</th>
              <th className="text-right py-2 font-medium hidden md:table-cell">52周低</th>
              <th className="text-left py-2 font-medium">距高位</th>
              <th className="text-left py-2 font-medium">操作</th>
            </tr></thead>
            <tbody>
              {sorted.map((s, i) => {
                const up = s.changePct >= 0;
                const distHigh = s.high52w > 0 ? ((s.price - s.high52w) / s.high52w * 100) : 0;
                const isRealtime = realtimeQuotes.some(q => q.code === s.code);
                return <tr key={s.code} className={`border-b border-t-border/50 ${i % 2 ? 'bg-white/[0.02]' : ''} hover:bg-white/[0.04] transition-colors`}>
                  <td className="px-3 py-1.5 data-num text-t-textDim">
                    {s.code}
                    {isRealtime && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-t-green inline-block" title="实时" />}
                  </td>
                  <td className="py-1.5"><Link to={`/analysis?code=${s.code}`} className="text-t-text hover:text-t-blue font-medium">{s.name}</Link></td>
                  <td className="py-1.5 text-t-textDim">{s.industry}</td>
                  <td className={`py-1.5 text-right font-bold data-num ${up ? 'text-t-red' : 'text-t-green'}`}>{s.price.toFixed(2)}</td>
                  <td className={`py-1.5 text-right data-num ${up ? 'text-t-red' : 'text-t-green'}`}>{up ? '+' : ''}{s.change.toFixed(2)}</td>
                  <td className={`py-1.5 text-right data-num ${up ? 'text-t-red' : 'text-t-green'}`}>{up ? '+' : ''}{s.changePct.toFixed(2)}%</td>
                  <td className="py-1.5 text-right data-num text-t-textDim hidden md:table-cell">{s.high52w.toFixed(0)}</td>
                  <td className="py-1.5 text-right data-num text-t-textDim hidden md:table-cell">{s.low52w.toFixed(0)}</td>
                  <td className={`py-1.5 data-num ${distHigh > -10 ? 'text-t-red' : 'text-t-green'}`}>{distHigh.toFixed(1)}%</td>
                  <td className="py-1.5"><Link to={`/analysis?code=${s.code}`} className="text-t-blue hover:underline text-xs">分析</Link></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
