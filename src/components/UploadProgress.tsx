/**
 * Thin progress bar for file uploads. Renders nothing when `value` is null
 * (idle). `value` is 0–100.
 */
export function UploadProgress({ value, label = 'Ανέβασμα…' }: { value: number | null; label?: string }) {
  if (value === null) return null
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
        <span className="truncate">{label}</span>
        <span className="tnum shrink-0 pl-2">{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-150"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}
