/**
 * 患者名フォーマットユーティリティ（姓名分離対応）
 */

/** 姓 + 名 → "田中 太郎" */
export function formatPatientName(lastName: string, firstName: string): string {
  return `${lastName} ${firstName}`.trim()
}

/** セイ + メイ → "タナカ タロウ" */
export function formatPatientNameKana(lastNameKana: string | null, firstNameKana: string | null): string {
  if (!lastNameKana && !firstNameKana) return ''
  return `${lastNameKana || ''} ${firstNameKana || ''}`.trim()
}
