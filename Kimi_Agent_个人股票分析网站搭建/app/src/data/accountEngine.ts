import { getStockList, type TradeRecord } from './mockData';
import type { RealtimeQuote } from './realtimeApi';

export interface AccountPosition {
  code: string;
  name: string;
  shares: number;
  avgCost: number;
  price: number;
  marketValue: number;
  costValue: number;
  unrealizedPnL: number;
  unrealizedPct: number;
  todayPnL: number;
  weight: number;
}

export interface AccountSummary {
  initialCapital: number;
  cash: number;
  marketValue: number;
  totalAssets: number;
  availableCashPct: number;
  investedPct: number;
  todayPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  totalReturnPct: number;
  positions: AccountPosition[];
}

const round = (value: number) => +value.toFixed(2);

export function buildAccountSummary(
  trades: TradeRecord[],
  initialCapital = 1000000,
  realtimeQuotes: RealtimeQuote[] = [],
): AccountSummary {
  const stockMap = new Map(getStockList().map(stock => [stock.code, stock]));
  const quoteMap = new Map(realtimeQuotes.map(quote => [quote.code, quote]));
  const positions = new Map<string, { code: string; name: string; shares: number; costValue: number }>();
  let cash = initialCapital;
  let realizedPnL = 0;

  [...trades]
    .sort((a, b) => `${a.date}-${a.id}`.localeCompare(`${b.date}-${b.id}`))
    .forEach(trade => {
      const current = positions.get(trade.code) || {
        code: trade.code,
        name: trade.name,
        shares: 0,
        costValue: 0,
      };

      if (trade.type === 'buy') {
        const gross = trade.price * trade.shares;
        const cost = gross + trade.fee;
        current.shares += trade.shares;
        current.costValue += cost;
        cash -= cost;
      } else {
        const sellShares = Math.min(trade.shares, current.shares);
        const avgCost = current.shares > 0 ? current.costValue / current.shares : trade.price;
        const costBasis = avgCost * sellShares;
        const proceeds = trade.price * sellShares - trade.fee;
        current.shares -= sellShares;
        current.costValue = Math.max(0, current.costValue - costBasis);
        cash += proceeds;
        realizedPnL += proceeds - costBasis;
      }

      current.name = trade.name;
      positions.set(trade.code, current);
    });

  const rows: AccountPosition[] = Array.from(positions.values())
    .filter(position => position.shares > 0)
    .map(position => {
      const quote = quoteMap.get(position.code);
      const stock = stockMap.get(position.code);
      const price = quote?.price ?? stock?.price ?? (position.costValue / position.shares);
      const change = quote?.change ?? stock?.change ?? 0;
      const avgCost = position.costValue / position.shares;
      const marketValue = price * position.shares;
      const unrealizedPnL = marketValue - position.costValue;
      return {
        code: position.code,
        name: position.name,
        shares: position.shares,
        avgCost: round(avgCost),
        price: round(price),
        marketValue: round(marketValue),
        costValue: round(position.costValue),
        unrealizedPnL: round(unrealizedPnL),
        unrealizedPct: avgCost ? round((price - avgCost) / avgCost * 100) : 0,
        todayPnL: round(change * position.shares),
        weight: 0,
      };
    });

  const marketValue = rows.reduce((sum, position) => sum + position.marketValue, 0);
  const totalAssets = cash + marketValue;
  const positionsWithWeight = rows
    .map(position => ({
      ...position,
      weight: totalAssets > 0 ? round(position.marketValue / totalAssets * 100) : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);
  const unrealizedPnL = positionsWithWeight.reduce((sum, position) => sum + position.unrealizedPnL, 0);
  const todayPnL = positionsWithWeight.reduce((sum, position) => sum + position.todayPnL, 0);
  const totalPnL = totalAssets - initialCapital;

  return {
    initialCapital: round(initialCapital),
    cash: round(cash),
    marketValue: round(marketValue),
    totalAssets: round(totalAssets),
    availableCashPct: totalAssets > 0 ? round(cash / totalAssets * 100) : 0,
    investedPct: totalAssets > 0 ? round(marketValue / totalAssets * 100) : 0,
    todayPnL: round(todayPnL),
    realizedPnL: round(realizedPnL),
    unrealizedPnL: round(unrealizedPnL),
    totalPnL: round(totalPnL),
    totalReturnPct: initialCapital > 0 ? round(totalPnL / initialCapital * 100) : 0,
    positions: positionsWithWeight,
  };
}
