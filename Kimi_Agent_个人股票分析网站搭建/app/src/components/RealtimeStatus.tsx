import { useEffect, useState } from 'react';
import { RefreshCw, Moon, Sunrise, Sunset } from 'lucide-react';
import { useRealtimeQuotes } from '../hooks/useRealtime';

export default function RealtimeStatus() {
  const { loading, lastUpdate, countdown, interval, phase, nextHint, isPaused, marketOpen, refresh } = useRealtimeQuotes({});
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (lastUpdate > 0) { setPulse(true); const t = setTimeout(() => setPulse(false), 1000); return () => clearTimeout(t); }
  }, [lastUpdate]);

  const formatTime = (ts: number) => ts === 0 ? '--:--:--' : new Date(ts).toTimeString().split(' ')[0];

  // 停刷状态（周末/节假日/非交易时段）
  if (isPaused) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-1.5 panel rounded text-xs">
        <div className="flex items-center gap-1 text-t-textDim">
          <Moon className="w-3 h-3" />
          <span>{phase}</span>
        </div>
        <div className="flex items-center gap-1 text-t-textDim">
          <span>下次</span>
          <span className="text-t-yellow data-num">{nextHint}</span>
        </div>
        <div className="flex items-center gap-1 text-t-textDim">
          <span>更新</span>
          <span className={`data-num text-t-text ${pulse ? 'text-t-green' : ''} transition-colors`}>{formatTime(lastUpdate)}</span>
        </div>
        <button onClick={refresh} disabled={loading}
          className={`ml-auto flex items-center gap-1 text-t-blue hover:text-blue-400 transition-colors ${loading ? 'opacity-50' : ''}`}>
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? '刷新中' : '手动刷新'}</span>
        </button>
      </div>
    );
  }

  // 交易状态
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-1.5 panel rounded text-xs">
      {/* 刷新按钮 */}
      <button onClick={refresh} disabled={loading}
        className={`flex items-center gap-1 text-t-blue hover:text-blue-400 transition-colors ${loading ? 'opacity-50' : ''}`}>
        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        <span>{loading ? '刷新中' : '刷新'}</span>
      </button>

      {/* 时段 */}
      <div className="flex items-center gap-1">
        {marketOpen ? (
          <span className="flex items-center gap-1 text-t-green">
            <Sunrise className="w-3 h-3" /> {phase}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-t-yellow">
            <Sunset className="w-3 h-3" /> {phase}
          </span>
        )}
      </div>

      {/* 间隔 */}
      <div className="flex items-center gap-1 text-t-textDim">
        <span>间隔</span>
        <span className="data-num text-t-text font-medium">{interval}s</span>
      </div>

      {/* 更新时间 */}
      <div className="flex items-center gap-1 text-t-textDim">
        <span>更新</span>
        <span className={`data-num text-t-text ${pulse ? 'text-t-green' : ''} transition-colors`}>{formatTime(lastUpdate)}</span>
      </div>

      {/* 倒计时 + 进度条 */}
      <div className="flex items-center gap-2 text-t-textDim">
        <span>下次</span>
        <span className="data-num text-t-text w-6 text-right">{countdown}s</span>
        <div className="w-16 h-1.5 bg-t-border rounded-full overflow-hidden flex-shrink-0">
          <div
            className="h-full bg-t-blue rounded-full transition-all duration-1000"
            style={{ width: `${interval > 0 ? (countdown / interval) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}
