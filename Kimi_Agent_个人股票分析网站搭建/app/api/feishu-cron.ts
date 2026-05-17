import { generateCloseReport, generateMorningReport, generateSignalReport, sendToFeishu } from '../src/data/feishuReports';
import { isTradingDay } from '../src/data/holidays';

type ReportType = 'morning' | 'signal' | 'close';

function parseWatchList(): string[] {
  return (process.env.FEISHU_WATCHLIST || '603019.SH')
    .split(',')
    .map(code => code.trim())
    .filter(Boolean);
}

function getReportType(request: any): ReportType {
  const raw = String(request.query?.type || 'morning');
  if (raw === 'signal' || raw === 'close') return raw;
  return 'morning';
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

  if (!isTradingDay(new Date())) {
    return response.status(200).json({ ok: true, skipped: true, reason: 'not trading day' });
  }

  const type = getReportType(request);
  const watchList = parseWatchList();

  try {
    let message: string | null = null;
    if (type === 'morning') message = await generateMorningReport(watchList);
    if (type === 'signal') message = await generateSignalReport(watchList);
    if (type === 'close') message = await generateCloseReport(watchList);

    if (!message) {
      return response.status(200).json({ ok: true, skipped: true, reason: 'no signal' });
    }

    const sent = await sendToFeishu(webhook, message);
    return response.status(sent ? 200 : 502).json({ ok: sent, type, watchList, sent });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    return response.status(500).json({ ok: false, error: detail });
  }
}
