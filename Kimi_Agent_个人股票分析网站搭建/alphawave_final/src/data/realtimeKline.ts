import type { KlineData } from './mockData';
import type { RealtimeQuote } from './realtimeApi';
import { roundPrice } from './price';

function quoteDate(quote?: RealtimeQuote): string {
  const raw = quote?.time || '';
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return new Date().toISOString().slice(0, 10);
}

export function mergeRealtimeQuoteIntoKline(data: KlineData[], quote?: RealtimeQuote): KlineData[] {
  if (!quote || !quote.price || data.length === 0) return data;

  const date = quoteDate(quote);
  const previous = data[data.length - 1];
  const candle: KlineData = {
    date,
    open: roundPrice(quote.open || previous.close),
    high: roundPrice(Math.max(quote.high || quote.price, quote.price, quote.open || quote.price)),
    low: roundPrice(Math.min(quote.low || quote.price, quote.price, quote.open || quote.price)),
    close: roundPrice(quote.price),
    volume: quote.volume || previous.volume,
    amount: quote.amount || previous.amount,
  };

  if (previous.date === date) {
    return [...data.slice(0, -1), { ...previous, ...candle }];
  }

  if (previous.date < date) {
    return [...data, candle];
  }

  return data;
}

export interface IntradayPoint {
  time: string;
  price: number;
  volume: number;
  amount: number;
}

export function intradayToKline(points: IntradayPoint[]): KlineData[] {
  return points.map((point, index) => {
    const open = index === 0 ? point.price : points[index - 1].price;
    return {
      date: point.time,
      open: roundPrice(open),
      high: roundPrice(Math.max(open, point.price)),
      low: roundPrice(Math.min(open, point.price)),
      close: roundPrice(point.price),
      volume: point.volume,
      amount: point.amount,
    };
  });
}
