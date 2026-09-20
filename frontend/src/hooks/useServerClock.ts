import { useEffect, useMemo, useState } from 'react';

/** Correct countdown displays against the most recently received server timestamp. */
export default function useServerClock(serverNow: number | undefined, running: boolean, interval = 1000): number {
  const offset = useMemo(() => serverNow === undefined ? 0 : serverNow - Date.now(), [serverNow]);
  const [localNow, setLocalNow] = useState(Date.now());
  useEffect(() => {
    setLocalNow(Date.now());
    if (!running) return;
    const timer = window.setInterval(() => setLocalNow(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [running, interval, serverNow]);
  return localNow + offset;
}
