# SimpleBilling (PrintPro ERP) 🖨️🧾

A fast, robust, web-based Point-of-Sale (POS) and shop management system designed specifically for **Xerox centres, digital print shops, photocopy studios, and stationery businesses**. Built with Next.js 16 (App Router), TypeScript, Tailwind CSS, and Supabase PostgreSQL with strict multi-tenant Row-Level Security (RLS).

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)

---

## 📖 About The Project

Traditional billing software is rigid when handling dynamic printing jobs (such as custom per-page copy counts, variable lamination/binding rates, split payment methods, customer advances, and loyalty points). **SimpleBilling** solves this by providing:

- ⚡ **High-Speed Counter POS**: Instant entry for custom Xerox/print rates and catalog products.
- 🔒 **Multi-Tenant Security**: Strict Row-Level Security (RLS) policies on Supabase PostgreSQL isolating each shop's data (`auth.uid() = user_id`).
- 🧾 **Dual-Mode Invoice Printing**: 1-click printing for **80mm Thermal POS Receipts** and **Standard A4 Tax Invoices**, plus PDF generation via `jsPDF`.
- 👥 **Customer Ledgers & Dues Engine**: FIFO payment allocations, advance deposits, running balance ledgers, and dynamic loyalty point rewards.
- 💳 **Customer Advance Wallet & Ledger Reconciliation**: 1-click allocation of surplus advance balances to outstanding bills, cash drawer isolation, and automated ledger recalculation.
- 💰 **Accounting & Expense Tracking**: Expense category breakdown, period P&L synchronization, and Net Profit calculations.
- 📊 **Business Reports & CSV Export**: Sales analytics, item volume tracking, and 1-click CSV report exports.

---

## 🏗️ System & Data Flow Architecture

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                              Next.js 16 UI                             │
 │   (/billing, /customers, /expenses, /reports, /settings, /bills)       │
 └───────────────────┬───────────────────────────────┬────────────────────┘
                     │ (1. User Input)               │ (7. Print / Share)
                     ▼                               ▼
 ┌──────────────────────────────────────┐  ┌──────────────────────────────┐
 │     ApiService (src/lib/services)    │  │       InvoiceModal.tsx       │
 │ - Loyalty Engine (Earn/Redeem Rules) │  │ - 80mm Thermal Receipt View  │
 │ - Rounding Engine (Floor/Ceil/Std)   │  │ - Standard A4 Tax Invoice    │
 │ - FIFO Payment & Advance Allocator   │  │ - PDF Generator (jsPDF/html2)│
 └───────────────────┬──────────────────┘  │ - WhatsApp Direct URL Link   │
                     │ (2. PostgREST API)  │ - EmailJS Customer Dispatch  │
                     ▼                     └──────────────────────────────┘
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Supabase PostgreSQL Database                      │
 │ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐ │
 │ │  sequences (RPC) │ │ bills & items    │ │ payments (Ledger)        │ │
 │ │  customers       │ │ expenses         │ │ loyalty_transactions     │ │
 │ └──────────────────┘ └──────────────────┘ └──────────────────────────┘ │
 └────────────────────────────────────────────────────────────────────────┘
```

### How Data Flows Through SimpleBilling

1. **Authentication Guard (`src/middleware.ts`)**:
   - Server-side verification via Supabase SSR (`supabase.auth.getUser()`).
   - Unauthenticated requests are redirected to `/login`.
2. **POS Billing Workflow (`/billing`)**:
   - The cashier adds print jobs or catalog products with custom quantities and unit rates.
   - Calculates $\text{Subtotal}$, $\text{Loyalty/Manual Discount}$, $\text{GST}$, and applies the selected $\text{Rounding Method}$.
   - Invokes PostgreSQL function `get_next_sequence('BILL')` to atomically generate unique sequential identifiers (`BILL-000001`).
   - If a customer overpays, surplus funds are allocated via FIFO to settle earlier outstanding bills, with any remainder credited to `customers.advance_balance`.
   - Inserts records into `bills`, `bill_items`, `payments`, and logs to immutable `audit_logs`.
3. **Invoice Rendering & Dispatch (`InvoiceModal.tsx`)**:
   - Automatically adapts layout to **80mm Thermal POS** or **Standard A4 Invoice**.
   - Generates client-side single-page PDFs using `html2canvas` and `jsPDF`.
   - Supports 1-click invoice sharing via WhatsApp URL schemes or EmailJS.
4. **Customer Ledger Reconciliation (`/customers/[id]`)**:
   - Reconstructs running balances from historical `bills` and `payments`.
5. **P&L Accounting Engine (`/expenses`)**:
   - Calculates $\text{Net Profit} = \text{Total Income} - \text{Total Expenses}$ synchronized across date filters.

---

## 🚀 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Charts**: Recharts
- **PDF & Export**: jsPDF, html2canvas
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS)

---

## 🛠️ Getting Started

### Prerequisites

- Node.js (v18.x or higher)
- npm or pnpm
- A [Supabase](https://supabase.com) project

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/RR-Alen-06/SimpleBilling.git
cd SimpleBilling
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Initialize Database Schema

1. Open your Supabase Dashboard.
2. Navigate to the **SQL Editor**.
3. Run the contents of [`schema.sql`](./schema.sql).

This initializes all tables (`sequences`, `customers`, `products`, `bills`, `bill_items`, `payments`, `expenses`, `settings`, `audit_logs`, `loyalty_rules`, `loyalty_redemption_rules`), indexes, and configures multi-tenant Row-Level Security policies.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```text
SimpleBilling/
├── schema.sql                 # PostgreSQL DDL, triggers, and multi-tenant RLS policies
├── src/
│   ├── middleware.ts          # Server-side Supabase SSR session validation
│   ├── app/
│   │   ├── accounting/        # Cash sessions, drawer reconciliation & P&L ledger
│   │   ├── audit/             # Immutable audit log viewer
│   │   ├── billing/           # POS Billing counter with live price calculations
│   │   ├── bills/             # Invoice management & admin adjustments
│   │   ├── customers/         # Customer directory & [id] running ledger
│   │   ├── expenses/          # Accounting suite, category charts & P&L
│   │   ├── login/             # Admin authentication
│   │   ├── payments/          # Standalone customer payment collection
│   │   ├── products/          # Catalog product & pricing management
│   │   ├── reports/           # Sales reports & CSV export
│   │   ├── settings/          # Shop configuration, sequences, and loyalty rules
│   │   ├── error.tsx          # Root Error Boundary for runtime resilience
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Dashboard & financial reconciliation
│   ├── components/
│   │   ├── InvoiceModal.tsx    # Dual-mode (80mm / A4) print & PDF modal
│   │   ├── Navigation.tsx      # Responsive navigation bar
│   │   └── SupabaseBanner.tsx  # Database connection status indicator
│   └── lib/
│       ├── constants/filters.ts# Shared date filter button configurations
│       ├── services/api.ts    # Supabase CRUD API service layer
│       ├── supabase/client.ts # Supabase client initialization
│       ├── utils/
│       │   ├── csv.ts         # Shared CSV export & download engine
│       │   └── format.ts      # Centralized currency & date formatters
│       └── types.ts           # TypeScript interfaces & domain models
└── README.md
```

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).