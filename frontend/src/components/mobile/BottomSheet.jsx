import React, { useEffect } from 'react'
import { X } from 'lucide-react'

export default function BottomSheet({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return

    // Push dummy history state for hardware/gesture back button dismissal
    const stateId = 'bottom-sheet-' + Date.now()
    window.history.pushState({ bottomSheetOpen: stateId }, '')

    const handlePopState = (e) => {
      // Hardware back button tapped -> close bottom sheet
      onClose()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleCloseClick = () => {
    // If the top history state is our bottom sheet, pop it back
    if (window.history.state?.bottomSheetOpen) {
      window.history.back()
    } else {
      onClose()
    }
  }

  return (
    <div
      className="bottom-sheet-overlay"
      onClick={handleCloseClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bottom-sheet-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bottom-sheet-drag-handle" />
        <div className="bottom-sheet-header">
          <h3 className="bottom-sheet-title">{title}</h3>
          <button
            className="mobile-icon-btn"
            onClick={handleCloseClick}
            aria-label="Close"
            style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="bottom-sheet-body">{children}</div>
      </div>
    </div>
  )
}
