import React from 'react'

export default function SkeletonInventoryRow({ count = 6 }) {
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
          <div style={{ width: '60%' }}>
            <div className="skeleton skeleton-line" style={{ width: '80%', height: '16px', marginBottom: '6px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <div className="skeleton skeleton-line" style={{ width: '40%', height: '12px' }} />
              <div className="skeleton skeleton-line" style={{ width: '30%', height: '12px' }} />
            </div>
          </div>
          <div style={{ textAlign: 'right', width: '30%' }}>
            <div className="skeleton skeleton-line" style={{ width: '80%', height: '18px', marginLeft: 'auto', marginBottom: '4px' }} />
            <div className="skeleton skeleton-line" style={{ width: '50%', height: '12px', marginLeft: 'auto' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
