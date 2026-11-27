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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      character_animation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          image_path: string
          output_url: string | null
          owner_id: string
          prediction_id: string | null
          prompt: string
          request_id: string
          settings: Json
          signed_input_url: string | null
          state: string
          updated_at: string
          video_path: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          image_path: string
          output_url?: string | null
          owner_id: string
          prediction_id?: string | null
          prompt: string
          request_id: string
          settings?: Json
          signed_input_url?: string | null
          state?: string
          updated_at?: string
          video_path?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          image_path?: string
          output_url?: string | null
          owner_id?: string
          prediction_id?: string | null
          prompt?: string
          request_id?: string
          settings?: Json
          signed_input_url?: string | null
          state?: string
          updated_at?: string
          video_path?: string | null
        }
        Relationships: []
      }
      character_film_shots: {
        Row: {
          action: string
          animation_id: string | null
          board_end_path: string | null
          board_start_path: string | null
          chapter: number
          correction_attempts: number
          direction: Json | null
          duration: number
          error: string | null
          film_id: string
          frame_check: Json | null
          frame_job_id: string | null
          frame_path: string | null
          id: string
          image_path: string
          index: number
          line: string
          owner_id: string
          purpose: string
          request_id: string
          state: string
          transition: string
          video_path: string | null
          visual: string
        }
        Insert: {
          action: string
          animation_id?: string | null
          board_end_path?: string | null
          board_start_path?: string | null
          chapter: number
          correction_attempts?: number
          direction?: Json | null
          duration: number
          error?: string | null
          film_id: string
          frame_check?: Json | null
          frame_job_id?: string | null
          frame_path?: string | null
          id?: string
          image_path: string
          index: number
          line: string
          owner_id: string
          purpose: string
          request_id?: string
          state?: string
          transition: string
          video_path?: string | null
          visual: string
        }
        Update: {
          action?: string
          animation_id?: string | null
          board_end_path?: string | null
          board_start_path?: string | null
          chapter?: number
          correction_attempts?: number
          direction?: Json | null
          duration?: number
          error?: string | null
          film_id?: string
          frame_check?: Json | null
          frame_job_id?: string | null
          frame_path?: string | null
          id?: string
          image_path?: string
          index?: number
          line?: string
          owner_id?: string
          purpose?: string
          request_id?: string
          state?: string
          transition?: string
          video_path?: string | null
          visual?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_film_shots_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "character_films"
            referencedColumns: ["id"]
          },
        ]
      }
      character_films: {
        Row: {
          audio_mode: string
          chapters: Json
          created_at: string
          error: string | null
          estimated_usd: number
          final_video_path: string | null
          id: string
          image_path: string
          lease_token: string | null
          lease_until: string | null
          narration: Json
          owner_id: string
          preparation: Json | null
          request_id: string
          scenes: Json
          script: string
          seconds: number
          state: string
          title: string
          updated_at: string
        }
        Insert: {
          audio_mode: string
          chapters?: Json
          created_at?: string
          error?: string | null
          estimated_usd: number
          final_video_path?: string | null
          id?: string
          image_path: string
          lease_token?: string | null
          lease_until?: string | null
          narration?: Json
          owner_id: string
          preparation?: Json | null
          request_id: string
          scenes?: Json
          script: string
          seconds: number
          state?: string
          title: string
          updated_at?: string
        }
        Update: {
          audio_mode?: string
          chapters?: Json
          created_at?: string
          error?: string | null
          estimated_usd?: number
          final_video_path?: string | null
          id?: string
          image_path?: string
          lease_token?: string | null
          lease_until?: string | null
          narration?: Json
          owner_id?: string
          preparation?: Json | null
          request_id?: string
          scenes?: Json
          script?: string
          seconds?: number
          state?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      explainer_exports: {
        Row: {
          created_at: string
          error: string | null
          format: string
          host: string
          id: string
          lease: string | null
          lease_until: string | null
          operation: string | null
          output_path: string | null
          owner_id: string
          progress: string
          scenes: Json
          seconds: number
          state: string
          topic: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          format: string
          host: string
          id: string
          lease?: string | null
          lease_until?: string | null
          operation?: string | null
          output_path?: string | null
          owner_id?: string
          progress?: string
          scenes?: Json
          seconds: number
          state?: string
          topic: string
        }
        Update: {
          created_at?: string
          error?: string | null
          format?: string
          host?: string
          id?: string
          lease?: string | null
          lease_until?: string | null
          operation?: string | null
          output_path?: string | null
          owner_id?: string
          progress?: string
          scenes?: Json
          seconds?: number
          state?: string
          topic?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_character_film: {
        Args: { p_id: string; p_token: string }
        Returns: boolean
      }
      claim_explainer_export: {
        Args: { token: string }
        Returns: {
          created_at: string
          error: string | null
          format: string
          host: string
          id: string
          lease: string | null
          lease_until: string | null
          operation: string | null
          output_path: string | null
          owner_id: string
          progress: string
          scenes: Json
          seconds: number
          state: string
          topic: string
        }[]
        SetofOptions: {
          from: "*"
          to: "explainer_exports"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      install_character_film_chapter: {
        Args: {
          p_chapter: number
          p_id: string
          p_owner: string
          p_scenes: Json
          p_shots: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
