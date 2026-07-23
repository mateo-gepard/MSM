import { NextResponse } from 'next/server';
import { getPackageByDbId } from '@/domain/catalog';
import type { CreditBalance, CreditBalanceResponse } from '@/domain/credit-dtos';
import { ApiError, apiErrorResponse } from '@/lib/api/errors';
import { requireActivePrincipal, requireStaffMfa } from '@/lib/auth/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const principal = await requireActivePrincipal(['parent']);
    await requireStaffMfa(principal);
    if (!principal.householdId || !principal.householdPermissions?.canBook) {
      throw new ApiError(403, 'HOUSEHOLD_BOOKING_FORBIDDEN', 'You cannot book for this household.');
    }

    const { data: rows, error } = await createSupabaseServiceClient()
      .from('package_purchases')
      .select('package_id,remaining_sessions')
      .eq('household_id', principal.householdId)
      .eq('payment_status', 'verified')
      .eq('status', 'active')
      .gt('remaining_sessions', 0);
    if (error) {
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Credit availability is temporarily unavailable.');
    }

    const byPackage = new Map<CreditBalance['packageId'], number>();
    for (const row of rows ?? []) {
      const selectedPackage = getPackageByDbId(row.package_id);
      if (!selectedPackage || selectedPackage.id === 'trial') continue;
      byPackage.set(
        selectedPackage.id,
        (byPackage.get(selectedPackage.id) ?? 0) + row.remaining_sessions,
      );
    }

    const credits: CreditBalance[] = [...byPackage.entries()].map(
      ([packageId, remainingSessions]) => ({ packageId, remainingSessions }),
    );
    const response: CreditBalanceResponse = { data: { credits } };
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
