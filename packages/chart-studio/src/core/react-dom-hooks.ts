import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from 'react'

export type ElementSize = {
  width: number
  height: number
}

/**
 * Tracks an element's rendered size with `ResizeObserver`.
 *
 * Useful for charts, popovers, or virtualized layouts that need to react to
 * container sizing without wiring a custom observer in every component.
 *
 * @template TElement - The element type being measured
 * @param initialSize - Fallback size used before the first measurement completes
 * @returns A ref to attach to the measured element plus its latest size
 *
 * @example
 * ```tsx
 * const {ref, size} = useElementSize<HTMLDivElement>()
 *
 * return (
 *   <div ref={ref}>
 *     Width: {size.width}px
 *   </div>
 * )
 * ```
 */
export function useElementSize<TElement extends HTMLElement>(
  initialSize: ElementSize = {width: 0, height: 0},
): {
  ref: RefObject<TElement | null>
  size: ElementSize
} {
  const ref = useRef<TElement>(null)
  const [size, setSize] = useState(initialSize)
  const readSize = useEffectEvent((entry?: ResizeObserverEntry) => {
    const target = ref.current

    if (!target) {
      return
    }

    const nextWidth = entry?.contentRect.width ?? target.getBoundingClientRect().width
    const nextHeight = entry?.contentRect.height ?? target.getBoundingClientRect().height

    setSize((current) =>
      current.width === nextWidth && current.height === nextHeight
        ? current
        : {width: nextWidth, height: nextHeight},
    )
  })

  useEffect(() => {
    const target = ref.current

    if (!target || typeof ResizeObserver === 'undefined') {
      return
    }

    readSize()

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (entry) {
        readSize(entry)
      }
    })

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [])

  return {ref, size}
}

/**
 * Subscribes to a DOM event on `document` while always calling the latest
 * handler without forcing a re-subscription on every render.
 *
 * @template K - The document event name
 * @param type - The DOM event to subscribe to
 * @param listener - Callback invoked for each matching document event
 * @param options - Native `addEventListener` options
 * @param enabled - Whether the listener should currently be attached
 *
 * @example
 * ```tsx
 * useDocumentEvent('keydown', (event) => {
 *   if (event.key === 'Escape') {
 *     closePanel()
 *   }
 * })
 * ```
 */
export function useDocumentEvent<K extends keyof DocumentEventMap>(
  type: K,
  listener: (event: DocumentEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
  enabled = true,
): void {
  const onEvent = useEffectEvent(listener)

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') {
      return
    }

    function handleEvent(event: DocumentEventMap[K]) {
      onEvent(event)
    }

    document.addEventListener(type, handleEvent, options)

    return () => {
      document.removeEventListener(type, handleEvent, options)
    }
  }, [enabled, options, type])
}

/**
 * Calls a handler when the user clicks outside one or more referenced elements.
 *
 * Useful for menus, popovers, and temporary panels that should dismiss on an
 * outside interaction without duplicating `document` listener setup.
 *
 * @param refs - The element refs that count as "inside" the interactive region
 * @param onOutsideClick - Invoked when the event target falls outside all refs
 * @param enabled - Whether outside click detection is active
 *
 * @example
 * ```tsx
 * const panelRef = useRef<HTMLDivElement>(null)
 *
 * useClickOutside(panelRef, () => {
 *   setOpen(false)
 * }, open)
 * ```
 */
export function useClickOutside(
  refs: RefObject<HTMLElement | null> | readonly RefObject<HTMLElement | null>[],
  onOutsideClick: (event: MouseEvent) => void,
  enabled = true,
): void {
  const refList = Array.isArray(refs) ? refs : [refs]

  useDocumentEvent('mousedown', (event) => {
    const target = event.target

    if (!(target instanceof Node)) {
      return
    }

    const clickedInside = refList.some((ref) => ref.current?.contains(target))

    if (!clickedInside) {
      onOutsideClick(event)
    }
  }, undefined, enabled)
}

/**
 * Reads a CSS custom property from `document.documentElement` and keeps it in
 * sync when host-level theme or style attributes change.
 *
 * Use this when a React component needs the current resolved value of a theme
 * token without keeping a second derived piece of state for transformed values.
 *
 * @param propertyName - CSS custom property to read, including the `--` prefix
 * @param fallbackValue - Value returned before the document is available or when the property is unset
 * @returns The latest resolved custom-property value
 *
 * @example
 * ```tsx
 * const radiusToken = useRootCssVariable('--cs-radius', '0.5')
 * ```
 */
export function useRootCssVariable(
  propertyName: `--${string}`,
  fallbackValue = '',
): string {
  const [value, setValue] = useState(fallbackValue)
  const readValue = useEffectEvent(() => {
    if (typeof document === 'undefined') {
      return
    }

    const nextValue = getComputedStyle(document.documentElement)
      .getPropertyValue(propertyName)
      .trim()

    setValue((current) => {
      const resolvedValue = nextValue || fallbackValue

      return current === resolvedValue ? current : resolvedValue
    })
  })

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      return
    }

    const root = document.documentElement
    readValue()

    const observer = new MutationObserver(() => {
      readValue()
    })

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['style', 'class', 'data-theme'],
    })

    return () => {
      observer.disconnect()
    }
  }, [fallbackValue, propertyName])

  return value
}
