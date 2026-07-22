import { NextResponse } from 'next/server';
import { getTutorByDbId } from '@/domain/catalog';
import type { ProfileResponse } from '@/domain/dashboard-dtos';
import { apiErrorResponse } from '@/lib/api/errors';
import { requireActivePrincipal } from '@/lib/auth/server';

export async function GET() {
  try {
    const principal = await requireActivePrincipal();

    const response: ProfileResponse = {
      data: {
        profile: {
          role: principal.role,
          roles: [...principal.roles],
          tutorSlug: principal.tutorId ? getTutorByDbId(principal.tutorId)?.slug ?? null : null,
          displayName: principal.displayName,
        },
      },
    };
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
