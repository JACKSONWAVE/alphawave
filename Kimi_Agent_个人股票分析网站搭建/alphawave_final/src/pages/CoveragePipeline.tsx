import { Link } from 'react-router-dom';
import { Building2, ChevronRight, ClipboardList, Plus, Search } from 'lucide-react';
import { coverageCompanies } from '../data/advisoryModel';

export default function CoveragePipeline() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="flex flex-col gap-3 border-b border-t-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="flex items-center gap-2 text-xs text-t-textDim"><ClipboardList className="h-4 w-4 text-t-cyan" />Coverage Universe</div><h1 className="mt-2 text-2xl font-semibold text-t-textBright">公司覆盖与项目进度</h1><p className="mt-2 text-sm text-t-textDim">统一跟踪研究状态、模型完成度、更新责任人与下一步动作。</p></div>
        <button className="inline-flex w-fit items-center gap-2 rounded-md bg-t-cyan px-3 py-2 text-xs font-medium text-slate-950"><Plus className="h-4 w-4" />新增覆盖公司</button>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[['覆盖公司','5家','4个细分行业'],['重点覆盖','1家','模型完成度84%'],['本周待更新','3家','2项临近截止'],['平均完成度','55%','较上周 +8pct']].map(([label,value,detail]) => <div key={label} className="panel p-4"><div className="text-[11px] text-t-textDim">{label}</div><div className="mt-2 font-mono text-xl font-semibold text-t-textBright">{value}</div><div className="mt-1 text-[11px] text-t-cyan">{detail}</div></div>)}
      </section>
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-t-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-sm font-semibold text-t-textBright">TMT覆盖池</h2><p className="mt-1 text-[11px] text-t-textDim">算力、服务器、ICT基础设施</p></div>
          <div className="flex items-center gap-2 rounded-md border border-t-border bg-white/[0.015] px-3 py-2"><Search className="h-3.5 w-3.5 text-t-textDim" /><input className="w-52 bg-transparent text-xs text-t-text outline-none placeholder:text-t-textDim" placeholder="搜索公司或证券代码" /></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-white/[0.02] text-t-textDim"><tr>{['公司','细分行业','研究阶段','评级','负责人','最后更新','模型完成度',''].map(item => <th key={item} className="px-4 py-3 font-medium">{item}</th>)}</tr></thead>
            <tbody className="divide-y divide-t-border">
              {coverageCompanies.map(company => <tr key={company.code} className="hover:bg-white/[0.015]">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded bg-t-cyan/10 text-t-cyan"><Building2 className="h-4 w-4" /></span><div><div className="font-medium text-t-textBright">{company.name}</div><div className="mt-0.5 font-mono text-[10px] text-t-textDim">{company.code}</div></div></div></td>
                <td className="px-4 py-3 text-t-textDim">{company.sector}</td><td className="px-4 py-3 text-t-text">{company.stage}</td>
                <td className="px-4 py-3"><span className={`rounded px-2 py-1 text-[10px] ${company.rating === '重点覆盖' ? 'bg-t-green/10 text-t-green' : company.rating === '跟踪' ? 'bg-t-blue/10 text-t-blue' : 'bg-white/[0.04] text-t-textDim'}`}>{company.rating}</span></td>
                <td className="px-4 py-3 text-t-textDim">{company.analyst}</td><td className="px-4 py-3 text-t-textDim">{company.updated}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded bg-white/[0.05]"><div className="h-full rounded bg-gradient-to-r from-t-blue to-t-cyan" style={{width:`${company.progress}%`}} /></div><span className="font-mono text-[10px] text-t-textDim">{company.progress}%</span></div></td>
                <td className="px-4 py-3"><Link to={`/analysis?code=${company.code}`} className="text-t-cyan"><ChevronRight className="h-4 w-4" /></Link></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
