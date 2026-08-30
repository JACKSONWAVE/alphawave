import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analysis = lazy(() => import('./pages/Analysis'));
const Watchlist = lazy(() => import('./pages/Watchlist'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const IntelRadar = lazy(() => import('./pages/IntelRadar'));
const Screener = lazy(() => import('./pages/Screener'));
const Trades = lazy(() => import('./pages/Trades'));
const Alerts = lazy(() => import('./pages/Alerts'));
const FeishuSettings = lazy(() => import('./pages/FeishuSettings'));
const AdvisoryDashboard = lazy(() => import('./pages/AdvisoryDashboard'));
const CompanyResearch = lazy(() => import('./pages/CompanyResearch'));
const CoveragePipeline = lazy(() => import('./pages/CoveragePipeline'));
const ValuationCenter = lazy(() => import('./pages/ValuationCenter'));
const ComparableCompanies = lazy(() => import('./pages/ComparableCompanies'));
const ModelVersions = lazy(() => import('./pages/ModelVersions'));
const DiligenceCenter = lazy(() => import('./pages/DiligenceCenter'));
const ResearchAssistant = lazy(() => import('./pages/ResearchAssistant'));
const CatalystRadar = lazy(() => import('./pages/CatalystRadar'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-t-bg text-sm text-t-textDim">正在载入研究工作台…</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/intel" element={<IntelRadar />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/feishu" element={<FeishuSettings />} />
          <Route path="/settings" element={<Settings />} />

          <Route path="/capital" element={<AdvisoryDashboard />} />
          <Route path="/capital/research" element={<CompanyResearch />} />
          <Route path="/capital/coverage" element={<CoveragePipeline />} />
          <Route path="/capital/valuation" element={<ValuationCenter />} />
          <Route path="/capital/comparables" element={<ComparableCompanies />} />
          <Route path="/capital/versions" element={<ModelVersions />} />
          <Route path="/capital/diligence" element={<DiligenceCenter />} />
          <Route path="/capital/intel" element={<CatalystRadar />} />
          <Route path="/capital/assistant" element={<ResearchAssistant />} />
          <Route path="/capital/settings" element={<Settings />} />
          <Route path="/valuation" element={<Navigate to="/capital/valuation" replace />} />
          <Route path="/comparables" element={<Navigate to="/capital/comparables" replace />} />
          <Route path="/versions" element={<Navigate to="/capital/versions" replace />} />
          <Route path="/diligence" element={<Navigate to="/capital/diligence" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
