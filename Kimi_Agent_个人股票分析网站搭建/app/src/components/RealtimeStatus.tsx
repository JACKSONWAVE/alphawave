import { useEffect, useState } from 'react';
import { Clock3, Moon, RefreshCw, Sunrise, Sunset } from 'lucide-react';
import { useRealtimeQuotes } from '../hooks/useRealtime';

export default function RealtimeStatus() {
  const { loading, lastUpdate, countdown, interval, phase, nextHint, isPaused, marketOpen, refresh } = useRealtimeQuotes({});
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (lastUpdate > 0) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1000);
      return () => clearTimeout(t);
    }
  }, [lastUpdate]);

  const formatTime = (ts: number) => ts === 0 ? '--:--:--' : new Date(ts).toTimeString().split(' ')[0];
  const refreshText = isPaused ? '自动巡检 60s' : `自动刷新 ${interval}s`;
  const nextText = isPaused ? nextHint : `${countdown}s 后抓取`;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-1.5 panel rounded text-xs">
      <button onClick={refresh} disabled={loading}
        className={`flex items-center gap-1 text-t-blue hover:text-blue-400 transition-colors ${loading ? 'opacity-50' : ''}`}>
        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        <span>{loading ? '抓取中' : '手动刷新'}</span>
      </button>

      <div className="flex items-center gap-1">
        {marketOpen ? (
          <span className="flex items-center gap-1 text-t-green">
            <Sunrise className="w-3 h-3" /> {phase}
          </span>
        ) : isPaused ? (
          <span className="flex items-center gap-1 text-t-yellow">
            <Moon className="w-3 h-3" /> {phase}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-t-yellow">
            <Sunset className="w-3 h-3" /> {phase}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 text-t-textDim">
        <Clock3 className="w-3 h-3" />
        <span>{refreshText}</span>
      </div>

      <div className="flex items-center gap-1 text-t-textDim">
        <span>接口更新</span>
        <span className={`data-num text-t-text ${pulse ? 'text-t-green' : ''} transition-colors`}>{formatTime(lastUpdate)}</span>
      </div>

      <div className="flex items-center gap-2 text-t-textDim min-w-[130px]">
        <span>下次</span>
        <span className="data-num text-t-yellow whitespace-nowrap">{nextText}</span>
        {!isPaused && (
          <div className="w-16 h-1.5 bg-t-border rounded-full overflow-hidden flex-shrink-0">
            <div
              className="h-full bg-t-blue rounded-full transition-all duration-1000"
              style={{ width: `${interval > 0 ? (countdown / interval) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
