import { getCoreCodes, getKlineData, getStockInfo } from './mockData';

export interface SystemAuditItem {
  id: number;
  title: string;
  status: 'done' | 'partial' | 'pending';
  detail: string;
}

export interface DataFreshness {
  code: string;
  name: string;
  days: number;
  firstDate: string;
  lastDate: string;
  isTenYear: boolean;
  isFresh: boolean;
  staleDays: number;
  missingGaps: number;
  abnormalMoves: number;
  zeroVolumeDays: number;
  qualityScore: number;
  status: 'healthy' | 'watch' | 'bad';
  note: string;
}

export interface KlineHealthReport {
  total: number;
  healthyCount: number;
  watchCount: number;
  badCount: number;
  freshCount: number;
  tenYearCount: number;
  latestDate: string;
  staleCount: number;
  avgQualityScore: number;
  status: 'healthy' | 'watch' | 'bad';
  headline: string;
  action: string;
  notes: string[];
  needsBackfill: DataFreshness[];
}

export function buildDataFreshness(): DataFreshness[] {
  const today = new Date();
  return getCoreCodes().map(code => {
    const kline = getKlineData(code);
    const first = kline[0];
    const last = kline[kline.length - 1];
    const info = getStockInfo(code);
    let missingGaps = 0;
    let abnormalMoves = 0;
    let zeroVolumeDays = 0;

    for (let index = 1; index < kline.length; index++) {
      const previous = kline[index - 1];
      const current = kline[index];
      const gapDays = Math.floor((new Date(current.date).getTime() - new Date(previous.date).getTime()) / 86400000);
      if (gapDays > 10) missingGaps += 1;
      const changePct = previous.close ? Math.abs((current.close - previous.close) / previous.close * 100) : 0;
      if (changePct > 25) abnormalMoves += 1;
      if (!current.volume) zeroVolumeDays += 1;
    }

    const lastTime = last?.date ? new Date(last.date).getTime() : 0;
    const staleDays = lastTime ? Math.max(0, Math.floor((today.getTime() - lastTime) / 86400000)) : 999;
    const isTenYear = kline.length >= 2300;
    const isFresh = staleDays <= 3;
    const penalties = (isTenYear ? 0 : 18) + (isFresh ? 0 : Math.min(28, staleDays * 2)) + missingGaps * 8 + abnormalMoves * 4 + zeroVolumeDays * 2;
    const qualityScore = Math.max(0, Math.min(100, 100 - penalties));
    const status = qualityScore >= 82 ? 'healthy' : qualityScore >= 62 ? 'watch' : 'bad';
    const note = [
      isTenYear ? '10年样本' : '样本不足',
      isFresh ? '近期更新' : `滞后${staleDays}天`,
      missingGaps ? `${missingGaps}处长缺口` : '无长缺口',
      abnormalMoves ? `${abnormalMoves}处异常波动` : '波动正常',
    ].join(' / ');

    return {
      code,
      name: info.name,
      days: kline.length,
      firstDate: first?.date || '-',
      lastDate: last?.date || '-',
      isTenYear,
      isFresh,
      staleDays,
      missingGaps,
      abnormalMoves,
      zeroVolumeDays,
      qualityScore,
      status,
      note,
    };
  });
}

export function buildKlineHealthReport(items: DataFreshness[] = buildDataFreshness()): KlineHealthReport {
  const total = items.length;
  const healthyCount = items.filter(item => item.status === 'healthy').length;
  const watchCount = items.filter(item => item.status === 'watch').length;
  const badCount = items.filter(item => item.status === 'bad').length;
  const freshCount = items.filter(item => item.isFresh).length;
  const tenYearCount = items.filter(item => item.isTenYear).length;
  const latestDate = items
    .map(item => item.lastDate)
    .filter(date => date && date !== '-')
    .sort((a, b) => b.localeCompare(a))[0] || '-';
  const needsBackfill = items
    .filter(item => !item.isFresh || item.status !== 'healthy')
    .sort((a, b) => b.staleDays - a.staleDays || a.qualityScore - b.qualityScore)
    .slice(0, 6);
  const staleCount = items.filter(item => !item.isFresh).length;
  const avgQualityScore = total ? Math.round(items.reduce((sum, item) => sum + item.qualityScore, 0) / total) : 0;
  const status: KlineHealthReport['status'] = badCount > 0 || staleCount > Math.max(2, total * 0.2)
    ? 'bad'
    : watchCount > 0 || staleCount > 0
      ? 'watch'
      : 'healthy';
  const headline = status === 'healthy'
    ? `核心K线已更新到 ${latestDate}，可作为今日候选排序底座。`
    : status === 'watch'
      ? `核心K线最新到 ${latestDate}，仍有 ${staleCount} 只需要巡检。`
      : `数据健康存在风险，${badCount} 只质量偏低，先补齐再看策略池。`;
  const action = needsBackfill.length
    ? `建议运行 data:backfill 补齐 ${needsBackfill.map(item => item.code).join(', ')}`
    : '数据健康，无需补齐；下一步观察候选池换血和信号胜率。';

  return {
    total,
    healthyCount,
    watchCount,
    badCount,
    freshCount,
    tenYearCount,
    latestDate,
    staleCount,
    avgQualityScore,
    status,
    headline,
    action,
    notes: [
      `10年样本 ${tenYearCount}/${total}，最新交易日 ${latestDate}。`,
      `健康 ${healthyCount}，观察 ${watchCount}，异常 ${badCount}，平均质量分 ${avgQualityScore}。`,
      needsBackfill.length ? `优先补齐：${needsBackfill.slice(0, 3).map(item => `${item.name}${item.staleDays}天`).join('、')}` : '候选池不会因为K线陈旧被降权。',
    ],
    needsBackfill,
  };
}

export function buildRequirementAudit(): SystemAuditItem[] {
  return [
    { id: 1, title: '买卖三角信号开关', status: 'done', detail: '技术分析页已支持手动显示/隐藏，并保存到本地偏好。' },
    { id: 2, title: '指标线段缺口说明', status: 'done', detail: '副图使用 connectNulls，主图均线前 N 日仍会自然缺失，属于指标样本不足。' },
    { id: 3, title: '重大资讯飞书推送', status: 'partial', detail: '已接入结构化资讯雷达、关键词分级、交易姿态、飞书推送；稳定新闻源需要在 Vercel 配置 NEWS_FEED_URLS。' },
    { id: 4, title: '行业趋势监控', status: 'done', detail: '大盘与行业雷达已纳入行业强弱、风险预算和信号降级逻辑。' },
    { id: 5, title: '中期稳健交易习惯', status: 'done', detail: '策略闸门区分底仓、波段仓和激进追高小仓试错。' },
    { id: 6, title: '10 年历史数据', status: 'partial', detail: '已提供 10 年回填脚本并补齐核心股票；新增股票需要跑 data:backfill 自动写入。' },
    { id: 7, title: '回测区与策略胜率', status: 'done', detail: '趋势回踩、放量突破、超跌反弹、MACD 低位金叉已统一回测并排序。' },
    { id: 8, title: '价格三位小数', status: 'done', detail: '关键价格展示统一走 formatPrice，保留三位小数。' },
    { id: 9, title: '专业化前端重构', status: 'done', detail: '首页重做为交易驾驶舱，分析页重做为 K 线终端与策略面板。' },
    { id: 10, title: 'Webhook 隐藏', status: 'done', detail: '飞书地址输入后默认密码态展示，推荐生产环境只放 Vercel 环境变量。' },
    { id: 11, title: '量化方案落地', status: 'partial', detail: '已具备策略回测、交易闸门和风控排序；还未接入实盘下单和组合级资金曲线。' },
    { id: 12, title: '大盘/行业/宏观联动', status: 'done', detail: '市场温度、行业强弱、成交过热和宏观风险已进入交易建议。' },
    { id: 13, title: '蜡烛图与实时更新', status: 'done', detail: '主图已切为专业蜡烛图，并把实时行情合并进当日 K 线。' },
    { id: 14, title: '分时与日内策略', status: 'done', detail: '分时周期已接入腾讯分钟数据，并输出日内波段策略。' },
    { id: 15, title: '资金结构与平均成本', status: 'done', detail: '分析页和首页已接入机构/散户资金估算、日内均价成本、20日成本、获利筹码和压力盘。' },
  ];
}
