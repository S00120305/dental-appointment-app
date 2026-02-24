'use client'

import { memo } from 'react'

type LabOrderBadgeProps = {
  labOrderStatus: string
  size?: 'sm' | 'md'
}

const LAB_STATUS_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  '納品済み': { icon: '\u2705', label: 'セット準備OK', color: '#15803d' },
  'セット完了': { icon: '\u2705', label: 'セット完了', color: '#6b7280' },
  '製作中': { icon: '\u26A0\uFE0F', label: '製作中', color: '#b45309' },
  '未発注': { icon: '\u274C', label: '未発注！', color: '#dc2626' },
  'キャンセル': { icon: '\u2014', label: 'キャンセル', color: '#9ca3af' },
}

export function getLabStatusConfig(status: string) {
  return LAB_STATUS_CONFIG[status] || LAB_STATUS_CONFIG['製作中']
}

const LabOrderBadge = memo(function LabOrderBadge({ labOrderStatus, size = 'sm' }: LabOrderBadgeProps) {
  const config = getLabStatusConfig(labOrderStatus)
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-xs'

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${textSize} leading-tight`}
      style={{ color: config.color }}
    >
      <span>{config.icon}</span>
      <span className="truncate">{config.label}</span>
    </span>
  )
})

export default LabOrderBadge
