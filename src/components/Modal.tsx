import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
