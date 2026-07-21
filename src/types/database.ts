export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'parent' | 'tutor' | 'admin';
export type BookingStatus = 'scheduled' | 'completed' | 'cancelled';
export type PurchaseStatus = 'active' | 'completed' | 'expired' | 'cancelled';
export type PaymentStatus = 'unverified' | 'verified' | 'refunded';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          tutor_id: string | null;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          tutor_id?: string | null;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      tutors: {
        Row: {
          id: string;
          slug: string;
          name: string;
          subject_ids: string[];
          achievements: string[];
          image_path: string;
          bio: string;
          languages: string[];
          availability_text: string;
          available_slots: Json;
          grade: string;
          online_only: boolean;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          subject_ids: string[];
          achievements: string[];
          image_path: string;
          bio: string;
          languages: string[];
          availability_text: string;
          available_slots?: Json;
          grade: string;
          online_only?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tutors']['Insert']>;
        Relationships: [];
      };
      packages: {
        Row: {
          id: string;
          slug: string;
          name: string;
          sessions: number;
          price_cents: number;
          hourly_rate_cents: number | null;
          savings_cents: number | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          sessions: number;
          price_cents: number;
          hourly_rate_cents?: number | null;
          savings_cents?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['packages']['Insert']>;
        Relationships: [];
      };
      package_purchases: {
        Row: {
          id: string;
          user_id: string;
          package_id: string;
          total_sessions: number;
          used_sessions: number;
          remaining_sessions: number;
          status: PurchaseStatus;
          payment_status: PaymentStatus;
          payment_reference: string | null;
          price_paid_cents: number;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          package_id: string;
          total_sessions: number;
          used_sessions?: number;
          remaining_sessions: number;
          status?: PurchaseStatus;
          payment_status?: PaymentStatus;
          payment_reference?: string | null;
          price_paid_cents: number;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['package_purchases']['Insert']>;
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          tutor_id: string;
          package_id: string;
          package_purchase_id: string | null;
          subject_id: string;
          starts_at: string;
          duration_minutes: number;
          time_zone: string;
          location: 'online' | 'in-person';
          location_venue: string | null;
          contact_name: string;
          contact_email: string;
          contact_phone: string | null;
          message: string | null;
          status: BookingStatus;
          calcom_booking_uid: string;
          calcom_event_type_id: number;
          created_at: string;
          updated_at: string;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          tutor_id: string;
          package_id: string;
          package_purchase_id?: string | null;
          subject_id: string;
          starts_at: string;
          duration_minutes?: number;
          time_zone: string;
          location: 'online' | 'in-person';
          location_venue?: string | null;
          contact_name: string;
          contact_email: string;
          contact_phone?: string | null;
          message?: string | null;
          status?: BookingStatus;
          calcom_booking_uid: string;
          calcom_event_type_id: number;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      cancel_booking_and_restore_credit: {
        Args: {
          p_booking_id: string;
          p_expected_calcom_uid: string;
        };
        Returns: boolean;
      };
      finalize_booking_with_credit: {
        Args: {
          p_user_id: string;
          p_tutor_id: string;
          p_package_id: string;
          p_package_purchase_id: string | null;
          p_subject_id: string;
          p_starts_at: string;
          p_time_zone: string;
          p_location: string;
          p_location_venue: string | null;
          p_contact_name: string;
          p_contact_email: string;
          p_contact_phone: string | null;
          p_message: string | null;
          p_calcom_booking_uid: string;
          p_calcom_event_type_id: number;
        };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      booking_status: BookingStatus;
      purchase_status: PurchaseStatus;
      payment_status: PaymentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type TableRow<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Row'];
