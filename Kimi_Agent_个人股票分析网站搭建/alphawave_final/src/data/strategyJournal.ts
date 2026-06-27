import type { DailyStrategyPick } from './strategyScreener';

export interface StrategyPoolSnapshotItem {
  code: string;
  name: string;
  rank: number;
  score: number;
  confidence: number;
  strategy: string;
  riskLevel: DailyStrategyPick['riskLevel'];
  reason: string;
  rankDriver: string;
  dataDate: string;
  intelLabel: string;
}

export interface StrategyPoolLog {
  id: string;
  time: string;
  code: string;
  name: string;
  type: '入选' | '出池' | '升级' | '降级' | '留池';
  title: string;
  detail: string;
  tone: 'red' | 'green' | 'yellow' | 'blue';
}

export function buildStrategySnapshot(
  picks: DailyStrategyPick[],
  intelLabelOf: (pick: DailyStrategyPick) => string,
): StrategyPoolSnapshotItem[] {
  return picks.slice(0, 10).map((pick, index) => ({
    code: pick.code,
    name: pick.name,
    rank: index + 1,
    score: pick.score,
    confidence: pick.confidence,
    strategy: pick.strategy,
    riskLevel: pick.riskLevel,
    reason: pick.reason,
    rankDriver: pick.rankDriver,
    dataDate: pick.dataDate,
    intelLabel: intelLabelOf(pick),
  }));
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

export function diffStrategySnapshots(
  previous: StrategyPoolSnapshotItem[],
  current: StrategyPoolSnapshotItem[],
): StrategyPoolLog[] {
  if (previous.length === 0 || current.length === 0) return [];
  const time = nowText();
  const prevMap = new Map(previous.map(item => [item.code, item]));
  const currMap = new Map(current.map(item => [item.code, item]));
  const logs: StrategyPoolLog[] = [];

  current.forEach(item => {
    const prev = prevMap.get(item.code);
    if (!prev) {
      logs.push({
        id: `${Date.now()}-${item.code}-in`,
        time,
        code: item.code,
        name: item.name,
        type: '入选',
        title: `${item.name} 新进入Top池`,
        detail: `排名#${item.rank}，${item.strategy}，策略分${item.score}，${item.intelLabel}。换血原因：${item.rankDriver}。${item.reason}`,
        tone: 'red',
      });
      return;
    }

    const rankDelta = prev.rank - item.rank;
    const scoreDelta = item.score - prev.score;
    const riskDown = prev.riskLevel !== item.riskLevel && item.riskLevel === 'high';
    const upgraded = rankDelta >= 3 || scoreDelta >= 8;
    const downgraded = rankDelta <= -3 || scoreDelta <= -8 || riskDown;

    if (upgraded) {
      logs.push({
        id: `${Date.now()}-${item.code}-up`,
        time,
        code: item.code,
        name: item.name,
        type: '升级',
        title: `${item.name} 排名上移`,
        detail: `#${prev.rank} → #${item.rank}，分数${prev.score} → ${item.score}，${item.intelLabel}，主要因${item.rankDriver}`,
        tone: 'red',
      });
    } else if (downgraded) {
      logs.push({
        id: `${Date.now()}-${item.code}-down`,
        time,
        code: item.code,
        name: item.name,
        type: '降级',
        title: `${item.name} 权重降级`,
        detail: `#${prev.rank} → #${item.rank}，分数${prev.score} → ${item.score}，风险${prev.riskLevel} → ${item.riskLevel}，${item.intelLabel}，${item.rankDriver}`,
        tone: 'yellow',
      });
    }
  });

  previous.forEach(item => {
    if (currMap.has(item.code)) return;
    logs.push({
      id: `${Date.now()}-${item.code}-out`,
      time,
      code: item.code,
      name: item.name,
      type: '出池',
      title: `${item.name} 暂时出池`,
      detail: `上一轮排名#${item.rank}，当前被更高分候选替代；原换血因子：${item.rankDriver}；原依据：${item.reason}`,
      tone: 'green',
    });
  });

  return logs.slice(0, 8);
}
