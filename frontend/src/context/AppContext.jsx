import React, { createContext, useContext, useEffect, useMemo, useReducer, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { syncEntityToCloud } from '../lib/syncService'
import { getBills } from '../api/bills'
import { getCustomers } from '../api/customers'
import { getPayments } from '../api/payments'
import { getItems } from '../api/inventory'
import { getPurchases } from '../api/purchases'
import { getProfile, updateProfile } from '../api/profile'

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
    // Loyalty Program Settings
    loyaltyEnabled: true,
    loyaltyEarningRate: 30,
    loyaltyRedeemRatioPoints: 150,
    loyaltyRedeemRatioRupees: 5,
    loyaltyRedeemOptions: [
      { points: 100, rupees: 2.5 },
      { points: 120, rupees: 3 },
      { points: 150, rupees: 5 },
    ],
    // Tiered loyalty earning rules: [{from, to, points}] - sorted ascending by 'from'
    loyaltyTiers: [
      { from: 1, to: 40, points: 1 },
      { from: 41, to: 100, points: 2 },
    ],
    // Invoice Customizer & Branding Settings
    primaryColor: '#0f172a',
    logoUrl: '',
    headerNotes: '',
    footerNotes: '',
    showGstBreakdown: true,
    showUpiQrCode: true,
  },
  recurringBills: [],
  currentUser: null,
  customerGroups: [],
  groupBills: [],
  deletedPayments: [],
  promoCodes: [
    { code: 'STUDENT10', type: 'percent', value: 10, minAmount: 0 },
    { code: 'BULK50', type: 'flat', value: 50, minAmount: 500 },
    { code: 'WELCOME20', type: 'flat', value: 20, minAmount: 150 },
  ],
  idCounters: { RC: 0, RND: 0, BILL: 0, PAY: 0, EXP: 0, ADV: 0, GRP: 0, ITEM: 0, REC: 0, NOTE: 0 },
}

const loadState = () => {
  try {
    const stored = localStorage.getItem('printpro-local-settings')
    if (!stored) return initialState
    const parsed = JSON.parse(stored)
    return {
      ...initialState,
      settings: {
        ...initialState.settings,
        viewMode: parsed.viewMode || initialState.settings.viewMode
      }
    }
  } catch (error) {
    return initialState
  }
}

const saveState = (state) => {
  try {
    const { currentUser } = state
    if (!currentUser) {
      localStorage.removeItem('printpro-local-settings')
      return
    }
    const localSettings = {
      viewMode: state.settings?.viewMode || 'monthly'
    }
    localStorage.setItem('printpro-local-settings', JSON.stringify(localSettings))
  } catch (error) {
    console.error('Failed to save local settings', error)
  }
}

const baseReducer = (state, action) => {
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
      const bill = state.bills.find(b => b.id === action.payload)
      let updatedCustomers = state.customers
      const pointsEnabled = state.settings?.loyaltyEnabled !== false
      
      if (bill && bill.customerId) {
        const earned = pointsEnabled ? (bill.loyaltyPointsEarned || 0) : 0
        const redeemed = pointsEnabled ? (bill.loyaltyPointsRedeemed || 0) : 0
        const advanceToRestore = Number(bill.advanceUsed || 0)
        
        updatedCustomers = state.customers.map(c => {
          if (c.id !== bill.customerId) return c
          const currentAdvance = Number(c.advanceBalance || c.creditBalance || 0)
          const newAdvance = currentAdvance + advanceToRestore
          return {
            ...c,
            loyaltyPoints: Math.max(0, (c.loyaltyPoints || 0) - earned + redeemed),
            advanceBalance: newAdvance,
            creditBalance: newAdvance
          }
        })
      }

      return {
        ...state,
        bills: state.bills.map((b) => (b.id === action.payload ? { ...b, deleted: true } : b)),
        customers: updatedCustomers,
      }
    }
    case 'RESTORE_BILL': {
      const bill = state.bills.find(b => b.id === action.payload)
      let updatedCustomers = state.customers
      const pointsEnabled = state.settings?.loyaltyEnabled !== false
      
      if (bill && bill.customerId) {
        const earned = pointsEnabled ? (bill.loyaltyPointsEarned || 0) : 0
        const redeemed = pointsEnabled ? (bill.loyaltyPointsRedeemed || 0) : 0
        const advanceToDeduct = Number(bill.advanceUsed || 0)
        
        updatedCustomers = state.customers.map(c => {
          if (c.id !== bill.customerId) return c
          const currentAdvance = Number(c.advanceBalance || c.creditBalance || 0)
          const newAdvance = Math.max(0, currentAdvance - advanceToDeduct)
          return {
            ...c,
            loyaltyPoints: Math.max(0, (c.loyaltyPoints || 0) + earned - redeemed),
            advanceBalance: newAdvance,
            creditBalance: newAdvance
          }
        })
      }

      return {
        ...state,
        bills: state.bills.map((b) => (b.id === action.payload ? { ...b, deleted: false } : b)),
        customers: updatedCustomers,
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
      const customer = { ...action.payload, advanceBalance: Number(action.payload.creditBalance) || 0 }
      const openingBalance = Number(customer.creditBalance) || 0
      let nextState = {
        ...state,
        customers: [...state.customers, customer],
      }
      
      if (openingBalance > 0) {
        const currentCount = state.idCounters?.ADV || 0
        const nextCount = currentCount + 1
        const advId = `ADV${String(nextCount).padStart(3, '0')}`
        const opCash = Number(customer.openingCash) || 0
        const opUpi = Number(customer.openingUpi) || 0
        const method = opCash > 0 && opUpi > 0 ? 'split' : (opUpi > 0 ? 'upi' : 'cash')
        
        const advRecord = {
          id: advId,
          customerId: customer.id,
          customerName: customer.name || '',
          amount: openingBalance,
          cashAmount: opCash,
          upiAmount: opUpi,
          date: customer.createdAt.slice(0, 10),
          paymentMethod: method,
          notes: 'Opening Credit Balance',
          createdAt: customer.createdAt,
        }
        
        nextState = {
          ...nextState,
          advancePayments: [advRecord, ...(state.advancePayments || [])],
          idCounters: {
            ...state.idCounters,
            ADV: nextCount
          }
        }
      }
      return nextState
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
      const type = action.payload;
      const prefixMap = { RC: 'RC', RND: 'WI', BILL: 'BILL', PAY: 'PAY', EXP: 'EXP', ADV: 'ADV', REC: 'REC', NOTE: 'NOTE', USER: 'USR', ITEM: 'ITEM', item: 'ITEM', GRP: 'GRP', SGRP: 'SGRP' };
      const prefix = prefixMap[type] || type;
      let maxNum = state.idCounters?.[type] || 0;
      const listsMap = {
        BILL: state.bills || [],
        RC: state.customers || [],
        PAY: [...(state.payments || []), ...(state.deletedPayments || [])],
        EXP: state.expenses || [],
        ADV: state.advancePayments || [],
        REC: state.recurringBills || [],
        ITEM: state.inventory || [],
        item: state.inventory || [],
        GRP: [...(state.customerGroups || []), ...(state.groupBills || [])],
        NOTE: state.notifications || [],
      };
      const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');
      (listsMap[type] || []).forEach(item => {
        if (item && item.id && typeof item.id === 'string') {
          const m = item.id.match(regex);
          if (m) {
            const n = parseInt(m[1], 10);
            if (!isNaN(n) && n > maxNum) maxNum = n;
          }
        }
      });
      return {
        ...state,
        idCounters: { ...state.idCounters, [type]: maxNum + 1 },
      }
    }
    case 'SET_CURRENT_USER': {
      const user = action.payload
      if (!user) {
        return {
          ...initialState,
          currentUser: null,
        }
      }
      return {
        ...state,
        currentUser: user,
      }
    }
    case 'SYNC_CLOUD_DATA': {
      const { 
        bills, customers, payments, inventory, expenses, business,
        settings, idCounters, advancePayments, recurringBills,
        customerGroups, groupBills, deletedPayments
      } = action.payload

      const pending = action.pendingSyncs

      // Helper to prevent database syncs from deleting local entities whose database writes are in-flight
      const mergePending = (cloudArr, localArr) => {
        if (!localArr || !pending || pending.size === 0) return cloudArr || []
        const cloudMap = new Map(cloudArr.map(item => [item.id, item]))
        const merged = [...cloudArr]
        
        localArr.forEach(item => {
          if (pending.has(item.id) && !cloudMap.has(item.id)) {
            merged.push(item)
          }
        })
        return merged
      }

      return {
        ...state,
        bills: mergePending(bills || [], state.bills),
        customers: mergePending(customers || [], state.customers),
        payments: mergePending(payments || [], state.payments),
        inventory: inventory || [],
        expenses: mergePending(expenses || [], state.expenses),
        business: business && Object.keys(business).length > 0 ? { ...state.business, ...business } : state.business,
        settings: settings && Object.keys(settings).length > 0 ? { ...state.settings, ...settings } : state.settings,
        idCounters: idCounters && Object.keys(idCounters).length > 0 ? { ...state.idCounters, ...idCounters } : state.idCounters,
        advancePayments: mergePending(advancePayments || [], state.advancePayments),
        recurringBills: recurringBills || [],
        customerGroups: customerGroups || [],
        groupBills: groupBills || [],
        deletedPayments: deletedPayments || []
      }
    }
    case 'UPDATE_ENTITY_ID': {
      const { entityType, tempId, dbId } = action.payload
      let nextState = {
        ...state,
        [entityType]: (state[entityType] || []).map((item) =>
          item.id === tempId ? { ...item, id: dbId } : item
        ),
      }
      if (entityType === 'bills') {
        nextState.payments = (nextState.payments || []).map(p =>
          p.billId === tempId ? { ...p, billId: dbId } : p
        )
      }
      return nextState
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
    case 'DELETE_NOTIFICATION': {
      return {
        ...state,
        notifications: state.notifications.filter((note) => note.id !== action.payload),
      }
    }
    case 'CLEAR_ALL_NOTIFICATIONS': {
      return {
        ...state,
        notifications: [],
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
    case 'ADD_GROUP_BILL': {
      return {
        ...state,
        groupBills: [action.payload, ...state.groupBills],
      }
    }
    // ── Pay for a specific member in a group bill ───────────────────────────────
    case 'PAY_GROUP_MEMBER': {
      const { groupBillId, memberId, paymentAmount } = action.payload;
      // Update the specific member within the group bill
      const updatedGroupBills = state.groupBills.map((gb) => {
        if (gb.id !== groupBillId) return gb;
        const updatedMembers = gb.members.map((m) => {
          if (m.id !== memberId) return m;
          const newStatus = paymentAmount >= m.total ? 'paid' : 'partial';
          return { ...m, amountPaid: paymentAmount, status: newStatus };
        });
        return { ...gb, members: updatedMembers };
      });
      // Update customer balances (simplified: add credit if excess, reduce advance if used)
      const targetMember = state.groupBills
        .find((gb) => gb.id === groupBillId)
        ?.members.find((m) => m.id === memberId);
      if (!targetMember) return state;
      const customerId = targetMember.customerId;
      const updatedCustomers = state.customers.map((c) => {
        if (c.id !== customerId) return c;
        // If member used advance, deduct it
        let newAdvance = Number(c.advanceBalance || c.creditBalance || 0);
        if (targetMember.useAdvance) {
          newAdvance = Math.max(0, newAdvance - paymentAmount);
        }
        return { ...c, advanceBalance: newAdvance, creditBalance: newAdvance };
      });
      // Record a payment entry for audit purposes
      const payCountPAY_GROUP = (state.idCounters?.PAY || 0) + 1
      const paymentRecord = {
        id: `PAY${String(payCountPAY_GROUP).padStart(4, '0')}`,
        groupBillId,
        memberId,
        customerId,
        date: new Date().toISOString(),
        totalPaid: paymentAmount,
        paymentMethod: { cash: paymentAmount, upi: 0 },
        notes: `Payment for group bill ${groupBillId} member ${memberId}`,
      };
      return {
        ...state,
        groupBills: updatedGroupBills,
        customers: updatedCustomers,
        payments: [...state.payments, paymentRecord],
      };
    }
    case 'UPDATE_GROUP_BILL': {
      return {
        ...state,
        groupBills: state.groupBills.map((gb) =>
          gb.id === action.payload.id ? { ...gb, ...action.payload.updates } : gb
        ),
      }
    }
    case 'DELETE_PAYMENT': {
      const paymentId = action.payload
      const payment = state.payments.find((p) => p.id === paymentId)
      if (!payment) return state

      const updatedBills = state.bills.map((bill) => {
        if (bill.id !== payment.billId) return bill
        const newPaid = Math.max(0, Number(bill.amountPaid || 0) - Number(payment.totalPaid))
        const newBalance = Math.max(0, bill.total - newPaid)
        const newStatus = newPaid >= bill.total ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid')
        return {
          ...bill,
          amountPaid: newPaid,
          balance: newBalance,
          status: newStatus,
          paymentMethod: {
            cash: Math.max(0, Number(bill.paymentMethod?.cash || 0) - Number(payment.cashAmount || 0)),
            upi: Math.max(0, Number(bill.paymentMethod?.upi || 0) - Number(payment.upiAmount || 0)),
          },
        }
      })

      const updatedCustomers = state.customers.map((c) => {
        if (c.id !== payment.customerId) return c
        let newBal = Number(c.advanceBalance || c.creditBalance || 0)
        if (payment.excessCredit) {
          newBal = Math.max(0, newBal - Number(payment.excessCredit))
        }
        return {
          ...c,
          advanceBalance: newBal,
          creditBalance: newBal,
        }
      })

      const updatedPayments = state.payments.filter((p) => p.id !== paymentId)
      const deletedPaymentRecord = {
        ...payment,
        deletedAt: new Date().toISOString(),
      }
      const updatedDeletedPayments = [deletedPaymentRecord, ...(state.deletedPayments || [])]

      return {
        ...state,
        bills: updatedBills,
        customers: updatedCustomers,
        payments: updatedPayments,
        deletedPayments: updatedDeletedPayments,
      }
    }
    case 'SET_PROMO_CODES': {
      return {
        ...state,
        promoCodes: action.payload,
      }
    }
    default:
      return state
  }
}

const reducer = (state, action) => {
  let nextState = baseReducer(state, action)
  if (nextState && nextState !== state) {
    const pointsEnabled = nextState.settings?.loyaltyEnabled !== false
    
    // Calculate new loyalty points for all customers dynamically
    const updatedCustomers = nextState.customers.map((customer) => {
      if (customer.deleted) return customer

      // Points are only earned from fully paid bills (status === 'paid')
      const pointsEarned = nextState.bills
        .filter((b) => b.customerId === customer.id && !b.deleted && b.status === 'paid')
        .reduce((sum, b) => sum + (b.loyaltyPointsEarned || 0), 0)

      // Points redeemed are subtracted from all bills
      const pointsRedeemed = nextState.bills
        .filter((b) => b.customerId === customer.id && !b.deleted)
        .reduce((sum, b) => sum + (b.loyaltyPointsRedeemed || 0), 0)

      const loyaltyPoints = pointsEnabled ? Math.max(0, pointsEarned - pointsRedeemed) : 0

      if (customer.loyaltyPoints !== loyaltyPoints) {
        return { ...customer, loyaltyPoints }
      }
      return customer
    })

    // Sync customerTotalLoyaltyPoints on all bills
    const updatedBills = nextState.bills.map((bill) => {
      const cust = updatedCustomers.find((c) => c.id === bill.customerId)
      if (cust && bill.customerTotalLoyaltyPoints !== cust.loyaltyPoints) {
        return { ...bill, customerTotalLoyaltyPoints: cust.loyaltyPoints }
      }
      return bill
    })

    nextState = {
      ...nextState,
      customers: updatedCustomers,
      bills: updatedBills,
    }
  }
  return nextState
}

// Legacy random ID kept temporarily for fallback; all new IDs use generateSeqId
// const generateId = (prefix) => `${prefix}-${Math.floor(Math.random() * 9000 + 1000)}`

// Helper to scan state for highest numerical suffix of an ID prefix
const getMaxCounterFromState = (state, type) => {
  const prefixMap = { RC: 'RC', RND: 'WI', BILL: 'BILL', PAY: 'PAY', EXP: 'EXP', ADV: 'ADV', REC: 'REC', NOTE: 'NOTE', USER: 'USR', ITEM: 'ITEM', item: 'ITEM', GRP: 'GRP', SGRP: 'SGRP' }
  const prefix = prefixMap[type] || type
  let maxNum = state.idCounters?.[type] || 0

  const itemsMap = {
    BILL: state.bills || [],
    RC: state.customers || [],
    PAY: [...(state.payments || []), ...(state.deletedPayments || [])],
    EXP: state.expenses || [],
    ADV: state.advancePayments || [],
    REC: state.recurringBills || [],
    ITEM: state.inventory || [],
    item: state.inventory || [],
    GRP: [...(state.customerGroups || []), ...(state.groupBills || [])],
    NOTE: state.notifications || [],
  }

  const items = itemsMap[type] || []
  const regex = new RegExp(`^${prefix}(\\d+)$`, 'i')
  for (const item of items) {
    if (item && item.id && typeof item.id === 'string') {
      const match = item.id.match(regex)
      if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num > maxNum) {
          maxNum = num
        }
      }
    }
  }
  return maxNum
}

// Sequential ID generator using state counters and active state reconciliation
const generateSeqId = (state, type) => {
  const prefixMap = { RC: 'RC', RND: 'WI', BILL: 'BILL', PAY: 'PAY', EXP: 'EXP', ADV: 'ADV', REC: 'REC', NOTE: 'NOTE', USER: 'USR', ITEM: 'ITEM', item: 'ITEM', GRP: 'GRP', SGRP: 'SGRP' }
  const prefix = prefixMap[type] || type
  const maxNum = getMaxCounterFromState(state, type)
  let next = maxNum + 1

  const itemsMap = {
    BILL: state.bills || [],
    RC: state.customers || [],
    PAY: [...(state.payments || []), ...(state.deletedPayments || [])],
    EXP: state.expenses || [],
    ADV: state.advancePayments || [],
    REC: state.recurringBills || [],
    ITEM: state.inventory || [],
    item: state.inventory || [],
    GRP: [...(state.customerGroups || []), ...(state.groupBills || [])],
    NOTE: state.notifications || [],
  }
  const existingSet = new Set((itemsMap[type] || []).map(x => x && x.id))

  let candidate = `${prefix}${String(next).padStart(4, '0')}`
  while (existingSet.has(candidate)) {
    next++
    candidate = `${prefix}${String(next).padStart(4, '0')}`
  }
  return candidate
}

// Tiered loyalty points calculator
// tiers: [{from: Number, to: Number, points: Number}] - owner-configured ranges
// Returns the points value of the matching tier for the given bill total.
// If total >= any tier's 'from' but there's no upper tier, uses the highest tier.
const calcLoyaltyPoints = (total, tiers) => {
  if (!tiers || !tiers.length || total <= 0) return 0
  const sorted = [...tiers].sort((a, b) => a.from - b.from)
  let matched = 0
  for (const tier of sorted) {
    const from = Number(tier.from || 0)
    const to = Number(tier.to || Infinity)
    const pts = Number(tier.points || 0)
    if (total >= from && total <= to) {
      return pts
    }
    // Track highest tier for fallback
    if (total > to) {
      matched = pts
    }
  }
  // If total exceeds all upper bounds, return the highest tier points
  return matched
}

export const AppProvider = ({ children }) => {
  const [state, rawDispatch] = useReducer(reducer, initialState, loadState)
  const isSyncingFromCloud = useRef(false)
  const pendingSyncs = useRef(new Set())

  const dispatch = (action) => {
    rawDispatch(action)

    // Track pending ID if it is a creation action
    let entityId = null
    if (action.type === 'ADD_CUSTOMER' || action.type === 'ADD_BILL' || action.type === 'ADD_PAYMENT' || action.type === 'ADD_EXPENSE' || action.type === 'ADD_ADVANCE_PAYMENT' || action.type === 'RETURN_ADVANCE_PAYMENT' || action.type === 'ADD_INVENTORY_ITEM') {
      entityId = action.payload?.id
      if (entityId) {
        pendingSyncs.current.add(entityId)
      }
    }

    // Synchronously fire the background sync, logging success and displaying errors to the user
    syncEntityToCloud(action.type, action.payload)
      .then((res) => {
        console.log(`Sync confirmed: Database write succeeded for action ${action.type}`)
        
        // Handle ID reconciliation for serial/autoincrement database IDs
        if (res?.data?.data?.id) {
          const dbId = res.data.data.id
          const tempId = action.payload?.id
          if (tempId && dbId !== tempId) {
            let entityType = null
            if (action.type === 'ADD_BILL') entityType = 'bills'
            if (action.type === 'ADD_CUSTOMER') entityType = 'customers'
            if (action.type === 'ADD_INVENTORY_ITEM') entityType = 'inventory'
            if (action.type === 'ADD_PAYMENT') entityType = 'payments'
            if (action.type === 'ADD_EXPENSE') entityType = 'expenses'
            
            if (entityType) {
              rawDispatch({
                type: 'UPDATE_ENTITY_ID',
                payload: { entityType, tempId, dbId }
              })
              pendingSyncs.current.delete(tempId)
            }
          }
        }
      })
      .catch((err) => {
        console.error(`Sync error: Database write failed for action ${action.type}`, err)
        showToast(`Failed to sync changes to cloud: ${err.message || 'Network error'}`, 'error')
      })
      .finally(() => {
        if (entityId) {
          // Allow real-time web socket reload event to propagate and finish, then clear pending state
          setTimeout(() => {
            pendingSyncs.current.delete(entityId)
          }, 1500)
        }
      })
  }

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

  // Sync profile-level settings, counters, and lists to cloud database
  useEffect(() => {
    if (!state.currentUser) return
    if (isSyncingFromCloud.current) return

    const syncMetadata = async () => {
      try {
        await updateProfile({
          settings: state.settings,
          id_counters: state.idCounters,
          advance_payments: state.advancePayments,
          recurring_bills: state.recurringBills,
          customer_groups: state.customerGroups,
          group_bills: state.groupBills,
          deleted_payments: state.deletedPayments,
          shop_name: state.business.shopName,
          owner_name: state.business.ownerName,
          phone: state.business.phone,
          address: state.business.address,
          gstin: state.business.gstin,
          upi_id: state.business.upiId
        })
        console.log('Sync confirmed: Profile metadata write succeeded.')
      } catch (err) {
        console.error('Failed to sync profile metadata to database:', err)
      }
    }

    // Debounce metadata sync by 500ms to batch rapid successive counter or settings updates
    const timer = setTimeout(syncMetadata, 500)
    return () => clearTimeout(timer)
  }, [
    state.currentUser,
    state.settings,
    state.idCounters,
    state.advancePayments,
    state.recurringBills,
    state.customerGroups,
    state.groupBills,
    state.deletedPayments,
    state.business
  ])

  // Sync Supabase Authentication State & Log Session Info
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log('=== AUTHENTICATION DIAGNOSTICS ===')
        console.log('User ID:', session.user.id)
        console.log('Email:', session.user.email)
        console.log('Session Token Present:', !!session.access_token)
        console.log('Role:', 'owner')
        console.log('==================================')
        
        dispatch({
          type: 'SET_CURRENT_USER',
          payload: {
            id: session.user.id,
            username: session.user.email ? session.user.email.split('@')[0] : (session.user.user_metadata?.name || 'user'),
            email: session.user.email || '',
            role: 'owner',
            token: session.access_token,
            avatarUrl: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '',
          }
        });
      } else {
        console.log('=== AUTHENTICATION DIAGNOSTICS: NO ACTIVE SESSION ===')
        dispatch({ type: 'SET_CURRENT_USER', payload: null });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        console.log('=== AUTHENTICATION CHANGE DETECTED ===')
        console.log('User ID:', session.user.id)
        console.log('Email:', session.user.email)
        console.log('======================================')
        
        dispatch({
          type: 'SET_CURRENT_USER',
          payload: {
            id: session.user.id,
            username: session.user.email ? session.user.email.split('@')[0] : (session.user.user_metadata?.name || 'user'),
            email: session.user.email || '',
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

  // Fetch all business manager data from database when user is authenticated, and keep it in sync periodically
  useEffect(() => {
    let intervalId = null
    let realtimeChannel = null

    const safeJsonParse = (val, fallback) => {
      if (val === null || val === undefined) return fallback
      if (typeof val === 'object') return val
      try {
        return JSON.parse(val)
      } catch (e) {
        return fallback
      }
    }

    const syncFromCloud = async () => {
      if (!state.currentUser) return
      try {
        const [billsRes, customersRes, paymentsRes, inventoryRes, purchasesRes, profileRes] = await Promise.all([
          getBills(),
          getCustomers(),
          getPayments(),
          getItems(),
          getPurchases(),
          getProfile()
        ])

        const fetchedBills = billsRes.data?.data || []
        const fetchedCustomers = customersRes.data?.data || []
        const fetchedPayments = paymentsRes.data?.data || []
        const fetchedInventory = inventoryRes.data?.data || []
        const fetchedPurchases = purchasesRes.data?.data || []
        const fetchedProfile = profileRes.data?.data || {}

        const mappedCustomers = fetchedCustomers.map(c => {
          const existingCustomer = state.customers.find(local => local.id === c.id) || {}
          const creditBal = Number(c.credit_balance !== undefined && c.credit_balance !== null ? c.credit_balance : (existingCustomer.creditBalance || 0))
          return {
            id: c.id,
            type: c.type || existingCustomer.type || 'regular',
            name: c.name || existingCustomer.name || '',
            phone: c.phone || existingCustomer.phone || '',
            email: c.email || existingCustomer.email || '',
            address: c.address || existingCustomer.address || '',
            creditBalance: creditBal,
            advanceBalance: creditBal,
            creditLimit: Number(c.credit_limit || existingCustomer.creditLimit || 0),
            loyaltyPoints: existingCustomer.loyaltyPoints !== undefined ? existingCustomer.loyaltyPoints : Number(c.loyalty_points || 0),
            createdAt: c.created_at || existingCustomer.createdAt || new Date().toISOString()
          }
        })

        const mappedBills = fetchedBills.map(b => {
          const existingBill = state.bills.find(local => local.id === b.id) || {}
          const items = (b.items || []).map(item => ({
            name: item.item_name,
            printType: item.print_type,
            sides: item.sides,
            qty: Number(item.qty || 0),
            unitPrice: Number(item.unit_price || 0),
            amount: Number(item.amount || 0)
          }))
          const itemsSubtotal = items.reduce((sum, i) => sum + i.amount, 0)
          const subtotal = Number(b.subtotal || itemsSubtotal || existingBill.subtotal || 0)
          const discountVal = Number(b.discount_value !== undefined && b.discount_value !== null ? b.discount_value : (existingBill.discountValue || 0))
          const gstAmt = Number(b.gst_amount !== undefined && b.gst_amount !== null ? b.gst_amount : (existingBill.gstAmount || 0))
          
          let total = Number(b.total)
          if (!total || total === 0) {
            total = existingBill.total || (subtotal - discountVal + gstAmt)
          }

          const billPayments = fetchedPayments.filter(p => p.bill_id === b.id)
          const sumPaid = billPayments.reduce((sum, p) => sum + Number(p.total_paid || 0), 0)
          const amountPaid = Math.max(Number(b.amount_paid || 0), sumPaid, existingBill.amountPaid || 0)
          const balance = Math.max(0, total - amountPaid)
          const status = amountPaid >= total && total > 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid')

          return {
            id: b.id,
            customerId: b.customer_id,
            customerName: b.customer_name || existingBill.customerName || '',
            date: b.date ? new Date(b.date).toISOString().slice(0, 10) : (existingBill.date || ''),
            dueDate: b.due_date ? new Date(b.due_date).toISOString().slice(0, 10) : (existingBill.dueDate || null),
            subtotal,
            discountType: b.discount_type || existingBill.discountType || 'flat',
            discountValue: discountVal,
            gstPercent: Number(b.gst_percent !== undefined && b.gst_percent !== null ? b.gst_percent : (existingBill.gstPercent || 0)),
            gstAmount: gstAmt,
            total,
            amountPaid,
            balance,
            status,
            notes: b.notes || existingBill.notes || '',
            deleted: !!b.deleted_at,
            advanceUsed: existingBill.advanceUsed !== undefined ? existingBill.advanceUsed : 0,
            creditUsed: existingBill.creditUsed !== undefined ? existingBill.creditUsed : 0,
            paymentMethod: existingBill.paymentMethod || { cash: amountPaid, upi: 0 },
            items
          }
        })

        const mappedPayments = fetchedPayments.map(p => ({
          id: p.id,
          billId: p.bill_id,
          customerId: p.customer_id,
          date: p.date || new Date().toISOString(),
          cashAmount: Number(p.cash_amount || 0),
          upiAmount: Number(p.upi_amount || 0),
          totalPaid: Number(p.total_paid || 0),
          paymentType: p.payment_type || 'partial',
          notes: p.notes || ''
        }))

        const mappedInventory = fetchedInventory.map(i => ({
          id: i.id,
          name: i.name,
          colorSingle: Number(i.color_single || 0),
          colorDouble: Number(i.color_double || 0),
          bwSingle: Number(i.bw_single || 0),
          bwDouble: Number(i.bw_double || 0),
          stock: Number(i.stock || 0),
          lowStockAlert: Number(i.low_stock_alert || 50)
        }))

        const mappedExpenses = fetchedPurchases.map(exp => ({
          id: String(exp.id),
          date: exp.date ? new Date(exp.date).toISOString().slice(0, 10) : '',
          itemName: exp.item_name || '',
          category: exp.category || 'General',
          qty: Number(exp.qty || 0),
          unitCost: Number(exp.unit_cost || 0),
          amount: Number(exp.total || 0),
          notes: exp.notes || ''
        }))

        const mappedBusiness = {
          shopName: fetchedProfile.shop_name || '',
          ownerName: fetchedProfile.owner_name || '',
          phone: fetchedProfile.phone || '',
          address: fetchedProfile.address || '',
          gstin: fetchedProfile.gstin || '',
          upiId: fetchedProfile.upi_id || ''
        }

        const parsedSettings = safeJsonParse(fetchedProfile.settings, {})
        const parsedCounters = safeJsonParse(fetchedProfile.id_counters, {})
        const parsedAdvances = safeJsonParse(fetchedProfile.advance_payments, [])
        const parsedRecurring = safeJsonParse(fetchedProfile.recurring_bills, [])
        const parsedGroups = safeJsonParse(fetchedProfile.customer_groups, [])
        const parsedGroupBills = safeJsonParse(fetchedProfile.group_bills, [])
        const parsedDeletedPayments = safeJsonParse(fetchedProfile.deleted_payments, [])

        isSyncingFromCloud.current = true
        rawDispatch({
          type: 'SYNC_CLOUD_DATA',
          pendingSyncs: pendingSyncs.current,
          payload: {
            bills: mappedBills,
            customers: mappedCustomers,
            payments: mappedPayments,
            inventory: mappedInventory,
            expenses: mappedExpenses,
            business: mappedBusiness,
            settings: parsedSettings,
            idCounters: parsedCounters,
            advancePayments: parsedAdvances,
            recurringBills: parsedRecurring,
            customerGroups: parsedGroups,
            groupBills: parsedGroupBills,
            deletedPayments: parsedDeletedPayments
          }
        })
        setTimeout(() => {
          isSyncingFromCloud.current = false
        }, 300)
      } catch (error) {
        console.error('Failed to sync state from cloud:', error)
      }
    }

    if (state.currentUser) {
      // 1. Fetch immediately on login/auth change
      syncFromCloud()

      // 2. Setup periodic sync polling (every 10 seconds)
      intervalId = setInterval(syncFromCloud, 10000)

      // 3. Setup window focus/visibility sync triggers
      const handleSyncTrigger = () => {
        if (document.visibilityState === 'visible') {
          syncFromCloud()
        }
      }
      window.addEventListener('focus', syncFromCloud)
      window.addEventListener('visibilitychange', handleSyncTrigger)

      // 4. Enable Realtime Postgres Subscription for change events
      realtimeChannel = supabase
        .channel('realtime-db-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          (payload) => {
            console.log('Real-time database sync triggered: change detected on', payload.table)
            syncFromCloud()
          }
        )
        .subscribe((status) => {
          console.log(`Supabase Realtime channel status: ${status}`)
        })

      return () => {
        if (intervalId) clearInterval(intervalId)
        if (realtimeChannel) supabase.removeChannel(realtimeChannel)
        window.removeEventListener('focus', syncFromCloud)
        window.removeEventListener('visibilitychange', handleSyncTrigger)
      }
    }
  }, [state.currentUser])

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

      // Generate a new sequential PAY ID and increment the counter
      const paySeqId = generateSeqId(state, 'PAY')
      dispatch({ type: 'INCREMENT_COUNTER', payload: 'PAY' })

      // Dispatch payment record
      dispatch({
        type: 'ADD_PAYMENT',
        payload: {
          id: paySeqId,
          billId: bill.id,
          customerId: bill.customerId,
          date: new Date().toISOString(),
          cashAmount: 0,
          upiAmount: 0,
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

    // Earned loyalty points calculation (tiered system)
    const pointsEnabled = state.settings?.loyaltyEnabled !== false
    const loyaltyPointsEarned = pointsEnabled ? calcLoyaltyPoints(total, state.settings.loyaltyTiers) : 0
    const loyaltyPointsRedeemed = Number(billData.loyaltyPointsRedeemed || 0)

    const currentCustomerPoints = Number(customer?.loyaltyPoints || 0)
    const newCustomerPoints = Math.max(0, currentCustomerPoints - loyaltyPointsRedeemed + loyaltyPointsEarned)

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
      loyaltyPointsEarned,
      loyaltyPointsRedeemed,
      customerTotalLoyaltyPoints: newCustomerPoints,
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

        const _payIdx1 = (state.idCounters?.PAY || 0) + paymentRecords.length + 1
        paymentRecords.push({
          id: `PAY${String(_payIdx1).padStart(4, '0')}`,
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
        (currentAdvance - (Math.min(Number(billData.advanceUsed || 0), currentAdvance) - R_advance)),
        0
      )
      updatedCustomer.advanceBalance = finalBal
      updatedCustomer.creditBalance = finalBal
      if (pointsEnabled) {
        updatedCustomer.loyaltyPoints = newCustomerPoints
      }
    }

    if (overpaid > 0 && paymentRecords.length > 0) {
      const lastRec = paymentRecords[paymentRecords.length - 1]
      lastRec.excessCredit = overpaid
      lastRec.cashAmount += R_cash
      lastRec.upiAmount += R_upi
    } else if (overpaid > 0) {
      const _payIdxExcess = (state.idCounters?.PAY || 0) + paymentRecords.length + 1
      paymentRecords.push({
        id: `PAY${String(_payIdxExcess).padStart(4, '0')}`,
        billId: billId,
        customerId: billData.customerId,
        date: new Date().toISOString(),
        cashAmount: R_cash,
        upiAmount: R_upi,
        totalPaid: 0,
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
          id: `NOTE${String((state.idCounters?.NOTE || 0) + 1).padStart(4, '0')}`,
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

    if (overpaid > 0 && billData.returnChangeUpi > 0) {
      const retAmt = Math.min(overpaid, billData.returnChangeUpi)
      const nextCount = (state.idCounters?.ADV || 0) + 1
      dispatch({ type: 'INCREMENT_COUNTER', payload: 'ADV' })
      const advId = `ADV${String(nextCount).padStart(3, '0')}`
      dispatch({
        type: 'RETURN_ADVANCE_PAYMENT',
        payload: {
          id: advId,
          customerId: billData.customerId,
          amount: -retAmt,
          date: new Date().toISOString(),
          paymentMethod: 'upi',
          notes: 'Returned change via UPI',
          isReturn: true,
        }
      })
    }

    return billId
  }

  const addCustomer = (customerData) => {
    const counterKey = customerData.type === 'regular' ? 'RC' : 'RND'
    const customerId = generateSeqId(state, counterKey)
    dispatch({ type: 'INCREMENT_COUNTER', payload: counterKey })

    const openingCash = Number(customerData.openingCash) || 0
    const openingUpi = Number(customerData.openingUpi) || 0
    const totalOpening = openingCash + openingUpi

    dispatch({
      type: 'ADD_CUSTOMER',
      payload: {
        ...customerData,
        id: customerId,
        creditBalance: totalOpening,
        advanceBalance: totalOpening,
        openingCash,
        openingUpi,
        loyaltyPoints: 0,
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

        const _payIdxFifo = (state.idCounters?.PAY || 0) + paymentRecords.length + 1
        paymentRecords.push({
          id: `PAY${String(_payIdxFifo).padStart(4, '0')}`,
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
      const lastRec = paymentRecords[paymentRecords.length - 1]
      lastRec.excessCredit = excess
      lastRec.cashAmount += R_cash
      lastRec.upiAmount += R_upi
    } else if (excess > 0) {
      const _payIdxExcess2 = (state.idCounters?.PAY || 0) + paymentRecords.length + 1
      paymentRecords.push({
        id: `PAY${String(_payIdxExcess2).padStart(4, '0')}`,
        billId: paymentData.billId || 'General',
        customerId: paymentData.customerId,
        date: new Date().toISOString(),
        cashAmount: R_cash,
        upiAmount: R_upi,
        totalPaid: 0,
        paymentType: 'full',
        excessCredit: excess,
        notes: 'Advance deposit via payment',
      })
    }


    paymentRecords.forEach((p) => {
      dispatch({ type: 'ADD_PAYMENT', payload: p })
    })

    if (excess > 0 && paymentData.returnChangeUpi > 0) {
      const retAmt = Math.min(excess, paymentData.returnChangeUpi)
      const nextCount = (state.idCounters?.ADV || 0) + 1
      dispatch({ type: 'INCREMENT_COUNTER', payload: 'ADV' })
      const advId = `ADV${String(nextCount).padStart(3, '0')}`
      dispatch({
        type: 'RETURN_ADVANCE_PAYMENT',
        payload: {
          id: advId,
          customerId: paymentData.customerId,
          amount: -retAmt,
          date: new Date().toISOString(),
          paymentMethod: 'upi',
          notes: 'Returned change via UPI',
          isReturn: true,
        }
      })
    }

    updatedBills.forEach((b) => {
      dispatch({ type: 'UPDATE_BILL', payload: { id: b.id, updates: b } })
    })
  }

  // ── Targeted payment for a specific bill (no FIFO) ─────────────────────────
  const recordSpecificBillPayment = (paymentData) => {
    const { billId, customerId, cashAmount: rawCash, upiAmount: rawUpi } = paymentData
    const bill = state.bills.find((b) => b.id === billId)
    if (!bill) return

    const cash = Number(rawCash || 0)
    const upi = Number(rawUpi || 0)
    const totalPaying = cash + upi
    if (totalPaying <= 0) return

    const billRemaining = Math.max(bill.total - bill.amountPaid, 0)
    const applyAmt = Math.min(totalPaying, billRemaining)
    const excessAmt = totalPaying - applyAmt

    // Proportional split
    const total = cash + upi
    const applyCash = total > 0 ? Number((applyAmt * (cash / total)).toFixed(2)) : 0
    const applyUpi = Number((applyAmt - applyCash).toFixed(2))

    const newAmountPaid = bill.amountPaid + applyAmt
    const newBalance = Math.max(bill.total - newAmountPaid, 0)
    const newStatus = newAmountPaid >= bill.total ? 'paid' : 'partial'

    dispatch({
      type: 'UPDATE_BILL',
      payload: {
        id: billId,
        updates: {
          amountPaid: newAmountPaid,
          balance: newBalance,
          status: newStatus,
          paymentMethod: {
            cash: Number(bill.paymentMethod?.cash || 0) + applyCash,
            upi: Number(bill.paymentMethod?.upi || 0) + applyUpi,
          },
        },
      },
    })

    const _specPayId = `PAY${String((state.idCounters?.PAY || 0) + 1).padStart(4, '0')}`
    dispatch({ type: 'INCREMENT_COUNTER', payload: 'PAY' })
    dispatch({
      type: 'ADD_PAYMENT',
      payload: {
        id: _specPayId,
        billId,
        customerId,
        date: new Date().toISOString(),
        cashAmount: applyCash,
        upiAmount: applyUpi,
        totalPaid: applyAmt,
        paymentType: newStatus === 'paid' ? 'full' : 'partial',
        excessCredit: excessAmt > 0 ? excessAmt : 0,
        notes: paymentData.notes || `Targeted payment for bill ${billId}`,
      },
    })
  }

  // ── Add Group Bill (creates individual bills + a group record) ──────────────
  const addGroupBill = (groupData) => {
    const grpCounterKey = 'GRP'
    const grpId = generateSeqId(state, grpCounterKey)
    dispatch({ type: 'INCREMENT_COUNTER', payload: grpCounterKey })

    // Read current BILL counter once; increment locally per member so each bill gets a unique ID
    let billCounterOffset = state.idCounters?.BILL || 0
    const memberBillIds = []

    for (const member of groupData.members) {
      billCounterOffset += 1
      const billId = `BILL${String(billCounterOffset).padStart(4, '0')}`
      dispatch({ type: 'INCREMENT_COUNTER', payload: 'BILL' })

      const customer = state.customers.find((c) => c.id === member.customerId)
      const customerName = customer?.name || member.customerName || 'Guest'
      const currentAdvance = Number(customer?.advanceBalance || customer?.creditBalance || 0)

      const memberTotal = member.total
      let advanceUsed = 0
      let amountPaid = 0
      let billStatus = 'unpaid'

      if (member.useAdvance && currentAdvance > 0) {
        advanceUsed = Math.min(currentAdvance, memberTotal)
        amountPaid = advanceUsed
        billStatus = amountPaid >= memberTotal ? 'paid' : 'partial'

        // Deduct from customer advance
        dispatch({ type: 'USE_ADVANCE', payload: { customerId: member.customerId, amount: advanceUsed } })
      }

      const pointsEnabled = state.settings?.loyaltyEnabled !== false
      const loyaltyPointsEarned = pointsEnabled ? calcLoyaltyPoints(memberTotal, state.settings.loyaltyTiers) : 0
      const loyaltyPointsRedeemed = Number(member.loyaltyPointsRedeemed || 0)

      const newBill = {
        id: billId,
        customerId: member.customerId,
        customerName,
        customerType: customer?.type || 'regular',
        date: groupData.date || new Date().toISOString().slice(0, 10),
        dueDate: groupData.dueDate || '',
        items: member.items,
        subtotal: member.subtotal,
        discountType: member.discountType || 'flat',
        discountValue: member.discountValue || 0,
        discountAmount: member.discountAmount || 0,
        gstAmount: member.gstAmount || 0,
        cgst: member.cgst || 0,
        sgst: member.sgst || 0,
        total: memberTotal,
        amountPaid,
        balance: Math.max(memberTotal - amountPaid, 0),
        status: billStatus,
        advanceUsed,
        creditUsed: 0,
        paymentMethod: { cash: 0, upi: 0 },
        rounding: member.rounding || 0,
        notes: groupData.notes || '',
        deleted: false,
        groupBillId: grpId,
        groupRole: member.groupRole || 'shared',
        splitTotal: groupData.splitTotal || null,
        splitCount: groupData.splitCount || null,
        loyaltyPointsEarned,
        loyaltyPointsRedeemed,
        customerTotalLoyaltyPoints: customer ? customer.loyaltyPoints : 0,
      }

      const noteCounterOffset = (state.idCounters?.NOTE || 0) + memberBillIds.length + 1
      dispatch({
        type: 'ADD_BILL',
        payload: {
          ...newBill,
          notification: {
            id: `NOTE${String(noteCounterOffset).padStart(4, '0')}`,
            title: `Group Bill ${grpId} — ${billId}`,
            message: `Bill for ${customerName} created under group ${grpId} (${billStatus}).`,
            date: new Date().toISOString().slice(0, 10),
            type: billStatus === 'paid' ? 'success' : 'warning',
            read: false,
          },
        },
      })

      memberBillIds.push(billId)
    }

    // Store group meta record — no separate parent bill needed;
    // group totals are always computed live from member bills
    dispatch({
      type: 'ADD_GROUP_BILL',
      payload: {
        id: grpId,
        type: groupData.type || 'shared',
        memberBillIds,
        createdAt: new Date().toISOString(),
        roundingMode: groupData.roundingMode || null,
        totalAmount: null, // deprecated — computed live from member bills
        splitCount: groupData.splitCount || null,
        notes: groupData.notes || '',
        date: groupData.date || new Date().toISOString().slice(0, 10),
      },
    })

    return grpId
  }

  // (duplicate body removed — addGroupBill above is the canonical version)

  // ── recordSplitGroupPayment: one customer pays part or all of a split group ──
  // Distributes payment proportionally across all unpaid member bills.
  // The payer's ledger only reflects their own share; other shares are settled
  // using the payment amount as a group-level settlement (no inter-customer transfer).
  const recordSplitGroupPayment = ({ payerBillId, payerCustomerId, cashAmount, upiAmount, groupBillId }) => {
    const cash = Number(cashAmount || 0)
    const upi = Number(upiAmount || 0)
    let remaining = cash + upi
    if (remaining <= 0) return

    // Find the group record and all unpaid member bills
    const grp = state.groupBills.find(g => g.id === groupBillId)
    if (!grp) return

    const memberBills = (grp.memberBillIds || [])
      .map(id => state.bills.find(b => b.id === id && !b.deleted))
      .filter(Boolean)
      .filter(b => b.balance > 0)
      .sort((a, b) => a.id.localeCompare(b.id)) // deterministic order

    if (!memberBills.length) return

    // Build settlement distribution
    const settlements = []
    for (const bill of memberBills) {
      if (remaining <= 0) break
      const apply = Math.min(remaining, bill.balance)
      const ratio = (cash + upi) > 0 ? cash / (cash + upi) : 1
      const applyCash = Number((apply * ratio).toFixed(2))
      const applyUpi = Number((apply - applyCash).toFixed(2))
      settlements.push({ bill, apply, applyCash, applyUpi })
      remaining -= apply
    }

    // Generate a group-level audit payment ID
    const grpPayId = `PAY${String((state.idCounters?.PAY || 0) + 1).padStart(4, '0')}`
    dispatch({ type: 'INCREMENT_COUNTER', payload: 'PAY' })

    // Settle each member bill
    // Settle each member bill
    for (const { bill, apply, applyCash, applyUpi } of settlements) {
      const newAmountPaid = bill.amountPaid + apply
      const newBalance = Math.max(bill.total - newAmountPaid, 0)
      const newStatus = newAmountPaid >= bill.total ? 'paid' : 'partial'
      const isByPayer = bill.id === payerBillId

      // Update each member bill status
      dispatch({
        type: 'UPDATE_BILL',
        payload: {
          id: bill.id,
          updates: {
            amountPaid: newAmountPaid,
            balance: newBalance,
            status: newStatus,
            paymentMethod: {
              cash: Number(bill.paymentMethod?.cash || 0) + applyCash,
              upi: Number(bill.paymentMethod?.upi || 0) + applyUpi,
            },
            settledByGroupPayment: !isByPayer ? true : undefined,
          },
        },
      })

      // (We no longer generate individual ADD_PAYMENT records per bill for group settlements.
      // This ensures Cash/UPI is only counted once, and Customer Ledgers use the master group payment and settlements.)
    }

    // Record the master group audit payment (for settlement view)
    const groupSettlements = settlements
      .filter(s => s.bill.id !== payerBillId)
      .map(s => ({
        billId: s.bill.id,
        customerId: s.bill.customerId,
        customerName: s.bill.customerName,
        amount: s.apply,
      }))

    dispatch({
      type: 'ADD_PAYMENT',
      payload: {
        id: grpPayId,
        groupBillId,
        customerId: payerCustomerId,
        payerBillId,
        date: new Date().toISOString(),
        cashAmount: cash,
        upiAmount: upi,
        totalPaid: cash + upi,
        isGroupPayment: true,
        groupSettlements,
        notes: `Full group payment for ${groupBillId} by payer bill ${payerBillId}`,
      },
    })
  }

  const addInventoryItem = (itemData) => {
    const itemId = generateSeqId(state, 'ITEM')
    dispatch({ type: 'INCREMENT_COUNTER', payload: 'ITEM' })
    // Strip stock field — inventory is pricing-only
    const { stock, low_stock_alert, ...pricingData } = itemData
    dispatch({ type: 'ADD_INVENTORY_ITEM', payload: { id: itemId, ...pricingData } })
  }

  const addExpense = (expenseData) => {
    const id = generateSeqId(state, 'EXP')
    dispatch({ type: 'INCREMENT_COUNTER', payload: 'EXP' })
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
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('Supabase signOut error:', err)
    } finally {
      dispatch({ type: 'SET_CURRENT_USER', payload: null })
      window.location.href = '/auth'
    }
  }

  const editBill = (billId, newBillData, refundAction = null) => {
    const oldBill = state.bills.find(b => b.id === billId)
    if (!oldBill) return

    const customer = state.customers.find(c => c.id === oldBill.customerId)

    // Revert old bill effects
    let currentCredit = Number(customer?.creditBalance || 0)
    let currentAdvance = Number(customer?.advanceBalance || 0)

    let oldAdvanceUsed = Number(oldBill.advanceUsed || 0)
    let oldCreditUsed = Number(oldBill.creditUsed || 0)
    const oldPayments = state.payments.filter(p => p.billId === billId)
    const oldPaidCash = oldPayments.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const oldPaidUpi = oldPayments.reduce((s, p) => s + Number(p.upiAmount || 0), 0)
    const oldPaidDirect = oldPaidCash + oldPaidUpi

    if (customer) {
      const oldExcess = oldPayments.reduce((s, p) => s + Number(p.excessCredit || 0), 0)
      currentCredit = Math.max(0, currentCredit + oldCreditUsed - oldExcess)
      currentAdvance = currentAdvance + oldAdvanceUsed
    }

    // Remove payments for this bill
    dispatch({ type: 'REMOVE_PAYMENTS_FOR_BILL', payload: billId })

    const total = Number(newBillData.total)
    let updatedCustomer = customer ? { ...customer } : null

    // Loyalty point updates on edit (tiered system)
    const pointsEnabled = state.settings?.loyaltyEnabled !== false
    const oldEarned = oldBill.loyaltyPointsEarned || 0
    const oldRedeemed = oldBill.loyaltyPointsRedeemed || 0
    const newEarned = pointsEnabled ? calcLoyaltyPoints(total, state.settings.loyaltyTiers) : 0
    const newRedeemed = Number(newBillData.loyaltyPointsRedeemed || 0)
    const pointsDelta = (newEarned - newRedeemed) - (oldEarned - oldRedeemed)

    if (updatedCustomer && pointsEnabled) {
      updatedCustomer.loyaltyPoints = Math.max(0, (customer.loyaltyPoints || 0) + pointsDelta)
    }

    // If refundAction is provided (meaning there is an overpayment / refund due)
    if (refundAction) {
      const { type: refundType, method: refundMethod, directAmount, advanceAmount } = refundAction
      
      const newAdvanceUsed = Math.max(0, oldAdvanceUsed - Number(advanceAmount || 0))
      const newPaidDirect = Math.max(0, oldPaidDirect - Number(directAmount || 0))

      let newPaidCash = 0
      let newPaidUpi = 0
      if (oldPaidDirect > 0) {
        newPaidCash = Number((newPaidDirect * (oldPaidCash / oldPaidDirect)).toFixed(2))
        newPaidUpi = Number((newPaidDirect - newPaidCash).toFixed(2))
      }

      // Update bill properties directly
      const updatedBill = {
        ...oldBill,
        ...newBillData,
        amountPaid: newPaidDirect + newAdvanceUsed,
        balance: Math.max(total - (newPaidDirect + newAdvanceUsed), 0),
        status: (newPaidDirect + newAdvanceUsed) >= total ? 'paid' : ((newPaidDirect + newAdvanceUsed) > 0 ? 'partial' : 'unpaid'),
        paymentMethod: { cash: newPaidCash, upi: newPaidUpi },
        advanceUsed: newAdvanceUsed,
        creditUsed: 0,
        rounding: newBillData.rounding || 0,
        discountAmount: newBillData.discountAmount,
        loyaltyPointsEarned: newEarned,
        loyaltyPointsRedeemed: newRedeemed,
        customerTotalLoyaltyPoints: updatedCustomer ? updatedCustomer.loyaltyPoints : 0,
      }

      dispatch({ type: 'UPDATE_BILL', payload: { id: billId, updates: updatedBill } })

      // Recreate the direct payment record on the bill (if any direct payment remains)
      if (oldPaidDirect > 0) {
        const _relogPayId = generateSeqId(state, 'PAY')
        dispatch({ type: 'INCREMENT_COUNTER', payload: 'PAY' })
        dispatch({
          type: 'ADD_PAYMENT',
          payload: {
            id: _relogPayId,
            billId: billId,
            customerId: newBillData.customerId,
            date: new Date().toISOString(),
            cashAmount: oldPaidCash,
            upiAmount: oldPaidUpi,
            totalPaid: oldPaidDirect,
            paymentType: 'full',
            excessCredit: 0,
            notes: 'Original direct payments re-logged',
          }
        })
      }

      // Record refund payment (negative payment) if directAmount > 0
      if (directAmount > 0) {
        const _refundPayId = `PAY${String((state.idCounters?.PAY || 0) + 1).padStart(4, '0')}`
        dispatch({ type: 'INCREMENT_COUNTER', payload: 'PAY' })
        dispatch({
          type: 'ADD_PAYMENT',
          payload: {
            id: _refundPayId,
            billId: billId,
            customerId: newBillData.customerId,
            date: new Date().toISOString(),
            cashAmount: refundMethod === 'cash' ? -Number(directAmount) : 0,
            upiAmount: refundMethod === 'upi' ? -Number(directAmount) : 0,
            totalPaid: -Number(directAmount),
            paymentType: 'refund',
            excessCredit: 0,
            notes: refundType === 'direct' 
              ? `Direct refund of excess payment via ${refundMethod.toUpperCase()}`
              : `Excess payment moved to advance balance`,
            isRefund: true,
          }
        })

        if (refundType === 'direct') {
          // Direct refund to customer: customer's advance gets updated with only advanceRefund
          if (updatedCustomer) {
            const finalBal = currentAdvance - newAdvanceUsed
            updatedCustomer.advanceBalance = finalBal
            updatedCustomer.creditBalance = finalBal
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: updatedCustomer.id, updates: updatedCustomer } })
          }
        } else {
          // Credit to advance: directAmount is also added to the customer's advance balance
          // We create an advance payment deposit record for directAmount
          const advCounterKey = 'ADV'
          const advCount = state.idCounters?.[advCounterKey] || 0
          const advId = `ADV${String(advCount + 1).padStart(3, '0')}`
          dispatch({ type: 'INCREMENT_COUNTER', payload: advCounterKey })

          dispatch({
            type: 'ADD_ADVANCE_PAYMENT',
            payload: {
              id: advId,
              customerId: newBillData.customerId,
              customerName: newBillData.customerName || '',
              amount: Number(directAmount),
              cashAmount: refundMethod === 'cash' ? Number(directAmount) : 0,
              upiAmount: refundMethod === 'upi' ? Number(directAmount) : 0,
              date: new Date().toISOString().slice(0, 10),
              paymentMethod: refundMethod,
              notes: `Excess credit from bill ${billId} edit`,
              createdAt: new Date().toISOString(),
            }
          })

          if (updatedCustomer) {
            const finalBal = currentAdvance - newAdvanceUsed + Number(directAmount)
            updatedCustomer.advanceBalance = finalBal
            updatedCustomer.creditBalance = finalBal
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: updatedCustomer.id, updates: updatedCustomer } })
          }
        }
      } else {
        // If directAmount is 0, only advanceRefund applies
        if (updatedCustomer) {
          const finalBal = currentAdvance - newAdvanceUsed
          updatedCustomer.advanceBalance = finalBal
          updatedCustomer.creditBalance = finalBal
          dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: updatedCustomer.id, updates: updatedCustomer } })
        }
      }
    } else {
      // Normal editing (no overpayment/refund or total increased)
      const cashAmount = Number(newBillData.cashAmount || 0)
      const upiAmount = Number(newBillData.upiAmount || 0)

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
        loyaltyPointsEarned: newEarned,
        loyaltyPointsRedeemed: newRedeemed,
        customerTotalLoyaltyPoints: updatedCustomer ? updatedCustomer.loyaltyPoints : 0,
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

          const _editPayIdx = (state.idCounters?.PAY || 0) + paymentRecords.length + 1
          paymentRecords.push({
            id: `PAY${String(_editPayIdx).padStart(4, '0')}`,
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
      if (updatedCustomer) {
        const finalBal = Math.max(
          (currentAdvance - (Math.min(Number(newBillData.advanceUsed || 0), currentAdvance) - R_advance)),
          0
        )
        updatedCustomer.advanceBalance = finalBal
        updatedCustomer.creditBalance = finalBal
        dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: updatedCustomer.id, updates: updatedCustomer } })
      }

      if (excess > 0 && paymentRecords.length > 0) {
        const lastRec = paymentRecords[paymentRecords.length - 1]
        lastRec.excessCredit = excess
        lastRec.cashAmount += R_cash
        lastRec.upiAmount += R_upi
      } else if (excess > 0) {
        const _editExcessIdx = (state.idCounters?.PAY || 0) + paymentRecords.length + 1
        paymentRecords.push({
          id: `PAY${String(_editExcessIdx).padStart(4, '0')}`,
          billId: billId,
          customerId: newBillData.customerId,
          date: new Date().toISOString(),
          cashAmount: R_cash,
          upiAmount: R_upi,
          totalPaid: 0,
          paymentType: 'full',
          excessCredit: excess,
          notes: 'Excess payment from edit added to credit',
        })
      }

      // Dispatch bills updates
      billsToPay.forEach((b) => {
        dispatch({ type: 'UPDATE_BILL', payload: { id: b.id, updates: b } })
      })

      paymentRecords.forEach((p) => {
        dispatch({ type: 'ADD_PAYMENT', payload: p })
      })
    }
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
  const deletePayment = (id) => dispatch({ type: 'DELETE_PAYMENT', payload: id })

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
      deletePayment,
      updateCustomer: (id, updates) => dispatch({ type: 'UPDATE_CUSTOMER', payload: { id, updates } }),
      updateCustomerFull,
      deleteCustomer: (id) => dispatch({ type: 'DELETE_CUSTOMER', payload: id }),
      restoreCustomer: (id) => dispatch({ type: 'RESTORE_CUSTOMER', payload: id }),
      updateInventoryItem: (id, updates) => dispatch({ type: 'UPDATE_INVENTORY_ITEM', payload: { id, updates } }),
      deleteBill: (id) => dispatch({ type: 'DELETE_BILL', payload: id }),
      restoreBill: (id) => dispatch({ type: 'RESTORE_BILL', payload: id }),
      markNotificationRead: (id) => dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id }),
      markAllNotificationsRead: () => dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' }),
      deleteNotification: (id) => dispatch({ type: 'DELETE_NOTIFICATION', payload: id }),
      clearAllNotifications: () => dispatch({ type: 'CLEAR_ALL_NOTIFICATIONS' }),
      updateSettings: (updates) => dispatch({ type: 'UPDATE_SETTINGS', payload: updates }),
      updateBusiness: (updates) => dispatch({ type: 'UPDATE_BUSINESS', payload: updates }),
      addRecurringBill: (bill) => {
        const recId = generateSeqId(state, 'REC')
        dispatch({ type: 'INCREMENT_COUNTER', payload: 'REC' })
        dispatch({ type: 'ADD_RECURRING_BILL', payload: { ...bill, id: recId } })
      },
      updateRecurringBill: (id, updates) => dispatch({ type: 'UPDATE_RECURRING_BILL', payload: { id, updates } }),
      deleteRecurringBill: (id) => dispatch({ type: 'DELETE_RECURRING_BILL', payload: id }),
      logout,
      addCustomerGroup: (group) => {
        const grpId2 = generateSeqId(state, 'GRP')
        dispatch({ type: 'INCREMENT_COUNTER', payload: 'GRP' })
        dispatch({ type: 'ADD_CUSTOMER_GROUP', payload: { ...group, id: grpId2 } })
      },
      updateCustomerGroup: (id, updates) => dispatch({ type: 'UPDATE_CUSTOMER_GROUP', payload: { id, updates } }),
      deleteCustomerGroup: (id) => dispatch({ type: 'DELETE_CUSTOMER_GROUP', payload: id }),
      addGroupBill,
      recordSpecificBillPayment,
      recordSplitGroupPayment,
      updateGroupBill: (id, updates) => dispatch({ type: 'UPDATE_GROUP_BILL', payload: { id, updates } }),
      setPromoCodes: (promoCodes) => dispatch({ type: 'SET_PROMO_CODES', payload: promoCodes }),
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
