import type { AccountPerformance, AccountSummary } from './accountEngine';
import type { MarketScannerReport } from './marketScanner';
import type { PortfolioWorkbench } from './portfolioEngine';
import type { DailyStrategyPick } from './strategyScreener';
import type { StrategyPoolLog } from './strategyJournal';
import type { TradeExecutionReview } from './tradeReview';

export type BriefPosture = '进攻' | '均衡' | '防守';
export type BriefTone = 'red' | 'green' | 'yellow' | 'blue';

export interface DailyBriefMetric {
  label: string;
  value: string;
  detail: string;
  tone: BriefTone;
}

export interface DailyBriefAction {
  title: string;
  detail: string;
  tag: string;
  tone: BriefTone;
  href: string;
}

export interface DailyBriefFocus {
  name: string;
  code: string;
  label: string;
  detail: string;
  tone: BriefTone;
  href: string;
}

export interface DailyOperationsBrief {
  posture: BriefPosture;
  headline: string;
  riskBudget: string;
  generatedAt: string;
  metrics: DailyBriefMetric[];
  actions: DailyBriefAction[];
  focus: DailyBriefFocus[];
}

interface BuildDailyBriefOptions {
  scanner: MarketScannerReport;
  portfolio: PortfolioWorkbench;
  account: AccountSummary;
  performance: AccountPerformance;
  tradeReview: TradeExecutionReview;
  dailyPicks: DailyStrategyPick[];
  etfPicks: DailyStrategyPick[];
  poolLogs: StrategyPoolLog[];
  deskMode: 'premarket' | 'intraday' | 'review';
}

const postureTone: Record<BriefPosture, BriefTone> = {
  进攻: 'red',
  均衡: 'yellow',
  防守: 'green',
};

function signedPct(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function toneForPct(value: number): BriefTone {
  if (value > 0) return 'red';
  if (value < 0) return 'green';
  return 'blue';
}

function nowText() {
  return new Date().toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function pickPosture(options: BuildDailyBriefOptions): BriefPosture {
  const { scanner, portfolio, performance, tradeReview } = options;
  const executionWeak = tradeReview.tradeCount > 0 && tradeReview.score < 58;
  const drawdownAlert = performance.hasRealTrades && performance.maxDrawdown <= -12;
  const weakBreadth = scanner.heat <= 35 || scanner.weakCount > scanner.strongCount * 1.4;
  const strongBreadth = scanner.heat >= 62 && scanner.strongCount >= scanner.weakCount && portfolio.stance === '进攻';

  if (drawdownAlert || executionWeak || weakBreadth || portfolio.stance === '防守') return '防守';
  if (strongBreadth && portfolio.credibility.score >= 52) return '进攻';
  return '均衡';
}

function headlineFor(posture: BriefPosture, options: BuildDailyBriefOptions) {
  const { scanner, portfolio, account } = options;
  if (posture === '防守') {
    return `市场热度 ${scanner.heat}%，先控回撤和风险票，目标现金保留 ${portfolio.targetCashPct}% 左右。`;
  }
  if (posture === '进攻') {
    return `市场热度 ${scanner.heat}%，组合允许试错，但单票仍按 ${portfolio.layers[0]?.maxSinglePct || 6}% 上限处理。`;
  }
  return `市场分化中，账户当前仓位 ${account.investedPct.toFixed(1)}%，优先做确定性高的候选。`;
}

function modeAction(deskMode: BuildDailyBriefOptions['deskMode']): DailyBriefAction {
  if (deskMode === 'premarket') {
    return {
      title: '盘前只定计划',
      detail: '先写清买区、止损和最大仓位，未到价不追。',
      tag: '盘前',
      tone: 'blue',
      href: '/screener',
    };
  }
  if (deskMode === 'review') {
    return {
      title: '复盘先看降级',
      detail: '把出池、降级、追高和提前卖出逐条写入交易日志。',
      tag: '复盘',
      tone: 'yellow',
      href: '/trades',
    };
  }
  return {
    title: '盘中只跟触发',
    detail: '优先盯可试错票和预警命中，未触发的候选保持观察。',
    tag: '盘中',
    tone: 'red',
    href: '/alerts',
  };
}

function buildActions(options: BuildDailyBriefOptions, posture: BriefPosture): DailyBriefAction[] {
  const { portfolio, account, tradeReview, dailyPicks, etfPicks, poolLogs, scanner } = options;
  const topPick = dailyPicks[0];
  const topEtf = etfPicks[0];
  const highRiskPick = dailyPicks.find(pick => pick.riskLevel === 'high');
  const actions: DailyBriefAction[] = [];

  actions.push({
    title: posture === '防守' ? '先处理仓位风险' : '先核对组合仓位',
    detail: `目标个股/ETF/现金 ${portfolio.targetStockPct}/${portfolio.targetEtfPct}/${portfolio.targetCashPct}，当前现金 ${account.availableCashPct.toFixed(1)}%。`,
    tag: posture,
    tone: postureTone[posture],
    href: '/portfolio',
  });

  if (topPick) {
    actions.push({
      title: `候选只先看 ${topPick.name}`,
      detail: `${topPick.strategy}，计划买区 ${topPick.entry}，止损 ${topPick.stop}。`,
      tag: `分数 ${topPick.score}`,
      tone: topPick.riskLevel === 'high' ? 'yellow' : 'red',
      href: `/analysis?code=${topPick.code}`,
    });
  }

  if (topEtf) {
    actions.push({
      title: `ETF底仓盯 ${topEtf.name}`,
      detail: `作为组合缓冲层处理，目标 ${topEtf.target}，不和个股试错仓混用。`,
      tag: 'ETF',
      tone: 'blue',
      href: `/analysis?code=${topEtf.code}`,
    });
  }

  if (highRiskPick || scanner.highRiskCount > scanner.total * 0.45) {
    actions.push({
      title: highRiskPick ? `风险候选先复核 ${highRiskPick.name}` : '高风险候选占比偏高',
      detail: highRiskPick ? `${highRiskPick.reason}，未站稳计划价前不要加仓。` : `全市场高风险候选 ${scanner.highRiskCount} 只，降低单票试错上限。`,
      tag: '风控',
      tone: 'green',
      href: highRiskPick ? `/analysis?code=${highRiskPick.code}` : '/screener',
    });
  }

  if (poolLogs.length) {
    const latest = poolLogs[0];
    actions.push({
      title: `候选池更新：${latest.title}`,
      detail: latest.detail,
      tag: latest.type,
      tone: latest.tone,
      href: `/analysis?code=${latest.code}`,
    });
  } else {
    actions.push({
      title: '刷新资讯雷达联动',
      detail: '把热点行业、ETF配置和自选股预警合并看，避免只按价格追涨。',
      tag: '资讯',
      tone: 'blue',
      href: '/intel',
    });
  }

  if (tradeReview.tradeCount > 0 && tradeReview.score < 72) {
    actions.push({
      title: '交易执行需要复盘',
      detail: `执行评分 ${tradeReview.score} / ${tradeReview.grade}，优先处理追高、计划外买入和备注缺失。`,
      tag: '纪律',
      tone: 'yellow',
      href: '/trades',
    });
  }

  actions.push(modeAction(options.deskMode));

  return actions.slice(0, 6);
}

function buildFocus(options: BuildDailyBriefOptions, posture: BriefPosture): DailyBriefFocus[] {
  const { dailyPicks, etfPicks, scanner, portfolio, tradeReview } = options;
  const attackLayer = portfolio.layers.find(layer => layer.layer === '进攻');
  const defenseLayer = portfolio.layers.find(layer => layer.layer === '防守');
  const hot = scanner.hotIndustries[0];
  const risk = scanner.riskIndustries[0];
  const topPick = dailyPicks[0];
  const topEtf = etfPicks[0];
  const focus: DailyBriefFocus[] = [];

  if (topPick) {
    focus.push({
      name: topPick.name,
      code: topPick.code,
      label: posture === '防守' ? '观察候选' : '首个触发',
      detail: `${topPick.strategy} · 置信 ${topPick.confidence}% · ${topPick.execution}`,
      tone: topPick.riskLevel === 'high' ? 'yellow' : 'red',
      href: `/analysis?code=${topPick.code}`,
    });
  }

  if (topEtf) {
    focus.push({
      name: topEtf.name,
      code: topEtf.code,
      label: 'ETF缓冲',
      detail: `计划 ${topEtf.entry}，用于承接 ${portfolio.targetEtfPct}% 目标ETF仓。`,
      tone: 'blue',
      href: `/analysis?code=${topEtf.code}`,
    });
  }

  if (hot) {
    focus.push({
      name: hot.industry,
      code: hot.topCode,
      label: '热点行业',
      detail: `${hot.rising}/${hot.count} 上涨，龙头观察 ${hot.topName}。`,
      tone: 'red',
      href: '/screener',
    });
  }

  if (risk && posture === '防守') {
    focus.push({
      name: risk.industry,
      code: risk.topCode,
      label: '弱势行业',
      detail: `热度 ${risk.heat}%，避免在弱行业里无计划抄底。`,
      tone: 'green',
      href: '/screener',
    });
  }

  const layerPick = posture === '进攻' ? attackLayer?.picks[0] : defenseLayer?.picks[0];
  if (layerPick && !focus.some(item => item.code === layerPick.code)) {
    focus.push({
      name: layerPick.name,
      code: layerPick.code,
      label: posture === '进攻' ? '进攻层' : '防守层',
      detail: `${layerPick.strategy}，单票不超过 ${posture === '进攻' ? attackLayer?.maxSinglePct : defenseLayer?.maxSinglePct}% 目标仓。`,
      tone: posture === '进攻' ? 'red' : 'green',
      href: `/analysis?code=${layerPick.code}`,
    });
  }

  if (tradeReview.issues[0]) {
    focus.push({
      name: tradeReview.grade,
      code: '执行评分',
      label: '执行复盘',
      detail: tradeReview.issues[0].detail,
      tone: tradeReview.issues[0].tone,
      href: '/trades',
    });
  }

  return focus.slice(0, 5);
}

export function buildDailyOperationsBrief(options: BuildDailyBriefOptions): DailyOperationsBrief {
  const posture = pickPosture(options);
  const { scanner, portfolio, account, performance, tradeReview } = options;

  return {
    posture,
    headline: headlineFor(posture, options),
    riskBudget: `单票上限 ${posture === '进攻' ? 6 : posture === '均衡' ? 4 : 3}% · 现金底线 ${portfolio.targetCashPct}% · 账户回撤 ${signedPct(performance.maxDrawdown)}`,
    generatedAt: nowText(),
    metrics: [
      {
        label: '市场温度',
        value: `${scanner.heat}%`,
        detail: `${scanner.rising}/${scanner.total} 上涨`,
        tone: scanner.heat >= 62 ? 'red' : scanner.heat <= 35 ? 'green' : 'yellow',
      },
      {
        label: '目标现金',
        value: `${portfolio.targetCashPct}%`,
        detail: `当前 ${account.availableCashPct.toFixed(1)}%`,
        tone: account.availableCashPct + 3 >= portfolio.targetCashPct ? 'blue' : 'yellow',
      },
      {
        label: '账户收益',
        value: signedPct(account.totalReturnPct),
        detail: performance.hasRealTrades ? `最大回撤 ${signedPct(performance.maxDrawdown)}` : '暂无实盘样本',
        tone: toneForPct(account.totalReturnPct),
      },
      {
        label: '执行纪律',
        value: tradeReview.tradeCount ? tradeReview.grade : '待记录',
        detail: tradeReview.tradeCount ? `评分 ${tradeReview.score}` : '录入交易后自动复盘',
        tone: tradeReview.grade === 'A' || tradeReview.grade === 'B' ? 'red' : tradeReview.grade === 'C' ? 'yellow' : 'blue',
      },
    ],
    actions: buildActions(options, posture),
    focus: buildFocus(options, posture),
  };
}
