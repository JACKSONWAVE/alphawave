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
  action: string;
}

const positiveWords = ['中标', '订单', '回购', '增持', '业绩预增', '超预期', '合作', '突破', '国产替代', '算力', 'AI'];
const negativeWords = ['减持', '处罚', '立案', '亏损', '下修', '诉讼', '制裁', '停产', '违约', '退市', '地缘', '冲突'];
const majorWords = ['公告', '业绩', '监管', '重组', '并购', '定增', '合同', '风险', '制裁', '政策'];

function stockKeywords(code: string) {
  const stock = getStockList().find(item => item.code === code);
  return [code.split('.')[0], stock?.name].filter(Boolean) as string[];
}

function scoreNews(item: NewsItem, code: string): ScoredNewsItem | null {
  const text = `${item.title} ${item.source || ''}`;
  const related = stockKeywords(code).some(keyword => text.includes(keyword));
  if (!related) return null;

  const positive = positiveWords.filter(word => text.includes(word)).length;
  const negative = negativeWords.filter(word => text.includes(word)).length;
  const major = majorWords.some(word => text.includes(word));
  const impact = negative > positive ? '利空' : positive > negative ? '利好' : '中性';
  const severity = major || positive + negative >= 2 ? '重大' : '关注';
  const action = impact === '利好'
    ? '先看是否高开冲高回落，放量站稳计划突破线才跟随；未站稳不追高'
    : impact === '利空'
      ? '先降风险，若跌破计划止损位则执行退出；未跌破也不加仓'
      : '先观察价格是否触发既定买卖点，不因单条资讯改变仓位';

  return { ...item, impact, severity, action };
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
    md += `### ${hit.severity}${hit.impact}：${hit.title}\n`;
    md += `来源：${hit.source || '-'}\n\n`;
    md += `策略：${hit.action}\n\n`;
    if (hit.url) md += `${hit.url}\n\n`;
  }
  return md;
}
