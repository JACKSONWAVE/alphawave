import { getAllCodes, getKlineData, getStockInfo } from './mockData';

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
}

export function buildDataFreshness(): DataFreshness[] {
  return getAllCodes().map(code => {
    const kline = getKlineData(code);
    const first = kline[0];
    const last = kline[kline.length - 1];
    const info = getStockInfo(code);
    return {
      code,
      name: info.name,
      days: kline.length,
      firstDate: first?.date || '-',
      lastDate: last?.date || '-',
      isTenYear: kline.length >= 2300,
      isFresh: Boolean(last?.date && last.date >= new Date().toISOString().slice(0, 10)),
    };
  });
}

export function buildRequirementAudit(): SystemAuditItem[] {
  return [
    { id: 1, title: '买卖三角信号开关', status: 'done', detail: '技术分析页已支持手动显示/隐藏，并保存到本地偏好。' },
    { id: 2, title: '指标线段缺口说明', status: 'done', detail: '副图使用 connectNulls，主图均线前 N 日仍会自然缺失，属于指标样本不足。' },
    { id: 3, title: '重大资讯飞书推送', status: 'partial', detail: '已接入资讯雷达 API、关键词分级和飞书推送；稳定新闻源需要在 Vercel 配置 NEWS_FEED_URLS。' },
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
  ];
}

