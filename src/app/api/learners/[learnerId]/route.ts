import { NextResponse } from 'next/server';
import { learnerIdSchema, updateLearnerSchema } from '@/domain/household-schemas';
import { ApiError, apiErrorResponse, parseJsonRequest } from '@/lib/api/errors';
import { requireActivePrincipal, requireStaffMfa } from '@/lib/auth/server';
import { enforceRateLimit } from '@/lib/rate-limit/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ learnerId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { learnerId: rawLearnerId } = await context.params;
    const learnerId = learnerIdSchema.parse(rawLearnerId);
    const input = updateLearnerSchema.parse(await parseJsonRequest(request));
    const principal = await requireActivePrincipal(['parent']);
    await requireStaffMfa(principal);
    if (!principal.householdId || !principal.householdPermissions?.canManageLearners) {
      throw new ApiError(403, 'LEARNER_MANAGEMENT_FORBIDDEN', 'You cannot manage learners in this household.');
    }
    await enforceRateLimit({
      request,
      scope: 'learner_update',
      limit: 60,
      windowSeconds: 3600,
      subject: principal.user.id,
    });

    const updates = {
      ...(input.displayName !== undefined ? { display_name: input.displayName } : {}),
      ...(input.birthDate !== undefined ? { birth_date: input.birthDate } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      ...(input.displayName !== undefined || input.birthDate !== undefined
        ? { is_legacy_placeholder: false }
        : {}),
    };
    const { data: row, error } = await createSupabaseServiceClient()
      .from('learners')
      .update(updates)
      .eq('id', learnerId)
      .eq('household_id', principal.householdId)
      .select('id,display_name,birth_date,is_active,is_legacy_placeholder')
      .maybeSingle();
    if (error) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'The learner could not be updated.');
    if (!row) throw new ApiError(404, 'LEARNER_NOT_FOUND', 'Learner not found.');

    return NextResponse.json({
      data: {
        learner: {
          id: row.id,
          displayName: row.display_name,
          birthDate: row.birth_date,
          isActive: row.is_active,
          isLegacyPlaceholder: row.is_legacy_placeholder,
        },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
