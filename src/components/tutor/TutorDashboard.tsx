'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  CalendarCog,
  ChevronLeft,
  LogOut,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { TutorSlug } from '@/domain/catalog';
import { getTutorBySlug } from '@/domain/catalog';
import { isChatAuthorizedBookingLifecycle } from '@/domain/chat';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { ClientVisibleError, clientErrorMessage } from '@/lib/api/client-error';
import { MessagesWorkspace } from '@/components/chat/MessagesWorkspace';
import type { ChatConversation } from '@/components/chat/ChatPanel';
import { BookingsPanel, countUpcomingBookings } from '@/components/dashboard/BookingsPanel';
import {
  readApiResponse,
  type BookingDto,
  type BookingsResponse,
  type ProfileDto,
  type ProfileResponse,
} from '@/components/dashboard/contracts';

type TutorSection = 'bookings' | 'messages';

interface TutorDashboardData {
  profile: ProfileDto;
  bookings: BookingDto[];
}

const transitionalBookingStatuses = new Set<BookingDto['status']>([
  'provider_pending',
  'pending_confirmation',
  'cancellation_pending',
  'reschedule_pending',
]);

function buildTutorConversations(bookings: BookingDto[], tutorSlug: TutorSlug): ChatConversation[] {
  return [...bookings]
    .filter((booking) => isChatAuthorizedBookingLifecycle(booking.status))
    .sort((left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime())
    .map((booking) => {
      const lessonDate = new Intl.DateTimeFormat('de-DE', {
        dateStyle: 'medium',
        timeZone: booking.timeZone,
      }).format(new Date(booking.startsAt));
      return {
        key: booking.id,
        title: booking.contact.name,
        description: `${booking.subject.name} · ${booking.learner.displayName} · ${lessonDate}`,
        tutorSlug,
        bookingId: booking.id,
      };
    });
}

function TutorLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-8" role="status">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[var(--action)]" />
        <p className="mt-4 text-sm text-[var(--ink-muted)]">Zugriff wird geprüft …</p>
      </div>
    </div>
  );
}

export function TutorDashboard({ tutorSlug }: { tutorSlug: TutorSlug }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const tutor = getTutorBySlug(tutorSlug);
  const [activeSection, setActiveSection] = useState<TutorSection>('bookings');
  const [data, setData] = useState<TutorDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const hasLoadedDataRef = useRef(false);

  const refreshTutorData = useCallback(() => {
    setCurrentTime(Date.now());
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(`/tutor-dashboard/${tutorSlug}`)}`);
    }
  }, [authLoading, router, tutorSlug, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    const controller = new AbortController();

    const loadTutorDashboard = async () => {
      setIsLoading(!hasLoadedDataRef.current);
      setLoadError(null);

      try {
        const profileResponse = await fetch('/api/profile', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (profileResponse.status === 401) {
          router.replace(`/login?redirect=${encodeURIComponent(`/tutor-dashboard/${tutorSlug}`)}`);
          return;
        }
        const profilePayload = await readApiResponse<ProfileResponse>(
          profileResponse,
          'Dein Zugriffsprofil konnte nicht geladen werden.',
        );
        const profile = profilePayload.data.profile;

        if (profile.role === 'parent') {
          throw new ClientVisibleError('Dieses Konto hat keinen Zugriff auf Tutordashboards.');
        }
        if (profile.role === 'tutor' && profile.tutorSlug !== tutorSlug) {
          if (profile.tutorSlug) router.replace(`/tutor-dashboard/${profile.tutorSlug}`);
          else throw new ClientVisibleError('Deinem Tutorkonto ist noch kein Tutorprofil zugeordnet.');
          return;
        }

        const bookingsResponse = await fetch(
          `/api/bookings?tutorSlug=${encodeURIComponent(tutorSlug)}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        const bookingsPayload = await readApiResponse<BookingsResponse>(
          bookingsResponse,
          'Die zugewiesenen Termine konnten nicht geladen werden.',
        );

        hasLoadedDataRef.current = true;
        setData({
          profile,
          bookings: bookingsPayload.data.bookings.filter(
            (booking) => booking.tutor.slug === tutorSlug,
          ),
        });
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === 'AbortError') return;
        setLoadError(clientErrorMessage(caughtError, 'Das Tutordashboard konnte nicht geladen werden.'));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadTutorDashboard();
    return () => controller.abort();
  }, [authLoading, reloadKey, router, tutorSlug, user]);

  const hasTransitionalBooking =
    data?.bookings.some((booking) => transitionalBookingStatuses.has(booking.status)) ?? false;

  useEffect(() => {
    if (authLoading || !user) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshTutorData();
    };
    const intervalId = window.setInterval(
      refreshWhenVisible,
      hasTransitionalBooking ? 12_000 : 60_000,
    );
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [authLoading, hasTransitionalBooking, refreshTutorData, user]);

  const conversations = useMemo(
    () => (data ? buildTutorConversations(data.bookings, tutorSlug) : []),
    [data, tutorSlug],
  );

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setSignOutError(null);
    const { error } = await signOut();
    if (error) {
      setSignOutError('Abmelden ist fehlgeschlagen. Bitte versuche es erneut.');
      setIsSigningOut(false);
      return;
    }
    router.replace('/');
    router.refresh();
  };

  if (authLoading || (!user && !loadError) || isLoading) return <TutorLoading />;

  if (loadError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-5">
        <div className="w-full max-w-lg rounded-2xl border border-amber-200/20 bg-[var(--surface)] p-7 text-center">
          <ShieldCheck aria-hidden="true" className="mx-auto h-8 w-8 text-amber-200" />
          <h1 className="mt-4 text-xl font-bold text-white">Zugriff nicht möglich</h1>
          <p className="mt-2 text-sm leading-6 text-[#b5b1bf]">
            {loadError || 'Bitte melde dich mit einem berechtigten Tutorkonto an.'}
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-4 text-sm font-bold text-white hover:bg-white/5"
            >
              Zur Startseite
            </Link>
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--action)] px-4 text-sm font-bold text-white hover:bg-[var(--action-hover)]"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Erneut prüfen
            </button>
          </div>
        </div>
      </div>
    );
  }

  const upcomingCount = countUpcomingBookings(data.bookings, currentTime);
  const isAdmin = data.profile.role === 'admin';
  const canUseTutorChat =
    data.profile.roles.includes('tutor') && data.profile.tutorSlug === tutorSlug;

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <header className="border-b border-[var(--line)] bg-[var(--canvas-soft)]">
        <div className="site-container flex flex-col gap-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              aria-label="Zur MSM Startseite"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 text-white transition-colors hover:bg-white/5"
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-white">{tutor.name}</h1>
                {isAdmin ? (
                  <span className="rounded-full border border-[var(--purple)]/30 bg-[var(--purple)]/10 px-2 py-0.5 text-xs font-bold text-[var(--purple-soft)]">
                    Ansicht für Admins
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-[var(--ink-subtle)]">
                Tutordashboard mit{' '}
                {upcomingCount === 1 ? 'einem kommenden Termin' : `${upcomingCount} kommenden Terminen`}
              </p>
            </div>
          </div>
          <div className="sm:text-right">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-bold text-white transition-colors hover:bg-white/5 disabled:opacity-50"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              {isSigningOut ? 'Wird abgemeldet …' : 'Abmelden'}
            </button>
            {signOutError ? (
              <p className="mt-2 text-sm text-red-200" role="alert">
                {signOutError}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="site-container py-8 sm:py-12">
        <nav aria-label="Bereiche des Tutordashboards" className="mb-8">
          <div className="inline-flex w-full gap-1 rounded-xl border border-[var(--line)] bg-[var(--canvas-soft)] p-1 sm:w-auto">
            <button
              type="button"
              aria-current={activeSection === 'bookings' ? 'page' : undefined}
              onClick={() => setActiveSection('bookings')}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-[var(--ink-muted)] hover:text-white aria-[current=page]:bg-[var(--surface-raised)] aria-[current=page]:text-white sm:flex-none"
            >
              <CalendarClock aria-hidden="true" className="h-4 w-4" />
              Termine
            </button>
            {canUseTutorChat ? (
              <button
                type="button"
                aria-current={activeSection === 'messages' ? 'page' : undefined}
                onClick={() => setActiveSection('messages')}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-[var(--ink-muted)] hover:text-white aria-[current=page]:bg-[var(--surface-raised)] aria-[current=page]:text-white sm:flex-none"
              >
                <MessageCircle aria-hidden="true" className="h-4 w-4" />
                Nachrichten
              </button>
            ) : null}
          </div>
        </nav>

        {activeSection === 'bookings' ? (
          <>
            <BookingsPanel
              bookings={data.bookings}
              audience="tutor"
              canManageBookings
              onBookingStatusChanged={(bookingId, status) => {
                setData((current) =>
                  current
                    ? {
                        ...current,
                        bookings: current.bookings.map((booking) =>
                          booking.id === bookingId ? { ...booking, status } : booking,
                        ),
                      }
                    : current,
                );
                refreshTutorData();
              }}
            />
            <aside className="mt-8 flex gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
              <CalendarCog aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-[#9b83ff]" />
              <div>
                <h2 className="font-bold text-white">Verfügbarkeit verwalten</h2>
                <p className="mt-1 text-sm leading-6 text-[#b5b1bf]">
                  Freie Zeiten werden in der zentralen Terminverwaltung gepflegt. Nimm Änderungen dort vor;
                  falls dir der Zugang fehlt, wende dich bitte an die Administration.
                </p>
              </div>
            </aside>
          </>
        ) : null}

        {activeSection === 'messages' && canUseTutorChat ? (
          <section aria-labelledby="tutor-messages-heading">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9b83ff]">Direkter Kontakt</p>
            <h2 id="tutor-messages-heading" className="mt-2 text-2xl font-bold tracking-tight text-white">
              Nachrichten
            </h2>
            <p className="mb-6 mt-2 max-w-2xl text-sm leading-6 text-[#b5b1bf]">
              Jede Unterhaltung wird über eine zugewiesene Buchung sicher freigegeben.
            </p>
            <MessagesWorkspace
              conversations={conversations}
              identityContext="tutor"
              emptyTitle="Noch keine Unterhaltung verfügbar"
              emptyDescription="Sobald dir eine Buchung zugewiesen ist, erscheint der sichere Kontakt hier."
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
