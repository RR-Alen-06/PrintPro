export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          audit_number: string | null
          created_at: string
          entity: string
          id: string
          new_value: string | null
          previous_value: string | null
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          audit_number?: string | null
          created_at?: string
          entity: string
          id?: string
          new_value?: string | null
          previous_value?: string | null
          user_id?: string | null
          user_name?: string
        }
        Update: {
          action?: string
          audit_number?: string | null
          created_at?: string
          entity?: string
          id?: string
          new_value?: string | null
          previous_value?: string | null
          user_id?: string | null
          user_name?: string
        }
        Relationships: []
      }
      bill_items: {
        Row: {
          bill_id: string
          created_at: string
          id: string
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          total: number
          user_id: string | null
        }
        Insert: {
          bill_id: string
          created_at?: string
          id?: string
          price: number
          product_id?: string | null
          product_name: string
          quantity: number
          total: number
          user_id?: string | null
        }
        Update: {
          bill_id?: string
          created_at?: string
          id?: string
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          total?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          advance_earned: number | null
          advance_used: number | null
          bill_number: string
          card_paid: number | null
          cash_paid: number | null
          created_at: string
          customer_id: string | null
          discount: number
          edit_reason: string | null
          edited_at: string | null
          edited_by: string | null
          grand_total: number
          gst_amount: number
          id: string
          loyalty_points_earned: number | null
          loyalty_points_redeemed: number | null
          paid_amount: number
          paid_total: number | null
          payment_method: string
          rounding_adjustment: number | null
          rounding_method: string | null
          total: number
          upi_paid: number | null
          user_id: string | null
        }
        Insert: {
          advance_earned?: number | null
          advance_used?: number | null
          bill_number: string
          card_paid?: number | null
          cash_paid?: number | null
          created_at?: string
          customer_id?: string | null
          discount?: number
          edit_reason?: string | null
          edited_at?: string | null
          edited_by?: string | null
          grand_total?: number
          gst_amount?: number
          id?: string
          loyalty_points_earned?: number | null
          loyalty_points_redeemed?: number | null
          paid_amount?: number
          paid_total?: number | null
          payment_method?: string
          rounding_adjustment?: number | null
          rounding_method?: string | null
          total?: number
          upi_paid?: number | null
          user_id?: string | null
        }
        Update: {
          advance_earned?: number | null
          advance_used?: number | null
          bill_number?: string
          card_paid?: number | null
          cash_paid?: number | null
          created_at?: string
          customer_id?: string | null
          discount?: number
          edit_reason?: string | null
          edited_at?: string | null
          edited_by?: string | null
          grand_total?: number
          gst_amount?: number
          id?: string
          loyalty_points_earned?: number | null
          loyalty_points_redeemed?: number | null
          paid_amount?: number
          paid_total?: number | null
          payment_method?: string
          rounding_adjustment?: number | null
          rounding_method?: string | null
          total?: number
          upi_paid?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          advance_balance: number
          created_at: string
          customer_code: string | null
          email: string | null
          id: string
          loyalty_points: number
          mobile: string | null
          name: string
          user_id: string | null
        }
        Insert: {
          advance_balance?: number
          created_at?: string
          customer_code?: string | null
          email?: string | null
          id?: string
          loyalty_points?: number
          mobile?: string | null
          name: string
          user_id?: string | null
        }
        Update: {
          advance_balance?: number
          created_at?: string
          customer_code?: string | null
          email?: string | null
          id?: string
          loyalty_points?: number
          mobile?: string | null
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          expense_number: string | null
          id: string
          notes: string | null
          payment_mode: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          expense_number?: string | null
          id?: string
          notes?: string | null
          payment_mode?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          expense_number?: string | null
          id?: string
          notes?: string | null
          payment_mode?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      loyalty_redemption_rules: {
        Row: {
          created_at: string
          discount_amount: number
          enabled: boolean
          id: string
          points_required: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          discount_amount: number
          enabled?: boolean
          id?: string
          points_required: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          discount_amount?: number
          enabled?: boolean
          id?: string
          points_required?: number
          user_id?: string | null
        }
        Relationships: []
      }
      loyalty_rules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          max_bill_amount: number | null
          min_bill_amount: number
          points_earned: number
          reward_type: string | null
          reward_value: number | null
          rule_name: string
          sort_order: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          max_bill_amount?: number | null
          min_bill_amount?: number
          points_earned?: number
          reward_type?: string | null
          reward_value?: number | null
          rule_name: string
          sort_order?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          max_bill_amount?: number | null
          min_bill_amount?: number
          points_earned?: number
          reward_type?: string | null
          reward_value?: number | null
          rule_name?: string
          sort_order?: number
          user_id?: string | null
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          bill_id: string | null
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          points: number
          transaction_number: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          bill_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          points: number
          transaction_number?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          bill_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          points?: number
          transaction_number?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bill_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          payment_method: string
          payment_number: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          bill_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          payment_method?: string
          payment_number?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          payment_method?: string
          payment_number?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          price: number
          product_code: string | null
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          name: string
          price?: number
          product_code?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          price?: number
          product_code?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sequences: {
        Row: {
          current_val: number
          key: string
          padding: number
          prefix: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          current_val?: number
          key: string
          padding?: number
          prefix: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          current_val?: number
          key?: string
          padding?: number
          prefix?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          user_id: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          user_id?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          user_id?: string | null
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_next_sequence: { Args: { p_key: string }; Returns: string }
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
