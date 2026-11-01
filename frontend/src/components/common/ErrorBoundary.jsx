import React from 'react';

/**
 * Production-ready React Error Boundary.
 * Catches client runtime errors, hides stack traces and file paths from users,
 * logs full details to the developer console, and shows a plain message with a reference code.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      referenceCode: null
    };
  }

  static getDerivedStateFromError(_error) {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    return {
      hasError: true,
      referenceCode: `ERR-UI-${randomHex}`
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log full error details strictly in developer console
    console.error(`[${this.state.referenceCode}] Uncaught client render error:`, error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          padding: '24px',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            padding: '32px',
            border: '1px solid #334155',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
              color: '#ef4444',
              fontSize: '24px'
            }}>
              ⚠️
            </div>

            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 600 }}>
              Something went wrong
            </h2>
            <p style={{ margin: '0 0 20px 0', color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.5 }}>
              An unexpected interface error occurred. Please try reloading the page, or contact support if the issue persists.
            </p>

            <div style={{
              backgroundColor: '#0f172a',
              borderRadius: '6px',
              padding: '10px 14px',
              marginBottom: '24px',
              border: '1px solid #334155',
              display: 'inline-block'
            }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Error Reference:{' '}
              </span>
              <strong style={{ fontFamily: 'monospace', color: '#38bdf8', fontSize: '0.875rem' }}>
                {this.state.referenceCode}
              </strong>
            </div>

            <div>
              <button
                onClick={this.handleReload}
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 24px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
