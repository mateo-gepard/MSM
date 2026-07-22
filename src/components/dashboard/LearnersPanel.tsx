'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  CalendarDays,
  Loader2,
  Pencil,
  Save,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
  X,
} from 'lucide-react';
import type { LearnerListItem } from '@/domain/household-schemas';
import { apiClientError, clientErrorMessage } from '@/lib/api/client-error';

interface LearnerMutationResponse {
  data?: { learner?: LearnerListItem };
  error?: { code?: string };
}

function formatBirthDate(value: string | null): string {
  if (!value) return 'Kein Geburtsdatum hinterlegt';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

export function LearnersPanel({
  learners,
  canManage,
  onLearnersChange,
}: {
  learners: LearnerListItem[];
  canManage: boolean;
  onLearnersChange: (learners: LearnerListItem[]) => void;
}) {
  const nameId = useId();
  const birthDateId = useId();
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingLearnerId, setPendingLearnerId] = useState<string | null>(null);
  const [editingLearnerId, setEditingLearnerId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [maxBirthDate, setMaxBirthDate] = useState('');
  const mutationInFlightRef = useRef(false);
  const isMutationPending = isSubmitting || pendingLearnerId !== null;

  useEffect(() => {
    setMaxBirthDate(new Date().toISOString().slice(0, 10));
  }, []);

  const addLearner = async () => {
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/learners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          ...(birthDate ? { birthDate } : {}),
        }),
      });
      const payload = (await response.json()) as LearnerMutationResponse;
      if (!response.ok || !payload.data?.learner) {
        throw apiClientError(payload, 'Der Lernende konnte nicht hinzugefügt werden.');
      }
      onLearnersChange([...learners, payload.data.learner]);
      setDisplayName('');
      setBirthDate('');
    } catch (caughtError) {
      setError(clientErrorMessage(caughtError, 'Der Lernende konnte nicht hinzugefügt werden.'));
    } finally {
      mutationInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const setLearnerActive = async (learner: LearnerListItem, isActive: boolean) => {
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setPendingLearnerId(learner.id);
    setError(null);
    try {
      const response = await fetch(`/api/learners/${encodeURIComponent(learner.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      const payload = (await response.json()) as LearnerMutationResponse;
      const updatedLearner = payload.data?.learner;
      if (!response.ok || !updatedLearner) {
        throw apiClientError(payload, 'Der Status konnte nicht aktualisiert werden.');
      }
      onLearnersChange(
        learners.map((item) => (item.id === learner.id ? updatedLearner : item)),
      );
    } catch (caughtError) {
      setError(clientErrorMessage(caughtError, 'Der Status konnte nicht aktualisiert werden.'));
    } finally {
      mutationInFlightRef.current = false;
      setPendingLearnerId(null);
    }
  };

  const startEditing = (learner: LearnerListItem) => {
    setEditingLearnerId(learner.id);
    setEditName(learner.isLegacyPlaceholder ? '' : learner.displayName);
    setEditBirthDate(learner.birthDate ?? '');
    setError(null);
  };

  const saveLearner = async (learner: LearnerListItem) => {
    if (editName.trim().length < 2 || mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setPendingLearnerId(learner.id);
    setError(null);
    try {
      const response = await fetch(`/api/learners/${encodeURIComponent(learner.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          displayName: editName.trim(),
          birthDate: editBirthDate || null,
        }),
      });
      const payload = (await response.json()) as LearnerMutationResponse;
      const updatedLearner = payload.data?.learner;
      if (!response.ok || !updatedLearner) {
        throw apiClientError(payload, 'Die Daten konnten nicht aktualisiert werden.');
      }
      onLearnersChange(
        learners.map((item) => (item.id === learner.id ? updatedLearner : item)),
      );
      setEditingLearnerId(null);
    } catch (caughtError) {
      setError(clientErrorMessage(caughtError, 'Die Daten konnten nicht aktualisiert werden.'));
    } finally {
      mutationInFlightRef.current = false;
      setPendingLearnerId(null);
    }
  };

  return (
    <section aria-labelledby="learners-heading">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9b83ff]">Haushalt</p>
        <h2 id="learners-heading" className="mt-2 text-2xl font-bold tracking-tight text-white">
          Lernende
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b5b1bf]">
          Weise jede Stunde eindeutig einem Kind oder Lernenden zu. Geburtsdaten sind optional und
          werden nicht an den Terminanbieter gesendet.
          {!canManage ? ' Änderungen sind nur für berechtigte Haushaltsmitglieder verfügbar.' : ''}
        </p>
      </div>

      <div className={`mt-6 grid gap-4 ${canManage ? 'lg:grid-cols-[1fr_22rem]' : ''}`}>
        <div className="space-y-3">
          {learners.length ? learners.map((learner) => (
            <article key={learner.id} className="flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
              {editingLearnerId === learner.id ? (
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-[var(--ink-muted)]">
                    Anzeigename
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      minLength={2}
                      maxLength={80}
                      required
                      autoFocus
                      disabled={isMutationPending}
                      className="mt-2 min-h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-white focus:border-[var(--action)] focus:outline-none"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[var(--ink-muted)]">
                    Geburtsdatum <span className="font-normal">(optional)</span>
                    <input
                      type="date"
                      value={editBirthDate}
                      max={maxBirthDate || undefined}
                      onChange={(event) => setEditBirthDate(event.target.value)}
                      disabled={isMutationPending}
                      className="mt-2 min-h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-white focus:border-[var(--action)] focus:outline-none"
                    />
                  </label>
                </div>
              ) : <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-white">{learner.displayName}</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${learner.isActive ? 'border-emerald-300/20 text-emerald-200' : 'border-white/10 text-[var(--ink-subtle)]'}`}>
                    {learner.isActive ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
                {canManage ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-[var(--ink-muted)]">
                    <CalendarDays aria-hidden="true" className="h-4 w-4" />
                    {formatBirthDate(learner.birthDate)}
                  </p>
                ) : null}
                {learner.isLegacyPlaceholder ? (
                  <p className="mt-2 text-xs text-amber-200">Bitte Namen prüfen und bei Bedarf aktualisieren.</p>
                ) : null}
              </div>}
              {canManage ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  {editingLearnerId === learner.id ? (
                    <>
                      <button
                        type="button"
                        disabled={isMutationPending || editName.trim().length < 2}
                        onClick={() => void saveLearner(learner)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--action)] px-3 text-sm font-bold text-white hover:bg-[var(--action-hover)] disabled:opacity-50"
                      >
                        {pendingLearnerId === learner.id ? (
                          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save aria-hidden="true" className="h-4 w-4" />
                        )}
                        Speichern
                      </button>
                      <button
                        type="button"
                        disabled={isMutationPending}
                        onClick={() => setEditingLearnerId(null)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 text-sm font-bold text-white hover:bg-white/5 disabled:opacity-50"
                      >
                        <X aria-hidden="true" className="h-4 w-4" /> Abbrechen
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isMutationPending}
                        onClick={() => startEditing(learner)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 text-sm font-bold text-white hover:bg-white/5 disabled:opacity-50"
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                        {learner.isLegacyPlaceholder ? 'Daten prüfen' : 'Bearbeiten'}
                      </button>
                      <button
                        type="button"
                        disabled={isMutationPending}
                        onClick={() => void setLearnerActive(learner, !learner.isActive)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 text-sm font-bold text-white hover:bg-white/5 disabled:opacity-50"
                      >
                        {pendingLearnerId === learner.id ? (
                          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        ) : learner.isActive ? (
                          <UserRoundX aria-hidden="true" className="h-4 w-4" />
                        ) : (
                          <UserRoundCheck aria-hidden="true" className="h-4 w-4" />
                        )}
                        {learner.isActive ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </article>
          )) : (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-6 py-10 text-center">
              <UserPlus aria-hidden="true" className="mx-auto h-8 w-8 text-[var(--purple-bright)]" />
              <h3 className="mt-4 font-bold text-white">Noch kein Lernender angelegt</h3>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">Lege zuerst einen Lernenden an, bevor du eine Stunde buchst.</p>
            </div>
          )}
        </div>

        {canManage ? <form
          className="h-fit rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void addLearner();
          }}
        >
          <h3 className="font-bold text-white">Lernenden hinzufügen</h3>
          <label htmlFor={nameId} className="mt-4 block text-sm font-semibold text-[var(--ink-muted)]">
            Vorname oder Anzeigename
          </label>
          <input
            id={nameId}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            minLength={2}
            maxLength={80}
            required
            autoComplete="off"
            disabled={isMutationPending}
            className="mt-2 min-h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-white focus:border-[var(--action)] focus:outline-none"
          />
          <label htmlFor={birthDateId} className="mt-4 block text-sm font-semibold text-[var(--ink-muted)]">
            Geburtsdatum <span className="font-normal text-[var(--ink-subtle)]">(optional)</span>
          </label>
          <input
            id={birthDateId}
            type="date"
            value={birthDate}
            max={maxBirthDate || undefined}
            onChange={(event) => setBirthDate(event.target.value)}
            disabled={isMutationPending}
            className="mt-2 min-h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-white focus:border-[var(--action)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={isMutationPending || displayName.trim().length < 2}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--action)] px-4 text-sm font-bold text-white hover:bg-[var(--action-hover)] disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <UserPlus aria-hidden="true" className="h-4 w-4" />}
            Hinzufügen
          </button>
        </form> : null}
      </div>
      {error ? <p className="mt-4 text-sm text-red-200" role="alert">{error}</p> : null}
    </section>
  );
}
