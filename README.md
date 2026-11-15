# PrintPRO

A fast, mobile-friendly, web-based Point-of-Sale (POS) and shop management system designed specifically for **Xerox centres, digital print shops, photocopy studios, and stationery businesses**. Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, and Supabase PostgreSQL with strict multi-tenant Row-Level Security (RLS).

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)

---

## Features

- **High-Speed Counter & Mobile POS (`/billing`)**: Instant entry for custom Xerox/print rates, catalog products, split/shared billing, touch-friendly quantity controls, and a sticky mobile checkout bar.
- **Multi-Tenant Security & Auth Guard (`src/proxy.ts`)**: Server-side Supabase SSR session verification (`supabase.auth.getUser()`), rate-limited API routes, and Row-Level Security (RLS) isolating each shop's data (`auth.uid() = user_id`).
- **Multi-Format Invoice Printing & PDFs (`InvoiceModal.tsx`)**: 1-click printing and vector PDF generation (`jsPDF`) for **80mm Thermal**, **58mm Thermal**, and **Standard A4 Tax Invoices**.
- **WhatsApp & Direct PDF Sharing (`shareUtils.ts`, `receiptService.ts`)**:
  - **Smart Compact** (hides `₹0.00` clutter) and **Full Detailed** emoji-free WhatsApp receipt templates.
  - Direct PDF sharing without local downloads on mobile via the Web Share API (`navigator.share`), with 1-click **Copy Text & Open WhatsApp** / **Download PDF** fallbacks on desktop.
  - Supported across **Invoices**, **Payment Receipts**, **Customer Statements of Account**, and **End-of-Day Reports**.
- **Customer Ledgers, Advance Wallet & Loyalty (`/customers`, `/payments`)**: FIFO payment allocations, advance deposits, running balance ledgers, consolidated Statement of Account PDFs, and loyalty point earn/redeem rules.
- **Accounting, Cash Sessions & Expenses (`/accounting`, `/expenses`)**: Expense tracking, cash/UPI drawer reconciliation, internal transfers, and Net Profit calculations.
- **Business Reports & PDF Preview (`/reports`)**: Today, session, and custom-date analytics with an in-app **PDF Preview Modal** before downloading/sharing, 1-tap **WhatsApp End-of-Day Summary**, and CSV exports.
- **Installable Mobile App (PWA)**: Web app manifest (`src/app/manifest.ts`) and PrintPRO home-screen icons for standalone mobile usage.

---

## System & Data Flow

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                           Next.js 16 App UI                            │
 │   (/billing, /bills, /customers, /payments, /expenses, /reports, ...)  │
 └───────────────────┬───────────────────────────────┬────────────────────┘
                     │                               │
                     ▼                               ▼
 ┌──────────────────────────────────────┐  ┌──────────────────────────────┐
 │      Services (src/lib/services)     │  │   Print, PDF & Share Modals  │
 │ - ApiService (CRUD, FIFO, Loyalty)   │  │ - InvoiceModal (80/58mm, A4) │
 │ - ReceiptService (Compact/Detailed)  │  │ - CustomerStatementModal     │
 │ - PDF Generators (jsPDF)             │  │ - PaymentReceiptModal        │
 └───────────────────┬──────────────────┘  │ - Web Share API / WhatsApp   │
                     │                     └──────────────────────────────┘
                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Supabase PostgreSQL Database                      │
 │  sequences (RPC) · bills & bill_items · payments · customers           │
 │  expenses · accounting_closings · loyalty_transactions · audit_logs    │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **Icons & Charts**: Lucide React, Recharts
- **PDF & Export**: jsPDF, html2canvas
- **Testing**: Vitest (unit), Playwright (E2E)
- **Database & Auth**: Supabase PostgreSQL with RLS

---

## Getting Started

### Prerequisites

- Node.js 22.x (or 20.19+)
- npm
- A [Supabase](https://supabase.com) project

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/RR-Alen-06/PrintPro.git
cd PrintPro
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables include `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (for server routes) `SUPABASE_SERVICE_ROLE_KEY` and EmailJS keys if using email dispatch.

### 3. Initialize Database Schema

Apply `schema.sql` and the migrations in [`supabase/migrations`](./supabase/migrations) via the Supabase SQL Editor or `supabase db push`.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start Next.js development server |
| `npm run build` | Build production bundle |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Run TypeScript typecheck |
| `npm test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run clean` | Remove `.next` build directory |

---

## Project Structure

```text
Print-Service/
├── public/                    # Static assets & PWA icons (logo.png, icon-192.png, icon-512.png)
├── supabase/migrations/       # PostgreSQL DDL, RPCs, triggers, and RLS policies
├── tests/                     # Vitest unit tests & Playwright E2E tests
├── src/
│   ├── proxy.ts               # Server-side Supabase SSR auth guard
│   ├── app/
│   │   ├── accounting/        # Cash sessions, drawer reconciliation & P&L ledger
│   │   ├── api/               # Server API routes (email, PIN verification)
│   │   ├── audit/             # Immutable audit log viewer
│   │   ├── billing/           # POS billing counter (single, split, shared)
│   │   ├── bills/             # Invoice management & admin adjustments
│   │   ├── customers/         # Customer directory & [id] running ledger
│   │   ├── expenses/          # Expense tracking & category charts
│   │   ├── login/             # Authentication page
│   │   ├── payments/          # Customer payment collection
│   │   ├── products/          # Catalog product & pricing management
│   │   ├── reports/           # Business reports, PDF preview & WhatsApp summary
│   │   ├── settings/          # Shop configuration, sequences & loyalty rules
│   │   ├── icon.png           # App favicon
│   │   ├── apple-icon.png     # iOS home screen icon
│   │   ├── manifest.ts        # PWA web manifest
│   │   ├── layout.tsx         # Root layout & metadata
│   │   └── page.tsx           # Dashboard & financial overview
│   ├── components/
│   │   ├── CustomerStatementModal.tsx
│   │   ├── InvoiceModal.tsx
│   │   ├── Navigation.tsx
│   │   └── PaymentReceiptModal.tsx
│   └── lib/
│       ├── services/          # api.ts, receiptService.ts, PDF generators, rateLimit.ts
│       ├── supabase/          # Supabase client & server helpers
│       ├── utils/             # shareUtils.ts, csv.ts, format.ts
│       └── types.ts           # TypeScript domain models
└── README.md
```

---

## License

This project is open-source and available under the [MIT License](LICENSE).
