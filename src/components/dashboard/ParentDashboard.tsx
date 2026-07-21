'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpenCheck,
  CalendarDays,
  LogOut,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { MessagesWorkspace } from '@/components/chat/MessagesWorkspace';
import type { ChatConversation } from '@/components/chat/ChatPanel';
import { BookingsPanel, countUpcomingBookings } from './BookingsPanel';
import { PackagesPanel } from './PackagesPanel';
import {
  readApiResponse,
  type BookingDto,
  type BookingsResponse,
  type EntitlementDto,
  type EntitlementsResponse,
  type ProfileDto,
  type ProfileResponse,
} from './contracts';

type DashboardSection = 'bookings' | 'packages' | 'messages';

interface DashboardData {
  profile: ProfileDto;
  bookings: BookingDto[];
  entitlements: EntitlementDto[];
}

const dashboardSections = [
  { id: 'bookings', label: 'Termine', icon: CalendarDays },
  { id: 'packages', label: 'Guthaben', icon: PackageCheck },
  { id: 'messages', label: 'Nachrichten', icon: MessageCircle },
] as const;

function buildParentConversations(bookings: BookingDto[]): ChatConversation[] {
  const tutors = new Map<BookingDto['tutor']['slug'], { name: string; subjects: Set<string> }>();

  for (const booking of bookings) {
    const current = tutors.get(booking.tutor.slug) ?? {
      name: booking.tutor.name,
      subjects: new Set<string>(),
    };
    current.subjects.add(booking.subject.name);
    tutors.set(booking.tutor.slug, current);
  }

  return [...tutors.entries()]
    .map(([tutorSlug, tutor]) => ({
      key: tutorSlug,
      title: tutor.name,
      description: [...tutor.subjects].join(' · '),
      tutorSlug,
    }))
    .sort((left, right) => left.title.localeCompare(right.title, 'de'));
}

function DashboardLoading({ label = 'Dashboard wird geladen …' }: { label?: string }) {
  return (
    <div className="site-container flex min-h-[65vh] items-center justify-center py-16" role="status">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[var(--action)]" />
        <p className="mt-4 text-sm text-[var(--ink-muted)]">{label}</p>
      </div>
    </div>
  );
}

export function ParentDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [activeSection, setActiveSection] = useState<DashboardSection>('bookings');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [currentTime] = useState(() => Date.now());

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?redirect=/dashboard');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    const controller = new AbortController();

    const loadDashboard = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const profileResponse = await fetch('/api/profile', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (profileResponse.status === 401) {
          router.replace('/login?redirect=/dashboard');
          return;
        }
        const profilePayload = await readApiResponse<ProfileResponse>(
          profileResponse,
          'Dein Profil konnte nicht geladen werden.',
        );
        const profile = profilePayload.data.profile;

        if (profile.role === 'tutor') {
          if (profile.tutorSlug) router.replace(`/tutor-dashboard/${profile.tutorSlug}`);
          else throw new Error('Deinem Tutor-Account ist noch kein Profil zugeordnet.');
          return;
        }
        if (profile.role === 'admin') {
          router.replace('/tutor-login');
          return;
        }

        const [bookingsResponse, packagesResponse] = await Promise.all([
          fetch('/api/bookings', { cache: 'no-store', signal: controller.signal }),
          fetch('/api/packages', { cache: 'no-store', signal: controller.signal }),
        ]);
        const [bookingsPayload, packagesPayload] = await Promise.all([
          readApiResponse<BookingsResponse>(bookingsResponse, 'Deine Termine konnten nicht geladen werden.'),
          readApiResponse<EntitlementsResponse>(
            packagesResponse,
            'Dein verifiziertes Guthaben konnte nicht geladen werden.',
          ),
        ]);

        setData({
          profile,
          bookings: bookingsPayload.data.bookings,
          entitlements: packagesPayload.data.entitlements,
        });
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === 'AbortError') return;
        setLoadError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Das Dashboard konnte nicht geladen werden.',
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadDashboard();
    return () => controller.abort();
  }, [authLoading, reloadKey, router, user]);

  const conversations = useMemo(
    () => (data ? buildParentConversations(data.bookings) : []),
    [data],
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

  if (authLoading || (!user && !loadError)) return <DashboardLoading label="Anmeldung wird geprüft …" />;

  if (isLoading) return <DashboardLoading />;

  if (loadError || !data) {
    return (
      <div className="site-container py-16 sm:py-24">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-200/20 bg-[var(--surface)] p-7 text-center">
          <RefreshCw aria-hidden="true" className="mx-auto h-8 w-8 text-amber-200" />
          <h1 className="mt-4 text-xl font-bold text-white">Dashboard nicht verfügbar</h1>
          <p className="mt-2 text-sm leading-6 text-[#b5b1bf]">
            {loadError || 'Bitte versuche es erneut.'}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--action)] px-4 text-sm font-bold text-white transition-colors hover:bg-[var(--action-hover)]"
          >
            Erneut laden
          </button>
        </div>
      </div>
    );
  }

  const upcomingCount = countUpcomingBookings(data.bookings, currentTime);
  const remainingSessions = data.entitlements
    .filter((entitlement) => entitlement.status === 'active')
    .reduce((total, entitlement) => total + entitlement.remainingSessions, 0);
  const tutorCount = new Set(data.bookings.map((booking) => booking.tutor.slug)).size;
  const firstName = data.profile.displayName?.trim().split(/\s+/)[0];

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <div className="site-container py-10 sm:py-14">
        <header className="flex flex-col gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#9b83ff]">
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              Persönlicher Bereich
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-white sm:text-4xl">
              {firstName ? `Hallo, ${firstName}.` : 'Willkommen zurück.'}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#b5b1bf]">
              Termine, bestätigtes Guthaben und Gespräche an einem ruhigen Ort.
            </p>
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
        </header>

        <section className="grid gap-3 py-6 sm:grid-cols-3" aria-label="Übersicht">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <CalendarDays aria-hidden="true" className="h-5 w-5 text-[#9b83ff]" />
            <p className="mt-4 text-2xl font-bold tabular-nums text-white">{upcomingCount}</p>
            <p className="mt-1 text-sm text-[var(--ink-subtle)]">Anstehende Termine</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <BookOpenCheck aria-hidden="true" className="h-5 w-5 text-[#9b83ff]" />
            <p className="mt-4 text-2xl font-bold tabular-nums text-white">{remainingSessions}</p>
            <p className="mt-1 text-sm text-[var(--ink-subtle)]">Verifizierte Stunden übrig</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <UsersRound aria-hidden="true" className="h-5 w-5 text-[#9b83ff]" />
            <p className="mt-4 text-2xl font-bold tabular-nums text-white">{tutorCount}</p>
            <p className="mt-1 text-sm text-[var(--ink-subtle)]">Tutor-Kontakte</p>
          </div>
        </section>

        <nav className="mb-8 overflow-x-auto" aria-label="Dashboardbereiche">
          <div className="inline-flex min-w-full gap-1 rounded-xl border border-[var(--line)] bg-[var(--canvas-soft)] p-1 sm:min-w-0">
            {dashboardSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={activeSection === section.id ? 'page' : undefined}
                  onClick={() => setActiveSection(section.id)}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-bold text-[var(--ink-muted)] transition-colors hover:text-white aria-[current=page]:bg-[var(--surface-raised)] aria-[current=page]:text-white sm:flex-none"
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </nav>

        {activeSection === 'bookings' ? (
          <BookingsPanel
            bookings={data.bookings}
            audience="parent"
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
        ) : null}

        {activeSection === 'packages' ? <PackagesPanel entitlements={data.entitlements} /> : null}

        {activeSection === 'messages' ? (
          <section aria-labelledby="messages-heading">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9b83ff]">Direkter Kontakt</p>
            <h2 id="messages-heading" className="mt-2 text-2xl font-bold tracking-tight text-white">
              Nachrichten
            </h2>
            <p className="mb-6 mt-2 max-w-2xl text-sm leading-6 text-[#b5b1bf]">
              Unterhaltungen sind nur für Tutoren verfügbar, bei denen eine eigene Buchung besteht.
            </p>
            <MessagesWorkspace
              conversations={conversations}
              emptyTitle="Noch keine Unterhaltung verfügbar"
              emptyDescription="Sobald du eine Stunde gebucht hast, kannst du deinen Tutor hier sicher kontaktieren."
            />
          </section>
        ) : null}

        <div className="mt-12 border-t border-[var(--line)] pt-6 text-sm text-[var(--ink-subtle)]">
          Brauchst du Hilfe? Die rechtlichen Hinweise findest du in den{' '}
          <Link href="/agb" className="font-semibold text-[#d7ceff] underline underline-offset-4">
            AGB
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
