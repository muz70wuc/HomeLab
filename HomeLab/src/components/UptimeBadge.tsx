import { useEffect, useState } from 'react';

interface UptimeBadgeProps {
  baseUrl?: string;
  slug?: string;
  monitorId?: number;
  type?: 'link' | 'ping';
  targetUrl?: string;
}

interface HeartbeatData {
  status: number; // 1 = UP, 0 = DOWN
  ping: number | null; // Latenz in ms
}

export function UptimeBadge({
  baseUrl,
  slug = 'default',
  monitorId,
  type,
  targetUrl,
}: UptimeBadgeProps) {
  const [data, setData] = useState<HeartbeatData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    // Fall 1: Einfacher Ping-Check ohne Uptime Kuma
    if (type === 'ping' && targetUrl) {
      const controller = new AbortController();
      fetch(targetUrl, { method: 'HEAD', mode: 'no-cors', signal: controller.signal })
        .then(() => {
          setData({ status: 1, ping: null });
          setError(false);
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));

      return () => controller.abort();
    }

    // Fall 2: Uptime Kuma Status
    if (!baseUrl || monitorId === undefined) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

  const fetchStatus = () => {
    // baseUrl ist '/api/kuma' -> Ziel: /api/kuma/api/status-page/heartbeat/localhost
    const cleanBaseUrl = baseUrl?.replace(/\/$/, '') || '';
    const url = `${cleanBaseUrl}/api/status-page/heartbeat/${slug}`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`API Error ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const heartbeats = json.heartbeatList?.[monitorId];
        if (heartbeats && heartbeats.length > 0) {
          const last = heartbeats[heartbeats.length - 1];
          setData({ status: last.status, ping: last.ping });
          setError(false);
        } else {
          setError(true);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(true);
        }
      })
      .finally(() => setLoading(false));
  };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [baseUrl, slug, monitorId, type, targetUrl]);

  if (loading) {
    return (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
        check...
      </span>
    );
  }

  if (error || !data) {
    return (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-950/40 text-amber-500 border border-amber-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        unknown
      </span>
    );
  }

  const isUp = data.status === 1;

  return (
    <span
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border transition-all ${
        isUp
          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
          : 'bg-rose-950/60 text-rose-400 border-rose-500/30'
      }`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {isUp && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        )}
        <span
          className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
            isUp ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        ></span>
      </span>
      {isUp ? 'online' : 'offline'}
      {isUp && data.ping !== null && (
        <span className="text-emerald-500/60 text-[9px] border-l border-emerald-500/20 pl-1">
          {data.ping}ms
        </span>
      )}
    </span>
  );
}