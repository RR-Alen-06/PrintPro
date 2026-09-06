import React, { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

export default function VirtualList({
  items = [],
  estimateSize = 90,
  renderItem,
  overscan = 5,
  className = '',
  style = {}
}) {
  const parentRef = useRef(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  })

  return (
    <div
      ref={parentRef}
      className={`virtual-list-container ${className}`}
      style={{
        height: '100%',
        maxHeight: 'calc(100vh - 210px)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        position: 'relative',
        width: '100%',
        ...style,
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index]
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
