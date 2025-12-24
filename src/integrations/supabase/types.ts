export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          metadata: Json | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          action_type: string
          allocated_from_user_credits: boolean | null
          candidate_id: string | null
          created_at: string | null
          credits_used: number | null
          id: string
          job_id: string | null
          metadata: Json | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          allocated_from_user_credits?: boolean | null
          candidate_id?: string | null
          created_at?: string | null
          credits_used?: number | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          allocated_from_user_credits?: boolean | null
          candidate_id?: string | null
          created_at?: string | null
          credits_used?: number | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_settings: {
        Row: {
          apply_to_cv: boolean | null
          apply_to_jd: boolean | null
          company_name: string | null
          created_at: string | null
          footer_text: string | null
          id: string
          logo_position: string | null
          logo_url: string | null
          primary_color: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          apply_to_cv?: boolean | null
          apply_to_jd?: boolean | null
          company_name?: string | null
          created_at?: string | null
          footer_text?: string | null
          id?: string
          logo_position?: string | null
          logo_url?: string | null
          primary_color?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          apply_to_cv?: boolean | null
          apply_to_jd?: boolean | null
          company_name?: string | null
          created_at?: string | null
          footer_text?: string | null
          id?: string
          logo_position?: string | null
          logo_url?: string | null
          primary_color?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branding_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_emails: {
        Row: {
          ai_generated: boolean | null
          attachments: Json | null
          body_text: string
          candidate_id: string
          created_at: string | null
          direction: string
          error_message: string | null
          from_account_id: string | null
          from_email: string
          id: string
          job_id: string | null
          metadata: Json | null
          provider_message_id: string | null
          retry_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string
          template_id: string | null
          tenant_id: string
          thread_id: string | null
          timezone: string | null
          to_email: string
          updated_at: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          attachments?: Json | null
          body_text: string
          candidate_id: string
          created_at?: string | null
          direction?: string
          error_message?: string | null
          from_account_id?: string | null
          from_email: string
          id?: string
          job_id?: string | null
          metadata?: Json | null
          provider_message_id?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          template_id?: string | null
          tenant_id: string
          thread_id?: string | null
          timezone?: string | null
          to_email: string
          updated_at?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          attachments?: Json | null
          body_text?: string
          candidate_id?: string
          created_at?: string | null
          direction?: string
          error_message?: string | null
          from_account_id?: string | null
          from_email?: string
          id?: string
          job_id?: string | null
          metadata?: Json | null
          provider_message_id?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          tenant_id?: string
          thread_id?: string | null
          timezone?: string | null
          to_email?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_emails_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_emails_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_emails_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_emails_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "user_email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_emails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string | null
          current_company: string | null
          current_title: string | null
          cv_file_url: string | null
          cv_parsed_data: Json | null
          education: Json | null
          email: string
          experience_years: number | null
          full_name: string
          id: string
          linkedin_data: Json | null
          linkedin_url: string | null
          location: string | null
          notes: string | null
          phone: string | null
          private_notes: string | null
          skills: Json | null
          source: string | null
          status: Database["public"]["Enums"]["candidate_status"] | null
          summary: string | null
          tags: Json | null
          tenant_id: string
          updated_at: string | null
          work_history: Json | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          current_company?: string | null
          current_title?: string | null
          cv_file_url?: string | null
          cv_parsed_data?: Json | null
          education?: Json | null
          email: string
          experience_years?: number | null
          full_name: string
          id?: string
          linkedin_data?: Json | null
          linkedin_url?: string | null
          location?: string | null
          notes?: string | null
          phone?: string | null
          private_notes?: string | null
          skills?: Json | null
          source?: string | null
          status?: Database["public"]["Enums"]["candidate_status"] | null
          summary?: string | null
          tags?: Json | null
          tenant_id: string
          updated_at?: string | null
          work_history?: Json | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          current_company?: string | null
          current_title?: string | null
          cv_file_url?: string | null
          cv_parsed_data?: Json | null
          education?: Json | null
          email?: string
          experience_years?: number | null
          full_name?: string
          id?: string
          linkedin_data?: Json | null
          linkedin_url?: string | null
          location?: string | null
          notes?: string | null
          phone?: string | null
          private_notes?: string | null
          skills?: Json | null
          source?: string | null
          status?: Database["public"]["Enums"]["candidate_status"] | null
          summary?: string | null
          tags?: Json | null
          tenant_id?: string
          updated_at?: string | null
          work_history?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          id: string
          is_bot_handled: boolean | null
          metadata: Json | null
          resolved_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["chat_status"] | null
          tenant_id: string | null
          updated_at: string | null
          visitor_email: string | null
          visitor_id: string | null
          visitor_name: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          is_bot_handled?: boolean | null
          metadata?: Json | null
          resolved_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["chat_status"] | null
          tenant_id?: string | null
          updated_at?: string | null
          visitor_email?: string | null
          visitor_id?: string | null
          visitor_name?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          is_bot_handled?: boolean | null
          metadata?: Json | null
          resolved_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["chat_status"] | null
          tenant_id?: string | null
          updated_at?: string | null
          visitor_email?: string | null
          visitor_id?: string | null
          visitor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          sender_id: string | null
          sender_type: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          sender_id?: string | null
          sender_type: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          sender_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_config: {
        Row: {
          created_at: string | null
          escalate_after_failures: number | null
          fallback_message: string | null
          faq_flows: Json | null
          greeting_message: string | null
          id: string
          is_active: boolean | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          escalate_after_failures?: number | null
          fallback_message?: string | null
          faq_flows?: Json | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          escalate_after_failures?: number | null
          fallback_message?: string | null
          faq_flows?: Json | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_activities: {
        Row: {
          activity_type: string
          client_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          metadata: Json | null
          tenant_id: string
        }
        Insert: {
          activity_type: string
          client_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          tenant_id: string
        }
        Update: {
          activity_type?: string
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_attachments: {
        Row: {
          client_id: string
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_attachments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_emails: {
        Row: {
          attachments: Json | null
          body_text: string
          client_id: string
          created_at: string | null
          direction: string | null
          error_message: string | null
          from_account_id: string | null
          from_email: string
          id: string
          metadata: Json | null
          scheduled_at: string | null
          sent_at: string | null
          sent_by: string | null
          status: string | null
          subject: string
          template_id: string | null
          tenant_id: string
          timezone: string | null
          to_email: string
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          body_text: string
          client_id: string
          created_at?: string | null
          direction?: string | null
          error_message?: string | null
          from_account_id?: string | null
          from_email: string
          id?: string
          metadata?: Json | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject: string
          template_id?: string | null
          tenant_id: string
          timezone?: string | null
          to_email: string
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          body_text?: string
          client_id?: string
          created_at?: string | null
          direction?: string | null
          error_message?: string | null
          from_account_id?: string | null
          from_email?: string
          id?: string
          metadata?: Json | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject?: string
          template_id?: string | null
          tenant_id?: string
          timezone?: string | null
          to_email?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_emails_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_emails_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_emails_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "user_email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_emails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          address_line1: string | null
          address_line2: string | null
          billing_terms: string | null
          city: string | null
          company_size: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          custom_fields: Json | null
          default_recruiter_id: string | null
          headquarters: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          last_contact_at: string | null
          linkedin_url: string | null
          logo_url: string | null
          name: string
          notes: string | null
          postal_code: string | null
          preferred_communication: string | null
          state: string | null
          tags: Json | null
          tenant_id: string
          total_revenue: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          billing_terms?: string | null
          city?: string | null
          company_size?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          default_recruiter_id?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          last_contact_at?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name: string
          notes?: string | null
          postal_code?: string | null
          preferred_communication?: string | null
          state?: string | null
          tags?: Json | null
          tenant_id: string
          total_revenue?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          billing_terms?: string | null
          city?: string | null
          company_size?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          default_recruiter_id?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          last_contact_at?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          postal_code?: string | null
          preferred_communication?: string | null
          state?: string | null
          tags?: Json | null
          tenant_id?: string
          total_revenue?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_pages: {
        Row: {
          content: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          is_published: boolean | null
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          action_type: string
          balance_after: number
          balance_before: number
          cost: number
          created_at: string
          id: string
          metadata: Json | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          action_type: string
          balance_after: number
          balance_before: number
          cost: number
          created_at?: string
          id?: string
          metadata?: Json | null
          tenant_id: string
          user_id: string
        }
        Update: {
          action_type?: string
          balance_after?: number
          balance_before?: number
          cost?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_submissions: {
        Row: {
          candidate_id: string
          created_at: string | null
          id: string
          job_id: string
          metadata: Json | null
          submitted_at: string
          submitted_by: string
          tenant_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          id?: string
          job_id: string
          metadata?: Json | null
          submitted_at?: string
          submitted_by: string
          tenant_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          id?: string
          job_id?: string
          metadata?: Json | null
          submitted_at?: string
          submitted_by?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_submissions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_bookings: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          preferred_date: string
          preferred_time: string
          status: string
          timezone: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          preferred_date: string
          preferred_time: string
          status?: string
          timezone?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          preferred_date?: string
          preferred_time?: string
          status?: string
          timezone?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      email_accounts: {
        Row: {
          created_at: string | null
          display_name: string
          error_message: string | null
          from_email: string
          id: string
          is_default: boolean | null
          last_sync_at: string | null
          oauth_access_token: string | null
          oauth_expires_at: string | null
          oauth_refresh_token: string | null
          provider: string
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_use_tls: boolean | null
          smtp_user: string | null
          status: string
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name: string
          error_message?: string | null
          from_email: string
          id?: string
          is_default?: boolean | null
          last_sync_at?: string | null
          oauth_access_token?: string | null
          oauth_expires_at?: string | null
          oauth_refresh_token?: string | null
          provider: string
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_use_tls?: boolean | null
          smtp_user?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string
          error_message?: string | null
          from_email?: string
          id?: string
          is_default?: boolean | null
          last_sync_at?: string | null
          oauth_access_token?: string | null
          oauth_expires_at?: string | null
          oauth_refresh_token?: string | null
          provider?: string
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_use_tls?: boolean | null
          smtp_user?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          recipient_email: string
          sent_at: string | null
          sent_by: string | null
          status: string | null
          subject: string
          template_name: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject: string
          template_name?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject?: string
          template_name?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          created_at: string | null
          html_content: string
          id: string
          is_active: boolean | null
          name: string
          subject: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          created_at?: string | null
          html_content: string
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          created_at?: string | null
          html_content?: string
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      event_participants: {
        Row: {
          candidate_id: string | null
          client_id: string | null
          created_at: string | null
          event_id: string
          external_email: string | null
          external_name: string | null
          id: string
          invitation_sent_at: string | null
          participant_type: string
          reminder_1h_sent: boolean | null
          reminder_24h_sent: boolean | null
          role: Database["public"]["Enums"]["participant_role"]
          rsvp_responded_at: string | null
          rsvp_status: Database["public"]["Enums"]["rsvp_status"]
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          candidate_id?: string | null
          client_id?: string | null
          created_at?: string | null
          event_id: string
          external_email?: string | null
          external_name?: string | null
          id?: string
          invitation_sent_at?: string | null
          participant_type: string
          reminder_1h_sent?: boolean | null
          reminder_24h_sent?: boolean | null
          role?: Database["public"]["Enums"]["participant_role"]
          rsvp_responded_at?: string | null
          rsvp_status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          candidate_id?: string | null
          client_id?: string | null
          created_at?: string | null
          event_id?: string
          external_email?: string | null
          external_name?: string | null
          id?: string
          invitation_sent_at?: string | null
          participant_type?: string
          reminder_1h_sent?: boolean | null
          reminder_24h_sent?: boolean | null
          role?: Database["public"]["Enums"]["participant_role"]
          rsvp_responded_at?: string | null
          rsvp_status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_id: string
          id: string
          reminder_time: string
          reminder_type: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_id: string
          id?: string
          reminder_time: string
          reminder_type: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_id?: string
          id?: string
          reminder_time?: string
          reminder_type?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          description: string | null
          end_time: string
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          internal_notes: string | null
          job_id: string | null
          location_address: string | null
          location_type: string
          meeting_link: string | null
          organizer_id: string
          start_time: string
          status: Database["public"]["Enums"]["event_status"]
          tenant_id: string
          timezone: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_time: string
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          internal_notes?: string | null
          job_id?: string | null
          location_address?: string | null
          location_type?: string
          meeting_link?: string | null
          organizer_id: string
          start_time: string
          status?: Database["public"]["Enums"]["event_status"]
          tenant_id: string
          timezone?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_time?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          internal_notes?: string | null
          job_id?: string | null
          location_address?: string | null
          location_type?: string
          meeting_link?: string | null
          organizer_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["event_status"]
          tenant_id?: string
          timezone?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          duplicate_policy: string | null
          error_count: number | null
          error_report_url: string | null
          file_url: string | null
          id: string
          import_type: string
          mapping_config: Json | null
          processed_rows: number | null
          status: string | null
          success_count: number | null
          tenant_id: string
          total_rows: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          duplicate_policy?: string | null
          error_count?: number | null
          error_report_url?: string | null
          file_url?: string | null
          id?: string
          import_type: string
          mapping_config?: Json | null
          processed_rows?: number | null
          status?: string | null
          success_count?: number | null
          tenant_id: string
          total_rows?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          duplicate_policy?: string | null
          error_count?: number | null
          error_report_url?: string | null
          file_url?: string | null
          id?: string
          import_type?: string
          mapping_config?: Json | null
          processed_rows?: number | null
          status?: string | null
          success_count?: number | null
          tenant_id?: string
          total_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          company_address: string | null
          company_logo: string | null
          company_name: string | null
          company_phone: string | null
          created_at: string | null
          currency: string | null
          due_date: string | null
          id: string
          invoice_number: string
          line_items: Json | null
          notes: string | null
          paid_at: string | null
          pdf_url: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          stripe_invoice_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          company_address?: string | null
          company_logo?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          line_items?: Json | null
          notes?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_invoice_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          company_address?: string | null
          company_logo?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          line_items?: Json | null
          notes?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_invoice_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignees: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          job_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          job_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          job_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_assignees_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_candidates: {
        Row: {
          applied_at: string | null
          candidate_id: string
          created_at: string | null
          id: string
          job_id: string
          match_confidence: number | null
          match_explanation: string | null
          match_gaps: Json | null
          match_score: number | null
          match_strengths: Json | null
          matched_at: string | null
          notes: string | null
          rejection_reason: string | null
          stage: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_updated_at: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          applied_at?: string | null
          candidate_id: string
          created_at?: string | null
          id?: string
          job_id: string
          match_confidence?: number | null
          match_explanation?: string | null
          match_gaps?: Json | null
          match_score?: number | null
          match_strengths?: Json | null
          matched_at?: string | null
          notes?: string | null
          rejection_reason?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_updated_at?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          applied_at?: string | null
          candidate_id?: string
          created_at?: string | null
          id?: string
          job_id?: string
          match_confidence?: number | null
          match_explanation?: string | null
          match_gaps?: Json | null
          match_score?: number | null
          match_strengths?: Json | null
          matched_at?: string | null
          notes?: string | null
          rejection_reason?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_updated_at?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_candidates_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          closes_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          employment_type: string | null
          experience_level: string | null
          id: string
          is_remote: boolean | null
          jd_file_url: string | null
          jd_parsed_text: string | null
          location: string | null
          openings: number | null
          published_at: string | null
          requirements: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          skills: Json | null
          status: Database["public"]["Enums"]["job_status"] | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          closes_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          employment_type?: string | null
          experience_level?: string | null
          id?: string
          is_remote?: boolean | null
          jd_file_url?: string | null
          jd_parsed_text?: string | null
          location?: string | null
          openings?: number | null
          published_at?: string | null
          requirements?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          skills?: Json | null
          status?: Database["public"]["Enums"]["job_status"] | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          closes_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          employment_type?: string | null
          experience_level?: string | null
          id?: string
          is_remote?: boolean | null
          jd_file_url?: string | null
          jd_parsed_text?: string | null
          location?: string | null
          openings?: number | null
          published_at?: string | null
          requirements?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          skills?: Json | null
          status?: Database["public"]["Enums"]["job_status"] | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_connections: {
        Row: {
          access_token_encrypted: string | null
          connected_at: string | null
          created_at: string
          disconnected_at: string | null
          id: string
          is_connected: boolean
          linkedin_avatar_url: string | null
          linkedin_email: string | null
          linkedin_name: string | null
          linkedin_profile_id: string | null
          linkedin_profile_url: string | null
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          id?: string
          is_connected?: boolean
          linkedin_avatar_url?: string | null
          linkedin_email?: string | null
          linkedin_name?: string | null
          linkedin_profile_id?: string | null
          linkedin_profile_url?: string | null
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          id?: string
          is_connected?: boolean
          linkedin_avatar_url?: string | null
          linkedin_email?: string | null
          linkedin_name?: string | null
          linkedin_profile_id?: string | null
          linkedin_profile_url?: string | null
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_message_logs: {
        Row: {
          candidate_id: string
          created_at: string | null
          id: string
          job_id: string | null
          message_text: string
          sent_at: string | null
          sent_by: string
          status: string | null
          template_id: string | null
          tenant_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          id?: string
          job_id?: string | null
          message_text: string
          sent_at?: string | null
          sent_by: string
          status?: string | null
          template_id?: string | null
          tenant_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          id?: string
          job_id?: string | null
          message_text?: string
          sent_at?: string | null
          sent_by?: string
          status?: string | null
          template_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_message_logs_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_message_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_message_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "linkedin_message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_message_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_message_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_message_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_outreach_campaigns: {
        Row: {
          account_type: string
          completed_at: string | null
          created_at: string
          custom_message: string | null
          daily_limit: number
          id: string
          last_reset_date: string | null
          locked_until: string | null
          message_template_id: string | null
          name: string
          outreach_mode: string
          paused_at: string | null
          sent_today: number
          started_at: string | null
          status: string
          tenant_id: string
          total_profiles: number
          updated_at: string
          user_id: string
          visited_today: number
        }
        Insert: {
          account_type?: string
          completed_at?: string | null
          created_at?: string
          custom_message?: string | null
          daily_limit?: number
          id?: string
          last_reset_date?: string | null
          locked_until?: string | null
          message_template_id?: string | null
          name: string
          outreach_mode?: string
          paused_at?: string | null
          sent_today?: number
          started_at?: string | null
          status?: string
          tenant_id: string
          total_profiles?: number
          updated_at?: string
          user_id: string
          visited_today?: number
        }
        Update: {
          account_type?: string
          completed_at?: string | null
          created_at?: string
          custom_message?: string | null
          daily_limit?: number
          id?: string
          last_reset_date?: string | null
          locked_until?: string | null
          message_template_id?: string | null
          name?: string
          outreach_mode?: string
          paused_at?: string | null
          sent_today?: number
          started_at?: string | null
          status?: string
          tenant_id?: string
          total_profiles?: number
          updated_at?: string
          user_id?: string
          visited_today?: number
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_outreach_campaigns_message_template_id_fkey"
            columns: ["message_template_id"]
            isOneToOne: false
            referencedRelation: "linkedin_message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_outreach_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_outreach_consent: {
        Row: {
          acknowledged_at: string
          id: string
          ip_address: string | null
          tenant_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          ip_address?: string | null
          tenant_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          ip_address?: string | null
          tenant_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_outreach_consent_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_outreach_logs: {
        Row: {
          action: string
          campaign_id: string
          created_at: string
          details: Json | null
          id: string
          queue_item_id: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          action: string
          campaign_id: string
          created_at?: string
          details?: Json | null
          id?: string
          queue_item_id?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          action?: string
          campaign_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          queue_item_id?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_outreach_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_outreach_logs_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "linkedin_outreach_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_outreach_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_outreach_queue: {
        Row: {
          campaign_id: string
          candidate_id: string | null
          company: string | null
          connected_at: string | null
          connection_sent: boolean | null
          created_at: string
          dwell_time_seconds: number | null
          error_message: string | null
          first_name: string | null
          id: string
          job_title: string | null
          linkedin_url: string
          position: number
          skip_reason: string | null
          status: string
          tenant_id: string
          updated_at: string
          visited_at: string | null
        }
        Insert: {
          campaign_id: string
          candidate_id?: string | null
          company?: string | null
          connected_at?: string | null
          connection_sent?: boolean | null
          created_at?: string
          dwell_time_seconds?: number | null
          error_message?: string | null
          first_name?: string | null
          id?: string
          job_title?: string | null
          linkedin_url: string
          position?: number
          skip_reason?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          visited_at?: string | null
        }
        Update: {
          campaign_id?: string
          candidate_id?: string | null
          company?: string | null
          connected_at?: string | null
          connection_sent?: boolean | null
          created_at?: string
          dwell_time_seconds?: number | null
          error_message?: string | null
          first_name?: string | null
          id?: string
          job_title?: string | null
          linkedin_url?: string
          position?: number
          skip_reason?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          visited_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_outreach_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_outreach_queue_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_outreach_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_email_sent: boolean
          is_read: boolean
          link: string | null
          message: string
          metadata: Json | null
          read_at: string | null
          tenant_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_email_sent?: boolean
          is_read?: boolean
          link?: string | null
          message: string
          metadata?: Json | null
          read_at?: string | null
          tenant_id: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_email_sent?: boolean
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json | null
          read_at?: string | null
          tenant_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          billing_cycle: string
          created_at: string | null
          currency: string
          id: string
          metadata: Json | null
          payment_method: string | null
          plan_id: string | null
          rejection_reason: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          billing_cycle?: string
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          plan_id?: string | null
          rejection_reason?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          billing_cycle?: string
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          plan_id?: string | null
          rejection_reason?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          id: string
          status: string | null
          stripe_session_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          status?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          status?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      Payments: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          id: string
          status: string | null
          stripe_session_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          status?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          status?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string
          email_signature: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          job_title: string | null
          last_login_at: string | null
          must_reset_password: boolean | null
          notification_preferences: Json | null
          phone: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          email_signature?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          job_title?: string | null
          last_login_at?: string | null
          must_reset_password?: boolean | null
          notification_preferences?: Json | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          email_signature?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          last_login_at?: string | null
          must_reset_password?: boolean | null
          notification_preferences?: Json | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_code_uses: {
        Row: {
          discount_applied: number
          id: string
          order_id: string | null
          promo_code_id: string
          tenant_id: string | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          discount_applied: number
          id?: string
          order_id?: string | null
          promo_code_id: string
          tenant_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          discount_applied?: number
          id?: string
          order_id?: string | null
          promo_code_id?: string
          tenant_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_uses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_uses_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_uses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          applicable_plans: Json | null
          banner_text: string | null
          code: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_purchase_amount: number | null
          show_as_banner: boolean | null
          updated_at: string | null
          uses_count: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_plans?: Json | null
          banner_text?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          discount_type?: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase_amount?: number | null
          show_as_banner?: boolean | null
          updated_at?: string | null
          uses_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_plans?: Json | null
          banner_text?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase_amount?: number | null
          show_as_banner?: boolean | null
          updated_at?: string | null
          uses_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      recruiter_activities: {
        Row: {
          action_type: string
          candidate_id: string | null
          client_id: string | null
          created_at: string | null
          id: string
          job_id: string | null
          metadata: Json | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          action_type: string
          candidate_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          tenant_id: string
          user_id: string
        }
        Update: {
          action_type?: string
          candidate_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_activities_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_activities_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_actions: {
        Row: {
          action_type: string
          created_at: string | null
          executed_at: string | null
          id: string
          payload: Json | null
          result: Json | null
          scheduled_for: string
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          executed_at?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          scheduled_for: string
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          executed_at?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          scheduled_for?: string
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_branding: {
        Row: {
          chat_widget_script: string | null
          favicon_url: string | null
          id: string
          logo_url: string | null
          meta_description: string | null
          primary_color: string | null
          secondary_color: string | null
          site_title: string | null
          social_links: Json | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          chat_widget_script?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          meta_description?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          site_title?: string | null
          social_links?: Json | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          chat_widget_script?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          meta_description?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          site_title?: string | null
          social_links?: Json | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          match_credits_monthly: number | null
          max_candidates: number | null
          max_jobs: number | null
          max_users: number | null
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          match_credits_monthly?: number | null
          max_candidates?: number | null
          max_jobs?: number | null
          max_users?: number | null
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          match_credits_monthly?: number | null
          max_candidates?: number | null
          max_jobs?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number
          slug?: string
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          id: string
          status: string | null
          stripe_session_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          status?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          status?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      Subscriptionx: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          id: string
          status: string | null
          stripe_session_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          status?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          status?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          conversation_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          priority: string | null
          resolved_at: string | null
          status: string | null
          subject: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          subject: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          subject?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          tenant_id: string
          token: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          tenant_id: string
          token: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          tenant_id?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_login_links: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          reason: string | null
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          id?: string
          reason?: string | null
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          reason?: string | null
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tenant_work_settings: {
        Row: {
          auto_end_time: string | null
          created_at: string | null
          id: string
          tenant_id: string
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          auto_end_time?: string | null
          created_at?: string | null
          id?: string
          tenant_id: string
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_end_time?: string | null
          created_at?: string | null
          id?: string
          tenant_id?: string
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_work_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          favicon_url: string | null
          grace_until: string | null
          id: string
          is_paused: boolean | null
          is_suspended: boolean | null
          logo_url: string | null
          match_credits_limit: number | null
          match_credits_remaining: number | null
          name: string
          paused_at: string | null
          paused_reason: string | null
          primary_color: string | null
          slug: string
          subscription_ends_at: string | null
          subscription_plan_id: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          suspended_at: string | null
          trial_days: number | null
          trial_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          favicon_url?: string | null
          grace_until?: string | null
          id?: string
          is_paused?: boolean | null
          is_suspended?: boolean | null
          logo_url?: string | null
          match_credits_limit?: number | null
          match_credits_remaining?: number | null
          name: string
          paused_at?: string | null
          paused_reason?: string | null
          primary_color?: string | null
          slug: string
          subscription_ends_at?: string | null
          subscription_plan_id?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          suspended_at?: string | null
          trial_days?: number | null
          trial_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          favicon_url?: string | null
          grace_until?: string | null
          id?: string
          is_paused?: boolean | null
          is_suspended?: boolean | null
          logo_url?: string | null
          match_credits_limit?: number | null
          match_credits_remaining?: number | null
          name?: string
          paused_at?: string | null
          paused_reason?: string | null
          primary_color?: string | null
          slug?: string
          subscription_ends_at?: string | null
          subscription_plan_id?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          suspended_at?: string | null
          trial_days?: number | null
          trial_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          author_avatar: string | null
          author_name: string
          author_role: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          order_index: number | null
          quote: string
          rating: number | null
          source: string | null
          status: string | null
          submitted_company: string | null
          submitted_email: string | null
          updated_at: string | null
        }
        Insert: {
          author_avatar?: string | null
          author_name: string
          author_role: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          order_index?: number | null
          quote: string
          rating?: number | null
          source?: string | null
          status?: string | null
          submitted_company?: string | null
          submitted_email?: string | null
          updated_at?: string | null
        }
        Update: {
          author_avatar?: string | null
          author_name?: string
          author_role?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          order_index?: number | null
          quote?: string
          rating?: number | null
          source?: string | null
          status?: string | null
          submitted_company?: string | null
          submitted_email?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      trusted_clients: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          logo_url: string
          name: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          logo_url: string
          name: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          logo_url?: string
          name?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      user_email_templates: {
        Row: {
          body_text: string
          created_at: string | null
          default_from_account_id: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string
          tags: string[] | null
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body_text: string
          created_at?: string | null
          default_from_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          tags?: string[] | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body_text?: string
          created_at?: string | null
          default_from_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_email_templates_default_from_account_id_fkey"
            columns: ["default_from_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string | null
          granted_by: string | null
          id: string
          permission: string
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          permission: string
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          permission?: string
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          ai_credits_allocated: number | null
          ai_credits_used: number | null
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          ai_credits_allocated?: number | null
          ai_credits_used?: number | null
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          ai_credits_allocated?: number | null
          ai_credits_used?: number | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_featured: boolean | null
          is_visible: boolean | null
          order_index: number | null
          title: string
          updated_at: string | null
          youtube_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          is_visible?: boolean | null
          order_index?: number | null
          title: string
          updated_at?: string | null
          youtube_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          is_visible?: boolean | null
          order_index?: number | null
          title?: string
          updated_at?: string | null
          youtube_id?: string
        }
        Relationships: []
      }
      whatsapp_logs: {
        Row: {
          candidate_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          message: string
          phone_number: string
          sent_at: string | null
          status: string | null
          template_id: string | null
          tenant_id: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message: string
          phone_number: string
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message?: string
          phone_number?: string
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_logs_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          api_key: string | null
          api_provider: string | null
          api_secret: string | null
          business_account_id: string | null
          id: string
          is_configured: boolean | null
          phone_number_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          api_key?: string | null
          api_provider?: string | null
          api_secret?: string | null
          business_account_id?: string | null
          id?: string
          is_configured?: boolean | null
          phone_number_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          api_key?: string | null
          api_provider?: string | null
          api_secret?: string | null
          business_account_id?: string | null
          id?: string
          is_configured?: boolean | null
          phone_number_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          message: string
          name: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          name: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          name?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      work_sessions: {
        Row: {
          bod_summary: string | null
          created_at: string | null
          date: string
          ended_at: string | null
          eod_summary: string | null
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["work_status"] | null
          tenant_id: string
          timezone: string
          total_break_minutes: number | null
          total_work_minutes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bod_summary?: string | null
          created_at?: string | null
          date?: string
          ended_at?: string | null
          eod_summary?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["work_status"] | null
          tenant_id: string
          timezone?: string
          total_break_minutes?: number | null
          total_work_minutes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bod_summary?: string | null
          created_at?: string | null
          date?: string
          ended_at?: string | null
          eod_summary?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["work_status"] | null
          tenant_id?: string
          timezone?: string
          total_break_minutes?: number | null
          total_work_minutes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      work_status_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          metadata: Json | null
          tenant_id: string
          timestamp: string
          timezone: string
          user_id: string
          user_role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          tenant_id: string
          timestamp?: string
          timezone?: string
          user_id: string
          user_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string
          timestamp?: string
          timezone?: string
          user_id?: string
          user_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "work_status_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_credits: {
        Args: {
          p_action_type: string
          p_amount: number
          p_metadata?: Json
          p_tenant_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      deduct_credits: {
        Args: {
          p_action_type: string
          p_cost: number
          p_metadata?: Json
          p_tenant_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      deduct_user_ai_credits: {
        Args: {
          _action_type: string
          _credits: number
          _metadata?: Json
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      fix_invited_user_profile: {
        Args: { p_email: string; p_invitation_id: string; p_user_id: string }
        Returns: undefined
      }
      generate_invoice_number: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      hard_delete_user: {
        Args: { p_deleted_by: string; p_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_sufficient_credits: {
        Args: { p_required_credits: number; p_tenant_id: string }
        Returns: boolean
      }
      has_user_ai_credits: {
        Args: { _credits_needed: number; _user_id: string }
        Returns: boolean
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      is_recruiter: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      promote_to_super_admin: {
        Args: { user_email: string }
        Returns: undefined
      }
      restore_user: {
        Args: { p_restored_by: string; p_user_id: string }
        Returns: boolean
      }
      soft_delete_user: {
        Args: { p_deleted_by: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "recruiter"
        | "support"
        | "viewer"
        | "manager"
        | "owner"
      candidate_status:
        | "new"
        | "screening"
        | "interviewing"
        | "offered"
        | "hired"
        | "rejected"
        | "withdrawn"
      chat_status: "pending" | "active" | "resolved" | "escalated"
      event_status: "scheduled" | "completed" | "cancelled" | "rescheduled"
      event_type:
        | "interview"
        | "client_meeting"
        | "internal_meeting"
        | "follow_up"
        | "custom"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "canceled"
      job_status: "draft" | "open" | "paused" | "closed" | "filled"
      participant_role:
        | "candidate"
        | "client"
        | "interviewer"
        | "observer"
        | "organizer"
      pipeline_stage:
        | "applied"
        | "screening"
        | "interview"
        | "technical"
        | "offer"
        | "hired"
        | "rejected"
      rsvp_status: "pending" | "accepted" | "declined" | "tentative"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "canceled"
        | "suspended"
      work_status: "working" | "on_break" | "ended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "admin",
        "recruiter",
        "support",
        "viewer",
        "manager",
        "owner",
      ],
      candidate_status: [
        "new",
        "screening",
        "interviewing",
        "offered",
        "hired",
        "rejected",
        "withdrawn",
      ],
      chat_status: ["pending", "active", "resolved", "escalated"],
      event_status: ["scheduled", "completed", "cancelled", "rescheduled"],
      event_type: [
        "interview",
        "client_meeting",
        "internal_meeting",
        "follow_up",
        "custom",
      ],
      invoice_status: ["draft", "sent", "paid", "overdue", "canceled"],
      job_status: ["draft", "open", "paused", "closed", "filled"],
      participant_role: [
        "candidate",
        "client",
        "interviewer",
        "observer",
        "organizer",
      ],
      pipeline_stage: [
        "applied",
        "screening",
        "interview",
        "technical",
        "offer",
        "hired",
        "rejected",
      ],
      rsvp_status: ["pending", "accepted", "declined", "tentative"],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "canceled",
        "suspended",
      ],
      work_status: ["working", "on_break", "ended"],
    },
  },
} as const
