import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { SectionHead, Stars } from './ui'
import { useShop } from '../store/shop'

/* ----------------------------------------------- scrolling stat strip */

export function TrustMarquee() {
  const { marqueeStats } = useShop()
  const repeatedStats = [
    ...marqueeStats,
    ...marqueeStats,
    ...marqueeStats,
    ...marqueeStats,
  ]

  const Track = ({ hidden = false }) => (
    <div
      className="flex items-center gap-10 pr-10 animate-marquee shrink-0"
      aria-hidden={hidden || undefined}
    >
      {repeatedStats.map(([value, label], idx) => (
        <div key={`${label}-${idx}`} className="text-center px-1 leading-tight shrink-0">
          <p className="font-display font-black text-[17px] text-[#E8C547] leading-none whitespace-nowrap">
            {value}
          </p>
          <p className="text-[11px] text-white/60 font-semibold whitespace-nowrap mt-0.5">
            {label}
          </p>
        </div>
      ))}
    </div>
  )

  return (
    <section className="bg-[#0C1B2E] text-white overflow-hidden mt-8">
      <div className="max-w-7xl mx-auto py-3 flex overflow-hidden marquee-wrap select-none">
        <Track />
        <Track hidden />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ reviews */

const AUTOPLAY_MS = 2000
const RESUME_AFTER_MS = 4000

export function Reviews() {
  const { testimonials } = useShop()
  const trackRef = useRef(null)
  const touchStartX = useRef(null)
  const cooldownTimer = useRef(null)

  const total = testimonials.length
  /* Append the first 3 cards at the end so the 3-column desktop track
     glides forward continuously and resets invisibly at the seam. */
  const slides = [...testimonials, ...testimonials.slice(0, 3)]

  const [step, setStep] = useState(0)
  const [index, setIndex] = useState(0)
  const [animate, setAnimate] = useState(true)
  const [cooldown, setCooldown] = useState(false)

  /* Measure exact distance between consecutive cards (width + responsive gap) */
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = () => {
      const first = track.children[0]
      const second = track.children[1]
      if (!first) return
      if (second) {
        setStep(second.getBoundingClientRect().left - first.getBoundingClientRect().left)
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
  }, [])

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

  /* Advance smoothly by 1 card every 2 seconds */
  useEffect(() => {
    if (cooldown || !step || total < 2) return
    const t = window.setInterval(() => {
      setAnimate(true)
      setIndex((i) => (i >= total ? 1 : i + 1))
    }, AUTOPLAY_MS)
    return () => window.clearInterval(t)
  }, [cooldown, step, total])

  /* When the seamless clone at `index === total` finishes gliding into place,
     snap instantaneously back to `index = 0` without transition. */
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

  const activeDot = index % total

  return (
    <section className="max-w-7xl mx-auto px-4 mt-10">
      <SectionHead
        title="Loved Across India"
        sub="4.7 average from 3,700+ verified reviews."
        action={
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button
              onClick={() => goTo(activeDot - 1)}
              aria-label="Previous reviews"
              className="grid place-items-center w-9 h-9 rounded-full bg-white border border-black/10 hover:border-[#1D5CAD] hover:text-[#1D5CAD] transition"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => goTo(activeDot + 1)}
              aria-label="Next reviews"
              className="grid place-items-center w-9 h-9 rounded-full bg-white border border-black/10 hover:border-[#1D5CAD] hover:text-[#1D5CAD] transition"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        }
      />

      {/* viewport + GPU-animated track sliding smoothly every 2s */}
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
          className="flex items-stretch gap-3 sm:gap-4 will-change-transform"
        >
          {slides.map((r, idx) => (
            <div
              key={`${r.n}-${idx}`}
              className="shrink-0 flex w-[85%] sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]"
            >
              <div
                className={`w-full bg-white rounded-2xl p-4 sm:p-5 border flex flex-col transition-all duration-500 hover:shadow-[0_12px_30px_-18px_rgba(12,27,46,0.28)] ${
                  idx % total === activeDot
                    ? 'border-[#1D5CAD]/25 shadow-[0_8px_24px_-18px_rgba(29,92,173,0.45)]'
                    : 'border-black/5'
                }`}
              >
                <Stars rating={5} size={14} />
                <p className="text-[13.5px] text-neutral-700 leading-relaxed mt-2.5">
                  &ldquo;{r.t}&rdquo;
                </p>
                <p className="text-[12.5px] font-bold mt-auto pt-3">
                  {r.n}{' '}
                  <span className="font-normal text-neutral-400">· {r.c}</span>
                </p>
                <p className="text-[11.5px] font-bold text-[#174A8B] flex items-center gap-1 mt-0.5">
                  <BadgeCheck size={13} /> Verified buyer · {r.p}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* dots */}
      <div className="flex justify-center gap-2 mt-3.5">
        {testimonials.map((r, i) => (
          <button
            key={r.n}
            onClick={() => goTo(i)}
            aria-label={`Go to review ${i + 1}`}
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
