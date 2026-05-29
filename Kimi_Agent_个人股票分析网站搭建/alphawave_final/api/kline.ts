function toSecId(code: string) {
  const [num, market] = String(code || '').toUpperCase().split('.');
  if (!/^\d{6}$/.test(num || '')) return null;
  if (market === 'SH') return `1.${num}`;
  if (market === 'SZ' || market === 'BJ') return `0.${num}`;
  return null;
}

function startDate(years = 10) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

export default async function handler(request: any, response: any) {
  const code = String(request.query?.code || '').toUpperCase();
  const secid = toSecId(code);
  if (!secid) return response.status(400).json({ ok: false, error: 'invalid code' });

  const params = new URLSearchParams({
    secid,
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    klt: '101',
    fqt: '1',
    beg: startDate(10),
    end: '20500101',
  });

  try {
    const res = await fetch(`https://push2his.eastmoney.com/api/qt/stock/kline/get?${params.toString()}`, {
      headers: { Referer: 'https://quote.eastmoney.com/', 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return response.status(502).json({ ok: false, error: `upstream ${res.status}` });
    const json = await res.json();
    const rows = json?.data?.klines || [];
    const data = rows.map((row: string) => {
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
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return response.status(200).json({ ok: true, code, total: data.length, data });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    return response.status(500).json({ ok: false, error: detail });
  }
}
