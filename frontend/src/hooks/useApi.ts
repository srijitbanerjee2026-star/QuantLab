// SWR-Style Typed API Hook with In-Memory Caching & Stale-While-Revalidate

import { useState, useEffect, useRef, useCallback } from 'react';
import { ApiResponse } from '@/lib/api';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 60000; // 1 minute fresh TTL

export interface UseApiOptions {
  enabled?: boolean;
  ttl?: number;
}

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isFallback: boolean;
  refetch: () => Promise<void>;
}

export function useApi<T>(
  key: string | null,
  fetcher: () => Promise<ApiResponse<T>>,
  options: UseApiOptions = {}
): UseApiResult<T> {
  const { enabled = true, ttl = CACHE_TTL_MS } = options;

  // Check cache for instant initial render
  const cached = key ? memoryCache.get(key) : null;
  const isFresh = cached && Date.now() - cached.timestamp < ttl;

  const [data, setData] = useState<T | null>(cached ? cached.data : null);
  const [loading, setLoading] = useState<boolean>(!isFresh && enabled && Boolean(key));
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState<boolean>(false);

  const isMountedRef = useRef<boolean>(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const executeFetch = useCallback(async () => {
    if (!key || !enabled) return;

    if (!memoryCache.has(key)) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetcherRef.current();
      if (!isMountedRef.current) return;

      memoryCache.set(key, {
        data: response.data,
        timestamp: Date.now(),
      });

      setData(response.data);
      setIsFallback(response.isFallback);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setError(err?.message || 'Failed to fetch data');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [key, enabled]);

  useEffect(() => {
    isMountedRef.current = true;
    if (enabled && key) {
      executeFetch();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [key, enabled, executeFetch]);

  return {
    data,
    loading,
    error,
    isFallback,
    refetch: executeFetch,
  };
}
