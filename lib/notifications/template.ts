// テンプレート変数の置換
export function renderTemplate(
  template: string,
  vars: {
    patient_name: string
    date: string
    time: string
    type: string
  }
): string {
  return template
    .replace(/\{patient_name\}/g, vars.patient_name)
    .replace(/\{date\}/g, vars.date)
    .replace(/\{time\}/g, vars.time)
    .replace(/\{type\}/g, vars.type)
}

// デフォルトテンプレート
export const DEFAULT_SMS_TEMPLATE =
  '{patient_name}様\n明日 {date} {time} に{type}のご予約があります。\nおーるけあ歯科'

export const DEFAULT_EMAIL_TEMPLATE =
  '{patient_name}様\n\nいつもお世話になっております。\n\n明日 {date} {time} に{type}のご予約が入っております。\nご来院をお待ちしております。\n\nおーるけあ歯科'

export const DEFAULT_EMAIL_SUBJECT = '【おーるけあ歯科】明日のご予約のお知らせ'
