type DocumentScrollLockState = {
  bodyOverflow: string
  bodyOverscrollBehavior: string
  bodyPaddingRight: string
  rootOverflow: string
  rootOverscrollBehavior: string
}

let documentScrollLockDepth = 0
let previousDocumentScrollLockState: DocumentScrollLockState | null = null

/**
 * Disables host-page scrolling while the devtools shell is open. Ref-counted so multiple
 * overlays can safely coexist without restoring styles too early.
 */
export function lockDocumentScroll(): () => void {
  if (typeof document === 'undefined') {
    return () => {}
  }

  const root = document.documentElement
  const body = document.body

  if (!root || !body) {
    return () => {}
  }

  if (documentScrollLockDepth === 0) {
    previousDocumentScrollLockState = {
      bodyOverflow: body.style.overflow,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
      bodyPaddingRight: body.style.paddingRight,
      rootOverflow: root.style.overflow,
      rootOverscrollBehavior: root.style.overscrollBehavior,
    }

    const scrollbarWidth = root.clientWidth > 0
      ? Math.max(0, window.innerWidth - root.clientWidth)
      : 0

    root.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'

    if (scrollbarWidth > 0) {
      const computedPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0
      body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`
    }
  }

  documentScrollLockDepth += 1
  let released = false

  return () => {
    if (released) {
      return
    }

    released = true
    documentScrollLockDepth = Math.max(0, documentScrollLockDepth - 1)

    if (documentScrollLockDepth !== 0 || !previousDocumentScrollLockState) {
      return
    }

    body.style.overflow = previousDocumentScrollLockState.bodyOverflow
    body.style.overscrollBehavior = previousDocumentScrollLockState.bodyOverscrollBehavior
    body.style.paddingRight = previousDocumentScrollLockState.bodyPaddingRight
    root.style.overflow = previousDocumentScrollLockState.rootOverflow
    root.style.overscrollBehavior = previousDocumentScrollLockState.rootOverscrollBehavior
    previousDocumentScrollLockState = null
  }
}
