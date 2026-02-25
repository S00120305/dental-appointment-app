'use client'

type InventoryAlertProps = {
  alertCount: number
}

export default function InventoryAlert({ alertCount }: InventoryAlertProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-base font-bold text-gray-900">在庫アラート</h2>
      </div>
      <div className="p-4">
        {alertCount > 0 ? (
          <div className="text-center">
            <div className="mb-2">
              <span className="inline-flex items-center justify-center rounded-full bg-red-100 px-4 py-2">
                <span className="text-2xl font-bold text-red-600">{alertCount}</span>
                <span className="ml-1 text-sm text-red-500">件</span>
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-3">発注が必要なアイテムがあります</p>
            <a
              href="https://app.oralcare-kanazawa.clinic"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              在庫管理アプリを開く →
            </a>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="mb-1 text-2xl">{'\u2705'}</div>
            <p className="text-sm text-gray-500">在庫は十分です</p>
          </div>
        )}
      </div>
    </div>
  )
}
