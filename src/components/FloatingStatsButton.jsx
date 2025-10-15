import React from 'react'

export default function FloatingStatsButton({onClick, ariaLabel = 'Open stats', side = 'right'}){
  // side: 'right' or 'left'
  const arrow = side === 'left' ? '←' : '→'
  const label = side === 'left' ? 'Home' : 'Stats'
  const wrapCls = `floating-stats-wrap ${side === 'left' ? 'left' : 'right'}`
  const btnCls = `floating-stats-btn ${side === 'left' ? 'left' : 'right'}`
  return (
    <div className={wrapCls}>
      <button
        className={btnCls}
        onClick={onClick}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <span className="floating-stats-icon">{arrow}</span>
      </button>
      <span className="floating-stats-label">{label}</span>
    </div>
  )
}
