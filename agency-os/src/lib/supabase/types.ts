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
          responsible_id: string | null;
          short_comment: string | null;
          links: Json | null;
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
          responsible_id?: string | null;
          short_comment?: string | null;
          links?: Json | null;
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
          responsible_id?: string | null;
          short_comment?: string | null;
          links?: Json | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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
