import React from 'react'
import { Building2, CheckCircle, Save } from 'lucide-react'

export interface BusinessProfileData {
  shopName: string
  ownerName: string
  phone: string
  address: string
  gstin: string
  upiId: string
}

interface BusinessProfileTabProps {
  biz: BusinessProfileData
  setBiz: React.Dispatch<React.SetStateAction<BusinessProfileData>>
  handleSaveBiz: (e: React.FormEvent) => Promise<void>
  bizSaved: boolean
}

export const BusinessProfileTab: React.FC<BusinessProfileTabProps> = ({
  biz,
  setBiz,
  handleSaveBiz,
  bizSaved,
}) => {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            background: 'var(--accent-light)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
          }}
        >
          <Building2 size={18} />
        </div>
        <div>
          <h2 style={{ margin: 0 }}>Business Profile</h2>
          <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>
            Shown on receipts, tax invoices, and account reports.
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveBiz} autoComplete="off">
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
            <CheckCircle size={16} /> Business profile saved!
          </div>
        )}

        <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
          <Save size={16} /> Save Profile
        </button>
      </form>
    </div>
  )
}
export default BusinessProfileTab
