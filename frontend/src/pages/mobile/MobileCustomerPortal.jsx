import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import MobileLayout from '../../components/mobile/MobileLayout'
import { Upload, FileText, CheckCircle, Smartphone, Printer, Send } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileCustomerPortal() {
  const navigate = useNavigate()
  const { showToast } = useAppContext()

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [printType, setPrintType] = useState('color')
  const [sides, setSides] = useState('single')
  const [copies, setCopies] = useState(1)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [submitted, setSubmitted] = useState(false)

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploadedFiles(files.map(f => ({ name: f.name, size: f.size, config: { printType, sides, copies } })))
    showToast(`Uploaded ${files.length} file(s)`, 'success')
  }

  const handleSubmitOrder = (e) => {
    e.preventDefault()
    if (!customerName.trim() || uploadedFiles.length === 0) {
      showToast('Please provide your name and upload print files', 'error')
      return
    }

    const orderPayload = {
      id: `PORTAL-${Date.now()}`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      files: uploadedFiles,
      status: 'pending',
      submittedAt: new Date().toISOString()
    }

    const existing = JSON.parse(localStorage.getItem('portal_orders') || '[]')
    localStorage.setItem('portal_orders', JSON.stringify([...existing, orderPayload]))

    setSubmitted(true)
    showToast('Print Order Submitted to Store POS Queue!', 'success')
  }

  return (
    <MobileLayout title="Customer Print Upload Portal" onSwitchToDesktop={() => navigate('/portal')}>
      <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--accent-secondary)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <Printer size={24} style={{ color: 'var(--accent-secondary)' }} />
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
              ONLINE PRINT SUBMISSION
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Send your PDF files directly to shop printing queue</div>
          </div>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '24px 12px' }}>
            <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: '12px' }} />
            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>ORDER SENT TO POS!</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Your print files are ready for shop operator pickup.</p>
            <button className="mobile-btn mobile-btn-primary" onClick={() => setSubmitted(false)}>
              Submit Another Print Order
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitOrder} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>YOUR NAME</label>
              <input type="text" className="mobile-input" placeholder="Alex Mercer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>PHONE NUMBER</label>
              <input type="tel" className="mobile-input" placeholder="+91 9876543210" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>PRINT TYPE</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button type="button" className={`mobile-btn ${printType === 'color' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`} onClick={() => setPrintType('color')} style={{ minHeight: '38px', fontSize: '0.82rem' }}>Color Print</button>
                <button type="button" className={`mobile-btn ${printType === 'bw' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`} onClick={() => setPrintType('bw')} style={{ minHeight: '38px', fontSize: '0.82rem' }}>Black & White</button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>UPLOAD PDF DOCUMENT</label>
              <input type="file" accept=".pdf,image/*" className="mobile-input" onChange={handleFileUpload} multiple required />
            </div>

            <button type="submit" className="mobile-btn mobile-btn-primary">
              <Send size={18} /> Transmit Order to POS Queue
            </button>
          </form>
        )}
      </div>
    </MobileLayout>
  )
}
