function toTencentCode(code: string): string {
  const raw = String(code || '').trim();
  if (/^(sh|sz|bj|hk)\w+/i.test(raw)) return raw.toLowerCase();
  const [num, market] = raw.toUpperCase().split('.');
  if (!num || !market) return raw.toLowerCase();
  if (market === 'SH') return `sh${num}`;
  if (market === 'SZ') return `sz${num}`;
  if (market === 'BJ') return `bj${num}`;
  if (market === 'HK') return `hk${num}`;
  return raw.toLowerCase();
}

function fromTencentCode(code: string): string {
  const prefix = code.slice(0, 2);
  const num = code.slice(2);
  if (prefix === 'sh') return `${num}.SH`;
  if (prefix === 'sz') return `${num}.SZ`;
  if (prefix === 'bj') return `${num}.BJ`;
  if (prefix === 'hk') return `${num}.HK`;
  return code;
}

function parseTencent(text: string) {
  return text.split(';').flatMap(line => {
    const match = line.match(/v_(\w+)="([^"]*)"/);
    if (!match) return [];
    const fields = match[2].split('~');
    if (fields.length < 35) return [];
    const prevClose = parseFloat(fields[4]) || 0;
    const price = parseFloat(fields[3]) || 0;
    return [{
      code: fromTencentCode(match[1]),
      name: fields[1] || '',
      price,
      open: parseFloat(fields[5]) || 0,
      prevClose,
      high: parseFloat(fields[33]) || 0,
      low: parseFloat(fields[34]) || 0,
      change: prevClose > 0 ? +(price - prevClose).toFixed(2) : 0,
      changePct: prevClose > 0 ? +((price - prevClose) / prevClose * 100).toFixed(2) : 0,
      volume: parseFloat(fields[6]) || 0,
      amount: parseFloat(fields[37]) || 0,
      pe: parseFloat(fields[39]) || 0,
      pb: parseFloat(fields[46]) || 0,
      turnover: parseFloat(fields[38]) || 0,
      marketCap: parseFloat(fields[44]) || 0,
      time: fields[30] || '',
    }];
  });
}

export default async function handler(request: any, response: any) {
  const rawCodes = String(request.query?.codes || '').split(',').map(item => item.trim()).filter(Boolean).slice(0, 120);
  if (rawCodes.length === 0) return response.status(400).json({ ok: false, error: 'codes required' });

  const q = rawCodes.map(toTencentCode).join(',');
  try {
    const upstream = await fetch(`https://qt.gtimg.cn/q=${q}`, {
      headers: { Referer: 'https://finance.qq.com/', 'User-Agent': 'Mozilla/5.0' },
    });
    if (!upstream.ok) return response.status(502).json({ ok: false, error: `upstream ${upstream.status}` });
    const text = await upstream.text();
    const data = parseTencent(text);
    response.setHeader('Cache-Control', 's-maxage=8, stale-while-revalidate=20');
    return response.status(200).json({ ok: true, total: data.length, data, source: 'tencent' });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    return response.status(500).json({ ok: false, error: detail });
  }
}
