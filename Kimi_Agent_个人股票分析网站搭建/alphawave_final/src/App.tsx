import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';

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
          <Route path="/" element={<AdvisoryDashboard />} />
          <Route path="/analysis" element={<CompanyResearch />} />
          <Route path="/watchlist" element={<CoveragePipeline />} />
          <Route path="/valuation" element={<ValuationCenter />} />
          <Route path="/comparables" element={<ComparableCompanies />} />
          <Route path="/versions" element={<ModelVersions />} />
          <Route path="/diligence" element={<DiligenceCenter />} />
          <Route path="/intel" element={<CatalystRadar />} />
          <Route path="/feishu" element={<ResearchAssistant />} />
          <Route path="/portfolio" element={<Navigate to="/valuation" replace />} />
          <Route path="/screener" element={<Navigate to="/comparables" replace />} />
          <Route path="/trades" element={<Navigate to="/versions" replace />} />
          <Route path="/alerts" element={<Navigate to="/diligence" replace />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
