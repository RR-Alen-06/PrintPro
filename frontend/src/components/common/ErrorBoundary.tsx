import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { logger } from '../../lib/logger'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Unhandled UI Render Crash:', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV
      const displayMessage = isDev
        ? (this.state.error?.message || 'An unexpected rendering error occurred.')
        : 'An unexpected application error occurred. Please try reloading the page.'

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'var(--bg-card, #1e293b)',
          borderRadius: '12px',
          margin: '2rem',
          color: 'var(--text-primary, #f8fafc)',
          border: '1px solid var(--border-color, #334155)'
        }}>
          <AlertTriangle size={48} style={{ color: 'var(--warning, #f59e0b)', marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Something went wrong rendering this section
          </h2>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', maxWidth: '500px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {displayMessage}
          </p>
          <button
            onClick={this.handleReload}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <RefreshCw size={16} /> Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
