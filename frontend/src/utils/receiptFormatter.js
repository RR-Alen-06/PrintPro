/**
 * Formats a bill/invoice as a clean, modern, and professional WhatsApp receipt
 * adhering to strict POS ledger accounting standards.
 */
export const formatWhatsAppReceipt = (bill, settings = {}, business = {}, pdfUrl = '', extraData = {}) => {
  if (!bill) return ''

  const { bills = [], payments = [], customers = [] } = extraData

  // 1. Find Customer Info
  const customer = customers.find(c => String(c.id) === String(bill.customerId))
  const customerCode = customer?.code || ''
  const customerDisplay = bill.customerName || 'Walk-in Customer'
  const customerSuffix = customerCode ? ` (${customerCode})` : ''

  // 2. Previous Outstanding
  // Sum of unpaid balance before this bill date/creation
  const currentBillDate = bill.date ? new Date(bill.date) : new Date()
  const pastBills = bills.filter(b => 
    !b.deleted && 
    String(b.customerId) === String(bill.customerId) && 
    String(b.id) !== String(bill.id) &&
    (b.date ? new Date(b.date) < currentBillDate : true)
  )
  const previousOutstanding = pastBills.reduce((sum, b) => sum + Number(b.balance || 0), 0)

  // 3. Current Bill Total
  const currentBill = Number(bill.total || 0)

  // 4. Total Amount Due
  const totalAmountDue = previousOutstanding + currentBill

  // 5. Payment Received for this Transaction
  const billPayments = payments.filter(p => !p.deleted && String(p.billId) === String(bill.id))
  const cashPaid = billPayments.reduce((sum, p) => sum + Number(p.cashAmount || 0), 0)
  const upiPaid = billPayments.reduce((sum, p) => sum + Number(p.upiAmount || 0), 0)
  const advanceUsed = Number(bill.advanceUsed || 0)
  const paidNow = cashPaid + upiPaid + advanceUsed

  // 6. Remaining Balance
  const remainingBalance = Math.max(0, totalAmountDue - paidNow)

  // 7. Advance Created / Customer Advance Balance
  const customerAdvanceBalance = Number(customer?.advanceBalance || 0)

  // Formatting output
  const divider = '━━━━━━━━━━━━━━━━━━━━━━'
  
  let result = `🧾 *${(business?.shopName || 'PRINTPRO').toUpperCase()} ERP*\n\n`
  result += `🏪 *${(business?.shopName || 'ABC PRINTING CENTER').toUpperCase()}*\n`
  if (business?.phone) {
    result += `📞 ${business.phone}\n`
  }
  result += `\n`
  result += `Bill No : ${bill.id}\n`
  
  // Format date cleanly e.g. 14-Jul-2026
  let formattedDate = bill.date || ''
  if (bill.date) {
    try {
      const dObj = new Date(bill.date)
      const options = { day: '2-digit', month: 'short', year: 'numeric' }
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
    bill.items.forEach((item, index) => {
      const sidesSuffix = item.sides ? ` ${item.sides.charAt(0).toUpperCase() + item.sides.slice(1)}` : ''
      const printTypeSuffix = item.printType ? ` ${item.printType.toUpperCase()}` : ''
      result += `${index + 1}. ${item.name || item.itemName || 'Item'}${printTypeSuffix}${sidesSuffix}\n`
      result += `   Qty : ${item.qty} × ₹${Number(item.unitPrice || 0).toFixed(2)} = ₹${Number(item.amount || 0).toFixed(2)}\n\n`
    })
  } else {
    result += `No items\n\n`
  }

  result += `${divider}\n\n`
  result += `Subtotal              ₹${Number(bill.subtotal || 0).toFixed(2)}\n`
  
  const totalDiscount = (Number(bill.discountAmount || 0) + Number(bill.promoDiscount || 0) + Number(bill.loyaltyDiscount || 0))
  result += `Discount              ₹${totalDiscount.toFixed(2)}\n`
  
  const gstAmount = Number(bill.gstAmount || 0)
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

  if (pdfUrl) {
    result += `📥 *Download PDF Receipt:* ${pdfUrl}\n\n`
  }

  result += `Thank you for visiting.\n`
  result += `Powered by PrintPro ERP`

  return result
}
