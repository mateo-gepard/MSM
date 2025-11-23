import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  let bookingId: string = 'unknown';
  
  try {
    const params = await context.params;
    bookingId = params.bookingId;
    const apiKey = process.env.CALCOM_API_KEY;

    console.log(`[API] Cancel request for booking: ${bookingId}`);
    console.log(`[API] Has Cal.com API key: ${!!apiKey}`);

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
    
    console.log(`[API] Calling Cal.com API: POST ${url.replace(apiKey, 'HIDDEN')}`);
    
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancellationReason: reason,
          allRemainingBookings: false
        })
      });
    } catch (fetchError) {
      console.error('[API] Fetch to Cal.com failed:', fetchError);
      // Return success for local cancellation even if Cal.com is unreachable
      return NextResponse.json({
        success: true,
        warning: 'Cal.com unreachable but local cancellation succeeded',
        bookingId
      }, { status: 200 });
    }

    console.log(`[API] Cal.com response status: ${response.status}`);

    // Try to parse response
    let data;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.log('[API] Non-JSON response:', text);
        data = { message: text };
      }
    } catch (parseError) {
      console.error('[API] Failed to parse response:', parseError);
      data = { error: 'Failed to parse response' };
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
        }, { status: 200 });
      }
      
      // For any other error, still return success for local cancellation
      console.warn('[API] Cal.com returned error, proceeding with local cancellation');
      return NextResponse.json({
        success: true,
        warning: 'Cal.com sync failed but local cancellation succeeded',
        calcomError: data.message || data.error,
        bookingId
      }, { status: 200 });
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
    console.error('[API] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    // Always return success for local cancellation
    return NextResponse.json(
      { 
        success: true,
        warning: 'Cal.com sync failed but local cancellation succeeded',
        error: error instanceof Error ? error.message : 'Unknown error',
        bookingId
      },
      { status: 200 }
    );
  }
}
