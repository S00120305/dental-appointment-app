/**
 * テストデータ生成スクリプト
 * 約300名の患者 + 1か月分の予約 + 技工物を作成
 *
 * Usage: node scripts/seed-test-data.mjs
 *
 * 環境変数:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   (.env.local から読み込み)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// .env.local から環境変数読み込み
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const content = readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [key, ...rest] = trimmed.split('=')
      const value = rest.join('=').replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch { /* ignore */ }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ============================
// マスターデータ定数
// ============================

const STAFF = [
  { id: '36b1ab2c-59ce-49d3-893e-ee1ca0caa21b', name: '北本和也' },
  { id: '0b8f0060-71a7-415d-8612-12c2750a7718', name: '鈴木花子' },
  { id: '4cd6ebce-f93e-4064-b9d4-c2c3dbcc8c95', name: '佐藤次郎' },
]

// Dr系（北本, 佐藤）とDH系（鈴木）でスタッフを振り分け
const DR_STAFF = [STAFF[0], STAFF[2]]
const DH_STAFF = [STAFF[1]]

const UNITS = [2, 3, 4, 5]

const LABS = [
  { id: '044975b2-93a7-41b2-bc35-fd9baaa776da', name: '院内製作' },
  { id: 'f9274d74-3314-4c77-85ba-45845518927d', name: '○○デンタルラボ' },
  { id: '662227a7-5dae-4b98-aeb5-48b6cbcbbcb0', name: '△△技工所' },
  { id: '134e64ff-bf22-4fa8-a6c9-328182cd759c', name: '□□セラミックラボ' },
]

// 代表的なbooking_types（IDは実DB値）
const BT = {
  // Dr系
  初診: { id: 'f3560590-468f-4365-a124-d5775c761881', dur: 60, name: '初診' },
  再診: { id: '7118044a-3c97-42e4-80f3-ab06f3a113d0', dur: 30, name: '再診' },
  急患: { id: 'e8262ae9-b5f4-4fd2-b37d-92eebb82e41d', dur: 30, name: '急患' },
  C処: { id: '1a5f20c7-dbe9-4141-be4a-2e614fdea535', dur: 40, name: 'C処' },
  CR: { id: '7e8fe35a-ec13-4d90-9c5d-00ce1292a1ce', dur: 30, name: 'CR' },
  Imp: { id: '90089b05-f017-4e58-be7d-209c2d8d32ba', dur: 40, name: 'Imp' },
  Set: { id: '7d0fdc2e-9577-46d8-a875-8708b62225f7', dur: 40, name: 'Set' },
  除去: { id: '4c08b727-e1b8-4871-a03f-7148636d9b82', dur: 40, name: '除去' },
  Sp: { id: '22d814dd-81af-41fa-a542-9742848e62a6', dur: 20, name: 'Sp' },
  抜髄: { id: '464e8f6d-196d-41a1-b4b3-8b52bd6beb34', dur: 50, name: '抜髄' },
  RCT: { id: 'a7b97e92-9875-44dd-8c3b-d8c68f4e90ae', dur: 40, name: 'RCT' },
  RCF: { id: '64723811-3595-4721-ba18-0e5330e907f8', dur: 30, name: 'RCF' },
  抜歯: { id: 'c7339e0b-f05a-45cf-83f0-649cea35263e', dur: 50, name: '抜歯' },
  抜糸: { id: 'd13f4362-86b5-4f02-b528-df14b4350f1a', dur: 20, name: '抜糸' },
  Kp: { id: 'bf4a215b-4acb-4f22-9eac-cb42ae609ce8', dur: 40, name: 'Kp' },
  PZImp: { id: 'd267348d-b3f5-4f74-a529-9f8c6f72896a', dur: 50, name: 'PZ Imp' },
  試適: { id: 'cf43f587-c6b2-450f-8c25-dad47a788a58', dur: 30, name: '試適' },
  BrImp: { id: 'edd729f3-8ac7-419d-9806-79ffbc9a18d5', dur: 60, name: 'Br Imp' },
  BrSet: { id: 'a967e494-d9e0-4913-94c4-b07964ea5cec', dur: 50, name: 'Br Set' },
  TEK: { id: 'ae33668b-1c5d-4d3e-a502-5699e0696f69', dur: 30, name: 'TEK' },
  コア築造: { id: 'd2769b2b-b135-400c-b69e-cfe2367d0a11', dur: 40, name: 'コア築造' },
  義歯Imp: { id: '020b66c2-91ea-469b-8089-fb09c8de9950', dur: 30, name: '義歯Imp' },
  義歯Set: { id: 'a8ea441f-c0b0-4a8f-98b3-a94a5b2464c1', dur: 50, name: '義歯Set' },
  義歯調整: { id: '6581022e-18e3-4a28-86a5-c5cd708e30b4', dur: 40, name: '義歯調整' },
  // DH系
  SC: { id: '5e25f372-997c-4647-939c-4c2f28cbcc78', dur: 30, name: 'SC' },
  SRP: { id: '96a8d8b8-b618-478b-a7da-f16f709e5987', dur: 40, name: 'SRP' },
  TBI: { id: '2904d46d-5f16-4fbb-9cac-232c1a43aa23', dur: 30, name: 'TBI' },
  PMTC: { id: 'c4984693-17b0-48a7-adb3-a812a62306eb', dur: 40, name: 'PMTC' },
  SPT: { id: '6039447e-eed7-42d7-8f52-5862c76aa844', dur: 40, name: 'SPT' },
  フッ素: { id: '6be84383-f678-40ce-8d66-53e05006bb1f', dur: 30, name: 'フッ素' },
  リコール: { id: '29ee062f-305f-4dc4-8c8a-4315d2fd426a', dur: 40, name: 'リコール' },
  P基検: { id: 'f0d0c3d4-105d-4654-a100-09d25bbd4b3c', dur: 30, name: 'P基検' },
  P精検: { id: '5621015f-8fdc-4826-baeb-a1e27fff064f', dur: 30, name: 'P精検' },
  // その他
  レントゲン: { id: 'c4b930fd-3f05-4e54-a2cc-de0086234021', dur: 20, name: 'レントゲン' },
}

// Dr向け予約種別（重み付き）
const DR_TYPES = [
  { bt: BT.C処, w: 15 }, { bt: BT.CR, w: 12 }, { bt: BT.Imp, w: 8 },
  { bt: BT.Set, w: 10 }, { bt: BT.除去, w: 5 }, { bt: BT.Sp, w: 3 },
  { bt: BT.抜髄, w: 4 }, { bt: BT.RCT, w: 6 }, { bt: BT.RCF, w: 4 },
  { bt: BT.抜歯, w: 3 }, { bt: BT.抜糸, w: 2 }, { bt: BT.Kp, w: 5 },
  { bt: BT.PZImp, w: 3 }, { bt: BT.試適, w: 3 }, { bt: BT.BrImp, w: 2 },
  { bt: BT.BrSet, w: 2 }, { bt: BT.TEK, w: 3 }, { bt: BT.コア築造, w: 4 },
  { bt: BT.義歯Imp, w: 2 }, { bt: BT.義歯Set, w: 2 }, { bt: BT.義歯調整, w: 3 },
  { bt: BT.初診, w: 5 }, { bt: BT.再診, w: 8 }, { bt: BT.急患, w: 2 },
]

// DH向け予約種別（重み付き）
const DH_TYPES = [
  { bt: BT.SC, w: 20 }, { bt: BT.SRP, w: 10 }, { bt: BT.TBI, w: 5 },
  { bt: BT.PMTC, w: 15 }, { bt: BT.SPT, w: 12 }, { bt: BT.フッ素, w: 8 },
  { bt: BT.リコール, w: 15 }, { bt: BT.P基検, w: 5 }, { bt: BT.P精検, w: 5 },
]

// Tag IDs
const TAGS = {
  車いす: 'f8eba272-6f12-47de-a692-1e79c6571c31',
  お子様連れ: 'b1fc440d-d954-40bc-8024-3bdf61d52994',
  浸麻あり: '4e8a2bb7-4b66-4fa5-b9c5-7f29ec55556b',
  感染注意: '94d288f7-4ef6-4179-bd2c-1540c7f538b9',
  VIP: 'fef69851-1cf6-489f-8acf-f3ee877f820e',
}

// 休診日: 日曜(0), 月曜(1), 春分の日(2026-03-20)
const HOLIDAY_DATES = new Set(['2026-03-20'])
function isHoliday(date) {
  const d = new Date(date + 'T00:00:00+09:00')
  const dow = d.getDay()
  if (dow === 0 || dow === 1) return true
  return HOLIDAY_DATES.has(date)
}

// ============================
// ユーティリティ
// ============================

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function weightedRand(items) {
  const total = items.reduce((s, i) => s + i.w, 0)
  let r = Math.random() * total
  for (const item of items) {
    r -= item.w
    if (r <= 0) return item.bt
  }
  return items[items.length - 1].bt
}

function pad2(n) { return String(n).padStart(2, '0') }

function formatDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00+09:00')
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

// ============================
// 名前データ（300名分生成用）
// ============================

const LAST_NAMES = [
  '佐藤','鈴木','高橋','田中','伊藤','渡辺','山本','中村','小林','加藤',
  '吉田','山田','佐々木','松本','井上','木村','林','斎藤','清水','山口',
  '森','池田','橋本','阿部','石川','山崎','中島','前田','藤田','小川',
  '岡田','後藤','長谷川','村上','近藤','石井','遠藤','青木','坂本','斉藤',
  '福田','太田','西村','三浦','藤井','岡本','金子','中野','原','河野',
  '横山','安藤','上田','杉山','内田','大野','松田','丸山','菅原','酒井',
  '宮崎','新井','高木','西田','武田','野口','小野','望月','竹内','久保',
]

const FIRST_NAMES_M = [
  '太郎','一郎','健太','翔太','大輔','拓也','直樹','和也','浩二','誠',
  '隆','博','裕太','亮','陸','蓮','悠真','大翔','陽翔','朝陽',
  '湊','新','結翔','悠斗','奏太','樹','颯真','大和','伊織','律',
  '修平','雄一','康弘','正義','秀樹','浩一','光男','勇人','達也','剛',
  '進','茂','清','実','豊','正','勝','明','昭','弘',
]

const FIRST_NAMES_F = [
  '花子','優子','真由美','恵子','京子','和子','美咲','陽菜','結衣','凛',
  '紬','芽依','莉子','詩','杏','楓','愛','美月','心春','彩花',
  '理恵','由美','智子','裕子','直美','典子','明美','久美子','幸子','洋子',
  '美穂','千尋','さくら','あかり','ひなた','葵','茜','琴音','日向','光',
]

const KANA_LAST = [
  'さとう','すずき','たかはし','たなか','いとう','わたなべ','やまもと','なかむら','こばやし','かとう',
  'よしだ','やまだ','ささき','まつもと','いのうえ','きむら','はやし','さいとう','しみず','やまぐち',
  'もり','いけだ','はしもと','あべ','いしかわ','やまざき','なかじま','まえだ','ふじた','おがわ',
  'おかだ','ごとう','はせがわ','むらかみ','こんどう','いしい','えんどう','あおき','さかもと','さいとう',
  'ふくだ','おおた','にしむら','みうら','ふじい','おかもと','かねこ','なかの','はら','かわの',
  'よこやま','あんどう','うえだ','すぎやま','うちだ','おおの','まつだ','まるやま','すがわら','さかい',
  'みやざき','あらい','たかぎ','にしだ','たけだ','のぐち','おの','もちづき','たけうち','くぼ',
]

const KANA_FIRST_M = [
  'たろう','いちろう','けんた','しょうた','だいすけ','たくや','なおき','かずや','こうじ','まこと',
  'たかし','ひろし','ゆうた','りょう','りく','れん','ゆうま','ひろと','はると','あさひ',
  'みなと','あらた','ゆいと','ゆうと','そうた','いつき','そうま','やまと','いおり','りつ',
  'しゅうへい','ゆういち','やすひろ','まさよし','ひでき','こういち','みつお','はやと','たつや','つよし',
  'すすむ','しげる','きよし','みのる','ゆたか','ただし','まさる','あきら','あきら','ひろし',
]

const KANA_FIRST_F = [
  'はなこ','ゆうこ','まゆみ','けいこ','きょうこ','かずこ','みさき','ひな','ゆい','りん',
  'つむぎ','めい','りこ','うた','あん','かえで','あい','みづき','こはる','あやか',
  'りえ','ゆみ','ともこ','ゆうこ','なおみ','のりこ','あけみ','くみこ','さちこ','ようこ',
  'みほ','ちひろ','さくら','あかり','ひなた','あおい','あかね','ことね','ひなた','ひかり',
]

// ============================
// 患者生成
// ============================

function generatePatients(count, startChartNumber) {
  const patients = []
  for (let i = 0; i < count; i++) {
    const isMale = Math.random() > 0.45 // やや男性多め
    const lastIdx = i % LAST_NAMES.length
    const firstNames = isMale ? FIRST_NAMES_M : FIRST_NAMES_F
    const kanaFirsts = isMale ? KANA_FIRST_M : KANA_FIRST_F
    const firstIdx = Math.floor(i / LAST_NAMES.length) % firstNames.length + randInt(0, 3)

    const name = LAST_NAMES[lastIdx] + firstNames[firstIdx % firstNames.length]
    const nameKana = KANA_LAST[lastIdx] + kanaFirsts[firstIdx % kanaFirsts.length]
    const chartNumber = String(startChartNumber + i).padStart(5, '0')

    // 生年月日（10歳〜85歳）
    const age = randInt(10, 85)
    const birthYear = 2026 - age
    const birthMonth = randInt(1, 12)
    const birthDay = randInt(1, 28)
    const birthDate = `${birthYear}-${pad2(birthMonth)}-${pad2(birthDay)}`

    // 電話番号（080/090ランダム）
    const phone = `0${randInt(7, 9)}0${String(randInt(10000000, 99999999))}`

    patients.push({
      chart_number: chartNumber,
      name,
      name_kana: nameKana,
      phone,
      birth_date: birthDate,
      memo: '',
      is_vip: Math.random() < 0.03, // 3%がVIP
      caution_level: Math.random() < 0.05 ? randInt(1, 3) : 0,
      is_infection_alert: Math.random() < 0.02, // 2%
    })
  }
  return patients
}

// ============================
// 技工物生成
// ============================

const LAB_ITEM_TYPES = [
  { type: 'FCK', tooth: () => `#${randInt(11,48)}` },
  { type: 'MB冠', tooth: () => `#${randInt(14,47)}` },
  { type: 'インレー', tooth: () => `#${randInt(14,47)}` },
  { type: 'Br', tooth: () => `#${randInt(13,46)}-${randInt(14,47)}` },
  { type: 'PD', tooth: () => `${randInt(1,4)}顎` },
  { type: 'FD', tooth: () => rand(['上顎','下顎']) },
  { type: 'CR', tooth: () => `#${randInt(11,47)}` },
  { type: 'e.max', tooth: () => `#${randInt(11,25)}` },
  { type: 'ジルコニア', tooth: () => `#${randInt(11,47)}` },
]

function generateLabOrders(patients, startDate, dayCount) {
  const orders = []
  const count = Math.floor(patients.length * 0.15) // 約15%の患者に技工物

  for (let i = 0; i < count; i++) {
    const patient = patients[i % patients.length]
    const itemInfo = rand(LAB_ITEM_TYPES)
    const lab = rand(LABS)
    const orderDayOffset = randInt(0, dayCount - 14)
    const orderDate = addDays(startDate, orderDayOffset)
    const dueDayOffset = randInt(7, 14)
    const dueDate = addDays(orderDate, dueDayOffset)
    const setDayOffset = randInt(1, 5)
    const setDate = addDays(dueDate, setDayOffset)

    // ステータスは日付ベースで決定
    const today = '2026-02-26'
    let status = '製作中'
    if (dueDate < today) {
      status = rand(['納品済み', 'セット完了', 'セット完了'])
    } else if (orderDate < today) {
      status = rand(['製作中', '製作中', '納品済み'])
    } else {
      status = '未発注'
    }

    orders.push({
      patient_id: patient.chart_number,
      patient_name: patient.name,
      tooth_info: itemInfo.tooth(),
      item_type: itemInfo.type,
      lab_id: lab.id,
      order_date: orderDate,
      due_date: dueDate,
      set_date: setDate,
      status,
      created_by: rand(DR_STAFF).id,
    })
  }
  return orders
}

// ============================
// 予約生成
// ============================

// 診療時間枠: 9:00-12:30, 14:00-18:00（10分刻み）
const MORNING_SLOTS = []
for (let h = 9; h < 12; h++) for (let m = 0; m < 60; m += 10) MORNING_SLOTS.push(`${pad2(h)}:${pad2(m)}`)
MORNING_SLOTS.push('12:00', '12:10', '12:20') // 12:30ギリギリまで

const AFTERNOON_SLOTS = []
for (let h = 14; h < 18; h++) for (let m = 0; m < 60; m += 10) AFTERNOON_SLOTS.push(`${pad2(h)}:${pad2(m)}`)

const ALL_SLOTS = [...MORNING_SLOTS, ...AFTERNOON_SLOTS]

function generateAppointments(patients, labOrders, startDate, dayCount) {
  const appointments = []
  const slidePairs = [] // スライド紐付け用

  // 各日の各ユニットのスケジュールを管理
  for (let dayOff = 0; dayOff < dayCount; dayOff++) {
    const dateStr = addDays(startDate, dayOff)
    if (isHoliday(dateStr)) continue

    // 1日あたりの予約数: ユニット4つ × 各ユニット8-12枠 ≒ 32-48件/日
    // 月20営業日で640-960件/月

    for (const unit of UNITS) {
      const occupiedSlots = new Set() // この日このユニットの使用済みスロット

      // 午前: 3-5件
      const morningCount = randInt(3, 5)
      // 午後: 4-7件
      const afternoonCount = randInt(4, 7)

      const dayAppointments = []

      // 午前の予約生成
      let nextSlotIdx = 0
      for (let j = 0; j < morningCount && nextSlotIdx < MORNING_SLOTS.length; j++) {
        const isDH = unit === 5 || (unit === 4 && Math.random() < 0.5)
        const bt = isDH ? weightedRand(DH_TYPES) : weightedRand(DR_TYPES)
        const staff = isDH ? rand(DH_STAFF) : rand(DR_STAFF)
        const patient = rand(patients)

        const time = MORNING_SLOTS[nextSlotIdx]
        const slotsNeeded = bt.dur / 10
        // 占有チェック
        let canPlace = true
        for (let s = 0; s < slotsNeeded && (nextSlotIdx + s) < MORNING_SLOTS.length; s++) {
          if (occupiedSlots.has(MORNING_SLOTS[nextSlotIdx + s])) {
            canPlace = false
            break
          }
        }
        if (!canPlace) { nextSlotIdx++; j--; continue }

        for (let s = 0; s < slotsNeeded && (nextSlotIdx + s) < MORNING_SLOTS.length; s++) {
          occupiedSlots.add(MORNING_SLOTS[nextSlotIdx + s])
        }

        const startTime = `${dateStr}T${time}:00+09:00`

        // ステータス決定（過去の予約は completed 多め）
        const today = '2026-02-26'
        let status = 'scheduled'
        if (dateStr < today) {
          const r = Math.random()
          if (r < 0.85) status = 'completed'
          else if (r < 0.92) status = 'checked_in'
          else if (r < 0.96) status = 'cancelled'
          else status = 'no_show'
        }

        // タグ（5%の確率で付与）
        const tagIds = []
        if (Math.random() < 0.03) tagIds.push(TAGS.浸麻あり)
        if (Math.random() < 0.01) tagIds.push(TAGS.車いす)
        if (Math.random() < 0.02) tagIds.push(TAGS.お子様連れ)
        if (patient.is_vip) tagIds.push(TAGS.VIP)
        if (patient.is_infection_alert) tagIds.push(TAGS.感染注意)

        // 技工物紐付け（Set系の場合）
        let labOrderId = null
        if ((bt.name === 'Set' || bt.name === 'Br Set' || bt.name === '義歯Set') && labOrders.length > 0) {
          const matching = labOrders.find(lo =>
            lo.patient_id === patient.chart_number &&
            lo.set_date === dateStr &&
            !lo._used
          )
          if (matching) {
            labOrderId = matching._id
            matching._used = true
          }
        }

        dayAppointments.push({
          patient_id: patient._id,
          patient_chart: patient.chart_number,
          unit_number: unit,
          staff_id: staff.id,
          start_time: startTime,
          duration_minutes: bt.dur,
          appointment_type: bt.name,
          booking_type_id: bt.id,
          status,
          memo: null,
          lab_order_id: labOrderId,
          tag_ids: tagIds,
          _dateStr: dateStr,
          _time: time,
        })

        nextSlotIdx += slotsNeeded + (Math.random() < 0.3 ? 1 : 0) // 30%の確率で10分空き
      }

      // 午後の予約生成
      nextSlotIdx = 0
      for (let j = 0; j < afternoonCount && nextSlotIdx < AFTERNOON_SLOTS.length; j++) {
        const isDH = unit === 5 || (unit === 4 && Math.random() < 0.5)
        const bt = isDH ? weightedRand(DH_TYPES) : weightedRand(DR_TYPES)
        const staff = isDH ? rand(DH_STAFF) : rand(DR_STAFF)
        const patient = rand(patients)

        const time = AFTERNOON_SLOTS[nextSlotIdx]
        const slotsNeeded = bt.dur / 10

        let canPlace = true
        for (let s = 0; s < slotsNeeded && (nextSlotIdx + s) < AFTERNOON_SLOTS.length; s++) {
          if (occupiedSlots.has(AFTERNOON_SLOTS[nextSlotIdx + s])) {
            canPlace = false
            break
          }
        }
        if (!canPlace) { nextSlotIdx++; j--; continue }

        for (let s = 0; s < slotsNeeded && (nextSlotIdx + s) < AFTERNOON_SLOTS.length; s++) {
          occupiedSlots.add(AFTERNOON_SLOTS[nextSlotIdx + s])
        }

        const startTime = `${dateStr}T${time}:00+09:00`

        const today = '2026-02-26'
        let status = 'scheduled'
        if (dateStr < today) {
          const r = Math.random()
          if (r < 0.85) status = 'completed'
          else if (r < 0.92) status = 'checked_in'
          else if (r < 0.96) status = 'cancelled'
          else status = 'no_show'
        }

        const tagIds = []
        if (Math.random() < 0.03) tagIds.push(TAGS.浸麻あり)
        if (Math.random() < 0.01) tagIds.push(TAGS.車いす)
        if (Math.random() < 0.02) tagIds.push(TAGS.お子様連れ)
        if (patient.is_vip) tagIds.push(TAGS.VIP)
        if (patient.is_infection_alert) tagIds.push(TAGS.感染注意)

        let labOrderId = null
        if ((bt.name === 'Set' || bt.name === 'Br Set' || bt.name === '義歯Set') && labOrders.length > 0) {
          const matching = labOrders.find(lo =>
            lo.patient_id === patient.chart_number &&
            lo.set_date === dateStr &&
            !lo._used
          )
          if (matching) {
            labOrderId = matching._id
            matching._used = true
          }
        }

        dayAppointments.push({
          patient_id: patient._id,
          patient_chart: patient.chart_number,
          unit_number: unit,
          staff_id: staff.id,
          start_time: startTime,
          duration_minutes: bt.dur,
          appointment_type: bt.name,
          booking_type_id: bt.id,
          status,
          memo: null,
          lab_order_id: labOrderId,
          tag_ids: tagIds,
          _dateStr: dateStr,
          _time: time,
        })

        nextSlotIdx += slotsNeeded + (Math.random() < 0.3 ? 1 : 0)
      }

      appointments.push(...dayAppointments)
    }

    // スライドペア生成（1日5%の確率で1-2組）
    const todayAppts = appointments.filter(a => a._dateStr === dateStr && a.status !== 'cancelled' && a.status !== 'no_show')
    if (Math.random() < 0.15 && todayAppts.length >= 4) {
      // 同じ患者の予約がある場合にスライド
      const patientAppts = {}
      for (const a of todayAppts) {
        if (!patientAppts[a.patient_chart]) patientAppts[a.patient_chart] = []
        patientAppts[a.patient_chart].push(a)
      }
      for (const [, appts] of Object.entries(patientAppts)) {
        if (appts.length >= 2) {
          // 時間順で並べて先のものをslide_fromに
          appts.sort((a, b) => a._time.localeCompare(b._time))
          slidePairs.push({ from: appts[0], to: appts[1] })
          break // 1日1ペアまで
        }
      }
    }
  }

  return { appointments, slidePairs }
}

// ============================
// メイン実行
// ============================

async function main() {
  console.log('=== テストデータ生成開始 ===')
  const startDate = '2026-02-16' // 約10日前から
  const endDate = '2026-03-20' // 約3週間後まで
  const dayCount = 33

  // 1. 患者生成
  console.log('\n[1/5] 患者 300名を作成中...')
  const patientData = generatePatients(300, 100) // カルテNo: 00100〜00399

  // バッチinsert（50件ずつ）
  const createdPatients = []
  for (let i = 0; i < patientData.length; i += 50) {
    const batch = patientData.slice(i, i + 50)
    const { data, error } = await supabase
      .from('patients')
      .insert(batch)
      .select('id, chart_number, name')

    if (error) {
      console.error(`  患者バッチ ${i}-${i + 50} エラー:`, error.message)
      continue
    }
    createdPatients.push(...(data || []))
    process.stdout.write(`  ${createdPatients.length}/${patientData.length}\r`)
  }
  console.log(`  完了: ${createdPatients.length}名作成`)

  // _id をマッピング
  const patientsWithIds = patientData.map((p, idx) => {
    const created = createdPatients.find(c => c.chart_number === p.chart_number)
    return { ...p, _id: created?.id || null }
  }).filter(p => p._id)

  // 2. 技工物生成
  console.log('\n[2/5] 技工物を作成中...')
  const labOrderData = generateLabOrders(patientsWithIds, startDate, dayCount)
  console.log(`  ${labOrderData.length}件の技工物を作成中...`)

  const createdLabOrders = []
  for (let i = 0; i < labOrderData.length; i += 30) {
    const batch = labOrderData.slice(i, i + 30)
    const { data, error } = await supabase
      .from('lab_orders')
      .insert(batch)
      .select('id, patient_id, set_date')

    if (error) {
      console.error(`  技工物バッチ ${i} エラー:`, error.message)
      continue
    }
    createdLabOrders.push(...(data || []))
    process.stdout.write(`  ${createdLabOrders.length}/${labOrderData.length}\r`)
  }
  console.log(`  完了: ${createdLabOrders.length}件作成`)

  // lab_orders に _id をマッピング
  const labOrdersWithIds = labOrderData.map((lo, idx) => {
    const created = createdLabOrders[idx]
    return { ...lo, _id: created?.id || null }
  }).filter(lo => lo._id)

  // 3. 予約生成
  console.log('\n[3/5] 予約を生成中...')
  const { appointments: apptData, slidePairs } = generateAppointments(patientsWithIds, labOrdersWithIds, startDate, dayCount)
  console.log(`  ${apptData.length}件の予約を作成中（スライド ${slidePairs.length}ペア）...`)

  // 予約を挿入（tag_links は別テーブルなので後処理）
  const createdAppointments = []
  const tagInserts = [] // { appointment_id, tag_id }[]

  for (let i = 0; i < apptData.length; i += 50) {
    const batch = apptData.slice(i, i + 50).map(a => ({
      patient_id: a.patient_id,
      unit_number: a.unit_number,
      staff_id: a.staff_id,
      start_time: a.start_time,
      duration_minutes: a.duration_minutes,
      appointment_type: a.appointment_type,
      booking_type_id: a.booking_type_id,
      status: a.status,
      memo: a.memo,
      lab_order_id: a.lab_order_id,
    }))

    const { data, error } = await supabase
      .from('appointments')
      .insert(batch)
      .select('id')

    if (error) {
      console.error(`  予約バッチ ${i} エラー:`, error.message)
      continue
    }

    // IDをマッピングしてタグ挿入準備
    if (data) {
      for (let j = 0; j < data.length; j++) {
        const globalIdx = i + j
        const appt = apptData[globalIdx]
        const createdId = data[j].id
        appt._createdId = createdId
        createdAppointments.push({ id: createdId, ...appt })
        if (appt.tag_ids?.length) {
          for (const tagId of appt.tag_ids) {
            tagInserts.push({ appointment_id: createdId, tag_id: tagId })
          }
        }
      }
    }
    process.stdout.write(`  ${createdAppointments.length}/${apptData.length}\r`)
  }
  console.log(`  完了: ${createdAppointments.length}件作成`)

  // 4. タグ紐付け
  if (tagInserts.length > 0) {
    console.log(`\n[4/5] タグ紐付け ${tagInserts.length}件...`)
    for (let i = 0; i < tagInserts.length; i += 100) {
      const batch = tagInserts.slice(i, i + 100)
      const { error } = await supabase
        .from('appointment_tag_links')
        .insert(batch)
      if (error) console.error(`  タグバッチ ${i} エラー:`, error.message)
    }
    console.log('  完了')
  } else {
    console.log('\n[4/5] タグ紐付け: なし')
  }

  // 5. スライド紐付け
  if (slidePairs.length > 0) {
    console.log(`\n[5/5] スライド紐付け ${slidePairs.length}ペア...`)
    for (const pair of slidePairs) {
      const fromId = pair.from._createdId
      const toId = pair.to._createdId
      if (fromId && toId) {
        const { error } = await supabase
          .from('appointments')
          .update({ slide_from_id: fromId })
          .eq('id', toId)
        if (error) console.error(`  スライド紐付けエラー:`, error.message)
      }
    }
    console.log('  完了')
  } else {
    console.log('\n[5/5] スライド紐付け: なし')
  }

  // サマリー
  console.log('\n=== 完了サマリー ===')
  console.log(`患者: ${createdPatients.length}名（カルテNo: 00100〜）`)
  console.log(`技工物: ${createdLabOrders.length}件`)
  console.log(`予約: ${createdAppointments.length}件`)
  console.log(`タグ紐付け: ${tagInserts.length}件`)
  console.log(`スライドペア: ${slidePairs.length}件`)
  console.log(`期間: ${startDate} 〜 ${addDays(startDate, dayCount - 1)}`)
  console.log(`休診日: 日曜・月曜 + 祝日`)
}

main().catch(console.error)
