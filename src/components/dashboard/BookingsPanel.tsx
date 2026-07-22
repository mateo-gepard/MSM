'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPin,
  Monitor,
  RotateCcw,
  UserRound,
  XCircle,
} from 'lucide-react';
import type { BookingDto } from './contracts';
import { readApiResponse } from './contracts';
import { ClientVisibleError, clientErrorMessage } from '@/lib/api/client-error';

type BookingBucket = 'upcoming' | 'past' | 'cancelled';

interface BookingsPanelProps {
  bookings: BookingDto[];
  audience: 'parent' | 'tutor';
  canManageBookings: boolean;
  onBookingStatusChanged: (
    bookingId: string,
    status: 'cancelled' | 'cancellation_pending',
  ) => void;
}

const bucketLabels: Record<BookingBucket, string> = {
  upcoming: 'Anstehend',
  past: 'Vergangen',
  cancelled: 'Beendet',
};

function getBookingBucket(booking: BookingDto, now: number): BookingBucket {
  if (booking.status === 'cancelled' || booking.status === 'failed') return 'cancelled';
  if (booking.status === 'completed') return 'past';
  if (
    !['provider_pending', 'cancellation_pending', 'reschedule_pending'].includes(booking.status) &&
    new Date(booking.startsAt).getTime() <= now
  ) {
    return 'past';
  }
  return 'upcoming';
}

function sortBookings(bookings: BookingDto[], bucket: BookingBucket): BookingDto[] {
  return [...bookings].sort((left, right) => {
    const difference = new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
    return bucket === 'upcoming' ? difference : -difference;
  });
}

function formatDateTime(booking: BookingDto): { date: string; time: string } {
  const date = new Date(booking.startsAt);
  const options = { timeZone: booking.timeZone };

  try {
    return {
      date: new Intl.DateTimeFormat('de-DE', {
        ...options,
        weekday: 'short',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(date),
      time: new Intl.DateTimeFormat('de-DE', {
        ...options,
        hour: '2-digit',
        minute: '2-digit',
      }).format(date),
    };
  } catch {
    return {
      date: new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(date),
      time: new Intl.DateTimeFormat('de-DE', { timeStyle: 'short' }).format(date),
    };
  }
}

function rescheduleHref(booking: BookingDto): string {
  const query = new URLSearchParams({
    reschedule: booking.id,
    tutor: booking.tutor.slug,
    subject: booking.subject.id,
    package: booking.package.id,
    location: booking.location,
  });

  return `/booking?${query.toString()}`;
}

function displayStatus(booking: BookingDto, bucket: BookingBucket): string {
  if (booking.syncStatus === 'needs_reconciliation') return 'Abgleich erforderlich';
  if (bucket === 'past' && booking.status !== 'completed') return 'Vergangen';
  return {
    provider_pending: 'Kalenderabgleich',
    pending_confirmation: 'Bestätigung ausstehend',
    scheduled: 'Bestätigt',
    completed: 'Abgeschlossen',
    cancellation_pending: 'Stornierung läuft',
    reschedule_pending: 'Umbuchung läuft',
    cancelled: 'Storniert',
    failed: 'Nicht zustande gekommen',
  }[booking.status];
}

function StatusBadge({ booking, bucket }: { booking: BookingDto; bucket: BookingBucket }) {
  const requiresAttention =
    booking.syncStatus === 'needs_reconciliation' ||
    ['provider_pending', 'pending_confirmation', 'cancellation_pending', 'reschedule_pending'].includes(
      booking.status,
    );
  const isEnded = booking.status === 'cancelled' || booking.status === 'failed';
  const styles = isEnded
    ? 'border-red-300/20 bg-red-300/5 text-red-200'
    : requiresAttention
      ? 'border-amber-200/25 bg-amber-200/[0.06] text-amber-100'
      : bucket === 'past'
        ? 'border-emerald-300/20 bg-emerald-300/5 text-emerald-200'
        : 'border-[var(--purple)]/35 bg-[var(--purple)]/10 text-[var(--purple-soft)]';

  const Icon = isEnded ? XCircle : bucket === 'past' ? CheckCircle2 : Clock3;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${styles}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {displayStatus(booking, bucket)}
    </span>
  );
}

function CancellationConfirmation({
  booking,
  onClose,
  onStatusChanged,
}: {
  booking: BookingDto;
  onClose: () => void;
  onStatusChanged: (
    bookingId: string,
    status: 'cancelled' | 'cancellation_pending',
  ) => void;
}) {
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operationRef = useRef<{ reason: string; key: string } | null>(null);

  const cancelBooking = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const normalizedReason = reason.trim();
      if (operationRef.current?.reason !== normalizedReason) {
        operationRef.current = { reason: normalizedReason, key: crypto.randomUUID() };
      }
      const response = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}/cancel`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          idempotencyKey: operationRef.current.key,
          ...(normalizedReason ? { reason: normalizedReason } : {}),
        }),
      });
      const payload = await readApiResponse<{
        data: { booking: { id: string; status: 'cancelled' | 'cancellation_pending' } };
      }>(response, 'Der Termin konnte nicht storniert werden.');

      if (payload.data.booking.id !== booking.id) {
        throw new ClientVisibleError('Die Stornierung wurde nicht bestätigt.');
      }
      if (payload.data.booking.status === 'cancellation_pending') {
        operationRef.current = null;
        onStatusChanged(booking.id, 'cancellation_pending');
        onClose();
        return;
      }
      if (payload.data.booking.status !== 'cancelled') {
        throw new ClientVisibleError('Die Stornierung wurde nicht bestätigt.');
      }

      operationRef.current = null;
      onStatusChanged(payload.data.booking.id, 'cancelled');
    } catch (caughtError) {
      setError(clientErrorMessage(caughtError, 'Der Termin konnte nicht storniert werden.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      aria-label="Stornierung bestätigen"
      className="mt-5 rounded-xl border border-red-300/20 bg-red-300/[0.04] p-4"
    >
      <h4 className="font-semibold text-white">Diesen Termin wirklich stornieren?</h4>
      <p className="mt-1 text-sm leading-6 text-[#b5b1bf]">
        Die Stornierung wird erst angezeigt, nachdem sie vom Server bestätigt wurde. Wurde für den
        Termin Paketguthaben eingesetzt, wird diese eine Einheit dabei einmalig wiederhergestellt. Die
        Bedingungen stehen in den{' '}
        <Link href="/agb" className="font-semibold text-[#d7ceff] underline underline-offset-4">
          AGB
        </Link>
        .
      </p>

      <label htmlFor={reasonId} className="mt-4 block text-sm font-semibold text-[#d8d4df]">
        Grund <span className="font-normal text-[var(--ink-subtle)]">(optional)</span>
      </label>
      <textarea
        id={reasonId}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        disabled={isSubmitting}
        maxLength={500}
        rows={2}
        className="mt-2 w-full resize-y rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 py-2.5 text-sm text-white placeholder:text-[var(--ink-subtle)] focus:border-[var(--action)] focus:outline-none"
        placeholder="Zum Beispiel: Terminüberschneidung"
      />

      {error ? (
        <p className="mt-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-4 text-sm font-bold text-white transition-colors hover:bg-white/5 disabled:opacity-50"
        >
          Zurück
        </button>
        <button
          type="button"
          onClick={() => void cancelBooking()}
          disabled={isSubmitting}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-red-500 px-4 text-sm font-bold text-white transition-colors hover:bg-red-400 disabled:cursor-wait disabled:opacity-60"
        >
          {isSubmitting ? 'Wird storniert …' : 'Stornierung bestätigen'}
        </button>
      </div>
    </section>
  );
}

function BookingCard({
  booking,
  bucket,
  audience,
  canManageBookings,
  onStatusChanged,
}: {
  booking: BookingDto;
  bucket: BookingBucket;
  audience: 'parent' | 'tutor';
  canManageBookings: boolean;
  onStatusChanged: (
    bookingId: string,
    status: 'cancelled' | 'cancellation_pending',
  ) => void;
}) {
  const [isConfirmingCancellation, setIsConfirmingCancellation] = useState(false);
  const formatted = formatDateTime(booking);
  const isOnline = booking.location === 'online';
  const canMutate =
    canManageBookings &&
    bucket === 'upcoming' &&
    (booking.status === 'scheduled' || booking.status === 'pending_confirmation');
  const canJoin =
    isOnline &&
    booking.meetingUrl !== null &&
    bucket === 'upcoming' &&
    (booking.status === 'scheduled' || booking.status === 'pending_confirmation');

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-white">{booking.subject.name}</h3>
            <StatusBadge booking={booking} bucket={bucket} />
          </div>
          <p className="mt-1 text-sm text-[#b5b1bf]">
            {audience === 'parent'
              ? `${booking.learner.displayName} mit ${booking.tutor.name}`
              : `${booking.learner.displayName} · Kontakt ${booking.contact.name}`}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-[#d7ceff]">{booking.package.name}</p>
      </div>

      <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-5 text-sm sm:grid-cols-3">
        <div>
          <dt className="flex items-center gap-2 text-[var(--ink-subtle)]">
            <CalendarClock aria-hidden="true" className="h-4 w-4" />
            Termin
          </dt>
          <dd className="mt-1 font-semibold text-[var(--ink)]">
            {formatted.date}, {formatted.time} Uhr
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-[var(--ink-subtle)]">
            <Clock3 aria-hidden="true" className="h-4 w-4" />
            Dauer
          </dt>
          <dd className="mt-1 font-semibold text-[var(--ink)]">{booking.durationMinutes} Minuten</dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-[var(--ink-subtle)]">
            {isOnline ? (
              <Monitor aria-hidden="true" className="h-4 w-4" />
            ) : (
              <MapPin aria-hidden="true" className="h-4 w-4" />
            )}
            Ort
          </dt>
          <dd className="mt-1 font-semibold text-[var(--ink)]">
            {isOnline ? 'Online' : booking.locationVenue || 'Vor Ort'}
          </dd>
        </div>
      </dl>

      {canJoin ? (
        <a
          href={booking.meetingUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--action)] px-4 text-sm font-bold text-white transition-colors hover:bg-[var(--action-hover)]"
        >
          <Monitor aria-hidden="true" className="h-4 w-4" />
          Online Stunde öffnen
        </a>
      ) : null}

      {audience === 'tutor' && booking.contact.message ? (
        <div className="mt-4 rounded-xl bg-white/[0.035] p-4 text-sm leading-6 text-[#b5b1bf]">
          <p className="flex items-center gap-2 font-semibold text-[#d8d4df]">
            <UserRound aria-hidden="true" className="h-4 w-4" />
            Hinweis zur Buchung
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words">{booking.contact.message}</p>
        </div>
      ) : null}

      {canMutate ? (
        <div className="mt-5 flex flex-col gap-2 border-t border-[var(--line)] pt-5 sm:flex-row">
          <Link
            href={rescheduleHref(booking)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-bold text-white transition-colors hover:border-white/30 hover:bg-white/5"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Verschieben
          </Link>
          <button
            type="button"
            aria-expanded={isConfirmingCancellation}
            onClick={() => setIsConfirmingCancellation((current) => !current)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-red-200 transition-colors hover:bg-red-300/10"
          >
            <XCircle aria-hidden="true" className="h-4 w-4" />
            Stornieren
          </button>
        </div>
      ) : null}

      {isConfirmingCancellation ? (
        <CancellationConfirmation
          booking={booking}
          onClose={() => setIsConfirmingCancellation(false)}
          onStatusChanged={onStatusChanged}
        />
      ) : null}
    </article>
  );
}

function EmptyBookings({
  bucket,
  audience,
  canManageBookings,
}: {
  bucket: BookingBucket;
  audience: 'parent' | 'tutor';
  canManageBookings: boolean;
}) {
  const copy = {
    upcoming:
      audience === 'parent'
        ? 'Aktuell sind keine kommenden Stunden geplant.'
        : 'Aktuell sind dir keine kommenden Stunden zugewiesen.',
    past: 'Hier erscheinen vergangene und abgeschlossene Stunden.',
    cancelled: 'Es gibt keine stornierten oder fehlgeschlagenen Termine.',
  }[bucket];

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-6 py-12 text-center">
      <CalendarClock aria-hidden="true" className="mx-auto h-8 w-8 text-[var(--purple-bright)]" />
      <h3 className="mt-4 font-bold text-white">Keine Termine in dieser Ansicht</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#b5b1bf]">{copy}</p>
      {bucket === 'upcoming' && audience === 'parent' && canManageBookings ? (
        <Link
          href="/matching"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--action)] px-4 text-sm font-bold text-white transition-colors hover:bg-[var(--action-hover)]"
        >
          Tutor finden
        </Link>
      ) : null}
    </div>
  );
}

export function BookingsPanel({
  bookings,
  audience,
  canManageBookings,
  onBookingStatusChanged,
}: BookingsPanelProps) {
  const [activeBucket, setActiveBucket] = useState<BookingBucket>('upcoming');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const updateNow = () => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    const intervalId = window.setInterval(updateNow, 60_000);
    document.addEventListener('visibilitychange', updateNow);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', updateNow);
    };
  }, []);

  const grouped = useMemo(() => {
    const result: Record<BookingBucket, BookingDto[]> = {
      upcoming: [],
      past: [],
      cancelled: [],
    };

    for (const booking of bookings) {
      result[getBookingBucket(booking, now)].push(booking);
    }

    return result;
  }, [bookings, now]);
  const visibleBookings = sortBookings(grouped[activeBucket], activeBucket);

  return (
    <section aria-labelledby="bookings-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9b83ff]">Termine</p>
          <h2 id="bookings-heading" className="mt-2 text-2xl font-bold tracking-tight text-white">
            {audience === 'parent' ? 'Deine Nachhilfestunden' : 'Deine zugewiesenen Stunden'}
          </h2>
        </div>
        {audience === 'parent' && canManageBookings ? (
          <Link
            href="/booking"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--action)] px-4 text-sm font-bold text-white transition-colors hover:bg-[var(--action-hover)]"
          >
            Neue Stunde buchen
          </Link>
        ) : null}
      </div>

      <div className="mt-6 overflow-x-auto pb-1">
        <div className="inline-flex min-w-full gap-1 rounded-xl border border-[var(--line)] bg-[var(--canvas-soft)] p-1 sm:min-w-0" role="group" aria-label="Termine filtern">
          {(Object.keys(bucketLabels) as BookingBucket[]).map((bucket) => (
            <button
              key={bucket}
              type="button"
              aria-pressed={activeBucket === bucket}
              onClick={() => setActiveBucket(bucket)}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-[var(--ink-muted)] transition-colors hover:text-white aria-pressed:bg-[var(--surface-raised)] aria-pressed:text-white sm:flex-none"
            >
              {bucketLabels[bucket]}
              <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs tabular-nums">
                {grouped[bucket].length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {visibleBookings.length > 0 ? (
          visibleBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              bucket={activeBucket}
              audience={audience}
              canManageBookings={canManageBookings}
              onStatusChanged={onBookingStatusChanged}
            />
          ))
        ) : (
          <EmptyBookings
            bucket={activeBucket}
            audience={audience}
            canManageBookings={canManageBookings}
          />
        )}
      </div>
    </section>
  );
}

export function countUpcomingBookings(bookings: BookingDto[], now: number): number {
  return bookings.filter((booking) => getBookingBucket(booking, now) === 'upcoming').length;
}
