export const industryMetrics = [
  {
    label: '全国算力总规模',
    value: '268 EFLOPS',
    period: '截至2024年9月底',
    interpretation: '观察算力基础设施扩容的总量基础',
    source: '工业和信息化部',
    url: 'https://www.miit.gov.cn/xwfb/xwfbh/qtxwfbh/art/2025/art_a117e00686bc41c5be387e82ff13d0f3.html',
  },
  {
    label: '2025政策目标',
    value: '>300 EFLOPS',
    period: '算力基础设施行动计划',
    interpretation: '政策端要求扩大供给并提高智能算力占比',
    source: '工业和信息化部',
    url: 'https://www.miit.gov.cn/zwgk/zcjd/art/2023/art_916261bbfa6d4e1eb9483e843c5a4fd5.html',
  },
  {
    label: '运营商对外服务机架',
    value: '93.8万架',
    period: '截至2025年底',
    interpretation: '跟踪运营商数据中心供给和资本开支方向',
    source: '2025年通信业统计公报',
    url: 'https://www.miit.gov.cn/jgsj/yxj/xxfb/art/2026/art_bea806f4dd20457cb0158795cc210aa7.html',
  },
  {
    label: '绿色算力设施PUE',
    value: '1.25',
    period: '2025年度入选设施均值',
    interpretation: '能耗效率影响数据中心建设和液冷需求',
    source: '工业和信息化部',
    url: 'https://www.miit.gov.cn/jgsj/jns/nyjy/art/2025/art_7caf70f0c83b459a956e0aaa1c16ad00.html',
  },
];

export const industryTrackers = [
  { name: '需求端', metrics: '云厂商与运营商资本开支、服务器招标量', question: '下游投入能否持续转化为订单与收入？' },
  { name: '供给端', metrics: '国产CPU/DCU供给、整机交付与产品结构', question: '关键部件供给是否限制收入确认和毛利率？' },
  { name: '效率端', metrics: 'PUE、液冷渗透率、机柜功率密度', question: '高密度算力是否带动单机柜价值量提升？' },
  { name: '公司端', metrics: '收入增速、毛利率、研发费用率、资本开支', question: '规模增长能否同步转化为利润和自由现金流？' },
];
