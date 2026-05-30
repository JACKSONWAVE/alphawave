import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Newspaper,
  RefreshCw,
  Send,
  Star,
} from 'lucide-react';

import { getStockList } from '../data/mockData';

interface WatchItem {
  code: string;
  group?: string;
  note?: string;
}

interface IntelResponse {
  ok?: boolean;
  dryRun?: boolean;
  sent?: boolean;
  watch?: string[];
  message?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
  detail?: string;
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

function parseSummary(report: string) {
  const marketCount = (report.match(/- \*\*/g) || []).length;
  const watchCount = (report.match(/\[.*?\]\(/g) || []).length;
  const riskCount = (report.match(/利空|风险|下调|制裁|减持|亏损/g) || []).length;
  return { marketCount, watchCount, riskCount };
}

export default function IntelRadar() {
  const stockList = useMemo(() => getStockList(), []);
  const stockMap = useMemo(() => new Map(stockList.map(stock => [stock.code, stock])), [stockList]);
  const [codes, setCodes] = useState<string[]>(() => readWatchCodes());
  const [manualCodes, setManualCodes] = useState(() => readWatchCodes().join(', '));
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');
  const summary = useMemo(() => parseSummary(report), [report]);

  const watchNames = useMemo(() => codes.map(code => ({
    code,
    name: stockMap.get(code)?.name || code,
  })), [codes, stockMap]);

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
      if (data.skipped) {
        setReport(`## AlphaWave 重大资讯雷达\n\n${data.reason || '当前没有发现需要推送的重大资讯。'}`);
      } else {
        setReport(data.message || '当前没有发现需要推送的重大资讯。');
      }
      setLastUpdate(formatTime(new Date()));
    } catch (err) {
      setError(err instanceof Error ? err.message : '资讯扫描失败');
    } finally {
      setLoading(false);
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
              重大资讯雷达
            </h1>
            <p className="text-xs text-t-textDim mt-1">
              扫描国内/国际财经重大新闻，自动判断利好利空，并映射到你的自选股和仓位动作。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={syncWatchlist} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-t-border text-xs text-t-textDim hover:text-t-text hover:bg-t-panelHover">
              <Star className="w-3.5 h-3.5" />
              同步自选股
            </button>
            <button onClick={scanIntel} disabled={loading} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-t-blue text-white text-xs font-medium disabled:opacity-60">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              立即扫描
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-t-border">
          <StatusMetric icon={Star} label="重点自选股" value={`${codes.length}只`} detail="来自自选股列表" tone="text-t-blue" />
          <StatusMetric icon={Newspaper} label="扫描结果" value={`${summary.marketCount}条`} detail="重大市场事件" tone="text-t-yellow" />
          <StatusMetric icon={AlertTriangle} label="风险词命中" value={`${summary.riskCount}次`} detail="利空/风险优先看" tone={summary.riskCount ? 'text-t-green' : 'text-t-text'} />
          <StatusMetric icon={Clock3} label="最近刷新" value={lastUpdate || '--'} detail="页面手动扫描时间" tone="text-t-textBright" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-0">
          <div className="p-4 border-r border-t-border space-y-3">
            <div>
              <div className="text-xs font-semibold text-t-textBright mb-2">当前重点关注</div>
              <div className="flex flex-wrap gap-2">
                {watchNames.slice(0, 24).map(item => (
                  <Link key={item.code} to={`/analysis?code=${item.code}`} className="px-2 py-1 rounded border border-t-border bg-white/[0.02] text-xs hover:bg-white/[0.04]">
                    <span className="text-t-textBright">{item.name}</span>
                    <span className="ml-1 data-num text-t-textDim">{item.code}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-t-textBright mb-2">临时扫描股票</label>
              <textarea
                value={manualCodes}
                onChange={event => setManualCodes(event.target.value)}
                className="w-full h-24 rounded border border-t-border bg-[#11151f] px-3 py-2 text-xs text-t-text outline-none focus:border-t-blue resize-none"
                placeholder="输入股票代码，用逗号或空格分隔"
              />
              <button onClick={applyManualCodes} className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-t-blue/40 text-xs text-t-blue hover:bg-t-blue/10">
                <CheckCircle2 className="w-3.5 h-3.5" />
                应用扫描范围
              </button>
            </div>

            <div className="rounded border border-t-border bg-white/[0.02] p-3 text-xs text-t-textSecondary space-y-2">
              <div className="flex items-center gap-2 text-t-textBright font-semibold">
                <BellRing className="w-3.5 h-3.5 text-t-yellow" />
                在哪里看
              </div>
              <p>盘中临时看：就在本页点“立即扫描”。</p>
              <p>自动提醒看：配置飞书后，交易日早上云端自动推送重大资讯摘要。</p>
              <Link to="/feishu" className="inline-flex items-center gap-1 text-t-blue hover:underline">
                去配置飞书推送 <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div className="p-4">
            {error && (
              <div className="mb-3 rounded border border-t-green/30 bg-t-green/10 p-3 text-xs text-t-green">
                {error}
              </div>
            )}
            <div className="rounded border border-t-border bg-[#0f131b] overflow-hidden">
              <div className="px-3 py-2 border-b border-t-border flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-t-textBright">资讯扫描报告</span>
                <span className="text-[10px] text-t-textDim">{loading ? '扫描中...' : 'dry-run 预览，不会重复推送飞书'}</span>
              </div>
              <pre className="min-h-[440px] max-h-[calc(100vh-260px)] overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-6 text-t-textSecondary scrollbar-thin">
                {report || '正在扫描重大资讯...'}
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-t-textSecondary">
          后台接口：<span className="data-num text-t-yellow">/api/intel-cron</span>；定时任务受 Vercel 当前套餐限制，页面手动扫描可随时触发。
        </div>
        <Link to="/alerts" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-t-border text-xs text-t-textDim hover:text-t-text">
          <Send className="w-3.5 h-3.5" />
          查看预警联动
        </Link>
      </section>
    </div>
  );
}

function StatusMetric({ icon: Icon, label, value, detail, tone }: { icon: typeof Star; label: string; value: string; detail: string; tone: string }) {
  return (
    <div className="p-3 border-r border-t-border last:border-r-0">
      <div className="flex items-center gap-2 text-t-textDim text-xs"><Icon className="w-3.5 h-3.5" /> {label}</div>
      <div className={`mt-1 text-lg font-bold data-num ${tone}`}>{value}</div>
      <div className="text-[10px] text-t-textDim mt-0.5">{detail}</div>
    </div>
  );
}
