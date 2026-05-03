"use client"

type Props = {
  text: string
  children: React.ReactNode
}

export default function Tooltip({ text, children }: Props) {
  return (
    <span className="group relative inline-flex items-center gap-1">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg bg-gray-800 px-3 py-2 text-xs leading-snug text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </span>
    </span>
  )
}
