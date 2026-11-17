import { useState } from 'react'
import { Mail, MapPin, Phone, Send } from 'lucide-react'
import Header from './components/Header'
import Hero from './components/Hero'
import { Banners, CategoryTiles, Story, TrustBar } from './components/Sections'
import { Reviews, TrustMarquee } from './components/Trust'
import { Faq, Footer, Newsletter, PageHeader } from './components/Footer'
import {
  CartDrawer,
  OrderConfirmed,
  QuickView,
  ShopPage,
  Toasts,
  TrackOrder,
} from './components/Drawers'
import ProductPage from './components/ProductPage'
import ProductSlider from './components/ProductSlider'
import AccountPage from './components/AccountPage'
import AdminPanel from './components/AdminPanel'
import { ProductRow } from './components/ProductCard'
import { useShop } from './store/shop'

function HomePage() {
  const { go, products } = useShop()
  /* featured products first, then best-reviewed trimmers and groomers */
  const bestsellers = [...products]
    .filter((p) => p.category !== 'accessories')
    .sort(
      (a, b) =>
        (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0) || b.reviews - a.reviews,
    )
    .slice(0, 6)

  /* second product rail, shown above the reviews */
  const topRated = [...products]
    .filter((p) => p.category !== 'accessories')
    .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)

  return (
    <>
      <Hero />
      <TrustBar />

      <CategoryTiles />

      <section className="max-w-7xl mx-auto px-4 mt-4">
        <div className="flex items-end justify-between gap-4 mb-3">
          <div>
            <h2 className="font-display font-extrabold text-[20px] sm:text-[24px] tracking-tight">
              Most Popular
            </h2>
            <p className="text-[13px] text-neutral-500 mt-0.5">
              The trimmers India keeps reordering.
            </p>
          </div>
          <button
            onClick={() => go('trimmers')}
            className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1D5CAD] hover:gap-2.5 transition-all"
          >
            View All Trimmers →
          </button>
        </div>
        <ProductRow products={bestsellers} columns={6} />
        <button
          onClick={() => go('trimmers')}
          className="sm:hidden mt-4 w-full py-3 rounded-xl bg-[#0C1B2E] text-white text-sm font-bold"
        >
          View All Trimmers
        </button>
      </section>

      <Banners />

      {/* sliding product rail, directly above the reviews */}
      <ProductSlider
        products={topRated}
        title="Top Rated"
        sub="Highest rated by verified buyers."
        action={
          <button
            onClick={() => go('trimmers')}
            className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1D5CAD] hover:gap-2.5 transition-all"
          >
            View All Trimmers →
          </button>
        }
      />

      <Reviews />
      <Faq />
      <Newsletter />
    </>
  )
}

function SupportPage() {
  return (
    <>
      <PageHeader
        title="Help & Support"
        sub="Answers, warranty and everything after the sale."
      />
      <Faq />
    </>
  )
}

function StoryPage() {
  return (
    <>
      <PageHeader
        title="Our Story"
        sub="Built for modern men who value style, confidence and precision."
      />
      <Story />
      <Reviews />
      <Newsletter />
    </>
  )
}

function ContactPage() {
  const { pushToast, setTrackOpen, sendContactMessage } = useShop()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email) || !message.trim()) {
      pushToast('Please fill in your name, email and message')
      return
    }
    const res = await sendContactMessage({ name, email, message })
    if (!res.ok) {
      pushToast(res.error || 'Failed to send message')
      return
    }
    setSent(true)
    pushToast('Message sent! Our team will reply within 24 hours.')
    setName('')
    setEmail('')
    setMessage('')
  }

  return (
    <>
      <PageHeader
        title="Contact Us"
        sub="Talk to our Mumbai grooming support team — Mon–Sat, 10am–7pm IST."
      />
      <section className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-[0.9fr_1.1fr] gap-6 items-start">
        <div className="bg-[#0C1B2E] text-white rounded-2xl p-6 sm:p-7 space-y-5">
          <div>
            <h2 className="font-display font-extrabold text-xl">
              We&apos;re here to help
            </h2>
            <p className="text-white/65 text-[13.5px] mt-1.5 leading-relaxed">
              Questions about warranty claims, blade replacements, or an active
              order? Reach us directly on phone, email or WhatsApp.
            </p>
          </div>

          <div className="space-y-3 text-[13.5px]">
            <p className="flex items-center gap-3 text-white/85">
              <Phone size={16} className="text-[#E8C547] shrink-0" /> +91 98765 43210
            </p>
            <p className="flex items-center gap-3 text-white/85">
              <Mail size={16} className="text-[#E8C547] shrink-0" /> care@harban.in
            </p>
            <p className="flex items-center gap-3 text-white/85">
              <MapPin size={16} className="text-[#E8C547] shrink-0" /> Mumbai, Maharashtra, India
            </p>
          </div>

          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setTrackOpen(true)}
              className="bg-white/10 hover:bg-[#1D5CAD] text-white text-[13px] font-bold px-4 py-2.5 rounded-full transition"
            >
              Track an existing order
            </button>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="bg-white rounded-2xl border border-black/5 p-6 sm:p-7 space-y-4"
        >
          <h3 className="font-display font-extrabold text-lg">Send a message</h3>
          {sent && (
            <p className="text-[13px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
              Thanks for reaching out — we&apos;ve received your message and will reply to your email shortly.
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-neutral-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full bg-neutral-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
            />
          </div>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us how we can help..."
            className="w-full bg-neutral-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40 resize-none"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 bg-[#0C1B2E] hover:bg-[#1D5CAD] text-white text-[13.5px] font-bold px-6 py-3 rounded-full transition"
          >
            <Send size={15} /> Send Message
          </button>
        </form>
      </section>
    </>
  )
}

const POLICIES = {
  shipping: {
    title: 'Shipping Policy',
    sub: 'Free pan-India delivery on every HARBAN order.',
    points: [
      'All prepaid and Cash on Delivery (COD) orders are dispatched within 24 hours from our Mumbai fulfillment centre.',
      'Delivery takes 2–4 working days across metro cities and 4–7 working days across the rest of India.',
      'Shipping is 100% free on every order — no minimum cart value required.',
      'Real-time tracking details are sent via SMS and email as soon as your package leaves our warehouse.',
    ],
  },
  returns: {
    title: 'Return & Refund Policy',
    sub: '7-day easy returns and 1-year doorstep warranty.',
    points: [
      'Eligible products can be returned within 7 days of delivery in unused condition with original box and accessories.',
      'We schedule a free doorstep pickup across serviceable pin codes with zero return pickup charges.',
      'Prepaid refunds are processed within 3–5 business days back to your original payment method.',
      'Every HARBAN trimmer includes a 1-year doorstep warranty covering motor and battery defects.',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sub: 'How we protect your order and personal information.',
    points: [
      'We collect only the details needed to deliver your order, process warranty claims, and send order notifications.',
      'Payment details are processed over encrypted gateways — HARBAN never stores your card or UPI PIN data.',
      'You can unsubscribe from promotional emails or request deletion of your contact history at any time via care@harban.in.',
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    sub: 'Clear terms for shopping on HARBAN.',
    points: [
      'All prices displayed are inclusive of GST and include free shipping across India.',
      'Product images are for representation; actual accessories match the items listed in the "In the box" specification.',
      'Warranty coverage applies to purchases made through HARBAN official channels for residential personal grooming use.',
    ],
  },
}

function PolicyPage({ kind }) {
  const { go } = useShop()
  const active = POLICIES[kind] ?? POLICIES.shipping

  return (
    <>
      <PageHeader title={active.title} sub={active.sub} />
      <section className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-2 mb-5">
          {Object.entries(POLICIES).map(([key, item]) => (
            <button
              key={key}
              type="button"
              onClick={() => go(`policy:${key}`)}
              className={`text-[12.5px] font-bold px-4 py-2 rounded-full border transition ${
                (kind in POLICIES ? kind : 'shipping') === key
                  ? 'bg-[#0C1B2E] text-white border-[#0C1B2E]'
                  : 'bg-white border-black/10 hover:border-[#1D5CAD]'
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-black/5 p-6 sm:p-8 space-y-3.5">
          {active.points.map((pt) => (
            <p key={pt} className="text-[14px] text-neutral-700 leading-relaxed">
              • {pt}
            </p>
          ))}
        </div>
      </section>
    </>
  )
}

export default function App() {
  const { route, quickView, categories, products, user } = useShop()

  if (route === 'admin' && user?.role === 'admin') {
    return (
      <div className="min-h-screen bg-[#F1F1F1] overflow-x-clip">
        <AdminPanel />
        <Toasts />
      </div>
    )
  }

  const categoryMeta = categories.find((c) => c.id === route)

  let page
  if (route === 'all') {
    page = (
      <>
        <PageHeader
          title="All Products"
          sub="Precision trimmers, body groomers & care essentials."
        />
        <ShopPage key="all" preset="all" />
      </>
    )
  } else if (route === 'trimmers') {
    page = (
      <>
        <PageHeader
          title="Trimmers & Groomers"
          sub="Salon-grade precision for every routine."
        />
        <ShopPage key="trimmers" preset="trimmers" />
      </>
    )
  } else if (route === 'accessories') {
    page = (
      <>
        <PageHeader
          title="Accessories & Care"
          sub="Blades, kits and combs that keep the cut fresh."
        />
        <ShopPage key="accessories" preset="accessories" />
      </>
    )
  } else if (categoryMeta) {
    page = (
      <>
        <PageHeader
          title={categoryMeta.label}
          sub={categoryMeta.blurb}
        />
        <ShopPage key={categoryMeta.id} preset={categoryMeta.id} />
      </>
    )
  } else if (route === 'story') {
    page = <StoryPage />
  } else if (route === 'account') {
    page = <AccountPage />
  } else if (route === 'admin') {
    page = <AccountPage initialTab="admin" />
  } else if (route === 'support') {
    page = <SupportPage />
  } else if (route === 'contact') {
    page = <ContactPage />
  } else if (route?.startsWith('policy:')) {
    page = <PolicyPage kind={route.slice('policy:'.length)} />
  } else if (route === 'order-confirmed') {
    page = <OrderConfirmed />
  } else if (route?.startsWith('product:')) {
    const id = route.slice('product:'.length)
    const product = products.find((p) => p.id === id)
    page = product ? (
      <ProductPage product={product} />
    ) : (
      <PageHeader title="Product not found" />
    )
  } else {
    page = <HomePage />
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f7f9] overflow-x-clip">
      <Header />
      <main className="flex-1">{page}</main>
      <TrustMarquee />
      <Footer />

      <CartDrawer />
      {quickView && <QuickView />}
      <TrackOrder />
      <Toasts />
    </div>
  )
}
