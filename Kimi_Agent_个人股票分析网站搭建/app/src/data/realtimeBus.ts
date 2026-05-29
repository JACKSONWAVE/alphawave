import {
  fetchRealtimeQuotes,
  getMarketPhase,
  getNextSessionHint,
  getSmartInterval,
  isMarketOpen,
  isTradingDay,
  type RealtimeQuote,
} from './realtimeApi';
import { getKlineData, getStockInfo, type AlertRule } from './mockData';
import { mergeRealtimeQuoteIntoKline } from './realtimeKline';
import { buildTechnicalSignalReport, type TechnicalSignal } from './technicalSignals';

export interface RealtimeSnapshot {
  quotes: RealtimeQuote[];
  loading: boolean;
  error: string | null;
  lastUpdate: number;
  countdown: number;
  interval: number;
  phase: string;
  nextHint: string;
  marketOpen: boolean;
  tradingDay: boolean;
  isPaused: boolean;
}

type Listener = (snapshot: RealtimeSnapshot) => void;

const listeners = new Map<Listener, Set<string>>();
const quoteCache = new Map<string, RealtimeQuote>();
const firedAlertIds = new Set<string>();
const firedTechnicalSignalIds = new Set<string>();
let cachedQuoteList: RealtimeQuote[] = [];

let loading = false;
let error: string | null = null;
let lastUpdate = 0;
let countdown = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let countdownTimer: ReturnType<typeof setInterval> | null = null;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function getRequestedCodes() {
  const codes = new Set<string>();
  for (const listenerCodes of listeners.values()) {
    if (listenerCodes.size === 0) return [];
    listenerCodes.forEach(code => codes.add(code));
  }
  return Array.from(codes);
}

function getSnapshot(): RealtimeSnapshot {
  const interval = getSmartInterval();
  return {
    quotes: cachedQuoteList,
    loading,
    error,
    lastUpdate,
    countdown: interval === 0 ? 0 : countdown,
    interval,
    phase: getMarketPhase(),
    nextHint: getNextSessionHint(),
    marketOpen: isMarketOpen(),
    tradingDay: isTradingDay(),
    isPaused: interval === 0,
  };
}

function notify() {
  const snapshot = getSnapshot();
  listeners.forEach((codes, listener) => {
    if (codes.size === 0) {
      listener(snapshot);
      return;
    }
    listener({
      ...snapshot,
      quotes: snapshot.quotes.filter(quote => codes.has(quote.code)),
    });
  });
}

function dispatchLocalEvent(name: string, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function getSignalHistoryKey() {
  return 'alphawave_signal_alert_history';
}

function rememberTechnicalSignal(code: string, name: string, signal: TechnicalSignal) {
  const next = {
    id: `${code}-${signal.date}-${signal.type}-${signal.score}`,
    code,
    name,
    type: signal.type,
    title: signal.title,
    score: signal.score,
    price: signal.price,
    date: signal.date,
    reason: signal.reason,
    action: signal.action,
    firedAt: Date.now(),
  };
  const history = readJson<typeof next[]>(getSignalHistoryKey(), []);
  localStorage.setItem(getSignalHistoryKey(), JSON.stringify([next, ...history.filter(item => item.id !== next.id)].slice(0, 80)));
  return next;
}

async function sendFeishuAlert(rule: AlertRule, quote: RealtimeQuote) {
  const config = readJson<{ webhook?: string; watchList?: string[] } | null>('feishu_config', null);
  if (!config?.webhook) return;

  const watched = !config.watchList?.length || config.watchList.includes(rule.code);
  if (!watched) return;

  const direction = rule.type === 'above' ? '突破上方预警价' : '跌破下方预警价';
  const message = [
    '## AlphaWave 实时价格预警',
    '',
    `**${rule.name} (${rule.code})** ${direction} ${rule.price}`,
    '',
    `当前价：${quote.price}`,
    `涨跌幅：${quote.changePct}%`,
    `触发时间：${quote.time || new Date().toLocaleString('zh-CN')}`,
  ].join('\n');

  try {
    await fetch(config.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: { title: { tag: 'plain_text', content: 'AlphaWave 实时价格预警' }, template: 'red' },
          elements: [{ tag: 'div', text: { tag: 'lark_md', content: message } }],
        },
      }),
    });
  } catch {
    // Feishu failures should not break the market data loop.
  }
}

async function sendFeishuTechnicalSignal(code: string, name: string, signal: TechnicalSignal, quote: RealtimeQuote) {
  const config = readJson<{ webhook?: string; watchList?: string[] } | null>('feishu_config', null);
  if (!config?.webhook) return;

  const watched = !config.watchList?.length || config.watchList.includes(code);
  if (!watched) return;

  const template = signal.type === 'buy' ? 'red' : 'green';
  const message = [
    '## AlphaWave 技术共振信号',
    '',
    `**${name} (${code})** ${signal.title}`,
    '',
    `信号分：${signal.score}`,
    `信号价：${signal.price}`,
    `实时价：${quote.price}`,
    `依据：${signal.reason}`,
    `动作：${signal.action}`,
    `触发时间：${quote.time || new Date().toLocaleString('zh-CN')}`,
  ].join('\n');

  try {
    await fetch(config.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: { title: { tag: 'plain_text', content: 'AlphaWave 技术共振信号' }, template },
          elements: [{ tag: 'div', text: { tag: 'lark_md', content: message } }],
        },
      }),
    });
  } catch {
    // Feishu failures should not break the market data loop.
  }
}

function evaluateAlerts(quotes: RealtimeQuote[]) {
  const alerts = readJson<AlertRule[]>('alerts', []);
  if (alerts.length === 0) return;

  const quoteMap = new Map(quotes.map(quote => [quote.code, quote]));
  alerts.forEach(rule => {
    if (!rule.enabled) {
      firedAlertIds.delete(rule.id);
      return;
    }
    const quote = quoteMap.get(rule.code) || quoteCache.get(rule.code);
    if (!quote) return;

    const triggered = rule.type === 'above' ? quote.price >= rule.price : quote.price <= rule.price;
    if (!triggered) {
      firedAlertIds.delete(rule.id);
      return;
    }

    if (firedAlertIds.has(rule.id)) return;
    firedAlertIds.add(rule.id);
    dispatchLocalEvent('alphawave:alert-fired', { rule, quote });
    void sendFeishuAlert(rule, quote);
  });
}

function evaluateTechnicalSignals(quotes: RealtimeQuote[]) {
  quotes.forEach(quote => {
    const kline = mergeRealtimeQuoteIntoKline(getKlineData(quote.code), quote);
    if (kline.length < 80) return;

    const report = buildTechnicalSignalReport(kline);
    const latestDate = kline[kline.length - 1]?.date;
    const signal = [...report.signals].reverse().find(item => item.date === latestDate);
    if (!signal || signal.score < 55) return;

    const key = `${quote.code}-${signal.date}-${signal.type}-${signal.score}`;
    if (firedTechnicalSignalIds.has(key)) return;

    firedTechnicalSignalIds.add(key);
    const info = getStockInfo(quote.code);
    const record = rememberTechnicalSignal(quote.code, info.name, signal);
    dispatchLocalEvent('alphawave:technical-signal-fired', { record, signal, quote });
    void sendFeishuTechnicalSignal(quote.code, info.name, signal, quote);
  });
}

async function refreshNow() {
  if (loading) return;
  loading = true;
  error = null;
  notify();

  try {
    const requestedCodes = getRequestedCodes();
    const data = await fetchRealtimeQuotes(requestedCodes.length ? requestedCodes : undefined);
    data.forEach(quote => quoteCache.set(quote.code, quote));
    cachedQuoteList = Array.from(quoteCache.values());
    lastUpdate = Date.now();
    countdown = getSmartInterval();
    evaluateAlerts(data);
    evaluateTechnicalSignals(data);
  } catch {
    error = 'fetch failed';
  } finally {
    loading = false;
    notify();
  }
}

function scheduleNext() {
  if (timer) clearTimeout(timer);
  const interval = getSmartInterval();
  countdown = interval;
  notify();

  if (interval === 0) {
    timer = setTimeout(runLoop, 60000);
    return;
  }

  timer = setTimeout(runLoop, interval * 1000);
}

async function runLoop() {
  const interval = getSmartInterval();
  if (interval > 0) await refreshNow();
  scheduleNext();
}

function ensureStarted() {
  if (timer || countdownTimer) return;

  countdownTimer = setInterval(() => {
    const interval = getSmartInterval();
    if (interval > 0 && countdown <= 0 && !loading) {
      void refreshNow().finally(scheduleNext);
      return;
    }
    countdown = interval === 0 ? 0 : Math.max(0, countdown - 1);
    notify();
  }, 1000);

  void refreshNow().finally(scheduleNext);
}

function stopIfIdle() {
  if (listeners.size > 0) return;
  if (timer) clearTimeout(timer);
  if (countdownTimer) clearInterval(countdownTimer);
  timer = null;
  countdownTimer = null;
}

export function subscribeRealtime(codes: string[] | undefined, listener: Listener) {
  listeners.set(listener, new Set(codes || []));
  listener(getSnapshot());
  ensureStarted();

  return () => {
    listeners.delete(listener);
    stopIfIdle();
  };
}

export function refreshRealtimeBus() {
  void refreshNow().finally(scheduleNext);
}

export function getRealtimeSnapshot() {
  return getSnapshot();
}

if (typeof window !== 'undefined') {
  window.addEventListener('alphawave:settings-changed', () => {
    scheduleNext();
  });
  window.addEventListener('alphawave:alerts-changed', () => {
    evaluateAlerts(Array.from(quoteCache.values()));
    notify();
  });
}
