import { useEffect, useRef } from 'react';

/**
 * Custom hook to periodically poll an async or sync callback function.
 * 
 * @param callback The function to execute periodically
 * @param intervalMs The polling interval in milliseconds (default: 3000ms)
 * @param enabled Whether polling is active (default: true)
 * @param immediate Whether to run callback immediately upon activation (default: true)
 */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number = 3000,
  enabled: boolean = true,
  immediate: boolean = true
) {
  const savedCallback = useRef(callback);
  const isExecutingRef = useRef(false);

  // Remember latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    const execute = async () => {
      if (isExecutingRef.current) return;
      try {
        isExecutingRef.current = true;
        if (isMounted) {
          await savedCallback.current();
        }
      } catch (err) {
        console.error('Polling callback error:', err);
      } finally {
        isExecutingRef.current = false;
      }
    };

    if (immediate) {
      execute();
    }

    const timer = setInterval(() => {
      execute();
    }, intervalMs);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [intervalMs, enabled, immediate]);
}

export default usePolling;
