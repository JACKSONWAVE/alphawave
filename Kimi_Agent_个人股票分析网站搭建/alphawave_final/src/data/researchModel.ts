export type ModelScenario = 'bear' | 'base' | 'bull';

export type OperatingAssumptions = {
  itGrowth: number;
  servicesGrowth: number;
  itGrossMargin: number;
  servicesGrossMargin: number;
  rdPct: number;
  sgaPct: number;
  daPct: number;
  capexPct: number;
  arPct: number;
  inventoryPct: number;
  apPct: number;
  taxRate: number;
  wacc: number;
  terminalGrowth: number;
  shares: number;
  netDebt: number;
};

export type ModelYear = {
  year: string;
  forecast: true;
  itRevenue: number;
  servicesRevenue: number;
  revenue: number;
  growth: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  rd: number;
  sga: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  interestIncome: number;
  pretaxIncome: number;
  tax: number;
  netIncome: number;
  eps: number;
  cash: number;
  accountsReceivable: number;
  inventory: number;
  ppe: number;
  otherAssets: number;
  totalAssets: number;
  accountsPayable: number;
  debt: number;
  otherLiabilities: number;
  totalLiabilities: number;
  equity: number;
  totalLiabilitiesAndEquity: number;
  balanceCheck: number;
  nwc: number;
  changeNwc: number;
  cfo: number;
  capex: number;
  cfi: number;
  dividends: number;
  cff: number;
  netChangeCash: number;
  fcff: number;
};

export const historicalSummary = [
  { year: '2022A', revenue: 130.08, netIncome: 15.44, cfo: 11.25, totalAssets: 318.11, equity: 170.17, source: '2024年报重述口径' },
  { year: '2023A', revenue: 143.53, netIncome: 18.36, cfo: 35.10, totalAssets: 316.15, equity: 186.50, source: '2024年报重述口径' },
  { year: '2024A', revenue: 131.48, netIncome: 19.11, cfo: 27.22, totalAssets: 366.17, equity: 204.02, source: '2024年年度报告' },
  { year: '2025A*', revenue: 149.70, netIncome: 21.13, cfo: 30.40, totalAssets: 411.83, equity: 221.61, source: '2025业绩快报；OCF为模型估计' },
];

export const defaultOperatingAssumptions: OperatingAssumptions = {
  itGrowth: 0.16,
  servicesGrowth: 0.20,
  itGrossMargin: 0.285,
  servicesGrossMargin: 0.41,
  rdPct: 0.093,
  sgaPct: 0.083,
  daPct: 0.032,
  capexPct: 0.055,
  arPct: 0.40,
  inventoryPct: 0.33,
  apPct: 0.53,
  taxRate: 0.18,
  wacc: 0.087,
  terminalGrowth: 0.025,
  shares: 14.63,
  netDebt: -45.0,
};

export const waccInputs = {
  riskFreeRate: 0.023,
  beta: 1.14,
  equityRiskPremium: 0.062,
  preTaxCostDebt: 0.034,
  debtWeight: 0.10,
};

export function calculateWaccBuild(taxRate: number) {
  const costEquity = waccInputs.riskFreeRate + waccInputs.beta * waccInputs.equityRiskPremium;
  const equityWeight = 1 - waccInputs.debtWeight;
  const afterTaxCostDebt = waccInputs.preTaxCostDebt * (1 - taxRate);
  const calculatedWacc = costEquity * equityWeight + afterTaxCostDebt * waccInputs.debtWeight;
  return { ...waccInputs, costEquity, equityWeight, afterTaxCostDebt, calculatedWacc };
}

export const scenarioPresets: Record<ModelScenario, OperatingAssumptions> = {
  bear: { ...defaultOperatingAssumptions, itGrowth: 0.09, servicesGrowth: 0.12, itGrossMargin: 0.265, servicesGrossMargin: 0.38, rdPct: 0.098, wacc: 0.097, terminalGrowth: 0.02 },
  base: defaultOperatingAssumptions,
  bull: { ...defaultOperatingAssumptions, itGrowth: 0.23, servicesGrowth: 0.28, itGrossMargin: 0.302, servicesGrossMargin: 0.44, rdPct: 0.09, wacc: 0.082, terminalGrowth: 0.03 },
};

const openingBalance = {
  cash: 80,
  accountsReceivable: 60,
  inventory: 50,
  ppe: 55,
  otherAssets: 166.83,
  accountsPayable: 55,
  debt: 35,
  otherLiabilities: 100.22,
  equity: 221.61,
};

export function buildResearchModel(assumptions: OperatingAssumptions): ModelYear[] {
  const model: ModelYear[] = [];
  let itRevenue = 133.6;
  let servicesRevenue = 16.1;
  let previousRevenue = 149.7;
  let previousNwc = openingBalance.accountsReceivable + openingBalance.inventory - openingBalance.accountsPayable;
  let cash = openingBalance.cash;
  let ppe = openingBalance.ppe;
  let equity = openingBalance.equity;

  for (let index = 0; index < 5; index += 1) {
    const itGrowth = Math.max(0.06, assumptions.itGrowth - index * 0.012);
    const servicesGrowth = Math.max(0.08, assumptions.servicesGrowth - index * 0.014);
    itRevenue *= 1 + itGrowth;
    servicesRevenue *= 1 + servicesGrowth;
    const revenue = itRevenue + servicesRevenue;
    const growth = revenue / previousRevenue - 1;
    const itGrossProfit = itRevenue * (assumptions.itGrossMargin + index * 0.002);
    const servicesGrossProfit = servicesRevenue * (assumptions.servicesGrossMargin + index * 0.003);
    const grossProfit = itGrossProfit + servicesGrossProfit;
    const cogs = revenue - grossProfit;
    const rd = revenue * Math.max(0.082, assumptions.rdPct - index * 0.0015);
    const sga = revenue * Math.max(0.074, assumptions.sgaPct - index * 0.001);
    const depreciation = revenue * assumptions.daPct;
    const ebit = grossProfit - rd - sga;
    const ebitda = ebit + depreciation;
    const interestIncome = Math.max(0, cash - openingBalance.debt) * 0.015 + revenue * 0.02;
    const pretaxIncome = ebit + interestIncome;
    const tax = pretaxIncome * assumptions.taxRate;
    const netIncome = pretaxIncome - tax;
    const accountsReceivable = revenue * assumptions.arPct;
    const inventory = revenue * assumptions.inventoryPct;
    const accountsPayable = cogs * assumptions.apPct;
    const nwc = accountsReceivable + inventory - accountsPayable;
    const changeNwc = nwc - previousNwc;
    const capex = revenue * assumptions.capexPct;
    const cfo = netIncome + depreciation - changeNwc;
    const dividends = netIncome * 0.2;
    const cfi = -capex;
    const cff = -dividends;
    const netChangeCash = cfo + cfi + cff;
    cash += netChangeCash;
    ppe += capex - depreciation;
    equity += netIncome - dividends;
    const totalAssets = cash + accountsReceivable + inventory + ppe + openingBalance.otherAssets;
    const totalLiabilities = accountsPayable + openingBalance.debt + openingBalance.otherLiabilities;
    const totalLiabilitiesAndEquity = totalLiabilities + equity;
    const fcff = ebit * (1 - assumptions.taxRate) + depreciation - capex - changeNwc;

    model.push({
      year: `${2026 + index}E`, forecast: true, itRevenue, servicesRevenue, revenue, growth, cogs,
      grossProfit, grossMargin: grossProfit / revenue, rd, sga, ebitda, depreciation, ebit,
      interestIncome, pretaxIncome, tax, netIncome, eps: netIncome / assumptions.shares,
      cash, accountsReceivable, inventory, ppe, otherAssets: openingBalance.otherAssets, totalAssets,
      accountsPayable, debt: openingBalance.debt, otherLiabilities: openingBalance.otherLiabilities,
      totalLiabilities, equity, totalLiabilitiesAndEquity,
      balanceCheck: totalAssets - totalLiabilitiesAndEquity, nwc, changeNwc, cfo, capex, cfi,
      dividends, cff, netChangeCash, fcff,
    });

    previousRevenue = revenue;
    previousNwc = nwc;
  }

  return model;
}

export function calculateResearchDcf(assumptions: OperatingAssumptions) {
  const forecast = buildResearchModel(assumptions);
  const discountedFcff = forecast.map((item, index) => item.fcff / ((1 + assumptions.wacc) ** (index + 1)));
  const terminalFcff = forecast[forecast.length - 1].fcff * (1 + assumptions.terminalGrowth);
  const terminalValue = terminalFcff / (assumptions.wacc - assumptions.terminalGrowth);
  const discountedTerminalValue = terminalValue / ((1 + assumptions.wacc) ** forecast.length);
  const enterpriseValue = discountedFcff.reduce((sum, value) => sum + value, 0) + discountedTerminalValue;
  const equityValue = enterpriseValue - assumptions.netDebt;
  return {
    forecast,
    discountedFcff,
    terminalValue,
    discountedTerminalValue,
    enterpriseValue,
    equityValue,
    pricePerShare: equityValue / assumptions.shares,
    terminalValuePct: discountedTerminalValue / enterpriseValue,
  };
}

export const modelSources = [
  { label: '2024年年度报告', detail: '2022A–2024A收入、净利润、经营现金流及2024产品分部', url: 'https://big5.sse.com.cn/site/cht/www.sse.com.cn/disclosure/listedinfo/announcement/c/new/2025-03-05/603019_20250305_LPGP.pdf' },
  { label: '2025年度业绩快报', detail: '2025A*收入、净利润、总资产和股东权益；未经审计', url: 'https://big5.sse.com.cn/site/cht/www.sse.com.cn/disclosure/listedinfo/announcement/c/new/2026-02-25/603019_20260225_3DJH.pdf' },
  { label: 'AlphaWave预测假设', detail: '2025产品拆分及2026E–2030E均为模型估计' },
];
