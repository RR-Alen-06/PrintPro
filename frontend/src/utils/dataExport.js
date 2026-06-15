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
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadFile(blob, filename)
}

const downloadFile = (blob, filename) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

const convertToCSV = (data) => {
  if (!Array.isArray(data) || data.length === 0) return ''

  const keys = Object.keys(data[0])
  const csv = [
    keys.join(','),
    ...data.map((row) =>
      keys.map((key) => {
        const value = row[key]
        if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""')
        if (typeof value === 'string' && value.includes(',')) return `"${value.replace(/"/g, '""')}"`
        return value
      }).join(',')
    ),
  ]
  return csv.join('\n')
}

export const exportBillsToCSV = (bills, filename = 'bills-export.csv') => {
  const flatBills = bills.map((bill) => ({
    'Bill ID': bill.id,
    'Customer ID': bill.customerId,
    'Customer Name': bill.customerName,
    'Date': bill.date,
    'Due Date': bill.dueDate,
    'Subtotal': bill.subtotal,
    'Discount': bill.discountValue,
    'Total': bill.total,
    'Paid': bill.amountPaid,
    'Balance': bill.balance,
    'Status': bill.status,
    'Payment Method': bill.paymentMethod ? `Cash: ${bill.paymentMethod.cash}, UPI: ${bill.paymentMethod.upi}` : 'None',
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
    'Date': new Date(payment.date).toLocaleDateString(),
    'Cash': payment.cashAmount,
    'UPI': payment.upiAmount,
    'Total Paid': payment.totalPaid,
    'Payment Type': payment.paymentType,
    'Excess Credit': payment.excessCredit || 0,
  }))
  exportToCSV(flatPayments, filename)
}

export const createFullBackup = (appState) => {
  const backup = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    data: {
      business: appState.business,
      customers: appState.customers,
      inventory: appState.inventory,
      bills: appState.bills,
      payments: appState.payments,
      settings: appState.settings,
    },
  }
  exportToJSON(backup, `printpro-full-backup-${new Date().toISOString().slice(0, 10)}.json`)
}
