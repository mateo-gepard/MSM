'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FrostedCard } from '@/components/ui/FrostedCard';
import { updatePassword } from '@/lib/auth';

const inputClassName =
  'min-h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-4 pl-11 text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-subtle)] focus:border-[var(--purple-bright)]';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Bitte verwende mindestens 8 Zeichen.');
      return;
    }
    if (password !== confirmation) {
      setError('Die beiden Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);
    try {
      const result = await updatePassword(password);
      if (result.error) throw result.error;
      setSuccess(true);
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : '';
      setError(
        /same password/i.test(message)
          ? 'Das neue Passwort muss sich vom bisherigen Passwort unterscheiden.'
          : /session|token|expired/i.test(message)
            ? 'Der Link zum Zurücksetzen ist abgelaufen. Bitte fordere einen neuen Link an.'
            : 'Das Passwort konnte nicht geändert werden. Bitte fordere einen neuen Link zum Zurücksetzen an.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="site-section min-h-[calc(100vh-5rem)] bg-[var(--canvas)] pt-28 sm:pt-36">
      <div className="site-container max-w-lg">
        <p className="eyebrow">Accountsicherheit</p>
        <h1 className="mt-5 font-display text-5xl font-medium leading-none tracking-[-0.045em] text-[var(--ink)]">
          Neues Passwort setzen
        </h1>
        <p className="mt-4 leading-7 text-[var(--ink-muted)]">
          Der Link aus deiner E Mail bestätigt deine Identität. Lege jetzt ein neues Passwort für deinen MSM Account fest.
        </p>

        <FrostedCard className="mt-8 rounded-2xl p-5 sm:p-7">
          {success ? (
            <div className="text-center" role="status">
              <CheckCircle2 aria-hidden="true" className="mx-auto size-12 text-[var(--success)]" />
              <h2 className="mt-4 font-display text-3xl text-[var(--ink)]">Passwort geändert</h2>
              <p className="mt-2 leading-7 text-[var(--ink-muted)]">
                Dein neues Passwort ist aktiv. Du kannst jetzt zum Dashboard wechseln.
              </p>
              <Link className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--action)] px-6 font-bold text-white hover:bg-[var(--action-hover)]" href="/dashboard">
                Zum Dashboard
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm leading-6 text-red-200" role="alert">
                  {error}
                </p>
              )}

              <PasswordInput id="new-password" label="Neues Passwort" value={password} onChange={setPassword} />
              <PasswordInput id="confirm-password" label="Passwort bestätigen" value={confirmation} onChange={setConfirmation} />

              <p className="text-xs leading-5 text-[var(--ink-subtle)]">
                Verwende mindestens 8 Zeichen und kein Passwort, das du bereits bei einem anderen Dienst nutzt.
              </p>
              <Button className="w-full" type="submit" size="lg" disabled={loading}>
                {loading ? 'Passwort wird gespeichert …' : 'Passwort speichern'}
                {!loading && <ArrowRight aria-hidden="true" className="size-4" />}
              </Button>
            </form>
          )}
        </FrostedCard>

        <p className="mt-6 text-center text-sm text-[var(--ink-muted)]">
          Link abgelaufen?{' '}
          <Link className="font-semibold text-[var(--purple-soft)] hover:text-white" href="/login?mode=reset">
            Neuen Link anfordern
          </Link>
        </p>
      </div>
    </section>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">{label}</span>
      <span className="relative block">
        <Lock aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-subtle)]" />
        <input id={id} className={inputClassName} name={id} type="password" autoComplete="new-password" minLength={8} required value={value} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  );
}
