'use client';

import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) setValue(JSON.parse(stored) as T);
    } catch { /* ignore */ }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value, hydrated]);

  return [value, setValue, hydrated] as const;
}
