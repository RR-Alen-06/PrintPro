import React from 'react'

export const FullPageSkeleton = () => {
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      backgroundColor: 'var(--bg-primary, #090a0f)',
      color: 'var(--text-primary, #ffffff)',
      overflow: 'hidden',
    }}>
      {/* Sidebar skeleton */}
      <div style={{
        width: '260px',
        height: '100%',
        backgroundColor: 'var(--bg-secondary, #12131a)',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        {/* Brand placeholder */}
        <div style={{
          height: '40px',
          width: '70%',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          animation: 'pulse 1.5s infinite ease-in-out',
        }} />

        {/* Nav item placeholders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              style={{
                height: '36px',
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '6px',
                animation: 'pulse 1.5s infinite ease-in-out',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Main content skeleton */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}>
        {/* Header skeleton */}
        <div style={{
          height: '64px',
          backgroundColor: 'var(--bg-secondary, #12131a)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            height: '24px',
            width: '180px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            animation: 'pulse 1.5s infinite ease-in-out',
          }} />
          <div style={{
            height: '36px',
            width: '120px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '18px',
            animation: 'pulse 1.5s infinite ease-in-out',
          }} />
        </div>

        {/* Content body skeleton */}
        <div style={{
          flex: 1,
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          overflowY: 'auto',
        }}>
          {/* Top metric cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                style={{
                  height: '110px',
                  backgroundColor: 'var(--bg-card, #171822)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  animation: 'pulse 1.5s infinite ease-in-out',
                  animationDelay: `${i * 0.15}s`,
                }}
              >
                <div style={{ height: '16px', width: '50%', backgroundColor: 'rgba(255, 255, 255, 0.07)', borderRadius: '4px' }} />
                <div style={{ height: '28px', width: '70%', backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: '4px' }} />
              </div>
            ))}
          </div>

          {/* Table / large card skeleton */}
          <div style={{
            flex: 1,
            minHeight: '300px',
            backgroundColor: 'var(--bg-card, #171822)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <div style={{ height: '22px', width: '220px', backgroundColor: 'rgba(255, 255, 255, 0.09)', borderRadius: '4px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: '42px',
                    width: '100%',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    borderRadius: '6px',
                    animation: 'pulse 1.5s infinite ease-in-out',
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FullPageSkeleton
