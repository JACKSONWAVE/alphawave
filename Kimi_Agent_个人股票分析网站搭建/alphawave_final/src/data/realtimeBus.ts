import {
  fetchRealtimeQuotes,
  getMarketPhase,
  getNextSessionHint,
  getSmartInterval,
  isMarketOpen,
  isTradingDay,
  type RealtimeQuote,
} from './realtimeApi';
import type { AlertRule } from './mockData';

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
    quotes: Array.from(quoteCache.values()),
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

async function sendFeishuAlert(rule: AlertRule, quote: RealtimeQuote) {
  const config = readJson<{ webhook?: string; watchList?: string[] } | null>('feishu_config', null);
  if (!config?.webhook) return;

  const watched = !config.watchList?.length || config.watchList.includes(rule.code);
  if (!watched) return;

  const direction = rule.type === 'above' ? '突破' : '跌破';
  const message = [
    `## AlphaWave 实时预警`,
    ``,
    `**${rule.name} (${rule.code})** 已${direction} ${rule.price}`,
    ``,
    `当前价：${quote.price}`,
    `涨跌幅：${quote.changePct}%`,
    `时间：${quote.time || new Date().toLocaleString('zh-CN')}`,
  ].join('\n');

  try {
    await fetch(config.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: { title: { tag: 'plain_text', content: 'AlphaWave 实时预警' }, template: 'red' },
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
    const detail = { rule, quote };
    dispatchLocalEvent('alphawave:alert-fired', detail);
    void sendFeishuAlert(rule, quote);
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
    lastUpdate = Date.now();
    countdown = getSmartInterval();
    evaluateAlerts(data);
  } catch {
    error = '获取失败';
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
