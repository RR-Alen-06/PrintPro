import React from 'react'
import { useAppContext } from '../context/AppContext'
import { Settings as SettingsIcon } from 'lucide-react'

const Settings = () => {
  const { settings, updateSettings, business, updateBusiness } = useAppContext()

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure GST, business profile, payment methods, and monthly/yearly views.</p>
      </div>

      <div className="card">
        <div className="bill-view-header">
          <div>
            <h2>Business Profile</h2>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Shop Name</label>
            <input
              className="form-input"
              type="text"
              value={business.shopName}
              onChange={(event) => updateBusiness({ shopName: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">UPI ID</label>
            <input
              className="form-input"
              type="text"
              value={business.upiId}
              onChange={(event) => updateBusiness({ upiId: event.target.value })}
            />
          </div>
        </div>
        <div className="form-row" style={{ marginTop: '16px' }}>
          <div className="form-group">
            <label className="form-label">Owner Name</label>
            <input
              className="form-input"
              type="text"
              value={business.ownerName}
              onChange={(event) => updateBusiness({ ownerName: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input
              className="form-input"
              type="text"
              value={business.phone}
              onChange={(event) => updateBusiness({ phone: event.target.value })}
            />
          </div>
        </div>
        <div className="form-row" style={{ marginTop: '16px' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Address</label>
            <textarea
              className="form-textarea"
              value={business.address}
              onChange={(event) => updateBusiness({ address: event.target.value })}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">GSTIN</label>
            <input
              className="form-input"
              type="text"
              value={business.gstin}
              onChange={(event) => updateBusiness({ gstin: event.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div className="bill-view-header">
          <div>
            <h2>Accounting Settings</h2>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">GST Rate (%)</label>
            <input
              className="form-input"
              type="number"
              value={settings.gstRate}
              onChange={(event) => updateSettings({ gstRate: Number(event.target.value) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">View Mode</label>
            <select
              className="form-select"
              value={settings.viewMode}
              onChange={(event) => updateSettings({ viewMode: event.target.value })}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
