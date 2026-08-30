import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  LineChart,
  Scale,
  Sparkles,
} from 'lucide-react';

const valuationMethods = [
  { label: 'DCF · 永续增长', value: '¥48.60', range: '¥43.20–54.10', color: 'bg-t-cyan' },
  { label: 'DCF · 退出倍数', value: '¥51.30', range: '¥46.80–56.40', color: 'bg-t-blue' },
  { label: '可比公司 · EV/EBITDA', value: '¥46.80', range: '¥41.50–52.20', color: 'bg-t-yellow' },
  { label: '可比公司 · P/E', value: '¥44.90', range: '¥40.10–49.70', color: 'bg-violet-400' },
];

const workflow = [
  { label: '资料归集', detail: '财报、公告与行业数据', status: '已完成', done: true },
  { label: '三表重构', detail: '历史期 2021A–2025A', status: '已完成', done: true },
  { label: '盈利预测', detail: '预测期 2026E–2030E', status: '复核中', done: false },
  { label: '估值与敏感性', detail: 'DCF + Trading Comps', status: '待审批', done: false },
];

const updates = [
  { time: '12:08', title: '收入预测上调', detail: '2027E 收入增速由 18.0% 调整至 20.5%', tag: '模型' },
  { time: '11:32', title: '同业样本更新', detail: '新增浪潮信息与紫光股份，剔除异常倍数', tag: '估值' },
  { time: '10:45', title: '尽调差异待解释', detail: '募集说明书与年报的资本开支口径存在差异', tag: '核验' },
];

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <div className="panel px-4 py-3.5 min-w-0">
      <div className="text-[11px] uppercase tracking-[0.16em] text-t-textDim">{label}</div>
      <div className={`mt-2 text-2xl font-semibold data-num ${tone}`}>{value}</div>
      <div className="mt-1 text-xs text-t-textDim truncate">{detail}</div>
    </div>
  );
}

export default function AdvisoryDashboard() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <section className="rounded-xl border border-t-border bg-[linear-gradient(115deg,rgba(6,182,212,0.10),rgba(59,130,246,0.04)_48%,rgba(245,158,11,0.06))] px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-t-cyan/30 bg-t-cyan/10 px-2.5 py-1 text-t-cyan">示例项目</span>
              <span className="text-t-textDim">TMT · 服务器与算力基础设施</span>
              <span className="text-t-textDim">·</span>
              <span className="text-t-textDim">更新于 08/30 12:08</span>
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-t-textBright">中科曙光</h1>
              <span className="font-mono text-sm text-t-textDim">603019.SH</span>
              <span className="rounded bg-white/[0.05] px-2 py-0.5 text-[11px] text-t-textDim">公司覆盖模型 v1.4</span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-t-textDim">
              围绕算力基础设施需求、服务器业务增长与毛利率修复建立驱动模型；当前估值结论由三表预测、DCF及可比公司法交叉验证。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/analysis?code=603019.SH" className="inline-flex items-center gap-2 rounded-md border border-t-border bg-t-panel px-3.5 py-2 text-sm text-t-text hover:border-t-cyan/40 hover:text-t-textBright">
              打开公司模型 <ChevronRight className="h-4 w-4" />
            </Link>
            <Link to="/intel" className="inline-flex items-center gap-2 rounded-md bg-t-cyan px-3.5 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-300">
              <Sparkles className="h-4 w-4" /> 生成研究摘要
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="基准目标价" value="¥48.60" detail="DCF 永续增长法" tone="text-t-textBright" />
        <MetricCard label="估值中枢" value="¥47.90" detail="四种方法中位数" tone="text-t-cyan" />
        <MetricCard label="2026E EBITDA" value="¥31.8亿" detail="同比 +22.4%" tone="text-t-textBright" />
        <MetricCard label="WACC" value="8.7%" detail="无风险利率 2.4%" tone="text-t-yellow" />
        <MetricCard label="模型完整度" value="84%" detail="21 / 25 项检查通过" tone="text-t-green" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.8fr]">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-t-border px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><Scale className="h-4 w-4 text-t-cyan" />估值足球场</h2>
              <p className="mt-1 text-xs text-t-textDim">多方法交叉验证 · 单位：人民币/股</p>
            </div>
            <span className="rounded border border-t-border px-2 py-1 text-[11px] text-t-textDim">Base Case</span>
          </div>
          <div className="space-y-5 px-5 py-5">
            {valuationMethods.map((method, index) => (
              <div key={method.label} className="grid grid-cols-[150px_1fr_72px] items-center gap-4 text-xs">
                <div>
                  <div className="text-t-text">{method.label}</div>
                  <div className="mt-1 font-mono text-[11px] text-t-textDim">{method.range}</div>
                </div>
                <div className="relative h-2 rounded-full bg-white/[0.05]">
                  <div className={`absolute h-2 rounded-full ${method.color}`} style={{ left: `${16 + index * 4}%`, width: `${44 - index * 2}%` }} />
                  <div className="absolute -top-1 h-4 w-px bg-t-textBright/60" style={{ left: `${43 + index * 2}%` }} />
                </div>
                <div className="text-right font-mono font-medium text-t-textBright">{method.value}</div>
              </div>
            ))}
            <div className="grid grid-cols-[150px_1fr_72px] items-center gap-4 border-t border-t-border pt-4 text-xs">
              <span className="font-medium text-t-textBright">综合估值区间</span>
              <div className="relative h-3 rounded-full bg-gradient-to-r from-t-blue/50 via-t-cyan to-t-yellow/70">
                <span className="absolute -bottom-5 left-0 font-mono text-[10px] text-t-textDim">¥40.10</span>
                <span className="absolute -bottom-5 right-0 font-mono text-[10px] text-t-textDim">¥56.40</span>
              </div>
              <span className="text-right font-mono font-semibold text-t-cyan">¥47.90</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 border-t border-t-border bg-white/[0.015] px-5 py-3 text-xs">
            <div><span className="text-t-textDim">永续增长率</span><strong className="ml-2 font-mono text-t-text">2.5%</strong></div>
            <div><span className="text-t-textDim">退出倍数</span><strong className="ml-2 font-mono text-t-text">18.0x</strong></div>
            <div className="text-right"><span className="text-t-textDim">净债务</span><strong className="ml-2 font-mono text-t-text">-¥42.6亿</strong></div>
          </div>
        </div>

        <div className="panel">
          <div className="border-b border-t-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><FileCheck2 className="h-4 w-4 text-t-yellow" />项目流程</h2>
            <p className="mt-1 text-xs text-t-textDim">模型、估值与核验状态</p>
          </div>
          <div className="divide-y divide-t-border px-4">
            {workflow.map((item, index) => (
              <div key={item.label} className="flex items-center gap-3 py-3.5">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full border ${item.done ? 'border-t-green/30 bg-t-green/10 text-t-green' : 'border-t-border bg-white/[0.025] text-t-textDim'}`}>
                  {item.done ? <CheckCircle2 className="h-4 w-4" /> : <span className="font-mono text-[11px]">0{index + 1}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-t-text">{item.label}</div>
                  <div className="mt-0.5 truncate text-[11px] text-t-textDim">{item.detail}</div>
                </div>
                <span className={`text-[11px] ${item.done ? 'text-t-green' : 'text-t-yellow'}`}>{item.status}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-t-border px-4 py-3">
            <div className="mb-2 flex justify-between text-[11px] text-t-textDim"><span>整体进度</span><span className="font-mono text-t-text">72%</span></div>
            <div className="h-1.5 rounded-full bg-white/[0.05]"><div className="h-full w-[72%] rounded-full bg-gradient-to-r from-t-blue to-t-cyan" /></div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-4">
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-t-cyan/10 p-2 text-t-cyan"><Building2 className="h-5 w-5" /></div>
            <ArrowUpRight className="h-4 w-4 text-t-textDim" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-t-textBright">公司研究</h3>
          <p className="mt-1.5 text-xs leading-5 text-t-textDim">商业模式、收入驱动、盈利预测与核心假设统一归档。</p>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-t-textDim"><LineChart className="h-3.5 w-3.5" />5年历史期 · 5年预测期</div>
        </div>
        <div className="panel p-4">
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-t-yellow/10 p-2 text-t-yellow"><CircleDollarSign className="h-5 w-5" /></div>
            <ArrowUpRight className="h-4 w-4 text-t-textDim" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-t-textBright">估值与资本结构</h3>
          <p className="mt-1.5 text-xs leading-5 text-t-textDim">DCF、交易可比、WACC、债务期限和融资情景联动分析。</p>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-t-textDim"><Scale className="h-3.5 w-3.5" />4种方法 · 12项敏感性</div>
        </div>
        <div className="panel p-4">
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-violet-400/10 p-2 text-violet-300"><FileCheck2 className="h-5 w-5" /></div>
            <ArrowUpRight className="h-4 w-4 text-t-textDim" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-t-textBright">尽调与质控</h3>
          <p className="mt-1.5 text-xs leading-5 text-t-textDim">跨文件勾稽、异常识别、问题清单和材料缺口持续跟踪。</p>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-t-textDim"><FileCheck2 className="h-3.5 w-3.5" />25项检查 · 3项待复核</div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-t-border px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><CalendarClock className="h-4 w-4 text-t-blue" />今日模型动态</h2>
            <p className="mt-1 text-xs text-t-textDim">所有假设和结论修改均保留版本记录</p>
          </div>
          <button className="text-xs text-t-cyan hover:text-cyan-300">查看审计日志</button>
        </div>
        <div className="divide-y divide-t-border">
          {updates.map(update => (
            <div key={update.time} className="grid gap-2 px-4 py-3 sm:grid-cols-[60px_90px_1fr] sm:items-center">
              <span className="font-mono text-[11px] text-t-textDim">{update.time}</span>
              <span className="w-fit rounded bg-white/[0.04] px-2 py-1 text-[10px] text-t-textDim">{update.tag}</span>
              <div className="min-w-0"><span className="text-sm text-t-text">{update.title}</span><span className="ml-3 text-xs text-t-textDim">{update.detail}</span></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
