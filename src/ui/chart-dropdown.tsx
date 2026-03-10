/**
 * Shared dropdown panel primitive for chart-studio popover controls.
 * Provides a positioned floating panel with backdrop, premium layered
 * shadows, and close-on-click-outside.
 */

import type {ReactNode} from 'react'

/**
 * Positioned dropdown panel with premium styling.
 * Renders a transparent backdrop overlay and an absolutely positioned content panel.
 *
 * @property isOpen - Whether the panel is visible
 * @property onClose - Callback to close the panel
 * @property align - Horizontal alignment relative to trigger ('left' | 'right')
 * @property width - Panel width in pixels
 * @property className - Additional CSS classes for the content area
 * @property children - Panel content
 */
export function ChartDropdownPanel({
  isOpen,
  onClose,
  align = 'left',
  width = 288,
  className,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  align?: 'left' | 'right'
  width?: number
  className?: string
  children: ReactNode
}) {
  if (!isOpen) return null

  return (
    <>
      {/* Transparent backdrop — click anywhere outside to close */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel with layered shadow for depth */}
      <div
        className={`absolute top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border/50 bg-popover shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.05)] ${
          align === 'right' ? 'right-0' : 'left-0'
        } ${className ?? ''}`}
        style={{width}}
        onWheel={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  )
}
