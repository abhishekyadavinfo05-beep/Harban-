import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  MapPin,
  Package,
  RotateCcw,
  Search,
  ShoppingBag,
  Truck,
  User,
  XCircle,
} from 'lucide-react'
import Img from './Img'
import { ORDER_STAGES, formatINR, useShop } from '../store/shop'

function formatDate(value, options, fallback = '—') {
  if (!value) return fallback
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return fallback
  return d.toLocaleDateString('en-IN', options)
}

function getOrderItems(order) {
  return Array.isArray(order?.items) ? order.items : []
}

function OrderTrackingCard({
  order,
  products,
  go,
  reorder,
  cancelOrder,
  canCancel,
  expandedSummary,
  onToggleSummary,
  highlight = false,
}) {
  const items = getOrderItems(order)
  const itemCount = items.reduce((sum, i) => sum + (Number(i.qty) || 1), 0)
  const stageIdx = Number.isFinite(Number(order.status))
    ? Math.max(0, Math.min(ORDER_STAGES.length - 1, Number(order.status)))
    : 0
  const currentStage = ORDER_STAGES[stageIdx] || 'Order placed'
  const placedDate = formatDate(
    order.placedAt,
    { day: 'numeric', month: 'short', year: 'numeric' },
    'Recent',
  )
  const etaDate = formatDate(
    order.eta,
    { weekday: 'short', day: 'numeric', month: 'short' },
    '3–5 business days',
  )

  return (
    <div
      className={`bg-white rounded-2xl border overflow-hidden ${
        highlight ? 'border-[#1D5CAD]/40 shadow-sm' : 'border-black/5'
      }`}
    >
      {/* Top Meta Bar */}
      <div className="bg-neutral-50/90 border-b border-black/5 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px]">
          <div>
            <span className="text-neutral-500 block text-[11px]">Order ID</span>
            <span className="font-extrabold text-[#0C1B2E] tabular-nums">
              {order.id}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[11px]">Placed On</span>
            <span className="font-semibold text-neutral-800">{placedDate}</span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[11px]">Payment</span>
            <span className="font-semibold text-neutral-800">
              {order.paymentMethod || 'Cash on Delivery'}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[11px]">Total</span>
            <span className="font-extrabold text-[#0C1B2E] tabular-nums">
              {formatINR(order.total || 0)}
            </span>
          </div>
        </div>

        <span
          className={`text-[11.5px] font-bold px-3 py-1 rounded-full ${
            order.cancelled
              ? 'bg-red-100 text-red-700'
              : stageIdx >= ORDER_STAGES.length - 1
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-[#1D5CAD]/10 text-[#1D5CAD]'
          }`}
        >
          {order.cancelled ? 'Cancelled' : currentStage}
        </span>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Progress Stepper or Cancelled Notice */}
        {order.cancelled ? (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2.5 text-[13px] text-red-700">
            <XCircle size={16} className="shrink-0" />
            <span className="font-semibold">
              This order was cancelled. Any prepaid amount is automatically refunded within 3–5 business days.
            </span>
          </div>
        ) : (
          <div className="bg-neutral-50 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
              <span className="text-[12.5px] font-bold text-[#0C1B2E] flex items-center gap-1.5">
                <Truck size={15} className="text-[#1D5CAD]" />
                Status: {currentStage}
              </span>
              <span className="text-[12px] text-neutral-500">
                Estimated delivery:{' '}
                <strong className="text-neutral-800">{etaDate}</strong>
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {ORDER_STAGES.map((label, idx) => {
                const done = idx <= stageIdx
                return (
                  <div key={label} className="text-center">
                    <div className="flex items-center justify-center mb-1.5">
                      <span
                        className={`w-5 h-5 rounded-full grid place-items-center text-[10px] ${
                          done
                            ? 'bg-[#1D5CAD] text-white'
                            : 'bg-neutral-200 text-neutral-400'
                        }`}
                      >
                        <Check size={11} />
                      </span>
                    </div>
                    <div
                      className={`h-1.5 rounded-full mb-1.5 ${
                        done ? 'bg-[#1D5CAD]' : 'bg-neutral-200'
                      }`}
                    />
                    <span
                      className={`block text-[10px] sm:text-[11px] leading-tight ${
                        done ? 'font-bold text-[#0C1B2E]' : 'text-neutral-400'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>

            {(order.courierPartner || order.trackingNumber) && (
              <div className="mt-3.5 pt-3 border-t border-black/5 flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <div className="text-neutral-600">
                  {order.courierPartner && (
                    <span>
                      Courier:{' '}
                      <strong className="text-neutral-800">
                        {order.courierPartner}
                      </strong>
                    </span>
                  )}
                  {order.courierPartner && order.trackingNumber && ' · '}
                  {order.trackingNumber && (
                    <span>
                      AWB:{' '}
                      <strong className="text-neutral-800 tabular-nums">
                        {order.trackingNumber}
                      </strong>
                    </span>
                  )}
                </div>
                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#1D5CAD] hover:underline"
                  >
                    Courier Tracking <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Items List */}
        {items.length > 0 && (
          <div className="divide-y divide-black/5">
            {items.map((item, idx) => {
              const catalogMatch = products.find((p) => p.id === item.id)
              return (
                <div
                  key={`${order.id}-${item.id || idx}`}
                  className="py-3 first:pt-0 last:pb-0 flex items-center gap-3.5"
                >
                  <Img
                    src={item.image || catalogMatch?.image}
                    alt={item.name}
                    className="w-15 h-15 sm:w-16 sm:h-16 rounded-xl object-cover bg-neutral-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        catalogMatch && go(`product:${catalogMatch.id}`)
                      }
                      className={`font-display font-bold text-[14px] text-left truncate block max-w-full ${
                        catalogMatch
                          ? 'hover:text-[#1D5CAD] cursor-pointer'
                          : 'cursor-default'
                      }`}
                    >
                      {item.name}
                    </button>
                    <p className="text-[12px] text-neutral-500 mt-0.5 tabular-nums">
                      Qty: {item.qty} × {formatINR(item.price || 0)}
                    </p>
                  </div>
                  <span className="font-bold text-[14px] shrink-0 tabular-nums">
                    {formatINR((item.price || 0) * (item.qty || 1))}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Address & Action Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-black/5">
          <div className="text-[12px] text-neutral-600 pt-2 sm:pt-0">
            {order.shippingAddress ? (
              <p className="flex items-start gap-1.5">
                <MapPin size={14} className="text-[#1D5CAD] shrink-0 mt-0.5" />
                <span>
                  Delivering to{' '}
                  <strong className="text-neutral-800">
                    {order.shippingAddress.fullName || order.customerName}
                  </strong>{' '}
                  — {order.shippingAddress.line1}, {order.shippingAddress.city}
                  {order.shippingAddress.pincode
                    ? ` - ${order.shippingAddress.pincode}`
                    : ''}
                </span>
              </p>
            ) : (
              <p className="text-neutral-500">
                {itemCount > 0
                  ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'} · Standard Free Delivery across India`
                  : 'Standard Free Delivery across India'}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => reorder(order)}
                className="inline-flex items-center gap-1.5 bg-[#0C1B2E] hover:bg-[#1D5CAD] text-white text-[12px] font-bold px-4 py-2 rounded-full transition cursor-pointer"
              >
                <RotateCcw size={13} /> Buy Again
              </button>
            )}
            <button
              type="button"
              onClick={onToggleSummary}
              className="inline-flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[12px] font-bold px-3.5 py-2 rounded-full transition cursor-pointer"
            >
              <FileText size={13} />{' '}
              {expandedSummary ? 'Hide Summary' : 'Order Summary'}
            </button>
            {canCancel && !order.cancelled && stageIdx <= 1 && (
              <button
                type="button"
                onClick={() => cancelOrder(order.id)}
                className="inline-flex items-center gap-1.5 text-red-600 hover:bg-red-50 text-[12px] font-bold px-3 py-2 rounded-full transition cursor-pointer"
              >
                <XCircle size={13} /> Cancel
              </button>
            )}
          </div>
        </div>

        {expandedSummary && (
          <div className="border-t border-dashed border-black/15 pt-4 text-[12.5px] text-neutral-600 grid sm:grid-cols-2 gap-3">
            <div>
              <p className="font-bold text-neutral-800">Customer Details</p>
              <p>{order.customerName || 'HARBAN Customer'}</p>
              {order.customerEmail && <p>{order.customerEmail}</p>}
              {order.phone && <p>{order.phone}</p>}
            </div>
            <div className="sm:text-right space-y-1 tabular-nums">
              <p>
                Items Subtotal:{' '}
                <strong className="text-neutral-800">
                  {formatINR(order.subtotal ?? order.total ?? 0)}
                </strong>
              </p>
              <p>
                Shipping: <strong className="text-emerald-700">FREE</strong>
              </p>
              <p className="text-[13.5px] font-extrabold text-[#0C1B2E]">
                Grand Total (incl. GST): {formatINR(order.total || 0)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const {
    user,
    userOrders,
    orders,
    lastOrder,
    products,
    trackOrderByCode,
    cancelOrder,
    reorder,
    go,
  } = useShop()

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState(null) // null | 'not-found' | orderObj
  const [orderFilter, setOrderFilter] = useState('all')
  const [summaryId, setSummaryId] = useState(null)

  const visibleOrders = useMemo(() => {
    const base = user ? userOrders : orders
    return Array.isArray(base) ? base : []
  }, [user, userOrders, orders])

  const filteredOrders = useMemo(() => {
    return visibleOrders.filter((o) => {
      if (orderFilter === 'active') {
        return !o.cancelled && (Number(o.status) || 0) < ORDER_STAGES.length - 1
      }
      if (orderFilter === 'delivered') {
        return !o.cancelled && (Number(o.status) || 0) >= ORDER_STAGES.length - 1
      }
      if (orderFilter === 'cancelled') return !!o.cancelled
      return true
    })
  }, [visibleOrders, orderFilter])

  const handleTrack = async (e) => {
    e.preventDefault()
    const clean = query.trim().toUpperCase()
    if (!clean || searching) return
    setSearching(true)
    try {
      const remoteMatch = await trackOrderByCode(clean)
      const localMatch =
        remoteMatch ??
        visibleOrders.find((o) => String(o.id || '').toUpperCase() === clean) ??
        orders.find((o) => String(o.id || '').toUpperCase() === clean) ??
        (lastOrder && String(lastOrder.id || '').toUpperCase() === clean
          ? lastOrder
          : null)
      setSearchResult(localMatch ?? 'not-found')
    } finally {
      setSearching(false)
    }
  }

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    } else {
      go('home')
    }
  }

  return (
    <>
      {/* Top Dark Banner */}
      <section className="bg-[#0C1B2E] text-white">
        <div className="max-w-5xl mx-auto px-4 py-7 sm:py-9">
          <div className="flex items-center justify-between gap-3 mb-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white/75 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <div className="text-[11.5px] text-white/55">
              <button
                type="button"
                onClick={() => go('home')}
                className="hover:text-white cursor-pointer"
              >
                Home
              </button>
              <span className="mx-1.5">/</span>
              <span className="text-white/90">My Orders</span>
            </div>
          </div>

          <h1 className="font-display font-black text-[24px] sm:text-[32px] tracking-tight">
            My Orders &amp; Order Tracking
          </h1>
          <p className="text-white/70 text-[13.5px] mt-1">
            Track live delivery status by Order ID or manage your HARBAN orders below.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Track Order by ID Card */}
        <div className="bg-white rounded-2xl border border-black/5 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-display font-extrabold text-[17px] sm:text-[18px] text-[#0C1B2E]">
                Track by Order ID
              </h2>
              <p className="text-[12.5px] text-neutral-500 mt-0.5">
                Enter the Order ID from your confirmation screen or email (for example, HB100).
              </p>
            </div>
            {!user && (
              <button
                type="button"
                onClick={() => go('account')}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#1D5CAD] hover:underline cursor-pointer"
              >
                <User size={14} /> Sign In for Full History
              </button>
            )}
          </div>

          <form
            onSubmit={handleTrack}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <div className="flex-1 flex items-center gap-2.5 bg-neutral-100 rounded-xl px-4 py-2.5 focus-within:ring-2 ring-[#1D5CAD]/40">
              <Search size={16} className="text-neutral-400 shrink-0" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (!e.target.value.trim()) setSearchResult(null)
                }}
                placeholder="Enter Order ID (e.g. HB100)"
                className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-neutral-400 uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="shrink-0 bg-[#0C1B2E] hover:bg-[#1D5CAD] disabled:opacity-60 text-white text-[13.5px] font-bold px-6 py-3 rounded-xl transition inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Package size={15} /> {searching ? 'Tracking...' : 'Track Order'}
            </button>
          </form>

          {visibleOrders.length > 0 && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] font-semibold text-neutral-500">
                Recent IDs:
              </span>
              {visibleOrders.slice(0, 5).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setQuery(o.id)
                    setSearchResult(o)
                  }}
                  className={`text-[11.5px] font-bold px-3 py-1 rounded-lg border transition cursor-pointer tabular-nums ${
                    searchResult &&
                    typeof searchResult === 'object' &&
                    searchResult.id === o.id
                      ? 'bg-[#0C1B2E] text-white border-[#0C1B2E]'
                      : 'bg-neutral-50 text-neutral-700 border-black/10 hover:border-[#1D5CAD]'
                  }`}
                >
                  {o.id}
                </button>
              ))}
            </div>
          )}

          {searchResult === 'not-found' && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-700 font-medium">
              No order found for &ldquo;{query.trim().toUpperCase()}&rdquo;. Please double-check your Order ID or contact care@harban.in.
            </div>
          )}

          {searchResult && typeof searchResult === 'object' && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[12px] font-bold uppercase tracking-wider text-[#1D5CAD]">
                  Tracking Result
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchResult(null)
                    setQuery('')
                  }}
                  className="text-[12px] font-semibold text-neutral-500 hover:text-neutral-800 cursor-pointer"
                >
                  Clear search
                </button>
              </div>
              <OrderTrackingCard
                order={searchResult}
                products={products}
                go={go}
                reorder={reorder}
                cancelOrder={cancelOrder}
                canCancel={!!user}
                expandedSummary={summaryId === `track-${searchResult.id}`}
                onToggleSummary={() =>
                  setSummaryId(
                    summaryId === `track-${searchResult.id}`
                      ? null
                      : `track-${searchResult.id}`,
                  )
                }
                highlight
              />
            </div>
          )}
        </div>

        {/* Orders List Section */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-extrabold text-[18px] sm:text-[20px] text-[#0C1B2E]">
                {user ? `Your Orders (${visibleOrders.length})` : 'Recent Orders'}
              </h2>
              {!user && visibleOrders.length > 0 && (
                <p className="text-[12.5px] text-neutral-500 mt-0.5">
                  Orders placed from this browser. Sign in to view all orders linked to your account.
                </p>
              )}
            </div>

            {visibleOrders.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  ['all', 'All'],
                  ['active', 'Active'],
                  ['delivered', 'Delivered'],
                  ['cancelled', 'Cancelled'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setOrderFilter(key)}
                    className={`shrink-0 text-[12px] font-bold px-3.5 py-1.5 rounded-lg border transition cursor-pointer ${
                      orderFilter === key
                        ? 'bg-[#1D5CAD] text-white border-[#1D5CAD]'
                        : 'bg-white text-neutral-600 border-black/10 hover:border-[#1D5CAD]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-8 sm:p-12 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-neutral-100 grid place-items-center text-neutral-400">
                <ShoppingBag size={24} />
              </div>
              <h3 className="font-display font-extrabold text-lg mt-4 text-[#0C1B2E]">
                {visibleOrders.length === 0
                  ? user
                    ? 'No orders placed yet'
                    : 'No orders found in this browser'
                  : `No ${orderFilter} orders`}
              </h3>
              <p className="text-[13px] text-neutral-500 mt-1.5 max-w-md mx-auto">
                {user
                  ? 'Once you place an order on HARBAN, you can track delivery stages, download summaries, and reorder anytime right here.'
                  : 'Enter your Order ID above to track a guest order, or sign in to view orders linked to your email.'}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                {!user && (
                  <button
                    type="button"
                    onClick={() => go('account')}
                    className="bg-[#1D5CAD] hover:bg-[#16467E] text-white text-[13px] font-bold px-6 py-2.5 rounded-full transition cursor-pointer"
                  >
                    Sign In to My Account
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => go('trimmers')}
                  className="bg-[#0C1B2E] hover:bg-black text-white text-[13px] font-bold px-6 py-2.5 rounded-full transition cursor-pointer"
                >
                  Shop Trimmers
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <OrderTrackingCard
                  key={order.id}
                  order={order}
                  products={products}
                  go={go}
                  reorder={reorder}
                  cancelOrder={cancelOrder}
                  canCancel={!!user}
                  expandedSummary={summaryId === order.id}
                  onToggleSummary={() =>
                    setSummaryId(summaryId === order.id ? null : order.id)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
