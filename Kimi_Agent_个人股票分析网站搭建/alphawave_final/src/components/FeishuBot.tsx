import {
  generateCloseReport,
  generateMorningReport,
  generateSignalReport,
  sendToFeishu,
} from '../data/feishuReports';

export interface FeishuConfig {
  webhook: string;
  watchList: string[];
  pushTime: string;
  pushType: 'morning' | 'intraday' | 'close' | 'signal';
}

export { generateCloseReport, generateMorningReport, generateSignalReport, sendToFeishu };

export function saveFeishuConfig(config: FeishuConfig) {
  localStorage.setItem('feishu_config', JSON.stringify(config));
  window.dispatchEvent(new CustomEvent('alphawave:settings-changed', { detail: { feishu: true } }));
}

export function getFeishuConfig(): FeishuConfig | null {
  try {
    return JSON.parse(localStorage.getItem('feishu_config') || 'null');
  } catch {
    return null;
  }
}

let pushTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoPush(webhook: string, watchList: string[], pushTime: string) {
  if (pushTimer) clearInterval(pushTimer);

  pushTimer = setInterval(async () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    if (timeStr === pushTime) {
      const report = await generateMorningReport(watchList);
      await sendToFeishu(webhook, report);
      return;
    }

    const isSignalMinute = m % 10 === 0;
    const isMarketOpen = (h === 9 && m >= 30) || h === 10 || (h === 11 && m <= 30) || h === 13 || h === 14;
    if (isSignalMinute && isMarketOpen) {
      const signal = await generateSignalReport(watchList);
      if (signal) await sendToFeishu(webhook, signal);
    }

    if (timeStr === '15:05') {
      const report = await generateCloseReport(watchList);
      await sendToFeishu(webhook, report);
    }
  }, 60000);
}

export function stopAutoPush() {
  if (pushTimer) {
    clearInterval(pushTimer);
    pushTimer = null;
  }
}

export const FEISHU_GUIDE = `
## 飞书策略助手配置指南

### 推荐方式：云端自动推送
1. 在 Vercel Project Settings -> Environment Variables 添加：
   - FEISHU_WEBHOOK：你的飞书机器人 Webhook
   - FEISHU_WATCHLIST：关注股票代码，逗号分隔，例如 603019.SH,002594.SZ,600519.SH
   - CRON_SECRET：随机字符串，用于保护定时接口
2. 部署后，Vercel Cron 会每天盘前调用 /api/feishu-cron?type=morning。
3. 盘中提醒和收盘复盘接口也已准备好，可在升级 Vercel 计划后增加更高频 Cron。

### 本页手动/临时方式
- 输入 Webhook 后可以立即推送测试。
- 开启自动推送需要保持页面打开，适合临时调试，不适合长期无人值守。

### 推送内容
- 早盘策略：今日动作、方向、置信度、买区、止损、目标、仓位建议。
- 盘中提醒：突破压力、回踩买区、跌破止损、接近止盈时提醒。
- 收盘复盘：次日重点、触发价、回测胜率。
`;
