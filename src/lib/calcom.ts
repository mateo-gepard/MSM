import { saveBookingToSupabase, updateBookingStatus, deleteBooking, supabase, getUserBookings } from './supabase';

// Use Next.js API route as proxy to avoid CORS issues
const CALCOM_API_PROXY = '/api/bookings';
const CALCOM_API_BASE = 'https://api.cal.com/v1'; // For direct server-side calls if needed

/**
 * Fetch real-time availability slots from Cal.com for a specific tutor and date range
 * @param calcomUsername - The Cal.com username of the tutor (e.g., "alexander-schmidt")
 * @param eventTypeSlug - The event type slug (e.g., "60min")
 * @param dateFrom - Start date in YYYY-MM-DD format
 * @param dateTo - End date in YYYY-MM-DD format
 * @returns Array of available time slots
 */
export async function getCalcomAvailability(
  calcomUsername: string,
  eventTypeSlug: string,
  dateFrom: string,
  dateTo: string
): Promise<string[]> {
  try {
    console.log(`Fetching Cal.com availability for ${calcomUsername}/${eventTypeSlug}`);
    
    // Cal.com API endpoint for public availability
    const url = `https://cal.com/api/trpc/public/slots.getSchedule?input=${encodeURIComponent(
      JSON.stringify({
        json: {
          isTeamEvent: false,
          usernameList: [calcomUsername],
          eventTypeSlug: eventTypeSlug,
          startTime: `${dateFrom}T00:00:00.000Z`,
          endTime: `${dateTo}T23:59:59.999Z`,
          timeZone: 'Europe/Berlin'
        }
      })
    )}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch Cal.com availability:', response.status);
      return [];
    }

    const data = await response.json();
    
    // Extract time slots from Cal.com response
    if (data.result?.data?.json?.slots) {
      const slots = Object.values(data.result.data.json.slots).flat() as any[];
      return slots.map((slot: any) => {
        const time = new Date(slot.time);
        return time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });
      });
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching Cal.com availability:', error);
    return [];
  }
}

export async function createBooking(data: {
  eventTypeId: number;
  start: string; // ISO 8601
  responses: {
    name: string;
    email: string;
    notes?: string;
  };
  metadata: {
    tutorId: string;
    packageId: string;
    subject?: string;
    location?: string;
    phone?: string;
  };
  timeZone?: string;
  language?: string;
  userId?: string; // Supabase User ID
}) {
  try {
    console.log('Creating booking via API proxy:', data);
    
    // ⚠️ BACKEND VALIDATION: Prevent trial bookings for users with existing booking history
    if (data.userId && data.metadata.packageId === 'trial') {
      console.log('🔒 Validating trial booking eligibility for user:', data.userId);
      const existingBookings = await getUserBookings(data.userId);
      
      if (existingBookings && existingBookings.length > 0) {
        console.error('❌ Trial booking REJECTED: User has', existingBookings.length, 'existing bookings');
        throw new Error('Die Probestunde ist nur für Neukunden verfügbar. Du hast bereits eine Buchungshistorie.');
      }
      
      console.log('✅ Trial booking APPROVED: User has no booking history');
    }
    
    // Add default values for required Cal.com fields
    const bookingData = {
      ...data,
      timeZone: data.timeZone || 'Europe/Berlin',
      language: data.language || 'de'
    };
    
    const response = await fetch(CALCOM_API_PROXY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Cal.com API Error Details:', errorData);
      
      // Provide user-friendly error messages
      let errorMessage = errorData.details || errorData.error || 'Booking creation failed';
      
      // Ensure errorMessage is a string
      if (typeof errorMessage !== 'string') {
        errorMessage = JSON.stringify(errorMessage);
      }
      
      // For no_available_users_found_error, create local booking instead of throwing
      if (errorMessage.includes('no_available_users_found_error')) {
        console.warn('⚠️ Cal.com has no available hosts - creating local-only booking');
        
        // Create a local booking ID
        const localBookingId = `booking_${Date.now()}`;
        console.log('📝 Created local booking ID:', localBookingId);
        
        // Save to Supabase with local ID
        if (data.userId) {
          try {
            const startDate = new Date(data.start);
            const supabaseData = {
              calcom_booking_id: localBookingId,
              user_id: data.userId,
              tutor_id: undefined,
              subject: data.metadata.subject || 'Nicht angegeben',
              package: data.metadata.packageId || 'Einzelstunde',
              date: startDate.toISOString().split('T')[0],
              time: startDate.toTimeString().split(' ')[0],
              location: data.metadata.location || 'online',
              contact_name: data.responses.name,
              contact_email: data.responses.email,
              contact_phone: data.metadata.phone || undefined,
              message: data.responses.notes || undefined,
              status: 'scheduled' as const
            };
            
            await saveBookingToSupabase(supabaseData);
            console.log('✅ Local booking saved to Supabase');
          } catch (supabaseError) {
            console.error('❌ Failed to save local booking to Supabase:', supabaseError);
          }
        }
        
        // Return local booking object
        return {
          id: localBookingId,
          localOnly: true,
          message: 'Booking created locally (Cal.com not configured)'
        };
      } else if (errorMessage.includes('invalid_type in')) {
        errorMessage = 'Ungültige Buchungsdaten. Bitte versuche es erneut oder kontaktiere den Support.';
      }
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('Booking created successfully:', result);
    console.log('User ID for Supabase sync:', data.userId);
    console.log('Result structure:', JSON.stringify(result, null, 2));
    
    // Save booking to Supabase if userId is provided
    if (data.userId) {
      try {
        // Extract booking ID from different possible response structures
        const bookingId = result.id || result.booking?.id || result.data?.id;
        
        if (!bookingId) {
          console.warn('No booking ID found in Cal.com response. Cannot save to Supabase.');
          console.warn('Response structure:', result);
          return result;
        }
        
        const startDate = new Date(data.start);
        console.log('Attempting to save booking to Supabase with ID:', bookingId);
        
        // Helper function to check if a string is a valid UUID
        const isValidUUID = (str: string) => {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return uuidRegex.test(str);
        };
        
        // Validate tutor_id is a proper UUID
        const tutorId = data.metadata.tutorId && isValidUUID(data.metadata.tutorId) 
          ? data.metadata.tutorId 
          : undefined;
          
        if (data.metadata.tutorId && !tutorId) {
          console.warn(`⚠️ Tutor ID "${data.metadata.tutorId}" is not a valid UUID. Storing in message field instead.`);
        }
        
        // Include non-UUID tutor_id in message if not a valid UUID
        const messageWithTutorId = tutorId 
          ? data.responses.notes 
          : `[Tutor ID: ${data.metadata.tutorId}] ${data.responses.notes || ''}`;
        
        const supabaseData = {
          calcom_booking_id: bookingId.toString(),
          user_id: data.userId,
          tutor_id: tutorId,
          subject: data.metadata.subject || 'Nicht angegeben',
          package: data.metadata.packageId || 'Einzelstunde',
          date: startDate.toISOString().split('T')[0],
          time: startDate.toTimeString().split(' ')[0],
          location: data.metadata.location || 'online',
          contact_name: data.responses.name,
          contact_email: data.responses.email,
          contact_phone: data.metadata.phone || undefined,
          message: messageWithTutorId || undefined,
          status: 'scheduled' as const
        };
        
        console.log('Supabase data to save:', supabaseData);
        
        await saveBookingToSupabase(supabaseData);
        console.log('✅ Booking successfully saved to Supabase');
      } catch (supabaseError) {
        console.error('❌ Failed to save booking to Supabase:', supabaseError);
        // Don't fail the entire booking if Supabase save fails
      }
    } else {
      console.warn('⚠️ No userId provided - booking not saved to Supabase');
    }
    
    return result;
  } catch (error) {
    console.error('Cal.com booking error:', error);
    throw error;
  }
}

export async function getAvailability(
  eventTypeId: number,
  startDate: string,
  endDate: string
) {
  try {
    const params = new URLSearchParams({
      eventTypeId: eventTypeId.toString(),
      startTime: startDate,
      endTime: endDate
    });

    const response = await fetch(`${CALCOM_API_PROXY}?${params}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch availability');
    }

    return await response.json();
  } catch (error) {
    console.error('Cal.com availability error:', error);
    return null;
  }
}

/**
 * Cancel a booking in Cal.com and Supabase
 * Returns success=true even if Cal.com fails (local cancellation fallback)
 */
export async function cancelBooking(bookingId: string, reason?: string) {
  console.log('🚫 Cancelling booking:', bookingId);
  
  try {
    // Step 1: Try to cancel in Cal.com via API route
    const response = await fetch(`${CALCOM_API_PROXY}/${bookingId}/cancel`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || 'User requested cancellation' })
    });

    const result = await response.json();
    console.log('📡 Cal.com API response:', result);

    // Step 2: Update status in Supabase (regardless of Cal.com result)
    try {
      await updateBookingStatus(bookingId, 'cancelled');
      console.log('✅ Supabase status updated to cancelled');
    } catch (supabaseError) {
      console.warn('⚠️ Supabase update failed (booking may be local-only):', supabaseError);
      // Don't throw - cancellation can still succeed locally
    }

    // Step 3: Return result with appropriate flags
    return {
      success: true,
      calcomCancelled: result.calcomCancelled || false,
      localOnly: result.localOnly || false,
      message: result.message || 'Booking cancelled',
      calcomError: result.calcomError
    };

  } catch (error) {
    console.error('❌ Cancel booking error:', error);
    
    // Even on error, try to update Supabase
    try {
      await updateBookingStatus(bookingId, 'cancelled');
      console.log('✅ Supabase updated despite API error');
    } catch (supabaseError) {
      console.warn('⚠️ Supabase update also failed');
    }

    // Always return success for local cancellation
    return {
      success: true,
      localOnly: true,
      message: 'Local cancellation succeeded',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function rescheduleBooking(bookingId: string, newStart: string, timeZone?: string) {
  try {
    console.log('Rescheduling booking:', bookingId, 'to', newStart);
    
    const response = await fetch(`${CALCOM_API_PROXY}/${bookingId}/reschedule`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        start: newStart,
        timeZone: timeZone || 'Europe/Berlin'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Cal.com Reschedule Error:', errorData);
      throw new Error(errorData.error || 'Umbuchung fehlgeschlagen');
    }

    const result = await response.json();
    console.log('Booking rescheduled successfully:', result);
    
    // Update booking in Supabase
    try {
      const startDate = new Date(newStart);
      await supabase
        .from('bookings')
        .update({
          date: startDate.toISOString().split('T')[0],
          time: startDate.toTimeString().split(' ')[0],
          status: 'scheduled'
        })
        .eq('calcom_booking_id', bookingId);
      console.log('Booking updated in Supabase');
    } catch (supabaseError) {
      console.error('Failed to update booking in Supabase:', supabaseError);
    }
    
    return result;
  } catch (error) {
    console.error('Cal.com reschedule error:', error);
    throw error;
  }
}

// Mock function for development without API key
export function mockCreateBooking(data: any) {
  return Promise.resolve({
    id: `mock-${Date.now()}`,
    status: 'success',
    booking: data
  });
}
