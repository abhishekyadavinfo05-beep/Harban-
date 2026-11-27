import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'

export default function InlineStockControl({
  stock = 0,
  onSave,
  colorClass = 'text-[#111827]',
  minusFirst = false,
}) {
  const numericStock = Math.max(0, Number(stock) || 0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(numericStock))
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)
  const skipBlurRef = useRef(false)

  useEffect(() => {
    if (!editing) {
      setDraft(String(numericStock))
    }
  }, [numericStock, editing])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startEdit = (e) => {
    e.stopPropagation()
    if (busy) return
    skipBlurRef.current = false
    setDraft(String(numericStock))
    setEditing(true)
  }

  const commit = async () => {
    if (skipBlurRef.current) {
      skipBlurRef.current = false
      return
    }
    const raw = String(draft ?? '').trim()
    setEditing(false)
    if (!raw) {
      setDraft(String(numericStock))
      return
    }
    const parsedNum = Number(raw)
    if (!Number.isFinite(parsedNum)) {
      setDraft(String(numericStock))
      return
    }
    const nextStock = Math.max(0, Math.floor(parsedNum))
    if (nextStock === numericStock) {
      setDraft(String(numericStock))
      return
    }
    setBusy(true)
    try {
      await onSave(nextStock)
    } finally {
      setBusy(false)
    }
  }

  const stepBy = async (delta, e) => {
    e.stopPropagation()
    if (busy) return
    const nextStock = Math.max(0, numericStock + delta)
    if (nextStock === numericStock) return
    setBusy(true)
    try {
      await onSave(nextStock)
    } finally {
      setBusy(false)
    }
  }

  const valueNode = editing ? (
    <input
      ref={inputRef}
      type="number"
      min={0}
      step={1}
      value={draft}
      disabled={busy}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          skipBlurRef.current = true
          setDraft(String(numericStock))
          setEditing(false)
        }
      }}
      aria-label="Edit stock quantity"
      className="w-16 h-6 text-center text-[13px] font-bold tabular-nums bg-white text-[#111827] border border-[#5B21B6] rounded-lg px-1.5 outline-none ring-2 ring-[#5B21B6]/15 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  ) : (
    <button
      type="button"
      onClick={startEdit}
      disabled={busy}
      title="Click to type stock quantity"
      className={`font-bold tabular-nums min-w-[28px] px-1.5 py-0.5 rounded-md hover:bg-[#F3E8FF]/70 hover:text-[#5B21B6] transition cursor-text text-center disabled:opacity-50 ${colorClass}`}
    >
      {numericStock}
    </button>
  )

  const minusBtn = (
    <button
      type="button"
      disabled={busy || numericStock <= 0}
      onClick={(e) => void stepBy(-1, e)}
      className="w-6 h-6 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] disabled:opacity-40 grid place-items-center text-[#4B5563] cursor-pointer"
      aria-label="Decrease stock"
    >
      <Minus size={11} />
    </button>
  )

  const plusBtn = (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => void stepBy(1, e)}
      className="w-6 h-6 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] disabled:opacity-40 grid place-items-center text-[#4B5563] cursor-pointer"
      aria-label="Increase stock"
    >
      <Plus size={11} />
    </button>
  )

  return (
    <div
      className="inline-flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {minusFirst ? (
        <>
          {minusBtn}
          {valueNode}
          {plusBtn}
        </>
      ) : (
        <>
          {valueNode}
          {minusBtn}
          {plusBtn}
        </>
      )}
    </div>
  )
}
