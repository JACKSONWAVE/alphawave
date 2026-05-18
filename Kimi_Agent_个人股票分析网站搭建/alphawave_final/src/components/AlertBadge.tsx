import { useEffect, useMemo, useState } from 'react';
import { getAlerts, getStockInfo } from '../data/mockData';
import { useRealtimeQuotes } from '../hooks/useRealtime';

export function AlertBadge() {
  const [alerts, setAlerts] = useState(getAlerts());
  const codes = useMemo(() => Array.from(new Set(alerts.map(alert => alert.code))), [alerts]);
  const { quotes } = useRealtimeQuotes({ codes });
  const quoteMap = useMemo(() => new Map(quotes.map(quote => [quote.code, quote])), [quotes]);

  useEffect(() => {
    const reload = () => setAlerts(getAlerts());
    window.addEventListener('alphawave:alerts-changed', reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener('alphawave:alerts-changed', reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const count = alerts.filter(alert => {
    if (!alert.enabled) return false;
    const price = quoteMap.get(alert.code)?.price ?? getStockInfo(alert.code).price;
    return alert.type === 'above' ? price >= alert.price : price <= alert.price;
  }).length;

  if (!count) return null;
  return (
    <span className="absolute right-2 top-1.5 w-4 h-4 rounded-full bg-t-red text-white text-[9px] flex items-center justify-center font-bold">{count}</span>
  );
}
