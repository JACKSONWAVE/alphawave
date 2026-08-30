export type DcfAssumptions = {
  baseRevenue: number;
  revenueGrowth: number;
  ebitdaMargin: number;
  taxRate: number;
  capexPct: number;
  nwcPct: number;
  wacc: number;
  terminalGrowth: number;
  shares: number;
  netDebt: number;
};

export type ForecastYear = {
  year: string;
  revenue: number;
  ebitda: number;
  ebit: number;
  netIncome: number;
  fcff: number;
  forecast: boolean;
};

export const defaultDcfAssumptions: DcfAssumptions = {
  baseRevenue: 171.6,
  revenueGrowth: 0.185,
  ebitdaMargin: 0.156,
  taxRate: 0.18,
  capexPct: 0.055,
  nwcPct: 0.12,
  wacc: 0.087,
  terminalGrowth: 0.025,
  shares: 14.63,
  netDebt: -42.6,
};

export const historicalFinancials: ForecastYear[] = [
  { year: '2022A', revenue: 130.1, ebitda: 17.8, ebit: 13.6, netIncome: 15.4, fcff: 8.2, forecast: false },
  { year: '2023A', revenue: 143.5, ebitda: 20.9, ebit: 16.2, netIncome: 18.4, fcff: 10.6, forecast: false },
  { year: '2024A', revenue: 158.8, ebitda: 23.6, ebit: 18.1, netIncome: 20.7, fcff: 12.1, forecast: false },
  { year: '2025A', revenue: 171.6, ebitda: 26.0, ebit: 19.8, netIncome: 22.3, fcff: 13.8, forecast: false },
];

export function buildForecast(assumptions: DcfAssumptions): ForecastYear[] {
  const result: ForecastYear[] = [];
  let revenue = assumptions.baseRevenue;
  let previousNwc = revenue * assumptions.nwcPct;

  for (let index = 0; index < 5; index += 1) {
    const fade = Math.max(0.72, 1 - index * 0.07);
    const growth = assumptions.revenueGrowth * fade;
    revenue *= 1 + growth;
    const margin = assumptions.ebitdaMargin + index * 0.0025;
    const ebitda = revenue * margin;
    const depreciation = revenue * 0.032;
    const ebit = ebitda - depreciation;
    const nopat = ebit * (1 - assumptions.taxRate);
    const capex = revenue * assumptions.capexPct;
    const nwc = revenue * assumptions.nwcPct;
    const changeNwc = nwc - previousNwc;
    const fcff = nopat + depreciation - capex - changeNwc;
    const netIncome = ebit * (1 - assumptions.taxRate) + 1.2;
    previousNwc = nwc;
    result.push({
      year: `${2026 + index}E`,
      revenue,
      ebitda,
      ebit,
      netIncome,
      fcff,
      forecast: true,
    });
  }

  return result;
}

export function calculateDcf(assumptions: DcfAssumptions) {
  const forecast = buildForecast(assumptions);
  const discountedFcff = forecast.map((item, index) => item.fcff / ((1 + assumptions.wacc) ** (index + 1)));
  const terminalFcff = forecast[forecast.length - 1].fcff * (1 + assumptions.terminalGrowth);
  const terminalValue = terminalFcff / (assumptions.wacc - assumptions.terminalGrowth);
  const discountedTerminalValue = terminalValue / ((1 + assumptions.wacc) ** forecast.length);
  const enterpriseValue = discountedFcff.reduce((sum, value) => sum + value, 0) + discountedTerminalValue;
  const equityValue = enterpriseValue - assumptions.netDebt;
  const pricePerShare = equityValue / assumptions.shares;
  const terminalValuePct = discountedTerminalValue / enterpriseValue;

  return {
    forecast,
    discountedFcff,
    terminalValue,
    discountedTerminalValue,
    enterpriseValue,
    equityValue,
    pricePerShare,
    terminalValuePct,
  };
}

export const comparableCompanies = [
  { name: '中科曙光', code: '603019.SH', price: 41.82, revenueGrowth: 18.5, ebitdaMargin: 15.6, evRevenue: 3.2, evEbitda: 20.4, pe: 31.8, roe: 11.9, selected: true },
  { name: '浪潮信息', code: '000977.SZ', price: 47.36, revenueGrowth: 24.1, ebitdaMargin: 8.8, evRevenue: 1.1, evEbitda: 12.7, pe: 27.4, roe: 13.7, selected: true },
  { name: '紫光股份', code: '000938.SZ', price: 28.64, revenueGrowth: 12.8, ebitdaMargin: 9.6, evRevenue: 1.0, evEbitda: 10.8, pe: 25.2, roe: 10.8, selected: true },
  { name: '工业富联', code: '601138.SH', price: 29.15, revenueGrowth: 16.3, ebitdaMargin: 6.9, evRevenue: 0.9, evEbitda: 13.1, pe: 23.6, roe: 21.4, selected: true },
  { name: '海光信息', code: '688041.SH', price: 118.9, revenueGrowth: 38.7, ebitdaMargin: 34.2, evRevenue: 15.8, evEbitda: 46.1, pe: 72.4, roe: 14.5, selected: false },
  { name: '神州数码', code: '000034.SZ', price: 36.42, revenueGrowth: 9.7, ebitdaMargin: 3.4, evRevenue: 0.3, evEbitda: 8.9, pe: 18.7, roe: 17.6, selected: true },
];

export const coverageCompanies = [
  { name: '中科曙光', code: '603019.SH', sector: '算力基础设施', stage: '估值复核', analyst: '刘宇森', updated: '今天 12:08', rating: '重点覆盖', progress: 84 },
  { name: '浪潮信息', code: '000977.SZ', sector: '服务器', stage: '三表预测', analyst: '刘宇森', updated: '今天 10:32', rating: '跟踪', progress: 68 },
  { name: '紫光股份', code: '000938.SZ', sector: 'ICT基础设施', stage: '资料归集', analyst: '刘宇森', updated: '昨天 18:45', rating: '跟踪', progress: 42 },
  { name: '工业富联', code: '601138.SH', sector: 'AI服务器', stage: '同业对比', analyst: '刘宇森', updated: '08/28 16:20', rating: '观察', progress: 56 },
  { name: '海光信息', code: '688041.SH', sector: 'CPU/DCU', stage: '初步筛选', analyst: '刘宇森', updated: '08/27 11:05', rating: '观察', progress: 25 },
];

export function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
