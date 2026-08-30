import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { buildResearchModel, calculateResearchDcf, defaultOperatingAssumptions, scenarioPresets, type ModelScenario, type OperatingAssumptions } from '../data/researchModel';

type ResearchModelContextValue = {
  assumptions: OperatingAssumptions;
  scenario: ModelScenario;
  model: ReturnType<typeof buildResearchModel>;
  dcf: ReturnType<typeof calculateResearchDcf>;
  updateAssumption: (key: keyof OperatingAssumptions, value: number) => void;
  setScenario: (scenario: ModelScenario) => void;
  resetModel: () => void;
};

const ResearchModelContext = createContext<ResearchModelContextValue | null>(null);

export function ResearchModelProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenarioState] = useState<ModelScenario>('base');
  const [assumptions, setAssumptions] = useState<OperatingAssumptions>(defaultOperatingAssumptions);
  const model = useMemo(() => buildResearchModel(assumptions), [assumptions]);
  const dcf = useMemo(() => calculateResearchDcf(assumptions), [assumptions]);
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
  };
  return <ResearchModelContext.Provider value={{ assumptions, scenario, model, dcf, updateAssumption, setScenario, resetModel }}>{children}</ResearchModelContext.Provider>;
}

export function useResearchModel() {
  const context = useContext(ResearchModelContext);
  if (!context) throw new Error('useResearchModel must be used within ResearchModelProvider');
  return context;
}
