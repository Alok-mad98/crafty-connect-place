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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_config: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      agent_memory: {
        Row: {
          content: Json
          created_at: string
          id: string
          memory_type: string
          user_wallet: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          memory_type?: string
          user_wallet: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          memory_type?: string
          user_wallet?: string
        }
        Relationships: []
      }
      agent_wallets: {
        Row: {
          agent_wallet_address: string
          agent_wallet_id: string
          created_at: string
          id: string
          network: string
          user_wallet: string
        }
        Insert: {
          agent_wallet_address: string
          agent_wallet_id: string
          created_at?: string
          id?: string
          network?: string
          user_wallet: string
        }
        Update: {
          agent_wallet_address?: string
          agent_wallet_id?: string
          created_at?: string
          id?: string
          network?: string
          user_wallet?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          buyer_wallet: string
          created_at: string
          id: string
          skill_id: string
          tx_hash: string | null
        }
        Insert: {
          buyer_wallet: string
          created_at?: string
          id?: string
          skill_id: string
          tx_hash?: string | null
        }
        Update: {
          buyer_wallet?: string
          created_at?: string
          id?: string
          skill_id?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          active: boolean
          created_at: string
          creator_wallet: string
          description: string
          id: string
          ipfs_cid: string
          model_tags: string[]
          onchain_id: number | null
          price: number
          title: string
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          creator_wallet: string
          description: string
          id?: string
          ipfs_cid: string
          model_tags?: string[]
          onchain_id?: number | null
          price: number
          title: string
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          creator_wallet?: string
          description?: string
          id?: string
          ipfs_cid?: string
          model_tags?: string[]
          onchain_id?: number | null
          price?: number
          title?: string
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      twitter_mentions: {
        Row: {
          author_handle: string
          author_id: string | null
          created_at: string
          id: string
          processed_at: string | null
          response_tweet_id: string | null
          skill_id: string | null
          status: string
          text: string
          tweet_id: string
        }
        Insert: {
          author_handle: string
          author_id?: string | null
          created_at?: string
          id?: string
          processed_at?: string | null
          response_tweet_id?: string | null
          skill_id?: string | null
          status?: string
          text: string
          tweet_id: string
        }
        Update: {
          author_handle?: string
          author_id?: string | null
          created_at?: string
          id?: string
          processed_at?: string | null
          response_tweet_id?: string | null
          skill_id?: string | null
          status?: string
          text?: string
          tweet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twitter_mentions_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
