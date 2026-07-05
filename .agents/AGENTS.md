# PrintPro ERP Version 2 Development Rules

## 1. Version Isolation & Safety
- **DO NOT** modify, delete, or affect the Version 1 source code or production database.
- Version 1 is the live production system and must remain completely untouched.
- Develop Version 2 on the `v2-development` branch or feature branches.
- Use a separate development database environment. Never mix credentials.

## 2. Core Architecture Rules (V2)
- **UI & Frontend**: React 19 + Vite + TypeScript + Tailwind CSS. Use TanStack Query (React Query) for server-state management.
- **State Management**: Use React Query for server state. Use Zustand or Context for lightweight client-side state. Avoid global re-renders.
- **Data Flow**: UI -> DB -> Response -> UI. No optimistic financial states or legacy sync queues. Database is the single source of truth.
- **Serials & IDs**: The database must generate all primary keys, invoice numbers, payment numbers, advance numbers, customer numbers, etc. The frontend must never generate document numbers or primary keys.

## 3. Financial Engine & Calculations
- All screens (Dashboard, Accounting, Analytics, Reports, Ledger) must use the same centralized calculation engine.
- Never duplicate financial logic in individual UI components.
- Calculations must follow the canonical formulas defined in the financial-calculations skill:
  - **Revenue** = SUM(Finalized Invoice Grand Totals) [excluding deleted and group parent bills]
  - **Cash Inflow** = SUM(CustomerPayments) [excluding FIFO payment lines containing 'from advance deposit']
  - **Pending Dues** = SUM(max(0, Invoice Total - Invoice Paid))
  - **Ledger Balance** = SUM(Debits) - SUM(Credits) [If Balance < 0, show "Advance Credit"]
  - **Net Profit** = Revenue - Expenses
  - **Net Cash Flow** = Cash Inflow - Refunds - Expenses

## 4. Atomic Transactions
- Every business operation must be atomic.
- E.g., Creating a bill with items, allocating a payment, and updating customer ledger / inventory must run in a single transaction. If any step fails, roll back everything.
