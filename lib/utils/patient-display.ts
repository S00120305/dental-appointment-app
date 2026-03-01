// 患者向け表示変換ユーティリティ
// booking_types のカテゴリ・display_name を患者にわかりやすい表現に変換

// カテゴリ → 患者向け一般名マッピング
const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  'CrBr・補綴': '治療',
  'C処置': '治療',
  'DH・衛生士': 'クリーニング',
  'インプラント': 'インプラント',
  'デンチャー・義歯': '治療',
  '手術': '治療',
  'その他': '診療',
}

/**
 * 予約種別を患者向け表示名に変換
 * - is_web_bookable=true の種別（定期検診・クリーニング等）はそのまま表示
 * - それ以外はカテゴリベースで一般化（Kp→治療、SRP→クリーニング等）
 */
export function toPatientDisplayName(
  displayName: string,
  category: string | null,
  isWebBookable: boolean
): string {
  if (isWebBookable) return displayName
  if (category && CATEGORY_DISPLAY_MAP[category]) {
    return CATEGORY_DISPLAY_MAP[category]
  }
  return '診療'
}

/**
 * スタッフ名を患者向け表示に変換（姓のみ）
 * 「北本和也」→「北本」、「佐藤 次郎」→「佐藤」
 */
export function toPatientStaffName(fullName: string): string {
  // スペース区切りの場合
  const spaceIndex = fullName.indexOf(' ')
  if (spaceIndex > 0) return fullName.substring(0, spaceIndex)
  const fullSpaceIndex = fullName.indexOf('\u3000')
  if (fullSpaceIndex > 0) return fullName.substring(0, fullSpaceIndex)

  // 漢字のみの場合、2文字を姓とする（日本人の姓は大半が2文字）
  // 3文字以上の姓も考慮して、3文字以下ならそのまま返す
  if (fullName.length <= 3) return fullName
  return fullName.substring(0, 2)
}
