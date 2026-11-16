import { useCallback, useState } from 'react';

function resolveInitial<T>(initialValue: T | (() => T)): T {
  return typeof initialValue === 'function'
    ? (initialValue as () => T)()
    : initialValue;
}

export function useLocalStorageState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return resolveInitial(initialValue);
    }
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
    } catch {
      // Ignore malformed storage entries and fall back cleanly
    }
    return resolveInitial(initialValue);
  });

  const setPersistedState = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next =
          typeof updater === 'function'
            ? (updater as (current: T) => T)(prev)
            : updater;
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, JSON.stringify(next));
          } catch {
            // Ignore quota or storage restriction errors
          }
        }
        return next;
      });
    },
    [key],
  );

  return [state, setPersistedState];
}

