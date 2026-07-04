---
name: PrintPro Financial Calculations
description: Canonical formulas, constraints, and anti-patterns for all financial metrics in PrintPro (Dashboard, Accounting, Analytics, Customer Ledger). Use when modifying or debugging any financial calculation.
---

# PrintPro Financial Calculation Standards

## Core Principle: Single Source of Truth

Every financial metric must be derived from validated transaction records — never from cached totals, multiple overlapping sources, or mixed entity fields. Do not sum `payments`, `advance_payments`, `customer.advance_balance`, and `bill.amount_paid` independently — money will be counted more than once.

---

## Canonical Formulas

### Total Revenue
```
Revenue = SUM(Finalized Invoice Grand Totals)
```
- Source: `bills` table, `bill.total` field
- Filter: `!deleted && !isGroupParent`
- **Never calculate revenue from payments**

### Amount Collected (Applied to Bills)
```
Amount Collected = SUM(min(Payment, Outstanding Invoice))
```
- Source: `payments` table, non-refund records
- Each payment applies at most the invoice balance to that invoice

### Invoice Paid
```
Invoice Paid = min(Payment Received, Invoice Total)
```
- **Constraint: Invoice Paid ≤ Invoice Total** (always enforced)
- Any excess becomes an Advance

### Invoice Balance
```
Invoice Balance = Invoice Total - Invoice Paid
```

### Excess Payment → Advance
```
Advance Created = max(0, Payment Received - Invoice Total)
```

### Total Cash Inflow
```
Total Cash Inflow = SUM(Cash + UPI + Card + Bank) from real payments
```
- Exclude FIFO payments created from advance deposits (notes containing "from advance deposit")
- Exclude refund payments
- For advance deposits, use actual cash/UPI breakdown, not the allocated `amount`
- **Never double-count**: a payment that creates an advance must count the cash only once

### Total Refunds
```
Total Refunds = Bill Refunds + Advance Refunds + Payment Reversals
```
- Refunds never reduce Revenue
- Refunds affect Cash Flow

### Advance Balance
```
Advance Balance = Advance Deposited - Advance Used - Advance Refunded
```
- Read from `customer.advanceBalance` (maintained by the reducer)
- Must reflect all deposits, usages, and returns

### Net Cash Flow
```
Net Cash Flow = Total Cash Inflow - Total Expenses - Total Refunds
```

### Net Profit
```
Net Profit = Total Revenue - Total Expenses
```

### Pending Dues (Outstanding Receivables)
```
Pending Dues = SUM(max(0, Invoice Total_i - Invoice Paid_i))
```
- Only invoices with balance > 0 contribute
- Paid invoices contribute ₹0
- Partial invoices contribute their remaining balance
- Unpaid invoices contribute their full invoice amount

### Customer Ledger Balance
```
Ledger Balance = SUM(Debits) - SUM(Credits)
```
- If customer has overpaid, balance should be negative (business owes customer) or shown as "Advance Credit"
- Never show positive balance when customer has excess credit

---

## Anti-Patterns to Avoid

| Anti-Pattern | Correct Approach |
|---|---|
| Computing Revenue from payments | Use `SUM(bill.total)` |
| Allowing `bill.amountPaid > bill.total` | Clamp: `min(paid, total)` |
| Summing both payment.cashAmount AND advance.amount for same excess | Count cash once — at the source |
| Using `bill.amountPaid` for "Amount Collected" display | Use actual payment records |
| Including advance-deposit FIFO payments in Cash Inflow | Filter by notes containing "from advance deposit" |
| Showing positive ledger balance for overpaying customer | Show negative or "Advance Credit" |
| Computing the same metric differently across modules | Use a single shared service function |

---

## Consistency Checks

These invariants must always hold:

1. `Revenue = SUM(invoice totals)` — never from payments
2. `Cash Inflow ≤ Revenue + Advance Deposits` — never exceeds money that could exist
3. `Pending Dues = Revenue - Amount Applied to Bills`
4. `Invoice Paid ≤ Invoice Total` — enforced in reducer
5. `Excess → Advance Balance` — always
6. `Refunds don't reduce Revenue` — separate line item
7. `Net Cash Flow = Cash Inflow - Expenses - Refunds`
8. Every payment has exactly one database row — no duplicates from optimistic updates, realtime events, or sync retries
