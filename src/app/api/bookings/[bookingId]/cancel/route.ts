import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
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

    const body = await request.json().catch(() => ({}));
    const reason = body.reason || body.cancellationReason || 'User requested cancellation';

    console.log(`[API] Cancelling booking ${bookingId} with reason: ${reason}`);

    // Cal.com API endpoint for cancellation
    const url = new URL(`https://api.cal.com/v1/bookings/${bookingId}/cancel`);
    url.searchParams.append('apiKey', apiKey);
    
    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cancellationReason: reason
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[API] Cal.com cancellation failed:', data);
      return NextResponse.json(
        { error: data.message || 'Cancellation failed', details: data },
        { status: response.status }
      );
    }

    console.log('[API] Booking cancelled successfully:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Cancel booking error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
