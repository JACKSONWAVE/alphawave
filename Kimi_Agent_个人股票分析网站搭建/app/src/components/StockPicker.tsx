import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { StockListItem } from '../data/mockData';

interface StockPickerProps {
  stocks: StockListItem[];
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  className?: string;
  limit?: number;
}

export default function StockPicker({ stocks, value, onChange, placeholder = '输入代码/名称/行业', className = '', limit = 30 }: StockPickerProps) {
  const selected = useMemo(() => stocks.find(stock => stock.code === value), [stocks, value]);
  const [query, setQuery] = useState(selected ? `${selected.code} ${selected.name}` : '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const next = selected ? `${selected.code} ${selected.name}` : '';
    setQuery(next);
  }, [selected?.code, selected?.name]);

  const candidates = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return [];
    return stocks.filter(stock =>
      stock.code.toLowerCase().includes(keyword) ||
      stock.name.toLowerCase().includes(keyword) ||
      stock.industry.toLowerCase().includes(keyword)
    ).slice(0, limit);
  }, [query, stocks, limit]);

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t-textDim pointer-events-none" />
      <input
        value={query}
        onFocus={() => setOpen(Boolean(query.trim()))}
        onChange={event => {
          setQuery(event.target.value);
          setOpen(Boolean(event.target.value.trim()));
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' && candidates[0]) pick(candidates[0].code);
          if (event.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder}
        className="w-full bg-t-bg border border-t-border rounded pl-7 pr-2 py-1 text-sm text-t-text outline-none placeholder-t-textDim/60 focus:border-t-blue"
      />
      {open && candidates.length > 0 && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[280px] max-h-72 overflow-y-auto rounded border border-t-border bg-t-panel shadow-xl scrollbar-thin">
          {candidates.map(stock => (
            <button
              key={stock.code}
              type="button"
              onMouseDown={event => {
                event.preventDefault();
                pick(stock.code);
              }}
              className="w-full px-3 py-2 text-left text-xs hover:bg-white/[0.04] flex items-center justify-between gap-3"
            >
              <span className="text-t-text truncate">{stock.name}</span>
              <span className="data-num text-t-textDim whitespace-nowrap">{stock.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
