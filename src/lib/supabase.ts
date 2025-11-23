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
    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('calcom_booking_id', calcomBookingId)
      .select()
      .single();

    if (error) throw error;
    return data;
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
