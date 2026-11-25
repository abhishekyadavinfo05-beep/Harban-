import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Banknote,
  Check,
  Lock,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
  Undo2,
  Wallet,
} from 'lucide-react'
import Img from './Img'
import { FREE_SHIP_THRESHOLD, formatINR, useShop } from '../store/shop'

function normalizeClientPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

export default function CheckoutPage() {
  const {
    cart,
    setQty,
    removeFromCart,
    placeOrder,
    createRazorpayOrder,
    verifyRazorpayPayment,
    saveAddress,
    subtotal,
    payments,
    user,
    go,
    pushToast,
  } = useShop()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [line1, setLine1] = useState('')
  const [city, setCity] = useState('')
  const [stateName, setStateName] = useState('')
  const [pincode, setPincode] = useState('')
  const [paymentMethod, setPaymentMethod] = useState(
    payments?.razorpayEnabled !== false ? 'Razorpay Online' : 'Cash on Delivery',
  )
  const [submitting, setSubmitting] = useState(false)
  const [payStage, setPayStage] = useState('')
  const [showSandboxModal, setShowSandboxModal] = useState(false)
  const [sandboxMethod, setSandboxMethod] = useState('upi')
  const [pendingCheckoutData, setPendingCheckoutData] = useState(null)

  useEffect(() => {
    if (payments?.razorpayEnabled === false && paymentMethod === 'Razorpay Online') {
      setPaymentMethod('Cash on Delivery')
    }
  }, [payments?.razorpayEnabled, paymentMethod])

  useEffect(() => {
    if (!user) return
    const def =
      user.addresses?.find((a) => a.isDefault) || user.addresses?.[0] || null
    setName((prev) => prev || def?.fullName || user.name || '')
    setEmail((prev) => prev || user.email || '')
    setPhone((prev) => prev || def?.phone || user.phone || '')
    if (def) {
      setLine1((prev) => prev || def.line1 || '')
      setCity((prev) => prev || def.city || '')
      setStateName((prev) => prev || def.state || '')
      setPincode((prev) => prev || def.pincode || '')
    }
  }, [user])

  const normalizedPhone = normalizeClientPhone(phone)
  const isPhoneValid = /^[1-9]\d{9}$/.test(normalizedPhone)
  const progress = Math.min(100, (subtotal / FREE_SHIP_THRESHOLD) * 100)

  const paymentOptions = [
    ...(payments?.razorpayEnabled !== false
      ? [
          {
            id: 'Razorpay Online',
            label: 'Pay Online via Razorpay',
            desc: 'Instant checkout with UPI (GPay, PhonePe, Paytm), Cards, NetBanking & Wallets.',
            badges: ['UPI', 'Visa / Mastercard', 'RuPay', 'NetBanking'],
            icon: Wallet,
          },
        ]
      : []),
    {
      id: 'Cash on Delivery',
      label: 'Cash on Delivery (COD)',
      desc: 'Pay with cash or UPI at your doorstep. Zero extra charges.',
      badges: [],
      icon: Banknote,
    },
  ]

  const executeOrderSubmission = async (overrideData = {}) => {
    setSubmitting(true)
    setPayStage('')
    try {
      const addressObj = {
        label: 'Delivery',
        fullName: name.trim(),
        phone: phone.trim(),
        line1: line1.trim(),
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
      }

      if (user && (!user.addresses || user.addresses.length === 0)) {
        try {
          await saveAddress(
            { ...addressObj, label: 'Home', isDefault: true },
            { silent: true },
          )
        } catch {
          // Non-blocking
        }
      }

      let rzpOrderId = overrideData.rzpOrderId || null
      let rzpPaymentId = overrideData.rzpPaymentId || null
      let paymentStatus = overrideData.paymentStatus || 'pending'

      if (
        paymentMethod === 'Razorpay Online' &&
        payments?.razorpayEnabled !== false &&
        !overrideData.skipGateway
      ) {
        try {
          setPayStage('Initializing Razorpay...')
          const rzpOrder = await createRazorpayOrder(subtotal, {
            customerEmail: email.trim(),
            customerPhone: normalizedPhone,
          })
          rzpOrderId = rzpOrder?.orderId || null

          if (payments?.razorpayConfigured && rzpOrder?.hasCredentials && rzpOrder?.keyId) {
            if (typeof window !== 'undefined' && !window.Razorpay) {
              await new Promise((resolve, reject) => {
                const s = document.createElement('script')
                s.src = 'https://checkout.razorpay.com/v1/checkout.js'
                s.async = true
                s.onload = resolve
                s.onerror = () =>
                  reject(new Error('Unable to load Razorpay Checkout script'))
                document.body.appendChild(s)
              })
            }

            if (!window.Razorpay) {
              throw new Error('Razorpay Checkout could not be initialized.')
            }

            setPayStage('Complete payment in Razorpay...')
            const payResult = await new Promise((resolve, reject) => {
              const rzp = new window.Razorpay({
                key: rzpOrder.keyId,
                amount: rzpOrder.amount,
                currency: rzpOrder.currency || 'INR',
                name: 'HARBAN',
                description: 'HARBAN Grooming Essentials Order',
                order_id: rzpOrder.orderId,
                prefill: {
                  name: name.trim(),
                  email: email.trim(),
                  contact: normalizedPhone,
                },
                notes: {
                  city: city.trim(),
                  pincode: pincode.trim(),
                },
                theme: {
                  color: '#0C1B2E',
                },
                handler: (resp) => resolve(resp),
                modal: {
                  ondismiss: () => reject(new Error('Payment cancelled')),
                },
              })
              rzp.on('payment.failed', (resp) => {
                reject(
                  new Error(
                    resp?.error?.description ||
                      'Payment failed. Please try again or choose COD.',
                  ),
                )
              })
              rzp.open()
            })

            rzpOrderId = payResult?.razorpay_order_id || rzpOrderId
            rzpPaymentId = payResult?.razorpay_payment_id || null

            setPayStage('Verifying payment...')
            await verifyRazorpayPayment(payResult)
            paymentStatus = 'paid'
          } else {
            // Sandbox / Test Mode fallback modal
            setSubmitting(false)
            setPayStage('')
            setPendingCheckoutData({
              rzpOrderId: rzpOrder?.orderId || `order_test_${Date.now()}`,
              addressObj,
              paymentMethod,
            })
            setShowSandboxModal(true)
            return
          }
        } catch (err) {
          pushToast(err instanceof Error ? err.message : 'Payment cancelled')
          return
        }
      }

      setPayStage('Confirming your order...')
      await placeOrder({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: addressObj,
        paymentMethod,
        paymentStatus,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
      })
    } finally {
      if (!showSandboxModal) {
        setSubmitting(false)
        setPayStage('')
      }
    }
  }

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault()
    if (submitting || cart.length === 0) return

    if (
      !name.trim() ||
      !/^\S+@\S+\.\S+$/.test(email.trim()) ||
      !isPhoneValid ||
      !line1.trim() ||
      !city.trim() ||
      !pincode.trim()
    ) {
      pushToast('Please complete all delivery, email & 10-digit mobile details')
      return
    }

    await executeOrderSubmission()
  }

  const handleSandboxComplete = async () => {
    setShowSandboxModal(false)
    setSubmitting(true)
    setPayStage('Processing secured payment...')
    try {
      const data = pendingCheckoutData || {}
      const paymentId = `pay_sandbox_${Date.now()}`
      await placeOrder({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: data.addressObj || {
          fullName: name.trim(),
          phone: phone.trim(),
          line1: line1.trim(),
          city: city.trim(),
          state: stateName.trim(),
          pincode: pincode.trim(),
        },
        paymentMethod: data.paymentMethod || 'Razorpay Online',
        paymentStatus: 'paid',
        razorpayOrderId: data.rzpOrderId || `order_test_${Date.now()}`,
        razorpayPaymentId: paymentId,
      })
      pushToast('Payment successful! Order placed.')
    } finally {
      setSubmitting(false)
      setPayStage('')
      setPendingCheckoutData(null)
    }
  }

  return (
    <>
      <section className="bg-[#0C1B2E] text-white">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[12px] text-white/60 mb-1.5">
                <button
                  type="button"
                  onClick={() => go('home')}
                  className="hover:text-white transition cursor-pointer"
                >
                  Home
                </button>
                <span aria-hidden="true">/</span>
                <span className="text-white/90">Checkout</span>
              </div>
              <h1 className="font-display font-black text-[24px] sm:text-[32px] tracking-tight">
                Secure Checkout
              </h1>
            </div>
            <button
              type="button"
              onClick={() => go('trimmers')}
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-white/80 hover:text-white transition cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft size={15} /> Continue Shopping
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-6 sm:py-10">
        {cart.length === 0 ? (
          <div className="max-w-lg mx-auto bg-white rounded-2xl border border-black/5 p-8 sm:p-10 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-neutral-100 grid place-items-center">
              <ShoppingBag size={26} className="text-neutral-400" />
            </div>
            <h2 className="font-display font-extrabold text-[22px] mt-4 text-[#0C1B2E]">
              Your bag is empty
            </h2>
            <p className="text-[14px] text-neutral-500 mt-1.5">
              Add a trimmer or grooming essential to proceed with checkout.
            </p>
            <button
              type="button"
              onClick={() => go('trimmers')}
              className="mt-6 bg-[#0C1B2E] hover:bg-[#1D5CAD] text-white text-[14px] font-bold px-6 py-3 rounded-xl transition cursor-pointer"
            >
              Browse Trimmers
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleCheckoutSubmit}
            className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6 lg:gap-8 items-start"
          >
            {/* Left column: Delivery details & Payment */}
            <div className="space-y-6">
              {/* Contact & Delivery Card */}
              <div className="bg-white rounded-2xl border border-black/5 p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-black/5">
                  <div>
                    <h2 className="font-display font-extrabold text-[18px] text-[#0C1B2E]">
                      1. Delivery Address
                    </h2>
                    <p className="text-[12.5px] text-neutral-500 mt-0.5">
                      Dispatched within 24 hours with free pan-India shipping.
                    </p>
                  </div>
                  {!user && (
                    <button
                      type="button"
                      onClick={() => go('account')}
                      className="text-[12.5px] font-bold text-[#1D5CAD] hover:underline cursor-pointer whitespace-nowrap"
                    >
                      Have an account? Sign In →
                    </button>
                  )}
                </div>

                {user && user.addresses?.length > 0 && (
                  <div className="mt-5">
                    <p className="text-[12px] font-bold text-neutral-600 mb-2.5 flex items-center gap-1.5">
                      <MapPin size={14} className="text-[#1D5CAD]" />
                      Select a Saved Address
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      {user.addresses.map((a) => {
                        const selected =
                          line1 === a.line1 && pincode === a.pincode
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              setName(a.fullName || user.name || '')
                              setPhone(a.phone || user.phone || '')
                              setLine1(a.line1 || '')
                              setCity(a.city || '')
                              setStateName(a.state || '')
                              setPincode(a.pincode || '')
                            }}
                            className={`text-left rounded-xl border p-3.5 transition cursor-pointer ${
                              selected
                                ? 'border-[#1D5CAD] bg-[#1D5CAD]/5'
                                : 'border-black/10 bg-neutral-50 hover:border-black/25'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-[13px] text-[#0C1B2E]">
                                {a.label || 'Home'}
                              </span>
                              {selected && (
                                <span className="text-[11px] font-bold text-[#1D5CAD] flex items-center gap-1">
                                  <Check size={13} /> Selected
                                </span>
                              )}
                            </div>
                            <p className="text-[12.5px] text-neutral-700 mt-1 line-clamp-1">
                              {a.fullName || user.name}
                            </p>
                            <p className="text-[12px] text-neutral-500 mt-0.5 line-clamp-2">
                              {a.line1}, {a.city}
                              {a.state ? `, ${a.state}` : ''} — {a.pincode}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="block text-[12px] font-bold text-neutral-700 mb-1.5">
                      Full Name
                    </label>
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Receiver's full name"
                      className="w-full bg-neutral-100 rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 ring-[#1D5CAD]/40"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-bold text-neutral-700 mb-1.5">
                        Email Address (Order Updates)
                      </label>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full bg-neutral-100 rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 ring-[#1D5CAD]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-neutral-700 mb-1.5">
                        10-Digit Mobile Number
                      </label>
                      <input
                        required
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full bg-neutral-100 rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 ring-[#1D5CAD]/40"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-neutral-700 mb-1.5">
                      Street Address / House No. / Landmark
                    </label>
                    <input
                      required
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      placeholder="Flat / House no., Building, Street, Area"
                      className="w-full bg-neutral-100 rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 ring-[#1D5CAD]/40"
                    />
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[12px] font-bold text-neutral-700 mb-1.5">
                        City
                      </label>
                      <input
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Mumbai"
                        className="w-full bg-neutral-100 rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 ring-[#1D5CAD]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-neutral-700 mb-1.5">
                        State
                      </label>
                      <input
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        placeholder="Maharashtra"
                        className="w-full bg-neutral-100 rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 ring-[#1D5CAD]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-neutral-700 mb-1.5">
                        PIN Code
                      </label>
                      <input
                        required
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        placeholder="400001"
                        className="w-full bg-neutral-100 rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 ring-[#1D5CAD]/40"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method Card */}
              <div className="bg-white rounded-2xl border border-black/5 p-5 sm:p-7">
                <div className="pb-4 border-b border-black/5">
                  <h2 className="font-display font-extrabold text-[18px] text-[#0C1B2E]">
                    2. Payment Method
                  </h2>
                  <p className="text-[12.5px] text-neutral-500 mt-0.5">
                    All transactions are encrypted and protected.
                  </p>
                </div>

                <div className="mt-4 space-y-2.5">
                  {paymentOptions.map((opt) => {
                    const Icon = opt.icon
                    const active = paymentMethod === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPaymentMethod(opt.id)}
                        className={`w-full text-left flex items-start gap-3.5 rounded-xl border p-4 transition cursor-pointer ${
                          active
                            ? 'border-[#1D5CAD] bg-[#1D5CAD]/[0.04]'
                            : 'border-black/10 bg-white hover:border-black/25'
                        }`}
                      >
                        <span
                          className={`mt-0.5 w-5 h-5 rounded-full border-2 grid place-items-center shrink-0 ${
                            active
                              ? 'border-[#1D5CAD] bg-[#1D5CAD]'
                              : 'border-neutral-300 bg-white'
                          }`}
                        >
                          {active && (
                            <span className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </span>
                        <Icon
                          size={18}
                          className={`mt-0.5 shrink-0 ${
                            active ? 'text-[#1D5CAD]' : 'text-neutral-500'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-[14px] text-[#0C1B2E]">
                              {opt.label}
                            </p>
                            {opt.id === 'Razorpay Online' && (
                              <span className="text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-[#1D5CAD]/10 text-[#1D5CAD]">
                                {payments?.razorpayConfigured
                                  ? payments?.razorpayMode === 'live'
                                    ? '100% Secure'
                                    : 'Test Gateway'
                                  : 'Instant Sandbox'}
                              </span>
                            )}
                          </div>
                          <p className="text-[12.5px] text-neutral-500 mt-0.5">
                            {opt.desc}
                          </p>
                          {opt.badges?.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              {opt.badges.map((b) => (
                                <span
                                  key={b}
                                  className="text-[10.5px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded"
                                >
                                  {b}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right column: Sticky Order Summary */}
            <aside className="bg-white rounded-2xl border border-black/5 p-5 sm:p-6 lg:sticky lg:top-24">
              <h2 className="font-display font-extrabold text-[18px] text-[#0C1B2E] pb-4 border-b border-black/5">
                Order Summary ({cart.reduce((s, i) => s + i.qty, 0)}{' '}
                {cart.reduce((s, i) => s + i.qty, 0) === 1 ? 'item' : 'items'})
              </h2>

              <div className="mt-4">
                <p className="text-[12px] text-neutral-600">
                  {subtotal >= FREE_SHIP_THRESHOLD ? (
                    <span className="font-bold text-emerald-700">
                      Free express delivery unlocked on this order
                    </span>
                  ) : (
                    <>
                      Free shipping included · Add{' '}
                      <span className="font-bold tabular-nums">
                        {formatINR(FREE_SHIP_THRESHOLD - subtotal)}
                      </span>{' '}
                      for priority dispatch
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

              <div className="mt-5 divide-y divide-black/5 max-h-[340px] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.id} className="py-3.5 first:pt-0 flex gap-3.5">
                    <button
                      type="button"
                      onClick={() => go(`product:${item.id}`)}
                      className="shrink-0 rounded-xl overflow-hidden bg-[#EDF1F6] w-16 h-16 cursor-pointer"
                    >
                      <Img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => go(`product:${item.id}`)}
                        className="text-left font-bold text-[13.5px] text-[#0C1B2E] hover:text-[#1D5CAD] transition line-clamp-1 cursor-pointer"
                      >
                        {item.name}
                      </button>
                      {item.variantLabel && (
                        <p className="text-[11.5px] text-neutral-500 mt-0.5">
                          {item.variantLabel}
                        </p>
                      )}
                      <p className="text-[12.5px] text-neutral-500 mt-0.5 tabular-nums">
                        {formatINR(item.price)} each
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="inline-flex items-center gap-1 bg-neutral-100 rounded-lg px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => setQty(item.id, item.qty - 1)}
                            className="grid place-items-center w-6 h-6 rounded-md hover:bg-white transition cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-[13px] font-bold w-6 text-center tabular-nums">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQty(item.id, item.qty + 1)}
                            className="grid place-items-center w-6 h-6 rounded-md hover:bg-white transition cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-extrabold text-[14px] text-[#0C1B2E] tabular-nums">
                            {formatINR(item.price * item.qty)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            className="text-neutral-400 hover:text-red-500 transition cursor-pointer"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-black/5 space-y-2 text-[13.5px]">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Subtotal</span>
                  <span className="font-bold tabular-nums">
                    {formatINR(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Shipping</span>
                  <span className="font-bold text-emerald-700">FREE</span>
                </div>
                <div className="flex justify-between items-baseline pt-3 mt-2 border-t border-black/5 font-display font-black text-[19px] text-[#0C1B2E]">
                  <span>Total Payable</span>
                  <span className="tabular-nums">{formatINR(subtotal)}</span>
                </div>
                <p className="text-[11.5px] text-neutral-500">
                  Inclusive of all taxes
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-5 w-full min-h-[48px] inline-flex items-center justify-center gap-2 bg-[#1D5CAD] hover:bg-[#16467E] disabled:opacity-60 text-white font-bold text-[15px] py-3.5 px-5 rounded-xl transition cursor-pointer"
              >
                <Lock size={16} />
                {submitting
                  ? payStage || 'Processing...'
                  : paymentMethod === 'Razorpay Online'
                    ? `Pay Securely · ${formatINR(subtotal)}`
                    : `Place Order · ${formatINR(subtotal)}`}
              </button>

              <div className="mt-4 pt-4 border-t border-black/5 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-neutral-600">
                <div className="flex flex-col items-center gap-1">
                  <Truck size={15} className="text-[#1D5CAD]" />
                  <span>Free Shipping</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <ShieldCheck size={15} className="text-[#1D5CAD]" />
                  <span>1-Yr Warranty</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Undo2 size={15} className="text-[#1D5CAD]" />
                  <span>7-Day Returns</span>
                </div>
              </div>
            </aside>
          </form>
        )}
      </section>

      {/* HARBAN Secure Sandbox Payment Simulator Modal */}
      {showSandboxModal && (
        <div className="fixed inset-0 z-[90] grid place-items-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl space-y-5 animate-fade-up">
            <div className="flex items-center justify-between pb-3 border-b border-black/10">
              <div>
                <p className="font-display font-black text-lg text-[#0C1B2E]">
                  HARBAN Secure Checkout
                </p>
                <p className="text-[12px] text-neutral-500">
                  Test Gateway · Instant Order Authorization
                </p>
              </div>
              <span className="bg-[#1D5CAD]/10 text-[#1D5CAD] font-bold text-[12px] px-2.5 py-1 rounded-full">
                {formatINR(subtotal)}
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-[13px] font-bold text-neutral-700">
                Select Test Payment Simulator:
              </p>
              {[
                ['upi', 'UPI / Google Pay / PhonePe', 'Instant simulation'],
                ['card', 'Debit / Credit Card (Visa / MasterCard)', 'Simulated secure card'],
                ['netbanking', 'NetBanking (SBI, HDFC, ICICI)', 'Instant bank redirect'],
              ].map(([id, label, desc]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSandboxMethod(id)}
                  className={`w-full text-left rounded-xl border p-3.5 transition flex items-center justify-between cursor-pointer ${
                    sandboxMethod === id
                      ? 'border-[#1D5CAD] bg-[#1D5CAD]/5 font-bold'
                      : 'border-black/10 bg-neutral-50 hover:border-black/20 text-neutral-700'
                  }`}
                >
                  <div>
                    <p className="text-[13.5px] text-[#0C1B2E]">{label}</p>
                    <p className="text-[11.5px] text-neutral-500">{desc}</p>
                  </div>
                  {sandboxMethod === id && (
                    <span className="w-5 h-5 rounded-full bg-[#1D5CAD] text-white grid place-items-center text-xs">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="bg-neutral-50 rounded-xl p-3.5 text-[12px] text-neutral-600 flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#1D5CAD] shrink-0" />
              <span>
                Encrypted sandbox payment. Click below to simulate successful payment and place your order.
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSandboxModal(false)
                  setSubmitting(false)
                }}
                className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[13.5px] font-bold py-3 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSandboxComplete}
                className="flex-1 bg-[#1D5CAD] hover:bg-[#16467E] text-white text-[13.5px] font-bold py-3 rounded-xl transition cursor-pointer shadow-md"
              >
                Authorize &amp; Pay
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
