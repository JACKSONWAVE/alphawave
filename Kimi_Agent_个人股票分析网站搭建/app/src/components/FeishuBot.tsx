// ============================================================
// 飞书AI助手 - 中期波段行情推送
// 每日推送关注股票的深度分析报告
// ============================================================

import { getStockList, getStockInfo } from '../data/mockData';
import { fetchRealtimeQuotes } from '../data/realtimeApi';
import { generateFullReport, formatFeishuReport, type FullAnalysisReport } from '../data/analysisEngine';

export interface FeishuConfig {
  webhook: string;
  watchList: string[];
  pushTime: string;
  pushType: 'morning' | 'intraday' | 'close' | 'signal'; // 推送类型
}

// 保存/读取配置
export function saveFeishuConfig(config: FeishuConfig) {
  localStorage.setItem('feishu_config', JSON.stringify(config));
}
export function getFeishuConfig(): FeishuConfig | null {
  try { return JSON.parse(localStorage.getItem('feishu_config') || 'null'); } catch { return null; }
}

// 生成每日早报（盘前推送）
export async function generateMorningReport(watchList: string[]): Promise<string> {
  // 获取实时数据
  const quotes = await fetchRealtimeQuotes(watchList);
  const stockList = getStockList();
  const date = new Date().toLocaleDateString('zh-CN');

  let md = `## 📊 早盘策略 ${date}\n\n`;
  md += `> 💡 中期波段操作，持股10天~数月，关注支撑位与趋势\n\n`;

  for (const code of watchList) {
    const quote = quotes.find(q => q.code === code);
    const stock = stockList.find(s => s.code === code);
    if (!stock) continue;

    try {
      const report = generateFullReport(code, stock.name, quote);
      md += formatFeishuReport(report);
      md += `\n\n---\n\n`;
    } catch {
      md += `### ${stock.name} (${code})\n分析生成失败\n\n---\n\n`;
    }
  }

  md += `\n📌 **操作原则**：\n`;
  md += `- 只在支撑位附近分批买入，不追高\n`;
  md += `- 跌破止损位果断离场，不补仓\n`;
  md += `- 到达目标位分批止盈，不贪心\n`;
  md += `- 持仓以10天~2个月为主，不做日内超短\n`;

  return md;
}

// 生成盘中信号推送（只在有强信号时推送）
export async function generateSignalReport(watchList: string[]): Promise<string | null> {
  const quotes = await fetchRealtimeQuotes(watchList);
  const stockList = getStockList();
  const signals: { stock: string; signal: string; price: number }[] = [];

  for (const code of watchList) {
    const quote = quotes.find(q => q.code === code);
    const stock = stockList.find(s => s.code === code);
    if (!stock || !quote) continue;

    try {
      const report = generateFullReport(code, stock.name, quote);
      // 只推送强信号
      if (report.score.signal === 'strong_buy' || report.score.signal === 'strong_sell') {
        signals.push({
          stock: stock.name,
          signal: report.score.signal === 'strong_buy' ? '🟢 强烈看多' : '🔴 强烈看空',
          price: quote.price,
        });
      }
    } catch { /* ignore */ }
  }

  if (signals.length === 0) return null;

  const date = new Date().toLocaleDateString('zh-CN');
  const time = new Date().toTimeString().split(' ')[0];
  let md = `## 🚨 盘中信号提醒 ${date} ${time}\n\n`;

  for (const s of signals) {
    md += `- **${s.stock}** ${s.signal} 现价${s.price.toFixed(2)}\n`;
  }

  md += `\n请登录 TraderPro 查看详细分析。`;
  return md;
}

// 生成收盘总结
export async function generateCloseReport(watchList: string[]): Promise<string> {
  const quotes = await fetchRealtimeQuotes(watchList);
  const date = new Date().toLocaleDateString('zh-CN');
  let md = `## 📋 收盘总结 ${date}\n\n`;
  md += `| 股票 | 收盘 | 涨跌 | 信号 | 明日关注 |\n`;
  md += `|------|------|------|------|----------|\n`;

  const stockList = getStockList();
  for (const code of watchList) {
    const quote = quotes.find(q => q.code === code);
    const stock = stockList.find(s => s.code === code);
    if (!quote || !stock) continue;

    const up = quote.changePct >= 0;
    let focus = '';
    try {
      const report = generateFullReport(code, stock.name, quote);
      const sr = report.supportResistance;
      if (quote.price < sr.weakSupport) focus = '⚠️ 跌破支撑';
      else if (quote.price > sr.weakResistance) focus = '🎯 突破压力';
      else focus = '⏳ 震荡整理';
    } catch { focus = '-'; }

    const signal = up ? '🟢' : '🔴';
    md += `| ${stock.name} | ${quote.price.toFixed(2)} | ${up ? '+' : ''}${quote.changePct.toFixed(2)}% | ${signal} | ${focus} |\n`;
  }

  return md;
}

// 发送消息到飞书
export async function sendToFeishu(webhook: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: { title: { tag: 'plain_text', content: '📊 TraderPro 波段策略' }, template: 'blue' },
          elements: [{ tag: 'div', text: { tag: 'lark_md', content: message } }],
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// 定时推送管理（需要在页面打开时运行）
let pushTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoPush(webhook: string, watchList: string[], pushTime: string) {
  if (pushTimer) clearInterval(pushTimer);

  pushTimer = setInterval(async () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    // 盘前推送（设定时间）
    if (timeStr === pushTime) {
      const report = await generateMorningReport(watchList);
      await sendToFeishu(webhook, report);
      return;
    }

    // 盘中信号（交易时间每10分钟检查一次强信号）
    if (timeStr.endsWith('0') || timeStr.endsWith('5')) {
      const isMarketOpen = (h === 9 && m >= 30) || (h === 10) || (h === 11 && m <= 30) || (h === 13) || (h === 14) || (h === 15 && m <= 5);
      if (isMarketOpen) {
        const signal = await generateSignalReport(watchList);
        if (signal) await sendToFeishu(webhook, signal);
      }
    }

    // 收盘总结（15:05）
    if (timeStr === '15:05') {
      const report = await generateCloseReport(watchList);
      await sendToFeishu(webhook, report);
    }
  }, 60000); // 每分钟检查一次
}

export function stopAutoPush() {
  if (pushTimer) { clearInterval(pushTimer); pushTimer = null; }
}

export const FEISHU_GUIDE = `
## 飞书AI助手配置指南

### 推送时间设置
- **早盘策略推送**：每天盘前（默认9:00），推送关注股票的波段分析报告
- **盘中信号推送**：交易时间内，只在出现强买卖信号时推送
- **收盘总结推送**：每天15:05，推送当日收盘情况和明日关注

### 步骤1：创建飞书群机器人
1. 打开飞书群聊 → 设置 → 群机器人 → 添加机器人
2. 选择「自定义机器人」
3. 复制 Webhook 地址

### 步骤2：配置TraderPro
1. 在下方输入Webhook地址
2. 选择关注的股票
3. 设置早盘推送时间（默认9:00）
4. 点击「保存配置」

### 步骤3：开启自动推送
- 保持TraderPro页面打开，系统会自动执行推送
- 或点击「立即推送」手动测试

### 推送内容说明
- 📊 **早盘策略**：每只关注股票的支撑位/压力位/目标价/止损位 + 买卖信号
- 🚨 **盘中信号**：只在出现强买卖信号时推送，不骚扰
- 📋 **收盘总结**：当日涨跌汇总 + 明日关注重点
`;
