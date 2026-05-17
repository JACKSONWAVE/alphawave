import { useEffect, useState } from 'react';
import { getAlerts } from '../data/mockData';

export function AlertBadge() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const alerts = getAlerts();
    setCount(alerts.filter(a => a.enabled).length);
  }, []);
  if (!count) return null;
  return (
    <span className="absolute right-2 top-1.5 w-4 h-4 rounded-full bg-t-red text-white text-[9px] flex items-center justify-center font-bold">{count}</span>
  );
}
