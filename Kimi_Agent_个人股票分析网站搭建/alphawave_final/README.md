# AlphaWave - 智能波段交易系统

个人股票交易平台，专注中期波段操作（持股10天~数月），支持实时行情、技术分析、智能选股、飞书推送。

## 在线演示

https://你的用户名.github.io/alphawave

## 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Recharts 图表库
- 腾讯财经免费API（实时行情）

## 功能

- 35只股票行情（10只真实K线）
- 8大技术指标（MA/MACD/RSI/KDJ/BOLL/CCI/WR）
- 中期波段策略（支撑/压力/目标/止损）
- 条件策略剧本（买区/突破线/减仓区/止损/目标）
- 盈亏比、仓位建议、策略触发价与历史信号回测
- 智能选股器
- 价格预警
- 飞书AI助手推送（支持 Vercel 云端定时早盘策略）
- 交易记录与盈亏统计
- 节假日智能停刷

## Vercel 飞书定时推送

项目已内置 `/api/feishu-cron` 云端接口，并在 `vercel.json` 配置了工作日早盘推送：

```txt
01:00 UTC = 北京时间 09:00
```

在 Vercel Project Settings -> Environment Variables 添加：

```txt
FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/xxxx
FEISHU_WATCHLIST=603019.SH,002594.SZ,600519.SH
CRON_SECRET=任意随机字符串
```

接口支持：

```txt
/api/feishu-cron?type=morning
/api/feishu-cron?type=signal
/api/feishu-cron?type=close
```

默认只启用每日早盘 Cron，适配 Vercel 个人/Hobby 计划。盘中高频提醒和收盘复盘接口已准备好，升级计划或接入外部定时器后可直接调用。

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## GitHub Pages 部署

```bash
# 方式1: 项目页面 (username.github.io/alphawave)
npm run build:gh

# 方式2: 用户页面 (username.github.io)
GH_PAGES_BASE='/' npm run build
```
