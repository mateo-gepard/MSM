'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Home,
  Loader2,
  LockKeyhole,
  MapPin,
  Monitor,
  ShieldCheck,
} from 'lucide-react';
import { AvailabilityPicker } from '@/components/booking/AvailabilityPicker';
import { LearnerPicker } from '@/components/booking/LearnerPicker';
import {
  PACKAGE_CATALOG,
  SUBJECT_CATALOG,
  TUTOR_CATALOG,
  type PackageId,
  type SubjectId,
  type TutorSlug,
} from '@/domain/catalog';
import type { CreditBalance, CreditBalanceResponse } from '@/domain/credit-dtos';
import { useAuth } from '@/hooks/useAuth';
import {
  apiClientError,
  ClientVisibleError,
  clientErrorMessage,
  germanApiErrorMessage,
} from '@/lib/api/client-error';

type Location = 'online' | 'in-person';
type LocationPreference = 'student-home' | 'public-place';
type Stage = 'details' | 'time' | 'review' | 'success';

export interface BookingInitialState {
  tutorSlug?: TutorSlug;
  subjectId?: SubjectId;
  packageId?: PackageId;
  location?: Location;
  locationVenue?: LocationPreference;
  startsAt?: string;
  rescheduleId?: string;
  stage?: Exclude<Stage, 'success'>;
}

interface BookingFlowProps {
  initial: BookingInitialState;
}

interface ApiResponse {
  data?: {
    booking?: {
      id: string;
      startsAt: string;
      status: string;
    };
  };
  error?: {
    code?: string;
  };
}

interface CreditResponse extends Partial<CreditBalanceResponse> {
  error?: { code?: string };
}

function formatAppointment(isoDate: string, timeZone: string) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(isoDate));
}

function bookingErrorMessage(error: ApiResponse['error']) {
  return germanApiErrorMessage({ error }, 'Die Buchung konnte nicht abgeschlossen werden.');
}

function CreditAvailability({
  packageId,
  onAvailabilityChange,
}: {
  packageId: Exclude<PackageId, 'trial'>;
  onAvailabilityChange: (available: boolean | null) => void;
}) {
  const [result, setResult] = useState<{
    status: 'loading' | 'ready' | 'error';
    credits: CreditBalance[];
    error: string | null;
  }>({ status: 'loading', credits: [], error: null });

  useEffect(() => {
    const controller = new AbortController();
    onAvailabilityChange(null);

    fetch('/api/credits', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        const payload = (await response.json()) as CreditResponse;
        if (!response.ok) {
          throw apiClientError(payload, 'Guthaben konnten nicht geladen werden.');
        }
        return payload.data?.credits ?? [];
      })
      .then((credits) => {
        setResult({ status: 'ready', credits, error: null });
        onAvailabilityChange(
          credits.some((item) => item.packageId === packageId && item.remainingSessions > 0),
        );
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
        setResult({
          status: 'error',
          credits: [],
          error: clientErrorMessage(fetchError, 'Guthaben konnten nicht geladen werden.'),
        });
        onAvailabilityChange(false);
      });

    return () => controller.abort();
  }, [onAvailabilityChange, packageId]);

  const eligibleCredits = result.credits.filter(
    (item) => item.packageId === packageId && item.remainingSessions > 0,
  );

  if (result.status === 'loading') {
    return (
      <div className="flex min-h-24 items-center justify-center rounded-xl border border-white/10 bg-black/10 text-sm text-white/55" role="status">
        <Loader2 className="mr-2 size-4 animate-spin" /> Stundenguthaben wird geprüft
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50" role="alert">
        {result.error}
      </div>
    );
  }

  if (eligibleCredits.length === 0) {
    return (
      <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
        <p className="font-semibold">Kein passendes Guthaben vorhanden</p>
        <p className="mt-1 text-amber-50/75">
          Bezahlte Pakete werden erst nach bestätigtem Zahlungseingang freigeschaltet. Es wird hier keine Zahlung simuliert.
        </p>
        <Link className="mt-3 inline-block font-semibold underline underline-offset-4" href="/#preise">
          Paket sicher kaufen
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
      <p className="text-sm font-semibold text-emerald-100">Stundenguthaben verfügbar</p>
      <p className="mt-1 text-xs leading-5 text-white/60">
        {eligibleCredits.reduce((sum, item) => sum + item.remainingSessions, 0)} Einheiten
        stehen bereit. Der Server verwendet automatisch das älteste passende Guthaben. Eine Einheit
        wird erst nach erfolgreicher Terminbestätigung verbraucht.
      </p>
    </div>
  );
}

function Progress({ stage, rescheduling }: { stage: Stage; rescheduling: boolean }) {
  const stages: Array<{ id: Stage; label: string }> = rescheduling
    ? [
        { id: 'time', label: 'Neuer Termin' },
        { id: 'review', label: 'Bestätigen' },
      ]
    : [
        { id: 'details', label: 'Auswahl' },
        { id: 'time', label: 'Termin' },
        { id: 'review', label: 'Bestätigen' },
      ];
  const currentIndex = stage === 'success' ? stages.length : stages.findIndex((item) => item.id === stage);

  return (
    <ol className="flex items-center" aria-label="Buchungsfortschritt">
      {stages.map((item, index) => {
        const complete = currentIndex > index;
        const active = currentIndex === index;
        return (
          <li key={item.id} className="flex min-w-0 flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                aria-current={active ? 'step' : undefined}
                className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  complete || active
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                    : 'border-white/15 text-[var(--ink-subtle)]'
                }`}
              >
                {complete ? <Check className="size-4" /> : index + 1}
              </span>
              <span className={`hidden text-sm sm:inline ${active ? 'text-white' : 'text-white/60'}`}>
                {item.label}
              </span>
            </div>
            {index < stages.length - 1 && (
              <span className={`mx-3 h-px min-w-5 flex-1 ${complete ? 'bg-[var(--color-accent)]' : 'bg-white/10'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function BookingFlow({ initial }: BookingFlowProps) {
  const { user, loading: authLoading } = useAuth();
  const initialTutor = TUTOR_CATALOG.find((item) => item.slug === initial.tutorSlug);
  const [stage, setStage] = useState<Stage>(initial.stage ?? (initial.rescheduleId ? 'time' : 'details'));
  const [subjectId, setSubjectId] = useState<SubjectId | ''>(initial.subjectId ?? '');
  const [tutorSlug, setTutorSlug] = useState<TutorSlug | ''>(initial.tutorSlug ?? '');
  const [packageId, setPackageId] = useState<PackageId | ''>(initial.packageId ?? '');
  const [startsAt, setStartsAt] = useState(initial.startsAt ?? '');
  const [location, setLocation] = useState<Location>(
    initialTutor?.onlineOnly ? 'online' : initial.location ?? 'online',
  );
  const [locationPreference, setLocationPreference] = useState<LocationPreference | ''>(
    initialTutor?.onlineOnly ? '' : initial.locationVenue ?? '',
  );
  const [meetingPlace, setMeetingPlace] = useState('');
  const [hasEligibleCredit, setHasEligibleCredit] = useState<boolean | null>(null);
  const [learnerId, setLearnerId] = useState('');
  const [contact, setContact] = useState({ name: '', phone: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const [timeZone, setTimeZone] = useState('Europe/Berlin');
  const operationRef = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) setTimeZone(detected);
  }, []);

  const subject = SUBJECT_CATALOG.find((item) => item.id === subjectId);
  const selectedTutor = TUTOR_CATALOG.find((item) => item.slug === tutorSlug);
  const selectedPackage = PACKAGE_CATALOG.find((item) => item.id === packageId);
  const rescheduling = Boolean(initial.rescheduleId);

  const compatibleTutors = useMemo(() => {
    if (!subject) return TUTOR_CATALOG;
    return TUTOR_CATALOG.filter((tutor) => tutor.subjectIds.includes(subject.id));
  }, [subject]);

  const detailsComplete = Boolean(
    subjectId &&
      tutorSlug &&
      selectedTutor?.subjectIds.includes(subjectId) &&
      packageId &&
      !(selectedTutor?.onlineOnly && location === 'in-person') &&
      (location === 'online' || locationPreference),
  );

  const userName =
    typeof user?.user_metadata?.name === 'string'
      ? user.user_metadata.name
      : typeof user?.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : '';
  const contactName = contact.name || userName;
  const contactEmail = user?.email ?? '';

  const loginReturnPath = useMemo(() => {
    const params = new URLSearchParams({ step: 'review' });
    if (subjectId) params.set('subject', subjectId);
    if (tutorSlug) params.set('tutor', tutorSlug);
    if (packageId) params.set('package', packageId);
    if (startsAt) params.set('startsAt', startsAt);
    params.set('location', location);
    if (locationPreference) params.set('venue', locationPreference);
    if (initial.rescheduleId) params.set('reschedule', initial.rescheduleId);
    return `/booking?${params.toString()}`;
  }, [initial.rescheduleId, location, locationPreference, packageId, startsAt, subjectId, tutorSlug]);

  const submitBooking = async () => {
    if (!user || !startsAt) return;
    if (!rescheduling && (!tutorSlug || !subjectId || !packageId)) return;
    if (!rescheduling && !contactName.trim()) {
      setError('Bitte gib einen Namen für die Buchung an.');
      return;
    }
    if (!rescheduling && !learnerId) {
      setError('Bitte wähle aus, für wen die Stunde gebucht wird.');
      return;
    }
    if (!rescheduling && location === 'in-person' && !meetingPlace.trim()) {
      setError('Bitte gib den vereinbarten Treffpunkt oder die Adresse an.');
      return;
    }
    if (!rescheduling && packageId !== 'trial' && hasEligibleCredit !== true) {
      setError('Für dieses Paket ist noch kein bestätigtes Stundenguthaben verfügbar.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const endpoint = rescheduling
        ? `/api/bookings/${encodeURIComponent(initial.rescheduleId!)}/reschedule`
        : '/api/bookings';
      const method = rescheduling ? 'PATCH' : 'POST';
      const operation = rescheduling
        ? { startsAt, timeZone }
        : {
            tutorSlug,
            subjectId,
            packageId,
            startsAt,
            timeZone,
            location,
            learnerId,
            locationVenue: location === 'in-person' ? meetingPlace.trim() : undefined,
            contact: {
              name: contactName.trim(),
              email: contactEmail,
              phone: contact.phone.trim() || undefined,
              message: contact.message.trim() || undefined,
            },
          };
      const fingerprint = JSON.stringify(operation);
      if (operationRef.current?.fingerprint !== fingerprint) {
        operationRef.current = { fingerprint, key: crypto.randomUUID() };
      }
      const body = { ...operation, idempotencyKey: operationRef.current.key };

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new ClientVisibleError(bookingErrorMessage(payload.error));
      }

      setCreatedBookingId(payload.data?.booking?.id ?? initial.rescheduleId ?? null);
      setSyncPending(response.status === 202);
      operationRef.current = null;
      setStage('success');
    } catch (submitError) {
      setError(clientErrorMessage(submitError, 'Die Buchung konnte nicht abgeschlossen werden.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === 'success') {
    return (
      <div className="min-h-screen bg-[var(--color-ink)] pb-24 pt-32 text-white">
        <div className="site-container max-w-2xl">
          <section className="rounded-[2rem] border border-emerald-300/20 bg-emerald-300/[0.07] p-8 text-center sm:p-12">
            <CheckCircle2 className="mx-auto size-12 text-emerald-300" />
            <p className="eyebrow mt-6">
              {syncPending ? 'Abgleich läuft' : rescheduling ? 'Termin aktualisiert' : 'Buchung eingegangen'}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              {syncPending
                ? 'Deine Anfrage wird mit dem Kalender abgeglichen.'
                : rescheduling
                  ? 'Dein neuer Termin ist bestätigt.'
                  : 'Dein Termin ist reserviert.'}
            </h1>
            {startsAt && <p className="mt-4 text-lg text-white/70">{formatAppointment(startsAt, timeZone)}</p>}
            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-white/55">
              {syncPending
                ? 'Bitte sende die Anfrage nicht erneut. Der Status wird per Webhook und automatischem Abgleich aktualisiert.'
                : 'Die Details findest du in deinem Dashboard und in der Bestätigung per E Mail.'}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-6 text-sm font-semibold text-white hover:bg-[var(--color-accent-strong)]"
              >
                Zum Dashboard <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-medium text-white/75 hover:border-white/35 hover:text-white"
              >
                Zur Startseite
              </Link>
            </div>
            {createdBookingId && (
              <p className="mt-8 text-xs text-[var(--ink-subtle)]">Buchungsreferenz: {createdBookingId}</p>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-ink)] pb-24 pt-28 text-white sm:pt-36">
      <div className="site-container min-w-0 max-w-6xl">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="min-w-0">
            <div className="mb-8">
              <p className="eyebrow mb-3">{rescheduling ? 'Termin umbuchen' : 'Termin buchen'}</p>
              <h1 className="break-words text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
                {rescheduling ? 'Wähle einen neuen Zeitpunkt.' : 'Vom passenden Mentor zum festen Termin.'}
              </h1>
              <div className="mt-7 max-w-2xl">
                <Progress stage={stage} rescheduling={rescheduling} />
              </div>
            </div>

            <section className="min-w-0 rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20 sm:p-8">
              {stage === 'details' && (
                <div className="space-y-9">
                  <fieldset>
                    <legend className="text-xl font-semibold">1. Fach auswählen</legend>
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {SUBJECT_CATALOG.map((item) => (
                        <label
                          key={item.id}
                          className={`choice-card cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-medium transition-colors ${
                            subjectId === item.id
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/12 text-white'
                              : 'border-white/10 text-white/60 hover:border-white/25 hover:text-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="subject"
                            className="sr-only"
                            checked={subjectId === item.id}
                            onChange={() => {
                              if (subjectId !== item.id) setStartsAt('');
                              setSubjectId(item.id);
                              if (
                                selectedTutor &&
                                !selectedTutor.subjectIds.includes(item.id)
                              ) {
                                setTutorSlug('');
                              }
                            }}
                          />
                          {item.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="text-xl font-semibold">2. Mentor auswählen</legend>
                    <p className="mt-1 text-sm text-white/50">
                      Angezeigt werden nur Mentoren, die das gewählte Fach unterrichten.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {compatibleTutors.map((tutor) => {
                        const selected = tutorSlug === tutor.slug;
                        return (
                          <button
                            key={tutor.slug}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => {
                              if (tutorSlug !== tutor.slug) setStartsAt('');
                              setTutorSlug(tutor.slug);
                              if (tutor.onlineOnly) {
                                setLocation('online');
                                setLocationPreference('');
                                setMeetingPlace('');
                              }
                            }}
                            className={`flex min-w-0 items-center gap-4 rounded-2xl border p-3 text-left transition-colors ${
                              selected
                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/12'
                                : 'border-white/10 bg-black/10 hover:border-white/25'
                            }`}
                          >
                            <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
                              <Image
                                src={tutor.image}
                                alt=""
                                fill
                                sizes="64px"
                                className="object-cover"
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-white">{tutor.name}</span>
                              <span className="mt-1 block truncate text-xs text-white/60">
                                {tutor.languages.join(' · ')}
                              </span>
                            </span>
                            <span
                              className={`flex size-6 items-center justify-center rounded-full border ${
                                selected
                                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                                  : 'border-white/20'
                              }`}
                            >
                              {selected && <Check className="size-3.5" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="text-xl font-semibold">3. Format und Umfang</legend>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {PACKAGE_CATALOG.map((item) => {
                        const selected = packageId === item.id;
                        return (
                          <label
                            key={item.id}
                            className={`choice-card cursor-pointer rounded-2xl border p-4 transition-colors ${
                              selected
                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/12'
                                : 'border-white/10 bg-black/10 hover:border-white/25'
                            }`}
                          >
                            <input
                              type="radio"
                              name="package"
                              checked={selected}
                              onChange={() => {
                                setPackageId(item.id);
                                setHasEligibleCredit(item.id === 'trial' ? true : null);
                              }}
                              className="sr-only"
                            />
                            <span className="flex items-start justify-between gap-3">
                              <span>
                                <span className="block font-medium">{item.name}</span>
                                <span className="mt-1 block text-sm text-white/50">
                                  {item.sessions === 1 ? '1 × 60 Minuten' : `${item.sessions} × 60 Minuten`}
                                </span>
                              </span>
                              <span className="font-semibold text-[var(--color-accent-soft)]">
                                {item.id === 'trial' ? 'Kostenlos' : 'Guthaben'}
                              </span>
                            </span>
                            {item.id === 'trial' && (
                              <span className="mt-3 block text-xs leading-5 text-white/60">
                                Einmalig für Neukunden; die Berechtigung wird bei der Buchung geprüft.
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {(
                        [
                          ['online', 'Online', Monitor],
                          ['in-person', 'In München', Home],
                        ] as const
                      ).map(([value, label, Icon]) => {
                        const disabled = value === 'in-person' && selectedTutor?.onlineOnly;
                        return (
                          <label
                            key={value}
                            className={`choice-card flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                              location === value
                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/12 text-white'
                                : 'border-white/10 text-white/60 hover:border-white/25'
                            } ${disabled ? 'pointer-events-none opacity-35' : ''}`}
                          >
                            <input
                              type="radio"
                              name="location"
                              checked={location === value}
                              disabled={disabled}
                              onChange={() => {
                                setLocation(value);
                                if (value === 'online') {
                                  setLocationPreference('');
                                  setMeetingPlace('');
                                }
                              }}
                              className="sr-only"
                            />
                            <Icon className="size-4" /> {label}
                          </label>
                        );
                      })}
                    </div>

                    {location === 'in-person' && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {(
                          [
                            ['student-home', 'Beim Schüler zu Hause'],
                            ['public-place', 'Bibliothek oder ruhiger Treffpunkt'],
                          ] as const
                        ).map(([value, label]) => (
                          <label
                            key={value}
                            className={`choice-card cursor-pointer rounded-xl border px-3 py-3 text-sm transition-colors ${
                              locationPreference === value
                                ? 'border-white/35 bg-white/[0.06] text-white'
                                : 'border-white/10 text-white/55 hover:border-white/25'
                            }`}
                          >
                            <input
                              type="radio"
                              name="venue"
                              checked={locationPreference === value}
                              onChange={() => setLocationPreference(value)}
                              className="sr-only"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    )}
                  </fieldset>
                </div>
              )}

              {stage === 'time' && tutorSlug && (
                <AvailabilityPicker
                  tutorSlug={tutorSlug}
                  value={startsAt}
                  timeZone={timeZone}
                  bookingId={initial.rescheduleId}
                  onChange={setStartsAt}
                />
              )}

              {stage === 'time' && !tutorSlug && (
                <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-5 text-sm text-amber-50">
                  Für die Terminabfrage fehlt ein Mentor. Bitte gehe zurück und triff eine Auswahl.
                </div>
              )}

              {stage === 'review' && (
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">Buchung prüfen</h2>
                  <p className="mt-2 text-sm leading-6 text-white/55">
                    Wir verwenden dein Konto zur sicheren Zuordnung des Termins.
                  </p>

                  {authLoading ? (
                    <div className="mt-8 flex min-h-40 items-center justify-center text-sm text-white/55">
                      <Loader2 className="mr-2 size-4 animate-spin" /> Konto wird geprüft
                    </div>
                  ) : !user ? (
                    <div className="mt-8 rounded-2xl border border-white/10 bg-black/15 p-6 text-center sm:p-8">
                      <LockKeyhole className="mx-auto size-8 text-[var(--color-accent-soft)]" />
                      <h3 className="mt-4 text-xl font-semibold">Einloggen, dann verbindlich buchen</h3>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
                        Deine Auswahl und der Termin bleiben in der Rückkehradresse erhalten. Kontaktdaten
                        werden nicht im Browser gespeichert.
                      </p>
                      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                        <Link
                          href={`/login?redirect=${encodeURIComponent(loginReturnPath)}&message=login-required`}
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-6 text-sm font-semibold text-white hover:bg-[var(--color-accent-strong)]"
                        >
                          Einloggen <ArrowRight className="size-4" />
                        </Link>
                        <Link
                          href={`/login?mode=signup&redirect=${encodeURIComponent(loginReturnPath)}`}
                          className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-medium text-white/75 hover:border-white/35 hover:text-white"
                        >
                          Konto erstellen
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-8 space-y-5">
                      {!rescheduling && (
                        <>
                          <LearnerPicker value={learnerId} onChange={setLearnerId} />

                          {packageId === 'trial' ? (
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-white/60">
                              Die kostenlose Probestunde wird beim Absenden serverseitig auf Neukundenberechtigung geprüft.
                            </div>
                          ) : packageId ? (
                            <CreditAvailability
                              key={packageId}
                              packageId={packageId}
                              onAvailabilityChange={setHasEligibleCredit}
                            />
                          ) : null}

                          <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block">
                              <span className="text-sm font-medium text-white">Name für die Buchung</span>
                              <input
                                type="text"
                                autoComplete="name"
                                required
                                value={contactName}
                                onChange={(event) =>
                                  setContact((current) => ({ ...current, name: event.target.value }))
                                }
                                className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/20 px-4 text-white outline-none transition-colors placeholder:text-white/55 focus:border-[var(--color-accent)]"
                              />
                            </label>
                            <label className="block">
                              <span className="text-sm font-medium text-white">E Mailadresse des Kontos</span>
                              <input
                                type="email"
                                value={contactEmail}
                                readOnly
                                className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 text-white/55 outline-none"
                              />
                            </label>
                            <label className="block">
                              <span className="text-sm font-medium text-white">Telefon (optional)</span>
                              <input
                                type="tel"
                                autoComplete="tel"
                                value={contact.phone}
                                onChange={(event) =>
                                  setContact((current) => ({ ...current, phone: event.target.value }))
                                }
                                className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/20 px-4 text-white outline-none transition-colors focus:border-[var(--color-accent)]"
                              />
                            </label>
                            {location === 'in-person' && (
                              <label className="block sm:col-span-2">
                                <span className="text-sm font-medium text-white">Treffpunkt oder Adresse</span>
                                <input
                                  type="text"
                                  autoComplete="street-address"
                                  maxLength={200}
                                  required
                                  value={meetingPlace}
                                  onChange={(event) => setMeetingPlace(event.target.value)}
                                  className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/20 px-4 text-white outline-none transition-colors placeholder:text-white/55 focus:border-[var(--color-accent)]"
                                  placeholder={
                                    locationPreference === 'student-home'
                                      ? 'Straße, Hausnummer, PLZ und Ort'
                                      : 'Name und Adresse des vereinbarten Treffpunkts'
                                  }
                                />
                                <span className="mt-2 block text-xs leading-5 text-[var(--ink-subtle)]">
                                  Diese Angabe wird erst nach dem Login erfasst und nicht in der Rückkehradresse gespeichert.
                                </span>
                              </label>
                            )}
                            <label className="block sm:col-span-2">
                              <span className="text-sm font-medium text-white">Hinweis an den Mentor (optional)</span>
                              <textarea
                                rows={4}
                                maxLength={1000}
                                value={contact.message}
                                onChange={(event) =>
                                  setContact((current) => ({ ...current, message: event.target.value }))
                                }
                                className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none transition-colors focus:border-[var(--color-accent)]"
                                placeholder="Zum Beispiel: Thema der nächsten Klausur oder konkrete Fragen"
                              />
                            </label>
                          </div>
                        </>
                      )}

                      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-5 text-white/50">
                        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--color-accent-soft)]" />
                        Die Buchung wird serverseitig deinem Konto zugeordnet und mit der live geprüften
                        Kalenderverfügbarkeit abgeglichen. Es wird kein lokaler Ersatztermin erzeugt.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="mt-6 flex items-start gap-3 rounded-xl border border-red-300/25 bg-red-300/10 p-4 text-sm leading-6 text-red-50"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/10 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    if (stage === 'details') return;
                    if (stage === 'time') setStage(rescheduling ? 'time' : 'details');
                    if (stage === 'review') setStage('time');
                  }}
                  disabled={stage === 'details' || (rescheduling && stage === 'time')}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-medium text-white/70 transition-colors hover:border-white/35 hover:text-white disabled:invisible"
                >
                  <ArrowLeft className="size-4" /> Zurück
                </button>

                {stage === 'details' && (
                  <button
                    type="button"
                    disabled={!detailsComplete}
                    onClick={() => {
                      setError(null);
                      setStage('time');
                    }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-accent)] px-6 text-sm font-semibold text-white hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Termine anzeigen <ArrowRight className="size-4" />
                  </button>
                )}

                {stage === 'time' && (
                  <button
                    type="button"
                    disabled={!startsAt}
                    onClick={() => {
                      setError(null);
                      setStage('review');
                    }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-accent)] px-6 text-sm font-semibold text-white hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Termin prüfen <ArrowRight className="size-4" />
                  </button>
                )}

                {stage === 'review' && user && !authLoading && (
                  <button
                    type="button"
                    onClick={submitBooking}
                    disabled={
                      submitting ||
                      (!rescheduling && !contactName.trim()) ||
                      (!rescheduling && !learnerId) ||
                      (!rescheduling && location === 'in-person' && !meetingPlace.trim()) ||
                      (!rescheduling && packageId !== 'trial' && hasEligibleCredit !== true)
                    }
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-accent)] px-6 text-sm font-semibold text-white hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Wird gebucht
                      </>
                    ) : (
                      <>
                        {rescheduling ? 'Umbuchung bestätigen' : 'Verbindlich buchen'}
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </section>
          </div>

          <aside className="rounded-2xl border border-white/10 bg-black/15 p-5 lg:sticky lg:top-28">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--ink-subtle)]">
              Deine Auswahl
            </p>
            {selectedTutor ? (
              <div className="mt-4 flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="relative size-14 overflow-hidden rounded-xl bg-white/5">
                  <Image
                    src={selectedTutor.image}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium">{selectedTutor.name}</p>
                  <p className="mt-0.5 text-xs text-white/60">{subject?.name ?? 'Fach noch offen'}</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 border-b border-white/10 pb-4 text-sm text-[var(--ink-subtle)]">Noch kein Mentor gewählt</p>
            )}

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-white/60">Format</dt>
                <dd className="text-right text-white/75">{selectedPackage?.name ?? 'Noch offen'}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-white/60">Abrechnung</dt>
                <dd className="text-right font-medium text-white">
                  {selectedPackage
                    ? selectedPackage.id === 'trial'
                      ? 'Kostenlose Probestunde'
                      : '1 Guthabeneinheit'
                    : 'Noch offen'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-white/60">Ort</dt>
                <dd className="flex items-center gap-1.5 text-right text-white/75">
                  {location === 'online' ? <Monitor className="size-3.5" /> : <MapPin className="size-3.5" />}
                  {location === 'online' ? 'Online' : 'München'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-white/60">Termin</dt>
                <dd className="max-w-44 text-right text-white/75">
                  {startsAt ? formatAppointment(startsAt, timeZone) : 'Noch offen'}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-[var(--ink-subtle)]">
              <Clock3 className="mt-0.5 size-3.5 shrink-0" />
              Der Termin ist erst nach erfolgreicher Bestätigung im Kalender reserviert.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
