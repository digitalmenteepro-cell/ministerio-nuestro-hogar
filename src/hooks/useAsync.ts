import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/utils';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/** Fetch-on-mount with loading/error state and a manual reload trigger. */
export function useAsync<T>(fn: () => Promise<T>, deps: React.DependencyList = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const alive = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    setError(null);

    fnRef
      .current()
      .then((result) => {
        if (alive.current) setData(result);
      })
      .catch((err) => {
        if (alive.current) setError(errorMessage(err));
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });

    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, reload, setData };
}
