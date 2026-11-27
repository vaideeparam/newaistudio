import { useCallback, useEffect, useState } from 'react';
import { AuthRequiredError, callTool } from './mcp';
import { signIn } from './auth';

/** Load one Gateway tool result on mount. Re-runs when name or args change. */
export function useTool<T>(name: string, args: Record<string, unknown> = {}) {
  const key = JSON.stringify(args);
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        setData(await callTool<T>(name, JSON.parse(key) as Record<string, unknown>, { signal }));
        setError(null);
      } catch (e) {
        if (signal?.aborted) return;
        if (e instanceof AuthRequiredError) return signIn();
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [name, key],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void run(ctrl.signal);
    return () => ctrl.abort();
  }, [run]);

  return { data, error, loading, reload: () => run() };
}
