'use client'

import { useEffect, useRef } from 'react'

type SlotActionMenuProps = {
  isOpen: boolean
  position: { x: number; y: number }
  onSelectAppointment: () => void
  onSelectBlock: () => void
  onClose: () => void
}

export default function SlotActionMenu({
  isOpen,
  position,
  onSelectAppointment,
  onSelectBlock,
  onClose,
}: SlotActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // 少し遅延して登録（クリックイベントの伝播防止）
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }, 10)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen, onClose])

  // メニュー位置の調整（画面外にはみ出さない）
  useEffect(() => {
    if (!isOpen || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const menu = menuRef.current

    if (rect.right > window.innerWidth) {
      menu.style.left = `${position.x - rect.width}px`
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${position.y - rect.height}px`
    }
  }, [isOpen, position])

  if (!isOpen) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-lg border border-gray-200 bg-white shadow-xl py-1"
      style={{ left: position.x, top: position.y }}
    >
      <button
        onClick={() => {
          onSelectAppointment()
          onClose()
        }}
        className="flex w-full items-center gap-2 px-4 min-h-[44px] text-sm text-gray-700 hover:bg-blue-50"
      >
        <span className="text-blue-500">+</span>
        予約を作成
      </button>
      <button
        onClick={() => {
          onSelectBlock()
          onClose()
        }}
        className="flex w-full items-center gap-2 px-4 min-h-[44px] text-sm text-gray-700 hover:bg-gray-100"
      >
        <span className="text-gray-400">&#x1f6ab;</span>
        ブロック
      </button>
    </div>
  )
}
