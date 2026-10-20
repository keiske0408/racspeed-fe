export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      clubs: {
        Row: {
          id: string;
          name: string;
          club_id_number: string | null;
          district_code: string;
          sponsor_rotary_club: string | null;
          charter_date: string | null;
          logo_url: string | null;
          timezone: string;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          club_id_number?: string | null;
          district_code?: string;
          sponsor_rotary_club?: string | null;
          charter_date?: string | null;
          logo_url?: string | null;
          timezone?: string;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clubs"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          is_platform_admin: boolean;
          status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          is_platform_admin?: boolean;
          status?: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      club_memberships: {
        Row: {
          id: string;
          club_id: string;
          profile_id: string;
          rotary_id: string | null;
          membership_status: "ACTIVE" | "ALUMNI" | "HONORARY" | "LEAVE_OF_ABSENCE" | "TERMINATED";
          joined_date: string | null;
          classification: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          profile_id: string;
          rotary_id?: string | null;
          membership_status?: "ACTIVE" | "ALUMNI" | "HONORARY" | "LEAVE_OF_ABSENCE" | "TERMINATED";
          joined_date?: string | null;
          classification?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["club_memberships"]["Insert"]>;
      };
      roles: {
        Row: {
          id: string;
          key: string;
          name: string;
          description: string | null;
          is_system: boolean;
          created_at: string;
        };
      };
      permissions: {
        Row: {
          id: string;
          key: string;
          name: string;
          category: string;
          description: string | null;
          created_at: string;
        };
      };
      events: {
        Row: {
          id: string;
          host_club_id: string;
          title: string;
          description: string | null;
          event_category: string;
          location: string | null;
          start_time: string;
          end_time: string;
          check_in_window_minutes: number;
          volunteer_hours_default: number;
          attendance_manager_id: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      attendance_records: {
        Row: {
          id: string;
          event_id: string;
          profile_id: string;
          session_id: string | null;
          attended: boolean;
          is_excused: boolean;
          check_in_time: string | null;
          check_in_method: "QR" | "MANUAL" | "GUEST";
          volunteer_hours: number;
          verified_by: string | null;
          created_at: string;
        };
      };
      projects: {
        Row: {
          id: string;
          host_club_id: string;
          title: string;
          summary: string | null;
          objective: string | null;
          venue: string | null;
          start_date: string;
          end_date: string;
          project_chair_id: string | null;
          service_category_id: string | null;
          rotary_year: string;
          beneficiary_count: number;
          beneficiary_type: string | null;
          volunteer_count: number;
          total_volunteer_hours: number;
          funds_raised: number;
          total_expenses: number;
          partners_and_sponsors: string | null;
          outcomes_summary: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          club_id: string;
          profile_id: string;
          invoice_number: string;
          dedupe_key: string | null;
          title: string;
          description: string | null;
          due_date: string;
          status: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      payment_submissions: {
        Row: {
          id: string;
          club_id: string;
          submitted_by: string;
          claimed_amount: number;
          claimed_date: string;
          reference_number: string | null;
          payment_channel: string | null;
          receipt_storage_path: string;
          ocr_extracted_data: Json | null;
          status: string;
          treasurer_notes: string | null;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      budget_requests: {
        Row: {
          id: string;
          project_id: string;
          requester_id: string;
          title: string;
          justification: string;
          total_requested_amount: number;
          status: string;
          created_at: string;
          updated_at: string;
        };
      };
      liquidations: {
        Row: {
          id: string;
          request_id: string;
          submitted_by: string;
          total_disbursed: number;
          total_actual_spent: number;
          variance: number;
          status: string;
          reviewer_id: string | null;
          review_notes: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      prospects: {
        Row: {
          id: string;
          club_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          stage: string;
          recruiter_id: string | null;
          assigned_officer_id: string | null;
          source: string | null;
          has_privacy_consent: boolean;
          converted_profile_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
}
