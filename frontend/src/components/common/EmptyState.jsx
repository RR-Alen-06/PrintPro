import React from 'react'


/**
 * Reusable premium Empty State component
 * @param {object} props
 * @param {React.Component} props.Icon - Lucide React Icon component
 * @param {string} props.title - Title text
 * @param {string} props.description - Description text
 * @param {string} [props.actionText] - Action button text (optional)
 * @param {function} [props.onAction] - Action button click handler (optional)
 */
export const EmptyState = ({ Icon, title, description, actionText, onAction }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      background: 'var(--bg-card)',
      border: '1px dashed var(--border-light)',
      borderRadius: 'var(--radius-lg)',
      margin: '16px 0',
      boxShadow: 'var(--shadow-sm)',
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: 'var(--radius-full)',
        background: 'var(--accent-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '18px',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        boxShadow: 'var(--shadow-glow)',
      }}>
        {Icon ? <Icon size={28} style={{ color: 'var(--accent)' }} /> : null}
      </div>
      <h3 style={{
        color: 'var(--text-primary)',
        fontSize: '1.1rem',
        fontWeight: 600,
        marginBottom: '6px',
        letterSpacing: '-0.01em'
      }}>
        {title}
      </h3>
      <p style={{
        color: 'var(--text-muted)',
        fontSize: '0.875rem',
        lineHeight: 1.5,
        maxWidth: '300px',
        marginBottom: actionText && onAction ? '20px' : '0'
      }}>
        {description}
      </p>
      {actionText && onAction && (
        <button
          className="btn btn-primary"
          onClick={onAction}
          style={{
            padding: '8px 16px',
            fontSize: '0.85rem',
            fontWeight: 500,
            borderRadius: 'var(--radius-sm)'
          }}
        >
          {actionText}
        </button>
      )}
    </div>
  )
}

export default EmptyState
