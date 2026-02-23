export type PatientTagInfo = {
  icon: string
  color: string
  label: string
}

export function getPatientTagIcons(patient: {
  is_vip?: boolean
  caution_level?: number
  is_infection_alert?: boolean
}): PatientTagInfo[] {
  const tags: PatientTagInfo[] = []

  if (patient.is_vip) {
    tags.push({ icon: '\u2B50', color: '#F59E0B', label: 'VIP' })
  }

  if (patient.caution_level === 1) {
    tags.push({ icon: '\u26A0', color: '#F97316', label: '\u6CE8\u610F\u2460' })
  } else if (patient.caution_level === 2) {
    tags.push({ icon: '\u26A0\u26A0', color: '#EF4444', label: '\u6CE8\u610F\u2461' })
  } else if (patient.caution_level === 3) {
    tags.push({ icon: '\u26A0\u26A0\u26A0', color: '#DC2626', label: '\u6CE8\u610F\u2462' })
  }

  if (patient.is_infection_alert) {
    tags.push({ icon: '\u266A', color: '#7C3AED', label: '\u611F\u67D3\u6CE8\u610F' })
  }

  return tags
}

// カレンダー表示用の短縮アイコン文字列
export function getPatientTagIconString(patient: {
  is_vip?: boolean
  caution_level?: number
  is_infection_alert?: boolean
}): string {
  const icons: string[] = []

  if (patient.is_vip) icons.push('\u2B50')
  if (patient.caution_level === 1) icons.push('\u26A0')
  else if (patient.caution_level === 2) icons.push('\u26A0\u26A0')
  else if (patient.caution_level === 3) icons.push('\u26A0\u26A0\u26A0')
  if (patient.is_infection_alert) icons.push('\u266A')

  return icons.join('')
}
