import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { supabase } from '../lib/supabase'

const AppContext = createContext(null)

const initialState = {
  business: {
    shopName: '',
    ownerName: '',
    phone: '',
    address: '',
    gstin: '',
    upiId: '',
  },
  customers: [],
  inventory: [],
  bills: [],
  payments: [],
  advancePayments: [],
  expenses: [],
  notifications: [],
  settings: {
    gstRate: 0,
    viewMode: 'monthly',
    staffPermissions: {
      billing: true,
      customers: true,
      advancePayments: true,
      accounting: false,
      analytics: false,
      inventory: false,
      ledger: false,
      recurringBills: false,
      receipt: true,
      search: true,
      dataManagement: false,
      deletedBills: false,
      settings: false,
    },
  },
  recurringBills: [],
  currentUser: null,
  customerGroups: [],
  idCounters: { RC: 0, RND: 0, BILL: 0, PAY: 0, EXP: 0, ADV: 0 },
}

const loadState = () => {
  try {
    const stored = localStorage.getItem('printpro-state')
    if (!stored) return initialState
    const parsed = JSON.parse(stored)
    
    // Force users and currentUser to be initialized correctly
    const { currentUser, users, ...sanitized } = parsed;

    // Merge with initialState so any newly added top-level keys are present
    return { ...initialState, ...sanitized }
  } catch (error) {
    return initialState
  }
}

const saveState = (state) => {
  try {
    const { currentUser, users, ...rest } = state
    localStorage.setItem('printpro-state', JSON.stringify(rest))
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
    case 'REMOVE_PAYMENTS_FOR_BILL': {
      return {
        ...state,
        payments: state.payments.filter((p) => p.billId !== action.payload),
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
      const editData = { ...action.payload.data }
      if (editData.creditBalance !== undefined) {
        editData.advanceBalance = editData.creditBalance
      }
      return {
        ...state,
        customers: state.customers.map((c) =>
          c.id === action.payload.id ? { ...c, ...editData, updatedAt: new Date().toISOString() } : c
        ),
      }
    }
    case 'INCREMENT_COUNTER': {
      return {
        ...state,
        idCounters: { ...state.idCounters, [action.payload]: (state.idCounters?.[action.payload] || 0) + 1 },
      }
    }
    case 'SET_CURRENT_USER': {
      return {
        ...state,
        currentUser: action.payload,
      }
    }
    case 'ADD_ADVANCE_PAYMENT': {
      const adv = action.payload
      return {
        ...state,
        advancePayments: [adv, ...state.advancePayments],
        customers: state.customers.map((c) => {
          if (c.id !== adv.customerId) return c
          const newBal = Number(c.advanceBalance || c.creditBalance || 0) + Number(adv.amount)
          return {
            ...c,
            advanceBalance: newBal,
            creditBalance: newBal
          }
        }),
      }
    }
    case 'RETURN_ADVANCE_PAYMENT': {
      const ret = action.payload
      return {
        ...state,
        advancePayments: [ret, ...state.advancePayments],
        customers: state.customers.map((c) => {
          if (c.id !== ret.customerId) return c
          const newBal = Math.max(0, Number(c.advanceBalance || c.creditBalance || 0) + Number(ret.amount)) // ret.amount is negative
          return {
            ...c,
            advanceBalance: newBal,
            creditBalance: newBal
          }
        }),
      }
    }
    case 'USE_ADVANCE': {
      // Deduct used advance from customer balance; called during billing
      const { customerId, amount } = action.payload
      return {
        ...state,
        customers: state.customers.map((c) => {
          if (c.id !== customerId) return c
          const newBal = Math.max(0, Number(c.advanceBalance || c.creditBalance || 0) - Number(amount))
          return {
            ...c,
            advanceBalance: newBal,
            creditBalance: newBal
          }
        }),
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
          const newBal = Number(customer.advanceBalance || customer.creditBalance || 0) + Number(payment.excessCredit)
          return { ...customer, creditBalance: newBal, advanceBalance: newBal }
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
    case 'MARK_ALL_NOTIFICATIONS_READ': {
      return {
        ...state,
        notifications: state.notifications.map((note) => ({ ...note, read: true })),
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
  const prefixMap = { RC: 'RC', RND: 'WI', BILL: 'BILL', PAY: 'PAY', EXP: 'EXP', ADV: 'ADV', REC: 'REC', NOTE: 'NOTE', USER: 'USR', item: 'ITEM', GRP: 'GRP' }
  return `${prefixMap[type] || type}${padded}`
}

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState, loadState)

  const [toast, setToast] = useState(null)
  const [dialog, setDialog] = useState(null)

  const showToast = (message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 4000)
  }

  const showAlert = (message, type = 'info') => {
    setDialog({ title: type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Alert', message, type, confirmText: 'OK' })
  }

  const showConfirm = (title, message, onConfirm, confirmText = 'Confirm', type = 'info') => {
    setDialog({ title, message, onConfirm, onCancel: () => setDialog(null), confirmText, type })
  }

  useEffect(() => {
    saveState(state)
  }, [state])

  // Sync Supabase Authentication State
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        dispatch({
          type: 'SET_CURRENT_USER',
          payload: {
            id: session.user.id,
            username: session.user.email.split('@')[0],
            email: session.user.email,
            role: 'owner',
            token: session.access_token,
            avatarUrl: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '',
          }
        });
      } else {
        dispatch({ type: 'SET_CURRENT_USER', payload: null });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        dispatch({
          type: 'SET_CURRENT_USER',
          payload: {
            id: session.user.id,
            username: session.user.email.split('@')[0],
            email: session.user.email,
            role: 'owner',
            token: session.access_token,
            avatarUrl: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '',
          }
        });
      } else {
        dispatch({ type: 'SET_CURRENT_USER', payload: null });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getCustomerById = (customerId) => state.customers.find((customer) => customer.id === customerId)

  const addAdvancePayment = (data) => {
    const counterKey = 'ADV'
    const currentCount = state.idCounters?.[counterKey] || 0
    const nextCount = currentCount + 1
    const id = `ADV${String(nextCount).padStart(3, '0')}`
    dispatch({ type: 'INCREMENT_COUNTER', payload: counterKey })

    const totalAmount = Number(data.amount)
    const cashAmount = Number(data.cashAmount || 0)
    const upiAmount = Number(data.upiAmount || 0)

    // 1. Add the advance payment record
    dispatch({
      type: 'ADD_ADVANCE_PAYMENT',
      payload: {
        id,
        customerId: data.customerId,
        customerName: data.customerName || '',
        amount: totalAmount,
        cashAmount: cashAmount,
        upiAmount: upiAmount,
        date: data.date || new Date().toISOString().slice(0, 10),
        paymentMethod: data.paymentMethod || 'cash',
        notes: data.notes || '',
        createdAt: new Date().toISOString(),
      },
    })

    // 2. Perform FIFO distribution across chronological unpaid bills
    const unpaidBills = state.bills
      .filter((b) => b.customerId === data.customerId && !b.deleted && b.status !== 'paid')
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

    let remainingAdvance = totalAmount
    let remainingCash = cashAmount
    let remainingUpi = upiAmount

    for (const bill of unpaidBills) {
      if (remainingAdvance <= 0) break

      const billRemaining = bill.total - bill.amountPaid
      if (billRemaining <= 0) continue

      const applyAmt = Math.min(remainingAdvance, billRemaining)
      
      // Proportional split of cash vs UPI for this FIFO payment
      let applyCash = 0
      let applyUpi = 0
      if (totalAmount > 0) {
        applyCash = Number((applyAmt * (cashAmount / totalAmount)).toFixed(2))
        applyUpi = Number((applyAmt - applyCash).toFixed(2))
      } else {
        applyCash = applyAmt
      }

      // Update bill properties
      const updatedBill = {
        ...bill,
        amountPaid: bill.amountPaid + applyAmt,
        advanceUsed: (bill.advanceUsed || 0) + applyAmt,
        paymentMethod: {
          cash: Number(bill.paymentMethod?.cash || 0) + applyCash,
          upi: Number(bill.paymentMethod?.upi || 0) + applyUpi
        }
      }
      updatedBill.balance = Math.max(updatedBill.total - updatedBill.amountPaid, 0)
      updatedBill.status = updatedBill.amountPaid >= updatedBill.total ? 'paid' : 'partial'

      // Dispatch bill update
      dispatch({ type: 'UPDATE_BILL', payload: { id: bill.id, updates: updatedBill } })

      // Dispatch payment record
      dispatch({
        type: 'ADD_PAYMENT',
        payload: {
          id: generateId('PAY'),
          billId: bill.id,
          customerId: bill.customerId,
          date: new Date().toISOString(),
          cashAmount: applyCash,
          upiAmount: applyUpi,
          totalPaid: applyAmt,
          paymentType: updatedBill.status === 'paid' ? 'full' : 'partial',
          excessCredit: 0,
          notes: `FIFO payment from advance deposit (${id})`,
        }
      })

      // Dispatch use advance to deduct from customer's balance
      dispatch({
        type: 'USE_ADVANCE',
        payload: { customerId: data.customerId, amount: applyAmt }
      })

      remainingAdvance -= applyAmt
      remainingCash -= applyCash
      remainingUpi -= applyUpi
    }

    return id
  }

  const returnAdvancePayment = (data) => {
    const counterKey = 'ADV'
    const currentCount = state.idCounters?.[counterKey] || 0
    const nextCount = currentCount + 1
    const id = `ADV${String(nextCount).padStart(3, '0')}`
    dispatch({ type: 'INCREMENT_COUNTER', payload: counterKey })

    const amt = Number(data.amount) // Positive value
    const cash = Number(data.cashAmount || 0)
    const upi = Number(data.upiAmount || 0)

    dispatch({
      type: 'RETURN_ADVANCE_PAYMENT',
      payload: {
        id,
        customerId: data.customerId,
        customerName: data.customerName || '',
        amount: -amt, // Negative to represent return in history
        cashAmount: -cash,
        upiAmount: -upi,
        date: data.date || new Date().toISOString().slice(0, 10),
        paymentMethod: data.paymentMethod || 'cash',
        notes: data.notes || 'Advance returned to customer',
        createdAt: new Date().toISOString(),
        isReturn: true
      },
    })
    return id
  }

  const addBill = (billData) => {
    const counterKey = 'BILL'
    const billId = generateSeqId(state, 'BILL')
    dispatch({ type: 'INCREMENT_COUNTER', payload: counterKey })
    const customer = getCustomerById(billData.customerId)
    const customerName = customer?.name || billData.customerName || 'Guest'
    const currentCredit = Number(customer?.creditBalance || 0)
    const currentAdvance = Number(customer?.advanceBalance || 0)
    const total = Number(billData.total)
    const cashAmount = Number(billData.cashAmount || 0)
    const upiAmount = Number(billData.upiAmount || 0)
    const paidNow = cashAmount + upiAmount
    const advanceUsed = Math.min(Number(billData.advanceUsed || 0), currentAdvance, total)
    const creditUsed = Math.min(currentCredit, Math.max(total - advanceUsed, 0))

    // FIFO payment distribution
    const unpaidBills = state.bills
      .filter((b) => b.customerId === billData.customerId && !b.deleted && b.status !== 'paid')
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

    const newBill = {
      id: billId,
      ...billData,
      customerName,
      amountPaid: 0,
      balance: total,
      status: 'unpaid',
      deleted: false,
      items: billData.items,
      paymentMethod: { cash: 0, upi: 0 },
      creditUsed: 0,
      advanceUsed: 0,
      rounding: billData.rounding || 0,
      discountAmount: billData.discountAmount ?? (billData.discountType === 'percent' ? (Number(billData.subtotal || 0) * Number(billData.discountValue || 0)) / 100 : Number(billData.discountValue || 0)),
    }

    const billsToPay = [...unpaidBills.map(b => ({ ...b, paymentMethod: { ...b.paymentMethod } })), newBill]

    let R_advance = Math.min(Number(billData.advanceUsed || 0), currentAdvance)
    let R_credit = 0
    let R_cash = cashAmount
    let R_upi = upiAmount

    const paymentRecords = []
    let updatedCustomer = customer ? { ...customer } : null

    // Distribute advance & credit first (no new payment records since already paid)
    for (const bill of billsToPay) {
      let remaining = bill.total - bill.amountPaid
      if (remaining <= 0) continue

      if (R_advance > 0) {
        const applyAdv = Math.min(R_advance, remaining)
        bill.advanceUsed = (bill.advanceUsed || 0) + applyAdv
        bill.amountPaid += applyAdv
        remaining -= applyAdv
        R_advance -= applyAdv
      }

      if (R_credit > 0 && remaining > 0) {
        const applyCred = Math.min(R_credit, remaining)
        bill.creditUsed = (bill.creditUsed || 0) + applyCred
        bill.amountPaid += applyCred
        remaining -= applyCred
        R_credit -= applyCred
      }
    }

    // Distribute new cash/upi (creates payment records)
    for (const bill of billsToPay) {
      let remaining = bill.total - bill.amountPaid
      if (remaining <= 0) continue

      let applyCash = 0
      let applyUpi = 0

      if (R_cash > 0) {
        applyCash = Math.min(R_cash, remaining)
        R_cash -= applyCash
        remaining -= applyCash
      }
      if (R_upi > 0 && remaining > 0) {
        applyUpi = Math.min(R_upi, remaining)
        R_upi -= applyUpi
        remaining -= applyUpi
      }

      const applyTotal = applyCash + applyUpi
      if (applyTotal > 0) {
        bill.amountPaid += applyTotal
        bill.paymentMethod.cash = (bill.paymentMethod.cash || 0) + applyCash
        bill.paymentMethod.upi = (bill.paymentMethod.upi || 0) + applyUpi

        paymentRecords.push({
          id: generateId('PAY'),
          billId: bill.id,
          customerId: bill.customerId,
          date: new Date().toISOString(),
          cashAmount: applyCash,
          upiAmount: applyUpi,
          totalPaid: applyTotal,
          paymentType: bill.amountPaid >= bill.total ? 'full' : 'partial',
          excessCredit: 0,
          notes: billData.notes || 'FIFO payment allocation',
        })
      }
    }

    // Update status and balance
    for (const bill of billsToPay) {
      bill.balance = Math.max(bill.total - bill.amountPaid, 0)
      bill.status = bill.amountPaid >= bill.total ? 'paid' : (bill.amountPaid > 0 ? 'partial' : 'unpaid')
    }

    // Excess to credit balance
    const overpaid = R_cash + R_upi
    if (updatedCustomer) {
      const finalBal = Math.max(
        (currentAdvance - (Math.min(Number(billData.advanceUsed || 0), currentAdvance) - R_advance)) + overpaid,
        0
      )
      updatedCustomer.advanceBalance = finalBal
      updatedCustomer.creditBalance = finalBal
    }

    if (overpaid > 0 && paymentRecords.length > 0) {
      paymentRecords[paymentRecords.length - 1].excessCredit = overpaid
    } else if (overpaid > 0) {
      paymentRecords.push({
        id: generateId('PAY'),
        billId: billId,
        customerId: billData.customerId,
        date: new Date().toISOString(),
        cashAmount: R_cash,
        upiAmount: R_upi,
        totalPaid: overpaid,
        paymentType: 'full',
        excessCredit: overpaid,
        notes: 'Excess payment added to advance credit',
      })
    }

    // Dispatch bills updates
    billsToPay.forEach((b) => {
      if (b.id !== billId) {
        dispatch({ type: 'UPDATE_BILL', payload: { id: b.id, updates: b } })
      }
    })

    dispatch({
      type: 'ADD_BILL',
      payload: {
        ...newBill,
        amountPaid: billsToPay.find(b => b.id === billId).amountPaid,
        balance: billsToPay.find(b => b.id === billId).balance,
        status: billsToPay.find(b => b.id === billId).status,
        paymentMethod: billsToPay.find(b => b.id === billId).paymentMethod,
        creditUsed: billsToPay.find(b => b.id === billId).creditUsed,
        advanceUsed: billsToPay.find(b => b.id === billId).advanceUsed,
        notification: {
          id: generateId('NOTE'),
          title: `Bill ${billId} created`,
          message: `New bill for ${customerName} is ${billsToPay.find(b => b.id === billId).status}.`,
          date: new Date().toISOString().slice(0, 10),
          type: billsToPay.find(b => b.id === billId).status === 'paid' ? 'success' : 'warning',
          read: false,
        },
      },
    })

    if (updatedCustomer) {
      dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: updatedCustomer.id, updates: updatedCustomer } })
    }

    paymentRecords.forEach((p) => {
      dispatch({ type: 'ADD_PAYMENT', payload: p })
    })

    return billId
  }

  const addCustomer = (customerData) => {
    const counterKey = customerData.type === 'regular' ? 'RC' : 'RND'
    const customerId = generateSeqId(state, counterKey)
    dispatch({ type: 'INCREMENT_COUNTER', payload: counterKey })
    dispatch({
      type: 'ADD_CUSTOMER',
      payload: {
        ...customerData,
        id: customerId,
        creditBalance: Number(customerData.creditBalance) || 0,
        advanceBalance: Number(customerData.creditBalance) || 0,
        createdAt: new Date().toISOString()
      }
    })
    return customerId
  }

  const updateCustomerFull = (id, data) => {
    dispatch({ type: 'UPDATE_CUSTOMER_FULL', payload: { id, data } })
  }

  const recordPayment = (paymentData) => {
    const customer = state.customers.find((c) => c.id === paymentData.customerId)
    const unpaidBills = state.bills
      .filter((b) => b.customerId === paymentData.customerId && !b.deleted && b.status !== 'paid')
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

    let R_cash = Number(paymentData.cashAmount || 0)
    let R_upi = Number(paymentData.upiAmount || 0)
    const totalPaid = R_cash + R_upi

    const paymentRecords = []
    const updatedBills = unpaidBills.map(b => ({ ...b, paymentMethod: { ...b.paymentMethod } }))

    for (const bill of updatedBills) {
      let remaining = bill.total - bill.amountPaid
      if (remaining <= 0) continue

      let applyCash = 0
      let applyUpi = 0

      if (R_cash > 0) {
        applyCash = Math.min(R_cash, remaining)
        R_cash -= applyCash
        remaining -= applyCash
      }
      if (R_upi > 0 && remaining > 0) {
        applyUpi = Math.min(R_upi, remaining)
        R_upi -= applyUpi
        remaining -= applyUpi
      }

      const applyTotal = applyCash + applyUpi
      if (applyTotal > 0) {
        bill.amountPaid += applyTotal
        bill.paymentMethod.cash = (bill.paymentMethod.cash || 0) + applyCash
        bill.paymentMethod.upi = (bill.paymentMethod.upi || 0) + applyUpi
        bill.balance = Math.max(bill.total - bill.amountPaid, 0)
        bill.status = bill.amountPaid >= bill.total ? 'paid' : 'partial'

        paymentRecords.push({
          id: generateId('PAY'),
          billId: bill.id,
          customerId: paymentData.customerId,
          date: new Date().toISOString(),
          cashAmount: applyCash,
          upiAmount: applyUpi,
          totalPaid: applyTotal,
          paymentType: bill.amountPaid >= bill.total ? 'full' : 'partial',
          excessCredit: 0,
          notes: paymentData.notes || 'Follow-up FIFO payment',
        })
      }
    }

    const excess = R_cash + R_upi
    if (excess > 0 && paymentRecords.length > 0) {
      paymentRecords[paymentRecords.length - 1].excessCredit = excess
    } else if (excess > 0) {
      paymentRecords.push({
        id: generateId('PAY'),
        billId: paymentData.billId || 'General',
        customerId: paymentData.customerId,
        date: new Date().toISOString(),
        cashAmount: R_cash,
        upiAmount: R_upi,
        totalPaid: excess,
        paymentType: 'full',
        excessCredit: excess,
        notes: 'Advance deposit via payment',
      })
    }

    if (customer) {
      const newBal = Number(customer.advanceBalance || customer.creditBalance || 0) + excess
      const updatedCustomer = {
        ...customer,
        creditBalance: newBal,
        advanceBalance: newBal,
      }
      dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: customer.id, updates: updatedCustomer } })
    }

    paymentRecords.forEach((p) => {
      dispatch({ type: 'ADD_PAYMENT', payload: p })
    })

    updatedBills.forEach((b) => {
      dispatch({ type: 'UPDATE_BILL', payload: { id: b.id, updates: b } })
    })
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

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
  }

  const signInWithGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const editBill = (billId, newBillData) => {
    const oldBill = state.bills.find(b => b.id === billId)
    if (!oldBill) return

    const customer = state.customers.find(c => c.id === oldBill.customerId)

    // Revert old bill effects
    let currentCredit = Number(customer?.creditBalance || 0)
    let currentAdvance = Number(customer?.advanceBalance || 0)

    if (customer) {
      const oldCreditUsed = Number(oldBill.creditUsed || 0)
      const oldAdvanceUsed = Number(oldBill.advanceUsed || 0)
      const oldPayments = state.payments.filter(p => p.billId === billId)
      const oldExcess = oldPayments.reduce((s, p) => s + Number(p.excessCredit || 0), 0)

      currentCredit = Math.max(0, currentCredit + oldCreditUsed - oldExcess)
      currentAdvance = currentAdvance + oldAdvanceUsed
    }

    // Remove payments for this bill
    dispatch({ type: 'REMOVE_PAYMENTS_FOR_BILL', payload: billId })

    const total = Number(newBillData.total)
    const cashAmount = Number(newBillData.cashAmount || 0)
    const upiAmount = Number(newBillData.upiAmount || 0)
    const paidNow = cashAmount + upiAmount

    // Unpaid bills excluding this one
    const unpaidBills = state.bills
      .filter((b) => b.customerId === newBillData.customerId && !b.deleted && b.status !== 'paid' && b.id !== billId)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

    const newBill = {
      ...oldBill,
      ...newBillData,
      amountPaid: 0,
      balance: total,
      status: 'unpaid',
      paymentMethod: { cash: 0, upi: 0 },
      creditUsed: 0,
      advanceUsed: 0,
      rounding: newBillData.rounding || 0,
      discountAmount: newBillData.discountAmount,
    }

    const billsToPay = [...unpaidBills.map(b => ({ ...b, paymentMethod: { ...b.paymentMethod } })), newBill]

    let R_advance = Math.min(Number(newBillData.advanceUsed || 0), currentAdvance)
    let R_credit = 0
    let R_cash = cashAmount
    let R_upi = upiAmount

    const paymentRecords = []

    // Distribute advance & credit
    for (const bill of billsToPay) {
      let remaining = bill.total - bill.amountPaid
      if (remaining <= 0) continue

      if (R_advance > 0) {
        const applyAdv = Math.min(R_advance, remaining)
        bill.advanceUsed = (bill.advanceUsed || 0) + applyAdv
        bill.amountPaid += applyAdv
        remaining -= applyAdv
        R_advance -= applyAdv
      }

      if (R_credit > 0 && remaining > 0) {
        const applyCred = Math.min(R_credit, remaining)
        bill.creditUsed = (bill.creditUsed || 0) + applyCred
        bill.amountPaid += applyCred
        remaining -= applyCred
        R_credit -= applyCred
      }
    }

    // Distribute new cash/upi
    for (const bill of billsToPay) {
      let remaining = bill.total - bill.amountPaid
      if (remaining <= 0) continue

      let applyCash = 0
      let applyUpi = 0

      if (R_cash > 0) {
        applyCash = Math.min(R_cash, remaining)
        R_cash -= applyCash
        remaining -= applyCash
      }
      if (R_upi > 0 && remaining > 0) {
        applyUpi = Math.min(R_upi, remaining)
        R_upi -= applyUpi
        remaining -= applyUpi
      }

      const applyTotal = applyCash + applyUpi
      if (applyTotal > 0) {
        bill.amountPaid += applyTotal
        bill.paymentMethod.cash = (bill.paymentMethod.cash || 0) + applyCash
        bill.paymentMethod.upi = (bill.paymentMethod.upi || 0) + applyUpi

        paymentRecords.push({
          id: generateId('PAY'),
          billId: bill.id,
          customerId: bill.customerId,
          date: new Date().toISOString(),
          cashAmount: applyCash,
          upiAmount: applyUpi,
          totalPaid: applyTotal,
          paymentType: bill.amountPaid >= bill.total ? 'full' : 'partial',
          excessCredit: 0,
          notes: newBillData.notes || 'Edit bill payment allocation',
        })
      }
    }

    // Update status and balance
    for (const bill of billsToPay) {
      bill.balance = Math.max(bill.total - bill.amountPaid, 0)
      bill.status = bill.amountPaid >= bill.total ? 'paid' : (bill.amountPaid > 0 ? 'partial' : 'unpaid')
    }

    const excess = R_cash + R_upi
    let updatedCustomer = customer ? { ...customer } : null
    if (updatedCustomer) {
      const finalBal = Math.max(
        (currentAdvance - (Math.min(Number(newBillData.advanceUsed || 0), currentAdvance) - R_advance)) + excess,
        0
      )
      updatedCustomer.advanceBalance = finalBal
      updatedCustomer.creditBalance = finalBal
    }

    if (excess > 0 && paymentRecords.length > 0) {
      paymentRecords[paymentRecords.length - 1].excessCredit = excess
    } else if (excess > 0) {
      paymentRecords.push({
        id: generateId('PAY'),
        billId: billId,
        customerId: newBillData.customerId,
        date: new Date().toISOString(),
        cashAmount: R_cash,
        upiAmount: R_upi,
        totalPaid: excess,
        paymentType: 'full',
        excessCredit: excess,
        notes: 'Excess payment from edit added to credit',
      })
    }

    // Dispatch bills updates
    billsToPay.forEach((b) => {
      dispatch({ type: 'UPDATE_BILL', payload: { id: b.id, updates: b } })
    })

    if (updatedCustomer) {
      dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: updatedCustomer.id, updates: updatedCustomer } })
    }

    paymentRecords.forEach((p) => {
      dispatch({ type: 'ADD_PAYMENT', payload: p })
    })
  }

  const applyPostDiscount = (billId, discountType, discountValue) => {
    const bill = state.bills.find(b => b.id === billId)
    if (!bill) return

    const customer = state.customers.find(c => c.id === bill.customerId)

    const subtotal = Number(bill.subtotal)
    const dVal = Number(discountValue)
    const discountAmt = discountType === 'percent' ? (subtotal * dVal) / 100 : dVal
    const newTotal = Math.max(subtotal - discountAmt, 0)

    const oldExcess = Math.max(0, Number(bill.amountPaid || 0) - bill.total)
    const newExcess = Math.max(0, Number(bill.amountPaid || 0) - newTotal)
    const excessDiff = newExcess - oldExcess

    const newAmountPaid = Math.min(Number(bill.amountPaid || 0), newTotal)
    const newBalance = Math.max(0, newTotal - newAmountPaid)
    const newStatus = newAmountPaid >= newTotal ? 'paid' : (newAmountPaid > 0 ? 'partial' : 'unpaid')

    // Update bill
    dispatch({
      type: 'UPDATE_BILL',
      payload: {
        id: billId,
        updates: {
          discountType,
          discountValue: dVal,
          discountAmount: discountAmt,
          total: newTotal,
          amountPaid: newAmountPaid,
          balance: newBalance,
          status: newStatus,
          rounding: 0, // Reset rounding on post discount
        }
      }
    })

    // Update customer credit balance if they have excess credit
    if (customer && excessDiff > 0) {
      const newBal = Number(customer.advanceBalance || customer.creditBalance || 0) + excessDiff
      const updatedCustomer = {
        ...customer,
        creditBalance: newBal,
        advanceBalance: newBal
      }
      dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: customer.id, updates: updatedCustomer } })
    }
  }

  const updateBill = (id, updates) => dispatch({ type: 'UPDATE_BILL', payload: { id, updates } })

  const value = useMemo(
    () => ({
      ...state,
      toast,
      dialog,
      showToast,
      showAlert,
      showConfirm,
      addBill,
      addAdvancePayment,
      returnAdvancePayment,
      addCustomer,
      recordPayment,
      addInventoryItem,
      addExpense,
      deleteExpense,
      signInWithGoogle,
      signInWithGitHub,
      updateBill,
      editBill,
      applyPostDiscount,
      updateCustomer: (id, updates) => dispatch({ type: 'UPDATE_CUSTOMER', payload: { id, updates } }),
      updateCustomerFull,
      deleteCustomer: (id) => dispatch({ type: 'DELETE_CUSTOMER', payload: id }),
      restoreCustomer: (id) => dispatch({ type: 'RESTORE_CUSTOMER', payload: id }),
      updateInventoryItem: (id, updates) => dispatch({ type: 'UPDATE_INVENTORY_ITEM', payload: { id, updates } }),
      deleteBill: (id) => dispatch({ type: 'DELETE_BILL', payload: id }),
      restoreBill: (id) => dispatch({ type: 'RESTORE_BILL', payload: id }),
      markNotificationRead: (id) => dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id }),
      markAllNotificationsRead: () => dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' }),
      updateSettings: (updates) => dispatch({ type: 'UPDATE_SETTINGS', payload: updates }),
      updateBusiness: (updates) => dispatch({ type: 'UPDATE_BUSINESS', payload: updates }),
      addRecurringBill: (bill) => dispatch({ type: 'ADD_RECURRING_BILL', payload: { ...bill, id: generateId('REC') } }),
      updateRecurringBill: (id, updates) => dispatch({ type: 'UPDATE_RECURRING_BILL', payload: { id, updates } }),
      deleteRecurringBill: (id) => dispatch({ type: 'DELETE_RECURRING_BILL', payload: id }),
      logout,
      addCustomerGroup: (group) => dispatch({ type: 'ADD_CUSTOMER_GROUP', payload: { ...group, id: generateId('GRP') } }),
      updateCustomerGroup: (id, updates) => dispatch({ type: 'UPDATE_CUSTOMER_GROUP', payload: { id, updates } }),
      deleteCustomerGroup: (id) => dispatch({ type: 'DELETE_CUSTOMER_GROUP', payload: id }),
    }),
    [state, toast, dialog]
  )

  return (
    <AppContext.Provider value={value}>
      {children}
      
      {/* Global Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          backgroundColor: '#1e1e1e',
          borderLeft: `4px solid ${
            toast.type === 'success' ? '#10b981' : 
            toast.type === 'error' ? '#ef4444' : 
            toast.type === 'warning' ? '#f59e0b' : '#3b82f6'
          }`,
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(255, 255, 255, 0.05)',
          borderRadius: '4px',
          padding: '16px 20px',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 500,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: '280px',
          maxWidth: '400px',
          transition: 'all 0.3s ease',
          pointerEvents: 'auto',
        }}>
          <span style={{
            color: 
              toast.type === 'success' ? '#10b981' : 
              toast.type === 'error' ? '#ef4444' : 
              toast.type === 'warning' ? '#f59e0b' : '#3b82f6',
            fontWeight: 'bold',
            fontSize: '16px'
          }}>
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : toast.type === 'warning' ? '⚠' : 'ℹ'}
          </span>
          <div style={{ flex: 1 }}>{toast.message}</div>
        </div>
      )}

      {/* Global Modal Alert/Confirm Dialog */}
      {dialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99998,
        }}>
          <div style={{
            backgroundColor: '#18181b',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '24px',
            width: '90%',
            maxWidth: '420px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <h3 style={{
              margin: 0,
              color: 
                dialog.type === 'error' ? '#ef4444' : 
                dialog.type === 'success' ? '#10b981' : 
                dialog.type === 'warning' ? '#f59e0b' : '#ffffff',
              fontSize: '18px',
              fontWeight: 600,
            }}>
              {dialog.title}
            </h3>
            <p style={{
              margin: 0,
              color: '#d4d4d8',
              fontSize: '14px',
              lineHeight: '1.6',
            }}>
              {dialog.message}
            </p>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '8px',
            }}>
              {dialog.onCancel && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setDialog(null)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '4px',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (dialog.onConfirm) dialog.onConfirm()
                  setDialog(null)
                }}
                style={{
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '4px',
                  backgroundColor: dialog.type === 'error' ? '#ef4444' : 'var(--accent)',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                {dialog.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  )
}

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider')
  }
  return context
}
