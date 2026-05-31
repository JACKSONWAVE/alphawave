import { getKlineData, getStockList, type KlineData, type TradeRecord } from './mockData';
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

export interface AccountEquityPoint {
  date: string;
  equity: number;
  benchmark: number;
  totalAssets: number;
  marketValue: number;
  cash: number;
  investedPct: number;
  drawdown: number;
}

export interface AccountPerformance {
  hasRealTrades: boolean;
  initialCapital: number;
  curve: AccountEquityPoint[];
  totalReturnPct: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  tradeCount: number;
  closedTradeCount: number;
  avgHoldingDays: number;
  bestTradePct: number;
  worstTradePct: number;
  notes: string[];
}

const round = (value: number) => +value.toFixed(2);

function daysBetween(start: string, end: string) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;
  return Math.max(0, Math.round((endTime - startTime) / 86400000));
}

function closeAsOf(data: KlineData[], date: string) {
  let close = data[0]?.close || 0;
  for (const day of data) {
    if (day.date > date) break;
    close = day.close;
  }
  return close;
}

function buildCloseCache(codes: string[], days: number) {
  return new Map(codes.map(code => [code, getKlineData(code, days + 80)]));
}

function buildBenchmarkIndex(dates: string[]) {
  const benchmark = getKlineData('510300.SH', Math.max(260, dates.length + 80));
  const first = dates[0] ? closeAsOf(benchmark, dates[0]) || benchmark[0]?.close || 1 : benchmark[0]?.close || 1;
  return dates.map(date => {
    const close = closeAsOf(benchmark, date) || first;
    return round(close / first * 100);
  });
}

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

export function buildAccountPerformance(
  trades: TradeRecord[],
  initialCapital = 1000000,
  days = 240,
): AccountPerformance {
  const sortedTrades = [...trades].sort((a, b) => `${a.date}-${a.id}`.localeCompare(`${b.date}-${b.id}`));
  const benchmark = getKlineData('510300.SH', days);
  const dates = benchmark.map(day => day.date);
  const codeList = Array.from(new Set(sortedTrades.map(trade => trade.code)));
  const closeCache = buildCloseCache(codeList, days);
  const tradeQueue = [...sortedTrades];
  const positions = new Map<string, number>();
  let cash = initialCapital;
  let peakAssets = initialCapital;
  const benchmarkIndex = buildBenchmarkIndex(dates);

  const curve = dates.map((date, index) => {
    while (tradeQueue.length && tradeQueue[0].date <= date) {
      const trade = tradeQueue.shift()!;
      const currentShares = positions.get(trade.code) || 0;
      if (trade.type === 'buy') {
        positions.set(trade.code, currentShares + trade.shares);
        cash -= trade.price * trade.shares + trade.fee;
      } else {
        const sellShares = Math.min(trade.shares, currentShares);
        positions.set(trade.code, currentShares - sellShares);
        cash += trade.price * sellShares - trade.fee * (sellShares / Math.max(trade.shares, 1));
      }
    }

    const marketValue = Array.from(positions.entries()).reduce((sum, [code, shares]) => {
      if (shares <= 0) return sum;
      const close = closeAsOf(closeCache.get(code) || [], date);
      return sum + close * shares;
    }, 0);
    const totalAssets = cash + marketValue;
    peakAssets = Math.max(peakAssets, totalAssets);

    return {
      date,
      equity: initialCapital > 0 ? round(totalAssets / initialCapital * 100) : 100,
      benchmark: benchmarkIndex[index] || 100,
      totalAssets: round(totalAssets),
      marketValue: round(marketValue),
      cash: round(cash),
      investedPct: totalAssets > 0 ? round(marketValue / totalAssets * 100) : 0,
      drawdown: peakAssets > 0 ? round((totalAssets - peakAssets) / peakAssets * 100) : 0,
    };
  });

  const lots = new Map<string, Array<{ shares: number; costPerShare: number; date: string }>>();
  const realizedReturns: number[] = [];
  const realizedPnLs: number[] = [];
  const holdingDays: number[] = [];

  sortedTrades.forEach(trade => {
    const currentLots = lots.get(trade.code) || [];
    if (trade.type === 'buy') {
      currentLots.push({
        shares: trade.shares,
        costPerShare: (trade.price * trade.shares + trade.fee) / Math.max(trade.shares, 1),
        date: trade.date,
      });
      lots.set(trade.code, currentLots);
      return;
    }

    let remaining = trade.shares;
    while (remaining > 0 && currentLots.length) {
      const lot = currentLots[0];
      const matched = Math.min(remaining, lot.shares);
      const sellFee = trade.fee * (matched / Math.max(trade.shares, 1));
      const proceeds = trade.price * matched - sellFee;
      const costBasis = lot.costPerShare * matched;
      const pnl = proceeds - costBasis;
      realizedPnLs.push(round(pnl));
      realizedReturns.push(costBasis > 0 ? round(pnl / costBasis * 100) : 0);
      holdingDays.push(daysBetween(lot.date, trade.date));
      lot.shares -= matched;
      remaining -= matched;
      if (lot.shares <= 0) currentLots.shift();
    }
    lots.set(trade.code, currentLots);
  });

  const wins = realizedPnLs.filter(value => value > 0);
  const losses = realizedPnLs.filter(value => value < 0);
  const grossProfit = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  const closedTradeCount = realizedPnLs.length;
  const latest = curve[curve.length - 1];
  const maxDrawdown = curve.length ? Math.min(...curve.map(point => point.drawdown)) : 0;
  const totalReturnPct = latest ? round(latest.equity - 100) : 0;
  const winRate = closedTradeCount ? round(wins.length / closedTradeCount * 100) : 0;
  const profitFactor = grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? 9.99 : 0;
  const avgHoldingDays = holdingDays.length ? round(holdingDays.reduce((sum, value) => sum + value, 0) / holdingDays.length) : 0;
  const bestTradePct = realizedReturns.length ? round(Math.max(...realizedReturns)) : 0;
  const worstTradePct = realizedReturns.length ? round(Math.min(...realizedReturns)) : 0;

  return {
    hasRealTrades: sortedTrades.length > 0,
    initialCapital: round(initialCapital),
    curve,
    totalReturnPct,
    maxDrawdown,
    winRate,
    profitFactor,
    tradeCount: sortedTrades.length,
    closedTradeCount,
    avgHoldingDays,
    bestTradePct,
    worstTradePct,
    notes: [
      sortedTrades.length
        ? `真实账户曲线来自 ${sortedTrades.length} 条交易记录，按每日收盘价做持仓盯市。`
        : '暂无真实交易记录，账户曲线暂按现金基准展示。',
      closedTradeCount
        ? `已闭合 ${closedTradeCount} 段交易，胜率 ${winRate}%、利润因子 ${profitFactor}。`
        : '还没有完整卖出闭环，胜率和利润因子暂不作为仓位依据。',
      maxDrawdown <= -12
        ? '最大回撤已进入警戒区，后续加仓需要先降低波动敞口。'
        : '当前账户回撤压力可控，仍需结合止损线和市场温度执行。',
    ],
  };
}
