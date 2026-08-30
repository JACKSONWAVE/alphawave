import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, CheckCircle2, Copy, FileText, Sparkles } from 'lucide-react';

const sections = ['投资摘要','公司概览','行业与竞争格局','盈利预测','估值分析','催化剂与风险'];
export default function ResearchAssistant(){
  const [params]=useSearchParams();
  const listed=params.get('mode')==='listed';
  const [active,setActive]=useState('投资摘要');
  const [copied,setCopied]=useState(false);
  const [revision,setRevision]=useState(1);
  const title=listed?'中科曙光 · 上市公司深度底稿':'华辰智算 · IPO项目周报（虚构演示）';
  const paragraphs=listed?[
    '公司处于国内算力基础设施产业链核心环节。基准情景下，我们预计2026—2030年收入复合增速约15%，增长主要由服务器需求、产品结构升级及软件服务收入占比提升驱动。',
    '盈利端预计受益于高毛利业务占比提升。该模块属于上市公司行研，DCF与交易倍数用于目标价和相对价值判断，并不替代IPO发行人尽调。',
  ]:[
    '本周完成收入真实性抽样、主要客户工商穿透及历史三表勾稽。项目整体尽调完成度68%，经销收入终端穿透仍为高优先级事项。',
    '初步估值采用DCF、上市可比公司与先例交易交叉验证，Pre-money区间为82–96亿元；拟募集18亿元用于智能产线、研发平台与营运资金。',
  ];
  const copy=async()=>{await navigator.clipboard.writeText(`${title}\n${active}\n\n${paragraphs.join('\n\n')}`);setCopied(true);window.setTimeout(()=>setCopied(false),1600);};
  return <div className="mx-auto max-w-[1400px] space-y-4"><header className="flex flex-col gap-3 border-b border-t-border pb-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-xs text-t-textDim"><Bot className="h-4 w-4 text-t-cyan" />Deal &amp; Research Copilot</div><h1 className="mt-2 text-2xl font-semibold text-t-textBright">AI项目助手</h1><p className="mt-2 text-sm text-t-textDim">基于已核验的模型、尽调底稿和公开资料生成可追溯内容；AI文本必须由项目组复核。</p></div><button onClick={()=>setRevision(value=>value+1)} className="inline-flex w-fit items-center gap-2 rounded-md bg-t-cyan px-3 py-2 text-xs font-medium text-slate-950"><Sparkles className="h-4 w-4" />重新生成 v{revision}</button></header><section className="grid gap-4 xl:grid-cols-[230px_1fr_320px]"><aside className="panel p-2"><div className="px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-t-textDim">报告结构</div>{sections.map(section=><button key={section} onClick={()=>setActive(section)} className={`mb-1 w-full rounded-md px-3 py-2.5 text-left text-xs ${active===section?'bg-t-cyan/10 text-t-cyan':'text-t-textDim hover:bg-white/[0.025] hover:text-t-text'}`}>{section}</button>)}</aside><main className="panel p-5"><div className="flex items-center justify-between border-b border-t-border pb-4"><div><div className="text-[11px] text-t-textDim">{title}</div><h2 className="mt-1 text-lg font-semibold text-t-textBright">{active}</h2></div><button onClick={copy} className="flex items-center gap-2 text-xs text-t-textDim"><Copy className="h-3.5 w-3.5" />{copied?'已复制':'复制'}</button></div><article className="space-y-4 py-5 text-sm leading-7 text-t-text">{paragraphs.map(item=><p key={item}>{item}</p>)}<div className="rounded-lg border border-t-cyan/20 bg-t-cyan/[0.035] p-4"><div className="text-xs font-medium text-t-cyan">工作结论</div><p className="mt-2 text-sm leading-6">{listed?'上市公司估值持续有效，可用于行研、ECM、M&A与战略咨询；IPO项目的核心则是申报尽调、规范性核查和发行定价。':'当前可以推进财务专项核查与估值区间复核，但高优先级收入穿透问题关闭前，不建议进入申报材料定稿。'}</p></div></article></main><aside className="space-y-4"><div className="panel p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><FileText className="h-4 w-4 text-t-blue" />引用来源</h2><div className="mt-4 space-y-3">{(listed?['2025年年度报告 · P42–96','2026年半年度业绩预告','行业资本开支数据库 · 2026Q2','AlphaWave DCF模型 · v1.4']:['审计报告与科目明细 · v3','客户供应商穿透底稿 · v2','IPO尽调问题清单 · 08/30','交易估值模型 · v2.1']).map(source=><div key={source} className="flex gap-2 text-xs text-t-text"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-t-green" />{source}</div>)}</div></div><div className="panel p-4"><div className="text-[11px] text-t-textDim">生成质量</div><div className="mt-2 font-mono text-2xl font-semibold text-t-green">92 / 100</div><div className="mt-3 h-1.5 rounded bg-white/[0.05]"><div className="h-full w-[92%] rounded bg-t-green" /></div><p className="mt-3 text-[11px] leading-5 text-t-textDim">版本 v{revision} · 引用完整；存在2项假设仍待高级复核。</p></div></aside></section></div>}
