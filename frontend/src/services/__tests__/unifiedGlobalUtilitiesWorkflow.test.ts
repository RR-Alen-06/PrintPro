import { describe, it, expect } from 'vitest'
import { globalOmniSearch } from '../../utils/search'

describe('Unified Global Utilities Workflows (Command Palette & Notification Center)', () => {
  describe('Global Omni-Search Multi-Entity Matching', () => {
    const mockBills = [
      { id: 'b1', invoiceNumber: 'INV-1001', customerName: 'Apex Studio', total: 1200, items: [{ name: 'A4 Color Prints' }] },
      { id: 'b2', invoiceNumber: 'INV-1002', customerName: 'Zenith Ads', total: 4500, items: [{ name: 'Vinyl Banner 8x4' }] },
    ]
    const mockCustomers = [
      { id: 'c1', name: 'Apex Studio', phone: '9876543210', creditBalance: 200 },
      { id: 'c2', name: 'Kiran Offset', phone: '9123456789', creditBalance: 0 },
    ]
    const mockInventory = [
      { id: 'i1', name: 'A4 Color Prints', rate: 10, stock: 500 },
      { id: 'i2', name: 'Vinyl Banner 8x4', rate: 120, stock: 15 },
    ]
    const mockExpenses = [
      { id: 'e1', category: 'Raw Materials - Vinyl', amount: 3500 },
      { id: 'e2', category: 'Tea & Snacks', amount: 150 },
    ]

    it('matches across invoices, clients, inventory and expenses concurrently with category grouping', () => {
      // Query "Vinyl" should match:
      // - 1 bill (INV-1002 with Vinyl Banner item)
      // - 1 inventory item (Vinyl Banner 8x4)
      // - 1 expense (Raw Materials - Vinyl)
      const results = globalOmniSearch({
        bills: mockBills,
        customers: mockCustomers,
        inventory: mockInventory,
        expenses: mockExpenses,
        advances: [],
        query: 'Vinyl',
        limitPerCategory: 5,
      })

      expect(results.bills.length).toBe(1)
      expect(results.bills[0].invoiceNumber).toBe('INV-1002')
      expect(results.inventory.length).toBe(1)
      expect(results.inventory[0].name).toBe('Vinyl Banner 8x4')
      expect(results.expenses.length).toBe(1)
      expect(results.expenses[0].category).toBe('Raw Materials - Vinyl')
      expect(results.totalMatches).toBe(3)
    })

    it('matches client name across both customer directory and billing records', () => {
      const results = globalOmniSearch({
        bills: mockBills,
        customers: mockCustomers,
        inventory: mockInventory,
        expenses: mockExpenses,
        advances: [],
        query: 'Apex',
      })

      expect(results.customers.length).toBe(1)
      expect(results.customers[0].name).toBe('Apex Studio')
      expect(results.bills.length).toBe(1)
      expect(results.bills[0].invoiceNumber).toBe('INV-1001')
    })
  })

  describe('Command Palette Action Shortcuts & Search Integration', () => {
    it('filters commands and actions alongside search query', () => {
      const actions = [
        { id: 'act-new-bill', title: 'Create New Invoice / Bill', category: 'Actions' },
        { id: 'act-group-bill', title: 'Group Billing Terminal', category: 'Actions' },
        { id: 'act-finance', title: 'Finance & Accounts Hub', category: 'Actions' },
        { id: 'act-backup', title: '1-Click Cloud Snapshot', category: 'Actions' },
      ]

      const filterActions = (q: string) => {
        if (!q.trim()) return actions
        return actions.filter((a) => a.title.toLowerCase().includes(q.toLowerCase()))
      }

      // Query "Bill" matches New Invoice and Group Billing
      const billActions = filterActions('bill')
      expect(billActions.length).toBe(2)
      expect(billActions[0].id).toBe('act-new-bill')
      expect(billActions[1].id).toBe('act-group-bill')

      // Query "Snapshot" matches Backup
      const backupActions = filterActions('snapshot')
      expect(backupActions.length).toBe(1)
      expect(backupActions[0].id).toBe('act-backup')
    })
  })

  describe('Notification Drawer Classification & Routing Logic', () => {
    it('correctly categorizes notifications and resolves target navigation paths', () => {
      const notifications = [
        { id: 'n1', title: 'Low Stock Alert', message: 'A4 Paper is below 50 reams', read: false },
        { id: 'n2', title: 'Invoice Generated', message: 'Bill #INV-1001 created', read: false },
        { id: 'n3', title: 'Customer Credit Exceeded', message: 'Apex Studio limit reached', read: true },
        { id: 'n4', title: 'Database Backup Completed', message: 'Cloud snapshot saved', read: false },
      ]

      // Unread count
      const unread = notifications.filter((n) => !n.read)
      expect(unread.length).toBe(3)

      // Route resolver helper
      const resolveTargetRoute = (n: { title: string; message: string }) => {
        const text = `${n.title} ${n.message}`.toLowerCase()
        if (text.includes('stock') || text.includes('paper')) return '/inventory'
        if (text.includes('invoice') || text.includes('bill')) return '/billing'
        if (text.includes('customer') || text.includes('credit')) return '/customers'
        if (text.includes('backup') || text.includes('snapshot')) return '/settings?tab=backup'
        return '/dashboard'
      }

      expect(resolveTargetRoute(notifications[0])).toBe('/inventory')
      expect(resolveTargetRoute(notifications[1])).toBe('/billing')
      expect(resolveTargetRoute(notifications[2])).toBe('/customers')
      expect(resolveTargetRoute(notifications[3])).toBe('/settings?tab=backup')
    })
  })
})
