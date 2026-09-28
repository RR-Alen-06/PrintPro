import { describe, it, expect } from 'vitest'
import { createFullBackup } from '../../utils/dataExport'
import { validateBackupFile, restoreFromBackup, importCustomersFromCSV, importInventoryFromCSV } from '../../utils/dataImport'

describe('Unified Settings & System Hub Workflows', () => {
  describe('JSON Snapshot Packaging, Schema Validation & Restore', () => {
    it('creates an enterprise JSON backup, validates its structure, and restores entities', () => {
      const mockState = {
        business: { shopName: 'PrintPro Aurora', phone: '9876543210' },
        customers: [
          { id: 'c1', name: 'Alen Graphics', phone: '9876543210', creditBalance: 0 },
          { id: 'c2', name: 'Zenith Prints', phone: '9123456780', creditBalance: 500 },
        ],
        customerGroups: [{ id: 'g1', groupName: 'Corporate VIPs' }],
        inventory: [
          { id: 'i1', name: 'A4 80GSM Sheet', rate: 2, stock: 1000 },
          { id: 'i2', name: 'Vinyl Banner Roll', rate: 45, stock: 20 },
        ],
        bills: [
          { id: 'b1', invoiceNumber: 'INV-1001', total: 1500, customerId: 'c1' },
          { id: 'b2', invoiceNumber: 'INV-1002', total: 3200, customerId: 'c2' },
        ],
        payments: [
          { id: 'p1', amount: 1500, paymentMethod: 'upi', billId: 'b1' },
        ],
        expenses: [
          { id: 'e1', category: 'Raw Materials', amount: 2000 },
        ],
        advancePayments: [
          { id: 'a1', customerId: 'c2', amount: 1000 },
        ],
        counters: { bill: 1002 },
        sequences: { invPrefix: 'INV' },
        settings: { gstRate: 18 },
      }

      // 1. Create backup
      const backup = createFullBackup(mockState)
      expect(backup).toHaveProperty('version')
      expect(backup).toHaveProperty('exportDate')
      expect(backup).toHaveProperty('data')

      // 2. Validate backup
      const isValid = validateBackupFile(backup)
      expect(isValid).toBe(true)

      // 3. Restore backup
      const restored = restoreFromBackup(backup)
      expect(restored.business.shopName).toBe('PrintPro Aurora')
      expect(restored.customers.length).toBe(2)
      expect(restored.inventory.length).toBe(2)
      expect(restored.bills.length).toBe(2)
      expect(restored.payments.length).toBe(1)
      expect(restored.expenses.length).toBe(1)
      expect(restored.advancePayments.length).toBe(1)
      expect(restored.settings.gstRate).toBe(18)
    })

    it('rejects corrupt or invalid backup files missing required registers', () => {
      const corruptBackup = {
        version: '1.0',
        data: {
          someRandomField: 123,
        },
      }
      expect(validateBackupFile(corruptBackup)).toBe(false)
      expect(() => restoreFromBackup(corruptBackup)).toThrow('Invalid backup file format')
    })
  })

  describe('Storage Diagnostic Footprint & Capacity Gauge', () => {
    it('computes storage utilization percentage and flags critical thresholds', () => {
      const quotaBytes = 10 * 1024 * 1024 // 10 MB quota
      
      const computeUsage = (usedBytes: number) => {
        const pct = Math.min(100, Math.round((usedBytes / quotaBytes) * 100))
        return {
          usedBytes,
          quotaBytes,
          pct,
          isCritical: pct >= 80,
          isNearFull: pct >= 95,
        }
      }

      // Case 1: Healthy usage (1.5 MB = 15%)
      const normal = computeUsage(1.5 * 1024 * 1024)
      expect(normal.pct).toBe(15)
      expect(normal.isCritical).toBe(false)

      // Case 2: Warning threshold (8.2 MB = 82%)
      const critical = computeUsage(8.2 * 1024 * 1024)
      expect(critical.pct).toBe(82)
      expect(critical.isCritical).toBe(true)
      expect(critical.isNearFull).toBe(false)

      // Case 3: Near full threshold (9.6 MB = 96%)
      const nearFull = computeUsage(9.6 * 1024 * 1024)
      expect(nearFull.pct).toBe(96)
      expect(nearFull.isCritical).toBe(true)
      expect(nearFull.isNearFull).toBe(true)
    })
  })

  describe('Recycle Bin Invoices Restore & Search Filters', () => {
    it('filters deleted invoices and simulates 1-click restore to active bill stream', () => {
      let bills = [
        { id: 'b1', invoiceNumber: 'INV-001', customerName: 'Rajesh', total: 500, deleted: false },
        { id: 'b2', invoiceNumber: 'INV-002', customerName: 'Priya Graphics', total: 1200, deleted: true, deleted_at: '2026-09-25T10:00:00Z' },
        { id: 'b3', invoiceNumber: 'INV-003', customerName: 'Apex Studio', total: 800, deleted: true, deleted_at: '2026-09-26T12:00:00Z' },
        { id: 'b4', invoiceNumber: 'INV-004', customerName: 'Priya Graphics', total: 350, deleted: false },
      ]

      // Filter deleted bills
      const deletedBills = bills.filter((b) => b.deleted)
      expect(deletedBills.length).toBe(2)

      // Search inside deleted bills by customer name "Priya"
      const searchPriya = deletedBills.filter((b) =>
        b.customerName.toLowerCase().includes('priya')
      )
      expect(searchPriya.length).toBe(1)
      expect(searchPriya[0].invoiceNumber).toBe('INV-002')

      // Simulate restoring INV-002
      const billToRestoreId = 'b2'
      bills = bills.map((b) => {
        if (b.id === billToRestoreId) {
          const { deleted_at, ...rest } = b
          return { ...rest, deleted: false }
        }
        return b
      })

      // Verification after restore
      const activeAfterRestore = bills.filter((b) => !b.deleted)
      const deletedAfterRestore = bills.filter((b) => b.deleted)

      expect(activeAfterRestore.length).toBe(3)
      expect(deletedAfterRestore.length).toBe(1)
      expect(deletedAfterRestore[0].id).toBe('b3')
      expect(activeAfterRestore.find((b) => b.id === 'b2')?.deleted).toBe(false)
    })
  })

  describe('CSV Import Entity Parsers', () => {
    it('correctly maps raw CSV rows into typed customer and inventory entities', () => {
      const rawCustomerRows = [
        { Name: 'Acme Signs', Phone: '9998887770', Email: 'acme@signs.com', 'Credit Balance': '250.50' },
        { Name: 'Beta Printers', Phone: '8887776660', 'Credit Balance': '0' },
      ]

      const customers = importCustomersFromCSV(rawCustomerRows)
      expect(customers.length).toBe(2)
      expect(customers[0].name).toBe('Acme Signs')
      expect(customers[0].phone).toBe('9998887770')
      expect(customers[0].creditBalance).toBe(250.50)

      const rawInventoryRows = [
        { Name: 'Glossy A3', 'Color Single': '15', 'Color Double': '25', Stock: '500' },
      ]

      const inventory = importInventoryFromCSV(rawInventoryRows)
      expect(inventory.length).toBe(1)
      expect(inventory[0].name).toBe('Glossy A3')
      expect(inventory[0].colorSingle).toBe(15)
      expect(inventory[0].colorDouble).toBe(25)
      expect(inventory[0].stock).toBe(500)
    })
  })
})
