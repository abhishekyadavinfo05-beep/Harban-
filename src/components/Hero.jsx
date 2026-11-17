import { BatteryCharging, Scissors, ShieldCheck, Zap } from 'lucide-react'
import heroDesktopImg from '../assets/images/harban_sharp_hero_1794743127899.jpg'
import heroMobileImg from '../assets/images/harban_sharp_hero_mobile_1794743277598.jpg'
import { useShop } from '../store/shop'

const FEATURES = [
  { icon: Scissors, label: 'Precision Blades' },
  { icon: BatteryCharging, label: 'Long Battery Life' },
  { icon: ShieldCheck, label: 'Skin Friendly' },
  { icon: Zap, label: 'USB Charging' },
]

export default function Hero() {
  const { go } = useShop()

  return (
    <section
      className="relative overflow-hidden bg-[#01050B] text-white flex flex-col"
      aria-label="HARBAN Grooming Studio — Sharp Precision"
    >
      {/* Main clickable studio banner */}
      <button
        type="button"
        onClick={() => go('trimmers')}
        aria-label="Explore HARBAN Precision Trimmers"
        className="group relative block w-full aspect-[4/3] sm:aspect-[16/9] sm:max-h-[600px] overflow-hidden text-left bg-[#01050B] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4D8EF7]"
      >
        {/* Mobile 4:3 studio composition matching reference proportions */}
        <img
          src={heroMobileImg}
          alt="HARBAN Grooming Studio precision trimmer in front of SHARP typography"
          referrerPolicy="no-referrer"
          className="sm:hidden absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.02]"
        />

        {/* Desktop 16:9 widescreen composition */}
        <img
          src={heroDesktopImg}
          alt="HARBAN Grooming Studio precision trimmer in front of SHARP typography"
          referrerPolicy="no-referrer"
          className="hidden sm:block absolute inset-0 w-full h-full object-contain object-center transition-transform duration-700 ease-out group-hover:scale-[1.02]"
          style={{
            WebkitMaskImage:
              'linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%)',
            maskImage:
              'linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%)',
          }}
        />
      </button>

      {/* Bottom feature strip */}
      <div className="relative z-20 border-t border-white/10 bg-[#050B16]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3.5 sm:py-4 grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-4 text-[12px] sm:text-[13.5px] font-medium text-white/90">
          {FEATURES.map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-2.5 sm:justify-center">
              <Icon size={17} className="text-[#4D8EF7] shrink-0" />
              <span className="truncate">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
