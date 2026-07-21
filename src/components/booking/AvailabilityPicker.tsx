'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, format, isBefore, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Loader2 } from 'lucide-react';
import type { TutorSlug } from '@/domain/catalog';

interface Slot {
  start: string;
}

interface SlotsResponse {
  data?: { slots?: Slot[] };
  error?: { code?: string; message?: string };
}

interface AvailabilityPickerProps {
  tutorSlug: TutorSlug;
  value: string;
  onChange: (startsAt: string) => void;
}

const BERLIN_TIME_ZONE = 'Europe/Berlin';

function dateKey(isoDate: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BERLIN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(isoDate));

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatSlotTime(isoDate: string) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: BERLIN_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

export function AvailabilityPicker({ tutorSlug, value, onChange }: AvailabilityPickerProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [rangeStart, setRangeStart] = useState(today);
  const [slotResult, setSlotResult] = useState<{
    requestKey: string;
    slots: Slot[];
    error: string | null;
  }>({ requestKey: '', slots: [], error: null });

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(rangeStart, index)),
    [rangeStart],
  );
  const requestKey = `${tutorSlug}:${format(rangeStart, 'yyyy-MM-dd')}`;
  const loading = slotResult.requestKey !== requestKey;
  const error = loading ? null : slotResult.error;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      tutorSlug,
      start: format(rangeStart, 'yyyy-MM-dd'),
      end: format(addDays(rangeStart, 6), 'yyyy-MM-dd'),
      timeZone: BERLIN_TIME_ZONE,
    });

    fetch(`/api/slots?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        const payload = (await response.json()) as SlotsResponse;
        if (!response.ok) {
          throw new Error(payload.error?.message || 'Termine konnten nicht geladen werden.');
        }
        return payload.data?.slots ?? [];
      })
      .then((availableSlots) => {
        setSlotResult({ requestKey, slots: availableSlots, error: null });
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
        setSlotResult({
          requestKey,
          slots: [],
          error:
            fetchError instanceof Error
              ? fetchError.message
              : 'Termine konnten nicht geladen werden.',
        });
      });

    return () => controller.abort();
  }, [rangeStart, requestKey, tutorSlug]);

  const groupedSlots = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    if (slotResult.requestKey !== requestKey) return groups;

    slotResult.slots.forEach((slot) => {
      const key = dateKey(slot.start);
      groups.set(key, [...(groups.get(key) ?? []), slot]);
    });
    groups.forEach((items) => items.sort((a, b) => a.start.localeCompare(b.start)));
    return groups;
  }, [requestKey, slotResult]);

  const canGoBack = isBefore(today, rangeStart);

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-white">
            <CalendarDays className="size-4 text-[var(--color-accent-soft)]" />
            Live-Verfügbarkeit
          </p>
          <p className="mt-1 text-sm text-white/55">
            Alle Zeiten werden in der Zeitzone Europe/Berlin angezeigt.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => setRangeStart((current) => addDays(current, -7))}
            className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Vorherige Woche"
          >
            <ArrowLeft className="size-4" />
          </button>
          <span className="min-w-36 text-center text-sm text-white/70">
            {format(rangeStart, 'd. MMM', { locale: de })} bis{' '}
            {format(addDays(rangeStart, 6), 'd. MMM', { locale: de })}
          </span>
          <button
            type="button"
            onClick={() => setRangeStart((current) => addDays(current, 7))}
            className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/35 hover:text-white"
            aria-label="Nächste Woche"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-6" aria-live="polite">
        {loading ? (
          <div className="flex min-h-52 items-center justify-center rounded-2xl border border-white/10 bg-black/10 text-sm text-white/60">
            <Loader2 className="mr-2 size-4 animate-spin" /> Verfügbare Termine werden geladen
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-5 text-sm leading-6 text-amber-50">
            <p className="flex items-center gap-2 font-medium">
              <AlertCircle className="size-4" /> Terminabfrage nicht verfügbar
            </p>
            <p className="mt-2 text-amber-50/75">{error}</p>
            <a
              className="mt-3 inline-block font-medium underline underline-offset-4"
              href="mailto:munichscholarmentors@gmail.com"
            >
              Termin per E-Mail anfragen
            </a>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const daySlots = groupedSlots.get(key) ?? [];

              return (
                <section
                  key={key}
                  className="min-h-40 rounded-2xl border border-white/10 bg-black/10 p-3"
                  aria-label={format(day, 'EEEE, d. MMMM', { locale: de })}
                >
                  <div className="border-b border-white/10 pb-2 text-center">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/45">
                      {format(day, 'EEE', { locale: de })}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-white">{format(day, 'd. MMM', { locale: de })}</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {daySlots.length > 0 ? (
                      daySlots.map((slot) => {
                        const selected = value === slot.start;
                        return (
                          <button
                            key={slot.start}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onChange(slot.start)}
                            className={`w-full rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                              selected
                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                                : 'border-white/10 bg-white/[0.035] text-white/75 hover:border-white/30 hover:text-white'
                            }`}
                          >
                            {formatSlotTime(slot.start)}
                          </button>
                        );
                      })
                    ) : (
                      <p className="py-3 text-center text-xs text-[var(--ink-subtle)]">Keine Termine</p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
