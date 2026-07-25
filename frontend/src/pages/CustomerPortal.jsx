import React, { useState } from 'react'
import { Upload, FileText, CheckCircle2, Trash2, Printer, ArrowRight } from 'lucide-react'
import { useAppContext } from '../context/AppContext'

export default function CustomerPortal() {
  const { business } = useAppContext()
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedOrder, setSubmittedOrder] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  // File upload handler
  const handleFileUpload = (e) => {
    const uploadedFiles = Array.from(e.target.files)
    if (uploadedFiles.length === 0) return

    const newFiles = uploadedFiles.map((file, idx) => ({
      id: `file-${Date.now()}-${idx}`,
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2), // MB
      type: file.type,
      config: {
        copies: 1,
        printType: 'color',
        sides: 'single',
      },
    }))

    setFiles((prev) => [...prev, ...newFiles])
    setErrorMessage('')
  }

  // Update file config
  const updateFileConfig = (fileId, updates) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, config: { ...f.config, ...updates } } : f
      )
    )
  }

  // Remove file
  const removeFile = (fileId) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  // Estimated price calculation
  const calculateEstimatedTotal = () => {
    return files.reduce((sum, f) => {
      const isColor = f.config.printType === 'color'
      const isDouble = f.config.sides === 'double'
      const unitPrice = isColor ? (isDouble ? 15 : 10) : (isDouble ? 3 : 2)
      return sum + unitPrice * (f.config.copies || 1)
    }, 0)
  }

  // Submit order to local storage portal_orders
  const handleSubmitOrder = (e) => {
    e.preventDefault()
    if (!customerName.trim()) {
      setErrorMessage('Please enter your full name.')
      return
    }
    if (!customerPhone.trim()) {
      setErrorMessage('Please enter your phone number.')
      return
    }
    if (files.length === 0) {
      setErrorMessage('Please upload at least one document or file.')
      return
    }

    setIsSubmitting(true)

    const orderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`
    const newOrder = {
      id: orderId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim(),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      files: files,
      estimatedTotal: calculateEstimatedTotal(),
    }

    try {
      const stored = JSON.parse(localStorage.getItem('portal_orders') || '[]')
      const updated = [newOrder, ...stored]
      localStorage.setItem('portal_orders', JSON.stringify(updated))

      setSubmittedOrder(newOrder)
    } catch (err) {
      setErrorMessage('Failed to submit order. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset form to upload another document
  const handleReset = () => {
    setSubmittedOrder(null)
    setFiles([])
    setNotes('')
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setErrorMessage('')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      {/* Container */}
      <div style={{ maxWidth: '780px', width: '100%' }}>

        {/* Branding Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)',
            marginBottom: '16px'
          }}>
            <Printer size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            {business?.name || 'PrintPro'} Document Portal
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1rem', margin: 0, maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
            Upload your documents, choose your print settings, and send your job directly to our store printing queue.
          </p>
        </div>

        {/* Confirmation State */}
        {submittedOrder ? (
          <div style={{
            background: 'rgba(30, 41, 59, 0.7)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            padding: '36px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#22c55e',
              marginBottom: '20px'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px 0', color: '#fff' }}>
              Print Order Sent to Queue!
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '24px' }}>
              Your order has been received by our POS system. Mention your name or Order ID when picking up.
            </p>

            {/* Order Details Badge */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'left',
              marginBottom: '28px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Order ID:</span>
                <span style={{ fontWeight: 700, color: '#a855f7', fontFamily: 'monospace', fontSize: '1rem' }}>{submittedOrder.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Customer Name:</span>
                <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>{submittedOrder.customerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Phone Number:</span>
                <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>{submittedOrder.customerPhone}</span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '6px' }}>Uploaded Files:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {submittedOrder.files.map((f) => (
                  <div key={f.id} style={{ fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} style={{ color: '#6366f1' }} />
                    {f.name} ({f.config.copies}x {f.config.printType === 'color' ? 'Color' : 'B&W'}, {f.config.sides === 'double' ? 'Double' : 'Single'})
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              Upload Another Document <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          /* Form State */
          <form onSubmit={handleSubmitOrder} style={{
            background: 'rgba(30, 41, 59, 0.7)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            padding: '32px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
          }}>

            {errorMessage && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '12px 16px',
                borderRadius: '12px',
                fontSize: '0.88rem',
                marginBottom: '20px'
              }}>
                {errorMessage}
              </div>
            )}

            {/* Section 1: Customer Info */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', background: '#6366f1', fontSize: '0.75rem', color: '#fff' }}>1</span>
                Your Details
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(15, 23, 42, 0.6)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+1 555-0199"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(15, 23, 42, 0.6)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: File Upload Zone */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', background: '#6366f1', fontSize: '0.75rem', color: '#fff' }}>2</span>
                Upload Documents
              </h3>

              <div style={{
                position: 'relative',
                border: '2px dashed rgba(99, 102, 241, 0.4)',
                borderRadius: '16px',
                padding: '36px 20px',
                textAlign: 'center',
                background: 'rgba(99, 102, 241, 0.04)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
                  onChange={handleFileUpload}
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    opacity: 0, cursor: 'pointer'
                  }}
                />
                <Upload size={32} style={{ color: '#818cf8', marginBottom: '12px' }} />
                <p style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
                  Click or drag files here to upload
                </p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                  Supports PDF, Word Documents, PNG, JPG (Max 50MB per file)
                </p>
              </div>

              {/* Uploaded File Config List */}
              {files.length > 0 && (
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {files.map((file) => (
                    <div key={file.id} style={{
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <FileText size={20} style={{ color: '#818cf8' }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>{file.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{file.size} MB</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(file.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* File Settings Options */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: 'rgba(30, 41, 59, 0.5)', padding: '10px', borderRadius: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>Color Mode</label>
                          <select
                            value={file.config.printType}
                            onChange={(e) => updateFileConfig(file.id, { printType: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: '#0f172a',
                              color: '#fff',
                              fontSize: '0.8rem'
                            }}
                          >
                            <option value="color">Full Color</option>
                            <option value="bw">Black & White</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>Print Sides</label>
                          <select
                            value={file.config.sides}
                            onChange={(e) => updateFileConfig(file.id, { sides: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: '#0f172a',
                              color: '#fff',
                              fontSize: '0.8rem'
                            }}
                          >
                            <option value="single">Single Sided</option>
                            <option value="double">Double Sided</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>Copies</label>
                          <input
                            type="number"
                            min="1"
                            value={file.config.copies}
                            onChange={(e) => updateFileConfig(file.id, { copies: Math.max(1, parseInt(e.target.value) || 1) })}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: '#0f172a',
                              color: '#fff',
                              fontSize: '0.8rem'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: Notes & Submit */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                Special Instructions / Remarks (Optional)
              </label>
              <textarea
                placeholder="e.g. Spiral binding required, deliver before 4 PM..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  width: '100%',
                  height: '70px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(15, 23, 42, 0.6)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  resize: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 10px 25px rgba(99, 102, 241, 0.3)',
                transition: 'all 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isSubmitting ? 'Sending Order...' : 'Submit Order to Print Queue'} <ArrowRight size={18} />
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
