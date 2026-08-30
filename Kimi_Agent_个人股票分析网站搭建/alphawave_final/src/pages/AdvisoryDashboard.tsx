import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, CircleDollarSign, FileCheck2, Landmark, Scale, ShieldAlert, Sparkles, UsersRound } from 'lucide-react';

const stages = [
  { label: '立项与冲突检查', status: '已完成', detail: '独立性、KYC、项目范围确认', done: true },
  { label: '尽调与财务核验', status: '进行中', detail: '业务 / 法律 / 财务 / 税务', done: false },
  { label: '股改与申报准备', status: '待启动', detail: '规范整改、申报财务期、招股书', done: false },
  { label: '审核与发行', status: '未开始', detail: '问询回复、路演、簿记定价', done: false },
];

const workstreams = [
  { title: 'IPO尽调与核验', detail: '客户供应商穿透、收入真实性、三表勾稽、关联方与内控。', to: '/capital/diligence', icon: FileCheck2, progress: '68%' },
  { title: '交易估值与融资', detail: 'DCF、可比公司、先例交易、Pre-money / Post-money 与稀释。', to: '/capital/valuation', icon: Scale, progress: '72%' },
  { title: '可比与先例交易', detail: '按业务、规模、增速与盈利能力筛选样本并形成估值区间。', to: '/capital/comparables', icon: Building2, progress: '61%' },
  { title: '底稿与版本审计', detail: '记录假设变更、复核人、证据页码与模型版本。', to: '/capital/versions', icon: Landmark, progress: '84%' },
];

const issues = [
  { level: '高', title: '经销收入终端穿透样本不足', owner: '业务组', due: '09/03' },
  { level: '中', title: '研发费用资本化口径待统一', owner: '财务组', due: '09/05' },
  { level: '中', title: '员工持股平台锁定安排待确认', owner: '法律组', due: '09/06' },
];

function Metric({ label, value, detail, tone = 'text-t-textBright' }: { label: string; value: string; detail: string; tone?: string }) {
  return <div className="panel px-4 py-3.5"><div className="text-[11px] text-t-textDim">{label}</div><div className={`mt-2 font-mono text-xl font-semibold ${tone}`}>{value}</div><div className="mt-1 text-[11px] text-t-textDim">{detail}</div></div>;
}

export default function AdvisoryDashboard() {
  return <div className="mx-auto max-w-[1500px] space-y-4">
    <section className="rounded-xl border border-t-border bg-[linear-gradient(115deg,rgba(6,182,212,0.11),rgba(59,130,246,0.04)_48%,rgba(245,158,11,0.07))] p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]"><span className="rounded-full bg-t-cyan/10 px-2.5 py-1 text-t-cyan">虚构演示项目</span><span className="rounded-full bg-t-yellow/10 px-2.5 py-1 text-t-yellow">Pre-IPO / A股IPO辅导</span><span className="text-t-textDim">项目 AWC-2026-03</span></div>
          <h1 className="mt-3 text-2xl font-semibold text-t-textBright">华辰智算科技有限公司</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-t-textDim">为未上市算力基础设施企业搭建投行项目工作台：覆盖立项、尽调、规范整改、申报财务核验、估值与发行方案。页面数字均为演示数据，不代表真实公司。</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link to="/capital/diligence" className="inline-flex items-center gap-2 rounded-md border border-t-border bg-t-panel px-3.5 py-2 text-xs text-t-text hover:border-t-cyan/40">进入尽调室 <ArrowRight className="h-4 w-4" /></Link><Link to="/capital/assistant" className="inline-flex items-center gap-2 rounded-md bg-t-cyan px-3.5 py-2 text-xs font-medium text-slate-950"><Sparkles className="h-4 w-4" />生成项目周报</Link></div>
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Metric label="拟申报板块" value="科创板" detail="辅导备案准备期" /><Metric label="拟融资额" value="¥18.0亿" detail="全部为新股发行" tone="text-t-cyan" /><Metric label="Pre-money" value="¥82–96亿" detail="三种方法交叉验证" tone="text-t-cyan" /><Metric label="2026E Revenue" value="¥35.2亿" detail="同比 +23.9%" /><Metric label="核心问题" value="3项" detail="1项高优先级" tone="text-t-yellow" /><Metric label="尽调完成度" value="68%" detail="102 / 150 项完成" tone="text-t-green" /></section>

    <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><Landmark className="h-4 w-4 text-t-cyan" />IPO项目阶段</h2><p className="mt-1 text-[11px] text-t-textDim">从立项到发行的责任、材料与问题闭环</p></div><div className="grid gap-3 p-4 md:grid-cols-4">{stages.map((stage, index) => <div key={stage.label} className={`rounded-lg border p-3 ${stage.done ? 'border-t-green/30 bg-t-green/[0.04]' : index === 1 ? 'border-t-cyan/40 bg-t-cyan/[0.04]' : 'border-t-border bg-white/[0.012]'}`}><div className="flex items-center justify-between"><span className="font-mono text-[10px] text-t-textDim">0{index + 1}</span>{stage.done && <CheckCircle2 className="h-4 w-4 text-t-green" />}</div><h3 className="mt-4 text-xs font-medium text-t-textBright">{stage.label}</h3><p className="mt-2 min-h-10 text-[11px] leading-5 text-t-textDim">{stage.detail}</p><div className={`mt-3 text-[10px] ${stage.done ? 'text-t-green' : index === 1 ? 'text-t-cyan' : 'text-t-textDim'}`}>{stage.status}</div></div>)}</div></div>
      <div className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><CircleDollarSign className="h-4 w-4 text-t-yellow" />发行方案快照</h2></div><div className="grid grid-cols-2 gap-3 p-4 text-xs">{[['发行前股本','2.40亿股'],['拟发行新股','0.48亿股'],['发行后股本','2.88亿股'],['新股稀释','16.7%'],['募资用途','产线 / 研发 / 补流'],['预计上市市值','¥100–118亿']].map(([label,value])=><div key={label} className="rounded border border-t-border bg-white/[0.012] p-3"><div className="text-[10px] text-t-textDim">{label}</div><div className="mt-2 font-mono text-t-textBright">{value}</div></div>)}</div><Link to="/capital/valuation" className="mx-4 mb-4 flex items-center justify-center gap-2 rounded-md border border-t-cyan/30 bg-t-cyan/5 py-2 text-xs text-t-cyan">打开估值与稀释模型 <ArrowRight className="h-3.5 w-3.5" /></Link></div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{workstreams.map(item => <Link key={item.title} to={item.to} className="panel group p-4 hover:border-t-cyan/35"><div className="flex items-center justify-between"><span className="rounded-lg bg-t-cyan/10 p-2 text-t-cyan"><item.icon className="h-5 w-5" /></span><ArrowRight className="h-4 w-4 text-t-textDim transition-transform group-hover:translate-x-1" /></div><h3 className="mt-4 text-sm font-medium text-t-textBright">{item.title}</h3><p className="mt-2 min-h-12 text-xs leading-5 text-t-textDim">{item.detail}</p><div className="mt-4 flex items-center gap-2"><div className="h-1.5 flex-1 rounded bg-white/[0.05]"><div className="h-full rounded bg-gradient-to-r from-t-blue to-t-cyan" style={{width:item.progress}} /></div><span className="font-mono text-[10px] text-t-textDim">{item.progress}</span></div></Link>)}</section>

    <section className="grid gap-4 xl:grid-cols-[1fr_360px]"><div className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><ShieldAlert className="h-4 w-4 text-t-yellow" />重点问题与责任人</h2></div><div className="divide-y divide-t-border">{issues.map(item=><div key={item.title} className="grid items-center gap-2 px-4 py-3 text-xs sm:grid-cols-[60px_1fr_90px_80px]"><span className={`w-fit rounded px-2 py-1 text-[10px] ${item.level==='高'?'bg-t-red/10 text-t-red':'bg-t-yellow/10 text-t-yellow'}`}>{item.level}优先</span><span className="text-t-text">{item.title}</span><span className="text-t-textDim">{item.owner}</span><span className="font-mono text-t-textDim">截止 {item.due}</span></div>)}</div></div><div className="panel p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><UsersRound className="h-4 w-4 text-t-blue" />项目团队</h2><div className="mt-4 space-y-3 text-xs">{[['保荐代表人','王珂 / 陈晟'],['项目经理','刘宇森'],['财务组','3人 · 进行中'],['法律组','2人 · 进行中'],['行业组','2人 · 已进场']].map(([role,name])=><div key={role} className="flex justify-between border-b border-t-border pb-2"><span className="text-t-textDim">{role}</span><span className="text-t-text">{name}</span></div>)}</div></div></section>
  </div>;
}
