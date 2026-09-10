import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Replaces Firestore's onSnapshot: fetch now, then every `intervalMs` while the tab is
 * visible, and again when it becomes visible. `refresh()` forces a fetch (call it after a
 * write so the UI reflects it immediately).
 *
 * `fetcher` should be stable or its identity should follow `deps`; pass `null` to pause.
 */
export function usePoll<T>(fetcher: (() => Promise<T>) | null, deps: unknown[], intervalMs = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    const f = fetcherRef.current;
    if (!f) return;
    try {
      const v = await f();
      if (!alive.current) return;
      setData(v);
      setError(null);
    } catch (e) {
      if (!alive.current) return;
      setError(e);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    if (!fetcher) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      alive.current = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs, fetcher === null]);

  return { data, error, loading, refresh };
}
