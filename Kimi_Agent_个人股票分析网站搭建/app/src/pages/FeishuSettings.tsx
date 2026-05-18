import { useState, useEffect } from 'react';
import { Send, Save, BookOpen, Plus, Bell, Play, Square, Cloud, Eye, EyeOff } from 'lucide-react';
import { getStockList } from '../data/mockData';
import { saveFeishuConfig, getFeishuConfig, generateMorningReport, sendToFeishu, startAutoPush, stopAutoPush, FEISHU_GUIDE } from '../components/FeishuBot';
import type { FeishuConfig } from '../components/FeishuBot';

function getLocalWatchCodes() {
  try {
    const items = JSON.parse(localStorage.getItem('watchlist') || '[]') as Array<{ code: string }>;
    return items.map(item => item.code).filter(Boolean);
  } catch {
    return [];
  }
}

export default function FeishuSettings() {
  const stocks = getStockList();
  const existing = getFeishuConfig();
  const localWatchCodes = getLocalWatchCodes();

  const [webhook, setWebhook] = useState(existing?.webhook || '');
  const [watchList, setWatchList] = useState<string[]>(existing?.watchList || (localWatchCodes.length ? localWatchCodes : ['603019.SH', '002594.SZ', '600519.SH']));
  const [pushTime, setPushTime] = useState(existing?.pushTime || '09:00');
  const [showGuide, setShowGuide] = useState(false);
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState('');
  const [autoPush, setAutoPush] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);

  const saveConfig = () => {
    const config: FeishuConfig = { webhook, watchList, pushTime, pushType: 'morning' };
    saveFeishuConfig(config);
    window.dispatchEvent(new CustomEvent('alphawave:settings-changed', { detail: { feishu: true } }));
    setStatus('配置已保存');
    setTimeout(() => setStatus(''), 2000);
  };

  const syncWatchlist = () => {
    const next = getLocalWatchCodes();
    if (next.length === 0) {
      setStatus('自选股为空，未同步');
      return;
    }
    setWatchList(next);
    setStatus(`已同步 ${next.length} 只自选股`);
    setTimeout(() => setStatus(''), 2000);
  };

  const doPush = async () => {
    if (!webhook) { setStatus('请先填写Webhook地址'); return; }
    setStatus('正在生成报告并推送...');
    try {
      const report = await generateMorningReport(watchList);
      setPreview(report);
      const ok = await sendToFeishu(webhook, report);
      setStatus(ok ? '✅ 推送成功！' : '❌ 推送失败');
    } catch {
      setStatus('生成报告失败');
    }
  };

  const toggleAutoPush = () => {
    if (autoPush) {
      stopAutoPush();
      setAutoPush(false);
      setStatus('自动推送已停止');
    } else {
      if (!webhook) { setStatus('请先填写Webhook'); return; }
      startAutoPush(webhook, watchList, pushTime);
      setAutoPush(true);
      setStatus('✅ 自动推送已启动（需保持页面打开）');
    }
  };

  const toggleWatch = (code: string) => {
    setWatchList(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  useEffect(() => {
    return () => { if (autoPush) stopAutoPush(); };
  }, [autoPush]);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-t-textBright flex items-center gap-2">
          <Bell className="w-5 h-5 text-t-blue" /> 飞书AI助手 - 波段策略推送
        </h1>
        <button onClick={() => setShowGuide(!showGuide)} className="text-xs text-t-blue hover:underline flex items-center gap-1">
          <BookOpen className="w-3 h-3" /> {showGuide ? '隐藏' : '查看'}配置指南
        </button>
      </div>

      {showGuide && (
        <div className="panel p-4 text-xs text-t-textSecondary leading-relaxed whitespace-pre-line">
          {FEISHU_GUIDE}
        </div>
      )}

      <div className="panel p-4 border-t-blue/30 bg-t-blue/5">
        <h2 className="text-sm font-semibold text-t-textBright mb-2 flex items-center gap-2">
          <Cloud className="w-4 h-4 text-t-blue" /> 云端自动推送
        </h2>
        <p className="text-xs text-t-textSecondary leading-relaxed">
          已新增 Vercel 定时接口 <span className="data-num text-t-blue">/api/feishu-cron?type=morning</span>。
          部署后只要在 Vercel 环境变量里配置 FEISHU_WEBHOOK、FEISHU_WATCHLIST、CRON_SECRET，
          早盘策略会由云端自动发送，不需要保持网页打开。
        </p>
      </div>

      {/* Webhook */}
      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-t-textBright mb-3">Webhook 配置</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-t-textDim mb-1 block">飞书机器人 Webhook 地址</label>
            <div className="flex gap-2">
              <input type={showWebhook ? 'text' : 'password'} value={webhook} onChange={e => setWebhook(e.target.value)} placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxxx"
                className="w-full bg-t-bg border border-t-border rounded px-3 py-2 text-sm text-t-text outline-none focus:border-t-blue" />
              <button type="button" onClick={() => setShowWebhook(v => !v)}
                className="px-3 rounded border border-t-border text-t-textDim hover:text-t-text transition-colors"
                title={showWebhook ? '隐藏Webhook' : '显示Webhook'}>
                {showWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-t-textDim mt-1">保存后默认隐藏，防止别人看到你的飞书机器人地址；线上长期使用建议放到 Vercel 环境变量。</p>
          </div>
          <div>
            <label className="text-xs text-t-textDim mb-1 block">早盘推送时间（盘前策略报告）</label>
            <input type="time" value={pushTime} onChange={e => setPushTime(e.target.value)}
              className="bg-t-bg border border-t-border rounded px-3 py-2 text-sm text-t-text outline-none" />
          </div>
        </div>
      </div>

      {/* 关注股票 */}
      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-t-textBright mb-3">关注股票 ({watchList.length}只)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto scrollbar-thin">
          {stocks.map(s => {
            const watched = watchList.includes(s.code);
            return (
              <button key={s.code} onClick={() => toggleWatch(s.code)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${watched ? 'bg-t-blue/15 text-t-blue border border-t-blue/30' : 'text-t-textDim border border-t-border hover:text-t-text'}`}>
                {watched ? <Bell className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                <span className="truncate">{s.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 推送内容说明 */}
      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-t-textBright mb-3">推送内容</h2>
        <div className="space-y-2 text-xs text-t-textSecondary">
          <div className="flex items-start gap-2">
            <span className="w-6 h-6 rounded bg-t-blue/15 text-t-blue flex items-center justify-center flex-shrink-0 text-[10px]">早</span>
            <div>
              <span className="text-t-text font-medium">盘前策略报告</span>
              <span className="text-t-textDim ml-2">{pushTime} 推送</span>
              <p className="text-t-textDim mt-0.5">今日动作、买区、突破线、止损、目标、盈亏比、仓位建议和走势剧本</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-6 h-6 rounded bg-t-yellow/15 text-t-yellow flex items-center justify-center flex-shrink-0 text-[10px]">盘</span>
            <div>
              <span className="text-t-text font-medium">盘中信号提醒</span>
              <span className="text-t-textDim ml-2">交易时间自动检查</span>
              <p className="text-t-textDim mt-0.5">突破压力、回踩买区、跌破止损、接近止盈时触发</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-6 h-6 rounded bg-t-green/15 text-t-green flex items-center justify-center flex-shrink-0 text-[10px]">收</span>
            <div>
              <span className="text-t-text font-medium">收盘总结</span>
              <span className="text-t-textDim ml-2">15:05 推送</span>
              <p className="text-t-textDim mt-0.5">当日状态、次日关键价、飞书触发价和策略回测参考</p>
            </div>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-3">
        <button onClick={saveConfig} className="px-4 py-2 rounded bg-t-blue text-white text-sm hover:bg-blue-500 flex items-center gap-2">
          <Save className="w-4 h-4" /> 保存配置
        </button>
        <button onClick={syncWatchlist} className="px-4 py-2 rounded border border-t-border text-t-textDim text-sm hover:text-t-text flex items-center gap-2">
          <Bell className="w-4 h-4" /> 同步自选股
        </button>
        <button onClick={doPush} className="px-4 py-2 rounded bg-t-green text-white text-sm hover:bg-green-600 flex items-center gap-2">
          <Send className="w-4 h-4" /> 立即推送测试
        </button>
        <button onClick={toggleAutoPush}
          className={`px-4 py-2 rounded text-sm flex items-center gap-2 ${autoPush ? 'bg-t-red text-white hover:bg-red-600' : 'bg-t-yellow text-t-bg hover:bg-yellow-500'}`}>
          {autoPush ? <><Square className="w-4 h-4" /> 停止自动推送</> : <><Play className="w-4 h-4" /> 开启自动推送</>}
        </button>
        {status && <span className="text-xs text-t-textDim self-center">{status}</span>}
      </div>

      {/* 推送预览 */}
      {preview && (
        <div className="panel p-4">
          <h2 className="text-sm font-semibold text-t-textBright mb-2">推送预览</h2>
          <pre className="text-xs text-t-textSecondary whitespace-pre-wrap leading-relaxed">{preview}</pre>
        </div>
      )}
    </div>
  );
}
