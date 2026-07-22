import { NextResponse } from 'next/server';
import {
  createLearnerSchema,
  type LearnerListItem,
  type LearnerListResponse,
} from '@/domain/household-schemas';
import { ApiError, apiErrorResponse, parseJsonRequest } from '@/lib/api/errors';
import { requireActivePrincipal, requireStaffMfa } from '@/lib/auth/server';
import { enforceRateLimit } from '@/lib/rate-limit/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const principal = await requireActivePrincipal(['parent']);
    await requireStaffMfa(principal);
    if (!principal.householdId) {
      throw new ApiError(403, 'HOUSEHOLD_REQUIRED', 'No active household is available.');
    }

    const { data: rows, error } = await createSupabaseServiceClient()
      .from('learners')
      .select('id,display_name,birth_date,is_active,is_legacy_placeholder')
      .eq('household_id', principal.householdId)
      .order('created_at', { ascending: true });
    if (error) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Learners are temporarily unavailable.');

    const learners: LearnerListItem[] = (rows ?? []).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      birthDate: principal.householdPermissions?.canManageLearners ? row.birth_date : null,
      isActive: row.is_active,
      isLegacyPlaceholder: row.is_legacy_placeholder,
    }));
    const response: LearnerListResponse = { data: { learners } };
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = createLearnerSchema.parse(await parseJsonRequest(request));
    const principal = await requireActivePrincipal(['parent']);
    await requireStaffMfa(principal);
    if (!principal.householdId || !principal.householdPermissions?.canManageLearners) {
      throw new ApiError(403, 'LEARNER_MANAGEMENT_FORBIDDEN', 'You cannot manage learners in this household.');
    }
    await enforceRateLimit({
      request,
      scope: 'learner_create',
      limit: 10,
      windowSeconds: 3600,
      subject: principal.user.id,
    });

    const { data: row, error } = await createSupabaseServiceClient()
      .from('learners')
      .insert({
        household_id: principal.householdId,
        display_name: input.displayName,
        birth_date: input.birthDate ?? null,
        created_by_user_id: principal.user.id,
      })
      .select('id,display_name,birth_date,is_active,is_legacy_placeholder')
      .single();
    if (error?.message.includes('HOUSEHOLD_LEARNER_LIMIT_REACHED')) {
      throw new ApiError(
        409,
        'LEARNER_LIMIT_REACHED',
        'Dieser Haushalt hat die maximale Zahl von 25 Lernenden erreicht.',
      );
    }
    if (error) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'The learner could not be added.');

    const learner: LearnerListItem = {
      id: row.id,
      displayName: row.display_name,
      birthDate: row.birth_date,
      isActive: row.is_active,
      isLegacyPlaceholder: row.is_legacy_placeholder,
    };
    return NextResponse.json({ data: { learner } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
