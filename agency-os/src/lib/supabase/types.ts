// Сгенерировано вручную по схеме `supabase/migrations/0001_init.sql`
// в формате, который выдаёт `supabase gen types typescript`.
// Когда проект будет подключён через Supabase CLI, перегенерировать командой:
//   supabase gen types typescript --linked > src/lib/supabase/types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: Database["public"]["Enums"]["user_role"];
          position_title: string | null;
          phone: string | null;
          telegram: string | null;
          email: string | null;
          is_active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: Database["public"]["Enums"]["user_role"];
          position_title?: string | null;
          phone?: string | null;
          telegram?: string | null;
          email?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          position_title?: string | null;
          phone?: string | null;
          telegram?: string | null;
          email?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          id: string;
          name: string;
          status: Database["public"]["Enums"]["client_status"] | null;
          budget: number | null;
          phone: string | null;
          email: string | null;
          telegram: string | null;
          links: Json | null;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          status?: Database["public"]["Enums"]["client_status"] | null;
          budget?: number | null;
          phone?: string | null;
          email?: string | null;
          telegram?: string | null;
          links?: Json | null;
          notes?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          status?: Database["public"]["Enums"]["client_status"] | null;
          budget?: number | null;
          phone?: string | null;
          email?: string | null;
          telegram?: string | null;
          links?: Json | null;
          notes?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          client_id: string | null;
          name: string;
          health: Database["public"]["Enums"]["project_health"] | null;
          stage: Database["public"]["Enums"]["project_stage"] | null;
          budget: number | null;
          monthly_fee: number | null;
          ownership_mode: string | null;
          responsible_id: string | null;
          short_comment: string | null;
          links: Json | null;
          ad_platforms: string | null;
          logo_url: string | null;
          is_personal: boolean;
          started_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          name: string;
          health?: Database["public"]["Enums"]["project_health"] | null;
          stage?: Database["public"]["Enums"]["project_stage"] | null;
          budget?: number | null;
          monthly_fee?: number | null;
          ownership_mode?: string | null;
          responsible_id?: string | null;
          short_comment?: string | null;
          links?: Json | null;
          ad_platforms?: string | null;
          logo_url?: string | null;
          is_personal?: boolean;
          started_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string | null;
          name?: string;
          health?: Database["public"]["Enums"]["project_health"] | null;
          stage?: Database["public"]["Enums"]["project_stage"] | null;
          budget?: number | null;
          monthly_fee?: number | null;
          ownership_mode?: string | null;
          responsible_id?: string | null;
          short_comment?: string | null;
          links?: Json | null;
          ad_platforms?: string | null;
          logo_url?: string | null;
          is_personal?: boolean;
          started_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_responsible_id_fkey";
            columns: ["responsible_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      project_members: {
        Row: {
          project_id: string;
          profile_id: string;
          role_on_project: string | null;
        };
        Insert: {
          project_id: string;
          profile_id: string;
          role_on_project?: string | null;
        };
        Update: {
          project_id?: string;
          profile_id?: string;
          role_on_project?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string | null;
          title: string;
          description: string | null;
          assignee_id: string | null;
          creator_id: string | null;
          status: Database["public"]["Enums"]["task_status"] | null;
          priority: Database["public"]["Enums"]["task_priority"] | null;
          task_type: Database["public"]["Enums"]["task_type"] | null;
          due_date: string | null;
          estimate_minutes: number | null;
          workstream: string | null;
          parent_task_id: string | null;
          recurring_task_id: string | null;
          is_important: boolean | null;
          is_urgent: boolean | null;
          created_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          title: string;
          description?: string | null;
          assignee_id?: string | null;
          creator_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"] | null;
          priority?: Database["public"]["Enums"]["task_priority"] | null;
          task_type?: Database["public"]["Enums"]["task_type"] | null;
          due_date?: string | null;
          estimate_minutes?: number | null;
          workstream?: string | null;
          parent_task_id?: string | null;
          recurring_task_id?: string | null;
          is_important?: boolean | null;
          is_urgent?: boolean | null;
          created_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          title?: string;
          description?: string | null;
          assignee_id?: string | null;
          creator_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"] | null;
          priority?: Database["public"]["Enums"]["task_priority"] | null;
          task_type?: Database["public"]["Enums"]["task_type"] | null;
          due_date?: string | null;
          estimate_minutes?: number | null;
          workstream?: string | null;
          parent_task_id?: string | null;
          recurring_task_id?: string | null;
          is_important?: boolean | null;
          is_urgent?: boolean | null;
          created_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_recurring_task_id_fkey";
            columns: ["recurring_task_id"];
            isOneToOne: false;
            referencedRelation: "recurring_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_tasks: {
        Row: {
          id: string;
          title: string;
          project_id: string | null;
          workstream: string | null;
          assignee_id: string | null;
          creator_id: string | null;
          task_type: Database["public"]["Enums"]["task_type"];
          priority: Database["public"]["Enums"]["task_priority"];
          frequency: string;
          weekdays: number[] | null;
          anchor_date: string;
          is_active: boolean;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          project_id?: string | null;
          workstream?: string | null;
          assignee_id?: string | null;
          creator_id?: string | null;
          task_type?: Database["public"]["Enums"]["task_type"];
          priority?: Database["public"]["Enums"]["task_priority"];
          frequency: string;
          weekdays?: number[] | null;
          anchor_date?: string;
          is_active?: boolean;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          project_id?: string | null;
          workstream?: string | null;
          assignee_id?: string | null;
          creator_id?: string | null;
          task_type?: Database["public"]["Enums"]["task_type"];
          priority?: Database["public"]["Enums"]["task_priority"];
          frequency?: string;
          weekdays?: number[] | null;
          anchor_date?: string;
          is_active?: boolean;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_tasks_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_tasks_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_checklist_items: {
        Row: {
          id: string;
          task_id: string | null;
          title: string;
          is_done: boolean | null;
          position: number | null;
        };
        Insert: {
          id?: string;
          task_id?: string | null;
          title: string;
          is_done?: boolean | null;
          position?: number | null;
        };
        Update: {
          id?: string;
          task_id?: string | null;
          title?: string;
          is_done?: boolean | null;
          position?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      task_comments: {
        Row: {
          id: string;
          task_id: string | null;
          author_id: string | null;
          body: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          task_id?: string | null;
          author_id?: string | null;
          body: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string | null;
          author_id?: string | null;
          body?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_attachments: {
        Row: {
          id: string;
          task_id: string | null;
          url: string;
          title: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          task_id?: string | null;
          url: string;
          title?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string | null;
          url?: string;
          title?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      kpi_entries: {
        Row: {
          id: string;
          project_id: string | null;
          entry_date: string;
          spend: number | null;
          impressions: number | null;
          clicks: number | null;
          leads: number | null;
          sales: number | null;
          revenue: number | null;
          comment: string | null;
          ctr: number | null;
          cpc: number | null;
          cpl: number | null;
          drr: number | null;
          romi: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          entry_date: string;
          spend?: number | null;
          impressions?: number | null;
          clicks?: number | null;
          leads?: number | null;
          sales?: number | null;
          revenue?: number | null;
          comment?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          entry_date?: string;
          spend?: number | null;
          impressions?: number | null;
          clicks?: number | null;
          leads?: number | null;
          sales?: number | null;
          revenue?: number | null;
          comment?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "kpi_entries_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_notes: {
        Row: {
          id: string;
          project_id: string | null;
          type: Database["public"]["Enums"]["note_type"];
          body: string;
          status: string | null;
          author_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          type: Database["public"]["Enums"]["note_type"];
          body: string;
          status?: string | null;
          author_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          type?: Database["public"]["Enums"]["note_type"];
          body?: string;
          status?: string | null;
          author_id?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invite_codes: {
        Row: {
          code: string;
          role: Database["public"]["Enums"]["user_role"];
          full_name: string | null;
          created_by: string | null;
          created_at: string | null;
          expires_at: string | null;
          used_by: string | null;
          used_at: string | null;
        };
        Insert: {
          code: string;
          role?: Database["public"]["Enums"]["user_role"];
          full_name?: string | null;
          created_by?: string | null;
          created_at?: string | null;
          expires_at?: string | null;
          used_by?: string | null;
          used_at?: string | null;
        };
        Update: {
          code?: string;
          role?: Database["public"]["Enums"]["user_role"];
          full_name?: string | null;
          created_by?: string | null;
          created_at?: string | null;
          expires_at?: string | null;
          used_by?: string | null;
          used_at?: string | null;
        };
        Relationships: [];
      };
      time_entries: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          started_at: string;
          ended_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "time_entries_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_time_entries: {
        Row: {
          id: string;
          task_id: string;
          task_title: string;
          task_type: Database["public"]["Enums"]["task_type"] | null;
          workstream: string | null;
          project_id: string | null;
          user_id: string | null;
          started_at: string;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          task_title: string;
          task_type?: Database["public"]["Enums"]["task_type"] | null;
          workstream?: string | null;
          project_id?: string | null;
          user_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          task_title?: string;
          task_type?: Database["public"]["Enums"]["task_type"] | null;
          workstream?: string | null;
          project_id?: string | null;
          user_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_time_entries_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_time_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_accounts: {
        Row: {
          id: string;
          platform: string;
          external_id: string;
          name: string | null;
          currency: string | null;
          project_id: string | null;
          is_active: boolean;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          platform?: string;
          external_id: string;
          name?: string | null;
          currency?: string | null;
          project_id?: string | null;
          is_active?: boolean;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          platform?: string;
          external_id?: string;
          name?: string | null;
          currency?: string | null;
          project_id?: string | null;
          is_active?: boolean;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_accounts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_metrics: {
        Row: {
          id: string;
          ad_account_id: string;
          date: string;
          spend: number;
          impressions: number;
          clicks: number;
          leads: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          ad_account_id: string;
          date: string;
          spend?: number;
          impressions?: number;
          clicks?: number;
          leads?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          ad_account_id?: string;
          date?: string;
          spend?: number;
          impressions?: number;
          clicks?: number;
          leads?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_metrics_ad_account_id_fkey";
            columns: ["ad_account_id"];
            isOneToOne: false;
            referencedRelation: "ad_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_campaigns: {
        Row: {
          id: string;
          ad_account_id: string;
          external_id: string;
          name: string | null;
          objective: string | null;
          status: string | null;
          project_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          ad_account_id: string;
          external_id: string;
          name?: string | null;
          objective?: string | null;
          status?: string | null;
          project_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          ad_account_id?: string;
          external_id?: string;
          name?: string | null;
          objective?: string | null;
          status?: string | null;
          project_id?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_ad_account_id_fkey";
            columns: ["ad_account_id"];
            isOneToOne: false;
            referencedRelation: "ad_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ad_campaigns_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_campaign_metrics: {
        Row: {
          id: string;
          campaign_id: string;
          date: string;
          spend: number;
          impressions: number;
          clicks: number;
          reach: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          date: string;
          spend?: number;
          impressions?: number;
          clicks?: number;
          reach?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          date?: string;
          spend?: number;
          impressions?: number;
          clicks?: number;
          reach?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_campaign_metrics_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "ad_campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_conversions: {
        Row: {
          id: string;
          campaign_id: string;
          date: string;
          action_type: string;
          count: number;
          value: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          date: string;
          action_type: string;
          count?: number;
          value?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          date?: string;
          action_type?: string;
          count?: number;
          value?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_conversions_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "ad_campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_custom_conversions: {
        Row: {
          id: string;
          account_id: string;
          conversion_id: string;
          name: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          conversion_id: string;
          name?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          conversion_id?: string;
          name?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_custom_conversions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "ad_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_sets: {
        Row: {
          id: string;
          campaign_id: string;
          external_id: string;
          name: string | null;
          status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          external_id: string;
          name?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          external_id?: string;
          name?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_sets_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "ad_campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      ads: {
        Row: {
          id: string;
          adset_id: string;
          external_id: string;
          name: string | null;
          status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          adset_id: string;
          external_id: string;
          name?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          adset_id?: string;
          external_id?: string;
          name?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ads_adset_id_fkey";
            columns: ["adset_id"];
            isOneToOne: false;
            referencedRelation: "ad_sets";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_set_metrics: {
        Row: {
          id: string;
          adset_id: string;
          date: string;
          spend: number;
          impressions: number;
          clicks: number;
          reach: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          adset_id: string;
          date: string;
          spend?: number;
          impressions?: number;
          clicks?: number;
          reach?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          adset_id?: string;
          date?: string;
          spend?: number;
          impressions?: number;
          clicks?: number;
          reach?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_set_metrics_adset_id_fkey";
            columns: ["adset_id"];
            isOneToOne: false;
            referencedRelation: "ad_sets";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_ad_metrics: {
        Row: {
          id: string;
          ad_id: string;
          date: string;
          spend: number;
          impressions: number;
          clicks: number;
          reach: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          ad_id: string;
          date: string;
          spend?: number;
          impressions?: number;
          clicks?: number;
          reach?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          ad_id?: string;
          date?: string;
          spend?: number;
          impressions?: number;
          clicks?: number;
          reach?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_ad_metrics_ad_id_fkey";
            columns: ["ad_id"];
            isOneToOne: false;
            referencedRelation: "ads";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_set_conversions: {
        Row: {
          id: string;
          adset_id: string;
          date: string;
          action_type: string;
          count: number;
          value: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          adset_id: string;
          date: string;
          action_type: string;
          count?: number;
          value?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          adset_id?: string;
          date?: string;
          action_type?: string;
          count?: number;
          value?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_set_conversions_adset_id_fkey";
            columns: ["adset_id"];
            isOneToOne: false;
            referencedRelation: "ad_sets";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_ad_conversions: {
        Row: {
          id: string;
          ad_id: string;
          date: string;
          action_type: string;
          count: number;
          value: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          ad_id: string;
          date: string;
          action_type: string;
          count?: number;
          value?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          ad_id?: string;
          date?: string;
          action_type?: string;
          count?: number;
          value?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_ad_conversions_ad_id_fkey";
            columns: ["ad_id"];
            isOneToOne: false;
            referencedRelation: "ads";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_audience_metrics: {
        Row: {
          id: string;
          campaign_id: string;
          date: string;
          breakdown: "age" | "gender" | "country" | "region" | "publisher_platform";
          value: string;
          impressions: number;
          reach: number;
          clicks: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          date: string;
          breakdown: "age" | "gender" | "country" | "region" | "publisher_platform";
          value: string;
          impressions?: number;
          reach?: number;
          clicks?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          date?: string;
          breakdown?: "age" | "gender" | "country" | "region" | "publisher_platform";
          value?: string;
          impressions?: number;
          reach?: number;
          clicks?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_audience_metrics_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "ad_campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      social_accounts: {
        Row: {
          id: string;
          project_id: string | null;
          platform: "instagram" | "vk" | "telegram";
          external_id: string;
          username: string | null;
          name: string | null;
          profile_picture_url: string | null;
          followers_count: number;
          media_count: number;
          is_active: boolean;
          last_synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          platform: "instagram" | "vk" | "telegram";
          external_id: string;
          username?: string | null;
          name?: string | null;
          profile_picture_url?: string | null;
          followers_count?: number;
          media_count?: number;
          is_active?: boolean;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          platform?: "instagram" | "vk" | "telegram";
          external_id?: string;
          username?: string | null;
          name?: string | null;
          profile_picture_url?: string | null;
          followers_count?: number;
          media_count?: number;
          is_active?: boolean;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_accounts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      social_account_metrics: {
        Row: {
          id: string;
          social_account_id: string;
          date: string;
          reach: number;
          impressions: number;
          profile_views: number;
          engagements: number;
          accounts_engaged: number;
          follower_count: number;
          follower_growth: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          social_account_id: string;
          date: string;
          reach?: number;
          impressions?: number;
          profile_views?: number;
          engagements?: number;
          accounts_engaged?: number;
          follower_count?: number;
          follower_growth?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          social_account_id?: string;
          date?: string;
          reach?: number;
          impressions?: number;
          profile_views?: number;
          engagements?: number;
          accounts_engaged?: number;
          follower_count?: number;
          follower_growth?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_account_metrics_social_account_id_fkey";
            columns: ["social_account_id"];
            isOneToOne: false;
            referencedRelation: "social_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      social_posts: {
        Row: {
          id: string;
          social_account_id: string;
          external_id: string;
          caption: string | null;
          media_type: string | null;
          media_url: string | null;
          thumbnail_url: string | null;
          permalink: string | null;
          published_at: string;
          reach: number;
          impressions: number;
          views: number;
          likes: number;
          comments: number;
          saved: number;
          shares: number;
          engagements: number;
          last_synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          social_account_id: string;
          external_id: string;
          caption?: string | null;
          media_type?: string | null;
          media_url?: string | null;
          thumbnail_url?: string | null;
          permalink?: string | null;
          published_at: string;
          reach?: number;
          impressions?: number;
          views?: number;
          likes?: number;
          comments?: number;
          saved?: number;
          shares?: number;
          engagements?: number;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          social_account_id?: string;
          external_id?: string;
          caption?: string | null;
          media_type?: string | null;
          media_url?: string | null;
          thumbnail_url?: string | null;
          permalink?: string | null;
          published_at?: string;
          reach?: number;
          impressions?: number;
          views?: number;
          likes?: number;
          comments?: number;
          saved?: number;
          shares?: number;
          engagements?: number;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_posts_social_account_id_fkey";
            columns: ["social_account_id"];
            isOneToOne: false;
            referencedRelation: "social_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      client_reports: {
        Row: {
          id: string;
          project_id: string;
          public_token: string;
          title: string | null;
          is_active: boolean;
          show_organic: boolean;
          show_ads: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          public_token?: string;
          title?: string | null;
          is_active?: boolean;
          show_organic?: boolean;
          show_ads?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          public_token?: string;
          title?: string | null;
          is_active?: boolean;
          show_organic?: boolean;
          show_ads?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_reports_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      client_report_payload: {
        Args: { p_token: string; p_since: string; p_until: string };
        Returns: Json;
      };
      // Свод по кампаниям за период (миграция 0014): одна строка на кампанию,
      // конверсии по всем целям — массивом в jsonb.
      ad_campaign_period_summary: {
        Args: { p_since: string; p_until: string };
        Returns: {
          campaign_id: string;
          spend: number;
          impressions: number;
          clicks: number;
          reach: number;
          conversions: {
            action_type: string;
            count: number;
            value: number;
          }[];
        }[];
      };
      // Временной ряд для графиков (миграция 0016): бакеты day/week/month,
      // конверсии по одной выбранной цели p_action_type. Фильтры необязательны.
      ad_timeseries: {
        Args: {
          p_since: string;
          p_until: string;
          p_granularity: string;
          p_project_id?: string | null;
          p_account_id?: string | null;
          p_campaign_id?: string | null;
          p_action_type?: string | null;
        };
        Returns: {
          bucket: string;
          spend: number;
          impressions: number;
          clicks: number;
          conversions: number;
          conv_value: number;
        }[];
      };
      // Свод по группам объявлений за период (миграция 0019): строка на группу
      // + campaign_id для дерева. Конверсии — массивом jsonb.
      ad_set_period_summary: {
        Args: { p_since: string; p_until: string };
        Returns: {
          adset_id: string;
          campaign_id: string;
          spend: number;
          impressions: number;
          clicks: number;
          reach: number;
          conversions: {
            action_type: string;
            count: number;
            value: number;
          }[];
        }[];
      };
      // Свод по объявлениям за период (миграция 0019): строка на объявление
      // + adset_id для дерева. Конверсии — массивом jsonb.
      ad_ad_period_summary: {
        Args: { p_since: string; p_until: string };
        Returns: {
          ad_id: string;
          adset_id: string;
          spend: number;
          impressions: number;
          clicks: number;
          reach: number;
          conversions: {
            action_type: string;
            count: number;
            value: number;
          }[];
        }[];
      };
    };
    Enums: {
      user_role: "owner" | "pm" | "specialist" | "viewer";
      project_health: "green" | "yellow" | "red";
      project_stage: "active" | "paused" | "finished";
      client_status: "active" | "paused" | "churned";
      task_status:
        | "backlog"
        | "todo"
        | "in_progress"
        | "review"
        | "done"
        | "paused";
      task_priority: "low" | "medium" | "high" | "urgent";
      task_type:
        | "ads"
        | "creative"
        | "analytics"
        | "website"
        | "content"
        | "report"
        | "communication"
        | "other";
      note_type: "hypothesis" | "risk" | "history" | "client_note";
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<
  T extends keyof PublicSchema["Tables"],
> = PublicSchema["Tables"][T]["Row"];

export type TablesInsert<
  T extends keyof PublicSchema["Tables"],
> = PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<
  T extends keyof PublicSchema["Tables"],
> = PublicSchema["Tables"][T]["Update"];

export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
