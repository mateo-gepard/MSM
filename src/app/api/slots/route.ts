import { differenceInCalendarDays } from 'date-fns';
import { NextResponse } from 'next/server';
import { slotsQuerySchema, type SlotsResponse } from '@/domain/booking-schemas';
import { ApiError, apiErrorResponse } from '@/lib/api/errors';
import { CalcomApiError, getCalcomSlots } from '@/lib/calcom/server';

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams;
    const query = slotsQuerySchema.parse(Object.fromEntries(search.entries()));
    if (differenceInCalendarDays(new Date(query.end), new Date(query.start)) > 62) {
      throw new ApiError(400, 'DATE_RANGE_TOO_LARGE', 'Availability can be requested for up to 62 days.');
    }

    const response: SlotsResponse = { data: { slots: await getCalcomSlots(query) } };
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    if (error instanceof CalcomApiError) {
      return apiErrorResponse(
        new ApiError(502, 'SCHEDULING_PROVIDER_ERROR', 'Availability is temporarily unavailable.'),
      );
    }
    return apiErrorResponse(error);
  }
}
