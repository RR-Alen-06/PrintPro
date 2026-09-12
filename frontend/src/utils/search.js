/**
 * Advanced omni-search and filtering utilities for PrintPro ERP
 */

/**
 * Searches bills across sequence codes, customer info, phone, notes, and line items.
 */
export const searchBills = (bills = [], query = '', filters = {}) => {
  let results = (bills || []).filter((bill) => bill && !bill.deleted && !bill.deleted_at)

  if (!query && Object.keys(filters).length === 0) return results

  // Text search
  if (query && query.trim()) {
    const lowerQuery = query.toLowerCase().trim()
    results = results.filter((bill) => {
      const idMatch = bill.id && String(bill.id).toLowerCase().includes(lowerQuery)
      const seqMatch = (bill.billSequence && String(bill.billSequence).toLowerCase().includes(lowerQuery)) ||
                       (bill.bill_sequence && String(bill.bill_sequence).toLowerCase().includes(lowerQuery)) ||
                       (bill.billNumber && String(bill.billNumber).toLowerCase().includes(lowerQuery)) ||
                       (bill.bill_number && String(bill.bill_number).toLowerCase().includes(lowerQuery)) ||
                       (bill.invoiceNumber && String(bill.invoiceNumber).toLowerCase().includes(lowerQuery)) ||
                       (bill.invoice_number && String(bill.invoice_number).toLowerCase().includes(lowerQuery))
      const cusMatch = (bill.customerName && String(bill.customerName).toLowerCase().includes(lowerQuery)) ||
                       (bill.customer_name && String(bill.customer_name).toLowerCase().includes(lowerQuery)) ||
                       (bill.customerId && String(bill.customerId).toLowerCase().includes(lowerQuery)) ||
                       (bill.customer_id && String(bill.customer_id).toLowerCase().includes(lowerQuery))
      const phoneMatch = (bill.customerPhone && String(bill.customerPhone).includes(lowerQuery)) ||
                         (bill.customer_phone && String(bill.customer_phone).includes(lowerQuery)) ||
                         (bill.phone && String(bill.phone).includes(lowerQuery))
      const notesMatch = bill.notes && String(bill.notes).toLowerCase().includes(lowerQuery)

      // Line items content search
      const itemsMatch = Array.isArray(bill.items) && bill.items.some((item) => {
        const name = item.name || item.itemName || item.item_name || ''
        const desc = item.description || ''
        return name.toLowerCase().includes(lowerQuery) || desc.toLowerCase().includes(lowerQuery)
      })

      return idMatch || seqMatch || cusMatch || phoneMatch || notesMatch || itemsMatch
    })
  }

  // Filters
  if (filters.status && filters.status !== 'all') {
    results = results.filter((bill) => {
      const status = String(bill.status || '').toLowerCase()
      return status === String(filters.status).toLowerCase()
    })
  }

  if (filters.dateFrom) {
    results = results.filter((bill) => bill.date && bill.date >= filters.dateFrom)
  }

  if (filters.dateTo) {
    results = results.filter((bill) => bill.date && bill.date <= filters.dateTo)
  }

  if (filters.minAmount !== undefined && filters.minAmount !== '') {
    results = results.filter((bill) => {
      const total = Number(bill.total !== undefined ? bill.total : (bill.total_amount || 0))
      return total >= Number(filters.minAmount)
    })
  }

  if (filters.maxAmount !== undefined && filters.maxAmount !== '') {
    results = results.filter((bill) => {
      const total = Number(bill.total !== undefined ? bill.total : (bill.total_amount || 0))
      return total <= Number(filters.maxAmount)
    })
  }

  if (filters.customerId) {
    results = results.filter((bill) => {
      const cId = bill.customerId || bill.customer_id
      return String(cId) === String(filters.customerId)
    })
  }

  if (filters.customerType && filters.customerType !== 'all') {
    results = results.filter((bill) => {
      const type = bill.customerType || bill.customer_type
      return type === filters.customerType
    })
  }

  return results
}

/**
 * Searches customers across name, code, phone, email, GST, and address.
 */
export const searchCustomers = (customers = [], query = '', filters = {}) => {
  let results = (customers || []).filter((customer) => customer && !customer.deleted && !customer.deleted_at)

  if (!query && Object.keys(filters).length === 0) return results

  // Text search
  if (query && query.trim()) {
    const lowerQuery = query.toLowerCase().trim()
    results = results.filter((customer) => {
      const idMatch = customer.id && String(customer.id).toLowerCase().includes(lowerQuery)
      const codeMatch = (customer.code && String(customer.code).toLowerCase().includes(lowerQuery)) ||
                        (customer.customerCode && String(customer.customerCode).toLowerCase().includes(lowerQuery)) ||
                        (customer.customer_code && String(customer.customer_code).toLowerCase().includes(lowerQuery))
      const nameMatch = customer.name && String(customer.name).toLowerCase().includes(lowerQuery)
      const phoneMatch = customer.phone && String(customer.phone).includes(lowerQuery)
      const emailMatch = customer.email && String(customer.email).toLowerCase().includes(lowerQuery)
      const gstMatch = (customer.gstNumber && String(customer.gstNumber).toLowerCase().includes(lowerQuery)) ||
                       (customer.gst_number && String(customer.gst_number).toLowerCase().includes(lowerQuery)) ||
                       (customer.gstin && String(customer.gstin).toLowerCase().includes(lowerQuery))
      const addressMatch = customer.address && String(customer.address).toLowerCase().includes(lowerQuery)

      return idMatch || codeMatch || nameMatch || phoneMatch || emailMatch || gstMatch || addressMatch
    })
  }

  // Filters
  if (filters.type && filters.type !== 'all') {
    results = results.filter((customer) => customer.type === filters.type)
  }

  if (filters.status && filters.status !== 'all') {
    results = results.filter((customer) => customer.status === filters.status)
  }

  if (filters.hasCredit !== undefined && filters.hasCredit !== '' && filters.hasCredit !== 'all') {
    if (filters.hasCredit === true || filters.hasCredit === 'true') {
      results = results.filter((customer) => {
        const bal = Number(customer.creditBalance || customer.credit_balance || customer.balanceDue || customer.balance_due || 0)
        return bal > 0
      })
    } else {
      results = results.filter((customer) => {
        const bal = Number(customer.creditBalance || customer.credit_balance || customer.balanceDue || customer.balance_due || 0)
        return bal <= 0
      })
    }
  }

  return results
}

/**
 * Searches inventory catalog across name, codes, HSN, description, and category.
 */
export const searchInventory = (inventory = [], query = '', filters = {}) => {
  let results = (inventory || []).filter((item) => item && !item.deleted && !item.deleted_at)

  if (!query && Object.keys(filters).length === 0) return results

  // Text search
  if (query && query.trim()) {
    const lowerQuery = query.toLowerCase().trim()
    results = results.filter((item) => {
      const nameMatch = item.name && String(item.name).toLowerCase().includes(lowerQuery)
      const idMatch = item.id && String(item.id).toLowerCase().includes(lowerQuery)
      const codeMatch = (item.code && String(item.code).toLowerCase().includes(lowerQuery)) ||
                        (item.itemCode && String(item.itemCode).toLowerCase().includes(lowerQuery)) ||
                        (item.item_code && String(item.item_code).toLowerCase().includes(lowerQuery))
      const hsnMatch = (item.hsnCode && String(item.hsnCode).toLowerCase().includes(lowerQuery)) ||
                       (item.hsn_code && String(item.hsn_code).toLowerCase().includes(lowerQuery))
      const descMatch = item.description && String(item.description).toLowerCase().includes(lowerQuery)
      const catMatch = item.category && String(item.category).toLowerCase().includes(lowerQuery)

      return nameMatch || idMatch || codeMatch || hsnMatch || descMatch || catMatch
    })
  }

  if (filters.type && filters.type !== 'all') {
    results = results.filter((item) => {
      if (filters.type === 'print') {
        return item.colorSingle !== undefined || item.color_single !== undefined || item.category === 'print'
      }
      return true
    })
  }

  return results
}

/**
 * Searches expenses across voucher numbers, category, description, vendor, and payment method.
 */
export const searchExpenses = (expenses = [], query = '', filters = {}) => {
  let results = (expenses || []).filter((exp) => exp && !exp.deleted && !exp.deleted_at)

  if (!query && Object.keys(filters).length === 0) return results

  if (query && query.trim()) {
    const lowerQuery = query.toLowerCase().trim()
    results = results.filter((exp) => {
      const idMatch = exp.id && String(exp.id).toLowerCase().includes(lowerQuery)
      const voucherMatch = (exp.voucherNumber && String(exp.voucherNumber).toLowerCase().includes(lowerQuery)) ||
                           (exp.voucher_number && String(exp.voucher_number).toLowerCase().includes(lowerQuery)) ||
                           (exp.expenseNumber && String(exp.expenseNumber).toLowerCase().includes(lowerQuery)) ||
                           (exp.expense_number && String(exp.expense_number).toLowerCase().includes(lowerQuery))
      const catMatch = exp.category && String(exp.category).toLowerCase().includes(lowerQuery)
      const descMatch = exp.description && String(exp.description).toLowerCase().includes(lowerQuery)
      const vendorMatch = (exp.vendor && String(exp.vendor).toLowerCase().includes(lowerQuery)) ||
                          (exp.payee && String(exp.payee).toLowerCase().includes(lowerQuery))
      const methodMatch = (exp.paymentMethod && String(exp.paymentMethod).toLowerCase().includes(lowerQuery)) ||
                          (exp.payment_method && String(exp.payment_method).toLowerCase().includes(lowerQuery))

      return idMatch || voucherMatch || catMatch || descMatch || vendorMatch || methodMatch
    })
  }

  if (filters.category && filters.category !== 'all') {
    results = results.filter((exp) => exp.category === filters.category)
  }

  if (filters.paymentMethod && filters.paymentMethod !== 'all') {
    results = results.filter((exp) => {
      const method = exp.paymentMethod || exp.payment_method
      return method === filters.paymentMethod
    })
  }

  return results
}

/**
 * Searches advance payment receipts across receipt number, customer name, notes, and payment mode.
 */
export const searchAdvances = (advances = [], query = '', filters = {}) => {
  let results = (advances || []).filter((adv) => adv && !adv.deleted && !adv.deleted_at)

  if (!query && Object.keys(filters).length === 0) return results

  if (query && query.trim()) {
    const lowerQuery = query.toLowerCase().trim()
    results = results.filter((adv) => {
      const idMatch = adv.id && String(adv.id).toLowerCase().includes(lowerQuery)
      const receiptMatch = (adv.receiptNumber && String(adv.receiptNumber).toLowerCase().includes(lowerQuery)) ||
                           (adv.receipt_number && String(adv.receipt_number).toLowerCase().includes(lowerQuery)) ||
                           (adv.advanceNumber && String(adv.advanceNumber).toLowerCase().includes(lowerQuery)) ||
                           (adv.advance_number && String(adv.advance_number).toLowerCase().includes(lowerQuery))
      const cusMatch = (adv.customerName && String(adv.customerName).toLowerCase().includes(lowerQuery)) ||
                       (adv.customer_name && String(adv.customer_name).toLowerCase().includes(lowerQuery)) ||
                       (adv.customerId && String(adv.customerId).toLowerCase().includes(lowerQuery)) ||
                       (adv.customer_id && String(adv.customer_id).toLowerCase().includes(lowerQuery))
      const notesMatch = adv.notes && String(adv.notes).toLowerCase().includes(lowerQuery)
      const methodMatch = (adv.paymentMethod && String(adv.paymentMethod).toLowerCase().includes(lowerQuery)) ||
                          (adv.payment_method && String(adv.payment_method).toLowerCase().includes(lowerQuery))

      return idMatch || receiptMatch || cusMatch || notesMatch || methodMatch
    })
  }

  if (filters.status && filters.status !== 'all') {
    results = results.filter((adv) => adv.status === filters.status)
  }

  return results
}

/**
 * Global omni-search aggregating top results across all 5 registers for quick header preview.
 */
export const globalOmniSearch = ({
  bills = [],
  customers = [],
  inventory = [],
  expenses = [],
  advances = [],
  query = '',
  limitPerCategory = 4,
}) => {
  if (!query || !query.trim()) {
    return {
      bills: [],
      customers: [],
      inventory: [],
      expenses: [],
      advances: [],
      totalMatches: 0,
    }
  }

  const matchedBills = searchBills(bills, query).slice(0, limitPerCategory)
  const matchedCustomers = searchCustomers(customers, query).slice(0, limitPerCategory)
  const matchedInventory = searchInventory(inventory, query).slice(0, limitPerCategory)
  const matchedExpenses = searchExpenses(expenses, query).slice(0, limitPerCategory)
  const matchedAdvances = searchAdvances(advances, query).slice(0, limitPerCategory)

  const totalMatches =
    matchedBills.length +
    matchedCustomers.length +
    matchedInventory.length +
    matchedExpenses.length +
    matchedAdvances.length

  return {
    bills: matchedBills,
    customers: matchedCustomers,
    inventory: matchedInventory,
    expenses: matchedExpenses,
    advances: matchedAdvances,
    totalMatches,
  }
}

/**
 * Flexible sorter for search results
 */
export const sortResults = (results = [], sortBy = 'name', order = 'asc') => {
  const sorted = [...(results || [])]

  sorted.sort((a, b) => {
    let aVal = a[sortBy]
    let bVal = b[sortBy]

    // Fallbacks for common polymorphic fields
    if (sortBy === 'name') {
      aVal = a.name || a.customerName || a.customer_name || ''
      bVal = b.name || b.customerName || b.customer_name || ''
    } else if (sortBy === 'total') {
      aVal = Number(a.total !== undefined ? a.total : (a.total_amount || 0))
      bVal = Number(b.total !== undefined ? b.total : (b.total_amount || 0))
    } else if (sortBy === 'date') {
      aVal = a.date || a.created_at || ''
      bVal = b.date || b.created_at || ''
    } else if (sortBy === 'creditBalance') {
      aVal = Number(a.creditBalance || a.credit_balance || a.balanceDue || a.balance_due || 0)
      bVal = Number(b.creditBalance || b.credit_balance || b.balanceDue || b.balance_due || 0)
    }

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = (bVal || '').toLowerCase()
    }

    if (aVal < bVal) return order === 'asc' ? -1 : 1
    if (aVal > bVal) return order === 'asc' ? 1 : -1
    return 0
  })

  return sorted
}

export const filterByDateRange = (items = [], dateField = 'date', startDate, endDate) => {
  return (items || []).filter((item) => {
    if (!item[dateField]) return false
    const itemDate = new Date(item[dateField])
    return itemDate >= new Date(startDate) && itemDate <= new Date(endDate)
  })
}
