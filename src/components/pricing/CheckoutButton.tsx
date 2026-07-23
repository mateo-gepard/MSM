'use client';

import { useRef, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { PackageId } from '@/domain/catalog';
import type { CheckoutSessionResponse } from '@/domain/commerce-schemas';
import { apiClientError, clientErrorMessage } from '@/lib/api/client-error';

interface CheckoutButtonProps {
  packageId: Exclude<PackageId, 'trial'>;
  emphasized?: boolean;
}

export function CheckoutButton({ packageId, emphasized = false }: CheckoutButtonProps) {
  const idempotencyKey = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async () => {
    if (isLoading) return;
    idempotencyKey.current ??= crypto.randomUUID();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ packageId, idempotencyKey: idempotencyKey.current }),
      });

      if (response.status === 401) {
        const redirect = encodeURIComponent('/#preise');
        window.location.assign(`/login?redirect=${redirect}`);
        return;
      }

      const payload = (await response.json()) as Partial<CheckoutSessionResponse> & {
        error?: { code?: string };
      };
      if (
        payload.error?.code === 'MFA_REQUIRED' ||
        payload.error?.code === 'MFA_ENROLLMENT_REQUIRED'
      ) {
        window.location.assign(`/mfa?redirect=${encodeURIComponent('/#preise')}`);
        return;
      }
      if (!response.ok || !payload.data?.checkoutUrl) {
        if (payload.error?.code === 'ORDER_NOT_PAYABLE') idempotencyKey.current = null;
        throw apiClientError(payload, 'Der Checkout ist gerade nicht verfügbar.');
      }

      window.location.assign(payload.data.checkoutUrl);
    } catch (caughtError) {
      setError(clientErrorMessage(caughtError, 'Der Checkout ist gerade nicht verfügbar.'));
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-7">
      <button
        type="button"
        onClick={() => void startCheckout()}
        disabled={isLoading}
        className={`inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-4 text-sm font-bold transition-colors disabled:cursor-wait disabled:opacity-65 ${
          emphasized
            ? 'bg-[#6e56cf] text-white hover:bg-[#745bd1]'
            : 'border border-[var(--line-strong)] text-[var(--ink)] hover:bg-white/5'
        }`}
      >
        <span>{isLoading ? 'Sicherer Checkout wird geöffnet …' : 'Paket kaufen'}</span>
        {isLoading ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        )}
      </button>
      {error ? (
        <p className="mt-2 text-xs leading-5 text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
