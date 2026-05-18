import { generateIntelReport } from '../src/data/intelReports';
import { sendToFeishu } from '../src/data/feishuReports';

function parseList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function isAuthorized(request: any): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers?.authorization || '';
  const querySecret = request.query?.secret;
  return header === `Bearer ${secret}` || querySecret === secret;
}

export default async function handler(request: any, response: any) {
  if (!isAuthorized(request)) {
    return response.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const webhook = process.env.FEISHU_WEBHOOK;
  if (!webhook) {
    return response.status(500).json({ ok: false, error: 'missing FEISHU_WEBHOOK' });
  }

  const watchList = parseList(process.env.FEISHU_WATCHLIST || '603019.SH');
  const feedUrls = parseList(process.env.NEWS_FEED_URLS);
  const message = await generateIntelReport(watchList, feedUrls);

  if (!message) {
    return response.status(200).json({ ok: true, skipped: true, reason: 'no important news' });
  }

  const sent = await sendToFeishu(webhook, message);
  return response.status(sent ? 200 : 502).json({ ok: sent, sent, watchList });
}
