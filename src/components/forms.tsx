import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from 'react'

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />
}

export function NumberField(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      inputMode="decimal"
      {...props}
      type="number"
      className={`${inputCls} tnum ${props.className ?? ''}`}
    />
  )
}

export function SelectField(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputCls} bg-white ${props.className ?? ''}`}>
      {props.children}
    </select>
  )
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const btnStyles: Record<BtnVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  ghost: 'text-gray-600 hover:bg-gray-100',
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: {
  variant?: BtnVariant
} & InputHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${btnStyles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Badge({
  children,
  color = 'gray',
}: {
  children: ReactNode
  color?: 'gray' | 'green' | 'red' | 'amber' | 'blue'
}) {
  const map = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[color]}`}>
      {children}
    </span>
  )
}
