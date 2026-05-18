import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tsPath = resolve(root, 'src/assets/data/stockData.ts');
const jsonPath = resolve(root, 'src/assets/data/stockData.json');

function toSecId(code) {
  const [num, market] = code.split('.');
  if (market === 'SH') return `1.${num}`;
  if (market === 'SZ') return `0.${num}`;
  if (market === 'BJ') return `0.${num}`;
  return null;
}

function tenYearsAgo() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 10);
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

async function fetchKline(code) {
  const secid = toSecId(code);
  if (!secid) return null;

  const params = new URLSearchParams({
    secid,
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    klt: '101',
    fqt: '1',
    beg: tenYearsAgo(),
    end: '20500101',
  });

  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?${params.toString()}`;
  const res = await fetch(url, { headers: { Referer: 'https://quote.eastmoney.com/' } });
  if (!res.ok) throw new Error(`${code} ${res.status}`);
  const json = await res.json();
  const rows = json?.data?.klines || [];
  return rows.map((row) => {
    const [date, open, close, high, low, volume, amount] = row.split(',');
    return {
      date,
      open: +(+open).toFixed(3),
      high: +(+high).toFixed(3),
      low: +(+low).toFixed(3),
      close: +(+close).toFixed(3),
      volume: +volume || 0,
      amount: +((+amount || 0) / 10000).toFixed(0),
    };
  });
}

function parseStockData(source) {
  const marker = 'export const stockData =';
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('stockData export not found');
  const jsonLike = source.slice(start + marker.length).replace(/;\s*$/, '').trim();
  return Function(`"use strict"; return (${jsonLike});`)();
}

async function main() {
  const source = await readFile(tsPath, 'utf8');
  const stockData = parseStockData(source);
  const codes = Object.keys(stockData.stocks);

  for (const code of codes) {
    const kline = await fetchKline(code);
    if (!kline || kline.length === 0) {
      console.log(`skip ${code}`);
      continue;
    }
    stockData.stocks[code].kline = kline;
    const latest = kline[kline.length - 1];
    const prev = kline[kline.length - 2] || latest;
    stockData.stocks[code].latest = {
      ...(stockData.stocks[code].latest || {}),
      price: latest.close,
      change: +(latest.close - prev.close).toFixed(3),
      changePct: prev.close ? +((latest.close - prev.close) / prev.close * 100).toFixed(2) : 0,
      volume: latest.volume,
      open: latest.open,
      high: latest.high,
      low: latest.low,
    };
    stockData.stocks[code].high52w = Math.max(...kline.slice(-250).map(item => item.high));
    stockData.stocks[code].low52w = Math.min(...kline.slice(-250).map(item => item.low));
    console.log(`backfilled ${code}: ${kline.length}`);
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  const json = JSON.stringify(stockData);
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${json}\n`, 'utf8');
  await writeFile(
    tsPath,
    [
      "import stockDataJson from './stockData.json';",
      '',
      '// Keep TS compile fast: store large payload in JSON, re-export as `stockData`.',
      'export const stockData = stockDataJson as any;',
      '',
    ].join('\n'),
    'utf8',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
