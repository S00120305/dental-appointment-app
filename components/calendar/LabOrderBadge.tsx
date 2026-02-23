'use client'

type LabOrderBadgeProps = {
  labOrderStatus: string
  size?: 'sm' | 'md'
}

const LAB_STATUS_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  '納品済み': { icon: '\u2705', label: 'セット準備OK', color: '#15803d' },
  '出荷済み': { icon: '\uD83D\uDE9A', label: '本日届く予定', color: '#1d4ed8' },
  '製作中': { icon: '\u26A0\uFE0F', label: '製作中', color: '#b45309' },
  '未発注': { icon: '\u274C', label: '未発注！', color: '#dc2626' },
}

export function getLabStatusConfig(status: string) {
  return LAB_STATUS_CONFIG[status] || LAB_STATUS_CONFIG['製作中']
}

export default function LabOrderBadge({ labOrderStatus, size = 'sm' }: LabOrderBadgeProps) {
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
}
