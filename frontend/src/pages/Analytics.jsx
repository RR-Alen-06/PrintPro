import React, { useMemo } from 'react'
import { useAppContext } from '../context/AppContext'

const Analytics = () => {
  const { bills, customers, inventory } = useAppContext()

  const salesSummary = useMemo(() => {
    const totalRevenue = bills.filter((bill) => !bill.deleted).reduce((sum, bill) => sum + Number(bill.total || 0), 0)
    const totalPaid = bills.filter((bill) => !bill.deleted).reduce((sum, bill) => sum + Number(bill.amountPaid || 0), 0)
    const outstanding = bills.filter((bill) => !bill.deleted).reduce((sum, bill) => sum + Number(bill.balance || 0), 0)
    const count = bills.filter((bill) => !bill.deleted).length
    return { totalRevenue, totalPaid, outstanding, count }
  }, [bills])

  const revenueByCustomer = useMemo(() => {
    const revenue = {}
    bills.filter((bill) => !bill.deleted).forEach((bill) => {
      revenue[bill.customerName] = (revenue[bill.customerName] || 0) + Number(bill.total || 0)
    })
    return Object.entries(revenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }))
  }, [bills])

  const printTypeAnalysis = useMemo(() => {
    const counts = {
      'Color Single': 0,
      'Color Double': 0,
      'B/W Single': 0,
      'B/W Double': 0,
    }

    bills.filter((bill) => !bill.deleted).forEach((bill) => {
      bill.items?.forEach((item) => {
        const key = `${item.printType === 'color' ? 'Color' : 'B/W'} ${item.sides === 'double' ? 'Double' : 'Single'}`
        counts[key] = (counts[key] || 0) + (Number(item.qty) || 0)
      })
    })

    const maxCount = Math.max(...Object.values(counts), 1)
    return Object.keys(counts).map((label) => ({ label, count: counts[label], share: counts[label] / maxCount }))
  }, [bills])

  const monthlyTrend = useMemo(() => {
    const months = {}
    const now = new Date()
    for (let i = 0; i < 6; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = date.toLocaleString('default', { month: 'short', year: 'numeric' })
      months[key] = 0
    }

    bills.filter((bill) => !bill.deleted).forEach((bill) => {
      const billDate = new Date(bill.date)
      const key = billDate.toLocaleString('default', { month: 'short', year: 'numeric' })
      if (key in months) {
        months[key] += Number(bill.total || 0)
      }
    })

    return Object.entries(months)
      .reverse()
      .map(([name, value]) => ({ name, value, share: value / Math.max(...Object.values(months), 1) }))
  }, [bills])

  const averageOrder = salesSummary.count ? salesSummary.totalRevenue / salesSummary.count : 0

  return (
    <div>
      <div className="page-header">
        <h1>Analytics & Reports</h1>
        <p>View sales performance, customer revenue, and print type profitability.</p>
      </div>

      <div className="grid-3" style={{ gap: '20px' }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Revenue</div>
          <div className="stat-card-value">₹{salesSummary.totalRevenue.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Paid</div>
          <div className="stat-card-value">₹{salesSummary.totalPaid.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Outstanding</div>
          <div className="stat-card-value">₹{salesSummary.outstanding.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Bills Processed</div>
          <div className="stat-card-value">{salesSummary.count}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Average Order</div>
          <div className="stat-card-value">₹{averageOrder.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Customers</div>
          <div className="stat-card-value">{customers.length}</div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: '20px', marginTop: '24px' }}>
        <div className="card">
          <h2>Revenue Trend (Last 6 Months)</h2>
          <div style={{ display: 'grid', gap: '14px', marginTop: '20px' }}>
            {monthlyTrend.map((item) => (
              <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#1f2937', borderRadius: '8px', overflow: 'hidden', height: '12px' }}>
                  <div style={{ width: `${Math.max(item.share * 100, 5)}%`, height: '100%', background: '#3b82f6' }} />
                </div>
                <div style={{ minWidth: '80px', textAlign: 'right', fontSize: '13px' }}>₹{item.value.toFixed(0)}</div>
                <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: '#9ca3af' }}>{item.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Top Customers</h2>
          <div style={{ display: 'grid', gap: '12px', marginTop: '20px' }}>
            {revenueByCustomer.length === 0 ? (
              <p className="text-muted">No customer revenue data available.</p>
            ) : (
              revenueByCustomer.map((customer) => (
                <div key={customer.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '600' }}>{customer.name}</div>
                    <div style={{ height: '10px', background: '#111827', borderRadius: '6px', overflow: 'hidden', marginTop: '6px' }}>
                      <div style={{ width: `${Math.max((customer.value / Math.max(...revenueByCustomer.map((c) => c.value))) * 100, 5)}%`, height: '100%', background: '#10b981' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: '600' }}>₹{customer.value.toFixed(0)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h2>Print Type Analysis</h2>
        <div style={{ display: 'grid', gap: '14px', marginTop: '20px' }}>
          {printTypeAnalysis.map((type) => (
            <div key={type.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '600' }}>{type.label}</div>
                <div style={{ height: '12px', width: '100%', background: '#111827', borderRadius: '6px', overflow: 'hidden', marginTop: '6px' }}>
                  <div style={{ width: `${Math.max(type.share * 100, 5)}%`, height: '100%', background: '#f59e0b' }} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>{type.count} units</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Analytics
