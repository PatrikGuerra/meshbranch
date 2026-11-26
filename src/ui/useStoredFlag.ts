import { useState } from 'react';

// A boolean UI preference that survives reloads (panel open or closed).
export function useStoredFlag(key: string, initial: boolean): [boolean, () => void] {
  const [value, setValue] = useState(() => {
    const s = localStorage.getItem(key);
    return s === null ? initial : s === '1';
  });
  const toggle = () => setValue(v => {
    try { localStorage.setItem(key, v ? '0' : '1'); } catch { /* storage full or blocked: keep it for this visit only */ }
    return !v;
  });
  return [value, toggle];
}
