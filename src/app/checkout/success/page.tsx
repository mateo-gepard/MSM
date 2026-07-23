import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BadgeCheck, CircleAlert, Clock3 } from 'lucide-react';
import { PendingPaymentRefresh } from '@/components/checkout/PendingPaymentRefresh';
import { ApiError } from '@/lib/api/errors';
import { requireActivePrincipal, requireStaffMfa } from '@/lib/auth/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Zahlungsstatus',
  description: 'Deine Zahlung wird sicher bestätigt und dein Stundenguthaben freigeschaltet.',
};

export const dynamic = 'force-dynamic';

interface CheckoutSuccessPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CheckoutSuccessPage({ searchParams }: CheckoutSuccessPageProps) {
  const rawSessionId = (await searchParams).session_id;
  const sessionId = typeof rawSessionId === 'string' ? rawSessionId.trim() : '';
  if (!/^cs_(test|live)_[A-Za-z0-9_]+$/.test(sessionId) || sessionId.length > 255) {
    redirect('/dashboard');
  }

  let principal;
  try {
    principal = await requireActivePrincipal(['parent']);
    await requireStaffMfa(principal);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/login?redirect=${encodeURIComponent(`/checkout/success?session_id=${sessionId}`)}`);
    }
    if (
      error instanceof ApiError &&
      (error.code === 'MFA_REQUIRED' || error.code === 'MFA_ENROLLMENT_REQUIRED')
    ) {
      redirect(`/mfa?redirect=${encodeURIComponent(`/checkout/success?session_id=${sessionId}`)}`);
    }
    throw error;
  }

  const { data: order, error } = await createSupabaseServiceClient()
    .from('payment_orders')
    .select('status')
    .eq('stripe_checkout_session_id', sessionId)
    .eq('user_id', principal.user.id)
    .maybeSingle();
  if (error) throw new ApiError(503, 'PAYMENT_STATUS_UNAVAILABLE', 'Der Zahlungsstatus ist vorübergehend nicht verfügbar.');
  if (!order) redirect('/dashboard');

  const isPaid = order.status === 'paid';
  const isPending = ['pending', 'checkout_created', 'processing'].includes(order.status);
  const title = isPaid
    ? 'Dein Guthaben ist freigeschaltet.'
    : isPending
      ? 'Deine Zahlung wird geprüft.'
      : 'Die Zahlung wurde nicht freigeschaltet.';
  const description = isPaid
    ? 'Der signierte Zahlungswebhook hat Betrag und Paket geprüft und dein Unterrichtsguthaben einmalig verbucht.'
    : isPending
      ? 'Der Checkout ist abgeschlossen. Guthaben entsteht erst, wenn der signierte Zahlungswebhook Betrag und Paket bestätigt hat.'
      : 'Für diesen Checkout ist kein aktives Guthaben verfügbar. Im Dashboard siehst du ausschließlich bestätigte Einheiten.';
  const StatusIcon = isPaid ? BadgeCheck : isPending ? Clock3 : CircleAlert;

  return (
    <div className="min-h-screen bg-[var(--canvas)] py-28 text-[var(--ink)] sm:py-36">
      <div className="site-container max-w-2xl">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-7 text-center sm:p-10">
          <StatusIcon
            aria-hidden="true"
            className={`mx-auto h-11 w-11 ${isPaid ? 'text-emerald-300' : isPending ? 'text-amber-200' : 'text-red-200'}`}
          />
          <p className="eyebrow mt-5">Zahlungsstatus</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[var(--ink-muted)]">
            {description}
          </p>
          {isPending ? (
            <div className="mx-auto mt-6 flex max-w-md items-start gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-4 text-left text-sm text-[var(--ink-muted)]">
              <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--purple-soft)]" />
              <div>
                <p>Das dauert normalerweise nur wenige Sekunden. Bei verzögerten Zahlungsarten kann es länger dauern.</p>
                <PendingPaymentRefresh />
              </div>
            </div>
          ) : null}
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--action)] px-5 text-sm font-bold text-white hover:bg-[var(--action-hover)]"
            >
              Guthaben im Dashboard prüfen
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-5 text-sm font-bold hover:bg-white/5"
            >
              Zur Startseite
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
