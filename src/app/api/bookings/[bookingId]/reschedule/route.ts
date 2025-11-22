import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await context.params;
    const apiKey = process.env.CALCOM_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Cal.com API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { start, timeZone = 'Europe/Berlin' } = body;

    if (!start) {
      return NextResponse.json(
        { error: 'Start time is required' },
        { status: 400 }
      );
    }

    console.log(`[API] Rescheduling booking ${bookingId} to ${start}`);

    // Cal.com API endpoint for rescheduling
    const url = new URL(`https://api.cal.com/v1/bookings/${bookingId}`);
    url.searchParams.append('apiKey', apiKey);
    
    const response = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start,
        timeZone,
        rescheduled: true
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[API] Cal.com reschedule failed:', data);
      return NextResponse.json(
        { error: data.message || 'Reschedule failed', details: data },
        { status: response.status }
      );
    }

    console.log('[API] Booking rescheduled successfully:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Reschedule booking error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
