/**
 * settlementHelper.js
 * Comprehensive settlement, multi-bill payment allocation, and invoice breakdown utilities.
 */

/**
 * Returns accurate payment method details (cash, upi, advanceUsed) for a bill.
 * Automatically resolves missing or zero paymentMethod fields by querying the payments ledger.
 */
export function getBillPaymentBreakdown(bill, allPayments = []) {
  if (!bill) return { cash: 0, upi: 0, advanceUsed: 0 }

  const bId = String(bill.id || '')
  const bNum = String(bill.billNumber || bill.bill_number || '')

  const billPayments = (allPayments || []).filter((p) => {
    if (p.deleted || p.deleted_at || p.isRefund || p.is_refund) return false
    const pBillId = String(p.billId || p.bill_id || '')
    return (pBillId && (pBillId === bId || pBillId === bNum))
  })

  const cashFromPayments = billPayments.reduce(
    (sum, p) => sum + Number(p.cashAmount !== undefined ? p.cashAmount : (p.cash_amount || 0)),
    0
  )
  const upiFromPayments = billPayments.reduce(
    (sum, p) => sum + Number(p.upiAmount !== undefined ? p.upiAmount : (p.upi_amount || 0)),
    0
  )

  let cash = Number(bill.paymentMethod?.cash || 0)
  let upi = Number(bill.paymentMethod?.upi || 0)

  // If in-memory bill has 0 for both cash & upi, but payments table has records, use payments
  if (cash === 0 && upi === 0 && (cashFromPayments > 0 || upiFromPayments > 0)) {
    cash = cashFromPayments
    upi = upiFromPayments
  } else if (cash === 0 && upi === 0 && Number(bill.amountPaid || 0) > 0) {
    // If no explicit payment breakdown recorded at all, fallback to amountPaid as cash
    cash = Number(bill.amountPaid || 0)
  }

  const advanceUsed = Number(bill.advanceUsed || bill.advance_used || 0)

  return {
    cash: Math.round((cash + Number.EPSILON) * 100) / 100,
    upi: Math.round((upi + Number.EPSILON) * 100) / 100,
    advanceUsed: Math.round((advanceUsed + Number.EPSILON) * 100) / 100,
    paymentsList: billPayments
  }
}

/**
 * Computes or reconstructs the Account Settlement Breakdown for any bill.
 * Handles current bill amount, previous dues (single or multiple bills),
 * checkout payment receipts (Cash & UPI), allocation split, and outstanding balances.
 */
export function computeSettlementBreakdown(bill, allBills = [], allPayments = [], allCustomers = []) {
  if (!bill) return null

  // If already computed and stored on the bill object
  if (bill.settlementBreakdown && typeof bill.settlementBreakdown === 'object') {
    return bill.settlementBreakdown
  }

  const paymentInfo = getBillPaymentBreakdown(bill, allPayments)
  const customer = (allCustomers || []).find((c) => String(c.id) === String(bill.customerId))
  const customerBills = (allBills || []).filter(
    (b) => !b.deleted && !b.deleted_at && String(b.customerId) === String(bill.customerId)
  )

  const currentBillAmount = Number(bill.total || 0)
  const appliedToCurrentBill = Number(bill.amountPaid || 0)
  const currentBillBalance = Math.max(0, currentBillAmount - appliedToCurrentBill)

  // Identify co-settled payments:
  // Payments on other bills for this customer that were made around the exact same time
  // (e.g. within 5 seconds of any payment for this bill, or sharing the exact timestamp)
  const thisBillPayments = paymentInfo.paymentsList || []
  const coSettledOtherPayments = []

  if (thisBillPayments.length > 0) {
    const timeThresholdMs = 5000
    for (const bp of thisBillPayments) {
      const bpTime = new Date(bp.date || 0).getTime()
      for (const p of allPayments || []) {
        if (p.deleted || p.deleted_at || p.isRefund || p.is_refund) continue
        const pBillId = String(p.billId || p.bill_id || '')
        if (pBillId === String(bill.id) || pBillId === String(bill.billNumber || bill.bill_number)) continue
        if (String(p.customerId) !== String(bill.customerId)) continue

        const pTime = new Date(p.date || 0).getTime()
        if (Math.abs(bpTime - pTime) <= timeThresholdMs) {
          coSettledOtherPayments.push(p)
        }
      }
    }
  }

  const settledPreviousBills = []
  let previousDueTotal = 0
  let appliedToPreviousDues = 0

  if (coSettledOtherPayments.length > 0) {
    const grouped = {}
    for (const p of coSettledOtherPayments) {
      const pBillId = String(p.billId || p.bill_id || '')
      if (!grouped[pBillId]) {
        grouped[pBillId] = { cash: 0, upi: 0, total: 0 }
      }
      const cAmt = Number(p.cashAmount !== undefined ? p.cashAmount : (p.cash_amount || 0))
      const uAmt = Number(p.upiAmount !== undefined ? p.upiAmount : (p.upi_amount || 0))
      const tAmt = Number(p.totalPaid !== undefined ? p.totalPaid : (cAmt + uAmt))
      grouped[pBillId].cash += cAmt
      grouped[pBillId].upi += uAmt
      grouped[pBillId].total += tAmt
    }

    for (const [targetBillId, pData] of Object.entries(grouped)) {
      const targetBill = customerBills.find(
        (b) => String(b.id) === targetBillId || String(b.billNumber || b.bill_number) === targetBillId
      )
      const dispNum = targetBill?.billNumber || targetBill?.bill_number || targetBillId
      settledPreviousBills.push({
        billId: targetBillId,
        billNumber: dispNum,
        applied: pData.total,
        cashApplied: pData.cash,
        upiApplied: pData.upi,
        remainingBalance: targetBill ? Number(targetBill.balance || 0) : 0
      })
      appliedToPreviousDues += pData.total
      previousDueTotal += pData.total
    }
  }

  // Also include any other bills that currently have unpaid balance
  const otherUnpaidBills = customerBills.filter(
    (b) => String(b.id) !== String(bill.id) && Number(b.balance || 0) > 0
  )

  if (settledPreviousBills.length === 0 && otherUnpaidBills.length > 0) {
    otherUnpaidBills.forEach((b) => {
      settledPreviousBills.push({
        billId: b.id,
        billNumber: b.billNumber || b.bill_number || b.id,
        dueBefore: Number(b.balance || 0),
        applied: 0,
        cashApplied: 0,
        upiApplied: 0,
        remainingBalance: Number(b.balance || 0)
      })
      previousDueTotal += Number(b.balance || 0)
    })
  }

  const totalReceivedCash = paymentInfo.cash + settledPreviousBills.reduce((s, b) => s + (b.cashApplied || 0), 0)
  const totalReceivedUpi = paymentInfo.upi + settledPreviousBills.reduce((s, b) => s + (b.upiApplied || 0), 0)
  const totalReceived = totalReceivedCash + totalReceivedUpi

  // Net outstanding balance across all bills for customer
  const customerRemainingBalance = customerBills.reduce((sum, b) => sum + Number(b.balance || 0), 0)

  return {
    currentBillAmount,
    previousDueTotal,
    previousBills: settledPreviousBills,
    totalReceived,
    totalReceivedCash,
    totalReceivedUpi,
    advanceUsed: paymentInfo.advanceUsed,
    excessAddedToAdvance: Number(bill.excessAmount || 0),
    advanceBalance: Number(customer?.advanceBalance !== undefined ? customer.advanceBalance : (customer?.creditBalance || 0)),
    appliedToCurrentBill,
    appliedToCurrentBillCash: paymentInfo.cash,
    appliedToCurrentBillUpi: paymentInfo.upi,
    appliedToPreviousDues,
    currentBillBalance,
    customerRemainingBalance
  }
}
