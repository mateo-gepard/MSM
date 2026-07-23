'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, format, isBefore, isSameDay, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  Loader2,
  Sun,
  Sunrise,
  Sunset,
} from 'lucide-react';
import type { TutorSlug } from '@/domain/catalog';
import { apiClientError, clientErrorMessage } from '@/lib/api/client-error';

interface Slot {
  start: string;
}

interface SlotsResponse {
  data?: { slots?: Slot[] };
  error?: { code?: string };
}

interface AvailabilityPickerProps {
  tutorSlug: TutorSlug;
  value: string;
  timeZone: string;
  bookingId?: string;
  onChange: (startsAt: string) => void;
}

type PeriodId = 'morning' | 'afternoon' | 'evening';

const PERIODS: { id: PeriodId; label: string; icon: typeof Sunrise }[] = [
  { id: 'morning', label: 'Vormittag', icon: Sunrise },
  { id: 'afternoon', label: 'Nachmittag', icon: Sun },
  { id: 'evening', label: 'Abend', icon: Sunset },
];

function dateKey(isoDate: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(isoDate));

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function slotHour(isoDate: string, timeZone: string) {
  const value = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).format(new Date(isoDate));
  const hour = Number.parseInt(value, 10);
  return Number.isNaN(hour) ? 0 : hour % 24;
}

function periodOf(isoDate: string, timeZone: string): PeriodId {
  const hour = slotHour(isoDate, timeZone);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function formatSlotTime(isoDate: string, timeZone: string) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

export function AvailabilityPicker({ tutorSlug, value, timeZone, bookingId, onChange }: AvailabilityPickerProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [rangeStart, setRangeStart] = useState(today);
  const [pickedDayKey, setPickedDayKey] = useState<string | null>(null);
  const [slotResult, setSlotResult] = useState<{
    requestKey: string;
    slots: Slot[];
    error: string | null;
  }>({ requestKey: '', slots: [], error: null });

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(rangeStart, index)),
    [rangeStart],
  );
  const requestKey = `${tutorSlug}:${format(rangeStart, 'yyyy-MM-dd')}:${timeZone}:${bookingId ?? ''}`;
  const loading = slotResult.requestKey !== requestKey;
  const error = loading ? null : slotResult.error;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      tutorSlug,
      start: format(rangeStart, 'yyyy-MM-dd'),
      end: format(addDays(rangeStart, 6), 'yyyy-MM-dd'),
      timeZone,
    });
    if (bookingId) params.set('bookingId', bookingId);

    fetch(`/api/slots?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        const payload = (await response.json()) as SlotsResponse;
        if (!response.ok) {
          throw apiClientError(payload, 'Termine konnten nicht geladen werden.');
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
          error: clientErrorMessage(fetchError, 'Termine konnten nicht geladen werden.'),
        });
      });

    return () => controller.abort();
  }, [bookingId, rangeStart, requestKey, timeZone, tutorSlug]);

  const groupedSlots = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    if (slotResult.requestKey !== requestKey) return groups;

    slotResult.slots.forEach((slot) => {
      const key = dateKey(slot.start, timeZone);
      groups.set(key, [...(groups.get(key) ?? []), slot]);
    });
    groups.forEach((items) => items.sort((a, b) => a.start.localeCompare(b.start)));
    return groups;
  }, [requestKey, slotResult, timeZone]);

  // Derive the effective selected day during render (no effect / no state sync):
  // prefer an explicit user pick, then the day of the currently chosen slot,
  // then the first available day in the visible week. Stale picks from another
  // week self-correct because they hold no slots in the current range.
  const selectedDayKey = useMemo(() => {
    const hasSlots = (key: string | null) => !!key && (groupedSlots.get(key)?.length ?? 0) > 0;
    if (hasSlots(pickedDayKey)) return pickedDayKey;
    const valueDayKey = value ? dateKey(value, timeZone) : null;
    if (hasSlots(valueDayKey)) return valueDayKey;
    return (
      days
        .map((day) => format(day, 'yyyy-MM-dd'))
        .find((key) => (groupedSlots.get(key)?.length ?? 0) > 0) ?? null
    );
  }, [pickedDayKey, groupedSlots, days, value, timeZone]);

  const selectedDay = useMemo(() => {
    if (!selectedDayKey) return null;
    return days.find((day) => format(day, 'yyyy-MM-dd') === selectedDayKey) ?? null;
  }, [days, selectedDayKey]);

  const selectedSlots = useMemo(
    () => (selectedDayKey ? (groupedSlots.get(selectedDayKey) ?? []) : []),
    [selectedDayKey, groupedSlots],
  );
  const periodBuckets = useMemo(() => {
    const buckets: Record<PeriodId, Slot[]> = { morning: [], afternoon: [], evening: [] };
    selectedSlots.forEach((slot) => buckets[periodOf(slot.start, timeZone)].push(slot));
    return buckets;
  }, [selectedSlots, timeZone]);

  const totalWeekSlots = useMemo(() => {
    let total = 0;
    days.forEach((day) => {
      total += groupedSlots.get(format(day, 'yyyy-MM-dd'))?.length ?? 0;
    });
    return total;
  }, [days, groupedSlots]);

  const canGoBack = isBefore(today, rangeStart);

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-white">
            <CalendarDays className="size-4 text-[var(--color-accent-soft)]" />
            Wähle deinen Termin
          </p>
          <p className="mt-1 text-sm text-white/55">
            Zeiten in deiner Zeitzone {timeZone}.
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
              Termin per E Mail anfragen
            </a>
          </div>
        ) : totalWeekSlots === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/10 p-6 text-center">
            <Clock className="size-5 text-white/40" />
            <p className="text-sm font-medium text-white/80">In dieser Woche sind keine Termine frei.</p>
            <p className="text-sm text-white/50">
              Wähle mit <ArrowRight className="inline size-3.5 align-[-2px]" /> eine spätere Woche
              oder frage per{' '}
              <a className="underline underline-offset-4" href="mailto:munichscholarmentors@gmail.com">
                E Mail
              </a>{' '}
              an.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Step 1 — pick a day */}
            <div
              className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1"
              role="tablist"
              aria-label="Tag auswählen"
            >
              {days.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const count = groupedSlots.get(key)?.length ?? 0;
                const disabled = count === 0;
                const active = key === selectedDayKey;
                const isToday = isSameDay(day, today);
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={disabled}
                    onClick={() => setPickedDayKey(key)}
                    className={`flex min-w-[4.5rem] shrink-0 snap-start flex-col items-center gap-1 rounded-2xl border px-3 py-3 transition-colors ${
                      active
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-white'
                        : disabled
                          ? 'cursor-not-allowed border-white/5 bg-transparent text-white/25'
                          : 'border-white/10 bg-white/[0.035] text-white/75 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    <span className="text-[0.7rem] font-medium uppercase tracking-[0.12em]">
                      {isToday ? 'Heute' : format(day, 'EEE', { locale: de })}
                    </span>
                    <span className="text-lg font-semibold leading-none">{format(day, 'd')}</span>
                    <span className="text-[0.7rem] leading-none text-current/70">
                      {format(day, 'MMM', { locale: de })}
                    </span>
                    <span
                      className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                        disabled
                          ? 'bg-transparent'
                          : active
                            ? 'bg-[var(--color-accent)]'
                            : 'bg-[var(--color-accent-soft)]/70'
                      }`}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>

            {/* Step 2 — pick a time on the selected day */}
            {selectedDay ? (
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4 sm:p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-white">
                    {format(selectedDay, 'EEEE, d. MMMM', { locale: de })}
                  </p>
                  <p className="text-xs text-white/50">
                    {selectedSlots.length} {selectedSlots.length === 1 ? 'freie Zeit' : 'freie Zeiten'}
                  </p>
                </div>

                <div className="mt-4 space-y-4">
                  {PERIODS.map((period) => {
                    const slots = periodBuckets[period.id];
                    if (slots.length === 0) return null;
                    const Icon = period.icon;
                    return (
                      <div key={period.id}>
                        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-white/45">
                          <Icon className="size-3.5" />
                          {period.label}
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                          {slots.map((slot) => {
                            const selected = value === slot.start;
                            return (
                              <button
                                key={slot.start}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => onChange(slot.start)}
                                className={`rounded-xl border px-2 py-2.5 text-sm font-medium tabular-nums transition-colors ${
                                  selected
                                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white shadow-[0_0_0_1px_var(--color-accent)]'
                                    : 'border-white/10 bg-white/[0.035] text-white/80 hover:border-[var(--color-accent-soft)]/60 hover:text-white'
                                }`}
                              >
                                {formatSlotTime(slot.start, timeZone)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
