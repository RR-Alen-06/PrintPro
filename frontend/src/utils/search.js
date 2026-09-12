/**
 * Advanced search and filtering utilities
 */

export const searchBills = (bills, query, filters = {}) => {
  let results = bills.filter((bill) => !bill.deleted)

  if (!query && Object.keys(filters).length === 0) return results

  // Text search
  if (query) {
    const lowerQuery = query.toLowerCase()
    results = results.filter(
      (bill) =>
        (bill.id && String(bill.id).toLowerCase().includes(lowerQuery)) ||
        (bill.invoiceNumber && String(bill.invoiceNumber).toLowerCase().includes(lowerQuery)) ||
        (bill.invoice_number && String(bill.invoice_number).toLowerCase().includes(lowerQuery)) ||
        (bill.customerName && String(bill.customerName).toLowerCase().includes(lowerQuery)) ||
        (bill.customer_name && String(bill.customer_name).toLowerCase().includes(lowerQuery)) ||
        (bill.customerId && String(bill.customerId).toLowerCase().includes(lowerQuery)) ||
        (bill.customer_id && String(bill.customer_id).toLowerCase().includes(lowerQuery)) ||
        (bill.notes && String(bill.notes).toLowerCase().includes(lowerQuery))
    )
  }

  // Filters
  if (filters.status) {
    results = results.filter((bill) => bill.status === filters.status)
  }

  if (filters.dateFrom) {
    results = results.filter((bill) => bill.date >= filters.dateFrom)
  }

  if (filters.dateTo) {
    results = results.filter((bill) => bill.date <= filters.dateTo)
  }

  if (filters.minAmount !== undefined && filters.minAmount !== '') {
    results = results.filter((bill) => bill.total >= Number(filters.minAmount))
  }

  if (filters.maxAmount !== undefined && filters.maxAmount !== '') {
    results = results.filter((bill) => bill.total <= Number(filters.maxAmount))
  }

  if (filters.customerId) {
    results = results.filter((bill) => bill.customerId === filters.customerId)
  }

  if (filters.customerType) {
    results = results.filter((bill) => bill.customerType === filters.customerType)
  }

  return results
}

export const searchCustomers = (customers, query, filters = {}) => {
  let results = [...customers]

  if (!query && Object.keys(filters).length === 0) return results

  // Text search
  if (query) {
    const lowerQuery = query.toLowerCase()
    results = results.filter(
      (customer) =>
        (customer.id && String(customer.id).toLowerCase().includes(lowerQuery)) ||
        (customer.customerCode && String(customer.customerCode).toLowerCase().includes(lowerQuery)) ||
        (customer.customer_code && String(customer.customer_code).toLowerCase().includes(lowerQuery)) ||
        (customer.name && String(customer.name).toLowerCase().includes(lowerQuery)) ||
        (customer.phone && String(customer.phone).includes(query)) ||
        (customer.email && String(customer.email).toLowerCase().includes(lowerQuery))
    )
  }

  // Filters
  if (filters.type) {
    results = results.filter((customer) => customer.type === filters.type)
  }

  if (filters.status) {
    results = results.filter((customer) => customer.status === filters.status)
  }

  if (filters.hasCredit !== undefined && filters.hasCredit !== '') {
    if (filters.hasCredit === true || filters.hasCredit === 'true') {
      results = results.filter((customer) => customer.creditBalance > 0)
    } else {
      results = results.filter((customer) => !customer.creditBalance || customer.creditBalance === 0)
    }
  }

  return results
}

export const searchInventory = (inventory, query, filters = {}) => {
  let results = [...inventory]

  if (!query && Object.keys(filters).length === 0) return results

  // Text search
  if (query) {
    const lowerQuery = query.toLowerCase()
    results = results.filter(
      (item) =>
        (item.name && String(item.name).toLowerCase().includes(lowerQuery)) ||
        (item.id && String(item.id).toLowerCase().includes(lowerQuery)) ||
        (item.itemCode && String(item.itemCode).toLowerCase().includes(lowerQuery)) ||
        (item.item_code && String(item.item_code).toLowerCase().includes(lowerQuery)) ||
        (item.hsnCode && String(item.hsnCode).toLowerCase().includes(lowerQuery)) ||
        (item.hsn_code && String(item.hsn_code).toLowerCase().includes(lowerQuery))
    )
  }

  // Filters
  if (filters.lowStock !== undefined) {
    if (filters.lowStock) {
      results = results.filter((item) => item.stock < 10)
    }
  }

  return results
}

export const sortResults = (results, sortBy = 'name', order = 'asc') => {
  const sorted = [...results]

  sorted.sort((a, b) => {
    let aVal = a[sortBy]
    let bVal = b[sortBy]

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
    }

    if (aVal < bVal) return order === 'asc' ? -1 : 1
    if (aVal > bVal) return order === 'asc' ? 1 : -1
    return 0
  })

  return sorted
}

export const filterByDateRange = (items, dateField, startDate, endDate) => {
  return items.filter((item) => {
    const itemDate = new Date(item[dateField])
    return itemDate >= new Date(startDate) && itemDate <= new Date(endDate)
  })
}
