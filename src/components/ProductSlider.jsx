import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ProductCard from './ProductCard'

/* Horizontal product carousel: GPU-accelerated smooth sliding track with
   seamless infinite loop, touch swipe, arrow controls and pagination dots. */
const AUTOPLAY_MS = 2200
const RESUME_AFTER_MS = 4000

export default function ProductSlider({ products, title, sub, action }) {
  const trackRef = useRef(null)
  const touchStartX = useRef(null)
  const cooldownTimer = useRef(null)

  const total = products.length
  const cloneCount = total > 1 ? Math.min(5, total) : 0
  const slides =
    cloneCount > 0 ? [...products, ...products.slice(0, cloneCount)] : products

  const [step, setStep] = useState(0)
  const [index, setIndex] = useState(0)
  const [animate, setAnimate] = useState(true)
  const [cooldown, setCooldown] = useState(false)

  /* Measure exact card width + responsive gap */
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = () => {
      const first = track.children[0]
      const second = track.children[1]
      if (!first) return
      if (second) {
        setStep(
          second.getBoundingClientRect().left -
            first.getBoundingClientRect().left,
        )
      } else {
        const gap = parseFloat(getComputedStyle(track).columnGap || '0') || 0
        setStep(first.getBoundingClientRect().width + gap)
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [products.length])

  const holdAutoplay = () => {
    setCooldown(true)
    if (cooldownTimer.current) window.clearTimeout(cooldownTimer.current)
    cooldownTimer.current = window.setTimeout(() => {
      setCooldown(false)
    }, RESUME_AFTER_MS)
  }

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) window.clearTimeout(cooldownTimer.current)
    }
  }, [])

  /* Smoothly slide forward one product card every 2.2s */
  useEffect(() => {
    if (cooldown || !step || total < 2) return
    const t = window.setInterval(() => {
      setAnimate(true)
      setIndex((i) => (i >= total ? 1 : i + 1))
    }, AUTOPLAY_MS)
    return () => window.clearInterval(t)
  }, [cooldown, step, total])

  /* Invisibly snap from clone seam back to index 0 after glide finishes */
  const handleTransitionEnd = (e) => {
    if (e.target !== trackRef.current || e.propertyName !== 'transform') return
    if (index >= total) {
      setAnimate(false)
      setIndex(0)
    }
  }

  /* Re-enable transition on the frame after an invisible seam reset */
  useEffect(() => {
    if (animate) return
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimate(true))
    })
    return () => cancelAnimationFrame(raf)
  }, [animate])

  const goTo = (nextIdx) => {
    if (total < 2) return
    holdAutoplay()
    setAnimate(true)
    if (nextIdx < 0) {
      setIndex(total - 1)
    } else if (nextIdx >= total) {
      setIndex(total)
    } else {
      setIndex(nextIdx)
    }
  }

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) {
      goTo(dx < 0 ? index + 1 : index - 1)
    }
    touchStartX.current = null
  }

  const activeDot = total > 0 ? index % total : 0

  return (
    <section className="max-w-7xl mx-auto px-4 mt-10">
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <h2 className="font-display font-extrabold text-[20px] sm:text-[24px] tracking-tight">
            {title}
          </h2>
          {sub && <p className="text-[13px] text-neutral-500 mt-0.5">{sub}</p>}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {action}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => goTo(activeDot - 1)}
              aria-label="Previous products"
              className="grid place-items-center w-9 h-9 rounded-full bg-white border border-black/10 hover:border-[#1D5CAD] hover:text-[#1D5CAD] transition"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => goTo(activeDot + 1)}
              aria-label="Next products"
              className="grid place-items-center w-9 h-9 rounded-full bg-white border border-black/10 hover:border-[#1D5CAD] hover:text-[#1D5CAD] transition"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* viewport + GPU-animated track */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="overflow-hidden py-1 -my-1"
      >
        <div
          ref={trackRef}
          onTransitionEnd={handleTransitionEnd}
          style={{
            transform: `translate3d(-${index * step}px, 0, 0)`,
            transition: animate
              ? 'transform 680ms cubic-bezier(0.22, 1, 0.36, 1)'
              : 'none',
          }}
          className="flex items-stretch gap-2.5 will-change-transform"
        >
          {slides.map((p, idx) => (
            <div
              key={`${p.id}-${idx}`}
              className="shrink-0 flex w-[48%] sm:w-[calc((100%-1.25rem)/3)] lg:w-[calc((100%-2.5rem)/5)]"
            >
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>

      {/* dots */}
      <div className="flex justify-center gap-2 mt-3.5">
        {products.map((p, i) => (
          <button
            key={p.id}
            onClick={() => goTo(i)}
            aria-label={`Go to product ${i + 1}`}
            aria-current={i === activeDot || undefined}
            className={`h-[6px] rounded-full transition-all duration-500 ${
              i === activeDot
                ? 'w-6 bg-[#1D5CAD]'
                : 'w-[6px] bg-neutral-300 hover:bg-neutral-400'
            }`}
          />
        ))}
      </div>
    </section>
  )
}
