import React from 'react'
import { Palette, CheckCircle, Save, Printer } from 'lucide-react'

export interface BrandingData {
  primaryColor: string
  logoUrl: string
  headerNotes: string
  footerNotes: string
  showGstBreakdown: boolean
  showUpiQrCode: boolean
  silentThermalPrint: boolean
  printPaperSize: string
  autoPrintOnSave: boolean
  shopSealUrl: string
  signatorySignatureUrl: string
  pdfShowType: boolean
  pdfShowSides: boolean
  pdfShowUnitPrice: boolean
  pdfShowGstRate: boolean
  pdfColorTheme: string
  pdfLegalFooter: string
}

interface BrandingTabProps {
  branding: BrandingData
  setBranding: React.Dispatch<React.SetStateAction<BrandingData>>
  handleBrandingSave: (e: React.FormEvent) => Promise<void>
  brandingSaved: boolean
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleClearLogo: () => void
  handleSealUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSignatureUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const BrandingTab: React.FC<BrandingTabProps> = ({
  branding,
  setBranding,
  handleBrandingSave,
  brandingSaved,
  handleLogoUpload,
  handleClearLogo,
  handleSealUpload,
  handleSignatureUpload,
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
          <Palette size={18} />
        </div>
        <div>
          <h2 style={{ margin: 0 }}>Invoice &amp; Receipt Customizer</h2>
          <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>
            Choose colors, upload a logo, and define custom receipt texts.
          </p>
        </div>
      </div>

      <form onSubmit={handleBrandingSave} autoComplete="off">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Primary Color Theme</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="color"
                value={branding.primaryColor}
                onChange={(e) => setBranding((prev) => ({ ...prev, primaryColor: e.target.value }))}
                style={{
                  width: '48px',
                  height: '38px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  padding: '2px',
                  background: 'none',
                }}
              />
              <input
                className="form-input"
                type="text"
                value={branding.primaryColor}
                onChange={(e) => setBranding((prev) => ({ ...prev, primaryColor: e.target.value }))}
                placeholder="#0f172a"
                style={{ flex: 1 }}
              />
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Used for borders, headers, and accents in the receipt and PDF formats.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Shop Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {branding.logoUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img
                    src={branding.logoUrl}
                    alt="Logo"
                    style={{
                      maxHeight: '42px',
                      maxWidth: '100px',
                      objectFit: 'contain',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '2px',
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleClearLogo}
                    style={{ color: 'var(--error)' }}
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  style={{ fontSize: '0.82rem' }}
                />
              )}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Max size: 200KB. Displayed at top of A4 Invoice and Receipt PDFs.
            </p>
          </div>
        </div>

        <div className="form-row" style={{ marginTop: '8px' }}>
          <div className="form-group">
            <label className="form-label">Custom Header Notes</label>
            <textarea
              className="form-textarea"
              value={branding.headerNotes}
              onChange={(e) => setBranding((prev) => ({ ...prev, headerNotes: e.target.value }))}
              placeholder="e.g. GST registration details, welcome message..."
              style={{ minHeight: '60px' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Custom Footer Notes</label>
            <textarea
              className="form-textarea"
              value={branding.footerNotes}
              onChange={(e) => setBranding((prev) => ({ ...prev, footerNotes: e.target.value }))}
              placeholder="e.g. Terms & conditions, thank you notes, return policy..."
              style={{ minHeight: '60px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', margin: '8px 0 16px' }}>
          <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={branding.showGstBreakdown}
              onChange={(e) => setBranding((prev) => ({ ...prev, showGstBreakdown: e.target.checked }))}
              style={{ width: '18px', height: '18px' }}
            />
            <span style={{ fontWeight: 600 }}>Show GST Breakdown on Invoice</span>
          </label>
          <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={branding.showUpiQrCode}
              onChange={(e) => setBranding((prev) => ({ ...prev, showUpiQrCode: e.target.checked }))}
              style={{ width: '18px', height: '18px' }}
            />
            <span style={{ fontWeight: 600 }}>Generate UPI QR Code for Due Amounts</span>
          </label>
          <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={branding.silentThermalPrint}
              onChange={(e) => setBranding((prev) => ({ ...prev, silentThermalPrint: e.target.checked }))}
              style={{ width: '18px', height: '18px' }}
            />
            <span style={{ fontWeight: 600 }}>Enable Silent Thermal Printing on Bill Creation</span>
          </label>
          <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={branding.autoPrintOnSave}
              onChange={(e) => setBranding((prev) => ({ ...prev, autoPrintOnSave: e.target.checked }))}
              style={{ width: '18px', height: '18px' }}
            />
            <span style={{ fontWeight: 600 }}>Auto-Trigger Print Dialog on Bill Save</span>
          </label>
        </div>

        {/* Thermal Printer Paper Format */}
        <div
          style={{
            padding: '16px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            marginBottom: '16px',
          }}
        >
          <h4
            style={{
              marginBottom: '10px',
              fontSize: '0.9rem',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Printer size={16} /> Default Print Format &amp; Thermal Roll Size
          </h4>
          <div className="form-row" style={{ alignItems: 'center' }}>
            <div className="form-group" style={{ flex: '1 1 240px' }}>
              <label className="form-label">Receipt Output Format</label>
              <select
                className="form-control"
                value={branding.printPaperSize}
                onChange={(e) => setBranding((prev) => ({ ...prev, printPaperSize: e.target.value }))}
              >
                <option value="58mm">58mm POS Thermal Roll (Compact)</option>
                <option value="80mm">80mm POS Thermal Roll (Standard / Wide)</option>
                <option value="A4">A4 Full Page Document (Standard PDF / Invoice)</option>
              </select>
            </div>
            <div style={{ flex: '1 1 300px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Configures default receipt width and formatting for 1-click printing across POS Billing and Customer Bills.
            </div>
          </div>
        </div>

        {/* Shop Seal & Authorized Signature */}
        <div
          style={{
            padding: '16px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            marginBottom: '16px',
          }}
        >
          <h4 style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            Shop Seal &amp; Authorized Signature
          </h4>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Shop Seal Image</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {branding.shopSealUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={branding.shopSealUrl}
                      alt="Seal"
                      style={{
                        maxHeight: '50px',
                        maxWidth: '100px',
                        objectFit: 'contain',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '2px',
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setBranding((prev) => ({ ...prev, shopSealUrl: '' }))}
                      style={{ color: 'var(--error)' }}
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <input type="file" accept="image/*" onChange={handleSealUpload} style={{ fontSize: '0.82rem' }} />
                )}
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Appears at the bottom of PDF tax invoices. Max 200KB.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Authorized Signatory</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {branding.signatorySignatureUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={branding.signatorySignatureUrl}
                      alt="Signature"
                      style={{
                        maxHeight: '50px',
                        maxWidth: '100px',
                        objectFit: 'contain',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '2px',
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setBranding((prev) => ({ ...prev, signatorySignatureUrl: '' }))}
                      style={{ color: 'var(--error)' }}
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <input type="file" accept="image/*" onChange={handleSignatureUpload} style={{ fontSize: '0.82rem' }} />
                )}
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Manager/owner signature stamp. Max 200KB.
              </p>
            </div>
          </div>
        </div>

        {/* Advanced PDF Invoice Designer */}
        <div
          style={{
            padding: '16px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            marginBottom: '16px',
          }}
        >
          <h4 style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            Advanced PDF Invoice Designer
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={branding.pdfShowType}
                onChange={(e) => setBranding((prev) => ({ ...prev, pdfShowType: e.target.checked }))}
              />
              Show &quot;Type&quot; Column
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={branding.pdfShowSides}
                onChange={(e) => setBranding((prev) => ({ ...prev, pdfShowSides: e.target.checked }))}
              />
              Show &quot;Sides&quot; Column
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={branding.pdfShowUnitPrice}
                onChange={(e) => setBranding((prev) => ({ ...prev, pdfShowUnitPrice: e.target.checked }))}
              />
              Show &quot;Unit Price&quot; Column
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={branding.pdfShowGstRate}
                onChange={(e) => setBranding((prev) => ({ ...prev, pdfShowGstRate: e.target.checked }))}
              />
              Show &quot;GST Rate&quot; Column
            </label>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">PDF Color Theme</label>
              <select
                className="form-select"
                value={branding.pdfColorTheme}
                onChange={(e) => setBranding((prev) => ({ ...prev, pdfColorTheme: e.target.value }))}
              >
                <option value="dark">Professional Dark Navy</option>
                <option value="blue">Royal Blue</option>
                <option value="green">Emerald Green</option>
                <option value="maroon">Classic Maroon</option>
                <option value="purple">Regal Purple</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Legal Declaration / Footer Note</label>
              <textarea
                className="form-textarea"
                value={branding.pdfLegalFooter}
                onChange={(e) => setBranding((prev) => ({ ...prev, pdfLegalFooter: e.target.value }))}
                placeholder="e.g. Subject to jurisdiction of local courts. E&OE."
                style={{ minHeight: '50px' }}
              />
            </div>
          </div>
        </div>

        {brandingSaved && (
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
            <CheckCircle size={16} /> Theme branding settings saved!
          </div>
        )}

        <button type="submit" className="btn btn-primary">
          <Save size={16} /> Save Theme Settings
        </button>
      </form>
    </div>
  )
}
export default BrandingTab
