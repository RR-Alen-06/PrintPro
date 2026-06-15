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
        bill.id.toLowerCase().includes(lowerQuery) ||
        bill.customerName.toLowerCase().includes(lowerQuery) ||
        bill.customerId.toLowerCase().includes(lowerQuery) ||
        (bill.notes && bill.notes.toLowerCase().includes(lowerQuery))
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
        customer.id.toLowerCase().includes(lowerQuery) ||
        customer.name.toLowerCase().includes(lowerQuery) ||
        customer.phone.includes(query) ||
        customer.email.toLowerCase().includes(lowerQuery)
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
    results = results.filter((item) => item.name.toLowerCase().includes(lowerQuery) || item.id.toLowerCase().includes(lowerQuery))
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
