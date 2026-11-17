import { Star, StarHalf } from 'lucide-react'

/* Rating row — supports the half stars the original renders. */
export function Stars({ rating = 5, size = 14, className = '' }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return (
    <span className={`inline-flex items-center gap-0.5 text-amber-400 ${className}`}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={i} size={size} fill="currentColor" strokeWidth={0} />
      ))}
      {half && <StarHalf size={size} fill="currentColor" strokeWidth={0} />}
    </span>
  )
}

/* Section heading: display title left, optional sub + action right. */
export function SectionHead({ title, sub, action }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-2.5">
      <div>
        <h2 className="font-display font-extrabold text-[20px] sm:text-[24px] tracking-tight">
          {title}
        </h2>
        {sub && (
          <p className="text-[13px] text-neutral-500 mt-0.5">{sub}</p>
        )}
      </div>
      {action}
    </div>
  )
}

/* Small rounded label used for badges and pills. */
export function Pill({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-neutral-100 text-neutral-700',
    brand: 'bg-[#1D5CAD] text-white',
    gold: 'bg-[#E8C547] text-[#0C1B2E]',
    navy: 'bg-[#0C1B2E] text-white',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-600',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
