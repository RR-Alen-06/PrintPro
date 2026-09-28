import React from 'react'
import { BarChart3, CheckCircle, Save } from 'lucide-react'

export interface AccountingData {
  gstRate: number | string
  viewMode: string
  refundsEnabled: boolean
  fyInvoicePrefixing: boolean
}

interface AccountingTabProps {
  acct: AccountingData
  setAcct: React.Dispatch<React.SetStateAction<AccountingData>>
  handleAcctSave: (e: React.FormEvent) => Promise<void>
  acctSaved: boolean
}

export const AccountingTab: React.FC<AccountingTabProps> = ({
  acct,
  setAcct,
  handleAcctSave,
  acctSaved,
}) => {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            background: 'var(--warning-bg)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--warning)',
          }}
        >
          <BarChart3 size={18} />
        </div>
        <div>
          <h2 style={{ margin: 0 }}>Accounting Settings</h2>
          <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>
            GST rate and reporting preferences.
          </p>
        </div>
      </div>

      <form onSubmit={handleAcctSave} autoComplete="off">
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

        <div className="form-row" style={{ marginTop: '12px' }}>
          <div className="form-group" style={{ marginBottom: '0' }}>
            <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={acct.refundsEnabled}
                onChange={(e) => setAcct((a) => ({ ...a, refundsEnabled: e.target.checked }))}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: 600 }}>Enable Refunds Module</span>
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '26px' }}>
              Show the Refunds module for managing cash/UPI reversals.
            </p>
          </div>
        </div>

        <div className="form-row" style={{ marginTop: '12px', marginBottom: '16px' }}>
          <div className="form-group" style={{ marginBottom: '0' }}>
            <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={acct.fyInvoicePrefixing}
                onChange={(e) => setAcct((a) => ({ ...a, fyInvoicePrefixing: e.target.checked }))}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: 600 }}>Enable Financial Year (FY) Invoice Prefixing &amp; Reset</span>
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '26px' }}>
              Generate tax invoices prefixed with current FY (e.g. INV/26-27/0001) and reset sequence back to 1 every April 1st.
            </p>
          </div>
        </div>

        {acctSaved && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              marginBottom: '12px',
              background: 'var(--success-bg)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--success)',
              fontSize: '0.875rem',
            }}
          >
            <CheckCircle size={16} /> Accounting settings saved!
          </div>
        )}

        <button type="submit" className="btn btn-primary">
          <Save size={16} /> Save Settings
        </button>
      </form>
    </div>
  )
}
export default AccountingTab
