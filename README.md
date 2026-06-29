# PrintBillingApp - Print Shop Billing, Accounting & Syncing System

A comprehensive React-based billing, accounting, and syncing application designed for print shops. Features include itemized billing, payment handling, customer management, inventory tracking, and full real-time database synchronization.

## Features

### Core Features
- **Billing Management**
  - Create and manage print orders with itemized billing
  - Support for color/B&W and single/double-sided printing
  - Flexible discount options (flat or percentage)
  - Split payment handling (cash + UPI)
  - Advance credit and overpayment management

- **Payment Processing**
  - Cash and UPI payment options
  - Full/partial payment support
  - Follow-up payment recording
  - UPI deep link generation for online payments
  - Payment history tracking

- **Customer Management**
  - Regular and random customer support
  - Customer credit balance tracking
  - Contact information management
  - Payment history per customer

- **Inventory System**
  - Print type pricing (color/B&W, single/double-sided)
  - Stock tracking
  - Dynamic pricing based on print specifications

- **Accounting, Analytics & Reporting**
  - Periodical analytical reports (daily, weekly, monthly, quarterly, yearly, and custom date-to-date ranges)
  - Revenue, receivables, and cash inflow summaries
  - Refund outflows tracking
  - Total expenses and Net Cash Flow (Cash Inflow - Expenses) calculations on both Dashboard and Analytics
  - Notification alerts for pending payments

### Advanced Cloud & Syncing Features

- **User Authentication**
  - Secure signup/login via Supabase Authentication (including OAuth provider integrations)
  - Owner-level session validation

- **Real-time Database Syncing**
  - Fully integrated Node.js / Express backend with Supabase PostgreSQL database persistence
  - Session-triggered data synchronization that auto-fetches all records upon user login
  - Safeguarded State Persistence: Prevents HMR restarts or loading exceptions from deleting local data
  - Non-destructive sync reconciliation that merges local storage entries with database records

- **Responsive Mobile Layout**
  - Optimized grids with fluid column sizes adapting to narrow screen viewports
  - Mobile-responsive navigation sidebar drawer that slides in on menu click, supports close (`X`) buttons, and auto-collapses on link select

- **Data Management**
  - Full JSON backup and restore
  - CSV export for bills, customers, inventory, and payments
  - Bulk import of customers and inventory items
  - Data validation and recovery tools

## Tech Stack

- **Frontend**: React 18 + Vite
- **Icons**: Lucide React
- **Styling**: Vanilla CSS (dark theme)
- **State Management**: React Context + useReducer
- **Backend & Database**: Node.js + Express + Supabase Postgres
- **Persistence**: Database Cloud Synchronization + LocalStorage Safeguarded Fallback
- **Export**: jsPDF + html2canvas

## Getting Started

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available locally at `http://localhost:5173`

### Backend Setup

```bash
cd backend
npm install
npm start
```

## Usage

1. **Create Bills**: Navigate to Billing page, select customer, add items, specify payment mode
2. **Record Payments**: Use the Follow-up Payment section in bill details to record partial/full payments
3. **Generate UPI Links**: Create shareable UPI payment links for customers
4. **Manage Customers**: Add/update customer information and track credit balances
5. **View Reports**: Check analytics and accounting pages for revenue, cash flow, receivables, and custom date range filters

## Payment Methods

- **Cash**: Direct cash payment recording
- **UPI**: Digital payment via UPI protocol with deep link support
- **Credit**: Advance customer credit that can be applied to bills
- **Overpayment**: Excess payments automatically converted to customer credit

## Data Persistence

All data is stored in the cloud database when logged in. A safeguarded local storage cache persists state offline.

## License

Private Project

## Author

Print Shop Billing Team
