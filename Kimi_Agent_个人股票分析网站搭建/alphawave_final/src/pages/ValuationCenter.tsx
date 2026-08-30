import { useMemo, useState } from 'react';
import { Calculator, ChevronDown, CircleDollarSign, RotateCcw, Scale, SlidersHorizontal } from 'lucide-react';
import { calculateDcf, comparableCompanies, defaultDcfAssumptions, median, type DcfAssumptions } from '../data/advisoryModel';

const currentPrice = 41.82;

const assumptionFields: Array<{ key: keyof DcfAssumptions; label: string; suffix: string; step: number; displayPct?: boolean }> = [
  { key: 'revenueGrowth', label: '收入增速', suffix: '%', step: 0.5, displayPct: true },
  { key: 'ebitdaMargin', label: 'EBITDA Margin', suffix: '%', step: 0.5, displayPct: true },
  { key: 'taxRate', label: '有效税率', suffix: '%', step: 0.5, displayPct: true },
  { key: 'capexPct', label: 'CAPEX / Revenue', suffix: '%', step: 0.5, displayPct: true },
  { key: 'nwcPct', label: 'NWC / Revenue', suffix: '%', step: 0.5, displayPct: true },
  { key: 'wacc', label: 'WACC', suffix: '%', step: 0.1, displayPct: true },
  { key: 'terminalGrowth', label: '永续增长率', suffix: '%', step: 0.1, displayPct: true },
  { key: 'netDebt', label: '净债务（负数为净现金）', suffix: '亿', step: 1 },
];

export default function ValuationCenter() {
  const [assumptions, setAssumptions] = useState(defaultDcfAssumptions);
  const dcf = useMemo(() => calculateDcf(assumptions), [assumptions]);
  const selectedComps = comparableCompanies.filter(item => item.selected && item.code !== '603019.SH');
  const medianEvEbitda = median(selectedComps.map(item => item.evEbitda));
  const medianPe = median(selectedComps.map(item => item.pe));
  const upside = dcf.pricePerShare / currentPrice - 1;

  const setValue = (key: keyof DcfAssumptions, rawValue: number, displayPct?: boolean) => {
    const value = displayPct ? rawValue / 100 : rawValue;
    setAssumptions(current => ({ ...current, [key]: value }));
  };

  const waccSteps = [-0.01, -0.005, 0, 0.005, 0.01];
  const growthSteps = [0.01, 0.02, 0.025, 0.03, 0.035];

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="flex flex-col gap-3 border-b border-t-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-t-textDim"><Scale className="h-4 w-4 text-t-cyan" />估值中心 · 中科曙光 603019.SH</div>
          <h1 className="mt-2 text-2xl font-semibold text-t-textBright">DCF 与可比公司估值</h1>
          <p className="mt-2 text-sm text-t-textDim">调整经营与资本成本假设，模型将同步更新FCFF、企业价值、目标价和敏感性矩阵。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAssumptions(defaultDcfAssumptions)} className="inline-flex items-center gap-2 rounded-md border border-t-border bg-t-panel px-3 py-2 text-xs text-t-text"><RotateCcw className="h-3.5 w-3.5" />重置假设</button>
          <button className="rounded-md bg-t-cyan px-3 py-2 text-xs font-medium text-slate-950">导出估值底稿</button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['DCF目标价', `¥${dcf.pricePerShare.toFixed(2)}`, `${upside >= 0 ? '+' : ''}${(upside * 100).toFixed(1)}% vs. current`, 'text-t-cyan'],
          ['企业价值', `¥${dcf.enterpriseValue.toFixed(1)}亿`, 'PV of FCFF + Terminal Value', 'text-t-textBright'],
          ['股权价值', `¥${dcf.equityValue.toFixed(1)}亿`, `净现金 ${Math.abs(assumptions.netDebt).toFixed(1)}亿`, 'text-t-textBright'],
          ['终值占比', `${(dcf.terminalValuePct * 100).toFixed(1)}%`, '越低模型可靠性越高', 'text-t-yellow'],
          ['可比EV/EBITDA', `${medianEvEbitda.toFixed(1)}x`, `P/E中位数 ${medianPe.toFixed(1)}x`, 'text-violet-300'],
        ].map(([label, value, detail, color]) => (
          <div key={label} className="panel px-4 py-3.5"><div className="text-[11px] text-t-textDim">{label}</div><div className={`mt-2 font-mono text-xl font-semibold ${color}`}>{value}</div><div className="mt-1 text-[11px] text-t-textDim">{detail}</div></div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-t-border px-4 py-3">
            <div><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><SlidersHorizontal className="h-4 w-4 text-t-yellow" />关键假设</h2><p className="mt-1 text-[11px] text-t-textDim">蓝色单元格为可编辑输入</p></div>
            <span className="rounded bg-t-blue/10 px-2 py-1 text-[10px] text-t-blue">Base Case</span>
          </div>
          <div className="divide-y divide-t-border px-4">
            {assumptionFields.map(field => {
              const raw = assumptions[field.key];
              const value = field.displayPct ? raw * 100 : raw;
              return (
                <label key={field.key} className="grid grid-cols-[1fr_116px] items-center gap-3 py-3">
                  <span className="text-xs text-t-textDim">{field.label}</span>
                  <div className="flex items-center rounded border border-t-blue/30 bg-t-blue/5 focus-within:border-t-cyan">
                    <input
                      type="number"
                      value={Number(value.toFixed(field.step < 1 ? 1 : 0))}
                      step={field.step}
                      onChange={event => setValue(field.key, Number(event.target.value), field.displayPct)}
                      className="w-full bg-transparent px-2 py-1.5 text-right font-mono text-xs text-t-textBright outline-none"
                    />
                    <span className="pr-2 text-[10px] text-t-textDim">{field.suffix}</span>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="border-t border-t-border bg-t-yellow/5 px-4 py-3 text-[11px] leading-5 text-t-yellow">
            模型约束：WACC需高于永续增长率。当前差值为 {((assumptions.wacc - assumptions.terminalGrowth) * 100).toFixed(1)}pct。
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-t-border px-4 py-3">
              <div><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><Calculator className="h-4 w-4 text-t-cyan" />FCFF预测与折现</h2><p className="mt-1 text-[11px] text-t-textDim">单位：亿元</p></div>
              <button className="flex items-center gap-1 text-[11px] text-t-textDim">查看公式 <ChevronDown className="h-3.5 w-3.5" /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-right text-xs">
                <thead className="bg-white/[0.02] text-t-textDim"><tr><th className="px-4 py-3 text-left font-medium">项目</th>{dcf.forecast.map(item => <th key={item.year} className="px-4 py-3 font-mono font-medium text-t-cyan">{item.year}</th>)}</tr></thead>
                <tbody className="divide-y divide-t-border">
                  {[
                    ['营业收入', dcf.forecast.map(item => item.revenue)],
                    ['EBITDA', dcf.forecast.map(item => item.ebitda)],
                    ['EBIT', dcf.forecast.map(item => item.ebit)],
                    ['FCFF', dcf.forecast.map(item => item.fcff)],
                    ['折现后FCFF', dcf.discountedFcff],
                  ].map(([label, values]) => (
                    <tr key={label as string} className={label === 'FCFF' ? 'bg-t-cyan/[0.035]' : ''}>
                      <td className="px-4 py-3 text-left font-medium text-t-text">{label as string}</td>
                      {(values as number[]).map((value, index) => <td key={index} className="px-4 py-3 font-mono text-t-text">{value.toFixed(1)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-t-border px-4 py-3"><h2 className="text-sm font-semibold text-t-textBright">企业价值 → 股权价值桥接</h2></div>
            <div className="grid gap-3 p-4 sm:grid-cols-5">
              {[
                ['预测期FCFF现值', dcf.discountedFcff.reduce((sum, value) => sum + value, 0)],
                ['+', null],
                ['终值现值', dcf.discountedTerminalValue],
                ['− 净债务', assumptions.netDebt],
                ['股权价值', dcf.equityValue],
              ].map(([label, value], index) => value === null ? (
                <div key={index} className="hidden items-center justify-center text-xl text-t-textDim sm:flex">+</div>
              ) : (
                <div key={label as string} className={`rounded-lg border p-3 ${index === 4 ? 'border-t-cyan/40 bg-t-cyan/5' : 'border-t-border bg-white/[0.012]'}`}>
                  <div className="text-[10px] text-t-textDim">{label as string}</div>
                  <div className="mt-2 font-mono text-base font-semibold text-t-textBright">¥{(value as number).toFixed(1)}亿</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.72fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-t-border px-4 py-3"><h2 className="text-sm font-semibold text-t-textBright">DCF敏感性矩阵</h2><p className="mt-1 text-[11px] text-t-textDim">每股价值 · 行：WACC，列：永续增长率</p></div>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[620px] border-separate border-spacing-1 text-center text-xs">
              <thead><tr><th className="px-3 py-2 text-t-textDim">WACC \ g</th>{growthSteps.map(growth => <th key={growth} className="px-3 py-2 font-mono text-t-textDim">{(growth * 100).toFixed(1)}%</th>)}</tr></thead>
              <tbody>
                {waccSteps.map(offset => {
                  const wacc = assumptions.wacc + offset;
                  return (
                    <tr key={offset}>
                      <th className="px-3 py-2 font-mono text-t-textDim">{(wacc * 100).toFixed(1)}%</th>
                      {growthSteps.map(growth => {
                        const price = calculateDcf({ ...assumptions, wacc, terminalGrowth: growth }).pricePerShare;
                        const isCurrent = Math.abs(offset) < 0.0001 && Math.abs(growth - assumptions.terminalGrowth) < 0.0001;
                        const relative = price / currentPrice;
                        const color = relative > 1.2 ? 'bg-t-green/20 text-t-green' : relative > 1 ? 'bg-t-cyan/15 text-t-cyan' : 'bg-t-yellow/10 text-t-yellow';
                        return <td key={growth} className={`rounded px-3 py-2 font-mono ${color} ${isCurrent ? 'ring-1 ring-t-textBright' : ''}`}>¥{price.toFixed(2)}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><CircleDollarSign className="h-4 w-4 text-violet-300" />可比估值摘要</h2>
          <div className="mt-4 space-y-3">
            {selectedComps.map(company => (
              <div key={company.code} className="grid grid-cols-[1fr_70px_70px] items-center gap-2 rounded-lg border border-t-border px-3 py-2.5 text-xs">
                <div><div className="text-t-text">{company.name}</div><div className="mt-0.5 font-mono text-[10px] text-t-textDim">{company.code}</div></div>
                <div className="text-right"><div className="font-mono text-t-text">{company.evEbitda.toFixed(1)}x</div><div className="text-[10px] text-t-textDim">EV/EBITDA</div></div>
                <div className="text-right"><div className="font-mono text-t-text">{company.pe.toFixed(1)}x</div><div className="text-[10px] text-t-textDim">P/E</div></div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-t-border pt-4">
            <div className="rounded bg-white/[0.02] p-3"><div className="text-[10px] text-t-textDim">EV/EBITDA中位数</div><div className="mt-2 font-mono text-lg text-t-cyan">{medianEvEbitda.toFixed(1)}x</div></div>
            <div className="rounded bg-white/[0.02] p-3"><div className="text-[10px] text-t-textDim">P/E中位数</div><div className="mt-2 font-mono text-lg text-violet-300">{medianPe.toFixed(1)}x</div></div>
          </div>
        </div>
      </section>
    </div>
  );
}
