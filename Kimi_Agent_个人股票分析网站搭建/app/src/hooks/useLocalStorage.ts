import { useState, useCallback } from 'react';

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [val, setVal] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; }
    catch { return initial; }
  });
  const set = useCallback((v: T | ((p: T) => T)) => {
    setVal(p => {
      const n = typeof v === 'function' ? (v as (p: T) => T)(p) : v;
      try { localStorage.setItem(key, JSON.stringify(n)); } catch { }
      return n;
    });
  }, [key]);
  return [val, set];
}
