import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { buildResearchModel, calculateResearchDcf, defaultHistoricalAnchor, defaultOperatingAssumptions, deriveModelStartingPoint, scenarioPresets, type HistoricalAnchor, type HistoricalMetricKey, type ModelScenario, type OperatingAssumptions } from '../data/researchModel';

export type ModelImportVersion = {
  id: string;
  createdAt: string;
  source: string;
  acceptedCount: number;
  changedFields: HistoricalMetricKey[];
  beforePrice: number;
  afterPrice: number;
  anchor: HistoricalAnchor;
};

type ResearchModelContextValue = {
  assumptions: OperatingAssumptions;
  scenario: ModelScenario;
  historicalAnchor: HistoricalAnchor;
  modelStart: ReturnType<typeof deriveModelStartingPoint>;
  modelVersions: ModelImportVersion[];
  model: ReturnType<typeof buildResearchModel>;
  dcf: ReturnType<typeof calculateResearchDcf>;
  updateAssumption: (key: keyof OperatingAssumptions, value: number) => void;
  setScenario: (scenario: ModelScenario) => void;
  resetModel: () => void;
  applyReviewedHistoricalData: (patch: Partial<Record<HistoricalMetricKey, number>>, meta: { source: string; acceptedCount: number; }) => ModelImportVersion;
};

const ResearchModelContext = createContext<ResearchModelContextValue | null>(null);

export function ResearchModelProvider({ children }: { children: ReactNode; }) {
  const [scenario, setScenarioState] = useState<ModelScenario>('base');
  const [assumptions, setAssumptions] = useState<OperatingAssumptions>(defaultOperatingAssumptions);
  const [historicalAnchor, setHistoricalAnchor] = useState<HistoricalAnchor>(defaultHistoricalAnchor);
  const [modelVersions, setModelVersions] = useState<ModelImportVersion[]>([]);
  const modelStart = useMemo(() => deriveModelStartingPoint(historicalAnchor), [historicalAnchor]);
  const model = useMemo(() => buildResearchModel(assumptions, historicalAnchor), [assumptions, historicalAnchor]);
  const dcf = useMemo(() => calculateResearchDcf(assumptions, historicalAnchor), [assumptions, historicalAnchor]);
  const updateAssumption = (key: keyof OperatingAssumptions, value: number) => {
    setAssumptions(current => ({ ...current, [key]: value }));
    setScenarioState('base');
  };
  const setScenario = (next: ModelScenario) => {
    setScenarioState(next);
    setAssumptions(scenarioPresets[next]);
  };
  const resetModel = () => {
    setScenarioState('base');
    setAssumptions(defaultOperatingAssumptions);
    setHistoricalAnchor(defaultHistoricalAnchor);
  };
  const applyReviewedHistoricalData = (patch: Partial<Record<HistoricalMetricKey, number>>, meta: { source: string; acceptedCount: number; }) => {
    const beforePrice = calculateResearchDcf(assumptions, historicalAnchor).pricePerShare;
    const changedFields = (Object.keys(patch) as HistoricalMetricKey[]).filter(key => patch[key] !== undefined && patch[key] !== historicalAnchor[key]);
    const createdAt = new Date().toLocaleString('zh-CN', { hour12: false });
    const nextAnchor: HistoricalAnchor = { ...historicalAnchor, ...patch, source: meta.source, reviewedAt: createdAt };
    const version: ModelImportVersion = {
      id: `MODEL-${String(modelVersions.length + 1).padStart(3, '0')}`,
      createdAt,
      source: meta.source,
      acceptedCount: meta.acceptedCount,
      changedFields,
      beforePrice,
      afterPrice: calculateResearchDcf(assumptions, nextAnchor).pricePerShare,
      anchor: nextAnchor,
    };
    setHistoricalAnchor(nextAnchor);
    setModelVersions(current => [version, ...current]);
    setScenarioState('base');
    return version;
  };
  return <ResearchModelContext.Provider value={{ assumptions, scenario, historicalAnchor, modelStart, modelVersions, model, dcf, updateAssumption, setScenario, resetModel, applyReviewedHistoricalData }}>{children}</ResearchModelContext.Provider>;
}

export function useResearchModel() {
  const context = useContext(ResearchModelContext);
  if (!context) throw new Error('useResearchModel must be used within ResearchModelProvider');
  return context;
}
