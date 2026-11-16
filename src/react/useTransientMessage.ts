import { useCallback, useEffect, useRef, useState } from 'react';

export interface TransientMessageState {
  message: string | null;
  showMessage: (msg: string, customDurationMs?: number) => void;
  clearMessage: () => void;
}

export function useTransientMessage(durationMs = 2500): TransientMessageState {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMessage = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage(null);
  }, []);

  const showMessage = useCallback(
    (msg: string, customDurationMs?: number) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setMessage(msg);
      const ttl = customDurationMs ?? durationMs;
      if (ttl > 0) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setMessage(null);
        }, ttl);
      }
    },
    [durationMs],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { message, showMessage, clearMessage };
}

