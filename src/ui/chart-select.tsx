/**
 * Custom select dropdown — premium replacement for native <select> elements.
 * Uses fixed positioning so the options list works correctly even inside
 * overflow-hidden containers (e.g. the toolbar overflow panel).
 */

import {useRef, useState} from 'react'
import {Check, ChevronDown} from 'lucide-react'
import {ChartDropdownPanel} from './chart-dropdown.js'

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
  const selected = options.find((o) => o.value === value)

  /** Toggle the dropdown. */
  const handleToggle = () => {
    setIsOpen((current) => !current)
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
      <ChartDropdownPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        minWidth="trigger"
        className="p-1"
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
      </ChartDropdownPanel>
    </div>
  )
}
