import {
  ArrowRight,
  Check,
  Headphones,
  RotateCcw,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import Img from './Img'
import { SectionHead } from './ui'
import { useShop } from '../store/shop'

/* --------------------------------------------------------- trust strip */

const TRUST = [
  { icon: Truck, t: 'Free Shipping', s: 'On All Orders' },
  { icon: ShieldCheck, t: '1 Year Warranty', s: 'Peace of Mind' },
  { icon: RotateCcw, t: 'Easy Returns', s: 'Hassle Free' },
  { icon: Headphones, t: 'Dedicated Support', s: "We're Here to Help" },
]

export function TrustBar() {
  const repeatedTrust = [...TRUST, ...TRUST]

  /* the item list repeats inside each track with matching trailing padding
     so the two identical tracks loop continuously without a seam jump */
  const Track = ({ hidden = false }) => (
    <div
      className="flex items-center gap-3 pr-3 animate-marquee-slow shrink-0"
      aria-hidden={hidden || undefined}
    >
      {repeatedTrust.map(({ icon: Icon, t, s }, idx) => (
        <div
          key={`${t}-${idx}`}
          className="flex items-center gap-3 bg-[#E2E9F2] rounded-xl px-3.5 py-3.5 shrink-0 min-w-[210px]"
        >
          <Icon size={26} strokeWidth={1.6} className="shrink-0" />
          <div className="leading-tight min-w-0">
            <p className="font-bold text-[12px] sm:text-[13px] whitespace-nowrap">
              {t}
            </p>
            <p className="text-[11px] sm:text-[12px] text-neutral-500 whitespace-nowrap">
              {s}
            </p>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <section className="mt-3 overflow-hidden marquee-wrap">
      <div className="max-w-7xl mx-auto px-4 flex overflow-hidden select-none">
        <Track />
        <Track hidden />
      </div>
    </section>
  )
}

/* ------------------------------------------------- category tile strip */

export function CategoryTiles() {
  const { go, categories } = useShop()

  return (
    <section className="max-w-7xl mx-auto px-4 mt-5">
      <SectionHead
        title="Shop by Category"
        sub="Everything you need for a sharper routine."
      />

      {/* single horizontal row of circular icons — sized so all four fit on
          a phone without sideways scrolling */}
      <div className="flex items-start justify-between gap-2 sm:gap-6 overflow-x-auto no-scrollbar pb-1">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => go(c.id)}
            className="group flex flex-col items-center text-center shrink-0 flex-1 min-w-0 cursor-pointer"
          >
            <span className="block rounded-full p-[3px] bg-gradient-to-br from-[#1D5CAD]/40 via-[#E8C547]/40 to-[#1D5CAD]/30 transition group-hover:from-[#1D5CAD] group-hover:to-[#16467E]">
              <span className="block rounded-full overflow-hidden bg-neutral-100 ring-2 ring-white">
                <Img
                  src={c.image}
                  alt={c.label}
                  className="card-img w-[68px] h-[68px] sm:w-[96px] sm:h-[96px] lg:w-[124px] lg:h-[124px] object-cover"
                />
              </span>
            </span>

            <span className="mt-2 sm:mt-2.5 text-[11.5px] sm:text-[13px] lg:text-[14.5px] font-medium leading-snug transition group-hover:text-[#1D5CAD]">
              {c.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------- banner pair */

export function Banners() {
  const { go } = useShop()

  const items = [
    {
      image: '/images/banner-modern.jpg',
      kicker: 'BUILT FOR',
      title: 'MODERN MEN',
      sub: ['Premium Performance', 'At Your Fingertips'],
      cta: 'Explore Now',
      shade: 'from-black/85 via-black/40 to-transparent',
    },
    {
      image: '/images/banner-style.jpg',
      kicker: 'YOUR STYLE',
      title: 'OUR PRIORITY',
      sub: ['Complete Your Kit', 'Detail Finishing'],
      cta: 'All Accessories',
      shade: 'from-black/70 via-black/25 to-transparent',
      go: 'accessories',
    },
  ]

  return (
    <section className="max-w-7xl mx-auto px-4 mt-10 grid md:grid-cols-2 gap-3 sm:gap-4">
      {items.map((b) => (
        <button
          key={b.title}
          onClick={() => go(b.go ?? 'trimmers')}
          className="group relative overflow-hidden rounded-2xl text-left bg-[#0C1B2E]"
        >
          <img
            src={b.image}
            alt={b.title}
            className="card-img block w-full aspect-[16/10] sm:aspect-video object-cover"
          />
          <div
            className={`absolute inset-0 bg-gradient-to-r ${b.shade}`}
          />
          <div className="absolute inset-0 p-5 sm:p-8 flex flex-col justify-center max-w-[82%] sm:max-w-[75%]">
            <p className="font-display text-white/80 tracking-[0.2em] text-[13px] sm:text-lg font-light">
              {b.kicker}
            </p>
            <p className="font-display font-black text-white text-[22px] sm:text-[32px] leading-tight">
              {b.title}
            </p>
            <p className="text-white/75 text-[12px] sm:text-sm mt-1 sm:mt-1.5 leading-snug">
              {b.sub.map((s) => (
                <span key={s} className="block">
                  {s}
                </span>
              ))}
            </p>
            <span className="inline-flex items-center gap-2 mt-3 sm:mt-4 bg-white text-black text-[12.5px] sm:text-[13px] font-bold px-4 sm:px-5 py-2 sm:py-2.5 rounded-full group-hover:bg-[#1D5CAD] group-hover:text-white transition w-fit">
              {b.cta} <ArrowRight size={15} />
            </span>
          </div>
        </button>
      ))}
    </section>
  )
}

/* ------------------------------------------------------ brand story */

export function Story() {
  const { go } = useShop()

  const pillars = [
    {
      title: 'Built to last',
      body: 'All-metal drivetrains, titanium-coated blades and reinforced housings — tested for daily Indian grooming.',
    },
    {
      title: 'Precision first',
      body: 'Every model is tuned for zero-gap detailing, so lines stay crisp from the first pass to the last.',
    },
    {
      title: 'Skin friendly',
      body: 'Rounded tips, hypoallergenic foils and IPX-rated washable heads keep sensitive skin calm.',
    },
    {
      title: 'Peace of mind',
      body: 'Free shipping, a 1-year doorstep warranty and 7-day returns on every single order.',
    },
  ]

  return (
    <section className="max-w-7xl mx-auto px-4 mt-10">
      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-5 sm:gap-7 items-center">
        <div className="relative overflow-hidden rounded-2xl bg-[#0C1B2E]">
          <img
            src="/images/banner-style.jpg"
            alt="HARBAN grooming"
            className="block w-full aspect-video object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0C1B2E]/85 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6">
            <p className="font-display text-white/80 tracking-[0.2em] text-[15px] font-light">
              MORE THAN JUST
            </p>
            <p className="font-display font-black text-white text-[26px] sm:text-[32px] leading-tight">
              A <span className="text-[#E8C547]">TRIMMER.</span>
            </p>
          </div>
        </div>

        <div>
          <h2 className="font-display font-extrabold text-[22px] sm:text-[26px] tracking-tight">
            Sharp looks start with the right tool.
          </h2>
          <p className="text-[13.5px] sm:text-[14.5px] text-neutral-600 leading-relaxed mt-2.5">
            Harban is dedicated to modern grooming solutions for men who value
            style, confidence and precision. From the everyday HT100 to the
            flagship Elite, every product is designed in-house and supported by
            doorstep warranty across India.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            {pillars.map((p) => (
              <div
                key={p.title}
                className="bg-white rounded-xl border border-black/5 p-3.5"
              >
                <p className="text-[13px] font-bold flex items-center gap-1.5">
                  <Check size={14} className="text-[#1D5CAD]" />
                  {p.title}
                </p>
                <p className="text-[12px] text-neutral-600 leading-relaxed mt-1">
                  {p.body}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={() => go('story')}
            className="mt-5 inline-flex items-center gap-2 bg-[#1D5CAD] hover:bg-[#16467E] text-white text-[13px] font-bold px-5 py-2.5 rounded-full transition"
          >
            Read Our Story <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </section>
  )
}
