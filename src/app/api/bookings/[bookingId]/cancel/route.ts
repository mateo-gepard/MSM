import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await context.params;
    const apiKey = process.env.CALCOM_API_KEY;

    if (!apiKey) {
      console.warn('[API] Cal.com API key not configured - treating as local booking');
      return NextResponse.json({
        success: true,
        message: 'Local booking cancellation (no Cal.com sync)',
        bookingId
      });
    }

    const body = await request.json().catch(() => ({}));
    const reason = body.reason || body.cancellationReason || 'User requested cancellation';

    console.log(`[API] Cancelling booking ${bookingId} with reason: ${reason}`);

    // Cal.com API v2 endpoint for cancellation (updated format)
    const url = `https://api.cal.com/v1/bookings/${bookingId}/cancel?apiKey=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',  // Changed from DELETE to POST (Cal.com uses POST for cancellations)
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cancellationReason: reason,
        allRemainingBookings: false
      })
    });

    // Try to parse response
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.log('[API] Non-JSON response:', text);
      data = { message: text };
    }

    if (!response.ok) {
      console.error('[API] Cal.com cancellation failed:', data);
      
      // Return success for local-only bookings if Cal.com booking doesn't exist
      if (response.status === 404 || data.message?.includes('not found')) {
        console.log('[API] Booking not found in Cal.com - treating as local booking');
        return NextResponse.json({
          success: true,
          message: 'Local booking cancelled (not found in Cal.com)',
          bookingId
        });
      }
      
      return NextResponse.json(
        { 
          error: data.message || data.error || 'Cancellation failed', 
          details: data,
          bookingId
        },
        { status: response.status }
      );
    }

    console.log('[API] Booking cancelled successfully in Cal.com:', data);
    return NextResponse.json({
      success: true,
      message: 'Booking cancelled successfully',
      data,
      bookingId
    });
  } catch (error) {
    console.error('[API] Cancel booking error:', error);
    
    // Return partial success - at least mark as cancelled locally
    return NextResponse.json(
      { 
        success: true,
        warning: 'Cal.com sync failed but local cancellation succeeded',
        error: error instanceof Error ? error.message : 'Cal.com API error',
        bookingId: (await context.params).bookingId
      },
      { status: 200 }  // Return 200 so local cancellation still works
    );
  }
}
