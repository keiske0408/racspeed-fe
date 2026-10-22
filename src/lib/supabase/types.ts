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
      member_private_details: {
        Row: {
          membership_id: string;
          birthdate: string | null;
          contact_number: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          shirt_size: string | null;
          blood_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          membership_id: string;
          birthdate?: string | null;
          contact_number?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          shirt_size?: string | null;
          blood_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["member_private_details"]["Insert"]>;
      };
      member_consents: {
        Row: {
          id: string;
          profile_id: string;
          consent_type: string;
          consented: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          consent_type: string;
          consented?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["member_consents"]["Insert"]>;
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
        Insert: {
          id?: string;
          key: string;
          name: string;
          description?: string | null;
          is_system?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
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
        Insert: {
          id?: string;
          key: string;
          name: string;
          category: string;
          description?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["permissions"]["Insert"]>;
      };
      role_permissions: {
        Row: {
          role_id: string;
          permission_id: string;
        };
        Insert: {
          role_id: string;
          permission_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["role_permissions"]["Insert"]>;
      };
      membership_roles: {
        Row: {
          membership_id: string;
          role_id: string;
        };
        Insert: {
          membership_id: string;
          role_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["membership_roles"]["Insert"]>;
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
        Insert: {
          id?: string;
          host_club_id: string;
          title: string;
          description?: string | null;
          event_category: string;
          location?: string | null;
          start_time: string;
          end_time: string;
          check_in_window_minutes?: number;
          volunteer_hours_default?: number;
          attendance_manager_id?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
      };
      attendance_sessions: {
        Row: {
          id: string;
          event_id: string;
          session_token: string;
          status: "ACTIVE" | "EXPIRED" | "CANCELLED";
          created_by: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          session_token: string;
          status?: "ACTIVE" | "EXPIRED" | "CANCELLED";
          created_by?: string | null;
          expires_at: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attendance_sessions"]["Insert"]>;
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
        Insert: {
          id?: string;
          event_id: string;
          profile_id: string;
          session_id?: string | null;
          attended?: boolean;
          is_excused?: boolean;
          check_in_time?: string | null;
          check_in_method?: "QR" | "MANUAL" | "GUEST";
          volunteer_hours?: number;
          verified_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attendance_records"]["Insert"]>;
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
        Insert: {
          id?: string;
          host_club_id: string;
          title: string;
          summary?: string | null;
          objective?: string | null;
          venue?: string | null;
          start_date: string;
          end_date: string;
          project_chair_id?: string | null;
          service_category_id?: string | null;
          rotary_year?: string;
          beneficiary_count?: number;
          beneficiary_type?: string | null;
          volunteer_count?: number;
          total_volunteer_hours?: number;
          funds_raised?: number;
          total_expenses?: number;
          partners_and_sponsors?: string | null;
          outcomes_summary?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
      };
      project_reports: {
        Row: {
          id: string;
          project_id: string;
          author_id: string;
          title: string;
          narrative: string;
          status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "REVISION_REQUESTED" | "APPROVED";
          review_notes: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          author_id: string;
          title: string;
          narrative: string;
          status?: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "REVISION_REQUESTED" | "APPROVED";
          review_notes?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_reports"]["Insert"]>;
      };
      certificates: {
        Row: {
          id: string;
          club_id: string;
          recipient_name: string;
          recipient_email: string | null;
          certificate_number: string;
          category: string;
          event_or_project_title: string;
          issue_date: string;
          signatory_one_title: string;
          signatory_two_title: string;
          pdf_storage_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          recipient_name: string;
          recipient_email?: string | null;
          certificate_number: string;
          category: string;
          event_or_project_title: string;
          issue_date?: string;
          signatory_one_title?: string;
          signatory_two_title?: string;
          pdf_storage_path?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["certificates"]["Insert"]>;
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
          amount_centavos: number;
          due_date: string;
          status: "DRAFT" | "ISSUED" | "PAID" | "PARTIALLY_PAID" | "VOID" | "CANCELLED";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          profile_id: string;
          invoice_number: string;
          dedupe_key?: string | null;
          title: string;
          description?: string | null;
          amount_centavos: number;
          due_date: string;
          status?: "DRAFT" | "ISSUED" | "PAID" | "PARTIALLY_PAID" | "VOID" | "CANCELLED";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
      };
      payment_submissions: {
        Row: {
          id: string;
          club_id: string;
          invoice_id: string | null;
          submitted_by: string;
          claimed_amount_centavos: number;
          claimed_date: string;
          reference_number: string | null;
          payment_channel: string | null;
          receipt_storage_path: string | null;
          ocr_extracted_data: Json | null;
          status: "SUBMITTED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "NEEDS_CLARIFICATION";
          treasurer_notes: string | null;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          invoice_id?: string | null;
          submitted_by: string;
          claimed_amount_centavos: number;
          claimed_date?: string;
          reference_number?: string | null;
          payment_channel?: string | null;
          receipt_storage_path?: string | null;
          ocr_extracted_data?: Json | null;
          status?: "SUBMITTED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "NEEDS_CLARIFICATION";
          treasurer_notes?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_submissions"]["Insert"]>;
      };
      budget_requests: {
        Row: {
          id: string;
          club_id: string;
          project_id: string | null;
          requester_id: string;
          title: string;
          justification: string;
          total_requested_centavos: number;
          president_approved: boolean;
          treasurer_approved: boolean;
          status: "DRAFT" | "SUBMITTED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "DISBURSED";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          project_id?: string | null;
          requester_id: string;
          title: string;
          justification: string;
          total_requested_centavos: number;
          president_approved?: boolean;
          treasurer_approved?: boolean;
          status?: "DRAFT" | "SUBMITTED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "DISBURSED";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["budget_requests"]["Insert"]>;
      };
      liquidations: {
        Row: {
          id: string;
          request_id: string;
          submitted_by: string;
          total_disbursed_centavos: number;
          total_actual_spent_centavos: number;
          variance_centavos: number;
          status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REVISION_REQUESTED" | "REJECTED";
          reviewer_id: string | null;
          review_notes: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          submitted_by: string;
          total_disbursed_centavos: number;
          total_actual_spent_centavos: number;
          variance_centavos?: number;
          status?: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REVISION_REQUESTED" | "REJECTED";
          reviewer_id?: string | null;
          review_notes?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["liquidations"]["Insert"]>;
      };
      prospects: {
        Row: {
          id: string;
          club_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          stage: "PROSPECT" | "ATTENDED_ORIENTATION" | "ATTENDED_FIRST_SERVICE_PROJECT" | "ATTENDED_GENERAL_ASSEMBLY" | "READY_FOR_INDUCTION" | "INDUCTED" | "DECLINED" | "INACTIVE";
          recruiter_id: string | null;
          assigned_officer_id: string | null;
          source: string | null;
          has_privacy_consent: boolean;
          converted_profile_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          stage?: "PROSPECT" | "ATTENDED_ORIENTATION" | "ATTENDED_FIRST_SERVICE_PROJECT" | "ATTENDED_GENERAL_ASSEMBLY" | "READY_FOR_INDUCTION" | "INDUCTED" | "DECLINED" | "INACTIVE";
          recruiter_id?: string | null;
          assigned_officer_id?: string | null;
          source?: string | null;
          has_privacy_consent?: boolean;
          converted_profile_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["prospects"]["Insert"]>;
      };
      sister_clubs: {
        Row: {
          id: string;
          home_club_id: string;
          partner_club_name: string;
          district: string;
          country: string;
          partnership_type: "SISTER_CLUB_MOA" | "DISTRICT_TWIN_CLUB" | "PROJECT_PARTNER" | "SPONSOR_ROTARY_CLUB";
          agreement_signed_date: string | null;
          renewal_date: string | null;
          liaison_officer_name: string | null;
          liaison_email: string | null;
          liaison_phone: string | null;
          status: "ACTIVE" | "PENDING_MOA" | "INACTIVE" | "ARCHIVED";
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          home_club_id: string;
          partner_club_name: string;
          district?: string;
          country?: string;
          partnership_type?: "SISTER_CLUB_MOA" | "DISTRICT_TWIN_CLUB" | "PROJECT_PARTNER" | "SPONSOR_ROTARY_CLUB";
          agreement_signed_date?: string | null;
          renewal_date?: string | null;
          liaison_officer_name?: string | null;
          liaison_email?: string | null;
          liaison_phone?: string | null;
          status?: "ACTIVE" | "PENDING_MOA" | "INACTIVE" | "ARCHIVED";
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sister_clubs"]["Insert"]>;
      };
      partnership_initiatives: {
        Row: {
          id: string;
          sister_club_id: string;
          project_id: string | null;
          title: string;
          description: string | null;
          rotary_year: string;
          joint_volunteer_count: number;
          shared_funding_centavos: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sister_club_id: string;
          project_id?: string | null;
          title: string;
          description?: string | null;
          rotary_year?: string;
          joint_volunteer_count?: number;
          shared_funding_centavos?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["partnership_initiatives"]["Insert"]>;
      };
      scheduled_job_runs: {
        Row: {
          id: string;
          job_name: string;
          run_key: string;
          status: string;
          records_processed: number;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          job_name: string;
          run_key: string;
          status: string;
          records_processed?: number;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["scheduled_job_runs"]["Insert"]>;
      };
    };
  };
}
