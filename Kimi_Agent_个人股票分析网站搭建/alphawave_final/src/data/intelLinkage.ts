import { getStockList, type AlertRule, type TradeRecord } from './mockData';
import { etfProfiles } from './etfUniverse';
import { buildHoldingPositions } from './tradeGuard';

export interface LinkageIntelHit {
  title: string;
  code: string;
  name: string;
  scope: '宏观' | '行业' | '个股';
  impact: '利好' | '利空' | '中性';
  severity: '重大' | '关注';
  score: number;
  matched: string[];
  action: string;
}

export interface LinkageIntelTheme {
  keyword: string;
  count: number;
  score: number;
  impact: LinkageIntelHit['impact'];
}

export interface LinkagePayload {
  stance: '进攻' | '均衡' | '防守';
  marketHits: LinkageIntelHit[];
  stockHits: LinkageIntelHit[];
  topThemes: LinkageIntelTheme[];
}

export interface LinkageWatchItem {
  code: string;
  group?: string;
  note?: string;
}

export interface ETFLinkageRow {
  code: string;
  name: string;
  theme: string;
  role: string;
  score: number;
  tone: 'red' | 'green' | 'yellow' | 'blue';
  label: string;
  reason: string;
  keywords: string[];
}

export interface HoldingLinkageRow {
  code: string;
  name: string;
  shares: number;
  score: number;
  label: string;
  tone: 'red' | 'green' | 'yellow' | 'blue';
  action: string;
  reason: string;
}

export interface AlertIdea {
  id: string;
  code: string;
  name: string;
  type: AlertRule['type'];
  price: number;
  label: string;
  reason: string;
  source: '资讯' | 'ETF';
}

export interface IntelLinkageDashboard {
  summary: {
    linkedEtfCount: number;
    holdingHitCount: number;
    alertIdeaCount: number;
    riskCount: number;
    opportunityCount: number;
    posture: string;
  };
  etfRows: ETFLinkageRow[];
  holdingRows: HoldingLinkageRow[];
  alertIdeas: AlertIdea[];
}

const round = (value: number) => +value.toFixed(3);

const themeBuckets = [
  { label: 'AI算力', keys: ['AI', '算力', '服务器', '数据中心', '信创', '通信', '光模块'], etf: ['科技', '通信', '半导体', '芯片', '科创'] },
  { label: '半导体', keys: ['半导体', '芯片', '晶圆', '存储', '封装', '国产替代', '制裁'], etf: ['半导体', '芯片', '材料设备', '科技'] },
  { label: '新能源', keys: ['新能源', '新能源车', '锂电', '电池', '储能', '光伏', '硅料'], etf: ['新能源', '光伏', '创业板'] },
  { label: '黄金避险', keys: ['黄金', '金价', '避险', '美元', '地缘', '冲突'], etf: ['黄金', '商品'] },
  { label: '高股息', keys: ['红利', '高股息', '低波', '防守', '现金流'], etf: ['红利', '低波', '银行'] },
  { label: '金融', keys: ['券商', '成交额', '资本市场', '降准', '降息', '银行', '地产'], etf: ['券商', '银行', '上证50', '宽基', '沪深300'] },
  { label: '宽基情绪', keys: ['上证指数', '创业板', '两市成交', 'PMI', 'CPI', 'PPI', '出口', '汇率'], etf: ['宽基', '上证', '沪深300', '中证500', '创业板'] },
];

function hitText(hit: LinkageIntelHit) {
  return `${hit.title} ${hit.name} ${hit.scope} ${hit.matched.join(' ')} ${hit.action}`;
}

function signedScore(impact: LinkageIntelHit['impact'], score: number) {
  if (impact === '利好') return score;
  if (impact === '利空') return -score;
  return score * 0.18;
}

function hitMatchesText(hit: LinkageIntelHit, text: string) {
  const source = hitText(hit);
  if (hit.matched.some(keyword => keyword && text.includes(keyword))) return true;
  if (source.includes(text)) return true;
  return themeBuckets.some(bucket => (
    bucket.keys.some(key => source.includes(key)) &&
    bucket.etf.some(key => text.includes(key))
  ));
}

function extractKeywords(hits: LinkageIntelHit[], text: string) {
  const keywords = new Set<string>();
  hits.forEach(hit => {
    hit.matched.forEach(keyword => {
      if (keyword && text.includes(keyword)) keywords.add(keyword);
    });
    themeBuckets.forEach(bucket => {
      if (bucket.keys.some(key => hitText(hit).includes(key)) && bucket.etf.some(key => text.includes(key))) {
        keywords.add(bucket.label);
      }
    });
  });
  return Array.from(keywords).slice(0, 4);
}

function etfLabel(score: number) {
  if (score >= 35) return { label: '顺风加权', tone: 'red' as const };
  if (score <= -35) return { label: '逆风降权', tone: 'green' as const };
  if (Math.abs(score) >= 14) return { label: '观察确认', tone: 'yellow' as const };
  return { label: '常规跟踪', tone: 'blue' as const };
}

function buildETFLinkage(payload: LinkagePayload): ETFLinkageRow[] {
  const hits = [...payload.marketHits, ...payload.stockHits];
  return etfProfiles.map(profile => {
    const text = `${profile.name} ${profile.industry} ${profile.theme} ${profile.role} ${profile.strategyNote}`;
    const matchedHits = hits.filter(hit => hitMatchesText(hit, text));
    const themeScore = payload.topThemes.reduce((sum, theme) => {
      const bucketMatch = themeBuckets.some(bucket => bucket.keys.includes(theme.keyword) && bucket.etf.some(key => text.includes(key)));
      const directMatch = text.includes(theme.keyword);
      if (!bucketMatch && !directMatch) return sum;
      return sum + signedScore(theme.impact, theme.score) * 0.45;
    }, 0);
    const score = matchedHits.reduce((sum, hit) => sum + signedScore(hit.impact, hit.score), 0) + themeScore;
    const label = etfLabel(score);
    const keywords = extractKeywords(matchedHits, text);
    return {
      code: profile.code,
      name: profile.name,
      theme: profile.theme,
      role: profile.role,
      score: Math.round(score),
      tone: label.tone,
      label: label.label,
      reason: matchedHits[0]?.action || profile.strategyNote,
      keywords: keywords.length ? keywords : [profile.theme],
    };
  }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 8);
}

function buildHoldingLinkage(payload: LinkagePayload, trades: TradeRecord[]): HoldingLinkageRow[] {
  const stockMap = new Map(getStockList().map(stock => [stock.code, stock]));
  return buildHoldingPositions(trades).map(position => {
    const stock = stockMap.get(position.code);
    const directHits = payload.stockHits.filter(hit => hit.code === position.code);
    const industryHits = payload.stockHits.filter(hit => hit.scope === '行业' && stock?.industry && hitText(hit).includes(stock.industry));
    const macroPenalty = payload.marketHits.reduce((sum, hit) => sum + signedScore(hit.impact, hit.score) * 0.12, 0);
    const score = directHits.reduce((sum, hit) => sum + signedScore(hit.impact, hit.score), 0)
      + industryHits.reduce((sum, hit) => sum + signedScore(hit.impact, hit.score) * 0.45, 0)
      + macroPenalty;
    const tone: HoldingLinkageRow['tone'] = score >= 35 ? 'red' : score <= -35 ? 'green' : Math.abs(score) >= 12 ? 'yellow' : 'blue';
    const label = score >= 35 ? '利好待确认' : score <= -35 ? '风险复核' : Math.abs(score) >= 12 ? '观察加权' : '未明显命中';
    const topHit = directHits[0] || industryHits[0] || payload.marketHits[0];
    return {
      code: position.code,
      name: position.name,
      shares: position.shares,
      score: Math.round(score),
      label,
      tone,
      action: score <= -35 ? '优先核查止损线和减仓预案' : score >= 35 ? '等待价格与量能确认后再加权' : '维持原仓位纪律',
      reason: topHit?.title || '暂无直接资讯命中。',
    };
  }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 6);
}

function alertPrice(code: string, type: AlertRule['type']) {
  const stock = getStockList().find(item => item.code === code);
  const price = stock?.price || 1;
  return round(type === 'above' ? price * 1.025 : price * 0.97);
}

function alertExists(existingAlerts: AlertRule[], code: string, type: AlertRule['type']) {
  return existingAlerts.some(alert => alert.code === code && alert.type === type && alert.enabled);
}

function buildAlertIdeas(payload: LinkagePayload, etfRows: ETFLinkageRow[], existingAlerts: AlertRule[]): AlertIdea[] {
  const stockIdeas = payload.stockHits
    .filter(hit => hit.impact !== '中性' && hit.score >= 28)
    .map(hit => {
      const type: AlertRule['type'] = hit.impact === '利空' ? 'below' : 'above';
      return {
        id: `intel-${hit.code}-${type}`,
        code: hit.code,
        name: hit.name,
        type,
        price: alertPrice(hit.code, type),
        label: hit.impact === '利空' ? '利空防线' : '利好确认线',
        reason: hit.action,
        source: '资讯' as const,
      };
    });
  const etfIdeas = etfRows
    .filter(row => Math.abs(row.score) >= 35)
    .map(row => {
      const type: AlertRule['type'] = row.score < 0 ? 'below' : 'above';
      return {
        id: `intel-${row.code}-${type}`,
        code: row.code,
        name: row.name,
        type,
        price: alertPrice(row.code, type),
        label: row.score < 0 ? 'ETF降权线' : 'ETF确认线',
        reason: row.reason,
        source: 'ETF' as const,
      };
    });

  return [...stockIdeas, ...etfIdeas]
    .filter((idea, index, list) => list.findIndex(item => item.code === idea.code && item.type === idea.type) === index)
    .filter(idea => !alertExists(existingAlerts, idea.code, idea.type))
    .slice(0, 6);
}

export function buildIntelLinkageDashboard(input: {
  payload: LinkagePayload;
  trades: TradeRecord[];
  existingAlerts: AlertRule[];
}): IntelLinkageDashboard {
  const etfRows = buildETFLinkage(input.payload);
  const holdingRows = buildHoldingLinkage(input.payload, input.trades);
  const alertIdeas = buildAlertIdeas(input.payload, etfRows, input.existingAlerts);
  const hits = [...input.payload.marketHits, ...input.payload.stockHits];
  const riskCount = hits.filter(hit => hit.impact === '利空').length;
  const opportunityCount = hits.filter(hit => hit.impact === '利好').length;

  return {
    summary: {
      linkedEtfCount: etfRows.filter(row => Math.abs(row.score) >= 14).length,
      holdingHitCount: holdingRows.filter(row => Math.abs(row.score) >= 12).length,
      alertIdeaCount: alertIdeas.length,
      riskCount,
      opportunityCount,
      posture: riskCount > opportunityCount ? '新闻偏防守' : opportunityCount > riskCount ? '新闻偏进攻' : '新闻中性',
    },
    etfRows,
    holdingRows,
    alertIdeas,
  };
}
