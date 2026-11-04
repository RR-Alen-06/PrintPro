// Automated verification script for Excess Payment Received Feature
const assert = require('assert')

console.log('--- STARTING EXCESS PAYMENT VERIFICATION ---')

// Mock AppContext state reducer logic
function createInitialState() {
  return {
    bills: [],
    payments: [],
    customers: [
      { id: 'CUST-001', name: 'Arjun', type: 'regular', advanceBalance: 0, creditBalance: 0, loyaltyPoints: 0 },
      { id: 'CUST-002', name: 'Priya', type: 'regular', advanceBalance: 50, creditBalance: 50, loyaltyPoints: 0 },
      { id: 'CUST-WALKIN', name: 'Walk-in Guest', type: 'random', advanceBalance: 0, creditBalance: 0, loyaltyPoints: 0 }
    ],
    advancePayments: [],
    idCounters: { BILL: 0, PAY: 0, ADV: 0 }
  }
}

// Emulate addBill from AppContext.jsx
function simulateAddBill(state, billData) {
  const billId = `BILL${String(++state.idCounters.BILL).padStart(4, '0')}`
  const customer = state.customers.find(c => c.id === billData.customerId)
  const customerName = customer?.name || billData.customerName || 'Guest'
  const currentAdvance = Number(customer?.advanceBalance || 0)
  const total = Number(billData.total)

  const newBill = {
    id: billId,
    billNumber: billId,
    ...billData,
    customerName,
    amountPaid: 0,
    balance: total,
    status: 'unpaid',
    paymentMethod: { cash: 0, upi: 0 },
    advanceUsed: 0
  }

  const cashAmount = Number(billData.cashAmount || 0)
  const upiAmount = Number(billData.upiAmount || 0)

  let R_advance = Math.min(Number(billData.advanceUsed || 0), currentAdvance)
  let R_cash = cashAmount
  let R_upi = upiAmount

  const paymentRecords = []
  let updatedCustomer = customer ? { ...customer } : null

  // 1. Advance allocation
  let remaining = newBill.total - newBill.amountPaid
  if (R_advance > 0 && remaining > 0) {
    const applyAdv = Math.min(R_advance, remaining)
    newBill.advanceUsed += applyAdv
    newBill.amountPaid += applyAdv
    remaining -= applyAdv
    R_advance -= applyAdv
  }

  // 2. Cash/UPI allocation
  const totalNewPayment = cashAmount + upiAmount
  if (remaining > 0 && (R_cash + R_upi) > 0) {
    const applyTotal = Math.min(remaining, R_cash + R_upi)
    let applyCash = 0
    let applyUpi = 0

    if (cashAmount > 0 && upiAmount > 0) {
      const cashRatio = cashAmount / totalNewPayment
      applyCash = Math.min(R_cash, Math.round(applyTotal * cashRatio * 100) / 100)
      applyUpi = Math.min(R_upi, Math.round((applyTotal - applyCash) * 100) / 100)
    } else if (cashAmount > 0) {
      applyCash = Math.min(R_cash, applyTotal)
    } else {
      applyUpi = Math.min(R_upi, applyTotal)
    }

    R_cash = Math.max(0, Math.round((R_cash - applyCash) * 100) / 100)
    R_upi = Math.max(0, Math.round((R_upi - applyUpi) * 100) / 100)

    newBill.amountPaid = Math.round((newBill.amountPaid + applyTotal) * 100) / 100
    newBill.paymentMethod.cash = applyCash
    newBill.paymentMethod.upi = applyUpi

    paymentRecords.push({
      id: `PAY${String(++state.idCounters.PAY).padStart(4, '0')}`,
      billId: newBill.id,
      customerId: newBill.customerId,
      cashAmount: applyCash,
      upiAmount: applyUpi,
      totalPaid: applyTotal,
      paymentType: newBill.amountPaid >= newBill.total ? 'full' : 'partial',
      excessCredit: 0
    })
  }

  newBill.balance = Math.max(newBill.total - newBill.amountPaid, 0)
  newBill.status = newBill.amountPaid >= newBill.total ? 'paid' : (newBill.amountPaid > 0 ? 'partial' : 'unpaid')

  // Excess handling
  const overpaid = Math.round((R_cash + R_upi) * 100) / 100
  const creditToAdvance = billData.excessToAdvance !== false && overpaid > 0 && !(billData.returnChangeUpi > 0)
  const isUpiRefund = overpaid > 0 && billData.returnChangeUpi > 0 && !creditToAdvance

  if (updatedCustomer) {
    const advanceDeducted = Math.min(Number(billData.advanceUsed || 0), currentAdvance) - R_advance
    const unusedAdvance = Math.max(currentAdvance - advanceDeducted, 0)
    const finalBal = unusedAdvance + (creditToAdvance ? overpaid : 0)
    updatedCustomer.advanceBalance = finalBal
    updatedCustomer.creditBalance = finalBal
  }

  if (creditToAdvance && updatedCustomer) {
    const advId = `ADV${String(++state.idCounters.ADV).padStart(4, '0')}`
    state.advancePayments.push({
      id: advId,
      customerId: billData.customerId,
      customerName,
      amount: overpaid,
      paymentMethod: R_upi > 0 ? (R_cash > 0 ? 'split' : 'upi') : 'cash',
      cashAmount: R_cash,
      upiAmount: R_upi
    })
    if (paymentRecords.length > 0) {
      paymentRecords[paymentRecords.length - 1].excessCredit = overpaid
    }
  } else if (isUpiRefund) {
    const refundUtr = billData.refundUtr || ''
    const refundStatus = refundUtr.trim() ? 'completed' : (billData.refundStatus || 'manual_pending')
    paymentRecords.push({
      id: `PAY${String(++state.idCounters.PAY).padStart(4, '0')}`,
      billId,
      customerId: billData.customerId,
      cashAmount: 0,
      upiAmount: 0,
      totalPaid: 0,
      refundAmount: Number(billData.returnChangeUpi || overpaid),
      paymentType: 'refund',
      isRefund: true,
      paymentMethod: 'upi',
      upiId: billData.refundUpiId || '',
      utr: refundUtr,
      status: refundStatus
    })
  }

    const refundUtr = billData.refundUtr || ''
    const refundStatus = refundUtr.trim() ? 'completed' : (billData.refundStatus || 'manual_pending')
    newBill.settlementBreakdown = {
      currentBillAmount: total,
      totalReceived: cashAmount + upiAmount,
      advanceUsed: newBill.advanceUsed,
      excessAddedToAdvance: creditToAdvance ? overpaid : 0,
      excessRefundedUpi: isUpiRefund ? Number(billData.returnChangeUpi || overpaid) : 0,
      upiRefundDetails: isUpiRefund ? {
        amount: Number(billData.returnChangeUpi || overpaid),
        upiId: billData.refundUpiId || '',
        utr: billData.refundUtr || '',
        status: refundStatus
      } : null,
      advanceBalance: updatedCustomer ? updatedCustomer.advanceBalance : 0
    }

  state.bills.push(newBill)
  paymentRecords.forEach(p => state.payments.push(p))
  if (updatedCustomer) {
    const idx = state.customers.findIndex(c => c.id === updatedCustomer.id)
    if (idx !== -1) state.customers[idx] = updatedCustomer
  }

  return newBill
}

// ----------------------------------------------------
// TEST 1: Exact Payment (No excess dialog condition)
// ----------------------------------------------------
{
  const state = createInitialState()
  const total = 500
  const cashAmount = 500
  const upiAmount = 0
  const changeDue = (cashAmount + upiAmount) - total

  assert.strictEqual(changeDue, 0, 'Exact payment should produce changeDue = 0')
  const bill = simulateAddBill(state, {
    customerId: 'CUST-001',
    total,
    cashAmount,
    upiAmount
  })

  assert.strictEqual(bill.status, 'paid')
  assert.strictEqual(bill.balance, 0)
  assert.strictEqual(bill.settlementBreakdown.excessAddedToAdvance, 0)
  assert.strictEqual(bill.settlementBreakdown.excessRefundedUpi, 0)
  assert.strictEqual(state.customers.find(c => c.id === 'CUST-001').advanceBalance, 0)
  console.log('✓ Scenario 1: Exact payment creates no excess and settles bill properly.')
}

// ----------------------------------------------------
// TEST 2: Option A - Add to Customer Advance
// Bill Total ₹5.00, Handed ₹6.00 (Cash) -> Excess ₹1.00
// ----------------------------------------------------
{
  const state = createInitialState()
  const total = 5.00
  const cashAmount = 6.00
  const upiAmount = 0
  const changeDue = Number((cashAmount + upiAmount - total).toFixed(2))

  assert.strictEqual(changeDue, 1.00, 'Excess change must be ₹1.00')

  // User selects Option A
  const bill = simulateAddBill(state, {
    customerId: 'CUST-001',
    total,
    cashAmount,
    upiAmount,
    excessToAdvance: true,
    excessAmount: changeDue
  })

  const cust = state.customers.find(c => c.id === 'CUST-001')
  assert.strictEqual(bill.status, 'paid', 'Bill status must be paid')
  assert.strictEqual(bill.balance, 0, 'Bill balance must be 0')
  assert.strictEqual(cust.advanceBalance, 1.00, 'Customer advance balance must increase by ₹1.00')
  assert.strictEqual(bill.settlementBreakdown.excessAddedToAdvance, 1.00, 'Settlement breakdown must show ₹1.00 added to advance')
  assert.strictEqual(state.advancePayments.length, 1, 'Advance payment transaction must be recorded')
  assert.strictEqual(state.advancePayments[0].amount, 1.00)
  console.log('✓ Scenario 2: Option A adds excess ₹1.00 to Customer Advance correctly.')
}

// ----------------------------------------------------
// TEST 3: Option B - Return Excess via UPI (with verified UTR)
// Bill Total ₹5.00, Handed ₹6.00 -> Excess ₹1.00 returned via UPI
// ----------------------------------------------------
{
  const state = createInitialState()
  const total = 5.00
  const cashAmount = 6.00
  const upiAmount = 0
  const changeDue = Number((cashAmount + upiAmount - total).toFixed(2))

  assert.strictEqual(changeDue, 1.00)

  // User selects Option B, inputs UPI ID and UTR
  const bill = simulateAddBill(state, {
    customerId: 'CUST-001',
    total,
    cashAmount,
    upiAmount,
    excessToAdvance: false,
    returnChangeUpi: changeDue,
    refundUpiId: 'arjun@okaxis',
    refundUtr: '987654321012'
  })

  const cust = state.customers.find(c => c.id === 'CUST-001')
  assert.strictEqual(bill.status, 'paid', 'Bill status must be paid')
  assert.strictEqual(bill.balance, 0, 'Bill balance must be 0')
  assert.strictEqual(cust.advanceBalance, 0, 'Customer advance must NOT be inflated when returning via UPI')
  assert.strictEqual(state.advancePayments.length, 0, 'No advance deposits must be created')
  
  // Verify dedicated refund payment record
  const refundRec = state.payments.find(p => p.isRefund)
  assert(refundRec, 'A dedicated refund payment record must be created')
  assert.strictEqual(refundRec.refundAmount, 1.00, 'Refund amount must be ₹1.00')
  assert.strictEqual(refundRec.paymentMethod, 'upi')
  assert.strictEqual(refundRec.status, 'completed', 'Refund with UTR must be marked completed')
  assert.strictEqual(refundRec.utr, '987654321012')
  assert.strictEqual(refundRec.upiId, 'arjun@okaxis')

  // Verify settlement breakdown
  assert.strictEqual(bill.settlementBreakdown.excessAddedToAdvance, 0)
  assert.strictEqual(bill.settlementBreakdown.excessRefundedUpi, 1.00)
  assert.strictEqual(bill.settlementBreakdown.upiRefundDetails.status, 'completed')

  console.log('✓ Scenario 3: Option B returns excess via UPI with UTR, advance is untouched, refund record created.')
}

// ----------------------------------------------------
// TEST 4: Option B - Return Excess via UPI (manual pending without UTR)
// ----------------------------------------------------
{
  const state = createInitialState()
  const total = 100.00
  const cashAmount = 0
  const upiAmount = 150.00
  const changeDue = 50.00

  // User selects Option B, inputs UPI ID but no UTR yet
  const bill = simulateAddBill(state, {
    customerId: 'CUST-001',
    total,
    cashAmount,
    upiAmount,
    excessToAdvance: false,
    returnChangeUpi: changeDue,
    refundUpiId: 'customer@upi',
    refundUtr: ''
  })

  const refundRec = state.payments.find(p => p.isRefund)
  assert(refundRec, 'Refund record created')
  assert.strictEqual(refundRec.status, 'manual_pending', 'Status without UTR must be manual_pending')
  assert.strictEqual(bill.status, 'paid', 'Bill is paid even though refund status is manual_pending')
  console.log('✓ Scenario 4: Option B returns excess via UPI with manual_pending status when UTR is blank.')
}

// ----------------------------------------------------
// TEST 5: Advance Applied + Overpayment calculation
// Bill Total ₹100. Advance Used ₹30. Net Payable ₹70.
// Customer gives ₹100 Cash. Excess = 100 - 70 = ₹30.
// ----------------------------------------------------
{
  const state = createInitialState()
  const total = 100
  const appliedAdvance = 30
  const cashAmount = 100
  const upiAmount = 0
  
  const netBillPayable = Math.max(total - appliedAdvance, 0) // 70
  const totalPaidNow = cashAmount + upiAmount // 100
  const changeDue = Number((totalPaidNow - netBillPayable).toFixed(2)) // 30

  assert.strictEqual(changeDue, 30.00, 'Excess change calculation must account for advance used')

  // User selects Add to Advance
  const bill = simulateAddBill(state, {
    customerId: 'CUST-002', // has 50 advance initially
    total,
    advanceUsed: appliedAdvance,
    cashAmount,
    upiAmount,
    excessToAdvance: true,
    excessAmount: changeDue
  })

  const cust = state.customers.find(c => c.id === 'CUST-002')
  // Initial 50 - 30 used + 30 added back = 50
  assert.strictEqual(cust.advanceBalance, 50)
  assert.strictEqual(bill.settlementBreakdown.advanceUsed, 30)
  assert.strictEqual(bill.settlementBreakdown.excessAddedToAdvance, 30)
  console.log('✓ Scenario 5: Excess change properly calculated with prior advance applied.')
}

console.log('--- ALL EXCESS PAYMENT SCENARIO TESTS PASSED SUCCESSFULLY! ---')
