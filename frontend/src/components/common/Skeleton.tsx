import React from 'react'

export const SkeletonBox = ({ width = '100%', height = '20px', borderRadius = 'var(--radius-sm, 6px)', style = {} }: { width?: string; height?: string; borderRadius?: string; style?: React.CSSProperties }) => (
  <div
    className="aurora-skeleton"
    style={{
      width,
      height,
      borderRadius,
      ...style,
    }}
  />
)

export const TableSkeleton = ({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
    <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonBox key={`th-${i}`} height="24px" width={`${100 / columns}%`} style={{ opacity: 0.8 }} />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={`tr-${r}`} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        {Array.from({ length: columns }).map((_, c) => (
          <SkeletonBox key={`td-${r}-${c}`} height="20px" width={`${100 / columns}%`} />
        ))}
      </div>
    ))}
  </div>
)

export const CardSkeleton = ({ count = 4 }: { count?: number }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={`card-${i}`} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SkeletonBox height="16px" width="50%" />
        <SkeletonBox height="32px" width="80%" />
        <SkeletonBox height="14px" width="40%" />
      </div>
    ))}
  </div>
)

export const ListSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={`list-${i}`} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <SkeletonBox height="18px" width="45%" />
          <SkeletonBox height="18px" width="20%" />
        </div>
        <SkeletonBox height="14px" width="30%" />
      </div>
    ))}
  </div>
)

export default SkeletonBox
