import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchRealtimeQuotes, getSmartInterval, isMarketOpen, isTradingDay, getMarketPhase, getNextSessionHint, type RealtimeQuote } from '../data/realtimeApi';

interface UseRealtimeOptions {
  codes?: string[];
  enabled?: boolean;
}

export function useRealtimeQuotes(options: UseRealtimeOptions = {}) {
  const { codes, enabled = true } = options;
  const [quotes, setQuotes] = useState<RealtimeQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [currentInterval, setCurrentInterval] = useState(0);
  const [phase, setPhase] = useState(getMarketPhase());
  const [nextHint, setNextHint] = useState(getNextSessionHint());
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRunningRef = useRef(false);

  const refresh = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRealtimeQuotes(codes);
      setQuotes(data);
      setLastUpdate(Date.now());
      const newInt = getSmartInterval();
      setCurrentInterval(newInt);
      setPhase(getMarketPhase());
      setNextHint(getNextSessionHint());
      setIsPaused(newInt === 0);
      setCountdown(newInt);
    } catch {
      setError('获取失败');
    } finally {
      setLoading(false);
      isRunningRef.current = false;
    }
  }, [codes]);

  // 主刷新循环
  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      const nowInt = getSmartInterval();
      setCurrentInterval(nowInt);
      setPhase(getMarketPhase());
      setNextHint(getNextSessionHint());
      setIsPaused(nowInt === 0);

      if (nowInt === 0) {
        // 非交易时段：每60秒检查一次是否开市，不做刷新
        timerRef.current = setTimeout(tick, 60000);
        return;
      }

      // 交易时段：正常刷新
      await refresh();
      timerRef.current = setTimeout(tick, nowInt * 1000);
    };

    // 立即启动
    tick();

    // 倒计时（每秒更新UI）
    const cd = setInterval(() => {
      setCountdown(c => {
        const intv = getSmartInterval();
        if (intv === 0) return 0; // 停刷时倒计时为0
        if (c <= 0) return intv;
        return c - 1;
      });
      // 顺便更新时段描述
      setPhase(getMarketPhase());
      setNextHint(getNextSessionHint());
    }, 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearInterval(cd);
    };
  }, [enabled, refresh]);

  return {
    quotes, loading, error,
    lastUpdate, countdown,
    interval: currentInterval,
    phase, nextHint,
    marketOpen: isMarketOpen(),
    tradingDay: isTradingDay(),
    isPaused,
    refresh,
  };
}
