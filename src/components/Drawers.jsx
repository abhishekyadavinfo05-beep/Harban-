import { useEffect, useState } from 'react'
import {
  ArrowLeft,
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

function normalizeClientPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

export function CartDrawer() {
  const {
    cart,
    cartOpen,
    setCartOpen,
    setQty,
    removeFromCart,
    placeOrder,
    trackCheckoutStarted,
    createRazorpayOrder,
    sendPhoneOtp,
    verifyPhoneOtp,
    saveAddress,
    subtotal,
    payments,
    user,
    go,
    pushToast,
  } = useShop()

  const [step, setStep] = useState('cart')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [line1, setLine1] = useState('')
  const [city, setCity] = useState('')
  const [pincode, setPincode] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery')
  const [submitting, setSubmitting] = useState(false)

  const [otpChallenge, setOtpChallenge] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [otpVerifiedPhone, setOtpVerifiedPhone] = useState('')
  const [otpMaskedPhone, setOtpMaskedPhone] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [otpCooldown, setOtpCooldown] = useState(0)
  const [otpError, setOtpError] = useState('')

  useEffect(() => {
    if (!cartOpen) {
      setStep('cart')
      setOtpChallenge('')
      setOtpCode('')
      setOtpToken('')
      setOtpVerifiedPhone('')
      setOtpMaskedPhone('')
      setOtpError('')
      setOtpCooldown(0)
      return
    }
    if (user) {
      const def =
        user.addresses?.find((a) => a.isDefault) || user.addresses?.[0] || null
      setName((prev) => prev || def?.fullName || user.name || '')
      setEmail((prev) => prev || user.email || '')
      setPhone((prev) => prev || def?.phone || user.phone || '')
      if (def) {
        setLine1((prev) => prev || def.line1 || '')
        setCity((prev) => prev || def.city || '')
        setPincode((prev) => prev || def.pincode || '')
      }
    }
  }, [cartOpen, user])

  useEffect(() => {
    if (otpCooldown <= 0) return undefined
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [otpCooldown])

  if (!cartOpen) return null

  const normalizedPhone = normalizeClientPhone(phone)
  const isPhoneValid = /^[1-9]\d{9}$/.test(normalizedPhone)
  const isPhoneVerified = Boolean(
    otpToken && otpVerifiedPhone && normalizedPhone === otpVerifiedPhone,
  )

  const handlePhoneChange = (nextVal) => {
    setPhone(nextVal)
    const nextNorm = normalizeClientPhone(nextVal)
    if (nextNorm !== otpVerifiedPhone) {
      setOtpToken('')
      setOtpVerifiedPhone('')
    }
    if (nextNorm !== normalizeClientPhone(phone)) {
      setOtpChallenge('')
      setOtpCode('')
      setOtpMaskedPhone('')
      setOtpError('')
      setOtpCooldown(0)
    }
  }

  const handleSendOtp = async (overridePhone) => {
    const raw = overridePhone ?? phone
    const norm = normalizeClientPhone(raw)
    if (!/^[1-9]\d{9}$/.test(norm)) {
      setOtpError('Please enter a valid 10-digit mobile number.')
      pushToast('Please enter a valid 10-digit mobile number')
      return false
    }
    setOtpSending(true)
    setOtpError('')
    try {
      const res = await sendPhoneOtp(raw)
      setOtpChallenge(res.challengeToken || '')
      setOtpCode('')
      setOtpToken('')
      setOtpVerifiedPhone('')
      setOtpMaskedPhone(res.maskedPhone || `+91 ${norm}`)
      setOtpCooldown(30)
      pushToast(`SMS OTP sent to ${res.maskedPhone || norm}`)
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to send OTP.'
      setOtpError(msg)
      pushToast(msg)
      return false
    } finally {
      setOtpSending(false)
    }
  }

  const handleVerifyOtp = async () => {
    const cleanOtp = otpCode.trim()
    if (!otpChallenge) {
      setOtpError('Click Send OTP first.')
      return null
    }
    if (!/^\d{6}$/.test(cleanOtp)) {
      setOtpError('Enter the 6-digit OTP code.')
      return null
    }
    setOtpVerifying(true)
    setOtpError('')
    try {
      const res = await verifyPhoneOtp({
        phone,
        otp: cleanOtp,
        challengeToken: otpChallenge,
      })
      const verifiedTok = res.otpToken || ''
      setOtpToken(verifiedTok)
      setOtpVerifiedPhone(res.phone || normalizedPhone)
      pushToast('Mobile number verified')
      return verifiedTok
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid or expired OTP.'
      setOtpError(msg)
      pushToast(msg)
      return null
    } finally {
      setOtpVerifying(false)
    }
  }

  const freeShipTarget = 1500
  const progress = Math.min(100, (subtotal / freeShipTarget) * 100)

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
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


    setSubmitting(true)
    try {
      const addressObj = {
        label: 'Delivery',
        fullName: name.trim(),
        phone: phone.trim(),
        line1: line1.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
      }
      if (user && (!user.addresses || user.addresses.length === 0)) {
        await saveAddress({ ...addressObj, label: 'Home', isDefault: true })
      }
      let rzpOrderId = null
      let rzpPaymentId = null
      let paymentStatus = paymentMethod === 'Cash on Delivery' ? 'pending' : 'initiated'

      if (paymentMethod === 'Razorpay' && payments?.razorpayEnabled) {
        try {
          const rzpOrder = await createRazorpayOrder(subtotal)
          rzpOrderId = rzpOrder?.orderId || null
          if (rzpOrder?.hasCredentials && rzpOrder?.keyId) {
            if (typeof window !== 'undefined' && !window.Razorpay) {
              await new Promise((resolve, reject) => {
                const s = document.createElement('script')
                s.src = 'https://checkout.razorpay.com/v1/checkout.js'
                s.async = true
                s.onload = resolve
                s.onerror = () => reject(new Error('Unable to load payment gateway'))
                document.body.appendChild(s)
              })
            }
            if (window.Razorpay) {
              const payResult = await new Promise((resolve, reject) => {
                const rzp = new window.Razorpay({
                  key: rzpOrder.keyId,
                  amount: rzpOrder.amount,
                  currency: rzpOrder.currency,
                  name: 'HARBAN',
                  description: 'HARBAN Grooming Order',
                  order_id: rzpOrder.orderId,
                  prefill: {
                    name: name.trim(),
                    email: email.trim(),
                    contact: phone.trim(),
                  },
                  handler: (resp) => resolve(resp),
                  modal: {
                    ondismiss: () => reject(new Error('Payment cancelled')),
                  },
                })
                rzp.open()
              })
              rzpOrderId = payResult?.razorpay_order_id || rzpOrderId
              rzpPaymentId = payResult?.razorpay_payment_id || null
              const verifyRes = await fetch('/api/payments/razorpay/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payResult),
              })
              const verifyData = await verifyRes.json().catch(() => ({}))
              if (!verifyRes.ok || !verifyData?.verified) {
                throw new Error(verifyData?.error || 'Payment signature verification failed')
              }
              paymentStatus = 'paid'
            }
          } else {
            rzpPaymentId = `pay_test_${Date.now()}`
            paymentStatus = 'test_authorized'
          }
        } catch (err) {
          pushToast(err instanceof Error ? err.message : 'Payment cancelled')
          return
        }
      }

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
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={() => setCartOpen(false)}
      />
      <aside className="absolute right-0 top-0 bottom-0 w-full max-w-[420px] bg-white flex flex-col shadow-2xl animate-drawer-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          {step === 'checkout' && cart.length > 0 ? (
            <button
              type="button"
              onClick={() => setStep('cart')}
              className="font-display font-extrabold text-[16px] flex items-center gap-2 hover:text-[#1D5CAD] transition cursor-pointer"
            >
              <ArrowLeft size={17} /> Checkout Details
            </button>
          ) : (
            <p className="font-display font-extrabold text-lg flex items-center gap-2">
              <ShoppingCart size={18} /> Your Cart
              <span className="text-xs font-bold bg-neutral-100 rounded-full px-2 py-0.5">
                {cart.length}
              </span>
            </p>
          )}
          <button
            onClick={() => setCartOpen(false)}
            className="grid place-items-center w-8 h-8 rounded-full hover:bg-neutral-100 transition"
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
                className="mt-4 bg-[#0C1B2E] text-white text-sm font-bold px-6 py-2.5 rounded-full hover:bg-black transition"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        ) : step === 'cart' ? (
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
                    <span className="font-bold">
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
                  <Img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[13.5px] leading-tight truncate">
                      {item.name}
                    </p>
                    <p className="text-[12.5px] text-neutral-500 mt-0.5">
                      {formatINR(item.price)}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="inline-flex items-center gap-1 bg-white rounded-full border border-black/10 px-1">
                        <button
                          onClick={() => setQty(item.id, item.qty - 1)}
                          className="grid place-items-center w-6 h-6 rounded-full hover:bg-neutral-100"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-[13px] font-bold w-4 text-center">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => setQty(item.id, item.qty + 1)}
                          className="grid place-items-center w-6 h-6 rounded-full hover:bg-neutral-100"
                          aria-label="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[14px]">
                          {formatINR(item.price * item.qty)}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-neutral-400 hover:text-red-500 transition"
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
                <span className="font-bold">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[13.5px] mt-1">
                <span className="text-neutral-600">Shipping</span>
                <span className="font-bold text-[#174A8B]">FREE</span>
              </div>
              <div className="flex justify-between font-display font-black text-lg mt-2 pt-2 border-t border-black/5">
                <span>Total</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              <button
                onClick={() => {
                  trackCheckoutStarted()
                  setStep('checkout')
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
        ) : (
          <form
            onSubmit={handleCheckoutSubmit}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
              {!user ? (
                <div className="bg-[#EDF1F6] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[12px] text-neutral-700">
                    Have an account? Sign in for saved addresses.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCartOpen(false)
                      go('account')
                    }}
                    className="shrink-0 text-[12px] font-bold text-[#1D5CAD] hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              ) : (
                user.addresses?.length > 0 && (
                  <div>
                    <p className="text-[11.5px] font-bold text-neutral-600 mb-1.5">
                      Saved Addresses
                    </p>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {user.addresses.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            setName(a.fullName || user.name)
                            handlePhoneChange(a.phone || user.phone || '')
                            setLine1(a.line1)
                            setCity(a.city)
                            setPincode(a.pincode)
                          }}
                          className={`shrink-0 text-left rounded-xl border px-3 py-2 text-[11.5px] transition cursor-pointer ${
                            line1 === a.line1 && pincode === a.pincode
                              ? 'border-[#1D5CAD] bg-[#1D5CAD]/5'
                              : 'border-black/10 bg-neutral-50'
                          }`}
                        >
                          <span className="font-bold block">{a.label || 'Home'}</span>
                          <span className="text-neutral-500">
                            {a.city} · {a.pincode}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              )}

              <div>
                <label className="block text-[11.5px] font-bold text-neutral-700 mb-1">
                  Full Name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Receiver name"
                  className="w-full bg-neutral-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11.5px] font-bold text-neutral-700 mb-1">
                    Email for Order Updates
                  </label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-neutral-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-bold text-neutral-700 mb-1">
                    Mobile Number
                  </label>
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-neutral-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11.5px] font-bold text-neutral-700 mb-1">
                  Delivery Address
                </label>
                <input
                  required
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  placeholder="House no., Street, Area"
                  className="w-full bg-neutral-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11.5px] font-bold text-neutral-700 mb-1">
                    City
                  </label>
                  <input
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Mumbai"
                    className="w-full bg-neutral-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-bold text-neutral-700 mb-1">
                    PIN Code
                  </label>
                  <input
                    required
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="400001"
                    className="w-full bg-neutral-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                  />
                </div>
              </div>

              <div>
                <p className="text-[11.5px] font-bold text-neutral-700 mb-1.5">
                  Payment Method
                </p>
                <div
                  className={`grid gap-2 ${
                    payments?.razorpayEnabled ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
                  }`}
                >
                  {[
                    'Cash on Delivery',
                    'UPI',
                    'Card',
                    ...(payments?.razorpayEnabled ? ['Razorpay'] : []),
                  ].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 px-2 rounded-xl border text-[11.5px] font-bold transition cursor-pointer ${
                        paymentMethod === method
                          ? 'bg-[#0C1B2E] text-white border-[#0C1B2E]'
                          : 'bg-white border-black/10 hover:border-[#1D5CAD]'
                      }`}
                    >
                      {method === 'Cash on Delivery' ? 'COD' : method}
                    </button>
                  ))}
                </div>
                {paymentMethod === 'Razorpay' && payments?.razorpayEnabled && (
                  <p className="text-[11px] text-[#1D5CAD] font-semibold mt-1.5">
                    Pay online via UPI, Cards, NetBanking or Wallets (Razorpay Test Mode).
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-black/5 px-5 py-4 bg-white">
              <div className="flex justify-between font-display font-black text-base mb-3">
                <span>Payable Total</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#1D5CAD] hover:bg-[#16467E] disabled:opacity-60 text-white font-bold text-[14px] py-3 rounded-xl transition cursor-pointer"
              >
                {submitting ? 'Placing Order...' : `Place Order · ${formatINR(subtotal)}`}
              </button>
            </div>
          </form>
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
                {activeOrder.items.reduce((s, i) => s + i.qty, 0)} items ·{' '}
                {formatINR(activeOrder.total)}
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
                {new Date(activeOrder.eta).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
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
          onClick={() => go('account')}
          className="bg-[#1D5CAD] hover:bg-[#16467E] text-white text-[13.5px] font-bold px-6 py-3 rounded-full transition cursor-pointer"
        >
          {user ? 'View in My Orders' : 'Sign In to View Orders'}
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
