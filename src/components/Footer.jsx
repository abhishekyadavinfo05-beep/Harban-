import { useState } from 'react'
import {
  ArrowRight,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Plus,
  Twitter,
  Youtube,
} from 'lucide-react'
import { useShop } from '../store/shop'

/* ------------------------------------------------------------------ FAQ */

export function Faq() {
  const [open, setOpen] = useState(0)
  const { pushToast, faqs, storeSettings } = useShop()

  return (
    <section className="max-w-7xl mx-auto px-4 mt-10">
      <h2 className="font-display font-extrabold text-[20px] sm:text-[24px] tracking-tight mb-3">
        Frequently asked questions
      </h2>

      <div className="space-y-2">
        {faqs.map((f, i) => (
          <div
            key={f.q}
            className={`bg-white rounded-xl border overflow-hidden transition ${
              open === i ? 'border-[#1D5CAD]/60' : 'border-black/5'
            }`}
          >
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              className="w-full flex items-center justify-between gap-3 text-left px-5 py-4 font-bold text-[14px]"
            >
              {f.q}
              <span
                className={`w-7 h-7 rounded-full grid place-items-center shrink-0 transition ${
                  open === i
                    ? 'bg-[#1D5CAD] text-white rotate-45'
                    : 'bg-neutral-100'
                }`}
              >
                <Plus size={15} />
              </span>
            </button>
            {open === i && (
              <p className="px-5 pb-4 text-[13.5px] text-neutral-600 leading-relaxed animate-fade-up">
                {f.a}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="bg-[#0C1B2E] text-white rounded-2xl p-6 sm:p-7 mt-8">
        <div className="grid md:grid-cols-[1fr_auto] gap-6 md:items-center">
          <div>
            <h3 className="font-display font-extrabold text-lg">
              Help &amp; Support
            </h3>
            <div className="flex flex-wrap gap-x-8 gap-y-2.5 mt-4 text-[13.5px]">
              <p className="flex items-center gap-2.5 text-white/80">
                <Phone size={15} className="text-[#E8C547]" />{' '}
                {storeSettings?.supportPhone || '+91 95551 37346'}
              </p>
              <p className="flex items-center gap-2.5 text-white/80">
                <Mail size={15} className="text-[#E8C547]" />{' '}
                {storeSettings?.supportEmail || 'harban.official@gmail.com'}
              </p>
              <p className="flex items-center gap-2.5 text-white/80">
                <MapPin size={15} className="text-[#E8C547]" /> Mumbai, India
              </p>
            </div>
            <p className="text-white/55 text-[12.5px] leading-relaxed mt-3">
              Mon–Sat, 10am–7pm IST. Live chat and WhatsApp support available.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[
              [Instagram, 'Instagram'],
              [Facebook, 'Facebook'],
              [Twitter, 'Twitter'],
              [Youtube, 'YouTube'],
            ].map(([Icon, name]) => (
              <button
                key={name}
                type="button"
                onClick={() => pushToast(`Follow @harban.in on ${name}`)}
                aria-label={`HARBAN on ${name}`}
                className="grid place-items-center w-10 h-10 rounded-full bg-white/10 hover:bg-[#1D5CAD] transition cursor-pointer"
              >
                <Icon size={17} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ newsletter */

export function Newsletter() {
  const [email, setEmail] = useState('')
  const { pushToast, subscribeNewsletter } = useShop()

  const submit = async (e) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      pushToast('Enter a valid email to subscribe')
      return
    }
    const res = await subscribeNewsletter(email)
    if (!res.ok) {
      pushToast(res.error || 'Enter a valid email to subscribe')
      return
    }
    pushToast('Subscribed! Grooming tips incoming.')
    setEmail('')
  }

  return (
    <section className="max-w-7xl mx-auto px-4 mt-10">
      <div className="bg-[#1152D4] rounded-[22px] px-5 py-7 sm:px-9 sm:py-8 shadow-[0_14px_34px_-10px_rgba(17,82,212,0.45)] grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-5 sm:gap-6 items-center overflow-hidden">
        <div className="min-w-0">
          <h3 className="font-display font-black text-white text-[20px] sm:text-[26px] leading-tight tracking-tight">
            Subscribe to Our Newsletter
          </h3>
          <p className="text-white/90 text-[13px] sm:text-[14px] mt-1.5 leading-snug">
            Get the latest updates, offers and grooming tips.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="min-w-0 flex items-center bg-white rounded-full p-1.5 shadow-sm w-full max-w-full md:max-w-[440px] md:ml-auto focus-within:ring-2 focus-within:ring-white/60 transition"
        >
          <input
            type="text"
            inputMode="email"
            size={1}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            aria-label="Email address"
            className="w-0 flex-1 min-w-0 bg-transparent pl-3.5 sm:pl-4 pr-2 py-2 text-[13px] sm:text-[14px] text-[#0B1528] outline-none placeholder:text-neutral-400"
          />
          <button
            type="submit"
            className="shrink-0 bg-[#0B1528] hover:bg-black text-white text-[12.5px] sm:text-[13.5px] font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-full transition inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer"
          >
            Subscribe <ArrowRight size={15} className="shrink-0" />
          </button>
        </form>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- footer */

export function Footer() {
  const { go } = useShop()

  const columns = [
    {
      title: 'Shop',
      links: [
        ['Beard Trimmers', 'beard'],
        ['Body Trimmers', 'body'],
        ['Nose & Ear', 'nose'],
        ['Accessories & Care', 'accessories'],
      ],
    },
    {
      title: 'Quick Links',
      links: [
        ['My Account', 'account'],
        ['My Order', 'account-orders'],
        ['Help & Support', 'support'],
        ['Contact Us', 'contact'],
      ],
    },
  ]

  const policies = [
    ['Shipping Policy', 'policy:shipping'],
    ['Return & Refund Policy', 'policy:returns'],
    ['Privacy Policy', 'policy:privacy'],
    ['Terms & Conditions', 'policy:terms'],
  ]

  return (
    <footer className="bg-[#0C1B2E] text-white mt-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 grid gap-5 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <p className="font-display font-black text-[18px] tracking-[0.18em]">
            HARBAN
          </p>
          <p className="text-[11.5px] text-white/60 leading-snug mt-1.5 max-w-xs">
            Modern grooming essentials for men who value style and precision.
          </p>
          <p className="text-[11.5px] text-white/55 leading-snug mt-2 max-w-xs">
            Designed in-house in India and tested for daily use, with free
            shipping and 7-day easy returns on every order.
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <p className="font-bold text-[12.5px] mb-1.5">{col.title}</p>
            {/* two links per row so the whole column stays short */}
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {col.links.map(([label, target]) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => {
                      if (target === 'account-orders') {
                        go('account')
                        window.dispatchEvent(
                          new CustomEvent('harban:account-tab', { detail: 'orders' }),
                        )
                      } else {
                        go(target)
                      }
                    }}
                    className="py-1 text-[12px] sm:text-[11.5px] text-white/65 hover:text-white transition text-left cursor-pointer"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-white/50">
            © {new Date().getFullYear()} Harban. All rights reserved.
          </p>

          {/* accepted payment methods */}
          <div className="flex flex-wrap items-center justify-center gap-1">
            {['UPI', 'Visa', 'Mastercard', 'RuPay', 'COD'].map((m) => (
              <span
                key={m}
                className="text-[10px] font-bold bg-white/10 rounded px-1.5 py-0.5 text-white/70"
              >
                {m}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {policies.map(([label, target]) => (
              <button
                key={label}
                type="button"
                onClick={() => go(target)}
                className="text-[10.5px] text-white/50 hover:text-white transition cursor-pointer"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

/* --------------------------------------------------- generic page shell */

export function PageHeader({ title, sub }) {
  return (
    <section className="bg-[#0C1B2E] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
        <h1 className="font-display font-black text-[26px] sm:text-[34px] tracking-tight">
          {title}
        </h1>
        {sub && <p className="text-white/65 text-[13.5px] mt-1.5">{sub}</p>}
      </div>
    </section>
  )
}
