import React, { useState, useRef } from 'react'
import { useAppContext } from '../context/AppContext'
import { Upload, FileText, Image, Trash2, Send, CheckCircle, Printer, X, File } from 'lucide-react'

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const CustomerPortal = () => {
  const { settings, business, showToast } = useAppContext()
  const fileInputRef = useRef(null)

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [files, setFiles] = useState([]) // Array of { file, dataUrl, config }
  const [globalConfig, setGlobalConfig] = useState({
    printType: 'bw',
    sides: 'single',
    copies: 1,
    notes: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  if (settings.portalEnabled !== true) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div style={{
          maxWidth: '480px', margin: '0 auto',
          padding: '40px', background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <Printer size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h2 style={{ marginBottom: '8px' }}>Portal Not Available</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            The customer upload portal is currently disabled. Please contact the shop directly.
          </p>
        </div>
      </div>
    )
  }

  const handleFileDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    const droppedFiles = Array.from(e.dataTransfer?.files || [])
    processFiles(droppedFiles)
  }

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || [])
    processFiles(selectedFiles)
    e.target.value = ''
  }

  const processFiles = (newFiles) => {
    const validFiles = newFiles.filter(f => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        showToast(`Unsupported file type: ${f.name}`, 'error')
        return false
      }
      if (f.size > MAX_FILE_SIZE) {
        showToast(`File too large (max 5MB): ${f.name}`, 'error')
        return false
      }
      return true
    })

    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFiles(prev => [...prev, {
          id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          dataUrl: reader.result,
          name: file.name,
          type: file.type,
          size: file.size,
          config: { ...globalConfig }
        }])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const updateFileConfig = (id, key, value) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, config: { ...f.config, [key]: value } } : f))
  }

  const handleSubmitOrder = () => {
    if (!customerName.trim()) {
      showToast('Please enter your name.', 'error')
      return
    }
    if (files.length === 0) {
      showToast('Please upload at least one file.', 'error')
      return
    }

    // Store the portal order in localStorage for the POS to pick up
    const order = {
      id: `portal-${Date.now()}`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        size: f.size,
        dataUrl: f.dataUrl,
        config: f.config,
      }))
    }

    const existingOrders = JSON.parse(localStorage.getItem('portal_orders') || '[]')
    existingOrders.push(order)
    localStorage.setItem('portal_orders', JSON.stringify(existingOrders))

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div style={{
          maxWidth: '480px', margin: '0 auto',
          padding: '40px', background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <CheckCircle size={56} style={{ color: 'var(--success)', marginBottom: '16px' }} />
          <h2 style={{ marginBottom: '8px', color: 'var(--success)' }}>Order Submitted!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
            Your {files.length} file{files.length > 1 ? 's have' : ' has'} been uploaded successfully. The print shop will process your order shortly.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setSubmitted(false)
              setFiles([])
              setCustomerName('')
              setCustomerPhone('')
            }}
          >
            Submit Another Order
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{
        textAlign: 'center', marginBottom: '32px',
        padding: '32px 20px',
        background: 'linear-gradient(135deg, var(--bg-card), var(--bg-elevated))',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <Printer size={40} style={{ color: 'var(--accent)', marginBottom: '12px' }} />
        <h1 style={{ fontSize: '1.6rem', marginBottom: '4px' }}>
          {business?.shopName || 'Print Service'} — Upload Portal
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Upload your documents for printing. Set your preferences and submit.
        </p>
      </div>

      {/* Customer Info */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '12px' }}>Your Details</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-input" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Your full name" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone (optional)</label>
            <input className="form-input" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="10-digit phone" />
          </div>
        </div>
      </div>

      {/* Default Print Config */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '12px' }}>Default Print Settings</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Print Type</label>
            <select className="form-select" value={globalConfig.printType} onChange={e => setGlobalConfig(prev => ({ ...prev, printType: e.target.value }))}>
              <option value="bw">Black & White</option>
              <option value="color">Color</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Sides</label>
            <select className="form-select" value={globalConfig.sides} onChange={e => setGlobalConfig(prev => ({ ...prev, sides: e.target.value }))}>
              <option value="single">Single Sided</option>
              <option value="double">Double Sided</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Copies</label>
            <input className="form-input" type="number" min="1" value={globalConfig.copies} onChange={e => setGlobalConfig(prev => ({ ...prev, copies: Math.max(1, Number(e.target.value)) }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Special Instructions</label>
          <textarea className="form-textarea" value={globalConfig.notes} onChange={e => setGlobalConfig(prev => ({ ...prev, notes: e.target.value }))} placeholder="e.g. Staple all copies, spiral binding, etc." />
        </div>
      </div>

      {/* File Upload */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '12px' }}>Upload Files</h3>
        <div
          style={{
            border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragActive ? 'rgba(99,102,241,0.05)' : 'transparent',
            transition: 'all 0.2s ease',
            marginBottom: '16px'
          }}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={36} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>
            Drag & drop files here, or click to browse
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            PDF, Images (PNG, JPG, WebP), Word Documents — Max 5MB each
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {files.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)'
              }}>
                {f.type.startsWith('image/') ? (
                  <Image size={24} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                ) : f.type === 'application/pdf' ? (
                  <FileText size={24} style={{ color: 'var(--error)', flexShrink: 0 }} />
                ) : (
                  <File size={24} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {(f.size / 1024).toFixed(1)}KB · {f.config.printType === 'color' ? 'Color' : 'B&W'} · {f.config.sides === 'double' ? 'Double' : 'Single'} · {f.config.copies} cop{f.config.copies > 1 ? 'ies' : 'y'}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => removeFile(f.id)} style={{ color: 'var(--error)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        className="btn btn-primary"
        onClick={handleSubmitOrder}
        disabled={!customerName.trim() || files.length === 0}
        style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 700 }}
      >
        <Send size={18} style={{ marginRight: '8px' }} />
        Submit Order ({files.length} file{files.length !== 1 ? 's' : ''})
      </button>
    </div>
  )
}

export default CustomerPortal
