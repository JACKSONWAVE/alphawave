import { useMemo, useState, type ChangeEvent } from 'react';
import { AlertTriangle, Bot, CheckCircle2, ExternalLink, FileSearch, FileText, RefreshCw, Search, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import { calculateResearchDcf, historicalSummary, modelSources, scenarioPresets, type OperatingAssumptions } from '../data/researchModel';
import { useResearchModel } from '../context/ResearchModelContext';

type MetricKey = 'revenue' | 'netIncome' | 'cfo' | 'totalAssets' | 'equity' | 'itRevenue' | 'servicesRevenue';
type ExtractedMetric = {
  key: MetricKey;
  label: string;
  value: number;
  page: string;
  confidence: number;
  sourceText: string;
  accepted: boolean;
};

const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
const reportUrl = 'https://big5.sse.com.cn/site/cht/www.sse.com.cn/disclosure/listedinfo/announcement/c/new/2025-03-05/603019_20250305_LPGP.pdf';

const metricDefinitions: Array<{key:MetricKey;label:string;aliases:string[]}> = [
  { key:'revenue', label:'营业收入', aliases:['营业收入','营业总收入'] },
  { key:'netIncome', label:'归母净利润', aliases:['归属于上市公司股东的净利润','归属于母公司股东的净利润'] },
  { key:'cfo', label:'经营活动现金流', aliases:['经营活动产生的现金流量净额'] },
  { key:'totalAssets', label:'总资产', aliases:['资产总额','总资产'] },
  { key:'equity', label:'归母股东权益', aliases:['归属于上市公司股东的净资产','归属于母公司股东权益合计'] },
  { key:'itRevenue', label:'IT设备收入', aliases:['IT设备','高端计算机'] },
  { key:'servicesRevenue', label:'软件及技术服务收入', aliases:['软件开发、系统集成及技术服务','软件与服务'] },
];

const sampleMetrics: ExtractedMetric[] = [
  { key:'revenue', label:'营业收入', value:131.48, page:'主要会计数据', confidence:99, sourceText:'营业收入 13,147,844,296.46 元', accepted:true },
  { key:'netIncome', label:'归母净利润', value:19.11, page:'主要会计数据', confidence:99, sourceText:'归属于上市公司股东的净利润 1,911,214,873.49 元', accepted:true },
  { key:'cfo', label:'经营活动现金流', value:27.22, page:'现金流量表', confidence:98, sourceText:'经营活动产生的现金流量净额 2,721,800,000 元', accepted:true },
  { key:'totalAssets', label:'总资产', value:366.17, page:'合并资产负债表', confidence:99, sourceText:'总资产 36,617,000,000 元', accepted:true },
  { key:'equity', label:'归母股东权益', value:204.02, page:'合并资产负债表', confidence:98, sourceText:'归属于上市公司股东的净资产 20,402,000,000 元', accepted:true },
  { key:'itRevenue', label:'IT设备收入', value:117.06, page:'分产品经营情况', confidence:96, sourceText:'IT设备营业收入 11,706,100,000 元', accepted:true },
  { key:'servicesRevenue', label:'软件及技术服务收入', value:13.95, page:'分产品经营情况', confidence:96, sourceText:'软件开发、系统集成及技术服务营业收入 1,395,200,000 元', accepted:true },
];

function toYi(raw: string) {
  const value = Number(raw.replace(/[，,\s()]/g, ''));
  if (!Number.isFinite(value)) return null;
  if (Math.abs(value) >= 1_000_000) return value / 100_000_000;
  return value;
}

function parsePages(pages: Array<{page:number;text:string}>) {
  return metricDefinitions.flatMap(definition => {
    for (const page of pages) {
      const normalized = page.text.replace(/\s+/g, ' ');
      for (const alias of definition.aliases) {
        const index = normalized.indexOf(alias);
        if (index < 0) continue;
        const excerpt = normalized.slice(index, index + 220);
        const number = excerpt.slice(alias.length).match(/[-(]?\d[\d,，]*(?:\.\d+)?\)?/);
        if (!number) continue;
        const value = toYi(number[0]);
        if (value === null) continue;
        return [{ key:definition.key, label:definition.label, value, page:`P${page.page}`, confidence:92, sourceText:excerpt.slice(0,150), accepted:false } as ExtractedMetric];
      }
    }
    return [];
  });
}

async function extractFile(file: File) {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const pdfjs: any = await import(/* @vite-ignore */ PDFJS_URL);
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: Array<{page:number;text:string}> = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push({ page:pageNumber, text:content.items.map((item:any)=>item.str || '').join(' ') });
    }
    return parsePages(pages);
  }
  const text = await file.text();
  return parsePages([{page:1,text}]);
}

function pct(value:number){ return `${value>=0?'+':''}${(value*100).toFixed(1)}%`; }

export default function ResearchAgent(){
  const { assumptions, model, dcf } = useResearchModel();
  const [metrics,setMetrics] = useState<ExtractedMetric[]>(sampleMetrics);
  const [fileName,setFileName] = useState('中科曙光2024年年度报告（示例已载入）');
  const [status,setStatus] = useState<'ready'|'processing'|'reviewed'|'error'>('ready');
  const [message,setMessage] = useState('已载入可演示样例；也可以选择本地PDF或文本文件重新解析。');
  const [pastedText,setPastedText] = useState('');
  const [question,setQuestion] = useState('哪项假设对估值影响最大？');
  const [answerQuestion,setAnswerQuestion] = useState('哪项假设对估值影响最大？');
  const [auditTime,setAuditTime] = useState('');
  const actual2024 = historicalSummary.find(item=>item.year==='2024A')!;

  const impactItems = useMemo(()=>{
    const cases: Array<{label:string;key:keyof OperatingAssumptions;change:number}> = [
      {label:'IT设备收入增速 +1pct',key:'itGrowth',change:0.01},
      {label:'软件服务收入增速 +1pct',key:'servicesGrowth',change:0.01},
      {label:'IT设备毛利率 +1pct',key:'itGrossMargin',change:0.01},
      {label:'软件服务毛利率 +1pct',key:'servicesGrossMargin',change:0.01},
      {label:'资本开支率 +1pct',key:'capexPct',change:0.01},
      {label:'WACC +0.5pct',key:'wacc',change:0.005},
      {label:'永续增长率 +0.5pct',key:'terminalGrowth',change:0.005},
    ];
    return cases.map(item=>{
      const price=calculateResearchDcf({...assumptions,[item.key]:assumptions[item.key]+item.change}).pricePerShare;
      return {...item,price,delta:price/dcf.pricePerShare-1};
    }).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
  },[assumptions,dcf.pricePerShare]);

  const explanation = useMemo(()=>{
    const q=answerQuestion.toLowerCase();
    const first=model[0];
    if(q.includes('毛利率')){
      const downside=calculateResearchDcf({...assumptions,itGrossMargin:assumptions.itGrossMargin-0.01,servicesGrossMargin:assumptions.servicesGrossMargin-0.01});
      return `若两项业务毛利率同时下降1个百分点，DCF每股价值由¥${dcf.pricePerShare.toFixed(2)}降至¥${downside.pricePerShare.toFixed(2)}，变化${pct(downside.pricePerShare/dcf.pricePerShare-1)}。原因是EBIT与FCFF同步下降。`;
    }
    if(q.includes('bear')||q.includes('悲观')){
      const bear=calculateResearchDcf(scenarioPresets.bear);
      const base=calculateResearchDcf(scenarioPresets.base);
      return `Bear Case目标价为¥${bear.pricePerShare.toFixed(2)}，Base Case为¥${base.pricePerShare.toFixed(2)}。差异主要来自IT设备与软件服务增速、分业务毛利率、研发费用率以及WACC的同步调整。`;
    }
    if(q.includes('wacc')||q.includes('折现率')){
      const higher=calculateResearchDcf({...assumptions,wacc:assumptions.wacc+0.005});
      return `当前WACC为${(assumptions.wacc*100).toFixed(1)}%。提高0.5个百分点后，每股价值由¥${dcf.pricePerShare.toFixed(2)}变为¥${higher.pricePerShare.toFixed(2)}，变化${pct(higher.pricePerShare/dcf.pricePerShare-1)}。折现率提高会降低预测期现金流和终值的现值。`;
    }
    if(q.includes('目标价')||q.includes('变化')){
      return `当前目标价¥${dcf.pricePerShare.toFixed(2)}由2026E–2030E FCFF、WACC ${(assumptions.wacc*100).toFixed(1)}%、永续增长率 ${(assumptions.terminalGrowth*100).toFixed(1)}%及净债务共同决定。终值占企业价值${(dcf.terminalValuePct*100).toFixed(1)}%，因此WACC和永续增长率是主要估值风险。`;
    }
    const top=impactItems[0];
    return `在当前单因素测试中，影响最大的是“${top.label}”：对应每股价值¥${top.price.toFixed(2)}，相对基准变化${pct(top.delta)}。2026E收入为¥${first.revenue.toFixed(1)}亿，建议同时结合情景分析判断，不把单一敏感项直接当作投资结论。`;
  },[answerQuestion,assumptions,dcf,impactItems,model]);

  const handleFile=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];
    if(!file) return;
    setStatus('processing');setFileName(file.name);setMessage('正在本地解析文件，文件不会上传服务器…');
    try{
      const extracted=await extractFile(file);
      if(!extracted.length) throw new Error('未识别到核心财务指标');
      setMetrics(extracted);setStatus('ready');setAuditTime('');setMessage(`已识别${extracted.length}项候选数据，请逐项核对原文。`);
    }catch(error){
      setStatus('error');setMessage(`${error instanceof Error?error.message:'解析失败'}。可改用“粘贴财报文本”或载入示例。`);
    }
  };

  const parsePasted=()=>{
    if(!pastedText.trim()){setMessage('请先粘贴财报文本。');return;}
    const extracted=parsePages([{page:1,text:pastedText}]);
    if(!extracted.length){setStatus('error');setMessage('未识别到核心指标，请保留项目名称及其后数字。');return;}
    setMetrics(extracted);setFileName('粘贴的财报文本');setStatus('ready');setAuditTime('');setMessage(`已识别${extracted.length}项候选数据，请人工复核。`);
  };

  const acceptedCount=metrics.filter(item=>item.accepted).length;
  const updateMetric=(key:MetricKey,patch:Partial<ExtractedMetric>)=>setMetrics(current=>current.map(item=>item.key===key?{...item,...patch}:item));
  const baselineFor=(key:MetricKey)=>({revenue:actual2024.revenue,netIncome:actual2024.netIncome,cfo:actual2024.cfo,totalAssets:actual2024.totalAssets,equity:actual2024.equity,itRevenue:117.06,servicesRevenue:13.95}[key]);
  const confirmReview=()=>{if(!acceptedCount){setMessage('至少确认1项数据后才能形成核验记录。');return;}setStatus('reviewed');setAuditTime(new Date().toLocaleString('zh-CN',{hour12:false}));setMessage(`已确认${acceptedCount}项数据，形成当前会话的模型核验记录。`);};

  return <div className="mx-auto max-w-[1540px] space-y-4">
    <header className="flex flex-col gap-3 border-b border-t-border pb-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex items-center gap-2 text-xs text-t-textDim"><Bot className="h-4 w-4 text-t-cyan" />Research Agent · 中科曙光 603019.SH</div><h1 className="mt-2 text-2xl font-semibold text-t-textBright">财报提取与模型解释 Agent</h1><p className="mt-2 max-w-4xl text-sm text-t-textDim">文件在浏览器本地解析，不上传服务器；Agent只生成候选数据和模型解释，写入研究结论前必须人工复核。</p></div><div className="flex flex-wrap gap-2"><a href={reportUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-t-border bg-t-panel px-3 py-2 text-xs text-t-text"><ExternalLink className="h-3.5 w-3.5" />打开示例年报</a><button onClick={()=>{setMetrics(sampleMetrics);setFileName('中科曙光2024年年度报告（示例已载入）');setStatus('ready');setAuditTime('');setMessage('示例数据已恢复，请进行人工复核。')}} className="inline-flex items-center gap-2 rounded-md border border-t-border bg-t-panel px-3 py-2 text-xs text-t-text"><RefreshCw className="h-3.5 w-3.5" />载入示例</button></div></header>

    <section className="grid gap-3 md:grid-cols-4">{[
      ['01','选择财报','PDF / TXT，本地处理',status==='processing'],['02','提取候选值',`${metrics.length}项核心指标`,metrics.length>0],['03','人工复核',`${acceptedCount}/${metrics.length}项已确认`,status==='reviewed'],['04','解释模型','7项单因素测试',true],
    ].map(([step,label,detail,active])=><div key={step as string} className={`rounded-lg border p-3 ${active?'border-t-cyan/35 bg-t-cyan/[0.035]':'border-t-border bg-t-panel'}`}><div className="font-mono text-[10px] text-t-cyan">{step as string}</div><div className="mt-2 text-xs font-medium text-t-textBright">{label as string}</div><div className="mt-1 text-[10px] text-t-textDim">{detail as string}</div></div>)}</section>

    <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <aside className="space-y-4"><div className="panel p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><Upload className="h-4 w-4 text-t-blue" />上传并解析</h2><label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-t-cyan/35 bg-t-cyan/[0.025] px-4 py-7 text-center hover:bg-t-cyan/[0.05]"><FileText className="h-7 w-7 text-t-cyan" /><span className="mt-3 text-xs font-medium text-t-textBright">选择PDF或文本文件</span><span className="mt-1 text-[10px] text-t-textDim">仅在当前浏览器处理，不保存文件</span><input type="file" accept=".pdf,.txt,.csv,text/plain,application/pdf" onChange={handleFile} className="sr-only" /></label><div className="mt-3 rounded border border-t-border bg-white/[0.012] p-3"><div className="truncate text-xs text-t-text">{fileName}</div><div className={`mt-1 text-[10px] leading-4 ${status==='error'?'text-t-yellow':'text-t-textDim'}`}>{message}</div></div></div>
      <div className="panel p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><FileSearch className="h-4 w-4 text-violet-300" />粘贴财报文本</h2><textarea value={pastedText} onChange={event=>setPastedText(event.target.value)} placeholder="粘贴包含营业收入、归母净利润、经营活动现金流等项目的财报文本…" className="mt-3 h-32 w-full resize-none rounded-md border border-t-border bg-t-bg p-3 text-xs leading-5 text-t-text outline-none focus:border-t-cyan/50"/><button onClick={parsePasted} className="mt-3 w-full rounded-md border border-t-border py-2 text-xs text-t-text hover:border-t-cyan/40">解析粘贴内容</button></div></aside>

      <div className="panel overflow-hidden"><div className="flex flex-col gap-2 border-b border-t-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><ShieldCheck className="h-4 w-4 text-t-green" />候选数据与人工复核</h2><p className="mt-1 text-[10px] text-t-textDim">单位：亿元；勾选表示已对照原文确认</p></div><button onClick={confirmReview} className="rounded-md bg-t-cyan px-3 py-2 text-xs font-medium text-slate-950">确认已复核数据</button></div><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-xs"><thead className="bg-white/[0.02] text-t-textDim"><tr>{['确认','指标','提取值','模型锚点','差异','来源位置','置信度','原文片段'].map(item=><th key={item} className="px-3 py-3 font-medium">{item}</th>)}</tr></thead><tbody className="divide-y divide-t-border">{metrics.map(item=>{const baseline=baselineFor(item.key);const difference=item.value-baseline;return <tr key={item.key}><td className="px-3 py-3"><button onClick={()=>updateMetric(item.key,{accepted:!item.accepted})} className={`flex h-5 w-5 items-center justify-center rounded border ${item.accepted?'border-t-green bg-t-green text-slate-950':'border-t-border'}`}>{item.accepted&&<CheckCircle2 className="h-3.5 w-3.5"/>}</button></td><td className="px-3 py-3 font-medium text-t-textBright">{item.label}</td><td className="px-3 py-3"><input type="number" step="0.01" value={item.value} onChange={event=>updateMetric(item.key,{value:Number(event.target.value),accepted:false})} className="w-24 rounded border border-t-blue/30 bg-t-blue/5 px-2 py-1.5 text-right font-mono text-t-textBright outline-none"/></td><td className="px-3 py-3 font-mono text-t-text">{baseline.toFixed(2)}</td><td className={`px-3 py-3 font-mono ${Math.abs(difference)<0.05?'text-t-green':'text-t-yellow'}`}>{difference>=0?'+':''}{difference.toFixed(2)}</td><td className="px-3 py-3 font-mono text-t-cyan">{item.page}</td><td className="px-3 py-3 font-mono text-t-text">{item.confidence}%</td><td className="max-w-[260px] px-3 py-3 text-[10px] leading-4 text-t-textDim">{item.sourceText}</td></tr>})}</tbody></table></div>{!metrics.length&&<div className="p-8 text-center text-xs text-t-textDim">请选择财报文件或粘贴文本开始提取。</div>}<div className="border-t border-t-border px-4 py-3 text-[10px] text-t-textDim">{auditTime?`核验记录：${auditTime} · ${acceptedCount}项已确认 · 当前会话有效`:'尚未形成核验记录；修改数值后需要重新勾选确认。'}</div></div>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1fr_440px]"><div className="panel p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><Sparkles className="h-4 w-4 text-t-yellow" />模型解释 Agent</h2><p className="mt-1 text-[10px] text-t-textDim">基于当前经营假设和DCF实时计算，不生成无来源结论</p></div><div className="font-mono text-xs text-t-cyan">Base ¥{dcf.pricePerShare.toFixed(2)}/股</div></div><div className="mt-4 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-t-textDim"/><input value={question} onChange={event=>setQuestion(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&question.trim())setAnswerQuestion(question)}} className="w-full rounded-md border border-t-border bg-t-bg py-2 pl-9 pr-3 text-xs text-t-text outline-none focus:border-t-cyan/50"/></div><button onClick={()=>question.trim()&&setAnswerQuestion(question)} className="rounded-md bg-t-cyan px-4 py-2 text-xs font-medium text-slate-950">分析</button></div><div className="mt-3 flex flex-wrap gap-2">{['哪项假设对估值影响最大？','毛利率下降1个百分点会怎样？','WACC提高0.5个百分点会怎样？','Bear与Base情景差异是什么？'].map(item=><button key={item} onClick={()=>{setQuestion(item);setAnswerQuestion(item)}} className="rounded-full border border-t-border px-2.5 py-1 text-[10px] text-t-textDim hover:border-t-cyan/40 hover:text-t-text">{item}</button>)}</div><div className="mt-4 rounded-lg border border-t-cyan/25 bg-t-cyan/[0.035] p-4"><div className="flex items-center gap-2 text-xs font-medium text-t-cyan"><Bot className="h-4 w-4"/>分析结果</div><p className="mt-3 text-sm leading-7 text-t-text">{explanation}</p></div><div className="mt-4 flex items-start gap-2 rounded-md border border-t-yellow/20 bg-t-yellow/5 p-3 text-[10px] leading-5 text-t-yellow"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0"/>这是模型解释，不是投资建议；敏感性结果需要结合行业与公司基本面判断。</div></div>

      <aside className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><h2 className="text-sm font-semibold text-t-textBright">关键假设影响排序</h2><p className="mt-1 text-[10px] text-t-textDim">单因素变化相对当前DCF目标价</p></div><div className="divide-y divide-t-border">{impactItems.map((item,index)=><div key={item.label} className="grid grid-cols-[24px_1fr_72px] items-center gap-3 px-4 py-3"><span className="font-mono text-[10px] text-t-cyan">0{index+1}</span><div><div className="text-xs text-t-text">{item.label}</div><div className="mt-1 h-1.5 rounded bg-white/[0.05]"><div className={`h-full rounded ${item.delta>=0?'bg-t-green':'bg-t-yellow'}`} style={{width:`${Math.min(100,Math.abs(item.delta)*500)}%`}}/></div></div><div className="text-right"><div className="font-mono text-xs text-t-textBright">¥{item.price.toFixed(2)}</div><div className={`mt-1 font-mono text-[9px] ${item.delta>=0?'text-t-green':'text-t-yellow'}`}>{pct(item.delta)}</div></div></div>)}</div></aside>
    </section>

    <section className="panel p-4"><h2 className="text-sm font-semibold text-t-textBright">可追溯来源</h2><div className="mt-3 grid gap-3 md:grid-cols-3">{modelSources.map(source=><div key={source.label} className="rounded-md border border-t-border p-3"><div className="flex items-center gap-2 text-xs text-t-textBright"><CheckCircle2 className="h-3.5 w-3.5 text-t-green"/>{'url' in source&&source.url?<a href={source.url} target="_blank" rel="noreferrer" className="hover:text-t-cyan">{source.label} ↗</a>:source.label}</div><p className="mt-2 text-[10px] leading-4 text-t-textDim">{source.detail}</p></div>)}</div></section>
  </div>;
}
