import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Crosshair,
  ExternalLink,
  Flame,
  Gauge,
  Newspaper,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import { getStockList } from '../data/mockData';

interface WatchItem {
  code: string;
  group?: string;
  note?: string;
}

interface IntelHit {
  title: string;
  url?: string;
  source?: string;
  time?: string;
  summary?: string;
  code: string;
  name: string;
  scope: '宏观' | '行业' | '个股';
  impact: '利好' | '利空' | '中性';
  severity: '重大' | '关注';
  score: number;
  matched: string[];
  action: string;
}

interface IntelTheme {
  keyword: string;
  count: number;
  score: number;
  impact: IntelHit['impact'];
}

interface IntelPayload {
  generatedAt: string;
  scanCount: number;
  watchCount: number;
  marketHits: IntelHit[];
  stockHits: IntelHit[];
  topThemes: IntelTheme[];
  stance: '进攻' | '均衡' | '防守';
  riskBudget: string;
  brief: string;
}

interface IntelResponse {
  ok?: boolean;
  dryRun?: boolean;
  sent?: boolean;
  watchList?: string[];
  payload?: IntelPayload;
  message?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
  detail?: string;
}

interface ActionTask {
  title: string;
  detail: string;
  tone: string;
  icon: typeof Star;
  code?: string;
}

const fallbackWatchlist = [
  '603019.SH',
  '002594.SZ',
  '688981.SH',
  '300750.SZ',
  '600519.SH',
  '002230.SZ',
  '601012.SH',
  '300059.SZ',
  '510300.SH',
  '512890.SH',
  '518880.SH',
  '512760.SH',
];

function readWatchCodes() {
  try {
    const items = JSON.parse(localStorage.getItem('watchlist') || '[]') as WatchItem[];
    const codes = items.map(item => item.code).filter(Boolean);
    return codes.length ? Array.from(new Set(codes)) : fallbackWatchlist;
  } catch {
    return fallbackWatchlist;
  }
}

function formatTime(date: Date) {
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function emptyPayload(codes: string[], reason = '当前没有发现需要推送的重大资讯。'): IntelPayload {
  return {
    generatedAt: formatTime(new Date()),
    scanCount: 0,
    watchCount: codes.length,
    marketHits: [],
    stockHits: [],
    topThemes: [],
    stance: '均衡',
    riskBudget: '没有重大资讯命中时，继续按技术信号、交易闸门和预警线执行。',
    brief: reason,
  };
}

function impactTone(impact: IntelHit['impact']) {
  if (impact === '利好') return 'text-t-red border-t-red/30 bg-t-red/10';
  if (impact === '利空') return 'text-t-green border-t-green/30 bg-t-green/10';
  return 'text-t-yellow border-t-yellow/30 bg-t-yellow/10';
}

function stanceTone(stance: IntelPayload['stance']) {
  if (stance === '进攻') return 'text-t-red border-t-red/35 bg-t-red/10';
  if (stance === '防守') return 'text-t-green border-t-green/35 bg-t-green/10';
  return 'text-t-yellow border-t-yellow/35 bg-t-yellow/10';
}

function sourceLabel(hit: IntelHit) {
  if (hit.source && !hit.source.includes('news.google.com')) return hit.source.replace(/^www\./, '');
  if (!hit.url) return hit.source || '资讯源';
  try {
    return new URL(hit.url).hostname.replace(/^www\./, '');
  } catch {
    return hit.source || '资讯源';
  }
}

function buildActionQueue(payload: IntelPayload): ActionTask[] {
  const tasks: ActionTask[] = [];
  if (payload.stance === '防守') {
    tasks.push({
      title: '先降风险预算',
      detail: '利空权重更高，今日不追高，新开仓只允许小仓试错。',
      tone: 'text-t-green',
      icon: ShieldCheck,
    });
  } else if (payload.stance === '进攻') {
    tasks.push({
      title: '把强主题放到观察前排',
      detail: '宏观或行业偏暖，但仍要等放量站稳突破线。',
      tone: 'text-t-red',
      icon: TrendingUp,
    });
  } else {
    tasks.push({
      title: '保持标准仓位',
      detail: '新闻不单独触发买卖，只作为技术信号的权重加减。',
      tone: 'text-t-yellow',
      icon: Gauge,
    });
  }

  payload.stockHits.slice(0, 5).forEach(hit => {
    tasks.push({
      title: `${hit.name}：${hit.impact}${hit.score}分`,
      detail: hit.action,
      tone: hit.impact === '利空' ? 'text-t-green' : hit.impact === '利好' ? 'text-t-red' : 'text-t-yellow',
      icon: hit.impact === '利空' ? TrendingDown : Crosshair,
      code: hit.code,
    });
  });

  if (payload.stockHits.length === 0) {
    tasks.push({
      title: '自选股暂无直接重大命中',
      detail: '继续盯放量突破、跌破止损、行业异动和实时预警。',
      tone: 'text-t-blue',
      icon: Radio,
    });
  }

  return tasks.slice(0, 7);
}

function buildCopyText(payload: IntelPayload) {
  const market = payload.marketHits.slice(0, 3).map(hit => `- ${hit.severity}${hit.impact} ${hit.score}分：${hit.title}`).join('\n');
  const stocks = payload.stockHits.slice(0, 5).map(hit => `- ${hit.name} ${hit.severity}${hit.impact} ${hit.score}分：${hit.action}`).join('\n');
  return [
    `AlphaWave 资讯雷达 ${payload.generatedAt}`,
    `交易姿态：${payload.stance}`,
    `风险预算：${payload.riskBudget}`,
    `摘要：${payload.brief}`,
    market ? `\n市场事件\n${market}` : '',
    stocks ? `\n自选股影响\n${stocks}` : '',
  ].filter(Boolean).join('\n');
}

export default function IntelRadar() {
  const stockList = useMemo(() => getStockList(), []);
  const stockMap = useMemo(() => new Map(stockList.map(stock => [stock.code, stock])), [stockList]);
  const [codes, setCodes] = useState<string[]>(() => readWatchCodes());
  const [manualCodes, setManualCodes] = useState(() => readWatchCodes().join(', '));
  const [payload, setPayload] = useState<IntelPayload>(() => emptyPayload(readWatchCodes(), '正在等待首次扫描。'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');
  const [copied, setCopied] = useState(false);

  const watchNames = useMemo(() => codes.map(code => ({
    code,
    name: stockMap.get(code)?.name || code,
    industry: stockMap.get(code)?.industry || '未分类',
  })), [codes, stockMap]);
  const stockImpactMap = useMemo(() => {
    const map = new Map<string, IntelHit[]>();
    payload.stockHits.forEach(hit => {
      map.set(hit.code, [...(map.get(hit.code) || []), hit]);
    });
    return map;
  }, [payload.stockHits]);
  const actionQueue = useMemo(() => buildActionQueue(payload), [payload]);
  const riskHitCount = payload.marketHits.concat(payload.stockHits).filter(hit => hit.impact === '利空').length;
  const positiveHitCount = payload.marketHits.concat(payload.stockHits).filter(hit => hit.impact === '利好').length;

  const syncWatchlist = () => {
    const next = readWatchCodes();
    setCodes(next);
    setManualCodes(next.join(', '));
  };

  const applyManualCodes = () => {
    const next = manualCodes
      .split(/[,，\s]+/)
      .map(item => item.trim().toUpperCase())
      .filter(Boolean);
    if (!next.length) return;
    setCodes(Array.from(new Set(next)));
  };

  const scanIntel = async () => {
    const queryCodes = codes.join(',');
    if (!queryCodes) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/intel-cron?dryRun=1&codes=${encodeURIComponent(queryCodes)}`);
      const data = await response.json() as IntelResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.detail || data.error || `资讯雷达返回 ${response.status}`);
      }
      setPayload(data.payload || emptyPayload(codes, data.reason || data.message || '当前没有发现需要推送的重大资讯。'));
      setLastUpdate(formatTime(new Date()));
    } catch (err) {
      setError(err instanceof Error ? err.message : '资讯扫描失败');
    } finally {
      setLoading(false);
    }
  };

  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(buildCopyText(payload));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('复制失败，浏览器没有开放剪贴板权限。');
    }
  };

  useEffect(() => {
    void scanIntel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes.join(',')]);

  return (
    <div className="space-y-3">
      <section className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-t-border bg-[#131722] flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-t-textBright flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-t-yellow" />
              资讯雷达工作台
            </h1>
            <p className="text-xs text-t-textDim mt-1">
              把国内/国际重大新闻压缩成交易姿态、风险预算、自选股影响和行动队列，不再看一屏幕原始链接。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={syncWatchlist} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-t-border text-xs text-t-textDim hover:text-t-text hover:bg-t-panelHover">
              <Star className="w-3.5 h-3.5" />
              同步自选股
            </button>
            <button onClick={copyBrief} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-t-border text-xs text-t-textDim hover:text-t-text hover:bg-t-panelHover">
              {copied ? <ClipboardCheck className="w-3.5 h-3.5 text-t-green" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
              {copied ? '已复制' : '复制简报'}
            </button>
            <button onClick={scanIntel} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-t-blue text-white text-xs font-medium disabled:opacity-60">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              立即扫描
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 border-b border-t-border">
          <StatusMetric icon={Gauge} label="交易姿态" value={payload.stance} detail={payload.riskBudget} tone={stanceTone(payload.stance).split(' ')[0]} />
          <StatusMetric icon={Newspaper} label="扫描资讯" value={`${payload.scanCount}条`} detail="国内/国际财经源" tone="text-t-yellow" />
          <StatusMetric icon={Star} label="自选范围" value={`${codes.length}只`} detail="跟随你的自选池" tone="text-t-blue" />
          <StatusMetric icon={TrendingUp} label="利好/利空" value={`${positiveHitCount}/${riskHitCount}`} detail="先看冲突方向" tone={riskHitCount > positiveHitCount ? 'text-t-green' : 'text-t-red'} />
          <StatusMetric icon={Clock3} label="最近刷新" value={lastUpdate || '--'} detail="页面扫描时间" tone="text-t-textBright" />
        </div>
      </section>

      {error && (
        <div className="rounded border border-t-yellow/30 bg-t-yellow/10 p-3 text-xs text-t-yellow">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-3">
        <div className="space-y-3 min-w-0">
          <div className={`panel p-4 border ${stanceTone(payload.stance)}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 max-w-4xl">
                <div className="text-xs text-t-textDim">交易台结论</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`px-2 py-1 rounded border text-sm font-bold ${stanceTone(payload.stance)}`}>{payload.stance}</span>
                  <span className="text-base font-semibold text-t-textBright">{payload.brief}</span>
                </div>
                <p className="mt-2 text-xs text-t-textSecondary leading-relaxed">{payload.riskBudget}</p>
              </div>
              <div className="text-right data-num">
                <div className="text-2xl font-bold text-t-textBright">{payload.marketHits.length + payload.stockHits.length}</div>
                <div className="text-[10px] text-t-textDim">有效情报命中</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2">
              {payload.topThemes.length > 0 ? payload.topThemes.slice(0, 4).map(theme => (
                <ThemePill key={theme.keyword} theme={theme} />
              )) : (
                <div className="md:col-span-4 rounded border border-t-border bg-white/[0.02] px-3 py-2 text-xs text-t-textDim">
                  暂无高频主题，今天先按价格触发和预警线执行。
                </div>
              )}
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-t-border flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2">
                <Flame className="w-4 h-4 text-t-yellow" />
                市场级事件
              </h2>
              <span className="text-[10px] text-t-textDim">只保留影响交易姿态的事件</span>
            </div>
            <div className="divide-y divide-t-border">
              {payload.marketHits.length > 0 ? payload.marketHits.map(hit => <EventRow key={`${hit.code}-${hit.title}`} hit={hit} />) : (
                <EmptyState text="没有市场级重大事件命中，今天不因为新闻调整风险预算。" />
              )}
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-t-border flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-t-blue" />
                自选股影响矩阵
              </h2>
              <span className="text-[10px] text-t-textDim">新闻只做加权，最终仍看价格和量能</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              {watchNames.slice(0, 16).map(item => {
                const hits = stockImpactMap.get(item.code) || [];
                const top = hits[0];
                return (
                  <Link key={item.code} to={`/analysis?code=${item.code}`} className="p-3 border-b border-r border-t-border hover:bg-white/[0.035] transition-colors min-h-[118px]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-t-textBright truncate">{item.name}</div>
                        <div className="text-[10px] data-num text-t-textDim">{item.code} · {item.industry}</div>
                      </div>
                      {top ? (
                        <span className={`px-2 py-0.5 rounded border text-[10px] whitespace-nowrap ${impactTone(top.impact)}`}>{top.impact} {top.score}</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded border border-t-border text-[10px] text-t-textDim whitespace-nowrap">未命中</span>
                      )}
                    </div>
                    {top ? (
                      <>
                        <p className="mt-2 text-xs text-t-textSecondary line-clamp-2">{top.title}</p>
                        <p className="mt-2 text-[11px] text-t-textDim line-clamp-2">{top.action}</p>
                      </>
                    ) : (
                      <p className="mt-3 text-xs text-t-textDim">暂无直接重大资讯，按技术分析、预警和仓位纪律执行。</p>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-3 xl:sticky xl:top-3 xl:self-start xl:max-h-[calc(100vh-5.5rem)] xl:overflow-y-auto scrollbar-thin pr-1">
          <div className="panel p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-t-green" /> 行动队列</h2>
              <span className="text-[10px] text-t-textDim">{payload.generatedAt}</span>
            </div>
            <div className="space-y-2">
              {actionQueue.map(task => <ActionTaskRow key={`${task.title}-${task.detail}`} task={task} />)}
            </div>
          </div>

          <div className="panel p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-sm font-semibold text-t-textBright flex items-center gap-2"><Star className="w-4 h-4 text-t-blue" /> 扫描范围</h2>
              <button onClick={applyManualCodes} className="text-xs text-t-blue hover:underline">应用</button>
            </div>
            <textarea
              value={manualCodes}
              onChange={event => setManualCodes(event.target.value)}
              className="w-full h-20 rounded border border-t-border bg-[#11151f] px-3 py-2 text-xs text-t-text outline-none focus:border-t-blue resize-none scrollbar-thin"
              placeholder="输入股票代码，用逗号或空格分隔"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {watchNames.slice(0, 10).map(item => (
                <Link key={item.code} to={`/analysis?code=${item.code}`} className="px-1.5 py-0.5 rounded border border-t-border text-[10px] text-t-textDim hover:text-t-text">
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="panel p-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-t-yellow" />
              <h2 className="text-sm font-semibold text-t-textBright">主题热度</h2>
            </div>
            <div className="space-y-2">
              {payload.topThemes.length > 0 ? payload.topThemes.map(theme => <ThemeRow key={theme.keyword} theme={theme} />) : (
                <div className="text-xs text-t-textDim">暂无主题聚集。</div>
              )}
            </div>
          </div>

          <div className="panel p-3">
            <div className="flex items-center gap-2 mb-2">
              <BellRing className="w-4 h-4 text-t-yellow" />
              <h2 className="text-sm font-semibold text-t-textBright">自动提醒</h2>
            </div>
            <div className="space-y-2 text-xs text-t-textSecondary leading-relaxed">
              <p>盘中临时看：本页点“立即扫描”。</p>
              <p>自动推送：配置飞书后，交易日早盘发送重大资讯摘要。</p>
              <p>高频轮询：当前 Vercel 定时任务受套餐限制，页面扫描不受这个限制。</p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link to="/feishu" className="inline-flex items-center gap-1 text-t-blue hover:underline">配置飞书 <ExternalLink className="w-3 h-3" /></Link>
                <Link to="/alerts" className="inline-flex items-center gap-1 text-t-blue hover:underline">查看预警 <ArrowUpRight className="w-3 h-3" /></Link>
              </div>
            </div>
          </div>

          <section className="panel p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-t-textSecondary">
              后台接口：<span className="data-num text-t-yellow">/api/intel-cron</span>
            </div>
            <Link to="/alerts" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-t-border text-xs text-t-textDim hover:text-t-text">
              <Send className="w-3.5 h-3.5" />
              预警联动
            </Link>
          </section>
        </div>
      </section>
    </div>
  );
}

function StatusMetric({ icon: Icon, label, value, detail, tone }: { icon: typeof Star; label: string; value: string; detail: string; tone: string }) {
  return (
    <div className="p-3 border-r border-t-border last:border-r-0 min-w-0">
      <div className="flex items-center gap-2 text-t-textDim text-xs"><Icon className="w-3.5 h-3.5 flex-shrink-0" /> {label}</div>
      <div className={`mt-1 text-lg font-bold data-num truncate ${tone}`}>{value}</div>
      <div className="text-[10px] text-t-textDim mt-0.5 line-clamp-2">{detail}</div>
    </div>
  );
}

function EventRow({ hit }: { hit: IntelHit }) {
  return (
    <div className="p-4 hover:bg-white/[0.025]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${impactTone(hit.impact)}`}>{hit.severity}{hit.impact}</span>
            <span className="text-xs data-num text-t-yellow">{hit.score}分</span>
            <span className="text-[10px] text-t-textDim">{sourceLabel(hit)}</span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-t-textBright leading-relaxed">{hit.title}</h3>
          <p className="mt-2 text-xs text-t-textSecondary leading-relaxed">{hit.action}</p>
        </div>
        {hit.url && (
          <a href={hit.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded border border-t-border text-xs text-t-textDim hover:text-t-text hover:bg-t-panelHover">
            来源 <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {hit.matched.map(keyword => (
          <span key={keyword} className="px-1.5 py-0.5 rounded bg-white/[0.04] text-[10px] text-t-textDim">{keyword}</span>
        ))}
      </div>
    </div>
  );
}

function ActionTaskRow({ task }: { task: ActionTask }) {
  const Icon = task.icon;
  const content = (
    <div className="flex items-start gap-2 rounded border border-t-border bg-white/[0.02] p-2 hover:bg-white/[0.035]">
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${task.tone}`} />
      <div className="min-w-0">
        <div className="text-xs font-semibold text-t-textBright">{task.title}</div>
        <div className="mt-1 text-[11px] text-t-textDim leading-relaxed">{task.detail}</div>
      </div>
    </div>
  );
  return task.code ? <Link to={`/analysis?code=${task.code}`}>{content}</Link> : content;
}

function ThemePill({ theme }: { theme: IntelTheme }) {
  return (
    <div className="rounded border border-t-border bg-white/[0.03] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-t-textBright truncate">{theme.keyword}</span>
        <span className={`text-xs data-num ${theme.impact === '利空' ? 'text-t-green' : theme.impact === '利好' ? 'text-t-red' : 'text-t-yellow'}`}>{theme.score}</span>
      </div>
      <div className="mt-1 text-[10px] text-t-textDim">{theme.count} 次命中 · {theme.impact}</div>
    </div>
  );
}

function ThemeRow({ theme }: { theme: IntelTheme }) {
  const width = `${Math.max(12, Math.min(100, theme.score))}%`;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-t-textBright">{theme.keyword}</span>
        <span className={theme.impact === '利空' ? 'text-t-green data-num' : theme.impact === '利好' ? 'text-t-red data-num' : 'text-t-yellow data-num'}>{theme.score}</span>
      </div>
      <div className="mt-1 h-1.5 rounded bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded ${theme.impact === '利空' ? 'bg-t-green' : theme.impact === '利好' ? 'bg-t-red' : 'bg-t-yellow'}`} style={{ width }} />
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-5 text-xs text-t-textDim">
      <CheckCircle2 className="w-4 h-4 text-t-blue mb-2" />
      {text}
    </div>
  );
}
