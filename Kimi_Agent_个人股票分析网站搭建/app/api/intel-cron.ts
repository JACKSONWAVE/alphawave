interface NewsItem {
  title: string;
  url?: string;
  source?: string;
  time?: string;
  summary?: string;
}

interface IntelHit extends NewsItem {
  code: string;
  name: string;
  scope: '宏观' | '行业' | '个股';
  impact: '利好' | '利空' | '中性';
  severity: '重大' | '关注';
  score: number;
  matched: string[];
  action: string;
}

interface IntelTheme {
  keyword: string;
  count: number;
  score: number;
  impact: IntelHit['impact'];
}

interface IntelPayload {
  generatedAt: string;
  scanCount: number;
  watchCount: number;
  marketHits: IntelHit[];
  stockHits: IntelHit[];
  topThemes: IntelTheme[];
  stance: '进攻' | '均衡' | '防守';
  riskBudget: string;
  brief: string;
}

const stockNames: Record<string, string> = {
  '603019.SH': '中科曙光',
  '002594.SZ': '比亚迪',
  '600519.SH': '贵州茅台',
  '688981.SH': '中芯国际',
  '300750.SZ': '宁德时代',
  '300059.SZ': '东方财富',
  '601012.SH': '隆基绿能',
  '600900.SH': '长江电力',
  '002230.SZ': '科大讯飞',
  '000977.SZ': '浪潮信息',
  '600036.SH': '招商银行',
  '510210.SH': '上证综指ETF',
  '510300.SH': '沪深300ETF',
  '510050.SH': '上证50ETF',
  '510500.SH': '中证500ETF',
  '159915.SZ': '创业板ETF',
  '588000.SH': '科创50ETF',
  '510880.SH': '红利ETF',
  '512890.SH': '红利低波ETF',
  '518880.SH': '黄金ETF',
  '159934.SZ': '黄金ETF基金',
  '512760.SH': '芯片ETF',
  '512480.SH': '半导体ETF',
  '159995.SZ': '芯片ETF',
  '159327.SZ': '半导体材料设备ETF',
  '515000.SH': '科技ETF',
  '515050.SH': '通信ETF',
  '515790.SH': '光伏ETF',
  '516160.SH': '新能源ETF',
  '512000.SH': '券商ETF',
  '512800.SH': '银行ETF',
  '512660.SH': '军工ETF',
};

const positiveWords = ['中标', '订单', '回购', '增持', '业绩预增', '超预期', '合作', '突破', '国产替代', '算力', 'AI', '扩产', '上调', '创新高', '批准', '降息', '降准', '减税', '补贴', '并购', '重组', '涨价', '供给收缩'];
const negativeWords = ['减持', '处罚', '立案', '亏损', '下修', '诉讼', '制裁', '停产', '违约', '退市', '地缘', '冲突', '禁令', '调查', '暴雷', '关税', '召回', '限产', '砍单', '下调', '流动性收紧', '加息'];
const majorWords = ['公告', '业绩', '监管', '重组', '并购', '定增', '合同', '风险', '制裁', '政策', '交易所', '问询函', '减持计划', '国务院', '央行', '美联储', '商务部', '证监会', '财政部'];
const macroWords = ['A股', '上证指数', '创业板', '两市成交', '成交额', '降准', '降息', '汇率', '人民币', '美元指数', '美联储', '美股', '纳斯达克', '能源', '原油', '黄金', '地缘', '关税', 'CPI', 'PPI', 'PMI', '出口', '贸易'];

const defaultFeedQueries = [
  'A股 重大 利好 利空 财经',
  '中国 证监会 央行 财政部 政策 A股',
  '美联储 利率 美股 原油 黄金 汇率',
  '半导体 AI 算力 新能源汽车 锂电池 光伏 财经',
];

function parseList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseWatchList(request: any): string[] {
  const fromQuery = parseList(request.query?.codes);
  if (fromQuery.length > 0) return fromQuery;
  return parseList(process.env.FEISHU_WATCHLIST || '603019.SH');
}

function isAuthorized(request: any): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.query?.dryRun === '1') return true;
  const header = request.headers?.authorization || '';
  const querySecret = request.query?.secret;
  return header === `Bearer ${secret}` || querySecret === secret;
}

function googleNewsFeed(query: string) {
  const params = new URLSearchParams({
    q: query,
    hl: 'zh-CN',
    gl: 'CN',
    ceid: 'CN:zh-Hans',
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

function defaultFeedUrls() {
  return defaultFeedQueries.map(googleNewsFeed);
}

function themeKeywords(code: string, name: string) {
  const text = `${code}${name}`;
  const themes: string[] = [];
  const add = (words: string[], keys: string[]) => {
    if (keys.some(key => text.includes(key))) themes.push(...words);
  };
  add(['AI', '算力', '信创', '服务器', '数据中心', '国产替代'], ['603019', '000977', '002230', '曙光', '浪潮', '讯飞']);
  add(['半导体', '芯片', '晶圆', '国产替代', '制裁'], ['688981', '中芯', '半导体']);
  add(['ETF', '指数基金', '宽基', '上证指数', '沪深300', '上证50', '中证500'], ['510210', '510300', '510050', '510500', '上证综指ETF', '沪深300ETF', '上证50ETF', '中证500ETF']);
  add(['红利', '高股息', '低波动', '防守'], ['510880', '512890', '红利ETF', '红利低波']);
  add(['黄金', '金价', '避险', '美元', '实际利率'], ['518880', '159934', '黄金ETF']);
  add(['半导体', '芯片', '存储', '长江存储', '长鑫', 'HBM', '国产替代'], ['512760', '512480', '159995', '159327', '芯片ETF', '半导体ETF', '材料设备']);
  add(['科技', 'AI', '数据中心', '通信', '光模块', '算力'], ['515000', '515050', '科技ETF', '通信ETF']);
  add(['新能源车', '锂电', '电池', '储能', '特斯拉'], ['002594', '300750', '比亚迪', '宁德']);
  add(['光伏', '硅料', '组件', '逆变器', '新能源'], ['601012', '隆基', '光伏']);
  add(['白酒', '消费', '提价', '春节', '高端酒'], ['600519', '茅台', '五粮液']);
  add(['券商', '成交额', '并购重组', '资本市场', '印花税'], ['300059', '证券', '东方财富']);
  add(['电力', '煤价', '电价', '绿电', '水电'], ['600900', '电力', '长江电力']);
  add(['银行', '降准', '降息', '息差', '地产'], ['600036', '银行', '招商']);
  return Array.from(new Set(themes));
}

function stockKeywords(code: string) {
  const name = stockNames[code] || code;
  return [code.split('.')[0], name, ...themeKeywords(code, name)].filter(Boolean);
}

function actionFor(impact: IntelHit['impact'], scope: IntelHit['scope']) {
  if (impact === '利好') {
    if (scope === '宏观') return '宏观偏暖时提高观察优先级，但仍等价格触发和量能确认。';
    if (scope === '行业') return '行业利好只提高候选优先级，个股必须放量站稳突破线才跟随。';
    return '个股利好先看是否高开冲高回落，站稳计划突破线再考虑跟随。';
  }
  if (impact === '利空') {
    if (scope === '宏观') return '先降低风险预算，指数放量下跌时保护利润，不主动加仓。';
    if (scope === '行业') return '同板块信号降级，持仓先看止损位和弱支撑，波段仓不加。';
    return '个股利空先降风险，跌破计划止损位则执行退出。';
  }
  return '中性资讯只做提醒，继续按价格触发、技术共振和交易闸门执行。';
}

function scoreMarket(item: NewsItem): IntelHit | null {
  const text = `${item.title} ${item.summary || ''} ${item.source || ''}`;
  const matched = macroWords.filter(word => text.includes(word));
  if (matched.length === 0) return null;
  const positive = positiveWords.filter(word => text.includes(word));
  const negative = negativeWords.filter(word => text.includes(word));
  const major = majorWords.some(word => text.includes(word));
  const impact = negative.length > positive.length ? '利空' : positive.length > negative.length ? '利好' : '中性';
  const score = matched.length * 10 + positive.length * 9 + negative.length * 11 + (major ? 20 : 0);
  if (score < 18) return null;
  return { ...item, code: 'MARKET', name: '市场', scope: '宏观', impact, severity: score >= 36 || major ? '重大' : '关注', score, matched: matched.slice(0, 6), action: actionFor(impact, '宏观') };
}

function scoreStock(item: NewsItem, code: string): IntelHit | null {
  const text = `${item.title} ${item.summary || ''} ${item.source || ''}`;
  const name = stockNames[code] || code;
  const matched = stockKeywords(code).filter(keyword => text.includes(keyword));
  if (matched.length === 0) return null;
  const positive = positiveWords.filter(word => text.includes(word));
  const negative = negativeWords.filter(word => text.includes(word));
  const major = majorWords.some(word => text.includes(word));
  const impact = negative.length > positive.length ? '利空' : positive.length > negative.length ? '利好' : '中性';
  const scope = matched.includes(name) || matched.includes(code.split('.')[0]) ? '个股' : '行业';
  const score = matched.length * 12 + positive.length * 10 + negative.length * 12 + (major ? 18 : 0);
  return { ...item, code, name, scope, impact, severity: score >= 38 || major ? '重大' : '关注', score, matched: matched.slice(0, 5), action: actionFor(impact, scope) };
}

function uniqueItems(items: NewsItem[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.title.replace(/\s+/g, '').slice(0, 90);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueHits(hits: IntelHit[]) {
  const seen = new Set<string>();
  return hits.filter(hit => {
    const key = `${hit.code}:${hit.title.replace(/\s+/g, '').slice(0, 90)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildTopThemes(hits: IntelHit[]): IntelTheme[] {
  const map = new Map<string, { count: number; score: number; positive: number; negative: number }>();
  hits.forEach(hit => {
    hit.matched.forEach(keyword => {
      const row = map.get(keyword) || { count: 0, score: 0, positive: 0, negative: 0 };
      row.count += 1;
      row.score += hit.score;
      if (hit.impact === '利好') row.positive += hit.score;
      if (hit.impact === '利空') row.negative += hit.score;
      map.set(keyword, row);
    });
  });
  return Array.from(map.entries())
    .map(([keyword, row]) => ({
      keyword,
      count: row.count,
      score: row.score,
      impact: row.negative > row.positive ? '利空' : row.positive > row.negative ? '利好' : '中性',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function buildStance(hits: IntelHit[]): Pick<IntelPayload, 'stance' | 'riskBudget' | 'brief'> {
  const marketHits = hits.filter(hit => hit.scope === '宏观');
  const riskScore = hits.filter(hit => hit.impact === '利空').reduce((sum, hit) => sum + hit.score, 0);
  const positiveScore = hits.filter(hit => hit.impact === '利好').reduce((sum, hit) => sum + hit.score, 0);
  const stockRisk = hits.some(hit => hit.scope !== '宏观' && hit.impact === '利空' && hit.score >= 45);
  if (riskScore > positiveScore + 50 || stockRisk) {
    return {
      stance: '防守',
      riskBudget: '总仓位压低，个股只处理已有计划，不追高新开。',
      brief: '利空或个股风险占优，先保护利润和止损线，等价格确认后再恢复进攻。',
    };
  }
  if (positiveScore > riskScore + 45 && marketHits.some(hit => hit.impact === '利好')) {
    return {
      stance: '进攻',
      riskBudget: '可提高候选优先级，但单票仍按计划买区、突破确认和止损执行。',
      brief: '宏观或行业偏暖，适合把强势主题放到观察前排，等量价确认后行动。',
    };
  }
  return {
    stance: '均衡',
    riskBudget: '维持标准仓位，优先执行高置信度信号，弱信号不加仓。',
    brief: '多空信息交织，今天更适合按交易闸门和技术共振筛选，不靠新闻单独下单。',
  };
}

async function fetchFeed(url: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 AlphaWave' } });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      const list = Array.isArray(json) ? json : json?.items || json?.data || [];
      return list.map((item: any) => ({
        title: String(item.title || item.name || item.content || ''),
        url: item.url || item.link,
        source: item.source || item.media || new URL(url).hostname,
        time: item.time || item.date || item.pubDate,
        summary: item.summary || item.description,
      })).filter((item: NewsItem) => item.title);
    } catch {
      return Array.from(text.matchAll(/<item>([\s\S]*?)<\/item>/g)).map(match => {
        const block = match[1];
        const title = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]
          || block.match(/<title>([\s\S]*?)<\/title>/)?.[1]
          || '';
        const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
        const description = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1]
          || block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
          || '';
        const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
        return {
          title: title.replace(/<[^>]+>/g, '').trim(),
          url: link.trim(),
          source: new URL(url).hostname,
          time: pubDate.trim(),
          summary: description.replace(/<[^>]+>/g, '').trim(),
        };
      }).filter(item => item.title);
    }
  } catch {
    return [];
  }
}

async function generateIntelReport(watchList: string[], feedUrls: string[]) {
  const urls = feedUrls.length > 0 ? feedUrls : defaultFeedUrls();
  const items = uniqueItems((await Promise.all(urls.map(fetchFeed))).flat()).slice(0, 160);
  const hits = uniqueHits([
    ...items.map(scoreMarket).filter((item): item is IntelHit => Boolean(item)),
    ...watchList.flatMap(code => items.map(item => scoreStock(item, code)).filter((hit): hit is IntelHit => Boolean(hit))),
  ]).sort((a, b) => b.score - a.score);

  if (hits.length === 0) return null;

  const time = new Date().toLocaleString('zh-CN');
  const marketHits = hits.filter(hit => hit.scope === '宏观').slice(0, 5);
  const stockHits = hits.filter(hit => hit.scope !== '宏观').slice(0, 12);
  const stance = buildStance(hits);
  const payload: IntelPayload = {
    generatedAt: time,
    scanCount: items.length,
    watchCount: watchList.length,
    marketHits,
    stockHits,
    topThemes: buildTopThemes(hits),
    ...stance,
  };

  let md = `## AlphaWave 重大资讯雷达 ${time}\n\n`;
  md += `> 已扫描 ${items.length} 条国内/国际财经资讯，重点映射 ${watchList.length} 只自选股。\n\n`;
  md += `### 交易台结论\n\n`;
  md += `- 当前姿态：${payload.stance}\n`;
  md += `- 风险预算：${payload.riskBudget}\n`;
  md += `- 摘要：${payload.brief}\n\n`;

  if (marketHits.length > 0) {
    md += `### 市场级事件\n\n`;
    for (const hit of marketHits) {
      md += `- **${hit.severity}${hit.impact}｜${hit.score}分** ${hit.title}\n`;
      md += `  关键词：${hit.matched.join('、') || '-'}；策略：${hit.action}\n`;
      if (hit.url) md += `  ${hit.url}\n`;
    }
    md += `\n`;
  }

  md += `### 自选股重点关注\n\n`;
  if (stockHits.length === 0) {
    md += `暂未发现与自选股直接相关的重大新闻。今天优先按价格触发、技术共振和风控闸门执行。\n\n`;
  } else {
    for (const hit of stockHits) {
      md += `#### ${hit.severity}${hit.impact}｜${hit.score}分｜${hit.scope}｜${hit.name}\n`;
      md += `${hit.title}\n\n`;
      md += `来源：${hit.source || '-'}｜匹配：${hit.matched.join('、') || '-'}\n\n`;
      md += `策略：${hit.action}\n\n`;
      if (hit.url) md += `${hit.url}\n\n`;
    }
  }
  return { message: md, payload };
}

async function sendToFeishu(webhook: string, message: string) {
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: { title: { tag: 'plain_text', content: 'AlphaWave 重大资讯雷达' }, template: 'orange' },
          elements: [{ tag: 'div', text: { tag: 'lark_md', content: message } }],
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function handler(request: any, response: any) {
  try {
    if (!isAuthorized(request)) return response.status(401).json({ ok: false, error: 'unauthorized' });

    const watchList = parseWatchList(request);
    const feedUrls = parseList(request.query?.feeds || process.env.NEWS_FEED_URLS);
    const report = await generateIntelReport(watchList, feedUrls);
    if (!report) return response.status(200).json({ ok: true, skipped: true, reason: 'no important news' });
    if (request.query?.dryRun === '1') return response.status(200).json({ ok: true, dryRun: true, watchList, message: report.message, payload: report.payload });

    const webhook = process.env.FEISHU_WEBHOOK;
    if (!webhook) return response.status(500).json({ ok: false, error: 'missing FEISHU_WEBHOOK' });
    const sent = await sendToFeishu(webhook, report.message);
    return response.status(sent ? 200 : 502).json({ ok: sent, sent, watchList });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    return response.status(500).json({ ok: false, error: detail });
  }
}
