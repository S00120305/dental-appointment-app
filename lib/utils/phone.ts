/** ハイフン等を除去して数字のみに */
export function cleanPhone(phone: string): string {
  return phone.replace(/[^\d]/g, '')
}

/** 電話番号をハイフン付きフォーマットで表示 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = cleanPhone(phone)
  if (!digits) return phone

  // 携帯: 090/080/070/050 → xxx-xxxx-xxxx
  if (/^0[5789]0\d{8}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  // 固定電話（市外局番2桁）: 03/06 → 0x-xxxx-xxxx
  if (/^0[36]\d{8}$/.test(digits)) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  // 固定電話（市外局番3桁）: 011/022/045/048/052/072/075/076/078/082/092 等
  if (/^0\d{9}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // フリーダイヤル: 0120-xxx-xxx
  if (/^0120\d{6}$/.test(digits)) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`
  }

  // その他: そのまま返す
  return phone
}
