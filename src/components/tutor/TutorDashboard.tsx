'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
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

function buildTutorConversations(bookings: BookingDto[], tutorSlug: TutorSlug): ChatConversation[] {
  const conversationsByEmail = new Map<
    string,
    { bookingId: string; parentName: string; subjects: Set<string>; startsAt: string }
  >();

  for (const booking of [...bookings].sort(
    (left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime(),
  )) {
    const current = conversationsByEmail.get(booking.contact.email);
    if (current) {
      current.subjects.add(booking.subject.name);
      continue;
    }

    conversationsByEmail.set(booking.contact.email, {
      bookingId: booking.id,
      parentName: booking.contact.name,
      subjects: new Set([booking.subject.name]),
      startsAt: booking.startsAt,
    });
  }

  return [...conversationsByEmail.values()]
    .sort((left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime())
    .map((conversation) => ({
      key: conversation.bookingId,
      title: conversation.parentName,
      description: [...conversation.subjects].join(' · '),
      tutorSlug,
      bookingId: conversation.bookingId,
    }));
}

function TutorLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090d] p-8" role="status">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#8067e8]" />
        <p className="mt-4 text-sm text-[#b5b1bf]">Zugriff wird geprüft …</p>
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
  const [currentTime] = useState(() => Date.now());

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(`/tutor-dashboard/${tutorSlug}`)}`);
    }
  }, [authLoading, router, tutorSlug, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    const controller = new AbortController();

    const loadTutorDashboard = async () => {
      setIsLoading(true);
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
          throw new Error('Dieses Konto hat keinen Zugriff auf Tutor-Dashboards.');
        }
        if (profile.role === 'tutor' && profile.tutorSlug !== tutorSlug) {
          if (profile.tutorSlug) router.replace(`/tutor-dashboard/${profile.tutorSlug}`);
          else throw new Error('Deinem Tutor-Account ist noch kein Tutorprofil zugeordnet.');
          return;
        }

        const bookingsResponse = await fetch('/api/bookings', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const bookingsPayload = await readApiResponse<BookingsResponse>(
          bookingsResponse,
          'Die zugewiesenen Termine konnten nicht geladen werden.',
        );

        setData({
          profile,
          bookings: bookingsPayload.data.bookings.filter(
            (booking) => booking.tutor.slug === tutorSlug,
          ),
        });
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === 'AbortError') return;
        setLoadError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Das Tutor-Dashboard konnte nicht geladen werden.',
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadTutorDashboard();
    return () => controller.abort();
  }, [authLoading, reloadKey, router, tutorSlug, user]);

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
      <div className="flex min-h-screen items-center justify-center bg-[#09090d] p-5">
        <div className="w-full max-w-lg rounded-2xl border border-amber-200/20 bg-[#121219] p-7 text-center">
          <ShieldCheck aria-hidden="true" className="mx-auto h-8 w-8 text-amber-200" />
          <h1 className="mt-4 text-xl font-bold text-white">Zugriff nicht möglich</h1>
          <p className="mt-2 text-sm leading-6 text-[#b5b1bf]">
            {loadError || 'Bitte melde dich mit einem berechtigten Tutor-Konto an.'}
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
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#8067e8] px-4 text-sm font-bold text-white hover:bg-[#927cf0]"
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

  return (
    <div className="min-h-screen bg-[#09090d]">
      <header className="border-b border-white/10 bg-[#0d0d13]">
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
                  <span className="rounded-full border border-[#8067e8]/30 bg-[#8067e8]/10 px-2 py-0.5 text-xs font-bold text-[#d7ceff]">
                    Admin-Ansicht
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-[#8d8996]">Tutor-Dashboard · {upcomingCount} kommende Termine</p>
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
        <nav aria-label="Tutor-Dashboardbereiche" className="mb-8">
          <div className="inline-flex w-full gap-1 rounded-xl border border-white/10 bg-[#0d0d13] p-1 sm:w-auto">
            <button
              type="button"
              aria-current={activeSection === 'bookings' ? 'page' : undefined}
              onClick={() => setActiveSection('bookings')}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-[#b5b1bf] hover:text-white aria-[current=page]:bg-[#20202b] aria-[current=page]:text-white sm:flex-none"
            >
              <CalendarClock aria-hidden="true" className="h-4 w-4" />
              Termine
            </button>
            <button
              type="button"
              aria-current={activeSection === 'messages' ? 'page' : undefined}
              onClick={() => setActiveSection('messages')}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-[#b5b1bf] hover:text-white aria-[current=page]:bg-[#20202b] aria-[current=page]:text-white sm:flex-none"
            >
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              Nachrichten
            </button>
          </div>
        </nav>

        {activeSection === 'bookings' ? (
          <>
            <BookingsPanel
              bookings={data.bookings}
              audience="tutor"
              onBookingCancelled={(bookingId) =>
                setData((current) =>
                  current
                    ? {
                        ...current,
                        bookings: current.bookings.map((booking) =>
                          booking.id === bookingId ? { ...booking, status: 'cancelled' } : booking,
                        ),
                      }
                    : current,
                )
              }
            />
            <aside className="mt-8 flex gap-4 rounded-2xl border border-white/10 bg-[#121219] p-5 sm:p-6">
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

        {activeSection === 'messages' ? (
          <section aria-labelledby="tutor-messages-heading">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9b83ff]">Direkter Kontakt</p>
            <h2 id="tutor-messages-heading" className="mt-2 text-2xl font-bold tracking-tight text-white">
              Nachrichten
            </h2>
            <p className="mb-6 mt-2 max-w-2xl text-sm leading-6 text-[#b5b1bf]">
              Jede Unterhaltung wird über eine zugewiesene Buchung sicher freigegeben.
            </p>
            {isAdmin ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
                <ShieldCheck aria-hidden="true" className="mx-auto h-8 w-8 text-[#8067e8]" />
                <h3 className="mt-4 font-bold text-white">Nachrichten in der Admin-Ansicht deaktiviert</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#b5b1bf]">
                  Administrator:innen können keine Unterhaltung im Namen eines Tutors öffnen.
                </p>
              </div>
            ) : (
              <MessagesWorkspace
                conversations={conversations}
                emptyTitle="Noch keine Unterhaltung verfügbar"
                emptyDescription="Sobald dir eine Buchung zugewiesen ist, erscheint der sichere Kontakt hier."
              />
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
