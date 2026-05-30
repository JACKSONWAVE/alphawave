export interface ETFProfile {
  code: string;
  name: string;
  industry: string;
  theme: string;
  role: '宽基底仓' | '防守现金流' | '商品避险' | '科技弹性' | '行业轮动';
  risk: 'low' | 'medium' | 'high';
  expenseNote: string;
  strategyNote: string;
  latest: {
    price: number;
    change: number;
    changePct: number;
    volume: number;
    amount: number;
    open: number;
    high: number;
    low: number;
  };
  high52w: number;
  low52w: number;
}

const rawETFProfiles: Array<Omit<ETFProfile, 'latest' | 'high52w' | 'low52w'> & { price: number; changePct: number }> = [
  {
    code: '510210.SH',
    name: '上证综指ETF',
    industry: '宽基ETF',
    theme: '上证综合指数',
    role: '宽基底仓',
    risk: 'medium',
    price: 0.892,
    changePct: 0.55,
    expenseNote: '跟踪上证综合指数，适合观察沪市整体风险偏好。',
    strategyNote: '上证指数站稳20日线、成交额温和放大时可做底仓；跌破60日线先降仓。',
  },
  {
    code: '510300.SH',
    name: '沪深300ETF',
    industry: '宽基ETF',
    theme: '沪深300',
    role: '宽基底仓',
    risk: 'medium',
    price: 4.162,
    changePct: 0.72,
    expenseNote: '核心宽基，适合做组合底仓和大盘风险暴露。',
    strategyNote: '大盘风险偏好回升、指数站上20日线时分批配置；跌破60日线先降仓。',
  },
  {
    code: '510050.SH',
    name: '上证50ETF',
    industry: '宽基ETF',
    theme: '上证50',
    role: '宽基底仓',
    risk: 'medium',
    price: 2.786,
    changePct: 0.48,
    expenseNote: '偏大金融和核心蓝筹，波动通常低于成长宽基。',
    strategyNote: '适合防守反击，金融权重走强时优先观察；若量能不足，只做底仓不追。',
  },
  {
    code: '510500.SH',
    name: '中证500ETF',
    industry: '宽基ETF',
    theme: '中证500',
    role: '行业轮动',
    risk: 'medium',
    price: 5.741,
    changePct: 1.08,
    expenseNote: '中盘弹性，适合市场从权重扩散到中盘时配置。',
    strategyNote: '市场热度提升且中小盘强于沪深300时加权；连续缩量反弹不追。',
  },
  {
    code: '159915.SZ',
    name: '创业板ETF',
    industry: '宽基ETF',
    theme: '创业板',
    role: '科技弹性',
    risk: 'high',
    price: 1.986,
    changePct: 1.46,
    expenseNote: '成长风格弹性较高，对新能源、医药和科技风险偏好敏感。',
    strategyNote: '只在成长风格扩散、MACD修复且量能确认时做波段；不适合弱市满仓。',
  },
  {
    code: '588000.SH',
    name: '科创50ETF',
    industry: '科技ETF',
    theme: '科创50',
    role: '科技弹性',
    risk: 'high',
    price: 1.046,
    changePct: 1.92,
    expenseNote: '科创硬科技代表，波动大，适合小仓主题轮动。',
    strategyNote: '等科技主线走强且站稳20日线后分批，跌破前低必须止损。',
  },
  {
    code: '510880.SH',
    name: '红利ETF',
    industry: '红利ETF',
    theme: '红利高股息',
    role: '防守现金流',
    risk: 'low',
    price: 3.184,
    changePct: 0.31,
    expenseNote: '高股息资产，适合震荡市和防守配置。',
    strategyNote: '指数弱但高股息强时可做稳定底仓；加速冲高后等回踩均线。',
  },
  {
    code: '512890.SH',
    name: '红利低波ETF',
    industry: '红利ETF',
    theme: '红利低波',
    role: '防守现金流',
    risk: 'low',
    price: 1.196,
    changePct: 0.24,
    expenseNote: '红利叠加低波动，适合降低组合波动。',
    strategyNote: '组合防守仓优先级高；靠近20/60日线低吸，短线暴涨不追。',
  },
  {
    code: '518880.SH',
    name: '黄金ETF',
    industry: '商品ETF',
    theme: '黄金',
    role: '商品避险',
    risk: 'medium',
    price: 6.423,
    changePct: 0.88,
    expenseNote: '跟踪黄金价格，适合对冲地缘、美元和实际利率风险。',
    strategyNote: '美元走弱、实际利率回落、避险升温时提高权重；金价急拉后分批止盈。',
  },
  {
    code: '159934.SZ',
    name: '黄金ETF基金',
    industry: '商品ETF',
    theme: '黄金',
    role: '商品避险',
    risk: 'medium',
    price: 6.391,
    changePct: 0.81,
    expenseNote: '黄金替代品，可与权益类 ETF 做低相关配置。',
    strategyNote: '作为防守资产，不和科技成长同一套追涨逻辑；以回踩和避险信号为主。',
  },
  {
    code: '512760.SH',
    name: '芯片ETF',
    industry: '半导体ETF',
    theme: '半导体芯片',
    role: '科技弹性',
    risk: 'high',
    price: 1.248,
    changePct: 2.36,
    expenseNote: '覆盖半导体设计、制造和设备材料链条，适合科技主线轮动。',
    strategyNote: '存储、先进封装、国产替代新闻共振时提高观察；必须等放量站稳突破线。',
  },
  {
    code: '512480.SH',
    name: '半导体ETF',
    industry: '半导体ETF',
    theme: '半导体',
    role: '科技弹性',
    risk: 'high',
    price: 0.918,
    changePct: 2.08,
    expenseNote: '半导体产业链弹性资产，回撤也会更快。',
    strategyNote: '只做趋势段，不在高位连续放量后追；跌破20日线降仓。',
  },
  {
    code: '159995.SZ',
    name: '芯片ETF',
    industry: '半导体ETF',
    theme: '国产芯片',
    role: '科技弹性',
    risk: 'high',
    price: 1.034,
    changePct: 1.97,
    expenseNote: '偏芯片国产替代主题，受政策和产业景气影响明显。',
    strategyNote: '适合主题扩散后的右侧交易；没有量能确认时只观察不加仓。',
  },
  {
    code: '159327.SZ',
    name: '半导体材料设备ETF',
    industry: '半导体ETF',
    theme: '材料设备/存储链',
    role: '科技弹性',
    risk: 'high',
    price: 1.127,
    changePct: 2.61,
    expenseNote: '更偏半导体设备材料，能承接存储扩产、国产设备替代主题。',
    strategyNote: '存储周期向上时弹性高，但必须控制仓位；高开大阳后等回踩确认。',
  },
  {
    code: '515000.SH',
    name: '科技ETF',
    industry: '科技ETF',
    theme: '科技龙头',
    role: '科技弹性',
    risk: 'high',
    price: 1.587,
    changePct: 2.74,
    expenseNote: '泛科技龙头暴露，可覆盖AI、半导体和数字经济。',
    strategyNote: '当AI、存储、通信多主题共振时优先看；主题退潮时不恋战。',
  },
  {
    code: '515050.SH',
    name: '通信ETF',
    industry: '通信ETF',
    theme: '通信/数据中心',
    role: '科技弹性',
    risk: 'high',
    price: 1.334,
    changePct: 1.52,
    expenseNote: '受AI算力、光模块、数据中心和运营商资本开支影响。',
    strategyNote: '数据中心和AI基础设施新闻升温时加入观察；连续缩量滞涨先降仓。',
  },
  {
    code: '515790.SH',
    name: '光伏ETF',
    industry: '新能源ETF',
    theme: '光伏',
    role: '行业轮动',
    risk: 'high',
    price: 0.694,
    changePct: -0.42,
    expenseNote: '周期属性强，供需、价格和政策扰动大。',
    strategyNote: '只做困境反转和右侧修复，必须看到价格企稳、量能回升和板块扩散。',
  },
  {
    code: '516160.SH',
    name: '新能源ETF',
    industry: '新能源ETF',
    theme: '新能源',
    role: '行业轮动',
    risk: 'high',
    price: 0.812,
    changePct: 0.67,
    expenseNote: '新能源车、锂电、光伏相关，波动和景气周期较强。',
    strategyNote: '景气复苏或估值修复时分批；反弹无量、行业价格战加剧时规避。',
  },
  {
    code: '512000.SH',
    name: '券商ETF',
    industry: '金融ETF',
    theme: '券商',
    role: '行业轮动',
    risk: 'medium',
    price: 0.972,
    changePct: 1.15,
    expenseNote: '典型牛市弹性资产，对成交额和资本市场政策敏感。',
    strategyNote: '两市成交放大、指数突破时关注；弱市缩量时只做观察。',
  },
  {
    code: '512800.SH',
    name: '银行ETF',
    industry: '金融ETF',
    theme: '银行',
    role: '防守现金流',
    risk: 'low',
    price: 1.286,
    changePct: 0.36,
    expenseNote: '偏低估值和高股息，适合防守组合。',
    strategyNote: '红利和金融风格占优时配置；若息差压力或地产风险升温则降低权重。',
  },
  {
    code: '512660.SH',
    name: '军工ETF',
    industry: '军工ETF',
    theme: '军工',
    role: '行业轮动',
    risk: 'high',
    price: 1.091,
    changePct: 1.34,
    expenseNote: '事件驱动和订单周期明显，适合小仓主题轮动。',
    strategyNote: '只在事件催化叠加放量突破时跟随；无持续量能时快进快出。',
  },
];

function buildLatest(price: number, changePct: number, index: number): ETFProfile['latest'] {
  const change = +(price * changePct / 100).toFixed(3);
  const open = +(price * (1 - changePct / 100 * 0.35)).toFixed(3);
  const high = +(Math.max(price, open) * (1 + 0.006 + index * 0.0003)).toFixed(3);
  const low = +(Math.min(price, open) * (1 - 0.006 - index * 0.0002)).toFixed(3);
  const volume = Math.round(2800000 + index * 310000);
  return {
    price,
    change,
    changePct,
    volume,
    amount: Math.round(volume * price / 10000),
    open,
    high,
    low,
  };
}

export const etfProfiles: ETFProfile[] = rawETFProfiles.map((item, index) => {
  const spread = item.risk === 'high' ? 0.34 : item.risk === 'medium' ? 0.22 : 0.15;
  return {
    ...item,
    latest: buildLatest(item.price, item.changePct, index),
    high52w: +(item.price * (1 + spread)).toFixed(3),
    low52w: +(item.price * (1 - spread * 0.82)).toFixed(3),
  };
});

export const etfProfileMap = new Map(etfProfiles.map(item => [item.code, item]));

export function getETFProfile(code: string) {
  return etfProfileMap.get(code);
}

export function isETF(code: string) {
  return etfProfileMap.has(code);
}

export function getETFRecords() {
  return Object.fromEntries(etfProfiles.map(item => [item.code, {
    code: item.code,
    name: item.name,
    industry: item.industry,
    market: item.code.endsWith('.SH') ? 'SH' : 'SZ',
    latest: item.latest,
    pe: 0,
    pb: 0,
    marketCap: '',
    floatMarketCap: '',
    high52w: item.high52w,
    low52w: item.low52w,
  }]));
}
