'use client'

interface NumericKeypadProps {
  onKeyPress: (key: string) => void
  onDelete: () => void
  onSubmit: () => void
  disabled?: boolean
}

export default function NumericKeypad({
  onKeyPress,
  onDelete,
  onSubmit,
  disabled = false,
}: NumericKeypadProps) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  return (
    <div className="mx-auto w-full max-w-[280px]">
      <div className="grid grid-cols-3 gap-3">
        {keys.map((key) => (
          <button
            key={key}
            onClick={() => onKeyPress(key)}
            disabled={disabled}
            className="flex h-16 w-full items-center justify-center rounded-xl bg-gray-100 text-2xl font-semibold text-gray-800 transition-colors hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50"
          >
            {key}
          </button>
        ))}

        {/* 下段: 削除 / 0 / 確定 */}
        <button
          onClick={onDelete}
          disabled={disabled}
          className="flex h-16 w-full items-center justify-center rounded-xl bg-gray-100 text-lg font-medium text-gray-600 transition-colors hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414a2 2 0 011.414-.586H19a2 2 0 012 2v10a2 2 0 01-2 2h-8.172a2 2 0 01-1.414-.586L3 12z" />
          </svg>
        </button>
        <button
          onClick={() => onKeyPress('0')}
          disabled={disabled}
          className="flex h-16 w-full items-center justify-center rounded-xl bg-gray-100 text-2xl font-semibold text-gray-800 transition-colors hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50"
        >
          0
        </button>
        <button
          onClick={onSubmit}
          disabled={disabled}
          className="flex h-16 w-full items-center justify-center rounded-xl bg-blue-600 text-lg font-medium text-white transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
        >
          OK
        </button>
      </div>
    </div>
  )
}
