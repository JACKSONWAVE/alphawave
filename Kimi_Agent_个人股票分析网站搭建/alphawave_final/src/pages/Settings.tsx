import { useState } from 'react';
import { Save, RotateCcw, AlertTriangle, RefreshCw, Calendar } from 'lucide-react';
import { getAppSettings, saveAppSettings } from '../data/appSettings';
import { getIntervalPresets, getUserInterval, setUserInterval } from '../data/realtimeApi';
import { getHolidayList } from '../data/holidays';

export default function Settings() {
  const existingSettings = getAppSettings();
  const [commission, setCommission] = useState(existingSettings.commission);
  const [minFee, setMinFee] = useState(existingSettings.minFee);
  const [stampDuty, setStampDuty] = useState(existingSettings.stampDuty);
  const [transferFee, setTransferFee] = useState(existingSettings.transferFee);
  const [defaultPeriod, setDefaultPeriod] = useState(existingSettings.defaultPeriod);
  const [defaultIndicators, setDefaultIndicators] = useState(existingSettings.defaultIndicators);
  const [riskAlert, setRiskAlert] = useState(existingSettings.riskAlert);
  const [showReset, setShowReset] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(getUserInterval());
  const [savedMsg, setSavedMsg] = useState('');

  const presets = getIntervalPresets();
  const inds = [
    { key: 'ma', label: '均线 (MA)' },
    { key: 'macd', label: 'MACD' },
    { key: 'rsi', label: 'RSI' },
    { key: 'kdj', label: 'KDJ' },
    { key: 'boll', label: 'BOLL' },
    { key: 'cci', label: 'CCI' },
    { key: 'wr', label: 'WR' },
  ];

  const flash = (message: string) => {
    setSavedMsg(message);
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const saveRefreshInterval = (value: number) => {
    setRefreshInterval(value);
    setUserInterval(value);
    flash(`已设为 ${value} 秒刷新`);
  };

  const toggleInd = (key: string) => {
    setDefaultIndicators(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const saveAll = () => {
    saveAppSettings({
      commission,
      minFee,
      stampDuty,
      transferFee,
      defaultPeriod,
      defaultIndicators,
      riskAlert,
    });
    flash('设置已全局生效');
  };

  const resetAll = () => {
    if (confirm('确定要重置所有本地数据吗？这会清除自选股、预警、交易记录和设置。')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-t-textBright">系统设置</h1>
        {savedMsg && <span className="text-xs text-t-green">{savedMsg}</span>}
      </div>

      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-t-textBright mb-3">交易费率设置</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: '佣金率 (%)', value: commission, onChange: setCommission },
            { label: '最低佣金 (元)', value: minFee, onChange: setMinFee },
            { label: '印花税 (%)', value: stampDuty, onChange: setStampDuty },
            { label: '过户费 (%)', value: transferFee, onChange: setTransferFee },
          ].map(f => (
            <div key={f.label}>
              <label className="text-xs text-t-textDim mb-1 block">{f.label}</label>
              <input value={f.value} onChange={e => f.onChange(e.target.value)} className="w-full bg-t-bg border border-t-border rounded px-3 py-2 text-sm text-t-text outline-none focus:border-t-blue transition-colors" />
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-t-textBright mb-3 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-t-blue" /> 实时行情总线
        </h2>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {presets.map(p => (
              <button key={p.value} onClick={() => saveRefreshInterval(p.value)}
                className={`px-3 py-1.5 rounded text-xs transition-colors ${refreshInterval === p.value ? 'bg-t-blue text-white' : 'text-t-textDim border border-t-border hover:text-t-text hover:border-t-blue/30'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-t-textDim">
            自选股、预警、飞书和看板共用同一条实时行情总线；修改刷新间隔后立即全局生效。
          </p>
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-t-textBright mb-3">默认分析设置</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-t-textDim mb-1 block">默认K线周期</label>
            <select value={defaultPeriod} onChange={e => setDefaultPeriod(e.target.value)} className="bg-t-bg border border-t-border rounded px-3 py-2 text-sm text-t-text outline-none">
              <option value="30">30日</option>
              <option value="60">60日</option>
              <option value="120">120日</option>
              <option value="250">250日</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-t-textDim mb-2 block">默认技术指标</label>
            <div className="flex flex-wrap gap-2">
              {inds.map(ind => (
                <button key={ind.key} onClick={() => toggleInd(ind.key)}
                  className={`px-3 py-1 rounded text-xs transition-colors ${defaultIndicators.includes(ind.key) ? 'bg-t-blue/15 text-t-blue border border-t-blue/30' : 'text-t-textDim border border-t-border hover:text-t-text'}`}>
                  {ind.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-t-textDim mb-1 block">单票最大仓位 (%)</label>
            <input value={riskAlert} onChange={e => setRiskAlert(e.target.value)} className="w-24 bg-t-bg border border-t-border rounded px-3 py-2 text-sm text-t-text outline-none" />
          </div>
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-t-textBright mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-t-yellow" /> {new Date().getFullYear()}年节假日休市安排
        </h2>
        <div className="space-y-2">
          {getHolidayList().map(h => (
            <div key={h.name} className="flex items-center justify-between text-xs py-1.5 border-b border-t-border/30 last:border-0">
              <span className="text-t-text font-medium">{h.name}</span>
              <span className="text-t-textDim data-num">{h.dates}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-t-textBright mb-3">数据管理</h2>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowReset(true)} className="px-4 py-2 rounded bg-t-red/10 text-t-red text-sm border border-t-red/20 hover:bg-t-red/20 transition-colors flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> 重置所有数据
          </button>
          <span className="text-xs text-t-textDim">将清除自选股、预警、交易记录和设置</span>
        </div>
        {showReset && (
          <div className="mt-3 p-3 rounded bg-t-red/5 border border-t-red/20">
            <div className="flex items-center gap-2 text-t-red text-sm mb-2">
              <AlertTriangle className="w-4 h-4" /> 确认重置？
            </div>
            <div className="flex gap-2">
              <button onClick={resetAll} className="px-4 py-1.5 rounded bg-t-red text-white text-xs hover:bg-red-600 transition-colors">确认重置</button>
              <button onClick={() => setShowReset(false)} className="px-4 py-1.5 rounded text-t-textDim text-xs hover:text-t-text">取消</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={saveAll} className="px-4 py-2 rounded bg-t-blue text-white text-sm hover:bg-blue-500 transition-colors flex items-center gap-2">
          <Save className="w-4 h-4" /> 保存设置
        </button>
      </div>
    </div>
  );
}
