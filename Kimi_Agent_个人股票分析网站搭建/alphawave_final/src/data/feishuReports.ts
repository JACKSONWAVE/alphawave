import { getStockList } from './mockData';
import { fetchRealtimeQuotes } from './realtimeApi';
import { buildStrategyPlan, formatStrategyMarkdown, type StrategyPlan } from './strategyEngine';

export type FeishuReportType = 'morning' | 'signal' | 'close';

function stockName(code: string): string {
  return getStockList().find(s => s.code === code)?.name || code;
}

function planLine(plan: StrategyPlan): string {
  const bias = plan.bias === 'bullish' ? '偏多' : plan.bias === 'bearish' ? '偏空' : '中性';
  return `| ${plan.name} | ${plan.currentPrice} | ${plan.actionText} | ${bias}/${plan.confidence}% | ${plan.entryZone.low}~${plan.entryZone.high} | ${plan.stopLoss} | ${plan.target1} |`;
}

export async function buildPlans(watchList: string[]): Promise<StrategyPlan[]> {
  const quotes = await fetchRealtimeQuotes(watchList);
  return watchList.map(code => {
    const quote = quotes.find(q => q.code === code);
    return buildStrategyPlan(code, stockName(code), quote);
  });
}

export async function generateMorningReport(watchList: string[]): Promise<string> {
  const plans = await buildPlans(watchList);
  const date = new Date().toLocaleDateString('zh-CN');
  let md = `## AlphaWave 早盘策略 ${date}\n\n`;
  md += `> 先看结论，再看触发价。策略周期以10天~2个月的中期波段为主。\n\n`;
  md += `| 股票 | 现价 | 今日动作 | 方向/置信度 | 计划买区 | 止损 | 目标 |\n`;
  md += `|------|------|----------|-------------|----------|------|------|\n`;
  plans.forEach(plan => { md += `${planLine(plan)}\n`; });

  md += `\n---\n\n`;
  for (const plan of plans) {
    md += `${formatStrategyMarkdown(plan)}\n\n`;
    md += `关键风险：${plan.risks.slice(0, 2).join('；')}\n\n`;
    md += `---\n\n`;
  }

  md += `执行纪律：只在计划买区或突破确认后行动；跌破止损先控制仓位；到目标区分批止盈或上移止损。`;
  return md;
}

export async function generateSignalReport(watchList: string[]): Promise<string | null> {
  const plans = await buildPlans(watchList);
  const actionable = plans.filter(plan => {
    const current = plan.currentPrice;
    return plan.triggers.some(t => t.direction === 'above' ? current >= t.price : current <= t.price);
  });

  if (actionable.length === 0) return null;

  const time = new Date().toLocaleString('zh-CN');
  let md = `## AlphaWave 盘中触发提醒 ${time}\n\n`;
  for (const plan of actionable) {
    const fired = plan.triggers.filter(t => t.direction === 'above' ? plan.currentPrice >= t.price : plan.currentPrice <= t.price);
    md += `### ${plan.name} (${plan.code})\n`;
    md += `现价 ${plan.currentPrice}，计划动作：${plan.actionText}，仓位：${plan.positionSize}\n\n`;
    fired.forEach(t => { md += `- ${t.label}：${t.message}\n`; });
    md += `- 止损 ${plan.stopLoss}，目标 ${plan.target1}/${plan.target2}，盈亏比 ${plan.riskReward}\n\n`;
  }

  return md;
}

export async function generateCloseReport(watchList: string[]): Promise<string> {
  const plans = await buildPlans(watchList);
  const date = new Date().toLocaleDateString('zh-CN');
  let md = `## AlphaWave 收盘复盘 ${date}\n\n`;
  md += `| 股票 | 收盘/现价 | 明日重点 | 飞书触发价 | 回测胜率 |\n`;
  md += `|------|----------|----------|------------|----------|\n`;

  for (const plan of plans) {
    const mainTrigger = plan.action === 'exit' || plan.action === 'reduce'
      ? `< ${plan.stopLoss}`
      : `> ${plan.addZone.low}`;
    md += `| ${plan.name} | ${plan.currentPrice} | ${plan.scenarios[0].condition} | ${mainTrigger} | ${plan.backtest.winRate}% |\n`;
  }

  md += `\n明日处理：开盘先看是否触发买区、突破线或止损线，未触发则不主动追单。`;
  return md;
}

export async function sendToFeishu(webhook: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: {
            title: { tag: 'plain_text', content: 'AlphaWave 波段策略' },
            template: 'blue',
          },
          elements: [
            { tag: 'div', text: { tag: 'lark_md', content: message } },
          ],
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
