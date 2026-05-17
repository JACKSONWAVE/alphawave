import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Filter, Search, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { getStockList } from '../data/mockData';

export default function Screener() {
  const stockList = getStockList();

  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minChange, setMinChange] = useState('');
  const [maxChange, setMaxChange] = useState('');
  const [minPe, setMinPe] = useState('');
  const [maxPe, setMaxPe] = useState('');
  const [industry, setIndustry] = useState('全部');
  const [sortBy, setSortBy] = useState('changePct');

  const industries = ['全部', ...Array.from(new Set(stockList.map(s => s.industry)))];

  const filtered = useMemo(() => {
    let res = stockList;
    if (minPrice) res = res.filter(s => s.price >= parseFloat(minPrice));
    if (maxPrice) res = res.filter(s => s.price <= parseFloat(maxPrice));
    if (minChange) res = res.filter(s => s.changePct >= parseFloat(minChange));
    if (maxChange) res = res.filter(s => s.changePct <= parseFloat(maxChange));
    if (minPe) res = res.filter(s => s.pe > 0 && s.pe >= parseFloat(minPe));
    if (maxPe) res = res.filter(s => s.pe > 0 && s.pe <= parseFloat(maxPe));
    if (industry !== '全部') res = res.filter(s => s.industry === industry);

    res.sort((a, b) => {
      const av = sortBy === 'pe' ? (a.pe > 0 ? a.pe : 9999) : a[sortBy as keyof typeof a] as number;
      const bv = sortBy === 'pe' ? (b.pe > 0 ? b.pe : 9999) : b[sortBy as keyof typeof b] as number;
      return bv - av;
    });
    return res;
  }, [stockList, minPrice, maxPrice, minChange, maxChange, minPe, maxPe, industry, sortBy]);

  const quickFilters = [
    { label: '涨停潜力', fn: () => { setMinChange('5'); setMaxChange('9.9'); } },
    { label: '超跌反弹', fn: () => { setMinChange('-5'); setMaxChange('0'); } },
    { label: '低估值', fn: () => { setMinPe('0'); setMaxPe('20'); } },
    { label: '高估值', fn: () => { setMinPe('50'); setMaxPe('999'); } },
    { label: '重置', fn: () => { setMinPrice(''); setMaxPrice(''); setMinChange(''); setMaxChange(''); setMinPe(''); setMaxPe(''); setIndustry('全部'); } },
  ];

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold text-t-textBright">智能选股器</h1>

      {/* 快捷筛选 */}
      <div className="panel p-3">
        <div className="flex flex-wrap gap-2 mb-3">
          {quickFilters.map(f => (
            <button key={f.label} onClick={f.fn} className={`px-3 py-1 rounded text-xs transition-colors ${f.label === '重置' ? 'text-t-textDim border border-t-border hover:text-t-text' : 'bg-t-blue/10 text-t-blue border border-t-blue/20 hover:bg-t-blue/20'}`}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <div>
            <label className="text-[10px] text-t-textDim mb-0.5 block">最低价</label>
            <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="0" className="w-full bg-t-bg border border-t-border rounded px-2 py-1 text-xs text-t-text outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-t-textDim mb-0.5 block">最高价</label>
            <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="9999" className="w-full bg-t-bg border border-t-border rounded px-2 py-1 text-xs text-t-text outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-t-textDim mb-0.5 block">最小涨幅%</label>
            <input type="number" value={minChange} onChange={e => setMinChange(e.target.value)} placeholder="-10" className="w-full bg-t-bg border border-t-border rounded px-2 py-1 text-xs text-t-text outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-t-textDim mb-0.5 block">最大涨幅%</label>
            <input type="number" value={maxChange} onChange={e => setMaxChange(e.target.value)} placeholder="10" className="w-full bg-t-bg border border-t-border rounded px-2 py-1 text-xs text-t-text outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-t-textDim mb-0.5 block">最小PE</label>
            <input type="number" value={minPe} onChange={e => setMinPe(e.target.value)} placeholder="0" className="w-full bg-t-bg border border-t-border rounded px-2 py-1 text-xs text-t-text outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-t-textDim mb-0.5 block">最大PE</label>
            <input type="number" value={maxPe} onChange={e => setMaxPe(e.target.value)} placeholder="999" className="w-full bg-t-bg border border-t-border rounded px-2 py-1 text-xs text-t-text outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-t-textDim mb-0.5 block">行业</label>
            <select value={industry} onChange={e => setIndustry(e.target.value)} className="w-full bg-t-bg border border-t-border rounded px-2 py-1 text-xs text-t-text outline-none">
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 排序 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-t-textDim">排序:</span>
        {[{ k: 'changePct', l: '涨跌幅' }, { k: 'price', l: '价格' }, { k: 'pe', l: 'PE' }].map(s => (
          <button key={s.k} onClick={() => setSortBy(s.k)} className={`px-2 py-0.5 rounded text-xs ${sortBy === s.k ? 'bg-t-blue text-white' : 'text-t-textDim border border-t-border'}`}>{s.l}</button>
        ))}
        <span className="ml-auto text-xs text-t-textDim">共 {filtered.length} 只</span>
      </div>

      {/* 结果 */}
      <div className="panel">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-t-textDim border-b border-t-border">
              <th className="text-left px-3 py-2 font-medium">代码</th>
              <th className="text-left py-2 font-medium">名称</th>
              <th className="text-left py-2 font-medium">行业</th>
              <th className="text-right py-2 font-medium">现价</th>
              <th className="text-right py-2 font-medium">涨跌幅</th>
              <th className="text-right py-2 font-medium">PE</th>
              <th className="text-right py-2 font-medium">52周高</th>
              <th className="text-right py-2 font-medium">52周低</th>
              <th className="text-left py-2 font-medium">距高位</th>
              <th className="text-left py-2 font-medium">操作</th>
            </tr></thead>
            <tbody>
              {filtered.map((s, i) => {
                const up = s.changePct >= 0;
                const distHigh = s.high52w > 0 ? ((s.price - s.high52w) / s.high52w * 100) : 0;
                return <tr key={s.code} className={`border-b border-t-border/50 ${i % 2 ? 'bg-white/[0.02]' : ''} hover:bg-white/[0.04]`}>
                  <td className="px-3 py-1.5 data-num text-t-textDim">{s.code}</td>
                  <td className="py-1.5"><Link to={`/analysis?code=${s.code}`} className="text-t-text hover:text-t-blue font-medium">{s.name}</Link></td>
                  <td className="py-1.5 text-t-textDim">{s.industry}</td>
                  <td className={`py-1.5 text-right font-bold data-num ${up ? 'text-t-red' : 'text-t-green'}`}>{s.price.toFixed(2)}</td>
                  <td className={`py-1.5 text-right data-num ${up ? 'text-t-red' : 'text-t-green'}`}>{up ? '+' : ''}{s.changePct.toFixed(2)}%</td>
                  <td className="py-1.5 text-right data-num text-t-textDim">{s.pe > 0 ? s.pe.toFixed(1) : '-'}</td>
                  <td className="py-1.5 text-right data-num text-t-textDim">{s.high52w.toFixed(0)}</td>
                  <td className="py-1.5 text-right data-num text-t-textDim">{s.low52w.toFixed(0)}</td>
                  <td className={`py-1.5 data-num ${distHigh > -10 ? 'text-t-red' : 'text-t-green'}`}>{distHigh.toFixed(1)}%</td>
                  <td className="py-1.5"><Link to={`/analysis?code=${s.code}`} className="text-t-blue hover:underline text-xs">分析</Link></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="py-8 text-center text-t-textDim text-sm">无匹配股票，请调整筛选条件</div>}
      </div>
    </div>
  );
}
