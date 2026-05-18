import type { IntradayPoint } from './realtimeKline';
import { formatPrice } from './price';

export interface IntradayStrategy {
  bias: 'up' | 'down' | 'range';
  score: number;
  action: string;
  entry: number;
  stop: number;
  target: number;
  notes: string[];
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function buildIntradayStrategy(points: IntradayPoint[]): IntradayStrategy | null {
  if (points.length < 20) return null;

  const latest = points[points.length - 1];
  const first = points[0];
  const last30 = points.slice(-30);
  const high = Math.max(...points.map(point => point.price));
  const low = Math.min(...points.map(point => point.price));
  const vwap = points.reduce((sum, point) => sum + point.price * Math.max(point.volume, 1), 0) / points.reduce((sum, point) => sum + Math.max(point.volume, 1), 0);
  const shortMa = avg(last30.slice(-8).map(point => point.price));
  const longMa = avg(last30.map(point => point.price));
  const dayChange = first.price ? (latest.price - first.price) / first.price * 100 : 0;
  const rangePct = latest.price ? (high - low) / latest.price * 100 : 0;
  const momentum = shortMa - longMa;
  const score = Math.round(Math.max(-100, Math.min(100, dayChange * 18 + momentum / latest.price * 900 + (latest.price > vwap ? 12 : -12))));
  const bias = score >= 25 ? 'up' : score <= -25 ? 'down' : 'range';
  const pullbackEntry = Math.max(vwap, latest.price - (high - low) * 0.28);
  const breakoutEntry = high * 1.002;
  const entry = bias === 'up' ? breakoutEntry : pullbackEntry;
  const stop = bias === 'down' ? high * 1.006 : Math.min(vwap * 0.995, low * 0.998);
  const target = bias === 'down' ? low * 0.995 : Math.max(high, latest.price + (high - low) * 0.45);
  const action = bias === 'up'
    ? `偏强，只在突破 ${formatPrice(breakoutEntry)} 或回踩VWAP不破后做小仓波段`
    : bias === 'down'
      ? `偏弱，不追反弹；若跌破 ${formatPrice(low)} 优先防守`
      : `震荡，靠近 ${formatPrice(low)}~${formatPrice(vwap)} 低吸，冲高到 ${formatPrice(high)} 附近止盈`;

  return {
    bias,
    score,
    action,
    entry,
    stop,
    target,
    notes: [
      `VWAP ${formatPrice(vwap)}，日内高低区间 ${formatPrice(low)}~${formatPrice(high)}`,
      rangePct > 4 ? '日内波动偏大，单笔仓位应低于中期仓位' : '日内波动正常，等待价格触发再行动',
      latest.price > vwap ? '价格在VWAP上方，短线资金承接尚可' : '价格在VWAP下方，短线先按弱势处理',
    ],
  };
}
