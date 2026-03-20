/**
 * Shared dropdown panel primitive for chart-studio popover controls.
 * Provides a positioned floating panel with backdrop, premium layered
 * shadows, and close-on-click-outside.
 */

import {useLayoutEffect, useRef, useState, type ReactNode, type RefObject} from 'react'
import {createPortal} from 'react-dom'

type PanelPosition = {
  top: number
  left: number
}

/**
 * Positioned dropdown panel with premium styling.
 * Renders a transparent backdrop overlay and a fixed-position content panel
 * anchored to a trigger element.
 *
 * @property isOpen - Whether the panel is visible
 * @property onClose - Callback to close the panel
 * @property triggerRef - Ref to the button or element that anchors the panel
 * @property align - Horizontal alignment relative to trigger ('left' | 'right' | 'right-start')
 * @property width - Fixed panel width in pixels
 * @property minWidth - Minimum panel width in pixels or equal to trigger width
 * @property offset - Gap between trigger and panel
 * @property repositionKey - Value that forces re-measurement when panel content changes
 * @property className - Additional CSS classes for the content area
 * @property children - Panel content
 * @remarks Stacking uses `--cs-chart-dropdown-backdrop-z-index` (default 40) and
 *   `--cs-chart-dropdown-panel-z-index` (default 50) so hosts can raise z-index above app overlays.
 */
export function ChartDropdownPanel({
  isOpen,
  onClose,
  triggerRef,
  align = 'left',
  width,
  minWidth,
  offset = 6,
  repositionKey,
  className,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  triggerRef: RefObject<HTMLElement | null>
  align?: 'left' | 'right' | 'right-start'
  width?: number
  minWidth?: number | 'trigger'
  offset?: number
  repositionKey?: string | number
  className?: string
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<PanelPosition | null>(null)

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null)
      return
    }

    /**
     * Measure the trigger and panel, then place the panel in the best
     * available viewport position.
     */
    function updatePosition() {
      const trigger = triggerRef.current
      const panel = panelRef.current
      if (!trigger || !panel) {
        return
      }

      const triggerRect = trigger.getBoundingClientRect()
      const measuredPanelWidth = width ?? panel.offsetWidth
      const resolvedMinWidth = minWidth === 'trigger' ? triggerRect.width : minWidth
      const panelWidth = Math.max(measuredPanelWidth, resolvedMinWidth ?? 0)
      const panelHeight = panel.offsetHeight

      let left =
        align === 'right' ? triggerRect.right - panelWidth :
        align === 'right-start' ? triggerRect.right :
        triggerRect.left
      left = Math.min(Math.max(left, 8), window.innerWidth - panelWidth - 8)

      const openAbove = triggerRect.top >= panelHeight + offset
      let top = openAbove ? triggerRect.top - panelHeight - offset : triggerRect.bottom + offset
      top = Math.max(8, Math.min(top, window.innerHeight - panelHeight - 8))

      setPosition({top, left})
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [align, isOpen, minWidth, offset, repositionKey, triggerRef, width])

  if (!isOpen) return null

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <>
      {/* Transparent backdrop — click anywhere outside to close */}
      <div
        className="fixed inset-0"
        style={{zIndex: 'var(--cs-chart-dropdown-backdrop-z-index, 40)'}}
        onClick={onClose}
      />

      {/* Panel with layered shadow for depth */}
      <div
        ref={panelRef}
        className={`fixed overflow-hidden rounded-xl border border-border/50 bg-popover text-popover-foreground shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.05)] ${className ?? ''}`}
        style={{
          top: position?.top ?? 0,
          left: position?.left ?? 0,
          width,
          minWidth: minWidth === 'trigger' ? triggerRef.current?.getBoundingClientRect().width : minWidth,
          visibility: position ? 'visible' : 'hidden',
          zIndex: 'var(--cs-chart-dropdown-panel-z-index, 50)',
        }}
        onWheel={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body,
  )
}
