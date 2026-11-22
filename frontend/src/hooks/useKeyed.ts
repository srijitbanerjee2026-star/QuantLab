import { useEffect, useState } from 'react';

/** Loads data for a string key. `loading` is derived (key mismatch), so no synchronous setState occurs in the effect. */
export function useKeyed<T>(key: string, load: () => Promise<T>): { data: T | null; err: string | null; loading: boolean } {
  const [state, setState] = useState<{ key: string; data: T | null; err: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ key, data, err: null }))
      .catch((e) => {
        if (cancelled) return;
        const detail = (e as { response?: { data?: { detail?: unknown } }; message?: string }).response?.data?.detail;
        const msg = typeof detail === 'string' ? detail : (e as Error).message?.includes('timeout') ? 'The request timed out.' : 'Could not reach the backend or data provider.';
        setState({ key, data: null, err: msg });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const loading = state?.key !== key;
  return { data: loading ? null : state.data, err: loading ? null : state.err, loading };
}
