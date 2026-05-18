import { useEffect, useMemo, useRef, useState } from 'react';
import type { StrategyPlan } from '../data/strategyEngine';
import { formatPrice } from '../data/price';

type Indicator = 'ma' | 'macd' | 'rsi' | 'kdj' | 'boll' | 'cci' | 'wr';

interface ChartPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma5?: number | null;
  ma10?: number | null;
  ma20?: number | null;
  ma60?: number | null;
  buySignal?: number | null;
  sellSignal?: number | null;
}

interface Props {
  data: ChartPoint[];
  indicators: Indicator[];
  showSignals: boolean;
  chartMode: 'candle' | 'line';
  plan: StrategyPlan;
}

const maLines = [
  { key: 'ma5', label: 'MA5', color: '#facc15' },
  { key: 'ma10', label: 'MA10', color: '#60a5fa' },
  { key: 'ma20', label: 'MA20', color: '#c084fc' },
  { key: 'ma60', label: 'MA60', color: '#22d3ee' },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function linePath(
  points: ChartPoint[],
  getValue: (point: ChartPoint) => number | null | undefined,
  xOf: (index: number) => number,
  yOf: (value: number) => number
) {
  let path = '';
  points.forEach((point, index) => {
    const value = getValue(point);
    if (value === null || value === undefined || Number.isNaN(value)) return;
    path += `${path ? ' L' : 'M'} ${xOf(index).toFixed(2)} ${yOf(value).toFixed(2)}`;
  });
  return path;
}

export function ProKlineChart({ data, indicators, showSignals, chartMode, plan }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; end: number } | null>(null);

  const [width, setWidth] = useState(900);
  const [visibleCount, setVisibleCount] = useState(120);
  const [endIndex, setEndIndex] = useState(data.length - 1);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [crosshairLocked, setCrosshairLocked] = useState(false);
  const [cursorGlobalIndex, setCursorGlobalIndex] = useState<number | null>(null);

  useEffect(() => {
    setEndIndex(data.length - 1);
    setVisibleCount(count => clamp(count, 40, Math.max(40, data.length)));
  }, [data.length]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      setWidth(Math.max(360, Math.floor(entries[0].contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (cursorGlobalIndex === null || data.length === 0) return;
    setCursorGlobalIndex(clamp(cursorGlobalIndex, 0, data.length - 1));
  }, [cursorGlobalIndex, data.length]);

  useEffect(() => {
    if (!crosshairLocked) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && wrapRef.current?.contains(target)) return;
      setCrosshairLocked(false);
      setCursorGlobalIndex(null);
      setHoverIndex(null);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [crosshairLocked]);

  const height = 430;
  const top = 18;
  const priceHeight = 328;
  const volumeTop = 356;
  const volumeHeight = 58;
  const left = 6;
  const right = 64;
  const chartWidth = Math.max(240, width - left - right);

  const view = useMemo(() => {
    const count = clamp(visibleCount, 40, Math.max(40, data.length));
    const end = clamp(endIndex, count - 1, data.length - 1);
    const start = Math.max(0, end - count + 1);
    return data.slice(start, end + 1).map((item, localIndex) => ({ ...item, localIndex, globalIndex: start + localIndex }));
  }, [data, endIndex, visibleCount]);

  useEffect(() => {
    if (!crosshairLocked) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (cursorGlobalIndex === null) return;
      const minEnd = Math.min(visibleCount - 1, data.length - 1);
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const next = clamp(cursorGlobalIndex - 1, 0, data.length - 1);
        setCursorGlobalIndex(next);
        if (next < endIndex - visibleCount + 1) {
          setEndIndex(clamp(next + visibleCount - 1, minEnd, data.length - 1));
        }
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        const next = clamp(cursorGlobalIndex + 1, 0, data.length - 1);
        setCursorGlobalIndex(next);
        if (next > endIndex) {
          setEndIndex(clamp(next, minEnd, data.length - 1));
        }
      } else if (event.key === 'Escape') {
        setCrosshairLocked(false);
        setCursorGlobalIndex(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [crosshairLocked, cursorGlobalIndex, endIndex, visibleCount, data.length]);

  const priceRange = useMemo(() => {
    const values = view.flatMap(point => [
      point.high,
      point.low,
      point.ma5,
      point.ma10,
      point.ma20,
      point.ma60,
      plan.entryZone.low,
      plan.entryZone.high,
      plan.stopLoss,
      plan.target1,
    ]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.14, max * 0.01);
    return { min: min - pad, max: max + pad };
  }, [view, plan]);

  const maxVolume = Math.max(...view.map(point => point.volume || 0), 1);
  const candleGap = chartWidth / Math.max(view.length, 1);
  const candleWidth = clamp(candleGap * 0.58, 2, 10);
  const xOf = (index: number) => left + index * candleGap + candleGap / 2;
  const yOf = (value: number) => top + (priceRange.max - value) / (priceRange.max - priceRange.min) * priceHeight;
  const volumeY = (value: number) => volumeTop + volumeHeight - value / maxVolume * volumeHeight;

  const activeLocalIndex = useMemo(() => {
    if (crosshairLocked && cursorGlobalIndex !== null) {
      const index = view.findIndex(point => point.globalIndex === cursorGlobalIndex);
      if (index >= 0) return index;
    }
    return hoverIndex;
  }, [crosshairLocked, cursorGlobalIndex, view, hoverIndex]);

  const hover = crosshairLocked && activeLocalIndex !== null ? view[activeLocalIndex] : null;
  const priceTicks = Array.from({ length: 6 }, (_, index) => priceRange.min + (priceRange.max - priceRange.min) * index / 5).reverse();
  const xTicks = view.filter((_, index) => index % Math.max(1, Math.floor(view.length / 8)) === 0);

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    if (!crosshairLocked) return;
    event.preventDefault();
    event.stopPropagation();
    const direction = event.deltaY > 0 ? 1 : -1;
    setVisibleCount(count => clamp(count + direction * Math.ceil(count * 0.12), 40, Math.max(40, data.length)));
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !crosshairLocked) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const direction = event.deltaY > 0 ? 1 : -1;
      setVisibleCount(count => clamp(count + direction * Math.ceil(count * 0.12), 40, Math.max(40, data.length)));
    };
    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, [crosshairLocked, data.length]);

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = { x: event.clientX, end: endIndex };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - bounds.left - left;
    const nextLocalIndex = clamp(Math.round(localX / candleGap - 0.5), 0, view.length - 1);
    if (!crosshairLocked) {
      setHoverIndex(nextLocalIndex);
    }

    if (!dragRef.current) return;
    const delta = event.clientX - dragRef.current.x;
    const shift = Math.round(delta / candleGap);
    setEndIndex(clamp(dragRef.current.end - shift, Math.min(visibleCount - 1, data.length - 1), data.length - 1));
  };

  const stopDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // pointer capture can already be released by browser
    }
  };

  const activateCrosshair = (event: React.MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - bounds.left - left;
    const nextLocalIndex = clamp(Math.round(localX / candleGap - 0.5), 0, view.length - 1);
    const nextGlobal = view[nextLocalIndex]?.globalIndex ?? null;
    if (nextGlobal === null) return;
    setCrosshairLocked(true);
    setCursorGlobalIndex(nextGlobal);
    setHoverIndex(nextLocalIndex);
    svgRef.current?.focus();
  };

  return (
    <div ref={wrapRef} className="select-none rounded border border-[#263042] bg-[#111318] overflow-hidden">
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block cursor-grab active:cursor-grabbing"
        tabIndex={0}
        onWheel={handleWheel}
        onClick={activateCrosshair}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerLeave={event => { if (!crosshairLocked) setHoverIndex(null); stopDrag(event); }}
      >
        <rect x={0} y={0} width={width} height={height} fill="#111318" />

        {priceTicks.map(price => (
          <g key={price}>
            <line x1={0} x2={width} y1={yOf(price)} y2={yOf(price)} stroke="#2d3b50" strokeDasharray="2 4" strokeWidth={0.8} />
            <text x={width - 8} y={yOf(price) - 4} textAnchor="end" fill="#8b96a9" fontSize={10}>{formatPrice(price)}</text>
          </g>
        ))}

        {xTicks.map(point => (
          <g key={point.date}>
            <line x1={xOf(point.localIndex)} x2={xOf(point.localIndex)} y1={top} y2={volumeTop + volumeHeight} stroke="#1f2937" strokeDasharray="2 5" strokeWidth={0.7} />
            <text x={xOf(point.localIndex)} y={height - 7} textAnchor="middle" fill="#6b7280" fontSize={10}>{point.date.slice(5)}</text>
          </g>
        ))}

        <ReferenceBand y1={plan.entryZone.low} y2={plan.entryZone.high} x={left} width={chartWidth} yOf={yOf} color="#16a34a" />
        <ReferenceLine value={plan.stopLoss} x={left} width={chartWidth} yOf={yOf} color="#ef4444" />
        <ReferenceLine value={plan.target1} x={left} width={chartWidth} yOf={yOf} color="#3b82f6" />

        {chartMode === 'line' ? (
          <path d={linePath(view, point => point.close, xOf, yOf)} fill="none" stroke="#22d3ee" strokeWidth={1.5} />
        ) : view.map(point => {
          const x = xOf(point.localIndex);
          const up = point.close >= point.open;
          const color = up ? '#ef4444' : '#00c2c7';
          const openY = yOf(point.open);
          const closeY = yOf(point.close);
          const highY = yOf(point.high);
          const lowY = yOf(point.low);
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(1.5, Math.abs(openY - closeY));
          return (
            <g key={point.date}>
              <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeWidth={1} />
              <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={up ? color : '#111318'} stroke={color} strokeWidth={1} />
            </g>
          );
        })}

        {indicators.includes('ma') && maLines.map(line => (
          <path key={line.key} d={linePath(view, point => point[line.key], xOf, yOf)} fill="none" stroke={line.color} strokeWidth={1.05} />
        ))}

        {view.map(point => {
          const x = xOf(point.localIndex);
          const barTop = volumeY(point.volume || 0);
          const color = point.close >= point.open ? '#ef4444' : '#00c2c7';
          return <rect key={`vol-${point.date}`} x={x - candleWidth / 2} y={barTop} width={candleWidth} height={volumeTop + volumeHeight - barTop} fill={color} opacity={0.22} />;
        })}

        {showSignals && view.map(point => {
          const x = xOf(point.localIndex);
          if (point.buySignal) return <path key={`buy-${point.date}`} d={`M ${x} ${yOf(point.low) + 12} l -5 9 h 10 z`} fill="#ef4444" opacity={0.9} />;
          if (point.sellSignal) return <path key={`sell-${point.date}`} d={`M ${x} ${yOf(point.high) - 12} l -5 -9 h 10 z`} fill="#22c55e" opacity={0.9} />;
          return null;
        })}

        {hover && (
          <g>
            <line x1={xOf(hover.localIndex)} x2={xOf(hover.localIndex)} y1={top} y2={volumeTop + volumeHeight} stroke="#d1d5db" strokeWidth={0.7} opacity={0.45} />
            <line x1={0} x2={width} y1={yOf(hover.close)} y2={yOf(hover.close)} stroke="#d1d5db" strokeWidth={0.7} opacity={0.35} />
            <rect x={Math.min(xOf(hover.localIndex) + 12, width - 172)} y={28} width={160} height={126} rx={6} fill="#151a23" stroke="#334155" opacity={0.96} />
            <TooltipText x={Math.min(xOf(hover.localIndex) + 24, width - 160)} y={50} label={hover.date} strong />
            <TooltipText x={Math.min(xOf(hover.localIndex) + 24, width - 160)} y={72} label={`开 ${formatPrice(hover.open)}  高 ${formatPrice(hover.high)}`} />
            <TooltipText x={Math.min(xOf(hover.localIndex) + 24, width - 160)} y={92} label={`低 ${formatPrice(hover.low)}  收 ${formatPrice(hover.close)}`} />
            <TooltipText x={Math.min(xOf(hover.localIndex) + 24, width - 160)} y={112} label={`量 ${(hover.volume / 10000).toFixed(0)}万`} />
            {indicators.includes('ma') && <TooltipText x={Math.min(xOf(hover.localIndex) + 24, width - 160)} y={134} label={`MA5 ${hover.ma5 ? formatPrice(hover.ma5) : '-'} / MA20 ${hover.ma20 ? formatPrice(hover.ma20) : '-'}`} />}
          </g>
        )}
      </svg>
      <div className="flex flex-wrap items-center gap-3 border-t border-[#263042] px-3 py-2 text-[11px] text-t-textDim">
        <span>点击锁定十字线</span>
        <span>锁定后滚轮缩放时间</span>
        <span>左右键逐K切换</span>
        {indicators.includes('ma') && maLines.map(line => <span key={line.key} style={{ color: line.color }}>{line.label}</span>)}
      </div>
    </div>
  );
}

function ReferenceBand({ y1, y2, x, width, yOf, color }: { y1: number; y2: number; x: number; width: number; yOf: (value: number) => number; color: string }) {
  const top = Math.min(yOf(y1), yOf(y2));
  const height = Math.max(1, Math.abs(yOf(y1) - yOf(y2)));
  return <rect x={x} y={top} width={width} height={height} fill={color} opacity={0.08} />;
}

function ReferenceLine({ value, x, width, yOf, color }: { value: number; x: number; width: number; yOf: (value: number) => number; color: string }) {
  const y = yOf(value);
  return (
    <g>
      <line x1={x} x2={x + width} y1={y} y2={y} stroke={color} strokeDasharray="5 5" strokeWidth={0.9} opacity={0.7} />
      <text x={x + width + 4} y={y + 3} fill={color} fontSize={10}>{formatPrice(value)}</text>
    </g>
  );
}

function TooltipText({ x, y, label, strong }: { x: number; y: number; label: string; strong?: boolean }) {
  return <text x={x} y={y} fill={strong ? '#f8fafc' : '#cbd5e1'} fontSize={11} fontWeight={strong ? 700 : 400}>{label}</text>;
}
