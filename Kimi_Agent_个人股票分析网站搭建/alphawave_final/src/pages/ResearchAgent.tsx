import { useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, ExternalLink, FileSearch, FileText, GitCommitHorizontal, RefreshCw, Search, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import { calculateResearchDcf, modelSources, scenarioPresets, type HistoricalMetricKey, type OperatingAssumptions } from '../data/researchModel';
import { useResearchModel } from '../context/ResearchModelContext';

type ExtractedMetric = {
  key: HistoricalMetricKey;
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

const metricDefinitions: Array<{ key: HistoricalMetricKey; label: string; aliases: string[]; }> = [
  { key: 'revenue', label: '营业收入', aliases: ['营业收入', '营业总收入'] },
  { key: 'netIncome', label: '归母净利润', aliases: ['归属于上市公司股东的净利润', '归属于母公司股东的净利润'] },
  { key: 'cfo', label: '经营活动现金流', aliases: ['经营活动产生的现金流量净额'] },
  { key: 'totalAssets', label: '总资产', aliases: ['资产总额', '总资产'] },
  { key: 'equity', label: '归母股东权益', aliases: ['归属于上市公司股东的净资产', '归属于母公司股东权益合计'] },
  { key: 'itRevenue', label: 'IT设备收入', aliases: ['IT设备', '高端计算机'] },
  { key: 'servicesRevenue', label: '软件及技术服务收入', aliases: ['软件开发、系统集成及技术服务', '软件与服务'] },
];

const sampleMetrics: ExtractedMetric[] = [
  { key: 'revenue', label: '营业收入', value: 131.48, page: '主要会计数据', confidence: 99, sourceText: '营业收入 13,147,844,296.46 元', accepted: true },
  { key: 'netIncome', label: '归母净利润', value: 19.11, page: '主要会计数据', confidence: 99, sourceText: '归属于上市公司股东的净利润 1,911,214,873.49 元', accepted: true },
  { key: 'cfo', label: '经营活动现金流', value: 27.22, page: '现金流量表', confidence: 98, sourceText: '经营活动产生的现金流量净额 2,721,800,000 元', accepted: true },
  { key: 'totalAssets', label: '总资产', value: 366.17, page: '合并资产负债表', confidence: 99, sourceText: '总资产 36,617,000,000 元', accepted: true },
  { key: 'equity', label: '归母股东权益', value: 204.02, page: '合并资产负债表', confidence: 98, sourceText: '归属于上市公司股东的净资产 20,402,000,000 元', accepted: true },
  { key: 'itRevenue', label: 'IT设备收入', value: 117.06, page: '分产品经营情况', confidence: 96, sourceText: 'IT设备营业收入 11,706,100,000 元', accepted: true },
  { key: 'servicesRevenue', label: '软件及技术服务收入', value: 13.95, page: '分产品经营情况', confidence: 96, sourceText: '软件开发、系统集成及技术服务营业收入 1,395,200,000 元', accepted: true },
];

function toYi(raw: string) {
  const negative = raw.includes('(');
  const value = Number(raw.replace(/[,，\s()]/g, ''));
  if (!Number.isFinite(value)) return null;
  const normalized = Math.abs(value) >= 1_000_000 ? value / 100_000_000 : value;
  return negative ? -normalized : normalized;
}

function parsePages(pages: Array<{ page: number; text: string; }>) {
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
        return [{ key: definition.key, label: definition.label, value, page: `P${page.page}`, confidence: 92, sourceText: excerpt.slice(0, 150), accepted: false } as ExtractedMetric];
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
    const pages: Array<{ page: number; text: string; }> = [];
    for (let pageNumber = 1;pageNumber <= pdf.numPages;pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push({ page: pageNumber, text: content.items.map((item: any) => item.str || '').join(' ') });
    }
    return parsePages(pages);
  }
  return parsePages([{ page: 1, text: await file.text() }]);
}

const pct = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;

export default function ResearchAgent() {
  const { assumptions, historicalAnchor, model, dcf, modelVersions, applyReviewedHistoricalData } = useResearchModel();
  const [metrics, setMetrics] = useState<ExtractedMetric[]>(sampleMetrics);
  const [fileName, setFileName] = useState('中科曙光2024年年度报告（示例已载入）');
  const [status, setStatus] = useState<'ready' | 'processing' | 'reviewed' | 'written' | 'error'>('ready');
  const [message, setMessage] = useState('已载入可演示样例；确认来源后可写入三表模型。');
  const [pastedText, setPastedText] = useState('');
  const [question, setQuestion] = useState('哪项假设对估值影响最大？');
  const [answerQuestion, setAnswerQuestion] = useState('哪项假设对估值影响最大？');
  const [auditTime, setAuditTime] = useState('');

  const impactItems = useMemo(() => {
    const cases: Array<{ label: string; key: keyof OperatingAssumptions; change: number; }> = [
      { label: 'IT设备收入增速 +1pct', key: 'itGrowth', change: 0.01 },
      { label: '软件服务收入增速 +1pct', key: 'servicesGrowth', change: 0.01 },
      { label: 'IT设备毛利率 +1pct', key: 'itGrossMargin', change: 0.01 },
      { label: '软件服务毛利率 +1pct', key: 'servicesGrossMargin', change: 0.01 },
      { label: '资本开支率 +1pct', key: 'capexPct', change: 0.01 },
      { label: 'WACC +0.5pct', key: 'wacc', change: 0.005 },
      { label: '永续增长率 +0.5pct', key: 'terminalGrowth', change: 0.005 },
    ];
    return cases.map(item => {
      const price = calculateResearchDcf({ ...assumptions, [item.key]: assumptions[item.key] + item.change }, historicalAnchor).pricePerShare;
      return { ...item, price, delta: price / dcf.pricePerShare - 1 };
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [assumptions, dcf.pricePerShare, historicalAnchor]);

  const acceptedCount = metrics.filter(item => item.accepted).length;
  const values = Object.fromEntries(metrics.map(item => [item.key, item.value])) as Partial<Record<HistoricalMetricKey, number>>;
  const allFieldsAccepted = metricDefinitions.every(definition => metrics.some(item => item.key === definition.key && item.accepted));
  const segmentGap = values.revenue && values.itRevenue !== undefined && values.servicesRevenue !== undefined
    ? Math.abs(values.revenue - values.itRevenue - values.servicesRevenue) / values.revenue
    : Number.POSITIVE_INFINITY;
  const preflightChecks = [
    { label: '关键字段完整', detail: `${acceptedCount}/7项已复核`, passed: allFieldsAccepted },
    { label: '分部收入勾稽', detail: Number.isFinite(segmentGap) ? `差异率 ${(segmentGap * 100).toFixed(2)}%` : '缺少数据', passed: segmentGap < 0.02 },
    { label: '资产权益关系', detail: values.totalAssets && values.equity ? `权益/资产 ${((values.equity / values.totalAssets) * 100).toFixed(1)}%` : '缺少数据', passed: Boolean(values.totalAssets && values.equity && values.equity > 0 && values.equity < values.totalAssets) },
    { label: '利润现金质量', detail: values.netIncome && values.cfo ? `CFO/净利润 ${(values.cfo / values.netIncome).toFixed(2)}x` : '缺少数据', passed: Boolean(values.netIncome && values.cfo && values.cfo / values.netIncome > 0 && values.cfo / values.netIncome < 3) },
  ];
  const canWrite = preflightChecks.every(item => item.passed) && status === 'reviewed';

  const explanation = useMemo(() => {
    const q = answerQuestion.toLowerCase();
    if (q.includes('毛利率')) {
      const result = calculateResearchDcf({ ...assumptions, itGrossMargin: assumptions.itGrossMargin - 0.01, servicesGrossMargin: assumptions.servicesGrossMargin - 0.01 }, historicalAnchor);
      return `若两项业务毛利率同时下降1个百分点，DCF每股价值由¥${dcf.pricePerShare.toFixed(2)}降至¥${result.pricePerShare.toFixed(2)}，变化${pct(result.pricePerShare / dcf.pricePerShare - 1)}。原因是EBIT与FCFF同步下降。`;
    }
    if (q.includes('bear') || q.includes('悲观')) {
      const bear = calculateResearchDcf(scenarioPresets.bear, historicalAnchor);
      const base = calculateResearchDcf(scenarioPresets.base, historicalAnchor);
      return `Bear Case目标价为¥${bear.pricePerShare.toFixed(2)}，Base Case为¥${base.pricePerShare.toFixed(2)}。差异来自收入增速、分业务毛利率、研发费用率和WACC的同步调整。`;
    }
    if (q.includes('wacc') || q.includes('折现率')) {
      const result = calculateResearchDcf({ ...assumptions, wacc: assumptions.wacc + 0.005 }, historicalAnchor);
      return `当前WACC为${(assumptions.wacc * 100).toFixed(1)}%。提高0.5个百分点后，每股价值由¥${dcf.pricePerShare.toFixed(2)}变为¥${result.pricePerShare.toFixed(2)}，变化${pct(result.pricePerShare / dcf.pricePerShare - 1)}。`;
    }
    const top = impactItems[0];
    return `当前单因素测试中，影响最大的是“${top.label}”：对应每股价值¥${top.price.toFixed(2)}，相对基准变化${pct(top.delta)}。2026E收入为¥${model[0].revenue.toFixed(1)}亿元，结论仍需结合行业和公司基本面判断。`;
  }, [answerQuestion, assumptions, dcf.pricePerShare, historicalAnchor, impactItems, model]);

  const updateMetric = (key: HistoricalMetricKey, patch: Partial<ExtractedMetric>) => {
    setMetrics(current => current.map(item => item.key === key ? { ...item, ...patch } : item));
    setStatus('ready');
    setAuditTime('');
  };

  const confirmReview = () => {
    if (!allFieldsAccepted) {
      setMessage('写入模型前需要确认全部7项关键数据。');
      return;
    }
    const now = new Date().toLocaleString('zh-CN', { hour12: false });
    setStatus('reviewed');
    setAuditTime(now);
    setMessage('人工复核完成，预写入检查已通过，可以更新三表模型。');
  };

  const writeToModel = () => {
    if (!canWrite) {
      setMessage('请先完成全部字段复核，并通过4项预写入检查。');
      return;
    }
    const patch = Object.fromEntries(metrics.filter(item => item.accepted).map(item => [item.key, item.value])) as Partial<Record<HistoricalMetricKey, number>>;
    const version = applyReviewedHistoricalData(patch, { source: fileName, acceptedCount });
    setStatus('written');
    setMessage(`${version.id}已写入：三表、FCFF和DCF已使用新历史基准重新计算。`);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus('processing');
    setFileName(file.name);
    setMessage('正在本地解析文件，文件不会上传服务器…');
    try {
      const extracted = await extractFile(file);
      if (!extracted.length) throw new Error('未识别到核心财务指标');
      setMetrics(extracted);
      setStatus('ready');
      setAuditTime('');
      setMessage(`已识别${extracted.length}项候选数据，请逐项核对原文。`);
    } catch (error) {
      setStatus('error');
      setMessage(`${error instanceof Error ? error.message : '解析失败'}。可改用粘贴财报文本或载入示例。`);
    }
  };

  const parsePasted = () => {
    if (!pastedText.trim()) return setMessage('请先粘贴财报文本。');
    const extracted = parsePages([{ page: 1, text: pastedText }]);
    if (!extracted.length) {
      setStatus('error');
      return setMessage('未识别到核心指标，请保留项目名称及其后的数字。');
    }
    setMetrics(extracted);
    setFileName('粘贴的财报文本');
    setStatus('ready');
    setAuditTime('');
    setMessage(`已识别${extracted.length}项候选数据，请人工复核。`);
  };

  return <div className="mx-auto max-w-[1540px] space-y-4">
    <header className="flex flex-col gap-3 border-b border-t-border pb-4 xl:flex-row xl:items-end xl:justify-between">
      <div><div className="flex items-center gap-2 text-xs text-t-textDim"><Bot className="h-4 w-4 text-t-cyan" />Research Agent · 中科曙光 603019.SH</div><h1 className="mt-2 text-2xl font-semibold text-t-textBright">财报提取、复核与模型写入 Agent</h1><p className="mt-2 max-w-4xl text-sm text-t-textDim">从财报原文提取候选数据，经人工复核和逻辑检查后写入统一历史基准，自动重算五年三表、FCFF与DCF。</p></div>
      <div className="flex flex-wrap gap-2"><a href={reportUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-t-border bg-t-panel px-3 py-2 text-xs text-t-text"><ExternalLink className="h-3.5 w-3.5" />打开示例年报</a><Link to="/capital/model" className="inline-flex items-center gap-2 rounded-md bg-t-cyan px-3 py-2 text-xs font-medium text-slate-950">查看联动三表<ArrowRight className="h-3.5 w-3.5" /></Link></div>
    </header>

    <section className="grid gap-3 md:grid-cols-5">{[
      ['01', '选择财报', 'PDF / TXT，本地处理', status === 'processing'],
      ['02', '提取候选值', `${metrics.length}项核心指标`, metrics.length > 0],
      ['03', '人工复核', `${acceptedCount}/7项已确认`, status === 'reviewed'],
      ['04', '写入模型', modelVersions[0]?.id || '等待写入', status === 'written'],
      ['05', '估值解释', '7项单因素测试', true],
    ].map(([step, label, detail, active]) => <div key={step as string} className={`rounded-lg border p-3 ${active ? 'border-t-cyan/35 bg-t-cyan/[0.035]' : 'border-t-border bg-t-panel'}`}><div className="font-mono text-[10px] text-t-cyan">{step as string}</div><div className="mt-2 text-xs font-medium text-t-textBright">{label as string}</div><div className="mt-1 text-[10px] text-t-textDim">{detail as string}</div></div>)}</section>

    <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <aside className="space-y-4">
        <div className="panel p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><Upload className="h-4 w-4 text-t-blue" />上传并解析</h2><label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-t-cyan/35 bg-t-cyan/[0.025] px-4 py-7 text-center hover:bg-t-cyan/[0.05]"><FileText className="h-7 w-7 text-t-cyan" /><span className="mt-3 text-xs font-medium text-t-textBright">选择PDF或文本文件</span><span className="mt-1 text-[10px] text-t-textDim">仅在当前浏览器处理，不保存文件</span><input type="file" accept=".pdf,.txt,.csv,text/plain,application/pdf" onChange={handleFile} className="sr-only" /></label><div className="mt-3 rounded border border-t-border bg-white/[0.012] p-3"><div className="truncate text-xs text-t-text">{fileName}</div><div className={`mt-1 text-[10px] leading-4 ${status === 'error' ? 'text-t-yellow' : 'text-t-textDim'}`}>{message}</div></div><button onClick={() => { setMetrics(sampleMetrics); setFileName('中科曙光2024年年度报告（示例已载入）'); setStatus('ready'); setAuditTime(''); setMessage('示例数据已恢复，请进行人工复核。'); }} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-t-border py-2 text-xs text-t-text"><RefreshCw className="h-3.5 w-3.5" />重新载入示例</button></div>
        <div className="panel p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><FileSearch className="h-4 w-4 text-violet-300" />粘贴财报文本</h2><textarea value={pastedText} onChange={event => setPastedText(event.target.value)} placeholder="粘贴包含营业收入、归母净利润、经营活动现金流等项目的财报文本…" className="mt-3 h-28 w-full resize-none rounded-md border border-t-border bg-t-bg p-3 text-xs leading-5 text-t-text outline-none focus:border-t-cyan/50" /><button onClick={parsePasted} className="mt-3 w-full rounded-md border border-t-border py-2 text-xs text-t-text hover:border-t-cyan/40">解析粘贴内容</button></div>
      </aside>

      <div className="panel overflow-hidden"><div className="flex flex-col gap-2 border-b border-t-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><ShieldCheck className="h-4 w-4 text-t-green" />候选数据与人工复核</h2><p className="mt-1 text-[10px] text-t-textDim">单位：亿元；修改数值后需要重新勾选确认</p></div><button onClick={confirmReview} className="rounded-md border border-t-cyan/40 px-3 py-2 text-xs text-t-cyan">确认全部复核</button></div><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-xs"><thead className="bg-white/[0.02] text-t-textDim"><tr>{['确认', '指标', '提取值', '当前基准', '差异', '来源位置', '置信度', '原文片段'].map(item => <th key={item} className="px-3 py-3 font-medium">{item}</th>)}</tr></thead><tbody className="divide-y divide-t-border">{metrics.map(item => { const baseline = historicalAnchor[item.key]; const difference = item.value - baseline; return <tr key={item.key}><td className="px-3 py-3"><button onClick={() => updateMetric(item.key, { accepted: !item.accepted })} className={`flex h-5 w-5 items-center justify-center rounded border ${item.accepted ? 'border-t-green bg-t-green text-slate-950' : 'border-t-border'}`}>{item.accepted && <CheckCircle2 className="h-3.5 w-3.5" />}</button></td><td className="px-3 py-3 font-medium text-t-textBright">{item.label}</td><td className="px-3 py-3"><input type="number" step="0.01" value={item.value} onChange={event => updateMetric(item.key, { value: Number(event.target.value), accepted: false })} className="w-24 rounded border border-t-blue/30 bg-t-blue/5 px-2 py-1.5 text-right font-mono text-t-textBright outline-none" /></td><td className="px-3 py-3 font-mono text-t-text">{baseline.toFixed(2)}</td><td className={`px-3 py-3 font-mono ${Math.abs(difference) < 0.05 ? 'text-t-green' : 'text-t-yellow'}`}>{difference >= 0 ? '+' : ''}{difference.toFixed(2)}</td><td className="px-3 py-3 font-mono text-t-cyan">{item.page}</td><td className="px-3 py-3 font-mono text-t-text">{item.confidence}%</td><td className="max-w-[260px] px-3 py-3 text-[10px] leading-4 text-t-textDim">{item.sourceText}</td></tr>; })}</tbody></table></div><div className="border-t border-t-border px-4 py-3 text-[10px] text-t-textDim">{auditTime ? `复核记录：${auditTime} · ${acceptedCount}项已确认 · 当前会话有效` : '修改数值后需要重新确认，未复核数据不会进入模型。'}</div></div>
    </section>

    <section className="panel p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><GitCommitHorizontal className="h-4 w-4 text-t-cyan" />预写入检查与模型更新</h2><p className="mt-1 text-[10px] text-t-textDim">仅当字段完整、分部勾稽及财务关系检查全部通过时允许写入</p></div><div className="flex items-center gap-2"><span className="font-mono text-xs text-t-textDim">当前DCF ¥{dcf.pricePerShare.toFixed(2)}</span><button onClick={writeToModel} disabled={!canWrite} className="rounded-md bg-t-cyan px-4 py-2 text-xs font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-35">写入三表模型</button></div></div><div className="mt-4 grid gap-3 md:grid-cols-4">{preflightChecks.map(item => <div key={item.label} className={`rounded-md border p-3 ${item.passed ? 'border-t-green/25 bg-t-green/[0.035]' : 'border-t-yellow/25 bg-t-yellow/[0.035]'}`}><div className={`flex items-center gap-2 text-xs ${item.passed ? 'text-t-green' : 'text-t-yellow'}`}>{item.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{item.label}</div><div className="mt-2 font-mono text-[10px] text-t-textDim">{item.detail}</div></div>)}</div></section>

    <section className="grid gap-4 xl:grid-cols-[1fr_440px]">
      <div className="panel p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><Sparkles className="h-4 w-4 text-t-yellow" />模型解释 Agent</h2><p className="mt-1 text-[10px] text-t-textDim">基于当前历史基准、经营假设和DCF实时计算</p></div><div className="font-mono text-xs text-t-cyan">Base ¥{dcf.pricePerShare.toFixed(2)}/股</div></div><div className="mt-4 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-t-textDim" /><input value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && question.trim()) setAnswerQuestion(question); }} className="w-full rounded-md border border-t-border bg-t-bg py-2 pl-9 pr-3 text-xs text-t-text outline-none focus:border-t-cyan/50" /></div><button onClick={() => question.trim() && setAnswerQuestion(question)} className="rounded-md bg-t-cyan px-4 py-2 text-xs font-medium text-slate-950">分析</button></div><div className="mt-3 flex flex-wrap gap-2">{['哪项假设对估值影响最大？', '毛利率下降1个百分点会怎样？', 'WACC提高0.5个百分点会怎样？', 'Bear与Base情景差异是什么？'].map(item => <button key={item} onClick={() => { setQuestion(item); setAnswerQuestion(item); }} className="rounded-full border border-t-border px-2.5 py-1 text-[10px] text-t-textDim hover:border-t-cyan/40 hover:text-t-text">{item}</button>)}</div><div className="mt-4 rounded-lg border border-t-cyan/25 bg-t-cyan/[0.035] p-4"><div className="flex items-center gap-2 text-xs font-medium text-t-cyan"><Bot className="h-4 w-4" />分析结果</div><p className="mt-3 text-sm leading-7 text-t-text">{explanation}</p></div></div>
      <aside className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><h2 className="text-sm font-semibold text-t-textBright">关键假设影响排序</h2><p className="mt-1 text-[10px] text-t-textDim">单因素变化相对当前DCF目标价</p></div><div className="divide-y divide-t-border">{impactItems.map((item, index) => <div key={item.label} className="grid grid-cols-[24px_1fr_72px] items-center gap-3 px-4 py-3"><span className="font-mono text-[10px] text-t-cyan">0{index + 1}</span><div><div className="text-xs text-t-text">{item.label}</div><div className="mt-1 h-1.5 rounded bg-white/[0.05]"><div className={`h-full rounded ${item.delta >= 0 ? 'bg-t-green' : 'bg-t-yellow'}`} style={{ width: `${Math.min(100, Math.abs(item.delta) * 500)}%` }} /></div></div><div className="text-right"><div className="font-mono text-xs text-t-textBright">¥{item.price.toFixed(2)}</div><div className={`mt-1 font-mono text-[9px] ${item.delta >= 0 ? 'text-t-green' : 'text-t-yellow'}`}>{pct(item.delta)}</div></div></div>)}</div></aside>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <div className="panel p-4"><h2 className="text-sm font-semibold text-t-textBright">模型写入记录（当前会话）</h2><div className="mt-3 space-y-2">{modelVersions.length ? modelVersions.map(version => <div key={version.id} className="grid gap-2 rounded-md border border-t-border p-3 sm:grid-cols-[100px_1fr_180px]"><div className="font-mono text-xs text-t-cyan">{version.id}</div><div><div className="truncate text-xs text-t-text">{version.source}</div><div className="mt-1 text-[10px] text-t-textDim">{version.createdAt} · {version.acceptedCount}项复核 · {version.changedFields.length}项变化</div></div><div className="font-mono text-xs text-t-textBright">DCF ¥{version.beforePrice.toFixed(2)} → ¥{version.afterPrice.toFixed(2)}</div></div>) : <div className="rounded-md border border-dashed border-t-border p-5 text-center text-xs text-t-textDim">完成复核并写入后，将在此记录模型版本和估值变化。</div>}</div></div>
      <div className="panel p-4"><h2 className="text-sm font-semibold text-t-textBright">可追溯来源</h2><div className="mt-3 grid gap-3 sm:grid-cols-3">{modelSources.map(source => <div key={source.label} className="rounded-md border border-t-border p-3"><div className="flex items-center gap-2 text-xs text-t-textBright"><CheckCircle2 className="h-3.5 w-3.5 text-t-green" />{'url' in source && source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="hover:text-t-cyan">{source.label} ↗</a> : source.label}</div><p className="mt-2 text-[10px] leading-4 text-t-textDim">{source.detail}</p></div>)}</div></div>
    </section>
  </div>;
}
