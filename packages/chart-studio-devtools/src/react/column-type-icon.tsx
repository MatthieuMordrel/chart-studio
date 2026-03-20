import {
  ALargeSmall,
  Calendar,
  CircleHelp,
  Hash,
  ToggleRight,
  type LucideProps,
} from 'lucide-react'
import type {ComponentType} from 'react'

const COLUMN_TYPE_ICONS: Record<string, ComponentType<LucideProps>> = {
  number: Hash,
  category: ALargeSmall,
  boolean: ToggleRight,
  date: Calendar,
}

const COLUMN_TYPE_LABELS: Record<string, string> = {
  number: 'Number',
  category: 'Category',
  boolean: 'Boolean',
  date: 'Date',
}

export function ColumnTypeIcon({type}: {type: string}) {
  const Icon = COLUMN_TYPE_ICONS[type] ?? CircleHelp
  const label = COLUMN_TYPE_LABELS[type] ?? type

  return (
    <span className='csdt-type-icon' title={label}>
      <Icon size={14} aria-hidden='true' />
    </span>
  )
}
