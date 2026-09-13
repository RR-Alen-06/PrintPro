/**
 * Formats a bill/invoice as a clean, modern, and professional WhatsApp receipt
 * adhering to strict POS ledger accounting standards.
 */
export const formatWhatsAppReceipt = (bill: any, settings: any = {}, business: any = {}, pdfUrl: string = '', extraData: any = {}) => {
  if (!bill) return ''

  const { bills = [], payments = [], customers = [] } = extraData

  // 1. Find Customer Info
  const custId = bill.customerId || bill.customer_id
  const customer = customers.find((c: any) => String(c.id) === String(custId) || (c.customerCode && String(c.customerCode) === String(custId)) || (c.code && String(c.code) === String(custId)))
  const customerCode = customer?.customerCode || customer?.code || ''
  const customerDisplay = bill.customerName || bill.customer_name || customer?.name || 'Walk-in Customer'
  const customerSuffix = customerCode ? ` (${customerCode})` : ''

  // 2. Previous Outstanding Calculation
  let previousOutstanding = 0
  if (extraData.previousBalance !== undefined) {
    previousOutstanding = Number(extraData.previousBalance || 0)
  } else if (custId) {
    const currentBillDateStr = bill.createdAt || bill.created_at || bill.date || ''
    const currentBillTime = currentBillDateStr ? new Date(currentBillDateStr).getTime() : Date.now()

    const pastBills = bills.filter((b: any) => {
      if (b.deleted || b.deleted_at) return false
      const bCustId = b.customerId || b.customer_id
      if (String(bCustId) !== String(custId)) return false
      if (String(b.id) === String(bill.id)) return false

      const bDateStr = b.createdAt || b.created_at || b.date || ''
      const bTime = bDateStr ? new Date(bDateStr).getTime() : 0
      if (bTime && currentBillTime && bTime !== currentBillTime) {
        return bTime < currentBillTime
      }
      return true
    })

    if (pastBills.length > 0) {
      previousOutstanding = pastBills.reduce((sum: number, b: any) => {
        const bal = b.balance !== undefined ? Number(b.balance) : Math.max(0, Number(b.total || 0) - Number(b.amountPaid || b.amount_paid || 0))
        return sum + (isNaN(bal) ? 0 : bal)
      }, 0)
    } else if (customer) {
      const currentBillBal = bill.balance !== undefined ? Number(bill.balance) : Math.max(0, Number(bill.total || 0) - Number(bill.amountPaid || bill.amount_paid || 0))
      const totalCustCredit = Number(customer.creditBalance || customer.credit_balance || customer.balanceDue || customer.balance_due || 0)
      previousOutstanding = Math.max(0, totalCustCredit - currentBillBal)
    }
  }

  // 3. Current Bill Total
  const currentBill = Number(bill.total || 0)

  // 4. Total Amount Due (Gross Outstanding)
  const totalAmountDue = previousOutstanding + currentBill

  // 5. Payment Received for this Transaction
  const billPayments = payments.filter((p: any) => !p.deleted && !p.deleted_at && String(p.billId || p.bill_id) === String(bill.id))
  const cashPaid = billPayments.reduce((sum: number, p: any) => sum + Number(p.cashAmount || p.cash_amount || 0), 0)
  const upiPaid = billPayments.reduce((sum: number, p: any) => sum + Number(p.upiAmount || p.upi_amount || 0), 0)
  const advanceUsed = Number(bill.advanceUsed || bill.advanceDeducted || bill.advance_deducted || 0)
  const directPaid = Number(bill.amountPaid !== undefined ? bill.amountPaid : (bill.amount_paid !== undefined ? bill.amount_paid : (bill.paidTotal || (cashPaid + upiPaid))))
  const paidNow = Math.max(directPaid, cashPaid + upiPaid) + advanceUsed

  // 6. Remaining Net Balance
  const remainingBalance = Math.max(0, totalAmountDue - paidNow)

  // 7. Customer Advance Balance
  const customerAdvanceBalance = Number(customer?.advanceBalance || customer?.advance_balance || 0)

  // Formatting output
  const divider = '━━━━━━━━━━━━━━━━━━━━━━'
  const shopName = business?.shopName || settings?.shopName || 'PRINTPRO'
  const phone = business?.phone || settings?.phone || ''
  const upiId = business?.upiId || settings?.upiId || ''
  
  let result = `🧾 *${shopName.toUpperCase()} ERP*\n\n`
  result += `🏪 *${shopName.toUpperCase()}*\n`
  if (phone) {
    result += `📞 ${phone}\n`
  }
  result += `\n`
  result += `Bill No : ${bill.invoiceNumber || bill.invoice_number || bill.id}\n`
  
  // Format date cleanly e.g. 14-Jul-2026
  let formattedDate = bill.date || ''
  if (bill.date) {
    try {
      const dObj = new Date(bill.date)
      const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
      formattedDate = dObj.toLocaleDateString('en-GB', options).replace(/ /g, '-')
    } catch (_) {
      formattedDate = bill.date
    }
  }
  result += `Date : ${formattedDate}\n`
  result += `Customer : ${customerDisplay}${customerSuffix}\n\n`

  result += `${divider}\n`
  result += `*ITEMS*\n\n`

  if (bill.items && bill.items.length > 0) {
    bill.items.forEach((item: any, index: number) => {
      const sidesSuffix = item.sides ? ` ${item.sides.charAt(0).toUpperCase() + item.sides.slice(1)}` : ''
      const printTypeSuffix = item.printType ? ` ${item.printType.toUpperCase()}` : ''
      result += `${index + 1}. ${item.name || item.itemName || 'Item'}${printTypeSuffix}${sidesSuffix}\n`
      result += `   Qty : ${item.qty || item.quantity || 1} × ₹${Number(item.unitPrice || item.price || item.unit_price || 0).toFixed(2)} = ₹${Number(item.amount || item.lineTotal || item.total || 0).toFixed(2)}\n\n`
    })
  } else {
    result += `No items\n\n`
  }

  result += `${divider}\n\n`
  result += `Subtotal              ₹${Number(bill.subtotal || currentBill).toFixed(2)}\n`
  
  const totalDiscount = (Number(bill.discountAmount || 0) + Number(bill.promoDiscount || 0) + Number(bill.loyaltyDiscount || 0) + Number(bill.discount || 0))
  result += `Discount              ₹${totalDiscount.toFixed(2)}\n`
  
  const gstAmount = Number(bill.gstAmount || bill.gst_amount || 0)
  result += `GST                   ₹${gstAmount.toFixed(2)}\n\n`

  result += `🧾 *Current Bill Total* ₹${currentBill.toFixed(2)}\n\n`

  result += `${divider}\n`
  result += `*LEDGER SUMMARY*\n\n`
  result += `Previous Outstanding      ₹${previousOutstanding.toFixed(2)}\n`
  result += `Current Bill              ₹${currentBill.toFixed(2)}\n\n`
  result += `Total Amount Due          ₹${totalAmountDue.toFixed(2)}\n\n`

  result += `${divider}\n`
  result += `*PAYMENT RECEIVED*\n\n`
  result += `Cash Paid                 ₹${cashPaid.toFixed(2)}\n`
  result += `UPI Paid                  ₹${upiPaid.toFixed(2)}\n`
  result += `Advance Used              ₹${advanceUsed.toFixed(2)}\n\n`
  result += `Paid Now                  ₹${paidNow.toFixed(2)}\n\n`

  result += `${divider}\n`
  result += `*BALANCE SUMMARY*\n\n`
  result += `Remaining to Pay          ₹${remainingBalance.toFixed(2)}\n\n`
  result += `Customer Advance Balance  ₹${customerAdvanceBalance.toFixed(2)}\n\n`

  result += `${divider}\n`
  if (bill.loyaltyPointsEarned > 0) {
    result += `🎁 *Loyalty Earned :* +${bill.loyaltyPointsEarned} Points\n\n`
  }

  if (remainingBalance > 0 && upiId) {
    const upiLink = getUpiPaymentLink(upiId, shopName, remainingBalance, bill.invoiceNumber || bill.invoice_number || bill.id)
    result += `💳 *Pay Online via UPI (Net Due: ₹${remainingBalance.toFixed(2)}):*\n${upiLink}\n\n`
  }

  if (pdfUrl) {
    result += `📥 *Download PDF Receipt:* ${pdfUrl}\n\n`
  }

  result += `Thank you for visiting.\n`
  result += `Powered by PrintPro ERP`

  return result
}

/**
 * Generates an intent URL for UPI Payment
 */
export const getUpiPaymentLink = (upiId: string, shopName: string, amount: number, billNumber: string) => {
  if (!upiId) return ''
  const cleanUpi = encodeURIComponent(upiId.trim())
  const cleanName = encodeURIComponent((shopName || 'PrintPro').trim())
  const cleanAmount = Number(amount || 0).toFixed(2)
  const cleanNote = encodeURIComponent(`Bill ${billNumber || ''}`.trim())
  return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${cleanAmount}&cu=INR&tn=${cleanNote}`
}

/**
 * Formats standard bill receipt summary for WhatsApp sharing
 */
export const formatReceiptForWhatsApp = (bill: any, settings: any = {}) => {
  if (!bill) return ''

  const shopName = settings.shopName || 'PrintPro Studio'
  const billNum = bill.billSequence || bill.bill_sequence || bill.billNumber || bill.bill_number || bill.invoiceNumber || bill.id || 'N/A'
  const customerName = bill.customerName || bill.customer_name || 'Valued Customer'
  
  const total = Number(bill.total !== undefined ? bill.total : (bill.total_amount !== undefined ? bill.total_amount : 0))
  const amountPaid = Number(bill.amountPaid !== undefined ? bill.amountPaid : (bill.amount_paid !== undefined ? bill.amount_paid : (bill.paidTotal || 0)))
  const balance = Number(bill.balance !== undefined ? bill.balance : (bill.balance_amount !== undefined ? bill.balance_amount : Math.max(0, total - amountPaid)))
  
  const items = bill.items || []
  
  let msg = `🧾 *${shopName.toUpperCase()}*\n`
  msg += `Invoice: *#${billNum}*\n`
  msg += `Customer: *${customerName}*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━\n`
  msg += `*ITEMS:*\n`
  
  items.forEach((item: any, idx: number) => {
    const name = item.name || item.itemName || 'Item'
    const qty = item.quantity || item.qty || 1
    const rate = Number(item.rate || item.unitPrice || item.unit_price || 0)
    const lineTotal = Number(item.amount || item.total || (qty * rate))
    msg += `${idx + 1}. ${name} (${qty} x ₹${rate.toFixed(2)}) = ₹${lineTotal.toFixed(2)}\n`
  })
  
  msg += `━━━━━━━━━━━━━━━━━━━━\n`
  msg += `*Total Amount:* ₹${total.toFixed(2)}\n`
  msg += `*Amount Paid:* ₹${amountPaid.toFixed(2)}\n`
  
  if (balance <= 0) {
    msg += `*Status:* ✅ *Paid in Full*\n`
  } else {
    msg += `*Balance Due:* ⚠️ *₹${balance.toFixed(2)}*\n`
    if (settings.upiId) {
      msg += `\n*Pay via UPI ID:* ${settings.upiId}\n`
      msg += `UPI Link: ${getUpiPaymentLink(settings.upiId, shopName, balance, billNum)}\n`
    }
  }
  
  if (settings.footerNotes) {
    msg += `\n_${settings.footerNotes}_\n`
  }
  
  msg += `\nThank you for choosing ${shopName}!`
  return msg
}

