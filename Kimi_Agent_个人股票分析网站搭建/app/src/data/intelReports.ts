import { getStockList } from './mockData';

export interface NewsItem {
  title: string;
  url?: string;
  source?: string;
  time?: string;
  summary?: string;
}

interface ScoredNewsItem extends NewsItem {
  impact: '利好' | '利空' | '中性';
  severity: '重大' | '关注';
  score: number;
  code: string;
  name: string;
  industry: string;
  scope: '个股' | '行业' | '宏观';
  matched: string[];
  action: string;
}

const positiveWords = ['中标', '订单', '回购', '增持', '业绩预增', '超预期', '合作', '突破', '国产替代', '算力', 'AI', '扩产', '上调', '创新高', '批准', '降息', '降准', '减税', '补贴', '并购', '重组', '涨价', '供给收缩'];
const negativeWords = ['减持', '处罚', '立案', '亏损', '下修', '诉讼', '制裁', '停产', '违约', '退市', '地缘', '冲突', '禁令', '调查', '暴雷', '关税', '召回', '限产', '砍单', '下调', '流动性收紧', '加息'];
const majorWords = ['公告', '业绩', '监管', '重组', '并购', '定增', '合同', '风险', '制裁', '政策', '交易所', '问询函', '减持计划', '国务院', '央行', '美联储', '商务部', '证监会', '财政部'];
const macroWords = ['上证指数', '创业板', '两市成交', '成交额', '降准', '降息', '汇率', '人民币', '美元指数', '美联储', '美股', '纳斯达克', '能源', '原油', '黄金', '地缘', '关税', 'CPI', 'PPI', 'PMI', '出口', '贸易'];

const defaultFeedQueries = [
  'A股 重大 利好 利空 财经',
  '中国 证监会 央行 财政部 政策 A股',
  '美联储 利率 美股 原油 黄金 汇率',
  '半导体 AI 算力 新能源汽车 锂电池 光伏 财经',
];

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

function stockKeywords(code: string) {
  const stock = getStockList().find(item => item.code === code);
  return [code.split('.')[0], stock?.name, stock?.industry, ...themeKeywords(stock?.name || '', stock?.industry || '')]
    .filter(Boolean)
    .filter(keyword => keyword !== '未分类') as string[];
}

function themeKeywords(name: string, industry: string) {
  const text = `${name}${industry}`;
  const themes: string[] = [];
  const add = (words: string[], keys: string[]) => {
    if (keys.some(key => text.includes(key))) themes.push(...words);
  };
  add(['AI', '算力', '信创', '服务器', '数据中心', '国产替代'], ['曙光', '浪潮', '紫光', '寒武纪', '服务器', '软件', '计算机']);
  add(['半导体', '芯片', '晶圆', '国产替代', '制裁'], ['中芯', '半导体', '芯片', '微电子', '兆易']);
  add(['新能源车', '锂电', '电池', '储能', '特斯拉'], ['比亚迪', '宁德', '锂', '电池', '汽车']);
  add(['光伏', '硅料', '组件', '逆变器', '新能源'], ['隆基', '阳光电源', '通威', '晶澳', '光伏']);
  add(['白酒', '消费', '提价', '春节', '高端酒'], ['茅台', '五粮液', '泸州', '酒']);
  add(['券商', '成交额', '并购重组', '资本市场', '印花税'], ['证券', '东方财富', '券商']);
  add(['黄金', '金价', '避险', '美元', '地缘'], ['黄金', '赤峰', '紫金', '银泰']);
  add(['原油', '油价', 'OPEC', '能源'], ['石化', '石油', '海油']);
  add(['电力', '煤价', '电价', '绿电', '水电'], ['电力', '华能', '华电', '长江电力']);
  add(['银行', '降准', '降息', '息差', '地产'], ['银行', '招商', '平安银行']);
  return Array.from(new Set(themes));
}

function uniqueItems(items: NewsItem[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.title.replace(/\s+/g, '').slice(0, 80);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scoreNews(item: NewsItem, code: string): ScoredNewsItem | null {
  const text = `${item.title} ${item.summary || ''} ${item.source || ''}`;
  const stock = getStockList().find(row => row.code === code);
  const keywords = stockKeywords(code);
  const matched = keywords.filter(keyword => text.includes(keyword));
  const relatedKeyword = matched[0];
  const isMacro = macroWords.some(word => text.includes(word));
  const related = Boolean(relatedKeyword);
  if (!related) return null;

  const positive = positiveWords.filter(word => text.includes(word));
  const negative = negativeWords.filter(word => text.includes(word));
  const major = majorWords.some(word => text.includes(word));
  const scope: ScoredNewsItem['scope'] = relatedKeyword === stock?.industry ? '行业' : isMacro && !relatedKeyword ? '宏观' : '个股';
  const impact = negative.length > positive.length ? '利空' : positive.length > negative.length ? '利好' : '中性';
  const score = matched.length * 12 + positive.length * 10 + negative.length * 12 + (major ? 18 : 0) + (isMacro ? 8 : 0);
  const severity = score >= 38 || major || positive.length + negative.length >= 2 ? '重大' : '关注';
  const action = buildAction(impact, scope);

  return {
    ...item,
    code,
    name: stock?.name || code,
    industry: stock?.industry || '未知行业',
    impact,
    severity,
    score,
    scope,
    matched: matched.slice(0, 5),
    action,
  };
}

function scoreMarketNews(item: NewsItem): ScoredNewsItem | null {
  const text = `${item.title} ${item.summary || ''} ${item.source || ''}`;
  const matched = macroWords.filter(word => text.includes(word));
  if (matched.length === 0) return null;
  const positive = positiveWords.filter(word => text.includes(word));
  const negative = negativeWords.filter(word => text.includes(word));
  const major = majorWords.some(word => text.includes(word));
  const impact = negative.length > positive.length ? '利空' : positive.length > negative.length ? '利好' : '中性';
  const score = matched.length * 10 + positive.length * 9 + negative.length * 11 + (major ? 20 : 0);
  if (score < 18) return null;
  return {
    ...item,
    code: 'MARKET',
    name: '市场',
    industry: '宏观',
    impact,
    severity: score >= 36 || major ? '重大' : '关注',
    score,
    scope: '宏观',
    matched: matched.slice(0, 6),
    action: buildAction(impact, '宏观'),
  };
}

function buildAction(impact: ScoredNewsItem['impact'], scope: ScoredNewsItem['scope']) {
  if (impact === '利好') {
    if (scope === '行业') return '行业利好只提高观察优先级，必须等个股放量站稳突破线；高开冲高回落不追。';
    if (scope === '宏观') return '宏观偏暖时可放宽波段仓，但仍按计划买区和止损执行，不因指数情绪追满仓。';
    return '个股利好先看是否高开冲高回落，放量站稳计划突破线才跟随；未站稳不追高。';
  }
  if (impact === '利空') {
    if (scope === '行业') return '行业利空下调所有同板块信号等级，持仓先看止损位和弱支撑，波段仓不加仓。';
    if (scope === '宏观') return '宏观冲击先降低风险预算，若指数放量下跌或能源/地缘风险升温，优先保护利润。';
    return '个股利空先降风险，若跌破计划止损位则执行退出；未跌破也不加仓。';
  }
  return '中性资讯只做提醒，继续按价格触发、行业强弱和交易闸门执行。';
}

async function fetchFeed(url: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url);
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
      const xmlItems = Array.from(text.matchAll(/<item>([\s\S]*?)<\/item>/g)).map(match => {
        const block = match[1];
        const rawTitle = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]
          || block.match(/<title>([\s\S]*?)<\/title>/)?.[1]
          || '';
        const rawLink = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
        const rawDesc = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1]
          || block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
          || '';
        const rawDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
        return {
          title: rawTitle.replace(/<[^>]+>/g, '').trim(),
          url: rawLink.trim(),
          source: new URL(url).hostname,
          time: rawDate.trim(),
          summary: rawDesc.replace(/<[^>]+>/g, '').trim(),
        };
      }).filter(item => item.title);
      if (xmlItems.length > 0) return xmlItems;
      return text.split('\n').map(line => ({ title: line.trim(), source: new URL(url).hostname })).filter(item => item.title);
    }
  } catch {
    return [];
  }
}

export async function generateIntelReport(watchList: string[], feedUrls: string[]): Promise<string | null> {
  const urls = feedUrls.length > 0 ? feedUrls : defaultFeedUrls();
  const items = uniqueItems((await Promise.all(urls.map(fetchFeed))).flat()).slice(0, 160);
  const marketHits = items.map(scoreMarketNews).filter((item): item is ScoredNewsItem => Boolean(item));
  const stockHits = watchList.flatMap(code => items.map(item => scoreNews(item, code)).filter((item): item is ScoredNewsItem => Boolean(item)));
  const hits = [...marketHits, ...stockHits]
    .sort((a, b) => b.score - a.score)
    .filter((hit, index, list) => list.findIndex(item => item.title === hit.title && item.code === hit.code) === index);
  if (hits.length === 0) return null;

  const time = new Date().toLocaleString('zh-CN');
  let md = `## AlphaWave 重大资讯雷达 ${time}\n\n`;
  md += `> 已扫描 ${items.length} 条国内/国际财经资讯，重点映射 ${watchList.length} 只自选股。\n\n`;

  const marketTop = hits.filter(hit => hit.scope === '宏观').slice(0, 5);
  if (marketTop.length > 0) {
    md += `### 市场级事件\n\n`;
    for (const hit of marketTop) {
      md += `- **${hit.severity}${hit.impact}｜${hit.score}分** ${hit.title}\n`;
      md += `  关键词：${hit.matched.join('、') || '-'}；策略：${hit.action}\n`;
      if (hit.url) md += `  ${hit.url}\n`;
    }
    md += `\n`;
  }

  const stockTop = hits.filter(hit => hit.scope !== '宏观').slice(0, 12);
  if (stockTop.length > 0) {
    md += `### 自选股重点关注\n\n`;
  }
  for (const hit of stockTop) {
    md += `#### ${hit.severity}${hit.impact}｜${hit.score}分｜${hit.scope}｜${hit.name}\n`;
    md += `${hit.title}\n\n`;
    md += `来源：${hit.source || '-'}｜匹配：${hit.matched.join('、') || '-'}｜行业：${hit.industry}\n\n`;
    md += `策略：${hit.action}\n\n`;
    if (hit.url) md += `${hit.url}\n\n`;
  }

  if (stockTop.length === 0) {
    md += `### 自选股重点关注\n\n`;
    md += `暂未发现与自选股直接相关的重大新闻。今天优先按价格触发、技术共振和风控闸门执行。\n\n`;
  }

  return md;
}
