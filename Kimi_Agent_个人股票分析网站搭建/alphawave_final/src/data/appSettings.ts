export interface AppSettings {
  commission: string;
  minFee: string;
  stampDuty: string;
  transferFee: string;
  defaultPeriod: string;
  defaultIndicators: string[];
  riskAlert: string;
}

const SETTINGS_KEY = 'alphawave_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  commission: '0.025',
  minFee: '5',
  stampDuty: '0.1',
  transferFee: '0.001',
  defaultPeriod: '120',
  defaultIndicators: ['ma', 'macd', 'cci'],
  riskAlert: '10',
};

export function getAppSettings(): AppSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('alphawave:settings-changed', { detail: settings }));
}

export function calcTradeFee(price: number, shares: number, side: 'buy' | 'sell') {
  const settings = getAppSettings();
  const amount = price * shares;
  const commission = Math.max(amount * (parseFloat(settings.commission) || 0) / 100, parseFloat(settings.minFee) || 0);
  const transfer = amount * (parseFloat(settings.transferFee) || 0) / 100;
  const stamp = side === 'sell' ? amount * (parseFloat(settings.stampDuty) || 0) / 100 : 0;
  return +(commission + transfer + stamp).toFixed(2);
}
