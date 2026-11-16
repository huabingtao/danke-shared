import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useAsyncResource,
  useEscapeKey,
  useLocalStorageState,
  useTransientMessage,
} from '../src/react';

describe('@danke/shared React hooks', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('useAsyncResource loads data and supports abort/reload', async () => {
    let calls = 0;
    const { result } = renderHook(() =>
      useAsyncResource(async () => {
        calls += 1;
        return { count: calls };
      }, []),
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ count: 1 });
    expect(result.current.error).toBeNull();

    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.data).toEqual({ count: 2 });
  });

  it('useTransientMessage sets and auto-clears messages', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTransientMessage(1000));

    act(() => {
      result.current.showMessage('已保存');
    });
    expect(result.current.message).toBe('已保存');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.message).toBeNull();
  });

  it('useLocalStorageState reads and persists JSON state', () => {
    window.localStorage.setItem('dk_test_pref', JSON.stringify({ theme: 'dark' }));
    const { result } = renderHook(() =>
      useLocalStorageState('dk_test_pref', { theme: 'light' }),
    );
    expect(result.current[0]).toEqual({ theme: 'dark' });

    act(() => {
      result.current[1]({ theme: 'light' });
    });
    expect(JSON.parse(window.localStorage.getItem('dk_test_pref') || '{}')).toEqual({
      theme: 'light',
    });
  });

  it('useEscapeKey fires callback only when enabled', () => {
    const handler = vi.fn();
    const { rerender } = renderHook(
      ({ active }) => useEscapeKey(active, handler),
      { initialProps: { active: false } },
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(handler).not.toHaveBeenCalled();

    rerender({ active: true });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

