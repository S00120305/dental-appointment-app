'use client'

import Button from './Button'

type ConfirmDialogProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: 'primary' | 'danger'
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = '確認',
  variant = 'danger',
}: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-bold text-gray-900">{title}</h3>
        <p className="mb-6 text-sm text-gray-600">{message}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            キャンセル
          </Button>
          <Button variant={variant} onClick={onConfirm} className="flex-1">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
