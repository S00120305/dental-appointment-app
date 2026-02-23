'use client'

type TodaySummaryProps = {
  totalCount: number
  scheduledCount: number
  checkedInCount: number
  completedCount: number
  cancelledCount: number
  noShowCount: number
  availableUnits: number
  visibleUnits: number
  nextAppointment: {
    patient_name: string
    start_time: string
    unit_number: number
  } | null
}

export default function TodaySummary({
  totalCount,
  scheduledCount,
  checkedInCount,
  completedCount,
  cancelledCount,
  noShowCount,
  availableUnits,
  visibleUnits,
  nextAppointment,
}: TodaySummaryProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-base font-bold text-gray-900">本日の予約</h2>
      </div>
      <div className="p-4">
        {/* メイン数値 */}
        <div className="mb-4 text-center">
          <span className="text-4xl font-bold text-gray-900">{totalCount}</span>
          <span className="ml-1 text-lg text-gray-500">件</span>
        </div>

        {/* 内訳 */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-md bg-gray-50 px-3 py-2 text-center">
            <div className="text-lg font-bold text-gray-500">{scheduledCount}</div>
            <div className="text-xs text-gray-400">未来院</div>
          </div>
          <div className="rounded-md bg-blue-50 px-3 py-2 text-center">
            <div className="text-lg font-bold text-blue-600">{checkedInCount}</div>
            <div className="text-xs text-blue-500">受付済み</div>
          </div>
          <div className="rounded-md bg-gray-50 px-3 py-2 text-center">
            <div className="text-lg font-bold text-gray-400">{completedCount}</div>
            <div className="text-xs text-gray-400">治療済み</div>
          </div>
        </div>

        {(cancelledCount > 0 || noShowCount > 0) && (
          <div className="mb-4 flex gap-2">
            {cancelledCount > 0 && (
              <div className="flex-1 rounded-md bg-red-50 px-3 py-2 text-center">
                <span className="text-sm font-medium text-red-600">キャンセル: {cancelledCount}件</span>
              </div>
            )}
            {noShowCount > 0 && (
              <div className="flex-1 rounded-md bg-yellow-50 px-3 py-2 text-center">
                <span className="text-sm font-medium text-yellow-700">無断キャンセル: {noShowCount}件</span>
              </div>
            )}
          </div>
        )}

        {/* 空きユニット */}
        <div className="mb-4 rounded-md border border-gray-200 px-3 py-2">
          <div className="text-xs text-gray-500">現在の空き診察室</div>
          <div className="text-lg font-bold text-gray-900">
            {availableUnits} <span className="text-sm font-normal text-gray-400">/ {visibleUnits}</span>
          </div>
        </div>

        {/* 次の予約 */}
        {nextAppointment && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
            <div className="text-xs text-blue-600 font-medium">次の予約</div>
            <div className="text-sm font-bold text-blue-900">{nextAppointment.patient_name}</div>
            <div className="text-xs text-blue-700">
              {new Date(nextAppointment.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              {' '}診察室{nextAppointment.unit_number}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
