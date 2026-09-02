import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, FileText, Printer } from 'lucide-react';
import { comparableCompanies, median } from '../data/advisoryModel';
import { industryMetrics } from '../data/industryResearch';
import { calculateResearchDcf, getHistoricalSummary, modelSources, scenarioPresets } from '../data/researchModel';
import { useResearchModel } from '../context/ResearchModelContext';

const thesis = [
  '算力基础设施扩容为服务器及配套软硬件需求提供中期支撑，行业景气仍需结合运营商、云厂商资本开支及招标数据持续验证。',
  'IT设备业务决定收入规模，软件与技术服务业务的收入占比和毛利率决定利润弹性，业务结构变化是盈利预测的核心变量。',
  '公司保持净现金状态，财务风险相对可控；估值的主要不确定性来自收入兑现、毛利率修复和终值假设。',
];

const catalysts = [
  '运营商与云厂商资本开支指引上调',
  '服务器新品放量及订单交付提速',
  '软件与技术服务收入占比提升',
  '毛利率、经营现金流好于模型预期',
];

const risks = [
  '下游资本开支或招标进度低于预期',
  '行业竞争加剧导致产品毛利率承压',
  '研发投入增长快于收入，费用率降幅不及预期',
  '应收账款与存货增加，占用经营现金流',
  'DCF终值占比较高，WACC和永续增长率变化可能显著影响估值',
];

const format = (value: number) => value.toFixed(1);

export default function ResearchReport() {
  const navigate = useNavigate();
  const { assumptions, scenario, historicalAnchor, modelStart, model, dcf } = useResearchModel();
  const history = getHistoricalSummary(historicalAnchor);
  const selectedComps = comparableCompanies.filter(item => item.selected && item.code !== '603019.SH');
  const medianPe = median(selectedComps.map(item => item.pe));
  const compImpliedPrice = model[0].eps * medianPe;
  const scenarioValues = (['bear', 'base', 'bull'] as const).map(key => ({ key, value: calculateResearchDcf(scenarioPresets[key], historicalAnchor).pricePerShare }));
  const maxAuditDifference = Math.max(...model.flatMap(item => [Math.abs(item.balanceCheck), Math.abs(item.cashFlowCheck), Math.abs(item.revenueCheck), Math.abs(item.fcffCheck)]));
  const reportDate = new Date().toLocaleDateString('zh-CN');

  return <div className="mx-auto max-w-[1180px] space-y-4">
    <div className="print-hide flex flex-wrap items-center justify-between gap-3 rounded-lg border border-t-border bg-t-panel p-3">
      <button onClick={() => navigate('/capital/research')} className="inline-flex items-center gap-2 text-xs text-t-text"><ArrowLeft className="h-4 w-4" />返回公司研究</button>
      <div className="flex gap-2"><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md border border-t-border px-3 py-2 text-xs text-t-text"><Printer className="h-4 w-4" />打印预览</button><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-t-cyan px-3 py-2 text-xs font-medium text-slate-950"><Download className="h-4 w-4" />另存为PDF</button></div>
    </div>

    <article className="research-report bg-white text-slate-900 shadow-2xl">
      <header className="border-b-4 border-slate-900 px-8 py-8 sm:px-12">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
          <div><div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">AlphaWave Equity Research</div><h1 className="mt-4 text-3xl font-bold tracking-tight">中科曙光（603019.SH）</h1><p className="mt-2 text-base text-slate-600">算力基础设施行业研究与五年盈利预测</p></div>
          <div className="text-left text-xs leading-6 text-slate-600 sm:text-right"><div>报告日期：{reportDate}</div><div>研究状态：重点跟踪</div><div>当前模型：{scenario.toUpperCase()} Case</div><div>分析师：刘宇森</div></div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded border border-slate-200 bg-slate-200 sm:grid-cols-4">
          {[
            ['2026E收入', `¥${format(model[0].revenue)}亿`],
            ['2026E EPS', `¥${model[0].eps.toFixed(2)}`],
            ['DCF每股价值', `¥${dcf.pricePerShare.toFixed(2)}`],
            ['可比公司隐含值', `¥${compImpliedPrice.toFixed(2)}`],
          ].map(([label, value]) => <div key={label} className="bg-slate-50 p-4"><div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div><div className="mt-2 font-mono text-xl font-bold text-slate-900">{value}</div></div>)}
        </div>
      </header>

      <div className="space-y-9 px-8 py-8 sm:px-12">
        <section>
          <ReportHeading number="01" title="核心结论" />
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="space-y-3">{thesis.map((item, index) => <div key={item} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-700 text-[10px] font-bold text-white">{index + 1}</span><p className="text-sm leading-6 text-slate-700">{item}</p></div>)}</div>
            <div className="rounded border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-bold text-slate-900">估值结论</div><p className="mt-2 text-xs leading-5 text-slate-600">DCF以2026E—2030E FCFF、{(assumptions.wacc * 100).toFixed(1)}% WACC及{(assumptions.terminalGrowth * 100).toFixed(1)}%永续增长率计算；可比公司法采用样本PE中位数。两种方法差异反映增长和终值假设敏感性，不直接构成投资评级。</p></div>
          </div>
        </section>

        <section>
          <ReportHeading number="02" title="行业概览" />
          <p className="mt-3 text-sm leading-6 text-slate-700">研究范围覆盖服务器、数据中心、国产算力和软件服务。行业判断以公开政策目标和基础设施数据为起点，并通过资本开支、招标量、交付节奏及PUE等指标持续验证。</p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{industryMetrics.map(item => <div key={item.label} className="rounded border border-slate-200 p-3"><div className="text-[10px] text-slate-500">{item.label}</div><div className="mt-2 font-mono text-lg font-bold text-slate-900">{item.value}</div><div className="mt-1 text-[10px] text-cyan-700">{item.period}</div><div className="mt-3 text-[10px] leading-4 text-slate-500">来源：{item.source}</div></div>)}</div>
        </section>

        <section className="report-page-break">
          <ReportHeading number="03" title="历史数据与盈利预测" />
          <div className="mt-4 overflow-hidden rounded border border-slate-200"><table className="w-full text-right text-xs"><thead className="bg-slate-900 text-white"><tr><th className="px-3 py-2.5 text-left">项目（亿元）</th>{history.slice(1).map(item => <th key={item.year} className="px-3 py-2.5">{item.year}</th>)}{model.map(item => <th key={item.year} className="px-3 py-2.5">{item.year}</th>)}</tr></thead><tbody className="divide-y divide-slate-200"><ReportRow label="营业收入" values={[...history.slice(1).map(item => item.revenue), ...model.map(item => item.revenue)]} /><ReportRow label="净利润" values={[...history.slice(1).map(item => item.netIncome), ...model.map(item => item.netIncome)]} /><ReportRow label="经营现金流/FCFF" values={[...history.slice(1).map(item => item.cfo), ...model.map(item => item.fcff)]} /><ReportRow label="EPS（元）" values={[0, 0, 0, ...model.map(item => item.eps)]} /></tbody></table></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><Assumption label="收入驱动" value={`IT设备 ${(assumptions.itGrowth * 100).toFixed(1)}% / 软件服务 ${(assumptions.servicesGrowth * 100).toFixed(1)}%`} /><Assumption label="毛利率" value={`IT设备 ${(assumptions.itGrossMargin * 100).toFixed(1)}% / 软件服务 ${(assumptions.servicesGrossMargin * 100).toFixed(1)}%`} /><Assumption label="现金流驱动" value={`CAPEX率 ${(assumptions.capexPct * 100).toFixed(1)}% / 应收率 ${(assumptions.arPct * 100).toFixed(1)}%`} /></div>
        </section>

        <section>
          <ReportHeading number="04" title="估值分析" />
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div><h3 className="text-xs font-bold">DCF情景估值</h3><div className="mt-3 space-y-2">{scenarioValues.map(item => <div key={item.key} className="grid grid-cols-[70px_1fr_80px] items-center gap-3 text-xs"><span className="font-semibold uppercase text-slate-600">{item.key}</span><div className="h-2 rounded bg-slate-100"><div className="h-full rounded bg-cyan-700" style={{ width: `${Math.min(100, item.value / Math.max(...scenarioValues.map(value => value.value)) * 100)}%` }} /></div><span className="text-right font-mono font-bold">¥{item.value.toFixed(2)}</span></div>)}</div><div className="mt-4 grid grid-cols-2 gap-2"><Assumption label="企业价值" value={`¥${dcf.enterpriseValue.toFixed(1)}亿`} /><Assumption label="终值占比" value={`${(dcf.terminalValuePct * 100).toFixed(1)}%`} /></div></div>
            <div><h3 className="text-xs font-bold">可比公司交易倍数</h3><div className="mt-3 overflow-hidden rounded border border-slate-200"><table className="w-full text-right text-[10px]"><thead className="bg-slate-100"><tr><th className="px-2 py-2 text-left">公司</th><th className="px-2 py-2">收入增速</th><th className="px-2 py-2">EV/EBITDA</th><th className="px-2 py-2">PE</th></tr></thead><tbody className="divide-y divide-slate-200">{selectedComps.map(item => <tr key={item.code}><td className="px-2 py-2 text-left">{item.name}</td><td className="px-2 py-2">{item.revenueGrowth.toFixed(1)}%</td><td className="px-2 py-2">{item.evEbitda.toFixed(1)}x</td><td className="px-2 py-2">{item.pe.toFixed(1)}x</td></tr>)}</tbody><tfoot className="bg-cyan-50 font-bold"><tr><td className="px-2 py-2 text-left">中位数</td><td className="px-2 py-2">—</td><td className="px-2 py-2">{median(selectedComps.map(item => item.evEbitda)).toFixed(1)}x</td><td className="px-2 py-2">{medianPe.toFixed(1)}x</td></tr></tfoot></table></div></div>
          </div>
        </section>

        <section className="report-page-break grid gap-6 lg:grid-cols-2">
          <div><ReportHeading number="05" title="催化剂" /><ul className="mt-4 space-y-2">{catalysts.map(item => <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-cyan-700" />{item}</li>)}</ul></div>
          <div><ReportHeading number="06" title="主要风险" /><ul className="mt-4 space-y-2">{risks.map(item => <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{item}</li>)}</ul></div>
        </section>

        <section>
          <ReportHeading number="07" title="模型审计与数据来源" />
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.45fr_1fr]"><div className="rounded border border-slate-200 p-4"><div className="flex items-center gap-2 text-sm font-bold"><CheckCircle2 className="h-4 w-4 text-emerald-600" />四项模型勾稽 PASS</div><div className="mt-2 text-xs leading-5 text-slate-600">资产负债平衡、现金流衔接、分部收入及FCFF公式最大差额为{maxAuditDifference.toFixed(4)}亿元。2025A*桥接收入为¥{modelStart.revenue.toFixed(1)}亿元。</div></div><div className="grid gap-2 sm:grid-cols-3">{modelSources.map(source => <div key={source.label} className="rounded border border-slate-200 p-3"><div className="flex items-center gap-2 text-xs font-bold"><FileText className="h-3.5 w-3.5 text-cyan-700" />{source.label}</div><p className="mt-2 text-[10px] leading-4 text-slate-500">{source.detail}</p></div>)}</div></div>
        </section>
      </div>

      <footer className="border-t border-slate-200 px-8 py-5 text-[10px] leading-4 text-slate-500 sm:px-12">本报告基于公开资料和AlphaWave模型假设生成，仅用于展示行业研究与估值建模方法，不构成证券研究报告、投资建议或收益保证。预测数据可能与实际结果存在重大差异。</footer>
    </article>
  </div>;
}

function ReportHeading({ number, title }: { number: string; title: string }) {
  return <div className="flex items-center gap-3 border-b border-slate-300 pb-2"><span className="font-mono text-xs font-bold text-cyan-700">{number}</span><h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2></div>;
}

function ReportRow({ label, values }: { label: string; values: number[] }) {
  return <tr><td className="px-3 py-2.5 text-left font-semibold text-slate-700">{label}</td>{values.map((value, index) => <td key={index} className="px-3 py-2.5 font-mono text-slate-700">{value ? value.toFixed(1) : '—'}</td>)}</tr>;
}

function Assumption({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-slate-200 bg-slate-50 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div><div className="mt-1.5 text-xs font-bold text-slate-900">{value}</div></div>;
}
