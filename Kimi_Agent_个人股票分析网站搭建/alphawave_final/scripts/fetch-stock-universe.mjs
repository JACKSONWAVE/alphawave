import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = resolve(root, 'src/assets/data/stockUniverse.json');

const EASTMONEY_PAGE_SIZE = 500;
const SZSE_PAGE_SIZE = 100;
const REQUEST_RETRIES = 7;
const HSJ_A_FS = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function toMarketSuffix(row) {
  if (row.f13 === 1) return 'SH';
  if (row.f13 === 0 && String(row.f12).startsWith('8')) return 'BJ';
  if (row.f13 === 0 && String(row.f12).startsWith('4')) return 'BJ';
  return 'SZ';
}

function toCode(row) {
  return `${row.f12}.${toMarketSuffix(row)}`;
}

function emptyLatest() {
  return { price: 0, change: 0, changePct: 0, volume: 0, amount: 0, open: 0, high: 0, low: 0 };
}

function normalizeEastmoney(row) {
  const latest = {
    price: Number(row.f2) || 0,
    change: Number(row.f4) || 0,
    changePct: Number(row.f3) || 0,
    volume: Number(row.f5) || 0,
    amount: Number(row.f6) || 0,
    open: 0,
    high: 0,
    low: 0,
  };
  return {
    code: toCode(row),
    name: row.f14 || row.f12,
    industry: row.f100 && row.f100 !== '-' ? row.f100 : '未分类',
    market: toMarketSuffix(row),
    latest,
    pe: Number(row.f9) || 0,
    pb: Number(row.f23) || 0,
    marketCap: Number(row.f20) || 0,
    floatMarketCap: Number(row.f21) || 0,
    high52w: 0,
    low52w: 0,
  };
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchWithRetry(url, options = {}, label = url) {
  let lastError;
  for (let attempt = 1; attempt <= REQUEST_RETRIES; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      lastError = new Error(`${label} ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    const delay = 400 * attempt * attempt;
    console.warn(`${label} retry ${attempt}/${REQUEST_RETRIES}: ${lastError.message}`);
    await sleep(delay);
  }
  throw lastError || new Error(`${label} failed`);
}

async function fetchJson(url, options = {}, label = url, encoding = 'utf-8') {
  const response = await fetchWithRetry(url, options, label);
  const bytes = await response.arrayBuffer();
  const text = new TextDecoder(encoding).decode(bytes);
  return JSON.parse(text);
}

async function fetchEastmoneyPage(page) {
  const params = new URLSearchParams({
    pn: String(page),
    pz: String(EASTMONEY_PAGE_SIZE),
    po: '1',
    np: '1',
    fltt: '2',
    invt: '2',
    fid: 'f3',
    fs: HSJ_A_FS,
    fields: 'f12,f13,f14,f2,f3,f4,f5,f6,f9,f20,f21,f23,f100',
  });
  const url = `https://push2.eastmoney.com/api/qt/clist/get?${params.toString()}`;
  return fetchJson(url, { headers: { Referer: 'https://quote.eastmoney.com/', 'User-Agent': 'Mozilla/5.0' } }, `eastmoney page ${page}`);
}

async function fetchEastmoneyUniverse() {
  const first = await fetchEastmoneyPage(1);
  const total = Number(first?.data?.total) || 0;
  const pages = Math.ceil(total / EASTMONEY_PAGE_SIZE);
  const rows = [...(first?.data?.diff || [])];

  for (let page = 2; page <= pages; page++) {
    const json = await fetchEastmoneyPage(page);
    rows.push(...(json?.data?.diff || []));
    console.log(`fetched eastmoney universe page ${page}/${pages}`);
    await sleep(160);
  }

  const stocks = {};
  rows.map(normalizeEastmoney).forEach(stock => {
    stocks[stock.code] = stock;
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'eastmoney_clist_hsj_a',
    total: Object.keys(stocks).length,
    stocks,
  };
  if (payload.total < 5000) throw new Error(`unexpected eastmoney total ${payload.total}`);
  return payload;
}

async function fetchSseStocks() {
  const params = new URLSearchParams({
    jsonCallBack: '',
    isPagination: 'true',
    stockCode: '',
    csrcCode: '',
    areaName: '',
    stockType: '1',
    'pageHelp.cacheSize': '1',
    'pageHelp.beginPage': '1',
    'pageHelp.pageSize': '10000',
    'pageHelp.pageNo': '1',
    'pageHelp.endPage': '1',
  });
  const json = await fetchJson(
    `https://query.sse.com.cn/security/stock/getStockListData2.do?${params.toString()}`,
    { headers: { Referer: 'https://www.sse.com.cn/', 'User-Agent': 'Mozilla/5.0' } },
    'sse stock list',
  );
  return (json?.pageHelp?.data || []).map(row => ({
    code: `${row.SECURITY_CODE_A}.SH`,
    name: row.SECURITY_ABBR_A || row.COMPANY_ABBR || row.SECURITY_CODE_A,
    industry: row.CSRC_GREAT_CODE_DESC || row.CSRC_CODE_DESC || '未分类',
    market: 'SH',
    latest: emptyLatest(),
    pe: 0,
    pb: 0,
    marketCap: 0,
    floatMarketCap: 0,
    high52w: 0,
    low52w: 0,
    listDate: row.LISTING_DATE || '',
  })).filter(stock => /^\d{6}\.SH$/.test(stock.code));
}

async function fetchSzseStocks() {
  const rows = [];
  let pageCount = 1;

  for (let page = 1; page <= pageCount; page++) {
    const url = `https://www.szse.cn/api/report/ShowReport/data?SHOWTYPE=JSON&CATALOGID=1110&TABKEY=tab1&random=${Date.now()}&PAGENO=${page}&PAGESIZE=${SZSE_PAGE_SIZE}`;
    const json = await fetchJson(
      url,
      { headers: { Referer: 'https://www.szse.cn/', 'User-Agent': 'Mozilla/5.0' } },
      `szse page ${page}`,
      'gb18030',
    );
    const pagePayload = json?.[0] || {};
    pageCount = Number(pagePayload?.metadata?.pagecount) || pageCount;
    rows.push(...(pagePayload?.data || []));
    if (page % 5 === 0 || page === pageCount) console.log(`fetched szse page ${page}/${pageCount}`);
    await sleep(120);
  }

  return rows.map(row => ({
    code: `${row.agdm}.SZ`,
    name: stripHtml(row.agjc),
    industry: row.sshymc || '未分类',
    market: 'SZ',
    latest: emptyLatest(),
    pe: 0,
    pb: 0,
    marketCap: 0,
    floatMarketCap: 0,
    high52w: 0,
    low52w: 0,
    listDate: row.agssrq || '',
  })).filter(stock => /^\d{6}\.SZ$/.test(stock.code));
}

async function fetchExchangeUniverse() {
  const stocks = {};
  const [sseRows, szseRows] = await Promise.all([fetchSseStocks(), fetchSzseStocks()]);
  [...sseRows, ...szseRows].forEach(stock => {
    stocks[stock.code] = stock;
  });
  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'sse_szse_exchange_lists',
    total: Object.keys(stocks).length,
    stocks,
  };
  if (payload.total < 4300) throw new Error(`unexpected exchange total ${payload.total}`);
  return payload;
}

function codeRange(prefix, start, end) {
  const codes = [];
  for (let n = start; n <= end; n++) {
    codes.push(`${prefix}${String(n).padStart(6, '0')}`);
  }
  return codes;
}

function fromTencentCode(tcCode) {
  const prefix = tcCode.slice(0, 2);
  const raw = tcCode.slice(2);
  if (prefix === 'sh') return `${raw}.SH`;
  if (prefix === 'sz') return `${raw}.SZ`;
  if (prefix === 'bj') return `${raw}.BJ`;
  return raw;
}

function marketFromCode(code) {
  return code.endsWith('.SH') ? 'SH' : code.endsWith('.BJ') ? 'BJ' : 'SZ';
}

function normalizeTencent(tcCode, fields) {
  const code = fromTencentCode(tcCode);
  const prevClose = Number(fields[4]) || 0;
  const price = Number(fields[3]) || 0;
  return {
    code,
    name: fields[1] || code,
    industry: '未分类',
    market: marketFromCode(code),
    latest: {
      price,
      change: prevClose > 0 ? +(price - prevClose).toFixed(2) : Number(fields[31]) || 0,
      changePct: Number(fields[32]) || 0,
      volume: Number(fields[6]) || 0,
      amount: Number(fields[37]) || 0,
      open: Number(fields[5]) || 0,
      high: Number(fields[33]) || 0,
      low: Number(fields[34]) || 0,
    },
    pe: Number(fields[39]) || 0,
    pb: Number(fields[46]) || 0,
    marketCap: Number(fields[44]) || 0,
    floatMarketCap: Number(fields[45]) || 0,
    high52w: Number(fields[47]) > 0 ? Number(fields[47]) : 0,
    low52w: Number(fields[48]) > 0 ? Number(fields[48]) : 0,
  };
}

async function fetchTencentBatch(codes, batchNo, totalBatches) {
  const url = `https://qt.gtimg.cn/q=${codes.join(',')}`;
  const response = await fetchWithRetry(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, `tencent batch ${batchNo}/${totalBatches}`);
  const text = new TextDecoder('gb18030').decode(await response.arrayBuffer());
  const stocks = [];
  for (const line of text.split(';')) {
    const match = line.match(/v_(\w+)="([^"]*)"/);
    if (!match) continue;
    const fields = match[2].split('~');
    const name = fields[1] || '';
    const type = fields[61] || '';
    if (!name || !type.startsWith('GP')) continue;
    if (name.startsWith('PT') || name.includes('退市')) continue;
    const marketPrefix = match[1].slice(0, 2);
    const high52w = Number(fields[47]) || 0;
    const low52w = Number(fields[48]) || 0;
    if ((marketPrefix === 'sh' || marketPrefix === 'sz') && (high52w <= 0 || low52w <= 0)) continue;
    stocks.push(normalizeTencent(match[1], fields));
  }
  return stocks;
}

async function fetchTencentUniverse() {
  const candidates = [
    ...codeRange('sh', 600000, 605999),
    ...codeRange('sh', 688000, 689999),
    ...codeRange('sz', 0, 3999),
    ...codeRange('sz', 300000, 302999),
    ...codeRange('bj', 430000, 439999),
    ...codeRange('bj', 830000, 839999),
    ...codeRange('bj', 870000, 889999),
    ...codeRange('bj', 920000, 929999),
  ];
  const batchSize = 420;
  const totalBatches = Math.ceil(candidates.length / batchSize);
  const stocks = {};

  for (let offset = 0; offset < candidates.length; offset += batchSize) {
    const batchNo = Math.floor(offset / batchSize) + 1;
    const rows = await fetchTencentBatch(candidates.slice(offset, offset + batchSize), batchNo, totalBatches);
    rows.forEach(stock => {
      stocks[stock.code] = stock;
    });
    if (batchNo % 10 === 0 || batchNo === totalBatches) console.log(`scanned tencent universe batch ${batchNo}/${totalBatches}`);
    await sleep(100);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'tencent_quote_code_scan_hsj_a',
    total: Object.keys(stocks).length,
    stocks,
  };
  if (payload.total < 5000) throw new Error(`unexpected tencent total ${payload.total}`);
  return payload;
}

async function main() {
  let payload;
  try {
    payload = await fetchEastmoneyUniverse();
  } catch (error) {
    console.warn(`Eastmoney universe failed, fallback to exchange lists: ${error.message}`);
    try {
      payload = await fetchExchangeUniverse();
    } catch (exchangeError) {
      console.warn(`Exchange universe failed, fallback to Tencent scan: ${exchangeError.message}`);
      payload = await fetchTencentUniverse();
    }
  }

  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(payload)}\n`, 'utf8');
  console.log(`wrote ${payload.total} stocks to ${jsonPath}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
