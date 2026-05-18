import { getStockList } from './mockData';

export interface NewsItem {
  title: string;
  url?: string;
  source?: string;
  time?: string;
}

interface ScoredNewsItem extends NewsItem {
  impact: '利好' | '利空' | '中性';
  severity: '重大' | '关注';
  code: string;
  name: string;
  industry: string;
  scope: '个股' | '行业' | '宏观';
  action: string;
}

const positiveWords = ['中标', '订单', '回购', '增持', '业绩预增', '超预期', '合作', '突破', '国产替代', '算力', 'AI', '扩产', '上调', '创新高'];
const negativeWords = ['减持', '处罚', '立案', '亏损', '下修', '诉讼', '制裁', '停产', '违约', '退市', '地缘', '冲突', '禁令', '调查', '暴雷'];
const majorWords = ['公告', '业绩', '监管', '重组', '并购', '定增', '合同', '风险', '制裁', '政策', '交易所', '问询函', '减持计划'];
const macroWords = ['上证指数', '创业板', '两市成交', '成交额', '降准', '降息', '汇率', '美联储', '能源', '原油', '地缘', '美伊', '关税'];

function stockKeywords(code: string) {
  const stock = getStockList().find(item => item.code === code);
  return [code.split('.')[0], stock?.name, stock?.industry].filter(Boolean) as string[];
}

function scoreNews(item: NewsItem, code: string): ScoredNewsItem | null {
  const text = `${item.title} ${item.source || ''}`;
  const stock = getStockList().find(row => row.code === code);
  const keywords = stockKeywords(code);
  const relatedKeyword = keywords.find(keyword => text.includes(keyword));
  const isMacro = macroWords.some(word => text.includes(word));
  const related = Boolean(relatedKeyword || isMacro);
  if (!related) return null;

  const positive = positiveWords.filter(word => text.includes(word)).length;
  const negative = negativeWords.filter(word => text.includes(word)).length;
  const major = majorWords.some(word => text.includes(word));
  const scope: ScoredNewsItem['scope'] = relatedKeyword === stock?.industry ? '行业' : isMacro && !relatedKeyword ? '宏观' : '个股';
  const impact = negative > positive ? '利空' : positive > negative ? '利好' : '中性';
  const severity = major || positive + negative >= 2 ? '重大' : '关注';
  const action = buildAction(impact, scope);

  return {
    ...item,
    code,
    name: stock?.name || code,
    industry: stock?.industry || '未知行业',
    impact,
    severity,
    scope,
    action,
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
      })).filter((item: NewsItem) => item.title);
    } catch {
      const xmlItems = Array.from(text.matchAll(/<item>([\s\S]*?)<\/item>/g)).map(match => {
        const block = match[1];
        const rawTitle = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]
          || block.match(/<title>([\s\S]*?)<\/title>/)?.[1]
          || '';
        const rawLink = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
        return { title: rawTitle.replace(/<[^>]+>/g, '').trim(), url: rawLink.trim(), source: new URL(url).hostname };
      }).filter(item => item.title);
      if (xmlItems.length > 0) return xmlItems;
      return text.split('\n').map(line => ({ title: line.trim(), source: new URL(url).hostname })).filter(item => item.title);
    }
  } catch {
    return [];
  }
}

export async function generateIntelReport(watchList: string[], feedUrls: string[]): Promise<string | null> {
  if (feedUrls.length === 0) {
    return [
      '## AlphaWave 资讯雷达待配置',
      '',
      '已内置重大利好/利空识别逻辑。请在 Vercel 环境变量 `NEWS_FEED_URLS` 配置可访问的资讯源地址，多个地址用英文逗号分隔。',
      '建议资讯源接入同花顺、东方财富、交易所公告或你自己的新闻聚合接口。',
    ].join('\n');
  }

  const items = (await Promise.all(feedUrls.map(fetchFeed))).flat();
  const hits = watchList.flatMap(code => items.map(item => scoreNews(item, code)).filter((item): item is ScoredNewsItem => Boolean(item)));
  if (hits.length === 0) return null;

  const time = new Date().toLocaleString('zh-CN');
  let md = `## AlphaWave 重大资讯雷达 ${time}\n\n`;
  for (const hit of hits.slice(0, 12)) {
    md += `### ${hit.severity}${hit.impact}｜${hit.scope}｜${hit.name}\n`;
    md += `${hit.title}\n\n`;
    md += `来源：${hit.source || '-'}｜行业：${hit.industry}\n\n`;
    md += `策略：${hit.action}\n\n`;
    if (hit.url) md += `${hit.url}\n\n`;
  }
  return md;
}
