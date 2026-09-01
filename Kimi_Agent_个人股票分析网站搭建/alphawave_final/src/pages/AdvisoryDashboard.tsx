import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Bot, Calculator, CheckCircle2, LineChart, Scale, Sigma, TableProperties, TrendingUp } from 'lucide-react';
import { useResearchModel } from '../context/ResearchModelContext';

const scenarioLabels = { bear: 'Bear', base: 'Base', bull: 'Bull' } as const;

function Metric({ label, value, detail, tone='text-t-textBright' }: { label:string; value:string; detail:string; tone?:string }) {
  return <div className="panel px-4 py-3"><div className="text-[10px] text-t-textDim">{label}</div><div className={`mt-2 font-mono text-lg font-semibold ${tone}`}>{value}</div><div className="mt-1 text-[10px] text-t-textDim">{detail}</div></div>;
}

export default function AdvisoryDashboard(){
  const { model, dcf, scenario, setScenario } = useResearchModel();
  const firstYear=model[0];
  const lastYear=model[model.length-1];
  const revenueCagr=(lastYear.revenue/149.7)**(1/5)-1;
  const modules=[
    {title:'Operating Model',cn:'经营驱动与三表',detail:'分业务收入、利润率、营运资金、CAPEX及三表勾稽。',to:'/capital/model',icon:TableProperties,status:'核心模型已上线'},
    {title:'Valuation Lab',cn:'多方法估值',detail:'DCF、Trading Comps、SOTP、Football Field与敏感性。',to:'/capital/valuation',icon:Scale,status:'与三表实时联动'},
    {title:'Equity Research',cn:'上市公司行研',detail:'盈利预测、投资逻辑、预期差、催化剂、风险与目标价。',to:'/capital/research',icon:BarChart3,status:'中科曙光案例'},
    {title:'Research Agent',cn:'财报提取与模型解释',detail:'本地解析财报、人工复核关键数据，并解释假设变化对估值的影响。',to:'/capital/assistant',icon:Bot,status:'可追溯人工复核'},
    {title:'Scenario & Versions',cn:'情景和假设变化',detail:'Bear / Base / Bull情景切换及核心假设变化对比。',to:'/capital/versions',icon:Sigma,status:'三情景可用'},
  ];
  return <div className="mx-auto max-w-[1500px] space-y-4">
    <section className="rounded-xl border border-t-border bg-[linear-gradient(115deg,rgba(6,182,212,0.11),rgba(59,130,246,0.04)_48%,rgba(139,92,246,0.07))] p-5"><div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between"><div><div className="flex flex-wrap items-center gap-2 text-[11px]"><span className="rounded-full bg-t-cyan/10 px-2.5 py-1 text-t-cyan">核心案例</span><span className="rounded-full bg-t-blue/10 px-2.5 py-1 text-t-blue">Equity Research + Valuation</span><span className="text-t-textDim">数据截至2025业绩快报</span></div><div className="mt-3 flex flex-wrap items-baseline gap-3"><h1 className="text-2xl font-semibold text-t-textBright">中科曙光</h1><span className="font-mono text-sm text-t-textDim">603019.SH</span></div><p className="mt-2 max-w-3xl text-sm leading-6 text-t-textDim">从经营驱动到三表、FCFF、估值和行研结论的一体化建模案例。目标是让模型结构、关键假设和目标价推导都能被面试官直接检查。</p></div><div className="flex flex-wrap gap-2"><Link to="/capital/model" className="inline-flex items-center gap-2 rounded-md bg-t-cyan px-3.5 py-2 text-xs font-medium text-slate-950"><Calculator className="h-4 w-4" />打开核心模型</Link><Link to="/capital/valuation" className="inline-flex items-center gap-2 rounded-md border border-t-border bg-t-panel px-3.5 py-2 text-xs text-t-text">查看估值 <ArrowRight className="h-4 w-4" /></Link></div></div></section>

    <section className="flex flex-col gap-3 rounded-lg border border-t-border bg-t-panel p-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-2"><span className="text-xs text-t-textDim">统一模型情景</span>{(['bear','base','bull'] as const).map(item=><button key={item} onClick={()=>setScenario(item)} className={`rounded-md px-3 py-1.5 text-xs ${scenario===item?'bg-t-cyan text-slate-950':'border border-t-border text-t-textDim'}`}>{scenarioLabels[item]}</button>)}</div><span className="text-[11px] text-t-textDim">同一开关同时改变经营预测、DCF、行研指标和目标价</span></section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Metric label="2026E Revenue" value={`¥${firstYear.revenue.toFixed(1)}亿`} detail={`${(firstYear.growth*100).toFixed(1)}% YoY`} /><Metric label="2026E EBITDA" value={`¥${firstYear.ebitda.toFixed(1)}亿`} detail={`${(firstYear.ebitda/firstYear.revenue*100).toFixed(1)}% margin`} tone="text-t-cyan" /><Metric label="2026E EPS" value={`¥${firstYear.eps.toFixed(2)}`} detail={`${scenarioLabels[scenario]} case`} /><Metric label="收入CAGR" value={`${(revenueCagr*100).toFixed(1)}%`} detail="2025A*–2030E" tone="text-t-green" /><Metric label="DCF目标价" value={`¥${dcf.pricePerShare.toFixed(2)}`} detail="FCFF永续增长法" tone="text-t-cyan" /><Metric label="三表检查" value={`${Math.abs(lastYear.balanceCheck).toFixed(2)}`} detail="资产−负债−权益" tone="text-t-green" /></section>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{modules.map(item=><Link key={item.title} to={item.to} className="panel group p-4 hover:border-t-cyan/35"><div className="flex items-center justify-between"><span className="rounded-lg bg-t-cyan/10 p-2 text-t-cyan"><item.icon className="h-5 w-5" /></span><ArrowRight className="h-4 w-4 text-t-textDim transition-transform group-hover:translate-x-1" /></div><div className="mt-4 text-[10px] uppercase tracking-[0.16em] text-t-textDim">{item.title}</div><h2 className="mt-1 text-sm font-medium text-t-textBright">{item.cn}</h2><p className="mt-2 min-h-12 text-xs leading-5 text-t-textDim">{item.detail}</p><div className="mt-4 flex items-center gap-2 text-[10px] text-t-green"><CheckCircle2 className="h-3.5 w-3.5" />{item.status}</div></Link>)}</section>

    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]"><div className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><LineChart className="h-4 w-4 text-t-cyan" />模型逻辑链</h2><p className="mt-1 text-[11px] text-t-textDim">每个下游结论均由上游假设驱动</p></div><div className="grid gap-2 p-4 sm:grid-cols-5">{[['01','分业务收入'],['02','利润率与费用'],['03','三表与FCFF'],['04','DCF / Comps'],['05','目标价与观点']].map(([step,label],index)=><div key={step} className="relative rounded-lg border border-t-border bg-white/[0.012] p-3"><div className="font-mono text-[10px] text-t-cyan">{step}</div><div className="mt-3 text-xs text-t-textBright">{label}</div>{index<4&&<ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-t-textDim sm:block" />}</div>)}</div></div><div className="panel p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><TrendingUp className="h-4 w-4 text-t-green" />Base Case核心判断</h2><div className="mt-4 space-y-3 text-xs leading-5">{['IT设备收入恢复增长，软件服务增速与毛利率决定利润弹性。','研发费用率保持高位，但规模效应推动EBITDA Margin逐步扩张。','净现金降低财务风险，DCF主要风险来自终值占比较高与增长假设。'].map((item,index)=><div key={item} className="flex gap-3"><span className="font-mono text-t-cyan">0{index+1}</span><span className="text-t-text">{item}</span></div>)}</div></div></section>

    <section className="rounded-lg border border-t-yellow/25 bg-t-yellow/5 px-4 py-3 text-[11px] leading-5 text-t-yellow">说明：2022A–2024A取自公司2024年年度报告，2025A*取自2025年度业绩快报；分部拆分及2026E–2030E均为AlphaWave模型估计，不构成投资建议。</section>
  </div>;
}
