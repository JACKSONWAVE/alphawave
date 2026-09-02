import { useMemo, useState } from 'react';
import { Calculator, ChevronDown, Download, RotateCcw, Scale, SlidersHorizontal } from 'lucide-react';
import { comparableCompanies, median } from '../data/advisoryModel';
import { calculateResearchDcf as calculateResearchDcfBase, calculateWaccBuild, type OperatingAssumptions } from '../data/researchModel';
import { useResearchModel } from '../context/ResearchModelContext';
import { downloadCsv } from '../utils/download';

const scenarioLabels = { bear: 'Bear', base: 'Base', bull: 'Bull' } as const;

export default function ValuationCenter() {
  const { assumptions, scenario, historicalAnchor, model, dcf, updateAssumption, setScenario, resetModel } = useResearchModel();
  const calculateResearchDcf = (nextAssumptions: OperatingAssumptions) => calculateResearchDcfBase(nextAssumptions, historicalAnchor);
  const [showFormula, setShowFormula] = useState(false);
  const [selectedSensitivity, setSelectedSensitivity] = useState<{wacc:number;growth:number}|null>(null);
  const selectedComps = comparableCompanies.filter(item => item.selected && item.code !== '603019.SH');
  const medianEvEbitda = median(selectedComps.map(item => item.evEbitda));
  const medianPe = median(selectedComps.map(item => item.pe));
  const firstYear = model[0];
  const compEv = firstYear.ebitda * medianEvEbitda;
  const compEquity = compEv - assumptions.netDebt;
  const compPrice = compEquity / assumptions.shares;
  const pePrice = firstYear.eps * medianPe;
  const sotpEv = firstYear.itRevenue * 2.0 + firstYear.servicesRevenue * 3.8;
  const sotpPrice = (sotpEv - assumptions.netDebt) / assumptions.shares;
  const methods = useMemo(() => [
    { label:'DCF · 永续增长', center:dcf.pricePerShare, low:dcf.pricePerShare*0.9, high:dcf.pricePerShare*1.1, color:'bg-t-cyan' },
    { label:'Trading Comps · EV/EBITDA', center:compPrice, low:compPrice*0.88, high:compPrice*1.12, color:'bg-t-blue' },
    { label:'Trading Comps · P/E', center:pePrice, low:pePrice*0.9, high:pePrice*1.1, color:'bg-violet-400' },
    { label:'SOTP · 分部估值', center:sotpPrice, low:sotpPrice*0.9, high:sotpPrice*1.1, color:'bg-t-yellow' },
  ], [dcf.pricePerShare, compPrice, pePrice, sotpPrice]);
  const valuationMidpoint = median(methods.map(item=>item.center));
  const allLow = Math.min(...methods.map(item=>item.low));
  const allHigh = Math.max(...methods.map(item=>item.high));
  const waccSteps = [-0.01,-0.005,0,0.005,0.01];
  const growthSteps = [0.015,0.02,0.025,0.03,0.035];
  const waccBuild = calculateWaccBuild(assumptions.taxRate);
  const sensitivityAssumptions = selectedSensitivity ?? { wacc: assumptions.wacc, growth: assumptions.terminalGrowth };
  const sensitivityDcf = calculateResearchDcf({ ...assumptions, wacc: sensitivityAssumptions.wacc, terminalGrowth: sensitivityAssumptions.growth });
  const footballMin = allLow * 0.95;
  const footballMax = allHigh * 1.05;
  const footballSpan = Math.max(1, footballMax - footballMin);

  const exportModel = () => downloadCsv('中科曙光_估值模型.csv', [
    ['中科曙光 603019.SH','估值模型','单位：亿元/元'],
    ['情景',scenarioLabels[scenario]],
    ['方法','估值中枢','低位','高位'],
    ...methods.map(item=>[item.label,item.center.toFixed(2),item.low.toFixed(2),item.high.toFixed(2)]),
    [],['DCF企业价值',dcf.enterpriseValue.toFixed(2)],['DCF股权价值',dcf.equityValue.toFixed(2)],['DCF每股价值',dcf.pricePerShare.toFixed(2)],['WACC',`${(assumptions.wacc*100).toFixed(1)}%`],['永续增长率',`${(assumptions.terminalGrowth*100).toFixed(1)}%`],
    [],['年份',...model.map(item=>item.year)],['FCFF',...model.map(item=>item.fcff.toFixed(2))],['折现FCFF',...dcf.discountedFcff.map(item=>item.toFixed(2))],
    [],['WACC计算'],['无风险利率',`${(waccBuild.riskFreeRate*100).toFixed(2)}%`],['Beta',waccBuild.beta.toFixed(2)],['市场风险溢价',`${(waccBuild.equityRiskPremium*100).toFixed(2)}%`],['股权成本',`${(waccBuild.costEquity*100).toFixed(2)}%`],['税后债务成本',`${(waccBuild.afterTaxCostDebt*100).toFixed(2)}%`],['计算WACC',`${(waccBuild.calculatedWacc*100).toFixed(2)}%`],
    [],['敏感性分析：WACC / g',...growthSteps.map(g=>`${(g*100).toFixed(1)}%`)],
    ...waccSteps.map(offset=>{const wacc=assumptions.wacc+offset;return [`${(wacc*100).toFixed(1)}%`,...growthSteps.map(g=>calculateResearchDcf({...assumptions,wacc,terminalGrowth:g}).pricePerShare.toFixed(2))]}),
  ]);

  return <div className="mx-auto max-w-[1540px] space-y-4">
    <header className="flex flex-col gap-3 border-b border-t-border pb-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex items-center gap-2 text-xs text-t-textDim"><Scale className="h-4 w-4 text-t-cyan" />Valuation Lab · 中科曙光 603019.SH</div><h1 className="mt-2 text-2xl font-semibold text-t-textBright">多方法估值与目标价推导</h1><p className="mt-2 text-sm text-t-textDim">DCF、上市可比公司与SOTP全部引用经营驱动和三表模型；修改任一核心假设后估值结果同步更新。</p></div><div className="flex flex-wrap gap-2"><button onClick={resetModel} className="inline-flex items-center gap-2 rounded-md border border-t-border bg-t-panel px-3 py-2 text-xs text-t-text"><RotateCcw className="h-3.5 w-3.5" />重置模型</button><button onClick={exportModel} className="inline-flex items-center gap-2 rounded-md bg-t-cyan px-3 py-2 text-xs font-medium text-slate-950"><Download className="h-3.5 w-3.5" />导出估值模型</button></div></header>

    <section className="flex flex-col gap-3 rounded-lg border border-t-border bg-t-panel p-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-2"><span className="text-xs text-t-textDim">估值情景</span>{(['bear','base','bull'] as const).map(item=><button key={item} onClick={()=>{setScenario(item);setSelectedSensitivity(null)}} className={`rounded-md px-3 py-1.5 text-xs ${scenario===item?'bg-t-cyan text-slate-950':'border border-t-border text-t-textDim'}`}>{scenarioLabels[item]}</button>)}</div><span className="text-[11px] text-t-textDim">当前经营模型：2026E收入 ¥{firstYear.revenue.toFixed(1)}亿 · EBITDA ¥{firstYear.ebitda.toFixed(1)}亿 · EPS ¥{firstYear.eps.toFixed(2)}</span></section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{[
      ['DCF目标价',`¥${dcf.pricePerShare.toFixed(2)}`,'FCFF永续增长法','text-t-cyan'],
      ['估值中枢',`¥${valuationMidpoint.toFixed(2)}`,'四种方法中位数','text-t-textBright'],
      ['综合区间',`¥${allLow.toFixed(1)}–${allHigh.toFixed(1)}`,'多方法低位/高位','text-t-textBright'],
      ['企业价值',`¥${dcf.enterpriseValue.toFixed(1)}亿`,'PV of FCFF + TV','text-t-textBright'],
      ['终值占比',`${(dcf.terminalValuePct*100).toFixed(1)}%`,'模型风险指标','text-t-yellow'],
      ['可比EV/EBITDA',`${medianEvEbitda.toFixed(1)}x`,`P/E ${medianPe.toFixed(1)}x`,'text-violet-300'],
    ].map(([label,value,detail,color])=><div key={label} className="panel px-4 py-3"><div className="text-[10px] text-t-textDim">{label}</div><div className={`mt-2 font-mono text-lg font-semibold ${color}`}>{value}</div><div className="mt-1 text-[10px] text-t-textDim">{detail}</div></div>)}</section>

    <section className="grid gap-4 xl:grid-cols-[340px_1fr]">
      <aside className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><SlidersHorizontal className="h-4 w-4 text-t-yellow" />估值假设</h2><p className="mt-1 text-[11px] text-t-textDim">联动经营模型与敏感性矩阵</p></div><div className="divide-y divide-t-border px-4">{[
        ['wacc','WACC','%'],['terminalGrowth','永续增长率','%'],['netDebt','净债务（负数为净现金）','亿'],['shares','摊薄后股本','亿股'],
      ].map(([key,label,suffix])=>{const typedKey=key as 'wacc'|'terminalGrowth'|'netDebt'|'shares';const isPct=key==='wacc'||key==='terminalGrowth';return <label key={key} className="grid grid-cols-[1fr_110px] items-center gap-3 py-3"><span className="text-xs text-t-textDim">{label}</span><div className="flex items-center rounded border border-t-blue/30 bg-t-blue/5"><input type="number" value={(isPct?assumptions[typedKey]*100:assumptions[typedKey]).toFixed(isPct?1:2)} step={isPct?'0.1':'0.1'} onChange={event=>{updateAssumption(typedKey,Number(event.target.value)/(isPct?100:1));setSelectedSensitivity(null)}} className="w-full bg-transparent px-2 py-1.5 text-right font-mono text-xs text-t-textBright outline-none" /><span className="pr-2 text-[10px] text-t-textDim">{suffix}</span></div></label>})}</div><div className="border-t border-t-border bg-t-yellow/5 px-4 py-3 text-[10px] leading-5 text-t-yellow">WACC必须高于永续增长率，当前差值为 {((assumptions.wacc-assumptions.terminalGrowth)*100).toFixed(1)}pct。</div></aside>

      <div className="space-y-4"><div className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><h2 className="text-sm font-semibold text-t-textBright">Valuation Football Field</h2><p className="mt-1 text-[11px] text-t-textDim">单位：人民币/股；各方法按同一价格坐标展示</p></div><div className="space-y-5 p-5">{methods.map(method=>{const left=(method.low-footballMin)/footballSpan*100;const width=(method.high-method.low)/footballSpan*100;const center=(method.center-footballMin)/footballSpan*100;return <div key={method.label} className="grid grid-cols-[180px_1fr_72px] items-center gap-4 text-xs"><div><div className="text-t-text">{method.label}</div><div className="mt-1 font-mono text-[10px] text-t-textDim">¥{method.low.toFixed(2)}–{method.high.toFixed(2)}</div></div><div className="relative h-2 rounded bg-white/[0.05]"><div className={`absolute h-2 rounded ${method.color}`} style={{left:`${left}%`,width:`${width}%`}}/><div className="absolute -top-1 h-4 w-px bg-t-textBright" style={{left:`${center}%`}}/></div><div className="text-right font-mono text-t-textBright">¥{method.center.toFixed(2)}</div></div>})}</div></div>

        <div className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-t-border px-4 py-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><Calculator className="h-4 w-4 text-t-cyan" />DCF现金流折现</h2><p className="mt-1 text-[11px] text-t-textDim">单位：亿元</p></div><button onClick={()=>setShowFormula(value=>!value)} className="flex items-center gap-1 text-[11px] text-t-textDim">{showFormula?'收起公式':'查看公式'}<ChevronDown className={`h-3.5 w-3.5 ${showFormula?'rotate-180':''}`}/></button></div>{showFormula&&<div className="border-b border-t-border bg-t-cyan/[0.035] px-4 py-3 font-mono text-[10px] leading-5 text-t-textDim">FCFF = EBIT × (1 − Tax) + D&amp;A − CAPEX − ΔNWC；EV = ΣPV(FCFF) + PV(Terminal Value)；Equity Value = EV − Net Debt。</div>}<div className="overflow-x-auto"><table className="w-full min-w-[720px] text-right text-xs"><thead className="bg-white/[0.02] text-t-textDim"><tr><th className="px-4 py-3 text-left font-medium">项目</th>{model.map(item=><th key={item.year} className="px-4 py-3 font-mono font-medium text-t-cyan">{item.year}</th>)}</tr></thead><tbody className="divide-y divide-t-border">{[['EBIT',model.map(item=>item.ebit)],['FCFF',model.map(item=>item.fcff)],['折现FCFF',dcf.discountedFcff]].map(([label,values])=><tr key={label as string}><td className="px-4 py-3 text-left text-t-text">{label as string}</td>{(values as number[]).map((value,index)=><td key={index} className="px-4 py-3 font-mono text-t-text">{value.toFixed(1)}</td>)}</tr>)}</tbody></table></div></div></div>
    </section>

    <section className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><h2 className="text-sm font-semibold text-t-textBright">WACC计算过程</h2><p className="mt-1 text-[11px] text-t-textDim">基准资本结构用于解释折现率来源；情景调整单独反映风险变化</p></div><div className="grid gap-px bg-t-border sm:grid-cols-2 xl:grid-cols-6">{[
      ['无风险利率',`${(waccBuild.riskFreeRate*100).toFixed(1)}%`,'长期利率锚'],
      ['Beta',waccBuild.beta.toFixed(2),'权益系统性风险'],
      ['市场风险溢价',`${(waccBuild.equityRiskPremium*100).toFixed(1)}%`,'权益风险补偿'],
      ['股权成本',`${(waccBuild.costEquity*100).toFixed(1)}%`,'Rf + β × ERP'],
      ['税后债务成本',`${(waccBuild.afterTaxCostDebt*100).toFixed(1)}%`,'Kd × (1 − Tax)'],
      ['计算WACC',`${(waccBuild.calculatedWacc*100).toFixed(1)}%`,`当前情景采用 ${(assumptions.wacc*100).toFixed(1)}%`],
    ].map(([label,value,detail])=><div key={label} className="bg-t-panel p-4"><div className="text-[10px] text-t-textDim">{label}</div><div className="mt-2 font-mono text-lg text-t-textBright">{value}</div><div className="mt-1 text-[10px] text-t-textDim">{detail}</div></div>)}</div><div className="border-t border-t-border bg-t-cyan/[0.025] px-4 py-3 text-[10px] leading-5 text-t-textDim">资本结构：权益权重 {(waccBuild.equityWeight*100).toFixed(0)}%，债务权重 {(waccBuild.debtWeight*100).toFixed(0)}%。Base Case采用计算结果四舍五入值；Bear / Bull通过风险溢价调整WACC。</div></section>

    <section className="grid gap-4 xl:grid-cols-[1fr_420px]"><div className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><h2 className="text-sm font-semibold text-t-textBright">DCF双因素敏感性分析</h2><p className="mt-1 text-[11px] text-t-textDim">行：WACC；列：永续增长率；点击任一组合查看对应估值</p></div><div className="overflow-x-auto p-4"><table className="w-full min-w-[620px] border-separate border-spacing-1 text-center text-xs"><thead><tr><th className="px-3 py-2 text-t-textDim">WACC \ g</th>{growthSteps.map(g=><th key={g} className="px-3 py-2 font-mono text-t-textDim">{(g*100).toFixed(1)}%</th>)}</tr></thead><tbody>{waccSteps.map(offset=>{const wacc=assumptions.wacc+offset;return <tr key={offset}><th className="px-3 py-2 font-mono text-t-textDim">{(wacc*100).toFixed(1)}%</th>{growthSteps.map(g=>{const price=calculateResearchDcf({...assumptions,wacc,terminalGrowth:g}).pricePerShare;const active=Math.abs(wacc-sensitivityAssumptions.wacc)<0.0001&&Math.abs(g-sensitivityAssumptions.growth)<0.0001;return <td key={g}><button onClick={()=>setSelectedSensitivity({wacc,growth:g})} className={`w-full rounded px-3 py-2 font-mono transition-colors ${price>dcf.pricePerShare*1.1?'bg-t-green/15 text-t-green hover:bg-t-green/25':price<dcf.pricePerShare*0.9?'bg-t-yellow/10 text-t-yellow hover:bg-t-yellow/20':'bg-t-cyan/15 text-t-cyan hover:bg-t-cyan/25'} ${active?'ring-1 ring-t-textBright':''}`}>¥{price.toFixed(2)}</button></td>})}</tr>})}</tbody></table></div></div><aside className="space-y-4"><div className="panel p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-t-textBright">已选敏感性组合</h2>{selectedSensitivity&&<button onClick={()=>setSelectedSensitivity(null)} className="text-[10px] text-t-cyan">返回基准</button>}</div><div className="mt-4 grid grid-cols-3 gap-2">{[['WACC',`${(sensitivityAssumptions.wacc*100).toFixed(1)}%`],['永续增长',`${(sensitivityAssumptions.growth*100).toFixed(1)}%`],['每股价值',`¥${sensitivityDcf.pricePerShare.toFixed(2)}`]].map(([label,value])=><div key={label} className="rounded border border-t-border p-2.5 text-center"><div className="text-[9px] text-t-textDim">{label}</div><div className="mt-1.5 font-mono text-xs text-t-textBright">{value}</div></div>)}</div><p className="mt-3 text-[10px] leading-5 text-t-textDim">相对基准目标价 {sensitivityDcf.pricePerShare>=dcf.pricePerShare?'+':''}{((sensitivityDcf.pricePerShare/dcf.pricePerShare-1)*100).toFixed(1)}%。折现率越高，估值越低；永续增长率越高，终值越高。</p></div><div className="panel p-4"><h2 className="text-sm font-semibold text-t-textBright">EV → Equity Value Bridge</h2><div className="mt-4 space-y-3">{[['预测期FCFF现值',dcf.discountedFcff.reduce((sum,value)=>sum+value,0)],['终值现值',dcf.discountedTerminalValue],['企业价值',dcf.enterpriseValue],['减：净债务',assumptions.netDebt],['股权价值',dcf.equityValue]].map(([label,value],index)=><div key={label as string} className={`flex items-center justify-between rounded border px-3 py-2.5 text-xs ${index===4?'border-t-cyan/40 bg-t-cyan/5':'border-t-border'}`}><span className="text-t-textDim">{label as string}</span><span className="font-mono text-t-textBright">¥{(value as number).toFixed(1)}亿</span></div>)}</div></div></aside></section>
  </div>;
}
