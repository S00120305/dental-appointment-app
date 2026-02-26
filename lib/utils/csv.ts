export type CsvRow = {
  chart_number: string
  name: string
  name_kana: string
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

const HEADER_MAP: Record<string, keyof CsvRow> = {
  'カルテNo': 'chart_number',
  'カルテno': 'chart_number',
  'カルテNO': 'chart_number',
  'chart_number': 'chart_number',
  '氏名': 'name',
  '名前': 'name',
  'name': 'name',
  'フリガナ': 'name_kana',
  'ふりがな': 'name_kana',
  'name_kana': 'name_kana',
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

export function parseCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  const rows: CsvRow[] = []
  const errors: { row: number; message: string }[] = []

  if (lines.length === 0) {
    return { rows, errors: [{ row: 0, message: 'CSVデータが空です' }] }
  }

  // ヘッダー解析
  const headers = parseCsvLine(lines[0])
  const columnMap: (keyof CsvRow | null)[] = headers.map((h) => {
    const trimmed = h.trim()
    return HEADER_MAP[trimmed] || null
  })

  // カルテNoと氏名のカラムが存在するか確認
  if (!columnMap.includes('chart_number')) {
    return { rows, errors: [{ row: 1, message: '「カルテNo」列が見つかりません' }] }
  }
  if (!columnMap.includes('name')) {
    return { rows, errors: [{ row: 1, message: '「氏名」列が見つかりません' }] }
  }

  // データ行解析
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const row: CsvRow = { chart_number: '', name: '', name_kana: '', phone: '', email: '', gender: '', date_of_birth: '', postal_code: '', address: '' }

    columnMap.forEach((key, colIdx) => {
      if (key && values[colIdx] !== undefined) {
        row[key] = values[colIdx].trim()
      }
    })

    // バリデーション
    if (!row.chart_number) {
      errors.push({ row: i + 1, message: 'カルテNoが空です' })
    } else if (!row.name) {
      errors.push({ row: i + 1, message: '氏名が空です' })
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
