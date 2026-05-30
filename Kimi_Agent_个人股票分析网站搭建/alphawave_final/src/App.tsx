import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import Watchlist from './pages/Watchlist';
import Portfolio from './pages/Portfolio';
import Screener from './pages/Screener';
import Trades from './pages/Trades';
import Alerts from './pages/Alerts';
import FeishuSettings from './pages/FeishuSettings';
import IntelRadar from './pages/IntelRadar';
import Settings from './pages/Settings';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/screener" element={<Screener />} />
        <Route path="/trades" element={<Trades />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/intel" element={<IntelRadar />} />
        <Route path="/feishu" element={<FeishuSettings />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
