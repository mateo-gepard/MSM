'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import type { LearnerListItem, LearnerListResponse } from '@/domain/household-schemas';
import { apiClientError, clientErrorMessage } from '@/lib/api/client-error';

export function LearnerPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (learnerId: string) => void;
}) {
  const [state, setState] = useState<{
    status: 'loading' | 'ready' | 'error';
    learners: LearnerListItem[];
    error: string | null;
  }>({ status: 'loading', learners: [], error: null });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/learners', { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const payload = (await response.json()) as LearnerListResponse & {
          error?: { code?: string };
        };
        if (!response.ok) throw apiClientError(payload, 'Lernende konnten nicht geladen werden.');
        return payload.data.learners.filter((learner) => learner.isActive);
      })
      .then((learners) => {
        setState({ status: 'ready', learners, error: null });
        if (learners.length === 1) onChange(learners[0].id);
      })
      .catch((caughtError: unknown) => {
        if (caughtError instanceof DOMException && caughtError.name === 'AbortError') return;
        setState({
          status: 'error',
          learners: [],
          error: clientErrorMessage(caughtError, 'Lernende konnten nicht geladen werden.'),
        });
      });
    return () => controller.abort();
  }, [onChange]);

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-20 items-center justify-center rounded-xl border border-white/10 bg-black/10 text-sm text-white/55" role="status">
        <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> Lernende werden geladen
      </div>
    );
  }

  if (state.status === 'error') {
    return <p className="rounded-xl border border-red-300/20 bg-red-300/[0.05] p-4 text-sm text-red-100" role="alert">{state.error}</p>;
  }

  if (!state.learners.length) {
    return (
      <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
        <p className="font-semibold">Zuerst einen Lernenden anlegen</p>
        <p className="mt-1 text-amber-50/75">Jede Stunde wird im Familien Dashboard eindeutig zugeordnet.</p>
        <Link href="/dashboard" className="mt-3 inline-flex items-center gap-2 font-semibold underline underline-offset-4">
          <UserPlus aria-hidden="true" className="h-4 w-4" /> Zum Dashboard
        </Link>
      </div>
    );
  }

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-white">Für wen ist die Stunde?</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {state.learners.map((learner) => (
          <label
            key={learner.id}
            className={`cursor-pointer rounded-xl border p-4 text-sm font-semibold transition-colors ${
              value === learner.id
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/12 text-white'
                : 'border-white/10 bg-black/10 text-white/70 hover:border-white/25'
            }`}
          >
            <input
              type="radio"
              name="learner"
              value={learner.id}
              checked={value === learner.id}
              onChange={() => onChange(learner.id)}
              className="mr-2 accent-[var(--color-accent)]"
            />
            {learner.displayName}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
