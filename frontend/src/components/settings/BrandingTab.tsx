import React from 'react'
import { Palette, CheckCircle, Save, Printer, Receipt, FileText, Check, Zap } from 'lucide-react'

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
        </div>

        {/* Thermal Printer & Format Configuration */}
        <div
          style={{
            padding: '20px',
            background: 'linear-gradient(145deg, rgba(20, 15, 38, 0.7) 0%, rgba(10, 6, 22, 0.9) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 'var(--radius-lg, 12px)',
            border: '1px solid rgba(0, 240, 255, 0.18)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(0, 240, 255, 0.15)',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--aurora-cyan, #00f0ff)',
                }}
              >
                <Printer size={17} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
                  Default Print Format &amp; Thermal Roll Size
                </h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  Configures default receipt paper width, POS alignment, and automated printing behaviors.
                </p>
              </div>
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(0, 240, 255, 0.1)',
                border: '1px solid rgba(0, 240, 255, 0.25)',
                color: 'var(--aurora-cyan, #00f0ff)',
                fontWeight: 600,
              }}
            >
              Active: {branding.printPaperSize === '58mm' ? '58mm Thermal' : branding.printPaperSize === 'A4' ? 'A4 Document' : '80mm Standard'}
            </span>
          </div>

          {/* Preset Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '12px',
              marginBottom: '18px',
            }}
          >
            {[
              {
                id: '58mm',
                name: '58mm POS Roll',
                subname: 'Compact Thermal',
                badge: '58 mm / 2.25"',
                icon: Receipt,
                desc: 'Handheld Bluetooth & mini POS printers. Ultra-compact ticket layout.',
                color: '#38bdf8',
              },
              {
                id: '80mm',
                name: '80mm POS Roll',
                subname: 'Standard POS (Default)',
                badge: '80 mm / 3.15"',
                icon: Printer,
                desc: 'High-speed desktop thermal receipt printers & auto-cutters.',
                color: '#00f0ff',
              },
              {
                id: 'A4',
                name: 'A4 Document',
                subname: 'Full Page Invoice',
                badge: '210 × 297 mm',
                icon: FileText,
                desc: 'Laser / Inkjet tax invoice sheets with detailed itemized GST tables.',
                color: '#a855f7',
              },
            ].map((fmt) => {
              const Icon = fmt.icon
              const isSelected = (branding.printPaperSize || '80mm') === fmt.id

              return (
                <div
                  key={fmt.id}
                  onClick={() => setBranding((prev) => ({ ...prev, printPaperSize: fmt.id }))}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    padding: '14px',
                    borderRadius: '10px',
                    background: isSelected
                      ? 'linear-gradient(180deg, rgba(0, 240, 255, 0.12) 0%, rgba(112, 0, 255, 0.08) 100%)'
                      : 'rgba(255, 255, 255, 0.02)',
                    border: isSelected
                      ? '1.5px solid var(--aurora-cyan, #00f0ff)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: isSelected
                      ? '0 0 16px rgba(0, 240, 255, 0.2), inset 0 0 12px rgba(0, 240, 255, 0.05)'
                      : 'none',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: isSelected ? fmt.color : 'var(--text-secondary, #94a3b8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: '4px',
                        background: isSelected ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: isSelected ? '#ffffff' : 'var(--text-muted, #64748b)',
                        border: isSelected ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      {fmt.badge}
                    </span>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: isSelected ? '#ffffff' : 'var(--text-primary, #f1f5f9)' }}>
                        {fmt.name}
                      </span>
                      {isSelected && (
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: 'var(--aurora-cyan, #00f0ff)',
                            color: '#05010f',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={11} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: isSelected ? fmt.color : 'var(--text-muted, #64748b)', fontWeight: 500, marginTop: '2px' }}>
                      {fmt.subname}
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.35 }}>
                    {fmt.desc}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Print Automation Toggles Container */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '12px',
              paddingTop: '14px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: branding.silentThermalPrint ? 'rgba(0, 240, 255, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                border: branding.silentThermalPrint ? '1px solid rgba(0, 240, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="checkbox"
                checked={branding.silentThermalPrint}
                onChange={(e) => setBranding((prev) => ({ ...prev, silentThermalPrint: e.target.checked }))}
                style={{ width: '17px', height: '17px', marginTop: '2px', accentColor: 'var(--aurora-cyan, #00f0ff)', cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={14} style={{ color: 'var(--aurora-cyan, #00f0ff)' }} /> Silent Thermal Print
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                  Sends ESC/POS print jobs directly without interrupting cashier workflow with popup prompts.
                </div>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: branding.autoPrintOnSave ? 'rgba(0, 240, 255, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                border: branding.autoPrintOnSave ? '1px solid rgba(0, 240, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="checkbox"
                checked={branding.autoPrintOnSave}
                onChange={(e) => setBranding((prev) => ({ ...prev, autoPrintOnSave: e.target.checked }))}
                style={{ width: '17px', height: '17px', marginTop: '2px', accentColor: 'var(--aurora-cyan, #00f0ff)', cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Printer size={14} style={{ color: 'var(--accent, #3b82f6)' }} /> Auto-Trigger Print on Bill Save
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                  Instantly triggers system print dialog the moment an invoice or customer bill is finalized.
                </div>
              </div>
            </label>
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
