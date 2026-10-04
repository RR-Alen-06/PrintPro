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

export const exportBillsToCSV = (bills, filename = 'bills-export.csv') => {
  const flatBills = bills.map((bill) => ({
    'Bill ID': bill.id,
    'Customer ID': bill.customerId || '',
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
    'Customer ID': customer.id,
    'Type': customer.type,
    'Name': customer.name,
    'Phone': customer.phone,
    'Email': customer.email,
    'Credit Balance': customer.creditBalance,
    'Status': customer.status,
  }))
  exportToCSV(flatCustomers, filename)
}

export const exportInventoryToCSV = (inventory, filename = 'inventory-export.csv') => {
  const flatInventory = inventory.map((item) => ({
    'Item ID': item.id,
    'Name': item.name,
    'Color Single': item.colorSingle,
    'Color Double': item.colorDouble,
    'B/W Single': item.bwSingle,
    'B/W Double': item.bwDouble,
    'Stock': item.stock,
  }))
  exportToCSV(flatInventory, filename)
}

export const exportPaymentsToCSV = (payments, filename = 'payments-export.csv') => {
  const flatPayments = payments.map((payment) => ({
    'Payment ID': payment.id,
    'Bill ID': payment.billId,
    'Customer ID': payment.customerId,
    'Date': payment.date ? payment.date.slice(0, 10) : '',
    'Cash': payment.cashAmount,
    'UPI': payment.upiAmount,
    'Total Paid': payment.totalPaid,
    'Payment Type': payment.paymentType,
    'Excess Credit': payment.excessCredit || 0,
  }))
  exportToCSV(flatPayments, filename)
}

export const exportExpensesToCSV = (expenses, filename = 'expenses-export.csv') => {
  const flat = expenses.map((e) => ({
    'Expense ID': e.id,
    'Date': e.date,
    'Description': e.description,
    'Total Amount (₹)': Number(e.amount).toFixed(2),
    'Cash Paid (₹)': Number(e.cashAmount || 0).toFixed(2),
    'UPI Paid (₹)': Number(e.upiAmount || 0).toFixed(2),
  }))
  exportToCSV(flat, filename)
}

export const createFullBackup = (appState) => {
  const backup = {
    version: '1.1',
    exportDate: new Date().toISOString(),
    data: {
      business: appState.business,
      customers: appState.customers,
      inventory: appState.inventory,
      bills: appState.bills,
      payments: appState.payments,
      expenses: appState.expenses || [],
      settings: appState.settings,
    },
  }
  exportToJSON(backup, `printpro-full-backup-${new Date().toISOString().slice(0, 10)}.json`)
}
