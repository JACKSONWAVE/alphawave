import stockDataJson from './stockData.json';

// Keep TS compile fast: store large payload in JSON, re-export as `stockData`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stockData: any = stockDataJson as any;

