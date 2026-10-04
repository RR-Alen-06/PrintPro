import React from 'react'

/**
 * Reusable premium Loading State component
 * @param {object} props
 * @param {string} [props.message] - Custom loading text message
 * @param {boolean} [props.overlay] - Show as full screen overlay modal
 */
export const LoadingState = ({ message = 'Loading...', overlay = false }) => {
  const loader = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      padding: overlay ? '0' : '32px',
      textAlign: 'center',
      animation: 'fadeIn 0.25s ease'
    }}>
      <div className="custom-loader-ring" style={{
        position: 'relative',
        width: '50px',
        height: '50px',
      }}>
        <div style={{
          boxSizing: 'border-box',
          display: 'block',
          position: 'absolute',
          width: '50px',
          height: '50px',
          margin: '0px',
          border: '4px solid transparent',
          borderTopColor: 'var(--accent)',
          borderRightColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s cubic-bezier(0.5, 0, 0.5, 1) infinite',
        }} />
        <div style={{
          boxSizing: 'border-box',
          display: 'block',
          position: 'absolute',
          width: '50px',
          height: '50px',
          margin: '0px',
          border: '4px solid transparent',
          borderBottomColor: 'var(--violet)',
          borderLeftColor: 'var(--violet)',
          borderRadius: '50%',
          animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite',
          opacity: 0.7
        }} />
      </div>
      {message && (
        <p style={{
          margin: 0,
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
          fontWeight: 500,
          letterSpacing: '-0.01em',
          animation: 'pulse 1.5s infinite ease-in-out'
        }}>
          {message}
        </p>
      )}
    </div>
  )

  if (overlay) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 5, 11, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {loader}
      </div>
    )
  }

  return loader
}

export default LoadingState
