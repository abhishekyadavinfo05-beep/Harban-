import { useState } from 'react'
import { Check, Minus, Plus, ShieldCheck, ShoppingCart, Truck, Undo2 } from 'lucide-react'
import Img from './Img'
import { Stars } from './ui'
import { FrequentlyAdded, ProductCard } from './Drawers'
import { discountOf, formatINR, useShop } from '../store/shop'

export default function ProductPage({ product }) {
  const { addToCart, buyNow, go, products } = useShop()
  const [active, setActive] = useState(0)
  const [qty, setQty] = useState(1)
  const [tab, setTab] = useState('features')
  const variants = Array.isArray(product.variants)
    ? product.variants.filter((v) => v.isActive !== false)
    : []
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0)
  const selectedVariant = variants[selectedVariantIdx] || null

  const activePrice = selectedVariant ? Number(selectedVariant.price ?? product.price) : product.price
  const activeMrp = selectedVariant && Number(selectedVariant.mrp) > 0 ? Number(selectedVariant.mrp) : product.mrp
  const activeStock = selectedVariant
    ? typeof selectedVariant.stock === 'number'
      ? selectedVariant.stock
      : product.stock
    : product.stock
  const activeSku = selectedVariant?.sku || product.sku

  const off = activeMrp > activePrice ? Math.round(((activeMrp - activePrice) / activeMrp) * 100) : discountOf(product)
  const related = products
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, 4)

  const perks = [
    { icon: Truck, label: 'Free shipping' },
    { icon: ShieldCheck, label: '1-year warranty' },
    { icon: Undo2, label: '7-day returns' },
  ]

  return (
    <>
      <section className="max-w-7xl mx-auto px-4 py-6">
        <button
          onClick={() => go('trimmers')}
          className="text-[12.5px] font-semibold text-neutral-500 hover:text-[#1D5CAD] transition"
        >
          ← Back to all trimmers
        </button>

        <div className="grid lg:grid-cols-2 gap-6 mt-4">
          {/* gallery */}
          <div>
            <div className="rounded-2xl overflow-hidden bg-white border border-black/5">
              <Img
                src={product.images[active] || product.image}
                alt={product.name}
                className="w-full h-[320px] sm:h-[420px] object-cover"
              />
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2.5 mt-3 overflow-x-auto no-scrollbar">
                {product.images.map((src, i) => (
                  <button
                    key={`${src}-${i}`}
                    onClick={() => setActive(i)}
                    className={`shrink-0 rounded-xl overflow-hidden border-2 transition ${
                      active === i ? 'border-[#1D5CAD]' : 'border-transparent'
                    }`}
                  >
                    <Img
                      src={src}
                      alt={`${product.name} view ${i + 1}`}
                      className="w-[68px] h-[68px] object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* buy box */}
          <div>
            <div className="flex items-center gap-2">
              {product.badge && (
                <span className="bg-[#0C1B2E] text-white text-[10.5px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1">
                  {product.badge}
                </span>
              )}
              {off > 0 && (
                <span className="bg-[#E8C547] text-[#0C1B2E] text-[10.5px] font-black uppercase tracking-wider rounded-full px-2.5 py-1">
                  {off}% off
                </span>
              )}
              {activeSku && (
                <span className="text-[11px] font-mono text-neutral-400">
                  SKU: {activeSku}
                </span>
              )}
            </div>

            <h1 className="font-display font-black text-[28px] sm:text-[34px] leading-tight mt-2.5">
              {product.name}
            </h1>
            <p className="text-[13.5px] text-neutral-500 mt-1">
              {product.tagline}
            </p>

            <div className="flex items-center gap-2 mt-3">
              <Stars rating={product.rating} size={15} />
              <span className="text-[12.5px] font-semibold text-neutral-500">
                {product.rating} · {product.reviews.toLocaleString('en-IN')}{' '}
                verified reviews
              </span>
            </div>

            <div className="flex items-baseline gap-3 mt-4">
              <span className="font-display font-black text-[30px] tabular-nums">
                {formatINR(activePrice)}
              </span>
              <span className="text-[16px] text-neutral-400 line-through tabular-nums">
                {formatINR(activeMrp)}
              </span>
              {off > 0 && (
                <span className="text-[13px] font-bold text-emerald-600 tabular-nums">
                  Save {formatINR(activeMrp - activePrice)}
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-neutral-500 mt-1">
              Inclusive of all taxes
            </p>

            {variants.length > 0 && (
              <div className="mt-4">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-neutral-600 mb-2">
                  Select Option
                </p>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v, idx) => {
                    const label =
                      v.label || [v.size, v.color].filter(Boolean).join(' · ') || `Option ${idx + 1}`
                    const isSelected = selectedVariantIdx === idx
                    return (
                      <button
                        key={v.id || `${label}-${idx}`}
                        type="button"
                        onClick={() => setSelectedVariantIdx(idx)}
                        className={`px-3.5 py-2 rounded-xl border text-[12.5px] font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#0C1B2E] text-white border-[#0C1B2E]'
                            : 'bg-white text-neutral-700 border-black/15 hover:border-[#1D5CAD]'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <p className="text-[13.5px] text-neutral-600 leading-relaxed mt-4">
              {product.description}
            </p>

            <div className="flex items-center gap-3 mt-6">
              <div className="inline-flex items-center gap-1 bg-white rounded-full border border-black/10 px-2 py-1.5">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="grid place-items-center w-8 h-8 rounded-full hover:bg-neutral-100"
                  aria-label="Decrease quantity"
                >
                  <Minus size={14} />
                </button>
                <span className="font-bold w-7 text-center tabular-nums">{qty}</span>
                <button
                  onClick={() =>
                    setQty(
                      Math.min(
                        typeof activeStock === 'number'
                          ? Math.max(1, activeStock)
                          : 99,
                        qty + 1,
                      ),
                    )
                  }
                  className="grid place-items-center w-8 h-8 rounded-full hover:bg-neutral-100"
                  aria-label="Increase quantity"
                >
                  <Plus size={14} />
                </button>
              </div>

              <button
                disabled={activeStock === 0}
                onClick={() => addToCart(product, qty, 'add_to_cart', selectedVariant)}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#0C1B2E] hover:bg-[#1D5CAD] disabled:bg-neutral-300 disabled:text-neutral-600 text-white text-[14px] font-bold py-3.5 rounded-xl transition"
              >
                <ShoppingCart size={17} />{' '}
                {activeStock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>

            <button
              disabled={activeStock === 0}
              onClick={() => buyNow(product, qty, selectedVariant)}
              className="mt-2.5 w-full bg-[#1D5CAD] hover:bg-[#16467E] disabled:opacity-50 text-white text-[14px] font-bold py-3.5 rounded-xl transition"
            >
              Buy Now
            </button>

            {product.meeshoUrl && (
              <a
                href={
                  /^https?:\/\//i.test(product.meeshoUrl.trim())
                    ? product.meeshoUrl.trim()
                    : `https://${product.meeshoUrl.trim().replace(/^\/+/, '')}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 w-full inline-flex items-center justify-center bg-white border border-black/15 hover:border-[#1D5CAD] text-[#0C1B2E] text-[13.5px] font-bold py-3 rounded-xl transition"
              >
                Buy on Meesho →
              </a>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 mt-5">
              {perks.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 bg-white rounded-xl border border-black/5 px-3 py-2.5"
                >
                  <Icon size={16} className="text-[#1D5CAD] shrink-0" />
                  <span className="text-[12px] sm:text-[11.5px] font-bold leading-tight">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* details tabs */}
      <section className="max-w-7xl mx-auto px-4 mt-4">
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
          <div className="flex border-b border-black/5 overflow-x-auto no-scrollbar">
            {[
              ['features', 'Features'],
              ['specs', 'Specifications'],
              ['box', 'In the box'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-5 py-3.5 text-[13px] font-bold whitespace-nowrap transition border-b-2 -mb-px ${
                  tab === id
                    ? 'border-[#1D5CAD] text-[#1D5CAD]'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === 'features' && (
              <ul className="grid sm:grid-cols-2 gap-2.5">
                {product.features.map((f) => (
                  <li key={f} className="text-[13px] text-neutral-700 flex gap-2">
                    <Check size={15} className="text-[#1D5CAD] shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            )}

            {tab === 'specs' && (
              <dl className="grid sm:grid-cols-2 gap-x-8">
                {product.specs
                  .filter(
                    (s) =>
                      !['seo title', 'seo description', 'tags'].includes(
                        String(s.label || '').trim().toLowerCase(),
                      ),
                  )
                  .map((s) => (
                    <div
                      key={s.label}
                      className="flex justify-between gap-4 py-2.5 border-b border-black/5 text-[13px]"
                    >
                      <dt className="text-neutral-500 font-semibold">{s.label}</dt>
                      <dd className="font-semibold text-right">{s.value}</dd>
                    </div>
                  ))}
              </dl>
            )}

            {tab === 'box' && (
              <p className="text-[13px] text-neutral-600 leading-relaxed">
                {product.specs.find((s) => s.label === 'In the box')?.value ??
                  'See the specifications tab for full contents.'}
              </p>
            )}
          </div>
        </div>
      </section>

      <FrequentlyAdded current={product} />

      {related.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 mt-10">
          <h2 className="font-display font-extrabold text-[20px] sm:text-[24px] tracking-tight mb-4">
            You may also like
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
