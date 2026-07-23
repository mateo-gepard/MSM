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
export type HouseholdMembershipRole = 'owner' | 'guardian' | 'viewer';
export type MembershipStatus = 'invited' | 'active' | 'revoked';
export type OfferProvider = 'stripe' | 'legacy_manual';
export type PaymentOrderStatus =
  | 'pending'
  | 'checkout_created'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'refunded'
  | 'disputed';
export type InboxEventStatus = 'received' | 'processing' | 'processed' | 'failed' | 'ignored';
export type CreditEntryKind =
  | 'grant'
  | 'reservation'
  | 'consumption'
  | 'release'
  | 'cancellation_restore'
  | 'revocation'
  | 'expiration'
  | 'adjustment';
export type BookingLifecycleStatus =
  | 'provider_pending'
  | 'pending_confirmation'
  | 'scheduled'
  | 'completed'
  | 'cancellation_pending'
  | 'reschedule_pending'
  | 'cancelled'
  | 'failed';
export type BookingSyncStatus = 'pending' | 'in_sync' | 'needs_reconciliation' | 'failed';
export type BookingCreditStatus = 'none' | 'reserved' | 'consumed' | 'released' | 'restored';
export type BookingOperationType = 'create' | 'reschedule' | 'cancel' | 'reconcile';
export type BookingOperationStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'ambiguous';
export type BookingSlotClaimKind = 'booking' | 'reschedule_hold';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          tutor_id: string | null;
          display_name: string | null;
          primary_household_id: string | null;
          deactivated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          tutor_id?: string | null;
          display_name?: string | null;
          primary_household_id?: string | null;
          deactivated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
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
      households: {
        Row: {
          id: string;
          name: string;
          created_by_user_id: string | null;
          legacy_owner_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by_user_id?: string | null;
          legacy_owner_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['households']['Insert']>;
        Relationships: [];
      };
      household_memberships: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: HouseholdMembershipRole;
          status: MembershipStatus;
          can_manage_learners: boolean;
          can_book: boolean;
          can_manage_billing: boolean;
          can_view_all_bookings: boolean;
          active_from: string;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          role: HouseholdMembershipRole;
          status?: MembershipStatus;
          can_manage_learners?: boolean;
          can_book?: boolean;
          can_manage_billing?: boolean;
          can_view_all_bookings?: boolean;
          active_from?: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['household_memberships']['Insert']>;
        Relationships: [];
      };
      learners: {
        Row: {
          id: string;
          household_id: string;
          display_name: string;
          birth_date: string | null;
          is_active: boolean;
          is_legacy_placeholder: boolean;
          created_by_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          display_name: string;
          birth_date?: string | null;
          is_active?: boolean;
          is_legacy_placeholder?: boolean;
          created_by_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['learners']['Insert']>;
        Relationships: [];
      };
      account_roles: {
        Row: {
          id: string;
          user_id: string;
          role: UserRole;
          tutor_id: string | null;
          granted_by_user_id: string | null;
          granted_at: string;
          revoked_at: string | null;
          reason: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: UserRole;
          tutor_id?: string | null;
          granted_by_user_id?: string | null;
          granted_at?: string;
          revoked_at?: string | null;
          reason?: string | null;
        };
        Update: Partial<Database['public']['Tables']['account_roles']['Insert']>;
        Relationships: [];
      };
      offer_versions: {
        Row: {
          id: string;
          package_id: string;
          version: number;
          provider: OfferProvider;
          name: string;
          sessions: number;
          amount_cents: number;
          currency: string;
          stripe_product_id: string | null;
          stripe_price_id: string | null;
          stripe_livemode: boolean | null;
          tax_behavior: 'inclusive' | 'exclusive' | 'unspecified' | null;
          effective_from: string;
          effective_until: string | null;
          created_at: string;
          created_by_user_id: string | null;
        };
        Insert: {
          id?: string;
          package_id: string;
          version: number;
          provider: OfferProvider;
          name: string;
          sessions: number;
          amount_cents: number;
          currency: string;
          stripe_product_id?: string | null;
          stripe_price_id?: string | null;
          stripe_livemode?: boolean | null;
          tax_behavior?: 'inclusive' | 'exclusive' | 'unspecified' | null;
          effective_from?: string;
          effective_until?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['offer_versions']['Insert']>;
        Relationships: [];
      };
      active_offers: {
        Row: {
          package_id: string;
          offer_version_id: string;
          checkout_enabled: boolean;
          updated_at: string;
          updated_by_user_id: string | null;
        };
        Insert: {
          package_id: string;
          offer_version_id: string;
          checkout_enabled?: boolean;
          updated_at?: string;
          updated_by_user_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['active_offers']['Insert']>;
        Relationships: [];
      };
      payment_orders: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          offer_version_id: string;
          package_purchase_id: string | null;
          provider: OfferProvider;
          status: PaymentOrderStatus;
          currency: string;
          amount_cents: number;
          paid_total_cents: number | null;
          tax_cents: number | null;
          quantity: number;
          client_idempotency_key: string;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          stripe_customer_id: string | null;
          livemode: boolean | null;
          provider_created_at: string | null;
          paid_at: string | null;
          fulfilled_at: string | null;
          failed_at: string | null;
          expired_at: string | null;
          refunded_at: string | null;
          failure_code: string | null;
          failure_detail: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          offer_version_id: string;
          package_purchase_id?: string | null;
          provider?: OfferProvider;
          status?: PaymentOrderStatus;
          currency: string;
          amount_cents: number;
          paid_total_cents?: number | null;
          tax_cents?: number | null;
          quantity?: number;
          client_idempotency_key: string;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_customer_id?: string | null;
          livemode?: boolean | null;
          provider_created_at?: string | null;
          paid_at?: string | null;
          fulfilled_at?: string | null;
          failed_at?: string | null;
          expired_at?: string | null;
          refunded_at?: string | null;
          failure_code?: string | null;
          failure_detail?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['payment_orders']['Insert']>;
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
          household_id: string;
          offer_version_id: string;
          payment_order_id: string;
          credit_grant_id: string | null;
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
          household_id: string;
          offer_version_id: string;
          payment_order_id: string;
          credit_grant_id?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['package_purchases']['Insert']>;
        Relationships: [];
      };
      credit_accounts: {
        Row: {
          id: string;
          household_id: string;
          unit: string;
          available_balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          unit?: string;
          available_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['credit_accounts']['Insert']>;
        Relationships: [];
      };
      credit_grants: {
        Row: {
          id: string;
          credit_account_id: string;
          payment_order_id: string | null;
          package_purchase_id: string | null;
          offer_version_id: string;
          granted_quantity: number;
          valid_from: string;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          credit_account_id: string;
          payment_order_id?: string | null;
          package_purchase_id?: string | null;
          offer_version_id: string;
          granted_quantity: number;
          valid_from?: string;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['credit_grants']['Insert']>;
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          household_id: string;
          learner_id: string;
          created_by_user_id: string;
          tutor_id: string;
          package_id: string;
          package_purchase_id: string | null;
          subject_id: string;
          starts_at: string;
          ends_at: string;
          duration_minutes: number;
          time_zone: string;
          location: 'online' | 'in-person';
          location_venue: string | null;
          contact_name: string;
          contact_email: string;
          contact_phone: string | null;
          message: string | null;
          status: BookingStatus;
          lifecycle_status: BookingLifecycleStatus;
          sync_status: BookingSyncStatus;
          credit_status: BookingCreditStatus;
          credit_grant_id: string | null;
          credit_reservation_entry_id: string | null;
          scheduling_provider: string;
          provider_booking_id: string | null;
          provider_status: string | null;
          provider_revision: number;
          provider_last_synced_at: string | null;
          reconciliation_checked_at: string | null;
          meeting_url: string | null;
          row_version: number;
          reconciliation_reason: string | null;
          idempotency_key: string;
          calcom_booking_uid: string | null;
          calcom_event_type_id: number | null;
          created_at: string;
          updated_at: string;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          household_id: string;
          learner_id: string;
          created_by_user_id: string;
          tutor_id: string;
          package_id: string;
          package_purchase_id?: string | null;
          subject_id: string;
          starts_at: string;
          ends_at?: string;
          duration_minutes?: number;
          time_zone: string;
          location: 'online' | 'in-person';
          location_venue?: string | null;
          contact_name: string;
          contact_email: string;
          contact_phone?: string | null;
          message?: string | null;
          status?: BookingStatus;
          lifecycle_status: BookingLifecycleStatus;
          sync_status?: BookingSyncStatus;
          credit_status?: BookingCreditStatus;
          credit_grant_id?: string | null;
          credit_reservation_entry_id?: string | null;
          scheduling_provider?: string;
          provider_booking_id?: string | null;
          provider_status?: string | null;
          provider_revision?: number;
          provider_last_synced_at?: string | null;
          reconciliation_checked_at?: string | null;
          meeting_url?: string | null;
          row_version?: number;
          reconciliation_reason?: string | null;
          idempotency_key: string;
          calcom_booking_uid?: string | null;
          calcom_event_type_id?: number | null;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
        Relationships: [];
      };
      booking_messages: {
        Row: {
          id: number;
          booking_id: string;
          sender_user_id: string;
          sender_context: 'household' | 'tutor';
          client_message_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: never;
          booking_id: string;
          sender_user_id: string;
          sender_context: 'household' | 'tutor';
          client_message_id: string;
          body: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      booking_operations: {
        Row: {
          id: string;
          booking_id: string;
          operation_type: BookingOperationType;
          status: BookingOperationStatus;
          idempotency_key: string;
          requested_by_user_id: string | null;
          expected_booking_version: number;
          previous_lifecycle_status: BookingLifecycleStatus | null;
          requested_starts_at: string | null;
          requested_ends_at: string | null;
          requested_time_zone: string | null;
          reason: string | null;
          request_facts: Json;
          provider: string;
          provider_booking_id_before: string | null;
          provider_booking_id_after: string | null;
          provider_response: Json | null;
          attempt_count: number;
          provider_unchanged_check_count: number;
          provider_unchanged_last_checked_at: string | null;
          next_attempt_at: string | null;
          locked_at: string | null;
          locked_by: string | null;
          last_error_code: string | null;
          last_error_detail: string | null;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          operation_type: BookingOperationType;
          status?: BookingOperationStatus;
          idempotency_key: string;
          requested_by_user_id?: string | null;
          expected_booking_version: number;
          previous_lifecycle_status?: BookingLifecycleStatus | null;
          requested_starts_at?: string | null;
          requested_ends_at?: string | null;
          requested_time_zone?: string | null;
          reason?: string | null;
          request_facts?: Json;
          provider?: string;
          provider_booking_id_before?: string | null;
          provider_booking_id_after?: string | null;
          provider_response?: Json | null;
          attempt_count?: number;
          provider_unchanged_check_count?: number;
          provider_unchanged_last_checked_at?: string | null;
          next_attempt_at?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          last_error_code?: string | null;
          last_error_detail?: string | null;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['booking_operations']['Insert']>;
        Relationships: [];
      };
      booking_slot_claims: {
        Row: {
          id: string;
          booking_id: string;
          operation_id: string | null;
          tutor_id: string;
          starts_at: string;
          ends_at: string;
          claim_kind: BookingSlotClaimKind;
          released_at: string | null;
          release_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          operation_id?: string | null;
          tutor_id: string;
          starts_at: string;
          ends_at: string;
          claim_kind: BookingSlotClaimKind;
          released_at?: string | null;
          release_reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['booking_slot_claims']['Insert']>;
        Relationships: [];
      };
      stripe_events: {
        Row: {
          event_id: string;
          event_type: string;
          livemode: boolean;
          api_version: string | null;
          object_created_at: string | null;
          payload: Json;
          payload_sha256: string;
          payment_order_id: string | null;
          effect_type: 'checkout_fulfillment' | 'checkout_failure' | 'refund' | 'dispute' | null;
          effect_reference: string | null;
          status: InboxEventStatus;
          attempt_count: number;
          received_at: string;
          processed_at: string | null;
          last_error: string | null;
        };
        Insert: {
          event_id: string;
          event_type: string;
          livemode: boolean;
          api_version?: string | null;
          object_created_at?: string | null;
          payload: Json;
          payload_sha256: string;
          payment_order_id?: string | null;
          effect_type?: 'checkout_fulfillment' | 'checkout_failure' | 'refund' | 'dispute' | null;
          effect_reference?: string | null;
          status?: InboxEventStatus;
          attempt_count?: number;
          received_at?: string;
          processed_at?: string | null;
          last_error?: string | null;
        };
        Update: Partial<Database['public']['Tables']['stripe_events']['Insert']>;
        Relationships: [];
      };
      provider_events: {
        Row: {
          id: string;
          provider: string;
          provider_event_id: string;
          event_type: string;
          booking_id: string | null;
          provider_booking_id: string | null;
          occurred_at: string | null;
          payload: Json;
          payload_sha256: string | null;
          status: InboxEventStatus;
          attempt_count: number;
          received_at: string;
          processed_at: string | null;
          last_error: string | null;
        };
        Insert: {
          id?: string;
          provider: string;
          provider_event_id: string;
          event_type: string;
          booking_id?: string | null;
          provider_booking_id?: string | null;
          occurred_at?: string | null;
          payload: Json;
          payload_sha256?: string | null;
          status?: InboxEventStatus;
          attempt_count?: number;
          received_at?: string;
          processed_at?: string | null;
          last_error?: string | null;
        };
        Update: Partial<Database['public']['Tables']['provider_events']['Insert']>;
        Relationships: [];
      };
      api_rate_limit_buckets: {
        Row: {
          scope: string;
          key_hash: string;
          window_started_at: string;
          request_count: number;
          updated_at: string;
        };
        Insert: {
          scope: string;
          key_hash: string;
          window_started_at: string;
          request_count?: number;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['api_rate_limit_buckets']['Insert']>;
        Relationships: [];
      };
      credit_ledger: {
        Row: {
          id: string;
          credit_account_id: string;
          credit_grant_id: string;
          booking_id: string | null;
          entry_kind: CreditEntryKind;
          delta: number;
          idempotency_key: string;
          source_type: string;
          source_id: string;
          source_action: string;
          reverses_entry_id: string | null;
          stripe_event_id: string | null;
          provider_event_id: string | null;
          actor_user_id: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          credit_account_id: string;
          credit_grant_id: string;
          booking_id?: string | null;
          entry_kind: CreditEntryKind;
          delta: number;
          idempotency_key: string;
          source_type: string;
          source_id: string;
          source_action: string;
          reverses_entry_id?: string | null;
          stripe_event_id?: string | null;
          provider_event_id?: string | null;
          actor_user_id?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['credit_ledger']['Insert']>;
        Relationships: [];
      };
      payment_refunds: {
        Row: {
          id: string;
          payment_order_id: string;
          stripe_event_id: string;
          stripe_refund_id: string;
          amount_cents: number;
          currency: string;
          status: string;
          reason: string | null;
          provider_created_at: string | null;
          last_event_created_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payment_order_id: string;
          stripe_event_id: string;
          stripe_refund_id: string;
          amount_cents: number;
          currency: string;
          status: string;
          reason?: string | null;
          provider_created_at?: string | null;
          last_event_created_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['payment_refunds']['Insert']>;
        Relationships: [];
      };
      payment_disputes: {
        Row: {
          id: string;
          payment_order_id: string;
          stripe_event_id: string;
          stripe_dispute_id: string;
          amount_cents: number;
          currency: string;
          status: string;
          last_event_created_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payment_order_id: string;
          stripe_event_id: string;
          stripe_dispute_id: string;
          amount_cents: number;
          currency: string;
          status: string;
          last_event_created_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['payment_disputes']['Insert']>;
        Relationships: [];
      };
      booking_audit_log: {
        Row: {
          id: number;
          booking_id: string;
          operation_id: string | null;
          provider_event_id: string | null;
          action: string;
          actor_kind: 'user' | 'system' | 'provider' | 'migration';
          actor_user_id: string | null;
          before_state: Json | null;
          after_state: Json | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          booking_id: string;
          operation_id?: string | null;
          provider_event_id?: string | null;
          action: string;
          actor_kind: 'user' | 'system' | 'provider' | 'migration';
          actor_user_id?: string | null;
          before_state?: Json | null;
          after_state?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['booking_audit_log']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_api_rate_limit: {
        Args: {
          p_scope: string;
          p_key_hash: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      apply_stripe_dispute: {
        Args: {
          p_event_id: string;
          p_stripe_dispute_id: string;
          p_payment_intent_id: string;
          p_amount_cents: number;
          p_currency: string;
          p_dispute_status: string;
        };
        Returns: Json;
      };
      apply_stripe_refund: {
        Args: {
          p_event_id: string;
          p_stripe_refund_id: string;
          p_payment_intent_id: string;
          p_amount_cents: number;
          p_currency: string;
          p_refund_status: string;
          p_reason?: string | null;
          p_provider_created_at?: string | null;
        };
        Returns: Json;
      };
      attach_stripe_checkout_session: {
        Args: {
          p_order_id: string;
          p_user_id: string;
          p_checkout_session_id: string;
          p_stripe_customer_id?: string | null;
        };
        Returns: Json;
      };
      begin_booking_operation: {
        Args: {
          p_booking_id: string;
          p_user_id: string;
          p_operation_type: BookingOperationType;
          p_idempotency_key: string;
          p_requested_starts_at?: string | null;
          p_requested_time_zone?: string | null;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      cancel_booking_and_restore_credit: {
        Args: { p_booking_id: string; p_expected_calcom_uid: string };
        Returns: boolean;
      };
      complete_booking_operation: {
        Args: {
          p_operation_id: string;
          p_provider_booking_id?: string | null;
          p_provider_starts_at?: string | null;
          p_provider_ends_at?: string | null;
          p_provider_status?: string | null;
          p_meeting_url?: string | null;
          p_provider_response?: Json | null;
        };
        Returns: Json;
      };
      confirm_booking_credit: {
        Args: {
          p_booking_id: string;
          p_operation_id: string;
          p_provider_booking_id: string;
          p_provider_event_type_id: number;
          p_provider_starts_at: string;
          p_provider_ends_at?: string | null;
          p_provider_status?: string | null;
          p_meeting_url?: string | null;
          p_provider_response?: Json | null;
        };
        Returns: Json;
      };
      claim_booking_operation: {
        Args: {
          p_booking_id: string;
          p_operation_id: string;
        };
        Returns: boolean;
      };
      create_payment_order: {
        Args: {
          p_user_id: string;
          p_household_id: string;
          p_package_slug: string;
          p_idempotency_key: string;
        };
        Returns: Json;
      };
      fail_booking_operation: {
        Args: {
          p_operation_id: string;
          p_is_ambiguous: boolean;
          p_error_code: string | null;
          p_error_detail: string | null;
        };
        Returns: Json;
      };
      fail_stripe_payment_order: {
        Args: {
          p_event_id: string;
          p_checkout_session_id: string;
          p_status: PaymentOrderStatus;
          p_failure_code?: string | null;
          p_failure_detail?: string | null;
        };
        Returns: Json;
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
      fulfill_stripe_checkout: {
        Args: {
          p_event_id: string;
          p_checkout_session_id: string;
          p_payment_intent_id: string;
          p_amount_subtotal: number;
          p_amount_total: number;
          p_tax_amount: number;
          p_currency: string;
          p_payment_status: string;
          p_stripe_price_id: string;
          p_price_unit_amount: number;
          p_quantity: number;
          p_stripe_customer_id?: string | null;
        };
        Returns: Json;
      };
      has_active_account_role: {
        Args: { p_user_id: string; p_role: UserRole; p_tutor_id?: string | null };
        Returns: boolean;
      };
      has_household_permission: {
        Args: { p_household_id: string; p_permission: string };
        Returns: boolean;
      };
      can_receive_booking_chat_topic: {
        Args: { p_topic: string };
        Returns: boolean;
      };
      ingest_stripe_event: {
        Args: {
          p_event_id: string;
          p_event_type: string;
          p_livemode: boolean;
          p_api_version: string | null;
          p_object_created_at: string | null;
          p_payload: Json;
          p_payload_sha256: string;
        };
        Returns: boolean;
      };
      ignore_stripe_event: {
        Args: { p_event_id: string; p_reason: string };
        Returns: boolean;
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_assigned_tutor: {
        Args: { p_tutor_id: string };
        Returns: boolean;
      };
      mark_stripe_event_failed: {
        Args: { p_event_id: string; p_error: string };
        Returns: boolean;
      };
      process_provider_booking_event: {
        Args: {
          p_provider: string;
          p_provider_event_id: string;
          p_event_type: string;
          p_booking_id?: string | null;
          p_provider_booking_id?: string | null;
          p_occurred_at?: string | null;
          p_target_lifecycle?: BookingLifecycleStatus | null;
          p_provider_starts_at?: string | null;
          p_provider_ends_at?: string | null;
          p_provider_status?: string | null;
          p_meeting_url?: string | null;
          p_payload?: Json;
          p_payload_sha256?: string | null;
        };
        Returns: Json;
      };
      release_booking_credit: {
        Args: {
          p_booking_id: string;
          p_operation_id: string;
          p_error_code: string | null;
          p_error_detail: string | null;
        };
        Returns: Json;
      };
      record_missing_provider_create: {
        Args: {
          p_booking_id: string;
          p_checked_at: string;
          p_expected_operation_started_at?: string | null;
        };
        Returns: Json;
      };
      record_provider_mutation_terminal_evidence: {
        Args: {
          p_booking_id: string;
          p_expected_provider_booking_id: string;
          p_evidence_kind:
            | 'source_absent'
            | 'source_cancelled'
            | 'source_active'
            | 'source_pending';
          p_checked_at: string;
          p_expected_operation_started_at?: string | null;
          p_staged_resolution_target?: BookingLifecycleStatus | null;
          p_provider_starts_at?: string | null;
          p_provider_ends_at?: string | null;
          p_provider_status?: string | null;
          p_meeting_url?: string | null;
        };
        Returns: Json;
      };
      reserve_booking_credit: {
        Args: {
          p_user_id: string;
          p_household_id: string;
          p_learner_id: string;
          p_tutor_id: string;
          p_package_id: string;
          p_package_purchase_id: string | null;
          p_subject_id: string;
          p_starts_at: string;
          p_duration_minutes: number;
          p_time_zone: string;
          p_location: string;
          p_location_venue: string | null;
          p_contact_name: string;
          p_contact_email: string;
          p_contact_phone: string | null;
          p_message: string | null;
          p_idempotency_key: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      user_role: UserRole;
      booking_status: BookingStatus;
      purchase_status: PurchaseStatus;
      payment_status: PaymentStatus;
      household_membership_role: HouseholdMembershipRole;
      membership_status: MembershipStatus;
      offer_provider: OfferProvider;
      payment_order_status: PaymentOrderStatus;
      inbox_event_status: InboxEventStatus;
      credit_entry_kind: CreditEntryKind;
      booking_lifecycle_status: BookingLifecycleStatus;
      booking_sync_status: BookingSyncStatus;
      booking_credit_status: BookingCreditStatus;
      booking_operation_type: BookingOperationType;
      booking_operation_status: BookingOperationStatus;
      booking_slot_claim_kind: BookingSlotClaimKind;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type TableRow<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Row'];
