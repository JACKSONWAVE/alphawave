import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Star, Settings, Search, Bot, Newspaper, BriefcaseBusiness, FileCheck2, GitBranch, Scale } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { coverageCompanies } from '../data/advisoryModel';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '项目工作台' },
  { to: '/analysis', icon: BarChart3, label: '公司研究' },
  { to: '/watchlist', icon: Star, label: '覆盖公司' },
  { to: '/valuation', icon: Scale, label: '估值中心' },
  { to: '/comparables', icon: BriefcaseBusiness, label: '可比公司' },
  { to: '/intel', icon: Newspaper, label: '公告与催化剂' },
  { to: '/diligence', icon: FileCheck2, label: '尽调与质控' },
  { to: '/versions', icon: GitBranch, label: '模型版本' },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const stockList = useMemo(() => coverageCompanies, []);
  const suggestions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return [];
    return stockList.filter(stock =>
      stock.code.toLowerCase().includes(keyword) ||
      stock.name.toLowerCase().includes(keyword) ||
      stock.sector.toLowerCase().includes(keyword)
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
      <aside className={`hidden lg:flex flex-col border-r border-t-border bg-t-panel transition-all duration-200 ${collapsed ? 'w-14' : 'w-52'}`}>
        <div className="flex items-center gap-3 px-4 h-12 border-b border-t-border">
          <button onClick={() => setCollapsed(!collapsed)} className="text-t-textDim hover:text-t-text transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight text-t-textBright">AlphaWave</div>
              <div className="truncate text-[9px] uppercase tracking-[0.16em] text-t-cyan">Capital Intelligence</div>
            </div>
          )}
        </div>
        <nav className="flex-1 py-2 space-y-0.5">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 mx-1.5 rounded-md text-sm transition-colors relative ${isActive ? 'bg-t-blue/15 text-t-blue border-l-2 border-t-blue' : 'text-t-textDim hover:text-t-text hover:bg-t-panelHover'}`
            }>
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-t-border py-2 space-y-0.5">
          <NavLink to="/feishu" className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 mx-1.5 rounded-md text-sm transition-colors ${isActive ? 'bg-t-green/15 text-t-green border-l-2 border-t-green' : 'text-t-textDim hover:text-t-text hover:bg-t-panelHover'}`
          }>
            <Bot className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>AI研究助手</span>}
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
        <header className="flex items-center justify-between px-3 sm:px-4 h-11 border-b border-t-border bg-t-panel">
          <div className="relative flex items-center gap-2">
            <span className="mr-2 text-xs font-semibold text-t-textBright lg:hidden">AlphaWave CI</span>
            <Search className="w-3.5 h-3.5 text-t-textDim" />
            <input
              type="text"
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') goToStock();
                if (event.key === 'Escape') setQuery('');
              }}
              placeholder="搜索公司、项目或证券代码"
              className="bg-transparent text-xs text-t-text placeholder-t-textDim outline-none w-36 sm:w-56"
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
          <div className="hidden items-center gap-4 text-xs md:flex">
            <span><span className="text-t-textDim">覆盖公司</span> <strong className="font-mono font-medium text-t-text">5</strong></span>
            <span><span className="text-t-textDim">待复核</span> <strong className="font-mono font-medium text-t-yellow">3</strong></span>
            <span><span className="text-t-textDim">模型完整度</span> <strong className="font-mono font-medium text-t-cyan">84%</strong></span>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-t-border bg-t-panel px-2 py-1.5 lg:hidden scrollbar-thin">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) =>
              `flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-[11px] ${isActive ? 'bg-t-cyan/10 text-t-cyan' : 'text-t-textDim'}`
            }>
              <item.icon className="h-3.5 w-3.5" />{item.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 overflow-auto p-3 sm:p-4 scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
