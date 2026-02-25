'use client'

import { useEffect, useState, useCallback, createContext, useContext } from 'react'

type ToastType = 'success' | 'error' | 'info'

type ToastItem = {
  id: number
  message: string
  type: ToastType
}

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-24 left-1/2 z-[60] flex -translate-x-1/2 flex-col gap-2 lg:bottom-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg transition-all ${
              toast.type === 'success'
                ? 'bg-green-600'
                : toast.type === 'error'
                  ? 'bg-red-600'
                  : 'bg-emerald-600'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export default function Toast() {
  return null
}
