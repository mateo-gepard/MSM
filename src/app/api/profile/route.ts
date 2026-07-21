import { NextResponse } from 'next/server';
import { getTutorByDbId } from '@/domain/catalog';
import type { ProfileResponse } from '@/domain/dashboard-dtos';
import { ApiError, apiErrorResponse } from '@/lib/api/errors';
import { requireAuthenticatedUser } from '@/lib/auth/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const service = createSupabaseServiceClient();
    const { data: profile, error } = await service
      .from('profiles')
      .select('role,tutor_id,display_name')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Profile data is temporarily unavailable.');
    if (!profile) throw new ApiError(403, 'PROFILE_NOT_PROVISIONED', 'Your account profile is not provisioned.');

    const response: ProfileResponse = {
      data: {
        profile: {
          role: profile.role,
          tutorSlug: profile.tutor_id ? getTutorByDbId(profile.tutor_id)?.slug ?? null : null,
          displayName: profile.display_name,
        },
      },
    };
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
