import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { getStockList } from '../data/mockData';
import { scoreStrategyStock, type StrategyTag } from '../data/strategyScreener';
import { formatPct, formatPrice } from '../data/price';

type SortKey = 'strategyScore' | 'confidence' | 'changePct' | 'price' | 'pe';
type StrategyFilter = StrategyTag | '全部策略';

export default function Screener() {
  const stockList = useMemo(() => getStockList(), []);
  const scoredStocks = useMemo(() => stockList.map(stock => ({ ...stock, strategyPick: scoreStrategyStock(stock) })), [stockList]);

  const [query, setQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minChange, setMinChange] = useState('');
  const [maxChange, setMaxChange] = useState('');
  const [minPe, setMinPe] = useState('');
  const [maxPe, setMaxPe] = useState('');
  const [industry, setIndustry] = useState('全部');
  const [strategy, setStrategy] = useState<StrategyFilter>('全部策略');
  const [sortBy, setSortBy] = useState<SortKey>('strategyScore');

  const industries = useMemo(() => ['全部', ...Array.from(new Set(stockList.map(s => s.industry)))], [stockList]);
  const strategies: StrategyFilter[] = ['全部策略', '龙头突破', '共振低吸', '量价突破', '趋势回踩'];

  const filtered = useMemo(() => {
    let res = [...scoredStocks];
    const keyword = query.trim().toLowerCase();
    if (keyword) {
      res = res.filter(s =>
        s.code.toLowerCase().includes(keyword) ||
        s.name.toLowerCase().includes(keyword) ||
        s.industry.toLowerCase().includes(keyword)
      );
    }
    if (minPrice) res = res.filter(s => s.price >= parseFloat(minPrice));
    if (maxPrice) res = res.filter(s => s.price <= parseFloat(maxPrice));
    if (minChange) res = res.filter(s => s.changePct >= parseFloat(minChange));
    if (maxChange) res = res.filter(s => s.changePct <= parseFloat(maxChange));
    if (minPe) res = res.filter(s => s.pe > 0 && s.pe >= parseFloat(minPe));
    if (maxPe) res = res.filter(s => s.pe > 0 && s.pe <= parseFloat(maxPe));
    if (industry !== '全部') res = res.filter(s => s.industry === industry);
    if (strategy !== '全部策略') res = res.filter(s => s.strategyPick.strategy === strategy);

    const sortValue = (item: typeof res[number]) => {
      if (sortBy === 'strategyScore') return item.strategyPick.score;
      if (sortBy === 'confidence') return item.strategyPick.confidence;
      if (sortBy === 'pe') return item.pe > 0 ? item.pe : 9999;
      if (sortBy === 'changePct') return item.changePct;
      return item.price;
    };
    res.sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
      if (sortBy === 'pe') return av - bv;
      return bv - av;
    });
    return res;
  }, [scoredStocks, query, minPrice, maxPrice, minChange, maxChange, minPe, maxPe, industry, strategy, sortBy]);

  const visible = useMemo(() => filtered.slice(0, 300), [filtered]);

  const quickFilters = [
    { label: '龙头突破', fn: () => { setStrategy('龙头突破'); setMinChange('2'); setMaxChange('9.9'); setSortBy('strategyScore'); } },
    { label: '共振低吸', fn: () => { setStrategy('共振低吸'); setMinChange('-2'); setMaxChange('4'); setSortBy('confidence'); } },
    { label: '涨停潜力', fn: () => { setMinChange('5'); setMaxChange('9.9'); setSortBy('changePct'); } },
    { label: '超跌反弹', fn: () => { setMinChange('-5'); setMaxChange('0'); setStrategy('全部策略'); } },
    { label: '低估值', fn: () => { setMinPe('0'); setMaxPe('20'); } },
    { label: '高估值', fn: () => { setMinPe('50'); setMaxPe('999'); } },
    { label: '重置', fn: () => { setQuery(''); setMinPrice(''); setMaxPrice(''); setMinChange(''); setMaxChange(''); setMinPe(''); setMaxPe(''); setIndustry('全部'); setStrategy('全部策略'); setSortBy('strategyScore'); } },
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

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
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
          <div>
            <label className="text-[10px] text-t-textDim mb-0.5 block">策略打法</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value as StrategyFilter)} className="w-full bg-t-bg border border-t-border rounded px-2 py-1 text-xs text-t-text outline-none">
              {strategies.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 排序 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t-textDim" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索代码/名称/行业"
            className="w-full bg-t-bg border border-t-border rounded pl-7 pr-3 py-1.5 text-xs text-t-text outline-none focus:border-t-blue"
          />
        </div>
        <span className="text-xs text-t-textDim">排序:</span>
        {[
          { k: 'strategyScore', l: '策略分' },
          { k: 'confidence', l: '置信度' },
          { k: 'changePct', l: '涨跌幅' },
          { k: 'price', l: '价格' },
          { k: 'pe', l: 'PE' },
        ].map(s => (
          <button key={s.k} onClick={() => setSortBy(s.k as SortKey)} className={`px-2 py-0.5 rounded text-xs ${sortBy === s.k ? 'bg-t-blue text-white' : 'text-t-textDim border border-t-border'}`}>{s.l}</button>
        ))}
        <span className="ml-auto text-xs text-t-textDim">显示 {visible.length}/{filtered.length} 只</span>
      </div>

      {/* 结果 */}
      <div className="panel">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-t-textDim border-b border-t-border">
              <th className="text-left px-3 py-2 font-medium">代码</th>
              <th className="text-left py-2 font-medium">名称</th>
              <th className="text-left py-2 font-medium">行业</th>
              <th className="text-left py-2 font-medium">策略</th>
              <th className="text-right py-2 font-medium">策略分</th>
              <th className="text-right py-2 font-medium">现价</th>
              <th className="text-right py-2 font-medium">涨跌幅</th>
              <th className="text-right py-2 font-medium">PE</th>
              <th className="text-left py-2 font-medium">距高位</th>
              <th className="text-left py-2 font-medium">计划</th>
              <th className="text-left py-2 font-medium">操作</th>
            </tr></thead>
            <tbody>
              {visible.map((s, i) => {
                const up = s.changePct >= 0;
                const distHigh = s.high52w > 0 ? ((s.price - s.high52w) / s.high52w * 100) : 0;
                return <tr key={s.code} className={`border-b border-t-border/50 ${i % 2 ? 'bg-white/[0.02]' : ''} hover:bg-white/[0.04]`}>
                  <td className="px-3 py-1.5 data-num text-t-textDim">{s.code}</td>
                  <td className="py-1.5"><Link to={`/analysis?code=${s.code}`} className="text-t-text hover:text-t-blue font-medium">{s.name}</Link></td>
                  <td className="py-1.5 text-t-textDim">{s.industry}</td>
                  <td className="py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] border ${s.strategyPick.strategy === '观察' ? 'text-t-textDim border-t-border' : 'text-t-blue border-t-blue/25 bg-t-blue/10'}`}>
                      {s.strategyPick.strategy}
                    </span>
                  </td>
                  <td className={`py-1.5 text-right data-num font-bold ${s.strategyPick.score >= 58 ? 'text-t-red' : s.strategyPick.score >= 42 ? 'text-t-yellow' : 'text-t-textDim'}`}>{s.strategyPick.score}</td>
                  <td className={`py-1.5 text-right font-bold data-num ${up ? 'text-t-red' : 'text-t-green'}`}>{formatPrice(s.price)}</td>
                  <td className={`py-1.5 text-right data-num ${up ? 'text-t-red' : 'text-t-green'}`}>{formatPct(s.changePct)}</td>
                  <td className="py-1.5 text-right data-num text-t-textDim">{s.pe > 0 ? s.pe.toFixed(1) : '-'}</td>
                  <td className={`py-1.5 data-num ${distHigh > -10 ? 'text-t-red' : 'text-t-green'}`}>{distHigh.toFixed(1)}%</td>
                  <td className="py-1.5 text-[11px] text-t-textDim">
                    <div className="truncate max-w-[220px]">{s.strategyPick.execution}</div>
                    <div className="truncate max-w-[220px]">买 {s.strategyPick.entry} · 止 {s.strategyPick.stop}</div>
                  </td>
                  <td className="py-1.5"><Link to={`/analysis?code=${s.code}`} className="text-t-blue hover:underline text-xs">分析</Link></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="py-8 text-center text-t-textDim text-sm">无匹配股票，请调整筛选条件</div>}
        {filtered.length > visible.length && (
          <div className="px-3 py-2 border-t border-t-border text-[11px] text-t-textDim">
            已限制展示前 300 条，继续输入代码、名称或行业可快速缩小范围。
          </div>
        )}
      </div>
    </div>
  );
}
