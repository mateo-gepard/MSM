import { NextResponse } from 'next/server';
import type { EntitlementListResponse } from '@/domain/dashboard-dtos';
import { apiErrorResponse } from '@/lib/api/errors';
import { requireActivePrincipal, requireStaffMfa } from '@/lib/auth/server';
import { getEntitlementsForPrincipal } from '@/lib/dashboard/server';

export async function GET() {
  try {
    const principal = await requireActivePrincipal(['parent']);
    await requireStaffMfa(principal);
    const entitlements = await getEntitlementsForPrincipal(principal);
    const response: EntitlementListResponse = { data: { entitlements } };
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
