'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const refreshIntervalMs = 3_000;
const refreshWindowMs = 60_000;

export function PendingPaymentRefresh() {
  const router = useRouter();

  useEffect(() => {
    const startedAt = Date.now();
    const refreshWhenVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - startedAt < refreshWindowMs
      ) {
        router.refresh();
      }
    };
    const intervalId = window.setInterval(() => {
      if (Date.now() - startedAt >= refreshWindowMs) {
        window.clearInterval(intervalId);
        return;
      }
      refreshWhenVisible();
    }, refreshIntervalMs);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [router]);

  return (
    <p className="mt-2 text-xs text-[var(--ink-muted)]" role="status">
      Diese Seite aktualisiert den Zahlungsstatus automatisch.
    </p>
  );
}
