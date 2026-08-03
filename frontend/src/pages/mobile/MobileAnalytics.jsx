import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import MobileLayout from '../../components/mobile/MobileLayout'
import { BarChart3, TrendingUp, Calendar, Download, PieChart, Layers, Users } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileAnalytics() {
  const navigate = useNavigate()
  const { bills, payments, expenses, customers } = useAppContext()

  const [period, setPeriod] = useState('monthly') // 'daily' | 'monthly' | 'yearly'

  // Analytics Aggregations matching desktop Analytics.jsx
  const metrics = useMemo(() => {
    const activeBills = (bills || []).filter(b => !b.deleted)
    const totalRev = activeBills.reduce((s, b) => s + Number(b.total || 0), 0)
    const totalPaid = (payments || []).filter(p => !p.isRefund).reduce((s, p) => s + Number(p.cashAmount || 0) + Number(p.upiAmount || 0), 0)
    const totalExp = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0)
    const totalDue = activeBills.reduce((s, b) => s + Number(b.balance || 0), 0)
    const activeClientsCount = (customers || []).filter(c => !c.deleted).length

    return {
      totalRev,
      totalPaid,
      totalExp,
      totalDue,
      netMargin: totalRev > 0 ? (((totalPaid - totalExp) / totalRev) * 100).toFixed(1) : '0.0',
      activeClientsCount
    }
  }, [bills, payments, expenses, customers])

  return (
    <MobileLayout title="Store Analytics" onSwitchToDesktop={() => navigate('/analytics')}>
      {/* Header Overview */}
      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>BUSINESS INTELLIGENCE</span>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>STORE PERFORMANCE ANALYTICS</h2>
      </div>

      {/* Horizontally Scrollable Analytics Summary Cards */}
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '20px' }}>
        <div className="mobile-card mobile-card-glow" style={{ minWidth: '200px', flex: '0 0 auto', borderColor: 'var(--accent-primary)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>NET CASH MARGIN</div>
          <div className="currency-num" style={{ fontSize: '1.5rem', color: 'var(--accent-primary)', marginTop: '4px' }}>
            {metrics.netMargin}%
          </div>
        </div>

        <div className="mobile-card" style={{ minWidth: '200px', flex: '0 0 auto', borderColor: 'var(--accent-secondary)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>REALIZED CASH INFLOW</div>
          <div className="currency-num" style={{ fontSize: '1.5rem', color: 'var(--accent-secondary)', marginTop: '4px' }}>
            ₹{metrics.totalPaid.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="mobile-card" style={{ minWidth: '200px', flex: '0 0 auto', borderColor: 'var(--success)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>ACTIVE CLIENT BASE</div>
          <div className="currency-num" style={{ fontSize: '1.5rem', color: 'var(--success)', marginTop: '4px' }}>
            {metrics.activeClientsCount} Clients
          </div>
        </div>
      </div>

      {/* Visual Analytics Bar Card */}
      <div className="mobile-card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 14px 0' }}>
          REVENUE vs EXPENSES BREAKDOWN
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>Total Invoiced Revenue</span>
              <span className="currency-num">₹{metrics.totalRev.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ height: '10px', borderRadius: 'var(--radius-full)', background: 'var(--bg-input)', overflow: 'hidden' }}>
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #ff2fb0, #a855f7)' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>Realized Cash Inflow</span>
              <span className="currency-num">₹{metrics.totalPaid.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ height: '10px', borderRadius: 'var(--radius-full)', background: 'var(--bg-input)', overflow: 'hidden' }}>
              <div style={{ width: metrics.totalRev > 0 ? `${Math.min(100, (metrics.totalPaid / metrics.totalRev) * 100)}%` : '0%', height: '100%', background: '#00f0ff' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>Operational Outflow</span>
              <span className="currency-num">₹{metrics.totalExp.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ height: '10px', borderRadius: 'var(--radius-full)', background: 'var(--bg-input)', overflow: 'hidden' }}>
              <div style={{ width: metrics.totalRev > 0 ? `${Math.min(100, (metrics.totalExp / metrics.totalRev) * 100)}%` : '0%', height: '100%', background: '#ff3860' }} />
            </div>
          </div>
        </div>
      </div>
    </MobileLayout>
  )
}
