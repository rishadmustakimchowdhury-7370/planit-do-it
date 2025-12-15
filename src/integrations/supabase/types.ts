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
          scheduled_at: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string
          template_id: string | null
          tenant_id: string
          thread_id: string | null
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
          scheduled_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          template_id?: string | null
          tenant_id: string
          thread_id?: string | null
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
          scheduled_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          tenant_id?: string
          thread_id?: string | null
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
      clients: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string
          notes: string | null
          tenant_id: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          notes?: string | null
          tenant_id: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          tenant_id?: string
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
          email: string
          email_signature: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          job_title: string | null
          last_login_at: string | null
          must_reset_password: boolean | null
          phone: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          email_signature?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          job_title?: string | null
          last_login_at?: string | null
          must_reset_password?: boolean | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          email_signature?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          last_login_at?: string | null
          must_reset_password?: boolean | null
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
          updated_at?: string | null
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
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invoice_number: { Args: never; Returns: string }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      promote_to_super_admin: {
        Args: { user_email: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "recruiter" | "support" | "viewer"
      candidate_status:
        | "new"
        | "screening"
        | "interviewing"
        | "offered"
        | "hired"
        | "rejected"
        | "withdrawn"
      chat_status: "pending" | "active" | "resolved" | "escalated"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "canceled"
      job_status: "draft" | "open" | "paused" | "closed" | "filled"
      pipeline_stage:
        | "applied"
        | "screening"
        | "interview"
        | "technical"
        | "offer"
        | "hired"
        | "rejected"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "canceled"
        | "suspended"
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
      app_role: ["super_admin", "admin", "recruiter", "support", "viewer"],
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
      invoice_status: ["draft", "sent", "paid", "overdue", "canceled"],
      job_status: ["draft", "open", "paused", "closed", "filled"],
      pipeline_stage: [
        "applied",
        "screening",
        "interview",
        "technical",
        "offer",
        "hired",
        "rejected",
      ],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "canceled",
        "suspended",
      ],
    },
  },
} as const
