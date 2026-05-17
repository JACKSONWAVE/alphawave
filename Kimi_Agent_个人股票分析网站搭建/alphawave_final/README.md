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
- 智能选股器
- 价格预警
- 飞书AI助手推送
- 交易记录与盈亏统计
- 节假日智能停刷

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
