import { useEffect, useState } from 'react'
import {
  Check,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  User,
  X,
} from 'lucide-react'
import Img from './Img'
import ProductCard, { ProductRow } from './ProductCard'
import { SectionHead, Stars } from './ui'
import {
  ORDER_STAGES,
  discountOf,
  formatINR,
  useShop,
} from '../store/shop'
import { matchesSearch } from '../lib/search'

/* -------------------------------------------------------- cart drawer */

export function CartDrawer() {
  const {
    cart,
    cartOpen,
    setCartOpen,
    setQty,
    removeFromCart,
    trackCheckoutStarted,
    subtotal,
    go,
  } = useShop()

  if (!cartOpen) return null

  const freeShipTarget = 1500
  const progress = Math.min(100, (subtotal / freeShipTarget) * 100)

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={() => setCartOpen(false)}
      />
      <aside className="absolute right-0 top-0 bottom-0 w-full max-w-[420px] bg-white flex flex-col shadow-2xl animate-drawer-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <p className="font-display font-extrabold text-lg flex items-center gap-2">
            <ShoppingCart size={18} /> Your Cart
            <span className="text-xs font-bold bg-neutral-100 rounded-full px-2 py-0.5 tabular-nums">
              {cart.length}
            </span>
          </p>
          <button
            onClick={() => setCartOpen(false)}
            className="grid place-items-center w-8 h-8 rounded-full hover:bg-neutral-100 transition cursor-pointer"
            aria-label="Close cart"
          >
            <X size={18} />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 grid place-items-center text-center px-6">
            <div>
              <div className="w-16 h-16 mx-auto rounded-full bg-neutral-100 grid place-items-center">
                <ShoppingCart size={24} className="text-neutral-400" />
              </div>
              <p className="font-display font-extrabold text-lg mt-4">
                Your cart is empty
              </p>
              <p className="text-sm text-neutral-500 mt-1">
                Sharp looks start with the right tool.
              </p>
              <button
                onClick={() => setCartOpen(false)}
                className="mt-4 bg-[#0C1B2E] text-white text-sm font-bold px-6 py-2.5 rounded-full hover:bg-black transition cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 pt-3">
              <p className="text-[12px] text-neutral-600">
                {subtotal >= freeShipTarget ? (
                  <span className="font-bold text-emerald-600">
                    You have unlocked FREE shipping
                  </span>
                ) : (
                  <>
                    Add{' '}
                    <span className="font-bold tabular-nums">
                      {formatINR(freeShipTarget - subtotal)}
                    </span>{' '}
                    more for FREE shipping
                  </>
                )}
              </p>
              <div className="h-1.5 bg-neutral-100 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-[#1D5CAD] rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-3 bg-neutral-50 rounded-xl p-3">
                  <button
                    type="button"
                    onClick={() => go(`product:${item.id}`)}
                    className="shrink-0 cursor-pointer"
                  >
                    <Img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => go(`product:${item.id}`)}
                      className="font-bold text-[13.5px] leading-tight truncate block w-full text-left hover:text-[#1D5CAD] transition cursor-pointer"
                    >
                      {item.name}
                    </button>
                    <p className="text-[12.5px] text-neutral-500 mt-0.5 tabular-nums">
                      {formatINR(item.price)}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="inline-flex items-center gap-1 bg-white rounded-full border border-black/10 px-1">
                        <button
                          onClick={() => setQty(item.id, item.qty - 1)}
                          className="grid place-items-center w-6 h-6 rounded-full hover:bg-neutral-100 cursor-pointer"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-[13px] font-bold w-4 text-center tabular-nums">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => setQty(item.id, item.qty + 1)}
                          className="grid place-items-center w-6 h-6 rounded-full hover:bg-neutral-100 cursor-pointer"
                          aria-label="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[14px] tabular-nums">
                          {formatINR(item.price * item.qty)}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-neutral-400 hover:text-red-500 transition cursor-pointer"
                          aria-label={`Remove ${item.name}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-black/5 px-5 py-4">
              <div className="flex justify-between text-[13.5px]">
                <span className="text-neutral-600">Subtotal</span>
                <span className="font-bold tabular-nums">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[13.5px] mt-1">
                <span className="text-neutral-600">Shipping</span>
                <span className="font-bold text-[#174A8B]">FREE</span>
              </div>
              <div className="flex justify-between font-display font-black text-lg mt-2 pt-2 border-t border-black/5">
                <span>Total</span>
                <span className="tabular-nums">{formatINR(subtotal)}</span>
              </div>
              <button
                onClick={() => {
                  trackCheckoutStarted()
                  go('checkout')
                }}
                className="mt-3 w-full bg-[#0C1B2E] hover:bg-[#1D5CAD] text-white font-bold text-[14px] py-3 rounded-xl transition cursor-pointer"
              >
                Proceed to Checkout
              </button>
              <div className="flex items-center justify-center gap-4 mt-2.5 text-[11.5px] text-neutral-500">
                <span className="flex items-center gap-1">
                  <Check size={12} /> Cash on Delivery
                </span>
                <span className="flex items-center gap-1">
                  <Check size={12} /> 7-Day Returns
                </span>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

/* --------------------------------------------------------- quick view */

export function QuickView() {
  const { quickView, setQuickView, addToCart, buyNow } = useShop()
  const [active, setActive] = useState(0)
  const [qty, setQty] = useState(1)
  const [variantIdx, setVariantIdx] = useState(0)

  if (!quickView) return null
  const p = quickView
  const variants = Array.isArray(p.variants)
    ? p.variants.filter((v) => v.isActive !== false)
    : []
  const selectedVariant = variants[variantIdx] || null
  const activePrice = selectedVariant ? Number(selectedVariant.price ?? p.price) : p.price
  const activeMrp = selectedVariant && Number(selectedVariant.mrp) > 0 ? Number(selectedVariant.mrp) : p.mrp
  const activeStock = selectedVariant
    ? typeof selectedVariant.stock === 'number'
      ? selectedVariant.stock
      : p.stock
    : p.stock
  const off = activeMrp > activePrice ? Math.round(((activeMrp - activePrice) / activeMrp) * 100) : discountOf(p)

  const close = () => {
    setQuickView(null)
    setActive(0)
    setQty(1)
    setVariantIdx(0)
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={close}
      />
      <div className="relative bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto no-scrollbar animate-fade-up">
        <button
          onClick={close}
          className="absolute top-3 right-3 z-10 grid place-items-center w-9 h-9 rounded-full bg-white/95 shadow hover:bg-neutral-100 transition"
          aria-label="Close quick view"
        >
          <X size={18} />
        </button>

        <div className="grid md:grid-cols-2 gap-5 p-5 sm:p-6">
          <div>
            <div className="rounded-xl overflow-hidden bg-neutral-50">
              <Img
                src={p.images[active] || p.image}
                alt={p.name}
                className="w-full h-[230px] sm:h-[300px] object-cover"
              />
            </div>
            {p.images.length > 1 && (
              <div className="flex gap-2 mt-2.5 overflow-x-auto no-scrollbar">
                {p.images.map((src, i) => (
                  <button
                    key={`${src}-${i}`}
                    onClick={() => setActive(i)}
                    className={`shrink-0 rounded-lg overflow-hidden border-2 transition ${
                      active === i ? 'border-[#1D5CAD]' : 'border-transparent'
                    }`}
                  >
                    <Img
                      src={src}
                      alt={`${p.name} view ${i + 1}`}
                      className="w-14 h-14 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              {p.badge && (
                <span className="bg-[#0C1B2E] text-white text-[10.5px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1">
                  {p.badge}
                </span>
              )}
              {off > 0 && (
                <span className="bg-[#E8C547] text-[#0C1B2E] text-[10.5px] font-black uppercase tracking-wider rounded-full px-2.5 py-1">
                  {off}% off
                </span>
              )}
            </div>

            <h2 className="font-display font-black text-[22px] leading-tight mt-2">
              {p.name}
            </h2>
            <p className="text-[12.5px] text-neutral-500">{p.tagline}</p>

            <div className="flex items-center gap-1.5 mt-2">
              <Stars rating={p.rating} size={13} />
              <span className="text-[11.5px] font-semibold text-neutral-500">
                {p.rating} · {p.reviews.toLocaleString('en-IN')} reviews
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-3">
              <span className="font-display font-black text-[24px] tabular-nums">
                {formatINR(activePrice)}
              </span>
              <span className="text-[14px] text-neutral-400 line-through tabular-nums">
                {formatINR(activeMrp)}
              </span>
            </div>

            {variants.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                  Variant
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {variants.map((v, idx) => {
                    const label =
                      v.label || [v.size, v.color].filter(Boolean).join(' · ') || `Option ${idx + 1}`
                    return (
                      <button
                        key={v.id || `${label}-${idx}`}
                        type="button"
                        onClick={() => setVariantIdx(idx)}
                        className={`px-3 py-1.5 rounded-lg border text-[12px] font-bold transition cursor-pointer ${
                          variantIdx === idx
                            ? 'bg-[#0C1B2E] text-white border-[#0C1B2E]'
                            : 'bg-neutral-50 text-neutral-700 border-black/10 hover:border-[#1D5CAD]'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <p className="text-[13px] text-neutral-600 leading-relaxed mt-3">
              {p.description}
            </p>

            <ul className="space-y-1.5 mt-3.5">
              {p.features.slice(0, 4).map((f) => (
                <li key={f} className="text-[12.5px] text-neutral-700 flex gap-2">
                  <Check size={14} className="text-[#1D5CAD] shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 mt-5">
              <div className="inline-flex items-center gap-1 bg-neutral-100 rounded-full px-2 py-1.5">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="grid place-items-center w-7 h-7 rounded-full bg-white"
                  aria-label="Decrease quantity"
                >
                  <Minus size={13} />
                </button>
                <span className="font-bold w-6 text-center text-[14px] tabular-nums">{qty}</span>
                <button
                  onClick={() =>
                    setQty(
                      Math.min(typeof activeStock === 'number' ? Math.max(1, activeStock) : 99, qty + 1),
                    )
                  }
                  className="grid place-items-center w-7 h-7 rounded-full bg-white"
                  aria-label="Increase quantity"
                >
                  <Plus size={13} />
                </button>
              </div>
              <button
                disabled={activeStock === 0}
                onClick={() => {
                  addToCart(p, qty, 'add_to_cart', selectedVariant)
                  close()
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#0C1B2E] hover:bg-[#1D5CAD] disabled:bg-neutral-300 disabled:text-neutral-600 text-white text-[13.5px] font-bold py-3 rounded-xl transition"
              >
                <ShoppingCart size={16} />{' '}
                {activeStock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>

            <button
              disabled={activeStock === 0}
              onClick={() => {
                buyNow(p, qty, selectedVariant)
                close()
              }}
              className="mt-2 w-full bg-[#1D5CAD] hover:bg-[#16467E] disabled:opacity-50 text-white text-[13.5px] font-bold py-3 rounded-xl transition"
            >
              Buy Now
            </button>

            {p.meeshoUrl && (
              <a
                href={
                  /^https?:\/\//i.test(p.meeshoUrl.trim())
                    ? p.meeshoUrl.trim()
                    : `https://${p.meeshoUrl.trim().replace(/^\/+/, '')}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 w-full inline-flex items-center justify-center border border-black/15 hover:border-[#1D5CAD] text-[#0C1B2E] text-[13px] font-bold py-2.5 rounded-xl transition"
              >
                Buy on Meesho →
              </a>
            )}

            <div className="grid grid-cols-2 gap-2 mt-4">
              {p.specs
                .filter(
                  (s) =>
                    !['seo title', 'seo description', 'tags'].includes(
                      String(s.label || '').trim().toLowerCase(),
                    ),
                )
                .slice(0, 4)
                .map((s) => (
                  <div key={s.label} className="bg-neutral-50 rounded-lg px-3 py-2">
                    <p className="text-[10.5px] uppercase tracking-wider text-neutral-500 font-bold">
                      {s.label}
                    </p>
                    <p className="text-[12px] font-semibold">{s.value}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------ order tracker */

export function TrackOrder() {
  const {
    trackOpen,
    setTrackOpen,
    lastOrder,
    orders,
    trackOrderByCode,
    go,
  } = useShop()
  const [query, setQuery] = useState('')
  const [found, setFound] = useState(null)
  const [searching, setSearching] = useState(false)

  if (!trackOpen) return null

  const activeOrder =
    found && typeof found === 'object' ? found : !found ? lastOrder : null

  const search = async (e) => {
    e.preventDefault()
    const q = query.trim().toUpperCase()
    if (!q || searching) return
    setSearching(true)
    try {
      const remoteMatch = await trackOrderByCode(q)
      const localMatch =
        remoteMatch ??
        orders.find((o) => o.id.toUpperCase() === q) ??
        null
      setFound(localMatch ?? 'none')
    } finally {
      setSearching(false)
    }
  }

  const stage = activeOrder ? activeOrder.status : 0

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setTrackOpen(false)}
      />
      <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar p-6 animate-fade-up">
        <button
          onClick={() => setTrackOpen(false)}
          className="absolute top-3 right-3 grid place-items-center w-8 h-8 rounded-full hover:bg-neutral-100 transition"
          aria-label="Close"
        >
          <X size={17} />
        </button>

        <h2 className="font-display font-extrabold text-xl">My Order &amp; Tracking</h2>
        <p className="text-[12.5px] text-neutral-500 mt-1">
          Enter the Order ID from your confirmation email or view your recent order below.
        </p>

        <form onSubmit={search} className="flex gap-2 mt-4">
          <input
            size={1}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="HB100"
            className="w-0 flex-1 min-w-0 bg-neutral-100 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
          />
          <button
            type="submit"
            disabled={searching}
            className="shrink-0 bg-[#0C1B2E] hover:bg-[#1D5CAD] disabled:opacity-60 text-white text-[13px] font-bold px-4 sm:px-5 rounded-full transition inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Search size={14} /> {searching ? 'Tracking...' : 'Track'}
          </button>
        </form>

        {found === 'none' && (
          <p className="text-[13px] text-red-500 mt-4">
            No order found for that ID. Check your confirmation email.
          </p>
        )}

        {activeOrder ? (
          <div className="mt-5">
            {orders.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {orders.slice(0, 4).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setFound(o)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition ${
                      activeOrder.id === o.id
                        ? 'bg-[#0C1B2E] text-white border-[#0C1B2E]'
                        : 'bg-neutral-50 text-neutral-600 border-black/10 hover:border-[#1D5CAD]'
                    }`}
                  >
                    {o.id}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="font-bold text-[14px]">{activeOrder.id}</p>
              <p className="text-[12px] text-neutral-500">
                {(Array.isArray(activeOrder.items) ? activeOrder.items : []).reduce(
                  (s, i) => s + (Number(i.qty) || 1),
                  0,
                )}{' '}
                items · {formatINR(activeOrder.total || 0)}
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {ORDER_STAGES.map((label, i) => {
                const done = i <= stage
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full grid place-items-center shrink-0 ${
                        done
                          ? 'bg-[#1D5CAD] text-white'
                          : 'bg-neutral-100 text-neutral-400'
                      }`}
                    >
                      <Check size={13} />
                    </span>
                    <span
                      className={`text-[13px] ${
                        done ? 'font-bold' : 'text-neutral-400'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>

            <p className="text-[12px] text-neutral-500 mt-4">
              Estimated delivery:{' '}
              <span className="font-semibold text-neutral-700">
                {activeOrder.eta && !Number.isNaN(new Date(activeOrder.eta).getTime())
                  ? new Date(activeOrder.eta).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })
                  : '3–5 business days'}
              </span>
            </p>
          </div>
        ) : (
          !found && (
            <div className="mt-5 rounded-xl bg-neutral-50 border border-black/5 p-4 text-center">
              <p className="text-[13px] text-neutral-600">
                You haven&apos;t placed an order in this browser yet.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTrackOpen(false)
                  go('trimmers')
                }}
                className="mt-3 bg-[#0C1B2E] hover:bg-[#1D5CAD] text-white text-[12.5px] font-bold px-4 py-2 rounded-full transition"
              >
                Shop Trimmers
              </button>
            </div>
          )
        )}

        <div className="mt-4 pt-3.5 border-t border-black/5 flex items-center justify-between gap-2 text-[12px]">
          <span className="text-neutral-500">
            Want your complete order history?
          </span>
          <button
            type="button"
            onClick={() => {
              setTrackOpen(false)
              go('account')
            }}
            className="inline-flex items-center gap-1 font-bold text-[#1D5CAD] hover:underline shrink-0 cursor-pointer"
          >
            <User size={13} /> Open My Account
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- toasts */

export function Toasts() {
  const { toasts } = useShop()
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-[#0C1B2E] text-white text-[13px] font-semibold px-5 py-3 rounded-full shadow-xl animate-fade-up"
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------- shop listing */

export function ShopPage({ preset = 'all' }) {
  const { search, setSearch, products, categories } = useShop()
  const [cat, setCat] = useState(preset ?? 'all')
  const [sort, setSort] = useState('popular')

  useEffect(() => {
    setCat(preset ?? 'all')
  }, [preset])

  let list = products.filter((p) =>
    cat === 'all'
      ? true
      : cat === 'trimmers'
        ? p.category !== 'accessories'
        : p.category === cat,
  )

  if (search.trim()) {
    list = list.filter((p) => {
      const categoryLabel =
        categories.find((c) => c.id === p.category)?.label || ''
      return matchesSearch(
        search,
        p.name,
        p.tagline,
        p.short,
        p.description,
        p.brand,
        p.sku,
        p.category,
        categoryLabel,
        p.variants,
      )
    })
  }

  const sorters = {
    popular: (a, b) => b.reviews - a.reviews,
    low: (a, b) => a.price - b.price,
    high: (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating,
    off: (a, b) => discountOf(b) - discountOf(a),
  }
  list = [...list].sort(sorters[sort])

  const filters = [
    { id: 'all', label: 'All Products' },
    { id: 'trimmers', label: 'All Trimmers' },
    ...categories.map((c) => ({ id: c.id, label: c.label })),
  ]

  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap sm:overflow-visible">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setCat(f.id)}
            className={`shrink-0 whitespace-nowrap text-[12.5px] font-bold px-4 py-2 rounded-full border transition ${
              cat === f.id
                ? 'bg-[#0C1B2E] text-white border-[#0C1B2E]'
                : 'bg-white border-black/10 hover:border-[#1D5CAD]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
        <p className="text-[13px] text-neutral-500">
          <span className="font-bold text-neutral-800">{list.length}</span>{' '}
          product{list.length === 1 ? '' : 's'}
          {search.trim() && (
            <>
              {' '}
              for &ldquo;{search}&rdquo;
              <button
                onClick={() => setSearch('')}
                className="ml-2 text-[#1D5CAD] font-bold"
              >
                Clear
              </button>
            </>
          )}
        </p>
        <label className="flex items-center gap-2 text-[12.5px]">
          <span className="text-neutral-500 font-semibold">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-white border border-black/10 rounded-full px-3 py-2 font-semibold outline-none"
          >
            <option value="popular">Most Popular</option>
            <option value="low">Price: Low to High</option>
            <option value="high">Price: High to Low</option>
            <option value="rating">Top Rated</option>
            <option value="off">Biggest Discount</option>
          </select>
        </label>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-display font-extrabold text-lg">No products found</p>
          <button
            onClick={() => {
              setSearch('')
              setCat('all')
            }}
            className="mt-3 bg-[#0C1B2E] text-white text-[13px] font-bold px-5 py-2.5 rounded-full"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <ProductRow products={list} className="mt-5" />
      )}
    </section>
  )
}

/* --------------------------------------------------- order confirmation */

export function OrderConfirmed() {
  const { lastOrder, go, user } = useShop()
  if (!lastOrder) return null

  return (
    <section className="max-w-2xl mx-auto px-4 py-12 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 grid place-items-center">
        <Check size={28} className="text-emerald-600" />
      </div>
      <h1 className="font-display font-black text-[26px] mt-4">Order placed</h1>
      <p className="text-[13.5px] text-neutral-500 mt-1.5">
        Thanks for shopping with HARBAN.{' '}
        {lastOrder.customerEmail
          ? `Confirmation sent to ${lastOrder.customerEmail}.`
          : 'A confirmation is on its way to your inbox.'}
      </p>

      <div className="bg-white rounded-2xl border border-black/5 p-5 mt-6 text-left">
        <div className="flex justify-between items-center">
          <span className="text-[12.5px] text-neutral-500">Order ID</span>
          <span className="font-bold text-[13.5px]">{lastOrder.id}</span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-[12.5px] text-neutral-500">Payment</span>
          <span className="font-bold text-[13.5px]">
            {lastOrder.paymentMethod || 'Cash on Delivery'}
          </span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-[12.5px] text-neutral-500">Total paid</span>
          <span className="font-bold text-[13.5px]">
            {formatINR(lastOrder.total)}
          </span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-[12.5px] text-neutral-500">Estimated delivery</span>
          <span className="font-bold text-[13.5px]">
            {new Date(lastOrder.eta).toLocaleDateString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </div>

        {lastOrder.shippingAddress && (
          <div className="mt-3 pt-3 border-t border-black/5 text-[12.5px] text-neutral-600">
            <span className="font-bold text-neutral-800">Delivering to: </span>
            {lastOrder.shippingAddress.fullName} — {lastOrder.shippingAddress.line1},{' '}
            {lastOrder.shippingAddress.city} ({lastOrder.shippingAddress.pincode})
          </div>
        )}

        <div className="border-t border-black/5 mt-4 pt-4 space-y-3">
          {lastOrder.items.map((i) => (
            <div key={i.id} className="flex items-center gap-3">
              <Img
                src={i.image}
                alt={i.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="flex-1">
                <p className="text-[13px] font-bold">{i.name}</p>
                <p className="text-[12px] text-neutral-500">Qty {i.qty}</p>
              </div>
              <span className="text-[13px] font-bold">
                {formatINR(i.price * i.qty)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => {
            if (user) {
              go('account')
              window.dispatchEvent(
                new CustomEvent('harban:account-tab', { detail: 'orders' }),
              )
            } else {
              go('orders')
            }
          }}
          className="bg-[#1D5CAD] hover:bg-[#16467E] text-white text-[13.5px] font-bold px-6 py-3 rounded-full transition cursor-pointer"
        >
          {user ? 'View in My Orders' : 'Track My Order'}
        </button>
        <button
          onClick={() => go('trimmers')}
          className="bg-[#0C1B2E] hover:bg-black text-white text-[13.5px] font-bold px-6 py-3 rounded-full transition cursor-pointer"
        >
          Continue shopping
        </button>
      </div>
    </section>
  )
}

/* ------------------------------------------------------- related strip */

export function FrequentlyAdded({ current }) {
  const { addToCart, products } = useShop()
  const extras = products
    .filter((p) => p.id !== current?.id && p.category === 'accessories')
    .slice(0, 3)

  if (!extras.length) return null

  return (
    <section className="max-w-7xl mx-auto px-4 mt-10">
      <SectionHead title="Frequently added" sub="Complete your kit." />
      <div className="grid sm:grid-cols-3 gap-3">
        {extras.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-xl border border-black/5 p-3 flex items-center gap-3"
          >
            <Img
              src={p.image}
              alt={p.name}
              className="w-14 h-14 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold truncate">{p.name}</p>
              <p className="text-[12.5px] font-black">
                {formatINR(p.price)}
              </p>
            </div>
            <button
              onClick={() => addToCart(p)}
              className="bg-[#0C1B2E] hover:bg-[#1D5CAD] text-white text-[12px] font-bold px-3.5 py-2 rounded-full transition shrink-0"
            >
              Add
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

export { ProductCard }
