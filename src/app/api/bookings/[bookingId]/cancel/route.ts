import { NextRequest, NextResponse } from 'next/server';

/**
 * DELETE /api/bookings/[bookingId]/cancel
 * Cancels a booking in Cal.com (if it exists there)
 * Always returns success=true for local cancellation fallback
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  const params = await context.params;
  const bookingId = params.bookingId;
  
  console.log(`[CANCEL API] Request for booking: ${bookingId}`);

  // Get API key
  const apiKey = process.env.CALCOM_API_KEY;
  if (!apiKey) {
    console.warn('[CANCEL API] No API key configured');
    return NextResponse.json({
      success: true,
      localOnly: true,
      message: 'Local cancellation only (no Cal.com API key)'
    });
  }

  // Get cancellation reason
  const body = await request.json().catch(() => ({}));
  const reason = body.reason || 'User requested cancellation';

  // Try to cancel in Cal.com
  try {
    const url = `https://api.cal.com/v1/bookings/${bookingId}/cancel?apiKey=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'DELETE',  // ← Changed from POST to DELETE
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cancellationReason: reason,
        allRemainingBookings: false
      })
    });

    const responseData = await response.json().catch(() => ({}));
    
    console.log(`[CANCEL API] Cal.com response: ${response.status}`, responseData);

    // Success case
    if (response.ok) {
      return NextResponse.json({
        success: true,
        calcomCancelled: true,
        message: 'Booking cancelled in Cal.com and locally'
      });
    }

    // Not found in Cal.com (404) - treat as local-only booking
    if (response.status === 404) {
      console.log('[CANCEL API] Booking not found in Cal.com - local only');
      return NextResponse.json({
        success: true,
        localOnly: true,
        message: 'Local booking cancelled (not found in Cal.com)'
      });
    }

    // Any other error - proceed with local cancellation anyway
    console.warn('[CANCEL API] Cal.com error, proceeding with local cancellation');
    return NextResponse.json({
      success: true,
      localOnly: true,
      calcomError: responseData.message || responseData.error || 'Unknown Cal.com error',
      message: 'Local cancellation succeeded (Cal.com sync failed)'
    });

  } catch (error) {
    // Network or other error - proceed with local cancellation
    console.error('[CANCEL API] Exception during Cal.com call:', error);
    return NextResponse.json({
      success: true,
      localOnly: true,
      message: 'Local cancellation succeeded (Cal.com unreachable)'
    });
  }
}
