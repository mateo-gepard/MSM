'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, KeyRound, Lock, Mail, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FrostedCard } from '@/components/ui/FrostedCard';
import { resetPassword, sendMagicLink, signIn, signUp } from '@/lib/auth';
import { safeInternalRedirect } from '@/lib/security/safe-redirect';

type AuthMode = 'login' | 'signup' | 'magic' | 'reset';

const MODE_COPY: Record<AuthMode, { title: string; description: string }> = {
  login: {
    title: 'Willkommen zurück',
    description: 'Melde dich an, um deine Termine und Nachrichten zu verwalten.',
  },
  signup: {
    title: 'Account erstellen',
    description: 'Ein Account reicht für Buchungen, Nachrichten und Terminänderungen.',
  },
  magic: {
    title: 'Ohne Passwort anmelden',
    description: 'Wir senden dir einen einmalig nutzbaren Anmeldelink per E Mail.',
  },
  reset: {
    title: 'Passwort zurücksetzen',
    description: 'Du erhältst einen sicheren Link, über den du ein neues Passwort setzen kannst.',
  },
};

function friendlyAuthError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String(error.message)
      : '';

  if (/invalid login credentials/i.test(message)) {
    return 'E Mailadresse oder Passwort ist nicht korrekt.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Bitte bestätige zuerst deine E Mailadresse.';
  }
  if (/rate limit|too many requests/i.test(message)) {
    return 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.';
  }
  if (/password should be at least|weak password/i.test(message)) {
    return 'Bitte verwende ein stärkeres Passwort mit mindestens 8 Zeichen.';
  }
  return 'Das hat leider nicht funktioniert. Bitte versuche es erneut.';
}

const inputClassName =
  'min-h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-4 pl-11 text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-subtle)] focus:border-[var(--purple-bright)]';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get('mode');
  const [mode, setMode] = useState<AuthMode>(() =>
    requestedMode === 'signup' || requestedMode === 'magic' || requestedMode === 'reset'
      ? requestedMode
      : 'login',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const redirectUrl = safeInternalRedirect(searchParams.get('redirect'), '/dashboard');
  const loginRequired = searchParams.get('message') === 'login-required';
  const callbackFailed = searchParams.has('error');

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
    setSuccess('');
  }

  async function runAuth(action: () => Promise<void>) {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await action();
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setLoading(false);
    }
  }

  function finishLogin() {
    router.replace(redirectUrl);
    router.refresh();
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAuth(async () => {
      const result = await signIn(email.trim(), password);
      if (result.error) throw result.error;
      if (!result.data.session) throw new Error('Die Anmeldung konnte nicht bestätigt werden.');
      finishLogin();
    });
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAuth(async () => {
      const result = await signUp(email.trim(), password, name, redirectUrl);
      if (result.error) throw result.error;

      if (result.data?.session) {
        finishLogin();
        return;
      }

      setSuccess('Fast geschafft: Bitte bestätige deine E Mailadresse über den Link in deinem Postfach.');
    });
  }

  async function handleMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAuth(async () => {
      const result = await sendMagicLink(email.trim(), redirectUrl);
      if (result.error) throw result.error;
      setSuccess('Der Anmeldelink ist unterwegs. Er kann einmal verwendet werden und läuft automatisch ab.');
    });
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAuth(async () => {
      const result = await resetPassword(email.trim());
      if (result.error) throw result.error;
      setSuccess('Wenn ein Account zu dieser Adresse gehört, findest du gleich einen Link zum Zurücksetzen im Postfach.');
    });
  }

  const copy = MODE_COPY[mode];

  return (
    <section className="site-section min-h-[calc(100vh-5rem)] bg-[var(--canvas)] pt-28 sm:pt-36">
      <div className="site-container grid min-w-0 max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-center">
        <div className="min-w-0 max-w-xl">
          <p className="eyebrow">Dein MSM Account</p>
          <h1 className="mt-5 break-words font-display text-4xl font-medium leading-[0.98] tracking-[-0.045em] text-[var(--ink)] sm:text-6xl">
            Lernen organisieren, ohne Organisationschaos.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-[var(--ink-muted)]">
            Termine, Buchungen und Nachrichten bleiben an einem Ort. Deine Kontaktdaten werden erst nach der Anmeldung an die Buchung übergeben.
          </p>
        </div>

        <div className="min-w-0">
          <div className="mb-6">
            <h2 className="font-display text-4xl font-medium tracking-[-0.035em] text-[var(--ink)]">
              {copy.title}
            </h2>
            <p className="mt-2 leading-7 text-[var(--ink-muted)]">{copy.description}</p>
          </div>

          <FrostedCard className="rounded-2xl p-5 sm:p-7">
            {(loginRequired || callbackFailed) && (
              <div className="mb-5 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-raised)] p-4 text-sm leading-6 text-[var(--ink-muted)]" role="status">
                {loginRequired
                  ? 'Bitte melde dich an, um die Buchung sicher abzuschließen. Deine Auswahl von Tutor, Fach und Paket bleibt im Link erhalten.'
                  : 'Der Anmeldelink konnte nicht bestätigt werden. Fordere bitte einen neuen Link an oder nutze dein Passwort.'}
              </div>
            )}

            <div aria-live="polite" aria-atomic="true">
              {error && (
                <p className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm leading-6 text-red-200" role="alert">
                  {error}
                </p>
              )}
              {success && (
                <p className="mb-5 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-100" role="status">
                  {success}
                </p>
              )}
            </div>

            {mode === 'login' && (
              <form className="space-y-5" onSubmit={handleLogin}>
                <EmailField email={email} onChange={setEmail} autoComplete="email" />
                <PasswordField password={password} onChange={setPassword} autoComplete="current-password" />
                <Button className="w-full" type="submit" size="lg" disabled={loading}>
                  {loading ? 'Anmeldung wird geprüft …' : 'Anmelden'}
                  {!loading && <ArrowRight aria-hidden="true" className="size-4" />}
                </Button>
                <button className="w-full text-sm font-semibold text-[var(--purple-soft)] hover:text-white" type="button" onClick={() => changeMode('reset')}>
                  Passwort vergessen?
                </button>
              </form>
            )}

            {mode === 'signup' && (
              <form className="space-y-5" onSubmit={handleSignup}>
                <label className="block" htmlFor="name">
                  <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Name</span>
                  <span className="relative block">
                    <UserRound aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-subtle)]" />
                    <input id="name" className={inputClassName} name="name" type="text" autoComplete="name" minLength={2} required value={name} onChange={(event) => setName(event.target.value)} />
                  </span>
                </label>
                <EmailField email={email} onChange={setEmail} autoComplete="email" />
                <PasswordField password={password} onChange={setPassword} autoComplete="new-password" showHint />
                <Button className="w-full" type="submit" size="lg" disabled={loading}>
                  {loading ? 'Account wird erstellt …' : 'Account erstellen'}
                  {!loading && <ArrowRight aria-hidden="true" className="size-4" />}
                </Button>
              </form>
            )}

            {mode === 'magic' && (
              <form className="space-y-5" onSubmit={handleMagicLink}>
                <EmailField email={email} onChange={setEmail} autoComplete="email" />
                <Button className="w-full" type="submit" size="lg" disabled={loading}>
                  {loading ? 'Link wird gesendet …' : 'Anmeldelink senden'}
                  {!loading && <Mail aria-hidden="true" className="size-4" />}
                </Button>
              </form>
            )}

            {mode === 'reset' && (
              <form className="space-y-5" onSubmit={handlePasswordReset}>
                <EmailField email={email} onChange={setEmail} autoComplete="email" />
                <Button className="w-full" type="submit" size="lg" disabled={loading}>
                  {loading ? 'Link wird gesendet …' : 'Link zum Zurücksetzen senden'}
                  {!loading && <KeyRound aria-hidden="true" className="size-4" />}
                </Button>
              </form>
            )}

            <div className="mt-6 border-t border-[var(--line)] pt-5 text-center text-sm text-[var(--ink-muted)]">
              {mode !== 'login' ? (
                <button className="font-semibold text-[var(--purple-soft)] hover:text-white" type="button" onClick={() => changeMode('login')}>
                  Zur Anmeldung
                </button>
              ) : (
                <span>
                  Noch kein Account?{' '}
                  <button className="font-semibold text-[var(--purple-soft)] hover:text-white" type="button" onClick={() => changeMode('signup')}>
                    Jetzt registrieren
                  </button>
                </span>
              )}
              {mode === 'login' && (
                <>
                  <span aria-hidden="true" className="mx-2 text-[var(--line-strong)]">·</span>
                  <button className="font-semibold text-[var(--purple-soft)] hover:text-white" type="button" onClick={() => changeMode('magic')}>
                    Anmeldelink nutzen
                  </button>
                </>
              )}
            </div>
          </FrostedCard>

          <p className="mt-5 text-center text-xs leading-5 text-[var(--ink-subtle)]">
            Mit der Nutzung gelten unsere <Link className="underline hover:text-[var(--ink)]" href="/agb">AGB</Link> und unsere <Link className="underline hover:text-[var(--ink)]" href="/datenschutz">Datenschutzhinweise</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}

function EmailField({
  email,
  onChange,
  autoComplete,
}: {
  email: string;
  onChange: (email: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="block" htmlFor="email">
      <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">E Mailadresse</span>
      <span className="relative block">
        <Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-subtle)]" />
        <input id="email" className={inputClassName} name="email" type="email" inputMode="email" autoComplete={autoComplete} required value={email} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  );
}

function PasswordField({
  password,
  onChange,
  autoComplete,
  showHint = false,
}: {
  password: string;
  onChange: (password: string) => void;
  autoComplete: string;
  showHint?: boolean;
}) {
  return (
    <label className="block" htmlFor="password">
      <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Passwort</span>
      <span className="relative block">
        <Lock aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-subtle)]" />
        <input id="password" className={inputClassName} name="password" type="password" autoComplete={autoComplete} minLength={showHint ? 8 : undefined} required value={password} onChange={(event) => onChange(event.target.value)} />
      </span>
      {showHint && <span className="mt-2 block text-xs text-[var(--ink-subtle)]">Mindestens 8 Zeichen.</span>}
    </label>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh] bg-[var(--canvas)]" aria-label="Anmeldung wird geladen" />}>
      <LoginContent />
    </Suspense>
  );
}
