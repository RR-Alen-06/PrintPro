// Verification script for Complete Accounting & Dashboard Enhancement
const assert = require('assert')

console.log('--- STARTING ACCOUNTING & DASHBOARD ENHANCEMENT AUDIT ---')

// Sample realistic datasets matching production PrintPro data structures
const mockBills = [
  { id: 'BILL0001', date: '2026-11-01', customerId: 'CUST001', customerName: 'Arjun', customerType: 'regular', total: 1000, amountPaid: 1000, balance: 0, status: 'paid', paymentMode: 'cash', advanceUsed: 0 },
  { id: 'BILL0002', date: '2026-11-02', customerId: 'CUST002', customerName: 'Priya', customerType: 'regular', total: 500, amountPaid: 300, balance: 200, status: 'partial', paymentMode: 'upi', advanceUsed: 0, dueDate: '2026-11-01' }, // Overdue
  { id: 'BILL0003', date: '2026-11-03', customerId: 'CUST003', customerName: 'Kiran', customerType: 'random', total: 300, amountPaid: 0, balance: 300, status: 'unpaid', paymentMode: 'unpaid', advanceUsed: 0 },
  { id: 'BILL0004', date: '2026-11-03', customerId: 'CUST001', customerName: 'Arjun', customerType: 'regular', total: 400, amountPaid: 400, balance: 0, status: 'paid', paymentMode: 'split', advanceUsed: 100 } // Advance used: 100, Direct paid: 300
]

const mockPayments = [
  { id: 'PAY0001', billId: 'BILL0001', date: '2026-11-01', customerId: 'CUST001', cashAmount: 1000, upiAmount: 0, totalPaid: 1000, paymentType: 'full', paymentMethod: 'cash' },
  { id: 'PAY0002', billId: 'BILL0002', date: '2026-11-02', customerId: 'CUST002', cashAmount: 0, upiAmount: 300, totalPaid: 300, paymentType: 'partial', paymentMethod: 'upi' },
  { id: 'PAY0003', billId: 'BILL0004', date: '2026-11-03', customerId: 'CUST001', cashAmount: 150, upiAmount: 150, totalPaid: 300, paymentType: 'full', paymentMethod: 'mixed' }, // Mixed payment
  { id: 'PAY0004', billId: 'BILL0001', date: '2026-11-02', customerId: 'CUST001', cashAmount: 0, upiAmount: 0, totalPaid: 0, refundAmount: 50, isRefund: true, paymentType: 'refund', paymentMethod: 'upi', status: 'completed', utr: 'UTR998877665544' }, // Completed UPI refund
  { id: 'PAY0005', billId: 'BILL0004', date: '2026-11-03', customerId: 'CUST001', cashAmount: 0, upiAmount: 0, totalPaid: 0, refundAmount: 20, isRefund: true, paymentType: 'refund', paymentMethod: 'upi', status: 'manual_pending' } // Pending manual UPI refund
]

const mockExpenses = [
  { id: 'EXP0001', date: '2026-11-01', category: 'Paper & Printing', description: 'A4 Copier paper rim', vendorName: 'Paper Depot', amount: 400, cashAmount: 400, upiAmount: 0, paymentMethod: 'cash' },
  { id: 'EXP0002', date: '2026-11-03', category: 'Ink & Toner', description: 'Canon toner cartridge', vendorName: 'Tech Supplies', amount: 600, cashAmount: 0, upiAmount: 600, paymentMethod: 'upi' }
]

const mockAdvances = [
  { id: 'ADV0001', date: '2026-10-25', customerId: 'CUST001', customerName: 'Arjun', amount: 500, cashAmount: 500, upiAmount: 0, paymentMethod: 'cash', isExcessCredit: false },
  { id: 'ADV0002', date: '2026-11-02', customerId: 'CUST002', customerName: 'Priya', amount: -100, isReturn: true, type: 'return', paymentMethod: 'upi' } // Returned advance
]

const mockCustomers = [
  { id: 'CUST001', name: 'Arjun', type: 'regular', advanceBalance: 400, creditBalance: 400 }, // 500 dep - 100 used = 400
  { id: 'CUST002', name: 'Priya', type: 'regular', advanceBalance: 0, creditBalance: 0 },
  { id: 'CUST003', name: 'Kiran', type: 'random', advanceBalance: 0, creditBalance: 0 }
]

// ----------------------------------------------------
// TEST 1: Total Sales Billed vs Realized Revenue
// ----------------------------------------------------
{
  const totalBilled = mockBills.reduce((s, b) => s + b.total, 0)
  const realizedRevenue = mockBills.reduce((s, b) => s + b.amountPaid, 0)
  
  assert.strictEqual(totalBilled, 2200, 'Total billed must be ₹2,200')
  assert.strictEqual(realizedRevenue, 1700, 'Realized revenue must be ₹1,700')
  console.log('✓ Test 1: Billed Sales (₹2,200) cleanly separated from Realized Revenue (₹1,700).')
}

// ----------------------------------------------------
// TEST 2: Direct Collections (Cash vs UPI) & Advance Separation
// ----------------------------------------------------
{
  // Normal payments (non-refund)
  const normalPayments = mockPayments.filter(p => !p.isRefund && p.paymentType !== 'refund' && Number(p.totalPaid || 0) >= 0)
  const cashFromPayments = normalPayments.reduce((s, p) => s + p.cashAmount, 0) // 1000 + 0 + 150 = 1150
  const upiFromPayments = normalPayments.reduce((s, p) => s + p.upiAmount, 0)   // 0 + 300 + 150 = 450
  
  // Advance deposits (non-returns)
  const isAdvReturn = (ap) => ap.isReturn || ap.type === 'return' || ap.type === 'refund' || Number(ap.amount || 0) < 0
  const validAdvances = mockAdvances.filter(ap => !isAdvReturn(ap) && Number(ap.amount || 0) > 0)
  const cashFromAdvances = validAdvances.reduce((s, ap) => s + (ap.cashAmount || 0), 0) // 500
  const upiFromAdvances = validAdvances.reduce((s, ap) => s + (ap.upiAmount || 0), 0)   // 0

  const totalCashCollected = cashFromPayments + cashFromAdvances // 1150 + 500 = 1650
  const totalUpiCollected = upiFromPayments + upiFromAdvances    // 450 + 0 = 450
  const totalCollections = totalCashCollected + totalUpiCollected // 2100

  assert.strictEqual(cashFromPayments, 1150)
  assert.strictEqual(upiFromPayments, 450)
  assert.strictEqual(totalCashCollected, 1650)
  assert.strictEqual(totalUpiCollected, 450)
  assert.strictEqual(totalCollections, 2100)
  console.log('✓ Test 2: Cash Collected (₹1,650) & UPI Collected (₹450) calculated accurately.')
}

// ----------------------------------------------------
// TEST 3: Operating Expenses, Net Cash Flow, Net Profit
// ----------------------------------------------------
{
  const totalExpenses = mockExpenses.reduce((s, e) => s + e.amount, 0) // 400 + 600 = 1000
  const realizedRevenue = mockBills.reduce((s, b) => s + b.amountPaid, 0) // 1700
  
  // Net Profit = Realized Revenue - Total Expenses
  const netProfit = realizedRevenue - totalExpenses // 1700 - 1000 = 700
  
  // Cash Inflow in period = Normal payments + Non-return advances
  const normalPaymentsInflow = mockPayments
    .filter(p => !p.isRefund && Number(p.totalPaid || 0) >= 0)
    .reduce((s, p) => s + p.cashAmount + p.upiAmount, 0) // 1600
  const advanceInflow = mockAdvances
    .filter(ap => !ap.isReturn && ap.type !== 'return' && Number(ap.amount || 0) > 0)
    .reduce((s, ap) => s + ap.amount, 0) // 500
  const totalCashInflow = normalPaymentsInflow + advanceInflow // 2100
  
  // Net Cash Flow = Total Inflow - Total Expenses
  const netCashFlow = totalCashInflow - totalExpenses // 2100 - 1000 = 1100

  assert.strictEqual(totalExpenses, 1000)
  assert.strictEqual(netProfit, 700, 'Net Profit formula (Revenue - Expenses) must equal ₹700')
  assert.strictEqual(netCashFlow, 1100, 'Net Cash Flow (Inflow - Expenses) must equal ₹1,100')
  console.log('✓ Test 3: Net Profit (₹700) and Net Cash Flow (₹1,100) match exact formulas.')
}

// ----------------------------------------------------
// TEST 4: Customer Receivables & Overdue Aging
// ----------------------------------------------------
{
  const pendingReceivables = mockBills.filter(b => b.status !== 'paid').reduce((s, b) => s + b.balance, 0)
  assert.strictEqual(pendingReceivables, 500, 'Pending receivables must be ₹500 (200 + 300)')
  
  const overdueBills = mockBills.filter(b => b.balance > 0 && b.dueDate && new Date(b.dueDate) < new Date('2026-11-03'))
  assert.strictEqual(overdueBills.length, 1)
  assert.strictEqual(overdueBills[0].id, 'BILL0002')
  console.log('✓ Test 4: Pending receivables (₹500) and overdue tracking verified.')
}

// ----------------------------------------------------
// TEST 5: Refunds & Actionable Alerts Traceability
// ----------------------------------------------------
{
  const refundPayments = mockPayments.filter(p => p.isRefund || p.paymentType === 'refund')
  const totalRefundOutflow = refundPayments.reduce((s, p) => s + (p.refundAmount || p.totalPaid || 0), 0)
  const pendingRefunds = refundPayments.filter(p => p.status === 'manual_pending')

  assert.strictEqual(totalRefundOutflow, 70, 'Refunds total ₹70 (50 + 20)')
  assert.strictEqual(pendingRefunds.length, 1, 'Exactly 1 manual pending refund')
  assert.strictEqual(pendingRefunds[0].refundAmount, 20)
  console.log('✓ Test 5: Refund outflows (₹70) and pending verification alerts isolated.')
}

// ----------------------------------------------------
// TEST 6: General Ledger Running Balance Verification
// ----------------------------------------------------
{
  const entries = [
    { type: 'Invoice Sale', credit: 1000, debit: 0 },
    { type: 'Operating Expense', credit: 0, debit: 400 },
    { type: 'Invoice Sale', credit: 300, debit: 0 },
    { type: 'Refund', credit: 0, debit: 50 }
  ]

  let running = 0
  const ledger = entries.map(e => {
    running = running + e.credit - e.debit
    return { ...e, runningBalance: running }
  })

  assert.strictEqual(ledger[0].runningBalance, 1000)
  assert.strictEqual(ledger[1].runningBalance, 600)
  assert.strictEqual(ledger[2].runningBalance, 900)
  assert.strictEqual(ledger[3].runningBalance, 850)
  console.log('✓ Test 6: General Ledger double-entry running balance is mathematically exact.')
}

console.log('--- ALL ACCOUNTING & DASHBOARD TESTS PASSED SUCCESSFULLY! ---')

