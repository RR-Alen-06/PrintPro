import React from 'react'

export default function SkeletonCustomerRow({ count = 6 }) {
  const items = Array.from({ length: count })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {items.map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            marginBottom: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '60%' }}>
            <div className="skeleton skeleton-circle" style={{ width: '38px', height: '38px', flexShrink: 0 }} />
            <div style={{ width: '100%' }}>
              <div className="skeleton skeleton-line" style={{ width: '70%', height: '15px', marginBottom: '6px' }} />
              <div className="skeleton skeleton-line" style={{ width: '45%', height: '12px' }} />
            </div>
          </div>
          <div className="skeleton skeleton-line" style={{ width: '24%', height: '18px' }} />
        </div>
      ))}
    </div>
  )
}
