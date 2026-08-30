import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle2, CircleDashed, Download, FileSearch, Landmark, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { downloadCsv } from '../utils/download';

const checks = [
  { category: '财务勾稽', item: '资产 = 负债 + 所有者权益', source: '审计报告 P86–88', status: 'pass', result: '差异 0.00' },
  { category: '财务勾稽', item: '期末现金跨表核对', source: '审计报告 P88 / P92', status: 'pass', result: '差异 0.00' },
  { category: '口径核验', item: '资本开支口径一致性', source: '审计底稿 / 申报稿', status: 'warning', result: '差异 0.26亿' },
  { category: '异常识别', item: '应收账款增速 vs. 收入增速', source: '科目明细 P124', status: 'warning', result: '+8.4pct' },
  { category: '关联交易', item: '前五大客户及关联方核验', source: '客户流水 / 工商穿透', status: 'pass', result: '未见异常' },
  { category: '材料缺口', item: '2026H1主要合同更新', source: '待发行人补充', status: 'pending', result: '未提供' },
];

const debtMaturity = [
  { year: '2026', amount: 1.4 },
  { year: '2027', amount: 2.2 },
  { year: '2028', amount: 1.8 },
  { year: '2029', amount: 1.1 },
  { year: '2030+', amount: 0.9 },
];

const issues = [
  { level: '高', title: '资本开支披露口径差异', owner: '财务组', due: '09/02', detail: '申报材料披露金额较审计现金流量表高0.26亿元，需确认是否包含在建工程转固。' },
  { level: '中', title: '应收账款增速偏快', owner: '业务组', due: '09/04', detail: '应收账款同比增速高于收入8.4pct，需补充账龄、回款及主要客户信用政策。' },
  { level: '低', title: '重大合同列表待更新', owner: '发行人', due: '09/06', detail: '当前材料仅覆盖至2025年末，需补充2026年新增重大订单与合同执行情况。' },
];

function StatusIcon({ status }: { status: string }) {
  if (status === 'pass') return <CheckCircle2 className="h-4 w-4 text-t-green" />;
  if (status === 'warning') return <AlertTriangle className="h-4 w-4 text-t-yellow" />;
  return <CircleDashed className="h-4 w-4 text-t-textDim" />;
}

export default function DiligenceCenter() {
  const [activePaper, setActivePaper] = useState<(typeof checks)[number] | null>(null);
  const exportIssues = () => downloadCsv('华辰智算_IPO尽调问题清单.csv', [
    ['优先级', '问题', '责任人', '截止日期', '处理要求'],
    ...issues.map(issue => [issue.level, issue.title, issue.owner, issue.due, issue.detail]),
  ]);
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="flex flex-col gap-3 border-b border-t-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-t-textDim"><ShieldCheck className="h-4 w-4 text-t-cyan" />华辰智算 · IPO尽调 · 项目 AWC-2026-03（虚构演示）</div>
          <h1 className="mt-2 text-2xl font-semibold text-t-textBright">财务核验与风险工作台</h1>
          <p className="mt-2 text-sm text-t-textDim">交叉核验财报、募集说明书及申报材料，跟踪差异、问题责任人与补充材料。</p>
        </div>
        <button onClick={exportIssues} className="inline-flex w-fit items-center gap-2 rounded-md bg-t-cyan px-3 py-2 text-xs font-medium text-slate-950"><Download className="h-3.5 w-3.5" />导出尽调问题清单</button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['质控检查', '25项', '21项通过', 'text-t-textBright'],
          ['待解释差异', '2项', '涉及0.26亿元', 'text-t-yellow'],
          ['材料缺口', '3项', '1项临近截止', 'text-t-yellow'],
          ['有息负债', '7.4亿', '短债占比 18.9%', 'text-t-textBright'],
          ['利息保障倍数', '8.6x', '压力情景 5.4x', 'text-t-green'],
        ].map(([label, value, detail, color]) => <div key={label} className="panel px-4 py-3.5"><div className="text-[11px] text-t-textDim">{label}</div><div className={`mt-2 font-mono text-xl font-semibold ${color}`}>{value}</div><div className="mt-1 text-[11px] text-t-textDim">{detail}</div></div>)}
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-t-border px-4 py-3">
          <div><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><FileSearch className="h-4 w-4 text-t-cyan" />自动勾稽与跨文件核验</h2><p className="mt-1 text-[11px] text-t-textDim">所有检查保留来源页码、结果和复核状态</p></div>
          <span className="rounded border border-t-green/30 bg-t-green/10 px-2 py-1 text-[10px] text-t-green">84%通过</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-white/[0.02] text-t-textDim"><tr>{['状态', '检查类别', '核验事项', '来源', '检查结果', '操作'].map(item => <th key={item} className="px-4 py-3 font-medium">{item}</th>)}</tr></thead>
            <tbody className="divide-y divide-t-border">
              {checks.map(check => (
                <tr key={check.item} className="hover:bg-white/[0.015]">
                  <td className="px-4 py-3"><StatusIcon status={check.status} /></td>
                  <td className="px-4 py-3 text-t-textDim">{check.category}</td>
                  <td className="px-4 py-3 font-medium text-t-text">{check.item}</td>
                  <td className="px-4 py-3 text-t-textDim">{check.source}</td>
                  <td className={`px-4 py-3 font-mono ${check.status === 'pass' ? 'text-t-green' : check.status === 'warning' ? 'text-t-yellow' : 'text-t-textDim'}`}>{check.result}</td>
                  <td className="px-4 py-3"><button onClick={() => setActivePaper(check)} className="text-t-cyan hover:text-cyan-300">查看底稿</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {activePaper && <section className="rounded-lg border border-t-cyan/30 bg-t-cyan/[0.035] p-4"><div className="flex items-start justify-between gap-4"><div><div className="text-[10px] uppercase tracking-[0.16em] text-t-cyan">核验底稿预览</div><h2 className="mt-2 text-sm font-semibold text-t-textBright">{activePaper.item}</h2><p className="mt-2 text-xs leading-5 text-t-textDim">来源：{activePaper.source}。检查结果为“{activePaper.result}”。演示版已保留来源定位、复核状态与问题关联；实际项目应接入电子底稿和权限审计。</p></div><button onClick={() => setActivePaper(null)} className="text-xs text-t-textDim hover:text-t-text">关闭</button></div></section>}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-t-border px-4 py-3"><h2 className="text-sm font-semibold text-t-textBright">重点问题清单</h2><p className="mt-1 text-[11px] text-t-textDim">按重要性、责任人与截止日期管理</p></div>
          <div className="divide-y divide-t-border">
            {issues.map(issue => (
              <div key={issue.title} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-1 text-[10px] ${issue.level === '高' ? 'bg-t-red/10 text-t-red' : issue.level === '中' ? 'bg-t-yellow/10 text-t-yellow' : 'bg-t-blue/10 text-t-blue'}`}>{issue.level}优先级</span>
                  <h3 className="text-sm font-medium text-t-textBright">{issue.title}</h3>
                  <span className="ml-auto text-[11px] text-t-textDim">{issue.owner} · 截止 {issue.due}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-t-textDim">{issue.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-4">
          <div className="flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><Landmark className="h-4 w-4 text-violet-300" />债务到期墙</h2><p className="mt-1 text-[11px] text-t-textDim">单位：亿元</p></div><span className="rounded bg-t-green/10 px-2 py-1 text-[10px] text-t-green">流动性充足</span></div>
          <div className="mt-3 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={debtMaturity} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#2a2f3f" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a1d29', border: '1px solid #2a2f3f', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="amount" name="到期债务" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-t-border pt-3 text-center">
            <div><div className="text-[10px] text-t-textDim">现金/短债</div><div className="mt-1 font-mono text-sm text-t-green">5.1x</div></div>
            <div><div className="text-[10px] text-t-textDim">净债务/EBITDA</div><div className="mt-1 font-mono text-sm text-t-text">-1.6x</div></div>
            <div><div className="text-[10px] text-t-textDim">OCF/总债务</div><div className="mt-1 font-mono text-sm text-t-text">48.2%</div></div>
          </div>
        </div>
      </section>
    </div>
  );
}
