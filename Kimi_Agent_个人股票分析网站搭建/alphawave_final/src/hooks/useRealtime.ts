import { useCallback, useEffect, useMemo, useState } from 'react';
import { refreshRealtimeBus, subscribeRealtime, type RealtimeSnapshot } from '../data/realtimeBus';

interface UseRealtimeOptions {
  codes?: string[];
  enabled?: boolean;
}

const initialSnapshot: RealtimeSnapshot = {
  quotes: [],
  loading: false,
  error: null,
  lastUpdate: 0,
  countdown: 0,
  interval: 0,
  phase: '',
  nextHint: '',
  marketOpen: false,
  tradingDay: false,
  isPaused: false,
};

export function useRealtimeQuotes(options: UseRealtimeOptions = {}) {
  const { codes, enabled = true } = options;
  const codeKey = useMemo(() => (codes || []).join('|'), [codes]);
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot>(initialSnapshot);

  const refresh = useCallback(async () => {
    refreshRealtimeBus();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    return subscribeRealtime(codes, setSnapshot);
  }, [enabled, codeKey]);

  return {
    ...snapshot,
    refresh,
  };
}
