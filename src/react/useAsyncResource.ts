import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncResourceOptions<T> {
  initialData?: T | null;
  enabled?: boolean;
}

export interface AsyncResourceState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<T | null>;
}

export function useAsyncResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[] = [],
  options: AsyncResourceOptions<T> = {},
): AsyncResourceState<T> {
  const { initialData = null, enabled = true } = options;
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState<boolean>(Boolean(enabled));
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const activeControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeControllerRef.current?.abort();
    };
  }, []);

  const execute = useCallback(async (): Promise<T | null> => {
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const value = await fetcherRef.current(controller.signal);
      if (!controller.signal.aborted && mountedRef.current) {
        setData(value);
        setLoading(false);
      }
      return value;
    } catch (err) {
      if (controller.signal.aborted || !mountedRef.current) {
        return null;
      }
      const normalized = err instanceof Error ? err : new Error(String(err));
      setError(normalized);
      setLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void execute();
    return () => {
      activeControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, execute, ...deps]);

  return { data, loading, error, reload: execute };
}

