import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Star, Receipt, Bell, Settings, Search, Filter, Bot, Newspaper, BriefcaseBusiness } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { getMarketIndex, getStockList } from '../data/mockData';
import { AlertBadge } from './AlertBadge';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '行情看板' },
  { to: '/analysis', icon: BarChart3, label: '技术分析' },
  { to: '/watchlist', icon: Star, label: '自选股' },
  { to: '/portfolio', icon: BriefcaseBusiness, label: '组合仓位' },
  { to: '/intel', icon: Newspaper, label: '资讯雷达' },
  { to: '/screener', icon: Filter, label: '智能选股' },
  { to: '/trades', icon: Receipt, label: '交易记录' },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const indexData = getMarketIndex();
  const stockList = useMemo(() => getStockList(), []);
  const suggestions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return [];
    return stockList.filter(stock =>
      stock.code.toLowerCase().includes(keyword) ||
      stock.name.toLowerCase().includes(keyword) ||
      stock.industry.toLowerCase().includes(keyword)
    ).slice(0, 6);
  }, [query, stockList]);

  const goToStock = (value = query) => {
    const keyword = value.trim().toLowerCase();
    if (!keyword) return;
    const stock = stockList.find(item =>
      item.code.toLowerCase() === keyword ||
      item.name.toLowerCase() === keyword
    ) || suggestions[0];
    if (!stock) return;
    navigate(`/analysis?code=${stock.code}`);
    setQuery('');
  };

  return (
    <div className="flex h-screen bg-t-bg overflow-hidden">
      <aside className={`flex flex-col border-r border-t-border bg-t-panel transition-all duration-200 ${collapsed ? 'w-14' : 'w-52'}`}>
        <div className="flex items-center gap-3 px-4 h-12 border-b border-t-border">
          <button onClick={() => setCollapsed(!collapsed)} className="text-t-textDim hover:text-t-text transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          {!collapsed && <span className="font-bold text-t-textBright tracking-tight text-sm">AlphaWave</span>}
        </div>
        <nav className="flex-1 py-2 space-y-0.5">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 mx-1.5 rounded-md text-sm transition-colors relative ${isActive ? 'bg-t-blue/15 text-t-blue border-l-2 border-t-blue' : 'text-t-textDim hover:text-t-text hover:bg-t-panelHover'}`
            }>
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {item.to === '/watchlist' && !collapsed && <AlertBadge />}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-t-border py-2 space-y-0.5">
          <NavLink to="/feishu" className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 mx-1.5 rounded-md text-sm transition-colors ${isActive ? 'bg-t-green/15 text-t-green border-l-2 border-t-green' : 'text-t-textDim hover:text-t-text hover:bg-t-panelHover'}`
          }>
            <Bot className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>AI助手</span>}
          </NavLink>
          <NavLink to="/alerts" className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 mx-1.5 rounded-md text-sm transition-colors relative ${isActive ? 'bg-t-blue/15 text-t-blue' : 'text-t-textDim hover:text-t-text hover:bg-t-panelHover'}`
          }>
            <Bell className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>预警</span>}
            {!collapsed && <AlertBadge />}
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 mx-1.5 rounded-md text-sm transition-colors ${isActive ? 'bg-t-blue/15 text-t-blue' : 'text-t-textDim hover:text-t-text hover:bg-t-panelHover'}`
          }>
            <Settings className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>设置</span>}
          </NavLink>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-4 h-10 border-b border-t-border bg-t-panel">
          <div className="relative flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-t-textDim" />
            <input
              type="text"
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') goToStock();
                if (event.key === 'Escape') setQuery('');
              }}
              placeholder="输入股票代码/名称"
              className="bg-transparent text-xs text-t-text placeholder-t-textDim outline-none w-56"
            />
            {suggestions.length > 0 && (
              <div className="absolute left-5 top-8 z-50 w-72 rounded border border-t-border bg-t-panel shadow-xl overflow-hidden">
                {suggestions.map(stock => (
                  <button
                    key={stock.code}
                    onMouseDown={event => {
                      event.preventDefault();
                      goToStock(stock.code);
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
          <div className="flex items-center gap-4 text-xs">
            {indexData.map((t, i) => (
              <span key={i} className="data-num">
                <span className="text-t-textDim">{t.name}</span>{' '}
                <span className="text-t-text">{t.price.toLocaleString()}</span>{' '}
                <span className={t.changePct >= 0 ? 'text-t-red' : 'text-t-green'}>{t.changePct >= 0 ? '+' : ''}{t.changePct.toFixed(2)}%</span>
              </span>
            ))}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
