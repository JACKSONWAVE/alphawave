import { useState, useCallback, useEffect, useRef } from 'react';

const eventName = (key: string) => `alphawave:storage:${key}`;

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const initialRef = useRef(initial);
  const read = useCallback(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) as T : initialRef.current; }
    catch { return initialRef.current; }
  }, [key]);

  const [val, setVal] = useState<T>(() => {
    return read();
  });

  const set = useCallback((v: T | ((p: T) => T)) => {
    setVal(p => {
      const n = typeof v === 'function' ? (v as (p: T) => T)(p) : v;
      try {
        localStorage.setItem(key, JSON.stringify(n));
        window.dispatchEvent(new CustomEvent(eventName(key), { detail: n }));
      } catch { }
      return n;
    });
  }, [key]);

  useEffect(() => {
    const sync = () => setVal(read());
    window.addEventListener('storage', sync);
    window.addEventListener(eventName(key), sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(eventName(key), sync);
    };
  }, [key, read]);

  return [val, set];
}
