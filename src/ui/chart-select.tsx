/**
 * Custom select dropdown — premium replacement for native <select> elements.
 * Uses fixed positioning so the options list works correctly even inside
 * overflow-hidden containers (e.g. the toolbar overflow panel).
 */

import {useRef, useState} from 'react'
import {Check, ChevronDown} from 'lucide-react'

/**
 * Premium styled select dropdown with check marks and smooth transitions.
 *
 * @property value - Currently selected value
 * @property options - Array of { value, label } options
 * @property onChange - Callback when selection changes
 * @property ariaLabel - Accessible label for the trigger
 * @property className - Additional CSS classes
 */
export function ChartSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T
  options: ReadonlyArray<{value: T; label: string}>
  onChange: (value: T) => void
  ariaLabel?: string
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState<{top: number; left: number; minWidth: number} | null>(
    null,
  )

  const selected = options.find((o) => o.value === value)

  /** Measure trigger bounding rect and open the dropdown with fixed positioning. */
  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false)
      return
    }
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: rect.width,
      })
    }
    setIsOpen(true)
  }

  /** Select an option and close the dropdown. */
  const handleSelect = (optionValue: T) => {
    onChange(optionValue)
    setIsOpen(false)
  }

  return (
    <div className={className}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 text-xs font-medium text-foreground shadow-sm transition-all hover:border-border hover:bg-muted/30 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
        aria-label={ariaLabel}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Fixed-position option list — escapes overflow containers */}
      {isOpen && position && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className="fixed z-50 overflow-hidden rounded-xl border border-border/50 bg-popover p-1 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.05)]"
            style={{top: position.top, left: position.left, minWidth: position.minWidth}}
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                  option.value === value
                    ? 'bg-primary/8 font-medium text-primary'
                    : 'text-foreground hover:bg-muted/60'
                }`}
              >
                {/* Check icon for selected option */}
                <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  {option.value === value && <Check className="h-3.5 w-3.5" />}
                </div>
                <span className="truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
