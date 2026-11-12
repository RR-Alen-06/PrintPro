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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accounting_closings: {
        Row: {
          actual_cash: number | null
          actual_upi: number | null
          advance_received: number | null
          advance_utilized: number | null
          cash_difference: number | null
          cash_inflow: number | null
          cash_outflow: number | null
          closed_at: string | null
          closed_by: string | null
          closing_advance_pool: number | null
          closing_date: string
          closing_month: string | null
          closing_number: string | null
          closing_type: string
          created_at: string
          denominations: Json | null
          discrepancy_note: string | null
          expected_cash: number | null
          expected_upi: number | null
          from_date: string | null
          id: string
          is_locked: boolean | null
          notes: string | null
          opening_advance_pool: number | null
          opening_cash: number | null
          opening_upi: number | null
          status: string
          to_date: string | null
          transfers_cash_to_upi: number | null
          transfers_upi_to_cash: number | null
          updated_at: string
          upi_difference: number | null
          upi_inflow: number | null
          upi_outflow: number | null
          user_id: string | null
        }
        Insert: {
          actual_cash?: number | null
          actual_upi?: number | null
          advance_received?: number | null
          advance_utilized?: number | null
          cash_difference?: number | null
          cash_inflow?: number | null
          cash_outflow?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_advance_pool?: number | null
          closing_date: string
          closing_month?: string | null
          closing_number?: string | null
          closing_type: string
          created_at?: string
          denominations?: Json | null
          discrepancy_note?: string | null
          expected_cash?: number | null
          expected_upi?: number | null
          from_date?: string | null
          id?: string
          is_locked?: boolean | null
          notes?: string | null
          opening_advance_pool?: number | null
          opening_cash?: number | null
          opening_upi?: number | null
          status?: string
          to_date?: string | null
          transfers_cash_to_upi?: number | null
          transfers_upi_to_cash?: number | null
          updated_at?: string
          upi_difference?: number | null
          upi_inflow?: number | null
          upi_outflow?: number | null
          user_id?: string | null
        }
        Update: {
          actual_cash?: number | null
          actual_upi?: number | null
          advance_received?: number | null
          advance_utilized?: number | null
          cash_difference?: number | null
          cash_inflow?: number | null
          cash_outflow?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_advance_pool?: number | null
          closing_date?: string
          closing_month?: string | null
          closing_number?: string | null
          closing_type?: string
          created_at?: string
          denominations?: Json | null
          discrepancy_note?: string | null
          expected_cash?: number | null
          expected_upi?: number | null
          from_date?: string | null
          id?: string
          is_locked?: boolean | null
          notes?: string | null
          opening_advance_pool?: number | null
          opening_cash?: number | null
          opening_upi?: number | null
          status?: string
          to_date?: string | null
          transfers_cash_to_upi?: number | null
          transfers_upi_to_cash?: number | null
          updated_at?: string
          upi_difference?: number | null
          upi_inflow?: number | null
          upi_outflow?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
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
            foreignKeyName: "fk_bill_items_bill"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bill_items_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          advance_earned: number
          advance_used: number
          bill_number: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          card_paid: number
          cash_paid: number
          created_at: string
          customer_id: string | null
          discount: number
          edit_reason: string | null
          edited_at: string | null
          edited_by: string | null
          grand_total: number
          group_bill_id: string | null
          group_role: string | null
          gst_amount: number
          id: string
          loyalty_points_earned: number
          loyalty_points_redeemed: number
          notes: string | null
          paid_by_customer_id: string | null
          paid_total: number
          payment_method: string
          rounding_adjustment: number
          rounding_method: string
          status: string | null
          total: number
          upi_paid: number
          user_id: string | null
        }
        Insert: {
          advance_earned?: number
          advance_used?: number
          bill_number: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          card_paid?: number
          cash_paid?: number
          created_at?: string
          customer_id?: string | null
          discount?: number
          edit_reason?: string | null
          edited_at?: string | null
          edited_by?: string | null
          grand_total?: number
          group_bill_id?: string | null
          group_role?: string | null
          gst_amount?: number
          id?: string
          loyalty_points_earned?: number
          loyalty_points_redeemed?: number
          notes?: string | null
          paid_by_customer_id?: string | null
          paid_total?: number
          payment_method?: string
          rounding_adjustment?: number
          rounding_method?: string
          status?: string | null
          total?: number
          upi_paid?: number
          user_id?: string | null
        }
        Update: {
          advance_earned?: number
          advance_used?: number
          bill_number?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          card_paid?: number
          cash_paid?: number
          created_at?: string
          customer_id?: string | null
          discount?: number
          edit_reason?: string | null
          edited_at?: string | null
          edited_by?: string | null
          grand_total?: number
          group_bill_id?: string | null
          group_role?: string | null
          gst_amount?: number
          id?: string
          loyalty_points_earned?: number
          loyalty_points_redeemed?: number
          notes?: string | null
          paid_by_customer_id?: string | null
          paid_total?: number
          payment_method?: string
          rounding_adjustment?: number
          rounding_method?: string
          status?: string | null
          total?: number
          upi_paid?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_bills_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bills_group_bill"
            columns: ["group_bill_id"]
            isOneToOne: false
            referencedRelation: "group_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bills_paid_by"
            columns: ["paid_by_customer_id"]
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
          category?: string
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
      group_bill_items: {
        Row: {
          created_at: string
          group_bill_id: string
          id: string
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          total: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          group_bill_id: string
          id?: string
          price: number
          product_id?: string | null
          product_name: string
          quantity: number
          total: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          group_bill_id?: string
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
            foreignKeyName: "fk_group_bill_items_group"
            columns: ["group_bill_id"]
            isOneToOne: false
            referencedRelation: "group_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_group_bill_items_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      group_bills: {
        Row: {
          balance_due: number
          billing_type: string
          created_at: string
          discount: number
          grand_total: number
          group_bill_number: string
          id: string
          notes: string | null
          paid_amount: number
          participant_count: number
          primary_payer_id: string | null
          status: string
          total_amount: number
          user_id: string | null
        }
        Insert: {
          balance_due?: number
          billing_type: string
          created_at?: string
          discount?: number
          grand_total?: number
          group_bill_number: string
          id?: string
          notes?: string | null
          paid_amount?: number
          participant_count?: number
          primary_payer_id?: string | null
          status?: string
          total_amount?: number
          user_id?: string | null
        }
        Update: {
          balance_due?: number
          billing_type?: string
          created_at?: string
          discount?: number
          grand_total?: number
          group_bill_number?: string
          id?: string
          notes?: string | null
          paid_amount?: number
          participant_count?: number
          primary_payer_id?: string | null
          status?: string
          total_amount?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_group_bills_primary_payer"
            columns: ["primary_payer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_transfers: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          direction: string
          id: string
          reason: string
          transfer_date: string
          transfer_number: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          direction: string
          id?: string
          reason: string
          transfer_date?: string
          transfer_number?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          reason?: string
          transfer_date?: string
          transfer_number?: string | null
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
            foreignKeyName: "fk_loyalty_tx_bill"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_loyalty_tx_customer"
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
          created_at: string
          customer_id: string | null
          id: string
          notes: string | null
          payment_method: string
          payment_number: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          bill_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          payment_number?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          payment_number?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_payments_bill"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_payments_customer"
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
          id: string
          key: string
          padding: number
          prefix: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          current_val?: number
          id?: string
          key: string
          padding?: number
          prefix: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          current_val?: number
          id?: string
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
          id: string
          key: string
          updated_at: string
          user_id: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          user_id?: string | null
          value: Json
        }
        Update: {
          id?: string
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
      get_next_sequence_code: {
        Args: {
          p_entity_type: string
          p_padding?: number
          p_prefix: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      bill_status: "unpaid" | "partial" | "paid" | "cancelled"
      customer_type: "regular" | "random"
      discount_type: "percent" | "flat"
      payment_type: "full" | "partial" | "refund" | "reversal"
      print_type: "color" | "bw"
      sides_type: "single" | "double"
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
    Enums: {
      bill_status: ["unpaid", "partial", "paid", "cancelled"],
      customer_type: ["regular", "random"],
      discount_type: ["percent", "flat"],
      payment_type: ["full", "partial", "refund", "reversal"],
      print_type: ["color", "bw"],
      sides_type: ["single", "double"],
    },
  },
} as const
