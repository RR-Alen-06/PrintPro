import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBills } from '../../hooks/useBillsQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import { BarChart3, Search, Printer, Tag, Loader2 } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileItemSalesReport() {
  const navigate = useNavigate()
  const { data: bills = [], isLoading: isLoadingBills } = useBills()
  const [searchTerm, setSearchTerm] = useState('')

  // Item Sales Aggregations
  const itemReportData = useMemo(() => {
    const map = {}
    ;(bills || []).filter(b => !b.deleted && !b.deleted_at).forEach(b => {
      ;(b.items || []).forEach(item => {
        const key = item.itemName || item.name || item.item_name || 'Custom Item'
        if (!map[key]) {
          map[key] = { name: key, totalQty: 0, totalRev: 0, ordersCount: 0 }
        }
        map[key].totalQty += Number(item.qty || 1)
        map[key].totalRev += Number(item.amount || 0)
        map[key].ordersCount += 1
      })
    })

    return Object.values(map).sort((a, b) => b.totalRev - a.totalRev)
  }, [bills])

  const filteredData = useMemo(() => {
    return itemReportData.filter(i => {
      if (searchTerm.trim()) {
        return i.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
      }
      return true
    })
  }, [itemReportData, searchTerm])

  return (
    <MobileLayout title="Item Sales Analytics" onSwitchToDesktop={() => navigate('/item-sales-report')}>
      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>CATALOG PERFORMANCE</span>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>ITEM SALES REPORT</h2>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: '14px' }}>
        <Search size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
        <input
          type="text"
          className="mobile-input"
          style={{ paddingLeft: '42px' }}
          placeholder="Filter item name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Loading indicator */}
      {isLoadingBills && (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '24px' }}>
          <Loader2 size={24} className="spin" style={{ color: 'var(--accent-secondary)', margin: '0 auto 8px auto' }} />
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Calculating sales analytics...</p>
        </div>
      )}

      {/* Item Performance Stack */}
      {!isLoadingBills && filteredData.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          No item sales records found.
        </div>
      ) : (
        !isLoadingBills && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredData.map(item => (
              <div key={item.name} className="mobile-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{item.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {item.totalQty} Units Sold • {item.ordersCount} Orders
                    </div>
                  </div>
                  <div className="currency-num" style={{ fontSize: '1.15rem', color: 'var(--accent-primary)' }}>
                    ₹{item.totalRev.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </MobileLayout>
  )
}
