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
          closing_date: string | null
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
          closing_date?: string | null
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
          closing_date?: string | null
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
          }
        ]
      }
      bills: {
        Row: {
          advance_earned: number | null
          advance_used: number | null
          bill_number: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          card_paid: number | null
          cash_paid: number | null
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
          loyalty_points_earned: number | null
          loyalty_points_redeemed: number | null
          notes: string | null
          paid_amount: number
          paid_by_customer_id: string | null
          paid_total: number | null
          payment_method: string
          rounding_adjustment: number | null
          rounding_method: string | null
          status: string | null
          total: number
          upi_paid: number | null
          user_id: string | null
        }
        Insert: {
          advance_earned?: number | null
          advance_used?: number | null
          bill_number: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          card_paid?: number | null
          cash_paid?: number | null
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
          loyalty_points_earned?: number | null
          loyalty_points_redeemed?: number | null
          notes?: string | null
          paid_amount?: number
          paid_by_customer_id?: string | null
          paid_total?: number | null
          payment_method?: string
          rounding_adjustment?: number | null
          rounding_method?: string | null
          status?: string | null
          total?: number
          upi_paid?: number | null
          user_id?: string | null
        }
        Update: {
          advance_earned?: number | null
          advance_used?: number | null
          bill_number?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          card_paid?: number | null
          cash_paid?: number | null
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
          loyalty_points_earned?: number | null
          loyalty_points_redeemed?: number | null
          notes?: string | null
          paid_amount?: number
          paid_by_customer_id?: string | null
          paid_total?: number | null
          payment_method?: string
          rounding_adjustment?: number | null
          rounding_method?: string | null
          status?: string | null
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
          }
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
          billing_type?: string
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
          }
        ]
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
          price?: number
          product_id?: string | null
          product_name: string
          quantity?: number
          total?: number
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
          }
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
          amount?: number
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
          applicable_product_category: string | null
          created_at: string
          enabled: boolean
          id: string
          minimum_bill_amount: number
          points_per_currency_unit: number
          rule_type: string
          user_id: string | null
        }
        Insert: {
          applicable_product_category?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          minimum_bill_amount: number
          points_per_currency_unit: number
          rule_type: string
          user_id?: string | null
        }
        Update: {
          applicable_product_category?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          minimum_bill_amount?: number
          points_per_currency_unit?: number
          rule_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          bill_id: string | null
          created_at: string
          customer_id: string
          description: string | null
          id: string
          points: number
          transaction_type: string
          user_id: string | null
        }
        Insert: {
          bill_id?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          points: number
          transaction_type: string
          user_id?: string | null
        }
        Update: {
          bill_id?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          points?: number
          transaction_type?: string
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
          }
        ]
      }
      payments: {
        Row: {
          amount: number
          bill_id: string | null
          created_at: string
          customer_id: string
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
          customer_id: string
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
          customer_id?: string
          id?: string
          notes?: string | null
          payment_method?: string
          payment_number?: string | null
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
          }
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
