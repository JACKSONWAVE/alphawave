import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BookOpenCheck, Building2, CalendarDays, CircleAlert, Lightbulb, TrendingUp } from 'lucide-react';
import { buildForecast, defaultDcfAssumptions, historicalFinancials } from '../data/advisoryModel';

const businessSegments = [
  { name: '高端计算机', revenue: 96.4, growth: 21.8, margin: 18.2, share: 56 },
  { name: '存储与云计算', revenue: 44.8, growth: 16.5, margin: 14.7, share: 26 },
  { name: '软件与服务', revenue: 30.4, growth: 11.2, margin: 31.6, share: 18 },
];

const thesis = [
  '算力基础设施投资维持高景气，服务器及液冷相关需求为收入增长的主要驱动。',
  '高毛利软件与服务收入占比提升，预计推动 EBITDA Margin 持续修复。',
  '净现金状态提供研发投入与产业链整合空间，同时降低估值中的财务风险溢价。',
];

const catalysts = [
  { date: '2026 Q3', event: '半年报及新签订单披露', impact: '验证收入增速与毛利率' },
  { date: '2026 Q4', event: '新一代服务器平台放量', impact: '产品结构改善' },
  { date: '2027 Q1', event: '行业资本开支指引更新', impact: '修正中期增长假设' },
];

export default function CompanyResearch() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const code = params.get('code') || '603019.SH';
  const financials = useMemo(() => [...historicalFinancials, ...buildForecast(defaultDcfAssumptions)], []);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="flex flex-col gap-3 border-b border-t-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-t-textDim"><Building2 className="h-4 w-4 text-t-cyan" />上市公司行研中心 · TMT / 算力基础设施</div>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <h1 className="text-2xl font-semibold text-t-textBright">中科曙光</h1>
            <span className="font-mono text-sm text-t-textDim">{code}</span>
            <span className="rounded-full border border-t-green/30 bg-t-green/10 px-2.5 py-1 text-[11px] text-t-green">重点覆盖</span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-t-textDim">已上市公司案例：服务二级市场行研、资本市场跟踪与可比估值，不作为IPO发行人尽调项目。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>navigate('/capital/versions')} className="rounded-md border border-t-border bg-t-panel px-3 py-2 text-xs text-t-text hover:border-t-cyan/40">版本对比</button>
          <button onClick={()=>navigate('/capital/assistant?mode=listed')} className="rounded-md bg-t-cyan px-3 py-2 text-xs font-medium text-slate-950">生成公司底稿</button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ['2026E 收入', '203.3亿', '+18.5%'],
          ['2026E EBITDA', '31.8亿', '15.6% margin'],
          ['2026E 净利润', '25.8亿', '+15.7%'],
          ['净现金', '42.6亿', '资产负债表稳健'],
          ['DCF目标价', '48.60', '+16.2% upside'],
          ['模型置信度', '84 / 100', '21项检查通过'],
        ].map(([label, value, detail]) => (
          <div key={label} className="panel px-4 py-3">
            <div className="text-[11px] text-t-textDim">{label}</div>
            <div className="mt-2 font-mono text-lg font-semibold text-t-textBright">{value}</div>
            <div className="mt-1 text-[11px] text-t-cyan">{detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="panel p-4">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="text-sm font-semibold text-t-textBright">历史表现与盈利预测</h2><p className="mt-1 text-xs text-t-textDim">2022A–2030E · 单位：亿元</p></div>
            <span className="rounded border border-t-border px-2 py-1 text-[10px] text-t-textDim">Base Case</span>
          </div>
          <div className="h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={financials} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="#2a2f3f" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a1d29', border: '1px solid #2a2f3f', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="revenue" name="营业收入" fill="#3b82f6" radius={[3, 3, 0, 0]} opacity={0.78} />
                <Line yAxisId="right" type="monotone" dataKey="ebitda" name="EBITDA" stroke="#06b6d4" strokeWidth={2} dot={{ r: 2 }} />
                <Line yAxisId="right" type="monotone" dataKey="netIncome" name="净利润" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><Lightbulb className="h-4 w-4 text-t-yellow" />核心投资逻辑</h2>
          <div className="mt-4 space-y-4">
            {thesis.map((item, index) => (
              <div key={item} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-t-cyan/10 font-mono text-[10px] text-t-cyan">0{index + 1}</span>
                <p className="text-xs leading-5 text-t-text">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-t-border bg-white/[0.015] p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-t-textBright"><CircleAlert className="h-4 w-4 text-t-yellow" />关键分歧</div>
            <p className="mt-2 text-xs leading-5 text-t-textDim">市场主要分歧在于行业资本开支持续性，以及收入快速增长能否同步转化为自由现金流。</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-t-border px-4 py-3"><h2 className="text-sm font-semibold text-t-textBright">业务分部与经营驱动</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-white/[0.02] text-t-textDim"><tr>{['业务分部', '2025A收入', '收入占比', '同比增速', '毛利率', '核心驱动'].map(item => <th key={item} className="px-4 py-3 font-medium">{item}</th>)}</tr></thead>
              <tbody className="divide-y divide-t-border">
                {businessSegments.map(segment => (
                  <tr key={segment.name} className="hover:bg-white/[0.015]">
                    <td className="px-4 py-3 font-medium text-t-textBright">{segment.name}</td>
                    <td className="px-4 py-3 font-mono text-t-text">{segment.revenue.toFixed(1)}亿</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded bg-white/[0.05]"><div className="h-full rounded bg-t-blue" style={{ width: `${segment.share}%` }} /></div><span className="font-mono text-t-textDim">{segment.share}%</span></div></td>
                    <td className="px-4 py-3 font-mono text-t-green">+{segment.growth.toFixed(1)}%</td>
                    <td className="px-4 py-3 font-mono text-t-text">{segment.margin.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-t-textDim">销量 × 单价 × 产品结构</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><CalendarDays className="h-4 w-4 text-t-blue" />催化剂时间表</h2>
          <div className="mt-4 space-y-3">
            {catalysts.map(item => (
              <div key={item.event} className="grid grid-cols-[72px_1fr] gap-3 rounded-lg border border-t-border bg-white/[0.012] p-3">
                <span className="font-mono text-[11px] text-t-cyan">{item.date}</span>
                <div><div className="text-xs font-medium text-t-text">{item.event}</div><div className="mt-1 text-[11px] text-t-textDim">{item.impact}</div></div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-t-border pt-4 text-[11px] text-t-textDim"><BookOpenCheck className="h-4 w-4" />所有结论需回溯至公告、财报或模型假设</div>
        </div>
      </section>

      <section className="panel p-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><TrendingUp className="h-4 w-4 text-t-green" />收入与FCFF趋势</h2><span className="text-[11px] text-t-textDim">虚线后为预测期</span></div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={financials} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <defs><linearGradient id="fcffFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.28}/><stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid stroke="#2a2f3f" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1a1d29', border: '1px solid #2a2f3f', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="fcff" name="FCFF" stroke="#06b6d4" fill="url(#fcffFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
