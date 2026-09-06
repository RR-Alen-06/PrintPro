import React from 'react'

export default function SkeletonBillCard({ count = 5 }) {
  const items = Array.from({ length: count })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {items.map((_, i) => (
        <div key={i} className="skeleton skeleton-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div className="skeleton skeleton-line" style={{ width: '38%', height: '16px' }} />
            <div className="skeleton skeleton-line" style={{ width: '22%', height: '20px', borderRadius: 'var(--radius-full)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ width: '55%' }}>
              <div className="skeleton skeleton-line" style={{ width: '90%', height: '14px', marginBottom: '6px' }} />
              <div className="skeleton skeleton-line" style={{ width: '60%', height: '12px' }} />
            </div>
            <div className="skeleton skeleton-line" style={{ width: '28%', height: '22px' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
