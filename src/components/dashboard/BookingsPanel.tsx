'use client';

import { useId, useMemo, useState } from 'react';
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
import type { BookingDto, BookingStatus } from './contracts';
import { readApiResponse } from './contracts';

type BookingBucket = 'upcoming' | 'past' | 'cancelled';

interface BookingsPanelProps {
  bookings: BookingDto[];
  audience: 'parent' | 'tutor';
  onBookingCancelled: (bookingId: string) => void;
}

const bucketLabels: Record<BookingBucket, string> = {
  upcoming: 'Anstehend',
  past: 'Vergangen',
  cancelled: 'Storniert',
};

function getBookingBucket(booking: BookingDto, now: number): BookingBucket {
  if (booking.status === 'cancelled') return 'cancelled';
  if (booking.status === 'completed' || new Date(booking.startsAt).getTime() <= now) return 'past';
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
  if (bucket === 'cancelled') return 'Storniert';
  if (bucket === 'past') return booking.status === 'completed' ? 'Abgeschlossen' : 'Vergangen';
  return 'Bestätigt';
}

function StatusBadge({ booking, bucket }: { booking: BookingDto; bucket: BookingBucket }) {
  const styles = {
    upcoming: 'border-[#8067e8]/35 bg-[#8067e8]/10 text-[#d7ceff]',
    past: 'border-emerald-300/20 bg-emerald-300/5 text-emerald-200',
    cancelled: 'border-red-300/20 bg-red-300/5 text-red-200',
  }[bucket];

  const Icon = bucket === 'upcoming' ? Clock3 : bucket === 'past' ? CheckCircle2 : XCircle;

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
  onCancelled,
}: {
  booking: BookingDto;
  onClose: () => void;
  onCancelled: (bookingId: string) => void;
}) {
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelBooking = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}/cancel`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
      });
      const payload = await readApiResponse<{
        data: { booking: { id: string; status: Extract<BookingStatus, 'cancelled'> } };
      }>(response, 'Der Termin konnte nicht storniert werden.');

      if (payload.data.booking.id !== booking.id || payload.data.booking.status !== 'cancelled') {
        throw new Error('Die Stornierung wurde nicht bestätigt.');
      }

      onCancelled(payload.data.booking.id);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Der Termin konnte nicht storniert werden.',
      );
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
        Grund <span className="font-normal text-[#8d8996]">(optional)</span>
      </label>
      <textarea
        id={reasonId}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        disabled={isSubmitting}
        maxLength={500}
        rows={2}
        className="mt-2 w-full resize-y rounded-lg border border-white/15 bg-[#09090d] px-3 py-2.5 text-sm text-white placeholder:text-[#77727f] focus:border-[#8067e8] focus:outline-none"
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
  onCancelled,
}: {
  booking: BookingDto;
  bucket: BookingBucket;
  audience: 'parent' | 'tutor';
  onCancelled: (bookingId: string) => void;
}) {
  const [isConfirmingCancellation, setIsConfirmingCancellation] = useState(false);
  const formatted = formatDateTime(booking);
  const isOnline = booking.location === 'online';

  return (
    <article className="rounded-2xl border border-white/10 bg-[#121219] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-white">{booking.subject.name}</h3>
            <StatusBadge booking={booking} bucket={bucket} />
          </div>
          <p className="mt-1 text-sm text-[#b5b1bf]">
            {audience === 'parent' ? `Mit ${booking.tutor.name}` : `Mit ${booking.contact.name}`}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-[#d7ceff]">{booking.package.name}</p>
      </div>

      <dl className="mt-5 grid gap-4 border-t border-white/10 pt-5 text-sm sm:grid-cols-3">
        <div>
          <dt className="flex items-center gap-2 text-[#8d8996]">
            <CalendarClock aria-hidden="true" className="h-4 w-4" />
            Termin
          </dt>
          <dd className="mt-1 font-semibold text-[#f7f5fb]">
            {formatted.date}, {formatted.time} Uhr
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-[#8d8996]">
            <Clock3 aria-hidden="true" className="h-4 w-4" />
            Dauer
          </dt>
          <dd className="mt-1 font-semibold text-[#f7f5fb]">{booking.durationMinutes} Minuten</dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-[#8d8996]">
            {isOnline ? (
              <Monitor aria-hidden="true" className="h-4 w-4" />
            ) : (
              <MapPin aria-hidden="true" className="h-4 w-4" />
            )}
            Ort
          </dt>
          <dd className="mt-1 font-semibold text-[#f7f5fb]">
            {isOnline ? 'Online' : booking.locationVenue || 'Vor Ort'}
          </dd>
        </div>
      </dl>

      {audience === 'tutor' && booking.contact.message ? (
        <div className="mt-4 rounded-xl bg-white/[0.035] p-4 text-sm leading-6 text-[#b5b1bf]">
          <p className="flex items-center gap-2 font-semibold text-[#d8d4df]">
            <UserRound aria-hidden="true" className="h-4 w-4" />
            Hinweis zur Buchung
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words">{booking.contact.message}</p>
        </div>
      ) : null}

      {bucket === 'upcoming' ? (
        <div className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-5 sm:flex-row">
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
          onCancelled={onCancelled}
        />
      ) : null}
    </article>
  );
}

function EmptyBookings({ bucket, audience }: { bucket: BookingBucket; audience: 'parent' | 'tutor' }) {
  const copy = {
    upcoming:
      audience === 'parent'
        ? 'Aktuell sind keine kommenden Stunden geplant.'
        : 'Aktuell sind dir keine kommenden Stunden zugewiesen.',
    past: 'Hier erscheinen vergangene und abgeschlossene Stunden.',
    cancelled: 'Es gibt keine stornierten Termine.',
  }[bucket];

  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center">
      <CalendarClock aria-hidden="true" className="mx-auto h-8 w-8 text-[#8067e8]" />
      <h3 className="mt-4 font-bold text-white">Keine Termine in dieser Ansicht</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#b5b1bf]">{copy}</p>
      {bucket === 'upcoming' && audience === 'parent' ? (
        <Link
          href="/matching"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#8067e8] px-4 text-sm font-bold text-white transition-colors hover:bg-[#927cf0]"
        >
          Tutor finden
        </Link>
      ) : null}
    </div>
  );
}

export function BookingsPanel({ bookings, audience, onBookingCancelled }: BookingsPanelProps) {
  const [activeBucket, setActiveBucket] = useState<BookingBucket>('upcoming');
  const [now] = useState(() => Date.now());
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
        {audience === 'parent' ? (
          <Link
            href="/booking"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#8067e8] px-4 text-sm font-bold text-white transition-colors hover:bg-[#927cf0]"
          >
            Neue Stunde buchen
          </Link>
        ) : null}
      </div>

      <div className="mt-6 overflow-x-auto pb-1">
        <div className="inline-flex min-w-full gap-1 rounded-xl border border-white/10 bg-[#0d0d13] p-1 sm:min-w-0" role="group" aria-label="Termine filtern">
          {(Object.keys(bucketLabels) as BookingBucket[]).map((bucket) => (
            <button
              key={bucket}
              type="button"
              aria-pressed={activeBucket === bucket}
              onClick={() => setActiveBucket(bucket)}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-[#b5b1bf] transition-colors hover:text-white aria-pressed:bg-[#20202b] aria-pressed:text-white sm:flex-none"
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
              onCancelled={onBookingCancelled}
            />
          ))
        ) : (
          <EmptyBookings bucket={activeBucket} audience={audience} />
        )}
      </div>
    </section>
  );
}

export function countUpcomingBookings(bookings: BookingDto[], now: number): number {
  return bookings.filter((booking) => getBookingBucket(booking, now) === 'upcoming').length;
}
