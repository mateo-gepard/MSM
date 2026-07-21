import { NextResponse } from 'next/server';
import { getPackageByDbId } from '@/domain/catalog';
import type { EntitlementListItem, EntitlementListResponse } from '@/domain/dashboard-dtos';
import { ApiError, apiErrorResponse } from '@/lib/api/errors';
import { requireAuthenticatedUser } from '@/lib/auth/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const service = createSupabaseServiceClient();
    const { data: rows, error } = await service
      .from('package_purchases')
      .select(
        'id,package_id,total_sessions,used_sessions,remaining_sessions,status,payment_status,created_at',
      )
      .eq('user_id', user.id)
      .eq('payment_status', 'verified')
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Package data is temporarily unavailable.');

    const entitlements = (rows ?? []).flatMap<EntitlementListItem>((row) => {
      const item = getPackageByDbId(row.package_id);
      if (!item || row.payment_status !== 'verified') return [];
      return [{
        id: row.id,
        package: { id: item.id, name: item.name, sessions: item.sessions },
        totalSessions: row.total_sessions,
        usedSessions: row.used_sessions,
        remainingSessions: row.remaining_sessions,
        status: row.status,
        paymentStatus: 'verified',
        createdAt: row.created_at,
      }];
    });
    const response: EntitlementListResponse = { data: { entitlements } };
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
