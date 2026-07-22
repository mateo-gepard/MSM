'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { TUTOR_CATALOG } from '@/domain/catalog';
import { useAuth } from '@/hooks/useAuth';
import {
  readApiResponse,
  type ProfileDto,
  type ProfileResponse,
} from '@/components/dashboard/contracts';
import { clientErrorMessage } from '@/lib/api/client-error';

export default function TutorAccessPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    const controller = new AbortController();

    const resolveTutorAccess = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/profile', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await readApiResponse<ProfileResponse>(
          response,
          'Dein Zugriffsprofil konnte nicht geladen werden.',
        );
        const nextProfile = payload.data.profile;

        if (nextProfile.role === 'tutor' && nextProfile.tutorSlug) {
          router.replace(`/tutor-dashboard/${nextProfile.tutorSlug}`);
          return;
        }

        setProfile(nextProfile);
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === 'AbortError') return;
        setError(clientErrorMessage(caughtError, 'Der Tutorzugang konnte nicht geprüft werden.'));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void resolveTutorAccess();
    return () => controller.abort();
  }, [authLoading, router, user]);

  if (authLoading || isLoading || (user && !profile && !error)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-6" role="status">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[var(--action)]" />
          <p className="mt-4 text-sm text-[var(--ink-muted)]">Tutorzugang wird geprüft …</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-5">
        <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-7 text-center sm:p-8">
          <UserRoundCheck aria-hidden="true" className="mx-auto h-9 w-9 text-[#9b83ff]" />
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">Tutorzugang</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            Melde dich mit deinem persönlichen Tutorkonto an. Das zugeordnete Dashboard wird danach
            automatisch geöffnet.
          </p>
          <Link
            href="/login?redirect=%2Ftutor-login"
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--action)] px-4 text-sm font-bold text-white transition-colors hover:bg-[var(--action-hover)]"
          >
            Sicher anmelden
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          <p className="mt-5 text-xs leading-5 text-[var(--ink-subtle)]">
            Es gibt keine manuelle Auswahl des Tutors. Der Zugriff folgt ausschließlich der serverseitigen
            Kontozuordnung.
          </p>
        </div>
      </div>
    );
  }

  if (error || profile?.role === 'parent' || (profile?.role === 'tutor' && !profile.tutorSlug)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-5">
        <div className="w-full max-w-md rounded-2xl border border-amber-200/20 bg-[var(--surface)] p-7 text-center sm:p-8">
          <ShieldCheck aria-hidden="true" className="mx-auto h-9 w-9 text-amber-200" />
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">Kein Tutorzugriff</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            {error ||
              (profile?.role === 'tutor'
                ? 'Deinem Konto ist noch kein Tutorprofil zugeordnet. Bitte wende dich an die Administration.'
                : 'Dieses Konto ist keinem Tutorprofil zugeordnet.')}
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-4 text-sm font-bold text-white transition-colors hover:bg-white/5"
          >
            Zum persönlichen Bereich
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] px-5 py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-7 w-7 shrink-0 text-[#9b83ff]" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9b83ff]">Adminzugriff</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Tutordashboard öffnen</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                Dein administratives Profil wurde geprüft. Wähle ein Dashboard über seinen stabilen
                Eintrag des Tutors.
              </p>
            </div>
          </div>

          <ul className="mt-7 grid gap-3 sm:grid-cols-2">
            {TUTOR_CATALOG.map((tutor) => (
              <li key={tutor.slug}>
                <Link
                  href={`/tutor-dashboard/${tutor.slug}`}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--canvas-soft)] px-4 py-3 font-bold text-white transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-raised)]"
                >
                  <span>{tutor.name}</span>
                  <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#9b83ff]" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
