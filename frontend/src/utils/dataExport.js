/**
 * Data Export utilities for backup and reporting
 */

export const exportToJSON = (data, filename = 'printpro-backup.json') => {
  const jsonString = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  downloadFile(blob, filename)
}

export const exportToCSV = (data, filename = 'printpro-export.csv') => {
  const csv = convertToCSV(data)
  // UTF-8 BOM prefix ensures Excel opens the file correctly (handles ₹ and unicode)
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  downloadFile(blob, filename)
}

const downloadFile = (blob, filename) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

const escapeCSVCell = (value) => {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Always quote strings that contain commas, quotes, newlines, or ₹
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes('₹')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const convertToCSV = (data) => {
  if (!Array.isArray(data) || data.length === 0) return ''

  const keys = Object.keys(data[0])
  const csv = [
    keys.map(escapeCSVCell).join(','),
    ...data.map((row) =>
      keys.map((key) => {
        const value = row[key]
        if (typeof value === 'object' && value !== null) {
          return escapeCSVCell(JSON.stringify(value))
        }
        return escapeCSVCell(value)
      }).join(',')
    ),
  ]
  return csv.join('\n')
}

import { SequenceService } from '../services/sequenceService'

export const exportBillsToCSV = (bills, filename = 'bills-export.csv') => {
  const flatBills = bills.map((bill) => ({
    'Invoice / Bill Number': bill.invoiceNumber || SequenceService.formatDisplayCode('bill', bill.id, 'INV'),
    'Customer Code': bill.customerCode || (bill.customerId ? SequenceService.formatDisplayCode('customer', bill.customerId, 'CUS') : ''),
    'Customer Name': bill.customerName || '',
    'Customer Type': bill.customerType || '',
    'Date': bill.date,
    'Due Date': bill.dueDate || '',
    'Items': (bill.items || []).map((i) => `${i.itemName || i.name} x${i.qty}`).join('; '),
    'Subtotal (₹)': Number(bill.subtotal || 0).toFixed(2),
    'Discount Type': bill.discountType || '',
    'Discount Value (₹)': Number(bill.discountValue || 0).toFixed(2),
    'Total (₹)': Number(bill.total || 0).toFixed(2),
    'Amount Paid (₹)': Number(bill.amountPaid || 0).toFixed(2),
    'Balance (₹)': Number(bill.balance || 0).toFixed(2),
    'Status': bill.status || '',
    'Cash Paid (₹)': Number(bill.paymentMethod?.cash || 0).toFixed(2),
    'UPI Paid (₹)': Number(bill.paymentMethod?.upi || 0).toFixed(2),
    'Notes': bill.notes || '',
  }))
  exportToCSV(flatBills, filename)
}

export const exportCustomersToCSV = (customers, filename = 'customers-export.csv') => {
  const flatCustomers = customers.map((customer) => ({
    'Customer Code': customer.customerCode || SequenceService.formatDisplayCode('customer', customer.id, 'CUS'),
    'Type': customer.type,
    'Name': customer.name,
    'Phone': customer.phone,
    'Email': customer.email,
    'Credit Balance': Number(customer.creditBalance || 0).toFixed(2),
    'Status': customer.status,
  }))
  exportToCSV(flatCustomers, filename)
}

export const exportInventoryToCSV = (inventory, filename = 'inventory-export.csv') => {
  const flatInventory = inventory.map((item) => ({
    'Item Code': item.itemCode || SequenceService.formatDisplayCode('inventory', item.id, 'ITM'),
    'Name': item.name,
    'Color Single': item.colorSingle !== undefined ? item.colorSingle : (item.color_single ?? 0),
    'Color Double': item.colorDouble !== undefined ? item.colorDouble : (item.color_double ?? 0),
    'B/W Single': item.bwSingle !== undefined ? item.bwSingle : (item.bw_single ?? 0),
    'B/W Double': item.bwDouble !== undefined ? item.bwDouble : (item.bw_double ?? 0),
    'Stock': item.stock !== undefined ? item.stock : 0,
  }))
  exportToCSV(flatInventory, filename)
}

export const exportPaymentsToCSV = (payments, filename = 'payments-export.csv') => {
  const flatPayments = payments.map((payment) => ({
    'Payment Code': payment.paymentCode || SequenceService.formatDisplayCode('payment', payment.id, 'PAY'),
    'Bill / Invoice Number': payment.invoiceNumber || (payment.billId ? SequenceService.formatDisplayCode('bill', payment.billId, 'INV') : ''),
    'Customer Code': payment.customerCode || (payment.customerId ? SequenceService.formatDisplayCode('customer', payment.customerId, 'CUS') : ''),
    'Date': payment.date ? payment.date.slice(0, 10) : '',
    'Cash (₹)': Number(payment.cashAmount || 0).toFixed(2),
    'UPI (₹)': Number(payment.upiAmount || 0).toFixed(2),
    'Total Paid (₹)': Number(payment.totalPaid || 0).toFixed(2),
    'Payment Type': payment.paymentType || '',
    'Excess Credit (₹)': Number(payment.excessCredit || 0).toFixed(2),
  }))
  exportToCSV(flatPayments, filename)
}

export const exportExpensesToCSV = (expenses, filename = 'expenses-export.csv') => {
  const flat = expenses.map((e) => ({
    'Expense Code': e.voucherNumber || e.voucher_number || e.expenseCode || SequenceService.formatDisplayCode('expense', e.id, 'EXP'),
    'Date': e.date,
    'Category': e.category || 'General',
    'Description': e.description || '',
    'Vendor': e.vendor || '',
    'Total Amount (₹)': Number(e.amount || 0).toFixed(2),
    'Payment Method': e.paymentMethod || e.payment_method || 'Cash',
  }))
  exportToCSV(flat, filename)
}

export const exportAdvancesToCSV = (advances, filename = 'advances-export.csv') => {
  const flat = advances.map((a) => ({
    'Receipt Number': a.receiptNumber || a.receipt_number || a.advanceNumber || SequenceService.formatDisplayCode('advance', a.id, 'ADV'),
    'Customer Name': a.customerName || a.customer_name || '',
    'Customer Code': a.customerCode || '',
    'Date': a.date,
    'Deposit Amount (₹)': Number(a.amount || 0).toFixed(2),
    'Payment Method': a.paymentMethod || a.payment_method || 'Cash',
    'Notes': a.notes || '',
  }))
  exportToCSV(flat, filename)
}

export const exportGroupsToCSV = (groups, filename = 'customer-groups-export.csv') => {
  const flat = groups.map((g) => ({
    'Group ID': g.id,
    'Group Name': g.name || '',
    'Contact Person': g.contactPerson || '',
    'Phone': g.phone || '',
    'Email': g.email || '',
    'Members Count': (g.members || []).length,
    'Total Outstanding (₹)': Number(g.totalOutstanding || 0).toFixed(2),
    'Credit Limit (₹)': Number(g.creditLimit || 0).toFixed(2),
  }))
  exportToCSV(flat, filename)
}

export const createFullBackup = (appState) => {
  const backup = {
    version: '2.0',
    app: 'PrintPro ERP',
    exportDate: new Date().toISOString(),
    data: {
      business: appState.business || {},
      customers: appState.customers || [],
      customerGroups: appState.customerGroups || appState.groups || [],
      inventory: appState.inventory || [],
      bills: appState.bills || [],
      payments: appState.payments || [],
      expenses: appState.expenses || [],
      advancePayments: appState.advancePayments || appState.advances || [],
      counters: appState.counters || {},
      sequences: appState.sequences || {},
      settings: appState.settings || {},
    },
  }
  exportToJSON(backup, `printpro-full-backup-${new Date().toISOString().slice(0, 10)}.json`)
}

