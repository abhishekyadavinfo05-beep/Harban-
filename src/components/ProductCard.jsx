import { useEffect, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { formatINR, useShop } from '../store/shop'

/* Product card matching the original build: square image well with a
   self-advancing gallery on hover and a full-width add-to-cart action. */
export default function ProductCard({ product }) {
  const { addToCart, setQuickView } = useShop()

  const gallery =
    product.images && product.images.length ? product.images : [product.image]
  const [active, setActive] = useState(0)
  const [hovering, setHovering] = useState(false)

  /* cycle the gallery slowly while the card is hovered */
  useEffect(() => {
    if (!hovering || gallery.length < 2) return
    const t = setInterval(
      () => setActive((i) => (i + 1) % gallery.length),
      900,
    )
    return () => clearInterval(t)
  }, [hovering, gallery.length])

  const stop = (fn) => (e) => {
    e.stopPropagation()
    fn()
  }

  return (
    <div className="group w-full h-full bg-white rounded-2xl border border-black/5 overflow-hidden flex flex-col transition hover:shadow-[0_16px_40px_-20px_rgba(12,27,46,0.35)]">
      <button
        onClick={() => setQuickView(product)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => {
          setHovering(false)
          setActive(0)
        }}
        className="relative block bg-[#EDF1F6] aspect-square overflow-hidden text-left w-full"
        aria-label={`Quick view ${product.name}`}
      >
        {gallery.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${product.name} view ${i + 1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              i === active ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}

        <span className="absolute inset-x-3 bottom-8 z-10 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
          <span className="block text-center text-[12.5px] font-bold bg-[#0C1B2E]/90 backdrop-blur text-white rounded-lg py-2">
            Quick View
          </span>
        </span>

        {gallery.length > 1 && (
          <span className="absolute inset-x-0 bottom-2.5 z-10 flex justify-center gap-1.5">
            {gallery.map((src, i) => (
              <span
                key={src}
                onMouseEnter={stop(() => setActive(i))}
                className={`h-[5px] rounded-full transition-all ${
                  i === active ? 'w-5 bg-[#1D5CAD]' : 'w-[5px] bg-white/70 shadow'
                }`}
              />
            ))}
          </span>
        )}
      </button>

      <div className="p-3 sm:p-4 flex flex-col flex-1">
        <button onClick={() => setQuickView(product)} className="text-left">
          <h3 className="font-display font-extrabold text-[14px] sm:text-[15.5px] leading-tight hover:text-[#174A8B] transition line-clamp-2">
            {product.name}
          </h3>
          <p className="text-[11.5px] sm:text-[12px] text-neutral-500 mt-0.5 leading-snug line-clamp-2">
            {product.tagline}
          </p>
        </button>

        {/* spacer keeps the price row and button pinned to the bottom, so
            every card lines up no matter how long its copy is */}
        <div className="flex-1 min-h-2 sm:min-h-3" aria-hidden="true" />

        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-extrabold text-[15.5px] sm:text-[16px] tabular-nums">
            {formatINR(product.price)}
          </span>
          <span className="text-[12px] sm:text-[12.5px] text-neutral-400 line-through tabular-nums">
            {formatINR(product.mrp)}
          </span>
        </div>

        <button
          onClick={() => addToCart(product)}
          disabled={product.stock === 0}
          className="mt-2.5 sm:mt-3 w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-[#0C1B2E] hover:bg-[#1D5CAD] disabled:bg-neutral-300 disabled:text-neutral-600 text-white text-[12.5px] sm:text-[13px] font-bold py-2.5 rounded-xl transition whitespace-nowrap"
        >
          <ShoppingCart size={15} className="shrink-0" />{' '}
          {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    </div>
  )
}

export function ProductRow({ products, columns = 4, className = '' }) {
  /* six-up keeps a full row of six cards readable on desktop */
  const grid =
    columns === 6
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-2.5'
      : 'grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'

  return (
    <div className={`grid ${grid} ${className}`}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}
