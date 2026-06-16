import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'

const AppContext = createContext(null)

const initialState = {
  business: {
    shopName: 'PrintPro',
    ownerName: 'Shop Owner',
    phone: '0000000000',
    address: 'Enter your shop address',
    gstin: '',
    upiId: '',
  },
  customers: [
    { id: 'RC-001', type: 'regular', name: 'Amit Sharma', phone: '9876543210', email: 'amit@example.com', creditBalance: 150.0, status: 'active' },
    { id: 'RC-002', type: 'regular', name: 'Pooja Enterprises', phone: '9123456780', email: 'pooja@example.com', creditBalance: 0, status: 'active' },
    { id: 'RND-001', type: 'random', name: 'Walk-in Customer', phone: '', email: '', creditBalance: 0, status: 'new' },
  ],
  inventory: [
    { id: 'item-1', name: 'A4 Paper', colorSingle: 10.0, colorDouble: 18.0, bwSingle: 5.0, bwDouble: 9.0 },
    { id: 'item-2', name: 'A5 Paper', colorSingle: 8.0, colorDouble: 14.0, bwSingle: 4.0, bwDouble: 7.0 },
  ],
  bills: [
    {
      id: 'BILL-001',
      customerId: 'RC-001',
      customerType: 'regular',
      customerName: 'Amit Sharma',
      date: '2026-06-10',
      dueDate: '2026-06-17',
      subtotal: 520.0,
      discountType: 'flat',
      discountValue: 20.0,
      total: 500.0,
      amountPaid: 480.0,
      balance: 20.0,
      status: 'partial',
      paymentMethod: { cash: 280.0, upi: 200.0 },
      notes: 'Double-sided color job',
      deleted: false,
      items: [
        { id: 'item-1', name: 'A4 Paper', printType: 'color', sides: 'double', qty: 20, unitPrice: 18.0, amount: 360.0 },
        { id: 'item-2', name: 'A5 Paper', printType: 'bw', sides: 'single', qty: 40, unitPrice: 4.0, amount: 160.0 },
      ],
    },
    {
      id: 'BILL-002',
      customerId: 'RND-001',
      customerType: 'random',
      customerName: 'Walk-in Customer',
      date: '2026-06-12',
      dueDate: '2026-06-12',
      subtotal: 110.0,
      discountType: 'flat',
      discountValue: 0,
      total: 110.0,
      amountPaid: 110.0,
      balance: 0,
      status: 'paid',
      paymentMethod: { cash: 110.0, upi: 0 },
      notes: 'Single-sided black & white',
      deleted: false,
      items: [
        { id: 'item-2', name: 'A5 Paper', printType: 'bw', sides: 'single', qty: 22, unitPrice: 5.0, amount: 110.0 },
      ],
    },
  ],
  payments: [],
  advancePayments: [],
  expenses: [],
  notifications: [
    { id: 'note-1', title: 'Pending payment due', message: 'BILL-001 has a remaining balance of ₹20.', date: '2026-06-13', type: 'warning', read: false },
    { id: 'note-2', title: 'Inventory low stock', message: 'A5 Paper stock is low.', date: '2026-06-12', type: 'info', read: false },
  ],
  settings: {
    gstRate: 0,
    viewMode: 'monthly',
  },
  recurringBills: [],
  users: [
    { id: 'user-1', username: 'admin', password: 'admin123', role: 'admin', createdAt: new Date().toISOString() },
  ],
  currentUser: null,
  customerGroups: [
    { id: 'group-1', name: 'Wholesale', color: '#3b82f6' },
    { id: 'group-2', name: 'Retail', color: '#10b981' },
  ],
  idCounters: { RC: 2, RND: 1, BILL: 2, PAY: 0, EXP: 0, ADV: 0 },
}

const loadState = () => {
  try {
    const stored = localStorage.getItem('printpro-state')
    if (!stored) return initialState
    const parsed = JSON.parse(stored)
    // Merge with initialState so any newly added top-level keys are present
    return { ...initialState, ...parsed }
  } catch (error) {
    return initialState
  }
}

const saveState = (state) => {
  try {
    localStorage.setItem('printpro-state', JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save state', error)
  }
}

const reducer = (state, action) => {
  switch (action.type) {
    case 'ADD_BILL': {
      const { notification, ...billData } = action.payload
      const updatedBills = [billData, ...state.bills]
      const updatedNotifications = notification
        ? [...state.notifications, notification]
        : state.notifications
      return {
        ...state,
        bills: updatedBills,
        notifications: updatedNotifications,
      }
    }
    case 'UPDATE_BILL': {
      return {
        ...state,
        bills: state.bills.map((bill) => (bill.id === action.payload.id ? { ...bill, ...action.payload.updates } : bill)),
      }
    }
    case 'DELETE_BILL': {
      return {
        ...state,
        bills: state.bills.map((bill) => (bill.id === action.payload ? { ...bill, deleted: true } : bill)),
      }
    }
    case 'RESTORE_BILL': {
      return {
        ...state,
        bills: state.bills.map((bill) => (bill.id === action.payload ? { ...bill, deleted: false } : bill)),
      }
    }
    case 'DELETE_CUSTOMER': {
      return {
        ...state,
        customers: state.customers.map((c) =>
          c.id === action.payload ? { ...c, deleted: true } : c
        ),
      }
    }
    case 'RESTORE_CUSTOMER': {
      return {
        ...state,
        customers: state.customers.map((c) =>
          c.id === action.payload ? { ...c, deleted: false } : c
        ),
      }
    }
    case 'ADD_CUSTOMER': {
      return {
        ...state,
        customers: [...state.customers, action.payload],
      }
    }
    case 'UPDATE_CUSTOMER': {
      return {
        ...state,
        customers: state.customers.map((customer) => (customer.id === action.payload.id ? { ...customer, ...action.payload.updates } : customer)),
      }
    }
    case 'UPDATE_CUSTOMER_FULL': {
      // Full edit — replaces all editable fields, logs audit
      return {
        ...state,
        customers: state.customers.map((c) =>
          c.id === action.payload.id ? { ...c, ...action.payload.data, updatedAt: new Date().toISOString() } : c
        ),
      }
    }
    case 'INCREMENT_COUNTER': {
      return {
        ...state,
        idCounters: { ...state.idCounters, [action.payload]: (state.idCounters?.[action.payload] || 0) + 1 },
      }
    }
    case 'ADD_USER': {
      return {
        ...state,
        users: [...state.users, action.payload],
      }
    }
    case 'DELETE_USER': {
      return {
        ...state,
        users: state.users.filter((u) => u.id !== action.payload),
      }
    }
    case 'CHANGE_PASSWORD': {
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === action.payload.userId ? { ...u, password: action.payload.newPassword } : u
        ),
      }
    }
    case 'ADD_ADVANCE_PAYMENT': {
      const adv = action.payload
      return {
        ...state,
        advancePayments: [adv, ...state.advancePayments],
        customers: state.customers.map((c) =>
          c.id === adv.customerId
            ? { ...c, advanceBalance: Number(c.advanceBalance || 0) + Number(adv.amount) }
            : c
        ),
      }
    }
    case 'USE_ADVANCE': {
      // Deduct used advance from customer balance; called during billing
      const { customerId, amount } = action.payload
      return {
        ...state,
        customers: state.customers.map((c) =>
          c.id === customerId
            ? { ...c, advanceBalance: Math.max(0, Number(c.advanceBalance || 0) - Number(amount)) }
            : c
        ),
      }
    }
    case 'ADD_PAYMENT': {
      const payment = action.payload
      const updatedBills = state.bills.map((bill) => {
        if (bill.id !== payment.billId) return bill
        const paid = Number(bill.amountPaid || 0) + Number(payment.totalPaid)
        const balance = Math.max(bill.total - paid, 0)
        const status = paid >= bill.total ? 'paid' : 'partial'
        return {
          ...bill,
          amountPaid: Math.min(paid, bill.total),
          balance,
          status,
          paymentMethod: {
            cash: Number(bill.paymentMethod?.cash || 0) + Number(payment.cashAmount || 0),
            upi: Number(bill.paymentMethod?.upi || 0) + Number(payment.upiAmount || 0),
          },
        }
      })
      const customerCreditUpdate = state.customers.map((customer) => {
        if (customer.id !== payment.customerId) return customer
        if (payment.excessCredit) {
          return { ...customer, creditBalance: Number(customer.creditBalance || 0) + Number(payment.excessCredit) }
        }
        return customer
      })
      return {
        ...state,
        bills: updatedBills,
        customers: customerCreditUpdate,
        payments: [...state.payments, payment],
      }
    }
    case 'ADD_EXPENSE': {
      return {
        ...state,
        expenses: [action.payload, ...state.expenses],
      }
    }
    case 'DELETE_EXPENSE': {
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.payload),
      }
    }
    case 'ADD_INVENTORY_ITEM': {
      return {
        ...state,
        inventory: [...state.inventory, action.payload],
      }
    }
    case 'UPDATE_INVENTORY_ITEM': {
      return {
        ...state,
        inventory: state.inventory.map((item) => (item.id === action.payload.id ? { ...item, ...action.payload.updates } : item)),
      }
    }
    case 'MARK_NOTIFICATION_READ': {
      return {
        ...state,
        notifications: state.notifications.map((note) => (note.id === action.payload ? { ...note, read: true } : note)),
      }
    }
    case 'UPDATE_SETTINGS': {
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      }
    }
    case 'UPDATE_BUSINESS': {
      return {
        ...state,
        business: { ...state.business, ...action.payload },
      }
    }
    case 'ADD_RECURRING_BILL': {
      return {
        ...state,
        recurringBills: [...state.recurringBills, action.payload],
      }
    }
    case 'UPDATE_RECURRING_BILL': {
      return {
        ...state,
        recurringBills: state.recurringBills.map((bill) => (bill.id === action.payload.id ? { ...bill, ...action.payload.updates } : bill)),
      }
    }
    case 'DELETE_RECURRING_BILL': {
      return {
        ...state,
        recurringBills: state.recurringBills.filter((bill) => bill.id !== action.payload),
      }
    }
    case 'LOGIN': {
      return {
        ...state,
        currentUser: action.payload,
      }
    }
    case 'LOGOUT': {
      return {
        ...state,
        currentUser: null,
      }
    }
    case 'ADD_CUSTOMER_GROUP': {
      return {
        ...state,
        customerGroups: [...state.customerGroups, action.payload],
      }
    }
    case 'UPDATE_CUSTOMER_GROUP': {
      return {
        ...state,
        customerGroups: state.customerGroups.map((group) => (group.id === action.payload.id ? { ...group, ...action.payload.updates } : group)),
      }
    }
    case 'DELETE_CUSTOMER_GROUP': {
      return {
        ...state,
        customerGroups: state.customerGroups.filter((group) => group.id !== action.payload),
      }
    }
    default:
      return state
  }
}

const generateId = (prefix) => `${prefix}-${Math.floor(Math.random() * 9000 + 1000)}`

// Sequential ID generator using state counters
const generateSeqId = (state, type) => {
  const counters = state.idCounters || {}
  const current = counters[type] || 0
  const next = current + 1
  const padded = String(next).padStart(3, '0')
  const prefixMap = { RC: 'RC', RND: 'WI', BILL: 'BL', PAY: 'PAY', EXP: 'EXP', ADV: 'ADV', REC: 'REC', NOTE: 'NOTE', USER: 'USR', item: 'ITEM', GRP: 'GRP' }
  return `${prefixMap[type] || type}${padded}`
}

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState, loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  const getCustomerById = (customerId) => state.customers.find((customer) => customer.id === customerId)

  const addAdvancePayment = (data) => {
    const counterKey = 'ADV'
    const currentCount = state.idCounters?.[counterKey] || 0
    const nextCount = currentCount + 1
    const id = `ADV${String(nextCount).padStart(3, '0')}`
    dispatch({ type: 'INCREMENT_COUNTER', payload: counterKey })
    dispatch({
      type: 'ADD_ADVANCE_PAYMENT',
      payload: {
        id,
        customerId: data.customerId,
        customerName: data.customerName || '',
        amount: Number(data.amount),
        cashAmount: Number(data.cashAmount || 0),
        upiAmount: Number(data.upiAmount || 0),
        date: data.date || new Date().toISOString().slice(0, 10),
        paymentMethod: data.paymentMethod || 'cash',
        notes: data.notes || '',
        createdAt: new Date().toISOString(),
      },
    })
    return id
  }

  const addBill = (billData) => {
    const counterKey = 'BILL'
    const currentCount = state.idCounters?.[counterKey] || 0
    const nextCount = currentCount + 1
    const billId = `BL${String(nextCount).padStart(3, '0')}`
    dispatch({ type: 'INCREMENT_COUNTER', payload: counterKey })
    const customer = getCustomerById(billData.customerId)
    const customerName = customer?.name || billData.customerName || 'Guest'
    const currentCredit = Number(customer?.creditBalance || 0)
    const currentAdvance = Number(customer?.advanceBalance || 0)
    const total = Number(billData.total)
    const cashAmount = Number(billData.cashAmount || 0)
    const upiAmount = Number(billData.upiAmount || 0)
    const paidNow = cashAmount + upiAmount
    // How much advance to apply (caller passes advanceUsed, capped at available)
    const advanceUsed = Math.min(Number(billData.advanceUsed || 0), currentAdvance, total)
    const creditUsed = Math.min(currentCredit, Math.max(total - advanceUsed, 0))
    const billTotalAfterDeductions = Math.max(total - advanceUsed - creditUsed, 0)
    const overpaid = Math.max(paidNow - billTotalAfterDeductions, 0)
    const balance = Math.max(billTotalAfterDeductions - paidNow, 0)
    const status = paidNow + advanceUsed + creditUsed >= total ? 'paid' : paidNow + advanceUsed + creditUsed > 0 ? 'partial' : 'unpaid'

    const updatedCustomer = customer
      ? {
          ...customer,
          creditBalance: Math.max(currentCredit - creditUsed + overpaid, 0),
          advanceBalance: Math.max(currentAdvance - advanceUsed, 0),
        }
      : null

    const newBill = {
      id: billId,
      ...billData,
      customerName,
      amountPaid: paidNow + advanceUsed + creditUsed,
      balance,
      status,
      deleted: false,
      items: billData.items,
      paymentMethod: { cash: cashAmount, upi: upiAmount },
      creditUsed,
      advanceUsed,
    }

    dispatch({
      type: 'ADD_BILL',
      payload: {
        ...newBill,
        notification: {
          id: generateId('NOTE'),
          title: `Bill ${billId} created`,
          message: `New bill for ${customerName} is ${status}.`,
          date: new Date().toISOString().slice(0, 10),
          type: status === 'paid' ? 'success' : 'warning',
          read: false,
        },
      },
    })

    if (updatedCustomer) {
      dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: updatedCustomer.id, updates: updatedCustomer } })
    }

    if (paidNow > 0) {
      const paymentRecord = {
        id: generateId('PAY'),
        billId,
        customerId: customer?.id || billData.customerId || '',
        date: new Date().toISOString(),
        cashAmount,
        upiAmount,
        totalPaid: paidNow,
        paymentType: status === 'paid' ? 'full' : 'partial',
        excessCredit: overpaid,
        notes: billData.notes || '',
      }
      dispatch({ type: 'ADD_PAYMENT', payload: paymentRecord })
    }

    return billId
  }

  const addCustomer = (customerData) => {
    const counterKey = customerData.type === 'regular' ? 'RC' : 'RND'
    const currentCount = state.idCounters?.[counterKey] || 0
    const nextCount = currentCount + 1
    const prefix = customerData.type === 'regular' ? 'RC' : 'WI'
    const customerId = `${prefix}${String(nextCount).padStart(3, '0')}`
    dispatch({ type: 'INCREMENT_COUNTER', payload: counterKey })
    dispatch({ type: 'ADD_CUSTOMER', payload: { ...customerData, id: customerId, creditBalance: Number(customerData.creditBalance) || 0, createdAt: new Date().toISOString() } })
    return customerId
  }

  const updateCustomerFull = (id, data) => {
    dispatch({ type: 'UPDATE_CUSTOMER_FULL', payload: { id, data } })
  }

  const recordPayment = (paymentData) => {
    const bill = state.bills.find((entry) => entry.id === paymentData.billId)
    if (!bill) return
    const totalPaid = Number(paymentData.cashAmount || 0) + Number(paymentData.upiAmount || 0)
    const remaining = Math.max(bill.total - Number(bill.amountPaid || 0), 0)
    const excess = Math.max(totalPaid - remaining, 0)
    const updatedBills = state.bills.map((entry) => {
      if (entry.id !== paymentData.billId) return entry
      const paid = Number(entry.amountPaid || 0) + totalPaid
      const balance = Math.max(entry.total - paid, 0)
      const status = paid >= entry.total ? 'paid' : 'partial'
      return {
        ...entry,
        amountPaid: Math.min(paid, entry.total),
        balance,
        status,
        paymentMethod: {
          cash: Number(entry.paymentMethod?.cash || 0) + Number(paymentData.cashAmount || 0),
          upi: Number(entry.paymentMethod?.upi || 0) + Number(paymentData.upiAmount || 0),
        },
      }
    })
    const updatedCustomers = state.customers.map((customer) => {
      if (customer.id !== paymentData.customerId) return customer
      return { ...customer, creditBalance: Number(customer.creditBalance || 0) + excess }
    })
    dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: paymentData.customerId, updates: updatedCustomers.find((c) => c.id === paymentData.customerId) || {} } })
    dispatch({ type: 'ADD_PAYMENT', payload: { ...paymentData, id: generateId('PAY'), totalPaid, excessCredit: excess } })
    dispatch({ type: 'UPDATE_BILL', payload: { id: paymentData.billId, updates: updatedBills.find((entry) => entry.id === paymentData.billId) } })
  }

  const addInventoryItem = (itemData) => {
    const itemId = generateId('item')
    // Strip stock field — inventory is pricing-only
    const { stock, low_stock_alert, ...pricingData } = itemData
    dispatch({ type: 'ADD_INVENTORY_ITEM', payload: { id: itemId, ...pricingData } })
  }

  const addExpense = (expenseData) => {
    const id = generateId('EXP')
    dispatch({ type: 'ADD_EXPENSE', payload: { ...expenseData, id } })
    return id
  }

  const deleteExpense = (id) => {
    dispatch({ type: 'DELETE_EXPENSE', payload: id })
  }

  const addUser = (userData) => {
    const id = generateId('USER')
    dispatch({ type: 'ADD_USER', payload: { ...userData, id, createdAt: new Date().toISOString() } })
    return id
  }

  const deleteUser = (id) => {
    dispatch({ type: 'DELETE_USER', payload: id })
  }

  const changePassword = (userId, newPassword) => {
    dispatch({ type: 'CHANGE_PASSWORD', payload: { userId, newPassword } })
  }

  const updateBill = (id, updates) => dispatch({ type: 'UPDATE_BILL', payload: { id, updates } })

  const value = useMemo(
    () => ({
      ...state,
      addBill,
      addAdvancePayment,
      addCustomer,
      recordPayment,
      addInventoryItem,
      addExpense,
      deleteExpense,
      addUser,
      deleteUser,
      changePassword,
      updateBill,
      updateCustomer: (id, updates) => dispatch({ type: 'UPDATE_CUSTOMER', payload: { id, updates } }),
      updateCustomerFull,
      deleteCustomer: (id) => dispatch({ type: 'DELETE_CUSTOMER', payload: id }),
      restoreCustomer: (id) => dispatch({ type: 'RESTORE_CUSTOMER', payload: id }),
      updateInventoryItem: (id, updates) => dispatch({ type: 'UPDATE_INVENTORY_ITEM', payload: { id, updates } }),
      deleteBill: (id) => dispatch({ type: 'DELETE_BILL', payload: id }),
      restoreBill: (id) => dispatch({ type: 'RESTORE_BILL', payload: id }),
      markNotificationRead: (id) => dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id }),
      updateSettings: (updates) => dispatch({ type: 'UPDATE_SETTINGS', payload: updates }),
      updateBusiness: (updates) => dispatch({ type: 'UPDATE_BUSINESS', payload: updates }),
      addRecurringBill: (bill) => dispatch({ type: 'ADD_RECURRING_BILL', payload: { ...bill, id: generateId('REC') } }),
      updateRecurringBill: (id, updates) => dispatch({ type: 'UPDATE_RECURRING_BILL', payload: { id, updates } }),
      deleteRecurringBill: (id) => dispatch({ type: 'DELETE_RECURRING_BILL', payload: id }),
      login: (user) => dispatch({ type: 'LOGIN', payload: user }),
      logout: () => dispatch({ type: 'LOGOUT' }),
      addCustomerGroup: (group) => dispatch({ type: 'ADD_CUSTOMER_GROUP', payload: { ...group, id: generateId('GRP') } }),
      updateCustomerGroup: (id, updates) => dispatch({ type: 'UPDATE_CUSTOMER_GROUP', payload: { id, updates } }),
      deleteCustomerGroup: (id) => dispatch({ type: 'DELETE_CUSTOMER_GROUP', payload: id }),
    }),
    [state]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider')
  }
  return context
}
