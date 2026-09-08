import { useMemo, useState } from 'react';
import { Building2, Calculator, Download, Landmark, PieChart } from 'lucide-react';
import { useResearchModel } from '../context/ResearchModelContext';
import { downloadXlsx } from '../utils/download';

const formatMoney = (value: number) => `¥${value.toFixed(1)}亿`;

export default function IpoValuation() {
  const { dcf, assumptions } = useResearchModel();
  const [basis, setBasis] = useState<'dcf' | 'custom'>('dcf');
  const [customPreMoney, setCustomPreMoney] = useState(300);
  const [grossProceeds, setGrossProceeds] = useState(60);
  const [existingShares, setExistingShares] = useState(assumptions.shares);
  const preMoney = basis === 'dcf' ? dcf.equityValue : customPreMoney;
  const result = useMemo(() => {
    const issuePrice = preMoney / Math.max(existingShares, 0.01);
    const newShares = grossProceeds / Math.max(issuePrice, 0.01);
    const postMoney = preMoney + grossProceeds;
    const postShares = existingShares + newShares;
    const dilution = newShares / postShares;
    return { issuePrice, newShares, postMoney, postShares, dilution, existingOwnership: existingShares / postShares };
  }, [preMoney, grossProceeds, existingShares]);
  const proceedsSteps = [0.6, 0.8, 1, 1.2, 1.4].map(multiplier => grossProceeds * multiplier);
  const valuationSteps = [0.8, 0.9, 1, 1.1, 1.2].map(multiplier => preMoney * multiplier);

  const exportIpo = () => downloadXlsx('中科曙光_IPO融资估值模型.xlsx', [
    { name: 'IPO融资估值', rows: [
      ['项目', '数值', '单位'],
      ['估值口径', basis === 'dcf' ? 'DCF股权价值' : '自定义Pre-money', ''],
      ['Pre-money估值', preMoney, '亿元'],
      ['拟募集资金', grossProceeds, '亿元'],
      ['Post-money估值', result.postMoney, '亿元'],
      ['发行前股本', existingShares, '亿股'],
      ['发行价格', result.issuePrice, '元/股'],
      ['新发行股份', result.newShares, '亿股'],
      ['发行后总股本', result.postShares, '亿股'],
      ['原股东持股比例', result.existingOwnership * 100, '%'],
      ['新股东持股比例/稀释率', result.dilution * 100, '%'],
    ] },
    { name: '稀释敏感性', rows: [
      ['Pre-money / 募资', ...proceedsSteps.map(value => `${value.toFixed(0)}亿`)],
      ...valuationSteps.map(valuation => [`${valuation.toFixed(0)}亿`, ...proceedsSteps.map(proceeds => proceeds / (valuation + proceeds) * 100)]),
    ] },
  ]);

  return <div className="mx-auto max-w-[1500px] space-y-4">
    <header className="flex flex-col gap-3 border-b border-t-border pb-4 xl:flex-row xl:items-end xl:justify-between">
      <div><div className="flex items-center gap-2 text-xs text-t-textDim"><Landmark className="h-4 w-4 text-t-cyan" />IPO Financing Valuation · 中科曙光 603019.SH</div><h1 className="mt-2 text-2xl font-semibold text-t-textBright">IPO融资估值与股权稀释</h1><p className="mt-2 text-sm text-t-textDim">在统一股权价值基础上联动Pre-money、Post-money、募资规模、发行股数、发行价格与稀释比例。</p></div>
      <button onClick={exportIpo} className="inline-flex w-fit items-center gap-2 rounded-md bg-t-cyan px-3 py-2 text-xs font-medium text-slate-950"><Download className="h-3.5 w-3.5" />导出IPO估值</button>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{[
      ['Pre-money', formatMoney(preMoney), basis === 'dcf' ? '来自当前DCF股权价值' : '自定义估值'],
      ['募资规模', formatMoney(grossProceeds), '全部按新股发行'],
      ['Post-money', formatMoney(result.postMoney), 'Pre-money + 募资额'],
      ['发行价格', `¥${result.issuePrice.toFixed(2)}`, 'Pre-money / 发行前股本'],
      ['发行股数', `${result.newShares.toFixed(2)}亿股`, '募资额 / 发行价格'],
      ['股权稀释', `${(result.dilution * 100).toFixed(1)}%`, '新股 / 发行后总股本'],
    ].map(([label, value, detail]) => <div key={label} className="panel px-4 py-3"><div className="text-[10px] text-t-textDim">{label}</div><div className="mt-2 font-mono text-lg font-semibold text-t-textBright">{value}</div><div className="mt-1 text-[10px] text-t-textDim">{detail}</div></div>)}</section>

    <section className="grid gap-4 xl:grid-cols-[340px_1fr]">
      <aside className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><Calculator className="h-4 w-4 text-t-yellow" />发行参数</h2><p className="mt-1 text-[11px] text-t-textDim">所有蓝色输入即时联动发行结果</p></div><div className="space-y-4 p-4">
        <div><div className="mb-2 text-xs text-t-textDim">Pre-money口径</div><div className="grid grid-cols-2 gap-2"><button onClick={() => setBasis('dcf')} className={`rounded-md px-3 py-2 text-xs ${basis === 'dcf' ? 'bg-t-cyan text-slate-950' : 'border border-t-border text-t-textDim'}`}>当前DCF</button><button onClick={() => setBasis('custom')} className={`rounded-md px-3 py-2 text-xs ${basis === 'custom' ? 'bg-t-cyan text-slate-950' : 'border border-t-border text-t-textDim'}`}>自定义</button></div></div>
        {basis === 'custom' && <InputRow label="Pre-money估值" value={customPreMoney} suffix="亿元" onChange={setCustomPreMoney} />}
        <InputRow label="拟募集资金" value={grossProceeds} suffix="亿元" onChange={setGrossProceeds} />
        <InputRow label="发行前股本" value={existingShares} suffix="亿股" onChange={setExistingShares} />
        <div className="rounded-md border border-t-yellow/25 bg-t-yellow/5 p-3 text-[10px] leading-5 text-t-yellow">本页是融资定价情景模型，不代表中科曙光存在IPO发行计划；默认DCF口径会随经营模型和估值假设同步变化。</div>
      </div></aside>

      <div className="space-y-4"><div className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><PieChart className="h-4 w-4 text-t-cyan" />发行前后股权结构</h2></div><div className="grid gap-4 p-5 md:grid-cols-[1fr_1fr]"><div><div className="flex h-4 overflow-hidden rounded-full bg-white/[0.05]"><div className="bg-t-blue" style={{ width: `${result.existingOwnership * 100}%` }} /><div className="bg-t-cyan" style={{ width: `${result.dilution * 100}%` }} /></div><div className="mt-4 grid grid-cols-2 gap-3"><Ownership label="原股东" value={result.existingOwnership} shares={existingShares} tone="bg-t-blue" /><Ownership label="新股东" value={result.dilution} shares={result.newShares} tone="bg-t-cyan" /></div></div><div className="grid grid-cols-2 gap-3">{[['发行前股本', `${existingShares.toFixed(2)}亿股`], ['发行后股本', `${result.postShares.toFixed(2)}亿股`], ['每股发行价', `¥${result.issuePrice.toFixed(2)}`], ['募集资金占Post-money', `${(grossProceeds / result.postMoney * 100).toFixed(1)}%`]].map(([label, value]) => <div key={label} className="rounded border border-t-border p-3"><div className="text-[10px] text-t-textDim">{label}</div><div className="mt-2 font-mono text-sm text-t-textBright">{value}</div></div>)}</div></div></div>

        <div className="panel overflow-hidden"><div className="border-b border-t-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-t-textBright"><Building2 className="h-4 w-4 text-violet-300" />稀释敏感性（25组）</h2><p className="mt-1 text-[11px] text-t-textDim">行：Pre-money估值；列：募资规模；单元格为新股东持股比例</p></div><div className="overflow-x-auto p-4"><table className="w-full min-w-[700px] border-separate border-spacing-1 text-center text-xs"><thead><tr><th className="px-3 py-2 text-t-textDim">Pre-money \ 募资</th>{proceedsSteps.map(value => <th key={value} className="px-3 py-2 font-mono text-t-textDim">¥{value.toFixed(0)}亿</th>)}</tr></thead><tbody>{valuationSteps.map(valuation => <tr key={valuation}><th className="px-3 py-2 font-mono text-t-textDim">¥{valuation.toFixed(0)}亿</th>{proceedsSteps.map(proceeds => { const dilution = proceeds / (valuation + proceeds); return <td key={proceeds} className={`rounded px-3 py-2 font-mono ${dilution > 0.25 ? 'bg-t-yellow/15 text-t-yellow' : dilution < 0.15 ? 'bg-t-green/15 text-t-green' : 'bg-t-cyan/15 text-t-cyan'}`}>{(dilution * 100).toFixed(1)}%</td>; })}</tr>)}</tbody></table></div></div></div>
    </section>
  </div>;
}

function InputRow({ label, value, suffix, onChange }: { label: string; value: number; suffix: string; onChange: (value: number) => void; }) {
  return <label className="grid grid-cols-[1fr_130px] items-center gap-3"><span className="text-xs text-t-textDim">{label}</span><div className="flex items-center rounded border border-t-blue/30 bg-t-blue/5"><input type="number" min="0.01" step="0.1" value={value} onChange={event => onChange(Math.max(0.01, Number(event.target.value)))} className="w-full bg-transparent px-2 py-2 text-right font-mono text-xs text-t-textBright outline-none" /><span className="pr-2 text-[10px] text-t-textDim">{suffix}</span></div></label>;
}

function Ownership({ label, value, shares, tone }: { label: string; value: number; shares: number; tone: string; }) {
  return <div className="rounded border border-t-border p-3"><div className="flex items-center gap-2 text-xs text-t-text"><span className={`h-2 w-2 rounded-full ${tone}`} />{label}</div><div className="mt-2 font-mono text-lg text-t-textBright">{(value * 100).toFixed(1)}%</div><div className="mt-1 text-[10px] text-t-textDim">{shares.toFixed(2)}亿股</div></div>;
}
