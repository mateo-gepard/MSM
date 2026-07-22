'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useId, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { safeInternalRedirect } from '@/lib/security/safe-redirect';

interface TotpSetup {
  factorId: string;
  qrCode: string | null;
  secret: string | null;
  enrolled: boolean;
}

function MfaContent() {
  const codeId = useId();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeInternalRedirect(searchParams.get('redirect'), '/tutor-login');
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'verifying'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const prepare = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace(`/login?redirect=${encodeURIComponent(`/mfa?redirect=${encodeURIComponent(redirectTo)}`)}`);
        return;
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const verifiedFactor = factors.totp.find((factor) => factor.status === 'verified');
      if (verifiedFactor) {
        if (active) {
          setSetup({ factorId: verifiedFactor.id, qrCode: null, secret: null, enrolled: true });
          setStatus('ready');
        }
        return;
      }

      // An abandoned enrollment cannot be resumed because Supabase does not
      // return its secret/QR code again. Remove only unverified TOTP factors
      // before creating one fresh enrollment, so repeated visits do not pile up.
      const pendingFactors = factors.all.filter(
        (factor) => factor.factor_type === 'totp' && factor.status === 'unverified',
      );
      for (const factor of pendingFactors) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({
          factorId: factor.id,
        });
        if (unenrollError) throw unenrollError;
      }

      const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'MSM Mitarbeiter Zugang',
      });
      if (enrollmentError) throw enrollmentError;
      if (active) {
        setSetup({
          factorId: enrollment.id,
          qrCode: enrollment.totp.qr_code,
          secret: enrollment.totp.secret,
          enrolled: false,
        });
        setStatus('ready');
      }
    };

    void prepare().catch(() => {
      if (!active) return;
      setError('MFA konnte nicht vorbereitet werden. Bitte versuche es erneut.');
      setStatus('ready');
    });
    return () => {
      active = false;
    };
  }, [redirectTo, router]);

  const verify = async () => {
    if (!setup || !/^\d{6}$/.test(code)) return;
    setStatus('verifying');
    setError(null);
    const { error: verificationError } = await getSupabaseBrowserClient().auth.mfa.challengeAndVerify({
      factorId: setup.factorId,
      code,
    });
    if (verificationError) {
      setError('Der Code ist ungültig oder abgelaufen. Bitte versuche es erneut.');
      setStatus('ready');
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] px-5 py-24 text-white sm:py-32">
      <div className="mx-auto max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-7 sm:p-9">
        <ShieldCheck aria-hidden="true" className="h-10 w-10 text-[var(--purple-bright)]" />
        <p className="eyebrow mt-5">Mitarbeiter Sicherheit</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Zweiten Faktor bestätigen</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          Tutor und Admin Konten benötigen einen zeitbasierten Einmalcode. Der Code schützt Schülerdaten
          auch dann, wenn ein Passwort kompromittiert wurde.
        </p>

        {status === 'loading' ? (
          <div className="mt-8 flex min-h-28 items-center justify-center text-sm text-[var(--ink-muted)]" role="status">
            <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> Sicherheit wird geprüft
          </div>
        ) : setup ? (
          <form
            className="mt-7"
            onSubmit={(event) => {
              event.preventDefault();
              void verify();
            }}
          >
            {!setup.enrolled && setup.qrCode ? (
              <div className="mb-6 rounded-xl border border-white/10 bg-white p-4 text-center text-black">
                <Image
                  src={setup.qrCode}
                  alt="QR Code für die Authenticator App"
                  width={220}
                  height={220}
                  unoptimized
                  className="mx-auto"
                />
                {setup.secret ? <p className="mt-3 break-all font-mono text-xs">{setup.secret}</p> : null}
              </div>
            ) : null}
            <label htmlFor={codeId} className="block text-sm font-semibold text-[var(--ink-muted)]">
              Sechsstelliger Authenticator Code
            </label>
            <div className="mt-2 flex items-center rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 focus-within:border-[var(--action)]">
              <KeyRound aria-hidden="true" className="h-4 w-4 text-[var(--ink-subtle)]" />
              <input
                id={codeId}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                required
                className="min-h-12 w-full bg-transparent px-3 text-lg tracking-[0.3em] text-white outline-none"
              />
            </div>
            {error ? <p className="mt-3 text-sm text-red-200" role="alert">{error}</p> : null}
            <button
              type="submit"
              disabled={status === 'verifying' || code.length !== 6}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--action)] px-4 text-sm font-bold text-white hover:bg-[var(--action-hover)] disabled:opacity-50"
            >
              {status === 'verifying' ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <ShieldCheck aria-hidden="true" className="h-4 w-4" />}
              Sicher anmelden
            </button>
          </form>
        ) : (
          <div className="mt-7 rounded-xl border border-red-300/20 bg-red-300/[0.05] p-4 text-sm text-red-100" role="alert">
            {error || 'MFA konnte nicht vorbereitet werden.'}
          </div>
        )}

        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-[var(--ink-muted)] underline underline-offset-4">
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}

export default function MfaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] text-[var(--ink-muted)]">
          Sicherheit wird geladen …
        </div>
      }
    >
      <MfaContent />
    </Suspense>
  );
}
