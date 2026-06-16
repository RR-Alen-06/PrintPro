import React, { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { Save, CheckCircle, Building2, BarChart3, Sliders, AlertTriangle } from 'lucide-react'

const Settings = () => {
  const { settings, updateSettings, business, updateBusiness } = useAppContext()

  // Business profile local state
  const [biz, setBiz] = useState({
    shopName: business.shopName || '',
    ownerName: business.ownerName || '',
    phone: business.phone || '',
    address: business.address || '',
    gstin: business.gstin || '',
    upiId: business.upiId || '',
  })
  const [bizSaved, setBizSaved] = useState(false)

  // Accounting settings local state
  const [acct, setAcct] = useState({
    gstRate: settings.gstRate ?? 0,
    viewMode: settings.viewMode || 'monthly',
  })
  const [acctSaved, setAcctSaved] = useState(false)

  const [clearConfirm, setClearConfirm] = useState(false)

  const handleBizSave = (e) => {
    e.preventDefault()
    updateBusiness(biz)
    setBizSaved(true)
    setTimeout(() => setBizSaved(false), 3000)
  }

  const handleAcctSave = (e) => {
    e.preventDefault()
    updateSettings({ gstRate: Number(acct.gstRate), viewMode: acct.viewMode })
    setAcctSaved(true)
    setTimeout(() => setAcctSaved(false), 3000)
  }

  const handleClearData = () => {
    if (clearConfirm) {
      localStorage.removeItem('printpro-state')
      window.location.reload()
    } else {
      setClearConfirm(true)
      setTimeout(() => setClearConfirm(false), 5000)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure your business profile, accounting preferences, and app settings.</p>
      </div>

      {/* Section 1: Business Profile */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--accent-light)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <Building2 size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Business Profile</h2>
            <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>Shown on receipts and invoices.</p>
          </div>
        </div>

        <form onSubmit={handleBizSave}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Shop Name</label>
              <input
                className="form-input"
                type="text"
                value={biz.shopName}
                onChange={(e) => setBiz((b) => ({ ...b, shopName: e.target.value }))}
                placeholder="e.g. PrintPro"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Owner Name</label>
              <input
                className="form-input"
                type="text"
                value={biz.ownerName}
                onChange={(e) => setBiz((b) => ({ ...b, ownerName: e.target.value }))}
                placeholder="Full name"
              />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '4px' }}>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                type="tel"
                value={biz.phone}
                onChange={(e) => setBiz((b) => ({ ...b, phone: e.target.value }))}
                placeholder="Contact number"
              />
            </div>
            <div className="form-group">
              <label className="form-label">UPI ID</label>
              <input
                className="form-input"
                type="text"
                value={biz.upiId}
                onChange={(e) => setBiz((b) => ({ ...b, upiId: e.target.value }))}
                placeholder="e.g. yourshop@upi"
              />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '4px' }}>
            <div className="form-group">
              <label className="form-label">GSTIN</label>
              <input
                className="form-input"
                type="text"
                value={biz.gstin}
                onChange={(e) => setBiz((b) => ({ ...b, gstin: e.target.value }))}
                placeholder="GST Number"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea
                className="form-textarea"
                value={biz.address}
                onChange={(e) => setBiz((b) => ({ ...b, address: e.target.value }))}
                placeholder="Shop address"
                style={{ minHeight: '60px' }}
              />
            </div>
          </div>

          {bizSaved && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', marginBottom: '12px',
              background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
            }}>
              <CheckCircle size={16} /> Business profile saved!
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
            <Save size={16} /> Save Profile
          </button>
        </form>
      </div>

      {/* Section 2: Accounting Settings */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)' }}>
            <BarChart3 size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Accounting Settings</h2>
            <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>GST rate and reporting preferences.</p>
          </div>
        </div>

        <form onSubmit={handleAcctSave}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">GST Rate (%)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={acct.gstRate}
                onChange={(e) => setAcct((a) => ({ ...a, gstRate: e.target.value }))}
                placeholder="0"
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Set to 0 to disable GST calculation.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">View Mode</label>
              <select
                className="form-select"
                value={acct.viewMode}
                onChange={(e) => setAcct((a) => ({ ...a, viewMode: e.target.value }))}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Default date range for reports.
              </p>
            </div>
          </div>

          {acctSaved && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', marginBottom: '12px',
              background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
            }}>
              <CheckCircle size={16} /> Accounting settings saved!
            </div>
          )}

          <button type="submit" className="btn btn-primary">
            <Save size={16} /> Save Settings
          </button>
        </form>
      </div>

      {/* Section 3: App Preferences */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--error-bg)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}>
            <Sliders size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>App Preferences</h2>
            <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>Theme, storage, and data management.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Theme</div>
            <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
              PrintPro uses a fixed premium dark theme optimized for long work sessions.
            </p>
          </div>

          <div style={{ padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Data Storage</div>
            <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
              All data is stored locally in your browser's localStorage. No backend or cloud sync. Export regular backups from Data Management.
            </p>
          </div>

          <div style={{ padding: '14px 16px', background: 'var(--error-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--error)', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--error)', marginBottom: '4px' }}>Clear All Data</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                  This permanently erases ALL data: bills, customers, payments, expenses, and settings. This cannot be undone.
                </p>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleClearData}
                >
                  {clearConfirm ? (
                    <><AlertTriangle size={16} /> Click again to confirm — this is irreversible!</>
                  ) : (
                    'Clear All Data'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
