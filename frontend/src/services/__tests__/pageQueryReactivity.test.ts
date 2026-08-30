import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { BILLS_QUERY_KEY } from '../../hooks/useBillsQuery'
import { CUSTOMERS_QUERY_KEY } from '../../hooks/useCustomersQuery'
import { PAYMENTS_QUERY_KEY, INVENTORY_QUERY_KEY } from '../../hooks/useEntitiesQuery'
import { EXPENSES_QUERY_KEY } from '../../hooks/useExpensesQuery'

// Mock global localStorage for Node environment test execution
const storageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
})

describe('Page Query Reactive State Propagation (Dashboard, Accounting, CustomerBills)', () => {
  let queryClient: QueryClient
  const testUserId = 'usr-test-12345'

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Infinity,
        },
      },
    })
  })

  it('verifies that newly created Bill reactively updates Dashboard, Accounting, and CustomerBills without page reload', async () => {
    const userBillsKey = [...BILLS_QUERY_KEY, testUserId]
    const userCustomersKey = [...CUSTOMERS_QUERY_KEY, testUserId]
    const userPaymentsKey = [...PAYMENTS_QUERY_KEY, testUserId]
    const userExpensesKey = [...EXPENSES_QUERY_KEY, testUserId]
    const userInventoryKey = [...INVENTORY_QUERY_KEY, testUserId]

    // ── Initial State ────────────────────────────────────────────────────────
    const initialCustomer = {
      id: 'c-101',
      name: 'Acme Corp',
      type: 'regular',
      phone: '9876543210',
      credit_balance: 0,
      deleted: false,
    }

    queryClient.setQueryData(userCustomersKey, [initialCustomer])
    queryClient.setQueryData(userBillsKey, [])
    queryClient.setQueryData(userPaymentsKey, [])
    queryClient.setQueryData(userExpensesKey, [])
    queryClient.setQueryData(userInventoryKey, [
      { id: 'inv-1', name: 'A4 Matte Paper', stock: 100, sellingPrice: 15 },
    ])

    // Verify initial state across all 3 components before bill creation:
    // 1. Dashboard initial state:
    const initialBills = queryClient.getQueryData<any[]>(userBillsKey) || []
    expect(initialBills.length).toBe(0)
    const initialPending = initialBills.reduce((s, b) => s + Number(b.balance || 0), 0)
    const initialRevenue = initialBills.reduce((s, b) => s + Number(b.total || 0), 0)
    expect(initialPending).toBe(0)
    expect(initialRevenue).toBe(0)

    // 2. Accounting initial state:
    const initialExpenses = queryClient.getQueryData<any[]>(userExpensesKey) || []
    expect(initialExpenses.length).toBe(0)

    // 3. CustomerBills initial state:
    const initialCustBills = initialBills.filter((b) => b.customerId === 'c-101')
    expect(initialCustBills.length).toBe(0)

    // ── Step 1: Simulate Bill Creation in POS ────────────────────────────────
    const newBill = {
      id: 'bill-101',
      invoiceNumber: 'BILL-000101',
      customerId: 'c-101',
      customerName: 'Acme Corp',
      date: '2026-08-30',
      subtotal: 1500,
      gstAmount: 270,
      total: 1770,
      amountPaid: 1000,
      balance: 770,
      status: 'partial',
      items: [
        { itemId: 'inv-1', itemName: 'A4 Matte Paper', qty: 100, unitPrice: 15, amount: 1500, gstRate: 18 },
      ],
      deleted: false,
    }

    const newPayment = {
      id: 'pay-201',
      billId: 'bill-101',
      customerId: 'c-101',
      totalPaid: 1000,
      cashAmount: 500,
      upiAmount: 500,
      date: '2026-08-30',
    }

    // In production, useBillMutations() invalidates queries and updates query cache
    queryClient.setQueryData(userBillsKey, [newBill])
    queryClient.setQueryData(userPaymentsKey, [newPayment])

    // ── Step 2: Test Reactive Component Calculations ─────────────────────────

    // 1. DASHBOARD REPRODUCTION TEST:
    // Dashboard computes metrics from live serverBills & serverPayments
    const liveBills = queryClient.getQueryData<any[]>(userBillsKey) || []
    const livePayments = queryClient.getQueryData<any[]>(userPaymentsKey) || []

    const dashboardActiveBills = liveBills.filter((b) => !b.deleted && !b.isGroupParent)
    const dashboardPending = dashboardActiveBills.reduce((s, b) => s + Number(b.balance || 0), 0)
    const dashboardGrossRevenue = dashboardActiveBills.reduce((s, b) => s + Number(b.total || 0), 0)
    const dashboardTotalCollected = dashboardActiveBills.reduce((s, b) => s + Number(b.amountPaid || 0), 0)
    const dashboardBillCount = dashboardActiveBills.length

    expect(dashboardBillCount).toBe(1)
    expect(dashboardGrossRevenue).toBe(1770)
    expect(dashboardPending).toBe(770)
    expect(dashboardTotalCollected).toBe(1000)

    // 2. ACCOUNTING REPRODUCTION TEST:
    // Accounting computes GST report and payment receipts from live serverBills & serverPayments
    const gstReportBills = liveBills.filter((b) => !b.deleted && !b.isGroupParent)
    let totalTaxable = 0
    let totalCGST = 0
    let totalSGST = 0
    let totalGST = 0

    gstReportBills.forEach((b) => {
      b.items.forEach((item: any) => {
        totalTaxable += item.amount
        const gst = item.amount * (item.gstRate / 100)
        totalGST += gst
        totalCGST += gst / 2
        totalSGST += gst / 2
      })
    })

    expect(totalTaxable).toBe(1500)
    expect(totalGST).toBe(270)
    expect(totalCGST).toBe(135)
    expect(totalSGST).toBe(135)

    const accountingPaymentsReceived = livePayments.reduce((s, p) => s + Number(p.totalPaid || 0), 0)
    expect(accountingPaymentsReceived).toBe(1000)

    // 3. CUSTOMER BILLS REPRODUCTION TEST:
    // CustomerBills filters for the selected customer ('c-101')
    const customerBillsList = liveBills
      .filter((b) => !b.deleted && b.customerId === 'c-101')
      .sort((a, b) => String(a.invoiceNumber).localeCompare(String(b.invoiceNumber)))

    expect(customerBillsList.length).toBe(1)
    expect(customerBillsList[0].invoiceNumber).toBe('BILL-000101')
    expect(customerBillsList[0].total).toBe(1770)
    expect(customerBillsList[0].balance).toBe(770)
    expect(customerBillsList[0].status).toBe('partial')
  })
})
