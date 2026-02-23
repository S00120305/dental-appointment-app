'use client'

import { STATUS_BG_CLASS, STATUS_LABELS } from '@/lib/constants/appointment'

type StatusBadgeProps = {
  status: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASSES = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-1',
  lg: 'text-sm px-3 py-1.5 font-medium',
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const colorClass = STATUS_BG_CLASS[status] || 'bg-gray-100 text-gray-600'
  const sizeClass = SIZE_CLASSES[size]
  const label = STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status

  return (
    <span className={`inline-flex items-center rounded-full whitespace-nowrap ${colorClass} ${sizeClass}`}>
      {label}
    </span>
  )
}
