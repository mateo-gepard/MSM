import { createClient } from '@supabase/supabase-js';

// Use placeholder values if not configured (for development without Supabase)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Booking-related functions
export async function saveBookingToSupabase(bookingData: {
  calcom_booking_id: string;
  user_id: string;
  tutor_id?: string;
  tutor_name?: string;
  subject: string;
  package?: string;
  date: string;
  time: string;
  location: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  message?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}) {
  try {
    console.log('📝 Saving booking to Supabase...', bookingData);
    console.log('Supabase URL:', supabaseUrl);
    console.log('Has Anon Key:', !!supabaseAnonKey && supabaseAnonKey !== 'placeholder-anon-key');
    
    const { data, error } = await supabase
      .from('bookings')
      .insert([bookingData])
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase insert error:', error);
      throw error;
    }
    
    console.log('✅ Booking saved to Supabase:', data);
    return data;
  } catch (error) {
    console.error('❌ Error saving booking to Supabase:', error);
    throw error;
  }
}

export async function getUserBookings(userId: string) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    return [];
  }
}

export async function updateBookingStatus(
  calcomBookingId: string,
  status: 'scheduled' | 'completed' | 'cancelled'
) {
  try {
    console.log(`Updating booking status: ${calcomBookingId} → ${status}`);
    
    // Try updating by calcom_booking_id first
    let { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('calcom_booking_id', calcomBookingId)
      .select();

    if (error) {
      console.error('Supabase update error (by calcom_booking_id):', error);
    }
    
    // If no rows updated, try by id field as fallback
    if (!data || data.length === 0) {
      console.log(`⚠️ Booking not found by calcom_booking_id, trying by id field...`);
      const result = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', calcomBookingId)
        .select();
      
      data = result.data;
      error = result.error;
      
      if (error) {
        console.error('Supabase update error (by id):', error);
        throw error;
      }
    }
    
    // Check if booking was found and updated
    if (!data || data.length === 0) {
      console.warn(`⚠️ Booking ${calcomBookingId} not found in Supabase (may be local-only)`);
      return null; // Return null instead of throwing
    }
    
    console.log(`✅ Booking status updated in Supabase:`, data[0]);
    return data[0];
  } catch (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }
}

export async function deleteBooking(calcomBookingId: string) {
  try {
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('calcom_booking_id', calcomBookingId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting booking:', error);
    throw error;
  }
}

export async function getTutorBookings(tutorName: string) {
  try {
    console.log('🔍 Fetching tutor bookings from Supabase...', { tutorName });
    
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('tutor_name', tutorName)
      .order('date', { ascending: true });

    if (error) {
      console.error('❌ Supabase bookings query error:', error);
      throw error;
    }
    
    console.log(`✅ Loaded ${data?.length || 0} bookings from Supabase for tutor: ${tutorName}`);
    return data || [];
  } catch (error) {
    console.error('Error fetching tutor bookings:', error);
    return [];
  }
}

export async function saveTutorAvailability(tutorName: string, availableSlots: any[]) {
  try {
    console.log('💾 Saving tutor availability to Supabase...', { tutorName, availableSlots });
    
    // First, try to find the tutor
    const { data: existingTutor } = await supabase
      .from('tutors')
      .select('id, name')
      .eq('name', tutorName)
      .maybeSingle();
    
    if (existingTutor) {
      // Tutor exists, update their availability
      const { data, error } = await supabase
        .from('tutors')
        .update({ 
          available_slots: availableSlots,
          updated_at: new Date().toISOString()
        })
        .eq('name', tutorName)
        .select();

      if (error) throw error;
      
      console.log('✅ Tutor availability updated in Supabase:', data);
      return data?.[0] || null;
    } else {
      // Tutor doesn't exist, create them with availability
      console.log(`ℹ️ Tutor "${tutorName}" not found, creating new entry...`);
      const { data, error } = await supabase
        .from('tutors')
        .insert({
          name: tutorName,
          available_slots: availableSlots,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (error) throw error;
      
      console.log('✅ New tutor created with availability in Supabase:', data);
      return data?.[0] || null;
    }
  } catch (error) {
    console.error('❌ Error saving tutor availability:', error);
    throw error;
  }
}

export async function getTutorAvailability(tutorName: string) {
  try {
    console.log('🔍 Fetching tutor availability from Supabase...', { tutorName });
    
    const { data, error } = await supabase
      .from('tutors')
      .select('available_slots')
      .eq('name', tutorName)
      .maybeSingle(); // Use maybeSingle() instead of single() to avoid 406 errors

    if (error) {
      console.error('❌ Supabase query error:', error);
      throw error;
    }
    
    if (!data) {
      console.log('ℹ️ Tutor not found in Supabase, will use default/localStorage');
      return [];
    }
    
    console.log('✅ Tutor availability loaded from Supabase:', data.available_slots);
    return data?.available_slots || [];
  } catch (error) {
    console.error('Error fetching tutor availability:', error);
    return [];
  }
}
