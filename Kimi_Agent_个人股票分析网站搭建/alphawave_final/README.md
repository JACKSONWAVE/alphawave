# AlphaWave Capital Intelligence

面向投行与行业研究场景的公司研究、财务建模、估值与尽调工作台。

## 产品定位

AlphaWave Capital Intelligence 将上市公司公开信息、历史财务数据、经营假设和资本市场数据组织成可复核的专业工作流，帮助分析人员完成：

- 公司覆盖与研究项目管理
- 历史财务重构和五年盈利预测
- FCFF DCF、WACC、永续增长与敏感性分析
- Trading Comparables 可比公司估值
- 财务勾稽、跨文件差异识别和尽调问题跟踪
- 债务期限、偿债能力与信用风险分析
- 公告、财报、政策和交易催化剂跟踪
- 带引用来源的研究底稿生成
- 模型版本、假设变化和审计记录

## 核心页面

| 路径 | 功能 |
| --- | --- |
| `/` | 投融资项目工作台和估值概览 |
| `/analysis` | 公司研究、业务驱动与盈利预测 |
| `/watchlist` | 覆盖公司和项目进度 |
| `/valuation` | 可编辑DCF模型、估值桥接和敏感性矩阵 |
| `/comparables` | 可比样本筛选和相对估值 |
| `/intel` | 公告与催化剂雷达 |
| `/diligence` | 财务核验、尽调和信用分析 |
| `/versions` | 模型版本与审计记录 |
| `/feishu` | AI研究助手与引用来源 |

## 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS
- Recharts
- React Router
- Vercel Functions 与定时任务

## 本地开发

```bash
npm install
npm run dev
```

## 验证与构建

```bash
npm run check
```

## 数据说明

当前专业工作流使用代表性示例模型数据，用于展示研究、估值与尽调方法。正式研究结论应连接已授权的数据源，并逐项核验公司公告、财务报告及模型假设。

## 合规说明

平台用于研究流程和模型演示，不构成证券投资建议。AI生成内容不得替代分析师对原始材料、财务口径和估值假设的专业复核。
