import React from 'react'
import { AlertOctagon, RotateCw } from 'lucide-react'

/**
 * Reusable premium Error State component
 * @param {object} props
 * @param {string} [props.title] - Custom title (defaults to "An error occurred")
 * @param {string} props.message - Error message details
 * @param {function} [props.onRetry] - Retry callback (optional)
 */
export const ErrorState = ({ title = 'An error occurred', message, onRetry }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      textAlign: 'center',
      background: 'var(--bg-card)',
      border: '1px solid rgba(239, 68, 68, 0.15)',
      borderRadius: 'var(--radius-lg)',
      margin: '16px 0',
      boxShadow: 'var(--shadow-sm)',
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: 'var(--radius-full)',
        background: 'var(--error-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        boxShadow: '0 0 16px rgba(239, 68, 68, 0.15)',
      }}>
        <AlertOctagon size={26} style={{ color: 'var(--error)' }} />
      </div>
      <h3 style={{
        color: 'var(--text-primary)',
        fontSize: '1.05rem',
        fontWeight: 600,
        marginBottom: '6px',
      }}>
        {title}
      </h3>
      <p style={{
        color: 'var(--text-secondary)',
        fontSize: '0.85rem',
        lineHeight: 1.5,
        maxWidth: '320px',
        marginBottom: onRetry ? '18px' : '0'
      }}>
        {message}
      </p>
      {onRetry && (
        <button
          className="btn btn-secondary"
          onClick={onRetry}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            fontSize: '0.825rem',
            fontWeight: 500,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(255, 255, 255, 0.02)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'var(--transition)'
          }}
        >
          <RotateCw size={14} /> Retry
        </button>
      )}
    </div>
  )
}

export default ErrorState
