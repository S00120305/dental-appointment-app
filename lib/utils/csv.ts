export type CsvRow = {
  chart_number: string
  last_name: string
  first_name: string
  last_name_kana: string
  first_name_kana: string
  phone: string
  email: string
  gender: string
  date_of_birth: string
  postal_code: string
  address: string
}

export type CsvParseResult = {
  rows: CsvRow[]
  errors: { row: number; message: string }[]
}

// Extended key type: includes intermediate full-name keys for backward compat
type CsvKey = keyof CsvRow | '_full_name' | '_full_name_kana'

const HEADER_MAP: Record<string, CsvKey> = {
  'カルテNo': 'chart_number',
  'カルテno': 'chart_number',
  'カルテNO': 'chart_number',
  'chart_number': 'chart_number',
  // 姓名分離カラム
  '姓': 'last_name',
  'last_name': 'last_name',
  '名': 'first_name',
  'first_name': 'first_name',
  // 後方互換: 「氏名」1カラム → スペース分割
  '氏名': '_full_name',
  '名前': '_full_name',
  'name': '_full_name',
  // フリガナ分離カラム
  'セイ': 'last_name_kana',
  'last_name_kana': 'last_name_kana',
  'メイ': 'first_name_kana',
  'first_name_kana': 'first_name_kana',
  // 後方互換: 「フリガナ」1カラム → スペース分割
  'フリガナ': '_full_name_kana',
  'ふりがな': '_full_name_kana',
  'name_kana': '_full_name_kana',
  '電話番号': 'phone',
  '電話': 'phone',
  'phone': 'phone',
  'メール': 'email',
  'メールアドレス': 'email',
  'email': 'email',
  '性別': 'gender',
  'gender': 'gender',
  '生年月日': 'date_of_birth',
  'date_of_birth': 'date_of_birth',
  '郵便番号': 'postal_code',
  'postal_code': 'postal_code',
  '住所': 'address',
  'address': 'address',
}

/**
 * スペース（半角・全角）で姓名を分割する
 * 例: "田中 太郎" → ["田中", "太郎"]
 *      "田中" → ["田中", ""]
 */
function splitName(fullName: string): [string, string] {
  const trimmed = fullName.trim()
  const parts = trimmed.split(/[\s\u3000]+/)
  if (parts.length >= 2) {
    return [parts[0], parts.slice(1).join(' ')]
  }
  return [trimmed, '']
}

export function parseCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  const rows: CsvRow[] = []
  const errors: { row: number; message: string }[] = []

  if (lines.length === 0) {
    return { rows, errors: [{ row: 0, message: 'CSVデータが空です' }] }
  }

  // ヘッダー解析
  const headers = parseCsvLine(lines[0])
  const columnMap: (CsvKey | null)[] = headers.map((h) => {
    const trimmed = h.trim()
    return HEADER_MAP[trimmed] || null
  })

  // カルテNoが存在するか確認
  if (!columnMap.includes('chart_number')) {
    return { rows, errors: [{ row: 1, message: '「カルテNo」列が見つかりません' }] }
  }
  // 氏名: last_name直接 or _full_name（後方互換）のいずれかが必要
  if (!columnMap.includes('last_name') && !columnMap.includes('_full_name')) {
    return { rows, errors: [{ row: 1, message: '「氏名」または「姓」列が見つかりません' }] }
  }

  // データ行解析
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const row: CsvRow = {
      chart_number: '', last_name: '', first_name: '',
      last_name_kana: '', first_name_kana: '',
      phone: '', email: '', gender: '', date_of_birth: '',
      postal_code: '', address: '',
    }
    let fullName = ''
    let fullNameKana = ''

    columnMap.forEach((key, colIdx) => {
      if (!key || values[colIdx] === undefined) return
      const val = values[colIdx].trim()
      if (key === '_full_name') {
        fullName = val
      } else if (key === '_full_name_kana') {
        fullNameKana = val
      } else {
        row[key] = val
      }
    })

    // 後方互換: 氏名1カラムからスペース分割
    if (fullName && !row.last_name) {
      const [lastName, firstName] = splitName(fullName)
      row.last_name = lastName
      row.first_name = firstName
    }
    if (fullNameKana && !row.last_name_kana) {
      const [lastKana, firstKana] = splitName(fullNameKana)
      row.last_name_kana = lastKana
      row.first_name_kana = firstKana
    }

    // バリデーション
    if (!row.chart_number) {
      errors.push({ row: i + 1, message: 'カルテNoが空です' })
    } else if (!row.last_name) {
      errors.push({ row: i + 1, message: '氏名（姓）が空です' })
    }

    rows.push(row)
  }

  return { rows, errors }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current)
  return result
}
