# AlphaWave — Valuation & Equity Research Modeling

AlphaWave 是一个将个人交易终端与专业估值、行研建模分开的双工作区项目。专业建模工作区以中科曙光（603019.SH）为核心案例，展示从经营驱动、三表预测到DCF、可比公司估值和目标价推导的完整逻辑链。

## 核心建模能力

- 2022A–2024A历史财务、2025A*业绩快报与2026E–2030E预测
- IT设备与软件服务分业务收入驱动
- 毛利率、研发费用、SG&A、CAPEX和营运资金假设
- 利润表、资产负债表与现金流量表自动联动和平衡检查
- FCFF DCF、WACC、永续增长率和EV到Equity Value桥接
- WACC拆解、5×5双因素敏感性矩阵及单元格交互解释
- Trading Comparables、SOTP与Valuation Football Field
- Bear / Base / Bull情景和目标价敏感性分析
- 工信部公开数据、行业景气跟踪框架及可比公司选择逻辑
- 行研投资逻辑、盈利预测、催化剂、风险及预期差

## 页面结构

| 路径 | 功能 |
| --- | --- |
| `/` | 原个人交易终端 |
| `/capital` | 专业建模Model Hub |
| `/capital/model` | 经营驱动与三表模型 |
| `/capital/valuation` | DCF、SOTP、估值足球场及敏感性 |
| `/capital/comparables` | 上市可比公司筛选与相对估值 |
| `/capital/research` | 中科曙光Equity Research案例 |
| `/capital/versions` | Bear / Base / Bull情景分析 |

## 数据口径

2022A–2024A主要历史数据取自公司2024年年度报告；2025A*收入、净利润、总资产和股东权益取自2025年度业绩快报，尚未经审计。2025分部拆分、经营现金流及2026E–2030E均为AlphaWave模型估计。

本项目用于展示财务建模与行业研究方法，不构成投资建议。

## 技术栈

React 19、TypeScript、Vite、Tailwind CSS、Recharts、React Router。

## 本地运行

```bash
npm install
npm run dev
```

验证生产构建：

```bash
npm run check
```
