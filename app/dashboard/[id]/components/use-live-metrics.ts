"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Live metrics snapshot - shows current system state
 * Polled at regular intervals when server is running
 */
export interface LiveMetrics {
  // Percentage 0-100
  cpu: number;
  // Percentage 0-100
  memory: number;
  // Bytes per second
  networkIn: number;
  // Bytes per second
  networkOut: number;
  // Seconds
  uptime: number;
  // Current players
  playerCount?: number;
  // Max players
  maxPlayers?: number;
  // Ticks per second (if available)
  tps?: number;
}

export interface UseLiveMetricsReturn {
  metrics: LiveMetrics | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching and polling live server metrics
 * Automatically refreshes every pollInterval ms when server is running
 */
export const useLiveMetrics = (
  serverId: string,
  observedState: string,
  pollInterval = 5000
): UseLiveMetricsReturn => {
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (observedState !== "running") {
      setMetrics(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/servers/${serverId}/metrics/live`, {
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Endpoint doesn't exist yet or server has no metrics
          setMetrics(null);
        } else {
          throw new Error("Failed to fetch metrics");
        }
        return;
      }

      const data = await response.json();
      setMetrics(data.metrics || null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error");
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [serverId, observedState]);

  useEffect(() => {
    if (observedState !== "running") {
      setMetrics(null);
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchMetrics();

    // Set up polling
    const interval = setInterval(fetchMetrics, pollInterval);

    return () => clearInterval(interval);
  }, [serverId, observedState, pollInterval, fetchMetrics]);

  return { error, loading, metrics, refresh: fetchMetrics };
};
