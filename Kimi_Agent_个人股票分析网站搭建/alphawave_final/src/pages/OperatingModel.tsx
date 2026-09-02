import { useMemo, useState } from 'react';
import { Calculator, CheckCircle2, Database, Download, RotateCcw, Sigma, TableProperties } from 'lucide-react';
import { getHistoricalSummary, modelSources, type ModelYear, type OperatingAssumptions } from '../data/researchModel';
import { useResearchModel } from '../context/ResearchModelContext';
import { downloadCsv } from '../utils/download';

type Statement = 'income' | 'balance' | 'cashflow';
type Row = { label: string; key?: keyof ModelYear; values?: number[]; ratio?: boolean; emphasis?: boolean; subtract?: boolean; };

const pctFields: Array<{ key: keyof OperatingAssumptions; label: string; group: string; }> = [
  { key: 'itGrowth', label: 'IT设备收入增速', group: '收入驱动' },
  { key: 'servicesGrowth', label: '软件服务收入增速', group: '收入驱动' },
  { key: 'itGrossMargin', label: 'IT设备毛利率', group: '盈利假设' },
  { key: 'servicesGrossMargin', label: '软件服务毛利率', group: '盈利假设' },
  { key: 'rdPct', label: '研发费用率', group: '盈利假设' },
  { key: 'sgaPct', label: '销售及管理费用率', group: '盈利假设' },
  { key: 'capexPct', label: 'CAPEX / Revenue', group: '现金流' },
  { key: 'arPct', label: '应收账款 / Revenue', group: '营运资金' },
  { key: 'inventoryPct', label: '存货 / Revenue', group: '营运资金' },
  { key: 'apPct', label: '应付账款 / COGS', group: '营运资金' },
];

const scenarioLabels = { bear: 'Bear', base: 'Base', bull: 'Bull' } as const;
const formatNumber = (value: number) => `${value < 0 ? '(' : ''}${Math.abs(value).toFixed(1)}${value < 0 ? ')' : ''}`;

export default function OperatingModel() {
  const { assumptions, scenario, historicalAnchor, modelStart, modelVersions, model, updateAssumption, setScenario, resetModel } = useResearchModel();
  const [statement, setStatement] = useState<Statement>('income');
  const lastYear = model[model.length - 1];
  const revenueCagr = (lastYear.revenue / modelStart.revenue) ** (1 / 5) - 1;
  const historicalRows = getHistoricalSummary(historicalAnchor);
  const auditChecks = [
    { label: '资产负债平衡', value: Math.max(...model.map(item => Math.abs(item.balanceCheck))) },
    { label: '现金流衔接', value: Math.max(...model.map(item => Math.abs(item.cashFlowCheck))) },
    { label: '分部收入勾稽', value: Math.max(...model.map(item => Math.abs(item.revenueCheck))) },
    { label: 'FCFF公式复算', value: Math.max(...model.map(item => Math.abs(item.fcffCheck))) },
  ];
  const maxBalanceCheck = Math.max(...auditChecks.map(item => item.value));
  const balancePassed = auditChecks.every(item => item.value < 0.01);
  const rows = useMemo<Record<Statement, Row[]>>(() => ({
    income: [
      { label: 'IT设备收入', key: 'itRevenue' },
      { label: '软件开发、系统集成及技术服务', key: 'servicesRevenue' },
      { label: '营业收入', key: 'revenue', emphasis: true },
      { label: '同比增速', key: 'growth', ratio: true },
      { label: '营业成本', key: 'cogs', subtract: true },
      { label: '毛利润', key: 'grossProfit', emphasis: true },
      { label: '毛利率', key: 'grossMargin', ratio: true },
      { label: '研发费用', key: 'rd', subtract: true },
      { label: '销售及管理费用', key: 'sga', subtract: true },
      { label: 'EBITDA', key: 'ebitda', emphasis: true },
      { label: '折旧与摊销', key: 'depreciation', subtract: true },
      { label: 'EBIT', key: 'ebit', emphasis: true },
      { label: '利息及其他收益', key: 'interestIncome' },
      { label: '税前利润', key: 'pretaxIncome' },
      { label: '所得税', key: 'tax', subtract: true },
      { label: '净利润', key: 'netIncome', emphasis: true },
      { label: 'EPS（元）', key: 'eps', emphasis: true },
      { label: '分部收入检查', key: 'revenueCheck', emphasis: true },
    ],
    balance: [
      { label: '现金及现金等价物', key: 'cash' },
      { label: '应收账款', key: 'accountsReceivable' },
      { label: '存货', key: 'inventory' },
      { label: '固定资产净额', key: 'ppe' },
      { label: '其他资产', key: 'otherAssets' },
      { label: '总资产', key: 'totalAssets', emphasis: true },
      { label: '应付账款', key: 'accountsPayable' },
      { label: '有息负债', key: 'debt' },
      { label: '其他负债', key: 'otherLiabilities' },
      { label: '总负债', key: 'totalLiabilities', emphasis: true },
      { label: '股东权益', key: 'equity' },
      { label: '负债与权益合计', key: 'totalLiabilitiesAndEquity', emphasis: true },
      { label: '平衡检查', key: 'balanceCheck', emphasis: true },
    ],
    cashflow: [
      { label: '净利润', key: 'netIncome' },
      { label: '加：折旧与摊销', key: 'depreciation' },
      { label: '减：营运资金增加', key: 'changeNwc', subtract: true },
      { label: '经营活动现金流', key: 'cfo', emphasis: true },
      { label: '资本开支', key: 'capex', subtract: true },
      { label: '投资活动现金流', key: 'cfi' },
      { label: '股利支付', key: 'dividends', subtract: true },
      { label: '融资活动现金流', key: 'cff' },
      { label: '现金净变动', key: 'netChangeCash', emphasis: true },
      { label: 'FCFF', key: 'fcff', emphasis: true },
      { label: '现金流衔接检查', key: 'cashFlowCheck', emphasis: true },
      { label: 'FCFF复算检查', key: 'fcffCheck', emphasis: true },
    ],
  }), []);

  const exportModel = () => downloadCsv('中科曙光_经营驱动及三表模型.csv', [
    ['中科曙光 603019.SH', '单位：亿元，除EPS和比率外'],
    ['模型情景', scenarioLabels[scenario]],
    ['项目', ...model.map(item => item.year)],
    ...rows.income.map(row => [row.label, ...model.map(item => row.ratio ? `${((item[row.key!] as number) * 100).toFixed(1)}%` : (item[row.key!] as number).toFixed(2))]),
    [],
    ...rows.balance.map(row => [row.label, ...model.map(item => (item[row.key!] as number).toFixed(2))]),
    [],
    ...rows.cashflow.map(row => [row.label, ...model.map(item => (item[row.key!] as number).toFixed(2))]),
  ]);

  return <div className="mx-auto max-w-[1580px] space-y-4">
    <header className="flex flex-col gap-3 border-b border-t-border pb-4 xl:flex-row xl:items-end xl:justify-between">
      <div><div className="flex items-center gap-2 text-xs text-t-textDim"><Calculator className="h-4 w-4 text-t-cyan" />Operating Model · 中科曙光 603019.SH</div><h1 className="mt-2 text-2xl font-semibold text-t-textBright">经营驱动与三表预测模型</h1><p className="mt-2 text-sm text-t-textDim">2022A–2024A历史数据、2025A*业绩快报与2026E–2030E预测；所有估值和行研指标引用同一套模型结果。</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={resetModel} className="inline-flex items-center gap-2 rounded-md border border-t-border bg-t-panel px-3 py-2 text-xs text-t-text"><RotateCcw className="h-3.5 w-3.5" />重置模型</button><button onClick={exportModel} className="inline-flex items-center gap-2 rounded-md bg-t-cyan px-3 py-2 text-xs font-medium text-slate-950"><Download className="h-3.5 w-3.5" />导出三表模型</button></div>
    </header>

    <section className="flex flex-col gap-3 rounded-lg border border-t-border bg-t-panel p-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-2"><span className="text-xs text-t-textDim">模型情景</span>{(['bear', 'base', 'bull'] as const).map(item => <button key={item} onClick={() => setScenario(item)} className={`rounded-md px-3 py-1.5 text-xs ${scenario === item ? 'bg-t-cyan text-slate-950' : 'border border-t-border text-t-textDim hover:text-t-text'}`}>{scenarioLabels[item]}</button>)}</div><div className="flex flex-wrap items-center gap-3 text-[11px] text-t-textDim"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-t-textDim" />2022A–2024A 已披露</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-t-yellow" />2025A* 业绩快报</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-t-cyan" />2026E–2030E 模型预测</span></div></section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{[
      ['2026E收入', `¥${model[0].revenue.toFixed(1)}亿`, `${(model[0].growth * 100).toFixed(1)}% YoY`, 'text-t-textBright'],
      ['2026E EBITDA', `¥${model[0].ebitda.toFixed(1)}亿`, `${(model[0].ebitda / model[0].revenue * 100).toFixed(1)}% margin`, 'text-t-cyan'],
      ['2026E EPS', `¥${model[0].eps.toFixed(2)}`, `${(model[0].netIncome / modelStart.netIncome - 1) * 100 >= 0 ? '+' : ''}${((model[0].netIncome / modelStart.netIncome - 1) * 100).toFixed(1)}%`, 'text-t-textBright'],
      ['收入CAGR', `${(revenueCagr * 100).toFixed(1)}%`, '2025A*–2030E', 'text-t-green'],
      ['2030E FCFF', `¥${lastYear.fcff.toFixed(1)}亿`, 'DCF核心现金流', 'text-t-cyan'],
      ['四项勾稽', balancePassed ? 'PASS' : 'CHECK', `最大差额 ¥${maxBalanceCheck.toFixed(2)}亿`, balancePassed ? 'text-t-green' : 'text-t-yellow'],
    ].map(([label, value, detail, color]) => <div key={label} className="panel px-4 py-3"><div className="text-[10px] text-t-textDim">{label}</div><div className={`mt-2 font-mono text-lg font-semibold ${color}`}>{value}</div><div className="mt-1 text-[10px] text-t-textDim">{detail}</div></div>)}</section>

    <section className="grid gap-4 xl:grid-cols-[330px_1fr]">
      <aside className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><Sigma className="h-4 w-4 text-t-yellow" />关键驱动假设</h2><p className="mt-1 text-[11px] text-t-textDim">蓝色输入将联动三表、DCF与目标价</p></div><div className="divide-y divide-t-border px-4">{pctFields.map(field => <label key={field.key} className="grid grid-cols-[1fr_92px] items-center gap-3 py-2.5"><span><span className="block text-xs text-t-text">{field.label}</span><span className="mt-0.5 block text-[9px] text-t-textDim">{field.group}</span></span><div className="flex items-center rounded border border-t-blue/30 bg-t-blue/5"><input type="number" value={(assumptions[field.key] * 100).toFixed(1)} step="0.5" onChange={event => updateAssumption(field.key, Number(event.target.value) / 100)} className="w-full bg-transparent px-2 py-1.5 text-right font-mono text-xs text-t-textBright outline-none" /><span className="pr-2 text-[10px] text-t-textDim">%</span></div></label>)}</div></aside>

      <div className="space-y-4"><div className="panel overflow-hidden"><div className="flex flex-col gap-3 border-b border-t-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><TableProperties className="h-4 w-4 text-t-cyan" />三表联动</h2><p className="mt-1 text-[11px] text-t-textDim">单位：亿元；括号表示减项或流出</p></div><div className="flex rounded-md border border-t-border p-1">{([['income', '利润表'], ['balance', '资产负债表'], ['cashflow', '现金流量表']] as const).map(([key, label]) => <button key={key} onClick={() => setStatement(key)} className={`rounded px-3 py-1.5 text-[11px] ${statement === key ? 'bg-t-cyan/15 text-t-cyan' : 'text-t-textDim'}`}>{label}</button>)}</div></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-right text-xs"><thead className="bg-white/[0.02]"><tr><th className="sticky left-0 bg-t-panel px-4 py-3 text-left font-medium text-t-textDim">项目</th>{model.map(item => <th key={item.year} className="px-4 py-3 font-mono font-medium text-t-cyan">{item.year}</th>)}</tr></thead><tbody className="divide-y divide-t-border">{rows[statement].map(row => <tr key={row.label} className={row.emphasis ? 'bg-t-cyan/[0.025]' : ''}><td className={`sticky left-0 px-4 py-2.5 text-left ${row.emphasis ? 'bg-[#171b25] font-medium text-t-textBright' : 'bg-t-panel text-t-textDim'}`}>{row.label}</td>{model.map(item => { const value = item[row.key!] as number; return <td key={item.year} className={`px-4 py-2.5 font-mono ${row.emphasis ? 'font-medium text-t-textBright' : row.subtract ? 'text-t-yellow' : 'text-t-text'}`}>{row.ratio ? `${(value * 100).toFixed(1)}%` : row.subtract ? `(${Math.abs(value).toFixed(1)})` : formatNumber(value)}</td> ;})}</tr>)}</tbody></table></div></div>

        <div className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><h2 className="text-sm font-semibold text-t-textBright">分业务收入驱动</h2><p className="mt-1 text-[11px] text-t-textDim">2025A*分部由已复核历史数据桥接；预测增速逐年收敛</p></div><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-right text-xs"><thead className="bg-white/[0.02] text-t-textDim"><tr><th className="px-4 py-3 text-left font-medium">业务</th><th className="px-4 py-3">2025A*</th>{model.map(item => <th key={item.year} className="px-4 py-3 font-mono font-medium text-t-cyan">{item.year}</th>)}</tr></thead><tbody className="divide-y divide-t-border"><tr><td className="px-4 py-3 text-left text-t-textBright">IT设备</td><td className="px-4 py-3 font-mono text-t-textDim">{modelStart.itRevenue.toFixed(1)}</td>{model.map(item => <td key={item.year} className="px-4 py-3 font-mono text-t-text">{item.itRevenue.toFixed(1)}</td>)}</tr><tr><td className="px-4 py-3 text-left text-t-textBright">软件开发、系统集成及技术服务</td><td className="px-4 py-3 font-mono text-t-textDim">{modelStart.servicesRevenue.toFixed(1)}</td>{model.map(item => <td key={item.year} className="px-4 py-3 font-mono text-t-text">{item.servicesRevenue.toFixed(1)}</td>)}</tr></tbody></table></div></div></div>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1fr_380px]"><div className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-t-textBright">历史财务锚点</h2><span className={`rounded px-2 py-1 text-[10px] ${balancePassed ? 'bg-t-green/10 text-t-green' : 'bg-t-yellow/10 text-t-yellow'}`}>四项勾稽 {balancePassed ? 'PASS' : 'CHECK'}</span></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-xs"><thead className="bg-white/[0.02] text-t-textDim"><tr>{['期间', '营业收入', '净利润', '经营现金流', '总资产', '股东权益', '口径'].map((item, index) => <th key={item} className={`px-4 py-3 font-medium ${index === 0 || index === 6 ? 'text-left' : ''}`}>{item}</th>)}</tr></thead><tbody className="divide-y divide-t-border">{historicalRows.map(item => <tr key={item.year}><td className={`px-4 py-3 text-left font-mono ${item.year.includes('*') ? 'text-t-yellow' : 'text-t-textBright'}`}>{item.year}</td><td className="px-4 py-3 font-mono text-t-text">{item.revenue.toFixed(2)}</td><td className="px-4 py-3 font-mono text-t-text">{item.netIncome.toFixed(2)}</td><td className="px-4 py-3 font-mono text-t-text">{item.cfo.toFixed(2)}</td><td className="px-4 py-3 font-mono text-t-text">{item.totalAssets.toFixed(2)}</td><td className="px-4 py-3 font-mono text-t-text">{item.equity.toFixed(2)}</td><td className="px-4 py-3 text-left text-[10px] text-t-textDim">{item.source}</td></tr>)}</tbody></table></div></div><aside className="panel p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><Database className="h-4 w-4 text-t-blue" />模型审计与来源</h2><div className="mt-4 grid grid-cols-2 gap-2">{auditChecks.map(item => <div key={item.label} className="rounded border border-t-border p-2.5"><div className="text-[10px] text-t-textDim">{item.label}</div><div className={`mt-1 font-mono text-xs ${item.value < 0.01 ? 'text-t-green' : 'text-t-yellow'}`}>{item.value < 0.01 ? 'PASS' : item.value.toFixed(3)}</div></div>)}</div><div className="mt-3 text-[10px] text-t-textDim">历史基准：{historicalAnchor.reviewedAt} · 写入版本 {modelVersions.length}</div><div className="mt-4 space-y-3">{modelSources.map(source => <div key={source.label} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-t-green" /><div><div className="text-xs text-t-text">{'url' in source && source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="hover:text-t-cyan">{source.label} ↗</a> : source.label}</div><div className="mt-1 text-[10px] leading-4 text-t-textDim">{source.detail}</div></div></div>)}</div><div className="mt-4 rounded-md border border-t-yellow/25 bg-t-yellow/5 p-3 text-[10px] leading-5 text-t-yellow">2025A*来自业绩快报，尚未经审计；模型用于展示研究与估值方法，不构成投资建议。</div></aside></section>
  </div>;
}
