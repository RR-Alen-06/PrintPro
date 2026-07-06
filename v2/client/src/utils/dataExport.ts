/**
 * Data Export utilities for backup and reporting
 */

export const exportToJSON = (data: any, filename = 'printpro-backup.json') => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  downloadFile(blob, filename);
};

export const exportToCSV = (data: any[], filename = 'printpro-export.csv') => {
  const csv = convertToCSV(data);
  // UTF-8 BOM prefix ensures Excel opens the file correctly (handles ₹ and unicode)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, filename);
};

const downloadFile = (blob: Blob, filename: string) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

const escapeCSVCell = (value: any) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Always quote strings that contain commas, quotes, newlines, or ₹
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes('₹')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const convertToCSV = (data: any[]) => {
  if (!Array.isArray(data) || data.length === 0) return '';

  const keys = Object.keys(data[0]);
  const csv = [
    keys.map(escapeCSVCell).join(','),
    ...data.map((row) =>
      keys.map((key) => {
        const value = row[key];
        if (typeof value === 'object' && value !== null) {
          return escapeCSVCell(JSON.stringify(value));
        }
        return escapeCSVCell(value);
      }).join(',')
    ),
  ];
  return csv.join('\n');
};

export const exportBillsToCSV = (bills: any[], filename = 'bills-export.csv') => {
  const flatBills = bills.map((bill) => ({
    'Bill ID': bill._id || bill.id,
    'Customer Name': bill.customerName || '',
    'Date': bill.date,
    'Items': (bill.items || []).map((i: any) => `${i.itemName || i.name} x${i.qty}`).join('; '),
    'Subtotal (₹)': Number(bill.subtotal || 0).toFixed(2),
    'Discount Value (₹)': Number(bill.discountAmount || bill.discountValue || 0).toFixed(2),
    'Total (₹)': Number(bill.total || 0).toFixed(2),
    'Amount Paid (₹)': Number(bill.amountPaid || 0).toFixed(2),
    'Balance (₹)': Number(bill.balance || 0).toFixed(2),
    'Status': bill.status || '',
  }));
  exportToCSV(flatBills, filename);
};

export const exportCustomersToCSV = (customers: any[], filename = 'customers-export.csv') => {
  const flatCustomers = customers.map((customer) => ({
    'Customer ID': customer._id || customer.id,
    'Type': customer.type,
    'Name': customer.name,
    'Phone': customer.phone,
    'Email': customer.email,
    'Credit Balance': customer.creditBalance || 0,
    'Status': customer.status,
  }));
  exportToCSV(flatCustomers, filename);
};

export const exportInventoryToCSV = (inventory: any[], filename = 'inventory-export.csv') => {
  const flatInventory = inventory.map((item) => ({
    'Item ID': item._id || item.id,
    'Name': item.name,
    'Color Single': item.colorSingle,
    'Color Double': item.colorDouble,
    'B/W Single': item.bwSingle,
    'B/W Double': item.bwDouble,
  }));
  exportToCSV(flatInventory, filename);
};

export const exportPaymentsToCSV = (payments: any[], filename = 'payments-export.csv') => {
  const flatPayments = payments.map((payment) => ({
    'Payment ID': payment._id || payment.id,
    'Bill ID': payment.billId,
    'Customer ID': payment.customerId,
    'Date': payment.date ? payment.date.slice(0, 10) : '',
    'Cash': payment.cashAmount,
    'UPI': payment.upiAmount,
    'Total Paid': payment.totalPaid,
    'Payment Type': payment.paymentType,
  }));
  exportToCSV(flatPayments, filename);
};

export const exportExpensesToCSV = (expenses: any[], filename = 'expenses-export.csv') => {
  const flat = expenses.map((e) => ({
    'Expense ID': e._id || e.id,
    'Date': e.date,
    'Description': e.description,
    'Total Amount (₹)': Number(e.amount).toFixed(2),
    'Cash Paid (₹)': Number(e.cashAmount || 0).toFixed(2),
    'UPI Paid (₹)': Number(e.upiAmount || 0).toFixed(2),
  }));
  exportToCSV(flat, filename);
};

export const createFullBackup = (appState: any) => {
  const backup = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    data: appState,
  };
  exportToJSON(backup, `printpro-full-backup-${new Date().toISOString().slice(0, 10)}.json`);
};
