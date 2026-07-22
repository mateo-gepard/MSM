'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpenCheck,
  CalendarDays,
  LogOut,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { signOut } from '@/lib/auth';
import { isChatAuthorizedBookingLifecycle } from '@/domain/chat';
import { MessagesWorkspace } from '@/components/chat/MessagesWorkspace';
import type { ChatConversation } from '@/components/chat/ChatPanel';
import { BookingsPanel, countUpcomingBookings } from './BookingsPanel';
import { PackagesPanel } from './PackagesPanel';
import { LearnersPanel } from './LearnersPanel';
import { type BookingDto, type DashboardData } from './contracts';

type DashboardSection = 'bookings' | 'learners' | 'packages' | 'messages';

const dashboardSections = [
  { id: 'bookings', label: 'Termine', icon: CalendarDays },
  { id: 'learners', label: 'Lernende', icon: UserRoundCheck },
  { id: 'packages', label: 'Guthaben', icon: PackageCheck },
  { id: 'messages', label: 'Nachrichten', icon: MessageCircle },
] as const;

const transitionalBookingStatuses = new Set<BookingDto['status']>([
  'provider_pending',
  'pending_confirmation',
  'cancellation_pending',
  'reschedule_pending',
]);

function buildParentConversations(bookings: BookingDto[]): ChatConversation[] {
  return [...bookings]
    .filter((booking) => isChatAuthorizedBookingLifecycle(booking.status))
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
    .map((booking) => {
      const lessonDate = new Intl.DateTimeFormat('de-DE', {
        dateStyle: 'medium',
        timeZone: booking.timeZone,
      }).format(new Date(booking.startsAt));
      return {
        key: booking.id,
        title: booking.tutor.name,
        description: `${booking.subject.name} · ${booking.learner.displayName} · ${lessonDate}`,
        tutorSlug: booking.tutor.slug,
        bookingId: booking.id,
      };
    })
    .sort((left, right) => left.title.localeCompare(right.title, 'de'));
}

export function ParentDashboard({ initialData }: { initialData: DashboardData }) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<DashboardSection>('bookings');
  const [localData, setLocalData] = useState(() => ({
    source: initialData,
    value: initialData,
  }));
  const data = localData.source === initialData ? localData.value : initialData;
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const visibleSections = dashboardSections.filter(
    (section) => section.id !== 'packages' || data.permissions.canManageBilling,
  );

  const refreshDashboard = useCallback(() => {
    setCurrentTime(Date.now());
    router.refresh();
  }, [router]);

  const updateData = (update: (current: DashboardData) => DashboardData) => {
    setLocalData((current) => {
      const latestData = current.source === initialData ? current.value : initialData;
      return { source: initialData, value: update(latestData) };
    });
  };

  const hasTransitionalBooking = data.bookings.some((booking) =>
    transitionalBookingStatuses.has(booking.status),
  );

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshDashboard();
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
  }, [hasTransitionalBooking, refreshDashboard]);

  const conversations = useMemo(
    () => buildParentConversations(data.bookings),
    [data.bookings],
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

  const handleBookingStatusChanged = (
    bookingId: string,
    status: 'cancelled' | 'cancellation_pending',
  ) => {
    updateData((current) => ({
      ...current,
      bookings: current.bookings.map((booking) =>
        booking.id === bookingId ? { ...booking, status } : booking,
      ),
    }));
    refreshDashboard();
  };

  const handleLearnersChange = (learners: DashboardData['learners']) => {
    const learnersById = new Map(learners.map((learner) => [learner.id, learner]));
    updateData((current) => ({
      ...current,
      learners,
      bookings: current.bookings.map((booking) => {
        const learner = learnersById.get(booking.learner.id);
        return learner
          ? { ...booking, learner: { ...booking.learner, displayName: learner.displayName } }
          : booking;
      }),
    }));
    refreshDashboard();
  };

  const upcomingCount = countUpcomingBookings(data.bookings, currentTime);
  const remainingSessions = data.entitlements
    .filter((entitlement) => entitlement.status === 'active')
    .reduce((total, entitlement) => total + entitlement.remainingSessions, 0);
  const learnerCount = data.learners.filter((learner) => learner.isActive).length;
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

        <section
          className={`grid gap-3 py-6 ${data.permissions.canManageBilling ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
          aria-label="Übersicht"
        >
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <CalendarDays aria-hidden="true" className="h-5 w-5 text-[#9b83ff]" />
            <p className="mt-4 text-2xl font-bold tabular-nums text-white">{upcomingCount}</p>
            <p className="mt-1 text-sm text-[var(--ink-subtle)]">Anstehende Termine</p>
          </div>
          {data.permissions.canManageBilling ? <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <BookOpenCheck aria-hidden="true" className="h-5 w-5 text-[#9b83ff]" />
            <p className="mt-4 text-2xl font-bold tabular-nums text-white">{remainingSessions}</p>
            <p className="mt-1 text-sm text-[var(--ink-subtle)]">Verifizierte Stunden übrig</p>
          </div> : null}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <UsersRound aria-hidden="true" className="h-5 w-5 text-[#9b83ff]" />
            <p className="mt-4 text-2xl font-bold tabular-nums text-white">{learnerCount}</p>
            <p className="mt-1 text-sm text-[var(--ink-subtle)]">Aktive Lernende</p>
          </div>
        </section>

        <nav className="mb-8 overflow-x-auto" aria-label="Dashboardbereiche">
          <div className="inline-flex min-w-full gap-1 rounded-xl border border-[var(--line)] bg-[var(--canvas-soft)] p-1 sm:min-w-0">
            {visibleSections.map((section) => {
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
            canManageBookings={data.permissions.canBook}
            onBookingStatusChanged={handleBookingStatusChanged}
          />
        ) : null}

        {activeSection === 'packages' && data.permissions.canManageBilling ? (
          <PackagesPanel entitlements={data.entitlements} />
        ) : null}

        {activeSection === 'learners' ? (
          <LearnersPanel
            learners={data.learners}
            canManage={data.permissions.canManageLearners}
            onLearnersChange={handleLearnersChange}
          />
        ) : null}

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
              identityContext="household"
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
