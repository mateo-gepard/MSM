import { saveBookingToSupabase, updateBookingStatus, deleteBooking, supabase } from './supabase';

// Use Next.js API route as proxy to avoid CORS issues
const CALCOM_API_PROXY = '/api/bookings';
const CALCOM_API_BASE = 'https://api.cal.com/v1'; // For direct server-side calls if needed

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
      
      if (errorMessage.includes('no_available_users_found_error')) {
        errorMessage = 'Dieser Tutor ist zum gewählten Zeitpunkt nicht verfügbar. Bitte wähle einen anderen Termin oder kontaktiere uns direkt.';
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
        
        const supabaseData = {
          calcom_booking_id: bookingId.toString(),
          user_id: data.userId,
          tutor_id: data.metadata.tutorId || undefined,
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

export async function cancelBooking(bookingId: string, reason?: string) {
  try {
    console.log('Cancelling booking:', bookingId);
    
    const response = await fetch(`${CALCOM_API_PROXY}/${bookingId}/cancel`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        reason: reason || 'User requested cancellation',
        cancellationReason: reason 
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Cal.com Cancel Error:', errorData);
      throw new Error(errorData.error || 'Stornierung fehlgeschlagen');
    }

    const result = await response.json();
    console.log('Booking cancelled successfully:', result);
    
    // Update booking status in Supabase
    try {
      await updateBookingStatus(bookingId, 'cancelled');
      console.log('Booking status updated in Supabase');
    } catch (supabaseError) {
      console.error('Failed to update booking status in Supabase:', supabaseError);
    }
    
    return result;
  } catch (error) {
    console.error('Cal.com cancellation error:', error);
    throw error;
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
