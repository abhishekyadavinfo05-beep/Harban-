import { useEffect, useState } from 'react'
import {
  Check,
  Eye,
  EyeOff,
  FileText,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
  User,
  XCircle,
} from 'lucide-react'
import Img from './Img'
import AdminPanel from './AdminPanel'
import { ORDER_STAGES, formatINR, useShop } from '../store/shop'

function getInitials(name = 'H') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return (parts[0]?.slice(0, 2) || 'HB').toUpperCase()
}

/* ----------------------------------------------------------- Login / Signup */

function AuthView() {
  const { loginWithEmail, registerWithEmail, loginWithGoogle, setTrackOpen } =
    useShop()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const switchMode = (next) => {
    setMode(next)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res =
      mode === 'login'
        ? await loginWithEmail({ email, password })
        : await registerWithEmail({ name, email, phone, password })
    setBusy(false)
    if (!res.ok) setError(res.error)
  }

  const handleGoogle = async () => {
    setError('')
    setBusy(true)
    const res = await loginWithGoogle()
    setBusy(false)
    if (!res.ok) setError(res.error)
  }

  const perks = [
    {
      icon: Package,
      title: 'All Orders in One Place',
      body: 'View complete order history, live dispatch status, and delivery dates anytime.',
    },
    {
      icon: MapPin,
      title: 'Faster Checkout',
      body: 'Save your Home and Office delivery addresses for 1-tap checkout.',
    },
    {
      icon: RotateCcw,
      title: 'Instant Reorder & Returns',
      body: 'Reorder blades and trimmers in one click or manage active orders easily.',
    },
    {
      icon: ShieldCheck,
      title: '1-Year Doorstep Warranty',
      body: 'Every purchase linked to your email is covered under HARBAN doorstep support.',
    },
  ]

  return (
    <>
      <section className="bg-[#0C1B2E] text-white">
        <div className="max-w-7xl mx-auto px-4 py-7 sm:py-9">
          <h1 className="font-display font-black text-[24px] sm:text-[32px] tracking-tight">
            {mode === 'login' ? 'Customer Sign In' : 'Create Your Account'}
          </h1>
          <p className="text-white/65 text-[13.5px] mt-1">
            Sign in with your email to view your orders, live tracking, and saved addresses.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-7 sm:py-10 grid lg:grid-cols-[1.05fr_0.95fr] gap-6 items-start">
        <div className="bg-white rounded-2xl border border-black/5 p-5 sm:p-8 shadow-sm">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 bg-neutral-100 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-2.5 text-[13px] font-bold rounded-lg transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-[#0C1B2E] shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`py-2.5 text-[13px] font-bold rounded-lg transition cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-[#0C1B2E] shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-[12px] font-bold text-neutral-700 mb-1.5">
                  Full Name
                </label>
                <div className="flex items-center gap-2.5 bg-neutral-100 rounded-xl px-3.5 py-2.5 focus-within:ring-2 ring-[#1D5CAD]/40">
                  <User size={16} className="text-neutral-400 shrink-0" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rohit Sharma"
                    className="w-full min-w-0 bg-transparent text-sm outline-none"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[12px] font-bold text-neutral-700 mb-1.5">
                Email Address
              </label>
              <div className="flex items-center gap-2.5 bg-neutral-100 rounded-xl px-3.5 py-2.5 focus-within:ring-2 ring-[#1D5CAD]/40">
                <Mail size={16} className="text-neutral-400 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full min-w-0 bg-transparent text-sm outline-none"
                  required
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-[12px] font-bold text-neutral-700 mb-1.5">
                  Mobile Number (Optional)
                </label>
                <div className="flex items-center gap-2.5 bg-neutral-100 rounded-xl px-3.5 py-2.5 focus-within:ring-2 ring-[#1D5CAD]/40">
                  <Phone size={16} className="text-neutral-400 shrink-0" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full min-w-0 bg-transparent text-sm outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[12px] font-bold text-neutral-700 mb-1.5">
                Password
              </label>
              <div className="flex items-center gap-2.5 bg-neutral-100 rounded-xl px-3.5 py-2.5 focus-within:ring-2 ring-[#1D5CAD]/40">
                <Lock size={16} className="text-neutral-400 shrink-0" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === 'register'
                      ? 'Minimum 6 characters'
                      : 'Enter your password'
                  }
                  className="w-full min-w-0 bg-transparent text-sm outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="text-neutral-400 hover:text-neutral-700 shrink-0 cursor-pointer"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-[#0C1B2E] hover:bg-[#1D5CAD] disabled:opacity-60 text-white font-bold text-[14px] py-3.5 rounded-xl transition cursor-pointer"
            >
              {busy
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign In to My Account'
                  : 'Create Account'}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-black/10" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              or
            </span>
            <span className="h-px flex-1 bg-black/10" />
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleGoogle}
            className="w-full bg-white hover:bg-neutral-50 border border-black/15 text-[#0C1B2E] font-bold text-[13.5px] py-3 rounded-xl transition inline-flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.22 1.18-3.25 0-6-2.19-6.98-5.14H1.01v3.14C3.02 21.17 7.18 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.02 14.03a7.17 7.17 0 0 1 0-4.06V6.83H1.01a11.98 11.98 0 0 0 0 10.34l4.01-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.83c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.29 0 12 0 7.18 0 3.02 2.83 1.01 6.83l4.01 3.14C6 7.02 8.75 4.83 12 4.83Z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="mt-5 pt-4 border-t border-black/5 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-neutral-500">
            <span>
              {mode === 'login' ? 'New to HARBAN?' : 'Already have an account?'}
            </span>
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="font-bold text-[#1D5CAD] hover:underline cursor-pointer"
            >
              {mode === 'login' ? 'Create a free account →' : 'Sign in instead →'}
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-black/5 text-center">
            <button
              type="button"
              onClick={() => setTrackOpen(true)}
              className="text-[12px] font-semibold text-neutral-500 hover:text-[#1D5CAD] transition cursor-pointer"
            >
              Only checking a guest Order ID? Track Order →
            </button>
          </div>
        </div>

        {/* Account Benefits Card */}
        <div className="bg-[#0C1B2E] text-white rounded-2xl p-6 sm:p-7 space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#E8C547]">
              HARBAN Account
            </p>
            <h2 className="font-display font-extrabold text-[20px] sm:text-[22px] mt-1 leading-snug">
              Manage your orders &amp; grooming kit effortlessly
            </h2>
          </div>

          <div className="space-y-4">
            {perks.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-3.5">
                <span className="grid place-items-center w-9 h-9 rounded-xl bg-white/10 text-[#E8C547] shrink-0 mt-0.5">
                  <Icon size={17} />
                </span>
                <div>
                  <p className="text-[13.5px] font-bold">{title}</p>
                  <p className="text-[12px] text-white/65 leading-relaxed mt-0.5">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

/* ----------------------------------------------------------- Customer Portal */

export default function AccountPage({ initialTab = 'orders' }) {
  const {
    user,
    userOrders,
    logout,
    updateProfile,
    changePassword,
    saveAddress,
    deleteAddress,
    setDefaultAddress,
    cancelOrder,
    reorder,
    go,
    products,
  } = useShop()

  const [tab, setTab] = useState(
    initialTab === 'admin' && user?.role === 'admin' ? 'admin' : 'orders',
  )
  const [orderFilter, setOrderFilter] = useState('all')
  const [invoiceId, setInvoiceId] = useState(null)

  useEffect(() => {
    if (initialTab === 'admin' && user?.role === 'admin') {
      setTab('admin')
    }
  }, [initialTab, user?.role])

  /* Profile state */
  const [pName, setPName] = useState(user?.name || '')
  const [pPhone, setPPhone] = useState(user?.phone || '')
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  /* Address form state */
  const [showAddrForm, setShowAddrForm] = useState(false)
  const [addrLabel, setAddrLabel] = useState('Home')
  const [addrName, setAddrName] = useState(user?.name || '')
  const [addrPhone, setAddrPhone] = useState(user?.phone || '')
  const [addrLine, setAddrLine] = useState('')
  const [addrCity, setAddrCity] = useState('')
  const [addrState, setAddrState] = useState('')
  const [addrPin, setAddrPin] = useState('')
  const [addrDefault, setAddrDefault] = useState(true)

  /* Sync local input fields when user profile arrives */
  useEffect(() => {
    if (!user) return
    setPName(user.name || '')
    setPPhone(user.phone || '')
    setAddrName((prev) => prev || user.name || '')
    setAddrPhone((prev) => prev || user.phone || '')
  }, [user])

  if (!user) return <AuthView />

  const addresses = user.addresses || []
  const activeOrdersCount = userOrders.filter(
    (o) => !o.cancelled && o.status < ORDER_STAGES.length - 1,
  ).length

  const filteredOrders = userOrders.filter((o) => {
    if (orderFilter === 'active') {
      return !o.cancelled && o.status < ORDER_STAGES.length - 1
    }
    if (orderFilter === 'delivered') {
      return !o.cancelled && o.status >= ORDER_STAGES.length - 1
    }
    if (orderFilter === 'cancelled') return !!o.cancelled
    return true
  })

  const handleAddAddress = async (e) => {
    e.preventDefault()
    if (!addrName.trim() || !addrLine.trim() || !addrCity.trim() || !addrPin.trim()) {
      return
    }
    const res = await saveAddress({
      label: addrLabel,
      fullName: addrName.trim(),
      phone: addrPhone.trim() || user.phone || '',
      line1: addrLine.trim(),
      city: addrCity.trim(),
      state: addrState.trim(),
      pincode: addrPin.trim(),
      isDefault: addrDefault,
    })
    if (res?.ok) {
      setAddrLine('')
      setAddrCity('')
      setAddrState('')
      setAddrPin('')
      setShowAddrForm(false)
    }
  }

  const handleProfileSave = async (e) => {
    e.preventDefault()
    await updateProfile({ name: pName, phone: pPhone })
  }

  const handlePasswordSave = async (e) => {
    e.preventDefault()
    setPwMsg('')
    const res = await changePassword({ currentPassword: curPw, newPassword: newPw })
    if (!res.ok) {
      setPwMsg(res.error)
      return
    }
    setCurPw('')
    setNewPw('')
    setPwMsg('Password changed successfully.')
  }

  return (
    <>
      {/* Top Customer Header */}
      <section className="bg-[#0C1B2E] text-white">
        <div className="max-w-7xl mx-auto px-4 py-7 sm:py-9 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#1D5CAD] text-white font-display font-black text-lg grid place-items-center shrink-0">
              {getInitials(user.name)}
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-black text-[22px] sm:text-[28px] leading-tight truncate">
                {user.name}
              </h1>
              <p className="text-white/65 text-[13px] truncate">
                {user.email}
                {user.phone ? ` · ${user.phone}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-white/10 rounded-xl px-3.5 py-2 text-center">
              <p className="font-display font-black text-[15px] text-[#E8C547] leading-none">
                {userOrders.length}
              </p>
              <p className="text-[10.5px] text-white/65 mt-0.5">Orders</p>
            </div>
            <div className="bg-white/10 rounded-xl px-3.5 py-2 text-center">
              <p className="font-display font-black text-[15px] text-[#E8C547] leading-none">
                {activeOrdersCount}
              </p>
              <p className="text-[10.5px] text-white/65 mt-0.5">In Transit</p>
            </div>
            <div className="bg-white/10 rounded-xl px-3.5 py-2 text-center">
              <p className="font-display font-black text-[15px] text-[#E8C547] leading-none">
                {addresses.length}
              </p>
              <p className="text-[10.5px] text-white/65 mt-0.5">Addresses</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-red-500/80 text-white text-[12.5px] font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      </section>

      <section
        className={`${
          tab === 'admin' && user.role === 'admin'
            ? 'max-w-[1440px]'
            : 'max-w-7xl'
        } mx-auto px-4 py-6 sm:py-8`}
      >
        {/* Account Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-6">
          {[
            { id: 'orders', label: `My Orders (${userOrders.length})`, icon: Package },
            { id: 'addresses', label: `Saved Addresses (${addresses.length})`, icon: MapPin },
            { id: 'profile', label: 'Profile & Security', icon: User },
            ...(user.role === 'admin'
              ? [{ id: 'admin', label: 'Admin Dashboard', icon: ShieldCheck }]
              : []),
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => (id === 'admin' ? go('admin') : setTab(id))}
              className={`shrink-0 inline-flex items-center gap-2 text-[13px] font-bold px-4 py-2.5 rounded-full border transition cursor-pointer ${
                tab === id
                  ? 'bg-[#0C1B2E] text-white border-[#0C1B2E]'
                  : 'bg-white text-neutral-700 border-black/10 hover:border-[#1D5CAD]'
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* TAB 0: AUTHORIZED ADMIN PANEL */}
        {tab === 'admin' && user.role === 'admin' && <AdminPanel />}

        {/* TAB 1: MY ORDERS */}
        {tab === 'orders' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {[
                  ['all', 'All Orders'],
                  ['active', 'Active'],
                  ['delivered', 'Delivered'],
                  ['cancelled', 'Cancelled'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setOrderFilter(key)}
                    className={`shrink-0 text-[12px] font-bold px-3.5 py-1.5 rounded-full border transition cursor-pointer ${
                      orderFilter === key
                        ? 'bg-[#1D5CAD] text-white border-[#1D5CAD]'
                        : 'bg-white text-neutral-600 border-black/10 hover:border-[#1D5CAD]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => go('trimmers')}
                className="text-[12.5px] font-bold text-[#1D5CAD] hover:underline cursor-pointer"
              >
                Continue Shopping →
              </button>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-black/5 p-8 sm:p-12 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-neutral-100 grid place-items-center text-neutral-400">
                  <ShoppingBag size={24} />
                </div>
                <h2 className="font-display font-extrabold text-lg mt-4">
                  {orderFilter === 'all'
                    ? 'No orders placed yet'
                    : `No ${orderFilter} orders`}
                </h2>
                <p className="text-[13px] text-neutral-500 mt-1 max-w-sm mx-auto">
                  When you place an order on HARBAN, you&apos;ll be able to track live delivery stages and download order details right here.
                </p>
                <button
                  type="button"
                  onClick={() => go('trimmers')}
                  className="mt-5 bg-[#0C1B2E] hover:bg-[#1D5CAD] text-white text-[13px] font-bold px-6 py-2.5 rounded-full transition cursor-pointer"
                >
                  Explore Trimmers
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const currentStage = ORDER_STAGES[order.status] || 'Order placed'
                  const placedDate = new Date(order.placedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                  const etaDate = new Date(order.eta).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })
                  const showInvoice = invoiceId === order.id

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-black/5 overflow-hidden"
                    >
                      {/* Top Order Meta Bar */}
                      <div className="bg-neutral-50/80 border-b border-black/5 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[12.5px]">
                          <div>
                            <span className="text-neutral-500 block text-[11px]">Order ID</span>
                            <span className="font-extrabold text-[#0C1B2E]">{order.id}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block text-[11px]">Placed On</span>
                            <span className="font-semibold">{placedDate}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block text-[11px]">Payment</span>
                            <span className="font-semibold">
                              {order.paymentMethod || 'Cash on Delivery'}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block text-[11px]">Total</span>
                            <span className="font-extrabold text-[#0C1B2E]">
                              {formatINR(order.total)}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[11.5px] font-bold px-3 py-1 rounded-full ${
                            order.cancelled
                              ? 'bg-red-100 text-red-700'
                              : order.status >= ORDER_STAGES.length - 1
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-[#1D5CAD]/10 text-[#1D5CAD]'
                          }`}
                        >
                          {order.cancelled ? 'Cancelled' : currentStage}
                        </span>
                      </div>

                      <div className="p-4 sm:p-6 space-y-5">
                        {/* Ordered Items */}
                        <div className="divide-y divide-black/5">
                          {order.items.map((item) => {
                            const catalogMatch = products.find((p) => p.id === item.id)
                            return (
                              <div
                                key={`${order.id}-${item.id}`}
                                className="py-3 first:pt-0 last:pb-0 flex items-center gap-3.5"
                              >
                                <Img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-15 h-15 sm:w-16 sm:h-16 rounded-xl object-cover bg-neutral-100 shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      catalogMatch && go(`product:${catalogMatch.id}`)
                                    }
                                    className="font-display font-bold text-[14px] hover:text-[#1D5CAD] text-left truncate block max-w-full cursor-pointer"
                                  >
                                    {item.name}
                                  </button>
                                  <p className="text-[12px] text-neutral-500 mt-0.5">
                                    Qty: {item.qty} × {formatINR(item.price)}
                                  </p>
                                </div>
                                <span className="font-bold text-[14px] shrink-0">
                                  {formatINR(item.price * item.qty)}
                                </span>
                              </div>
                            )
                          })}
                        </div>

                        {/* Live Delivery Stepper */}
                        {!order.cancelled && (
                          <div className="bg-neutral-50 rounded-xl p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                              <span className="text-[12px] font-bold text-[#0C1B2E] flex items-center gap-1.5">
                                <Truck size={14} className="text-[#1D5CAD]" />
                                Delivery Status: {currentStage}
                              </span>
                              <span className="text-[12px] text-neutral-500">
                                Estimated delivery:{' '}
                                <strong className="text-neutral-800">{etaDate}</strong>
                              </span>
                            </div>

                            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                              {ORDER_STAGES.map((label, idx) => {
                                const done = idx <= order.status
                                return (
                                  <div key={label} className="text-center">
                                    <div
                                      className={`h-1.5 rounded-full mb-1.5 ${
                                        done ? 'bg-[#1D5CAD]' : 'bg-neutral-200'
                                      }`}
                                    />
                                    <span
                                      className={`block text-[10px] sm:text-[11px] leading-tight ${
                                        done
                                          ? 'font-bold text-[#0C1B2E]'
                                          : 'text-neutral-400'
                                      }`}
                                    >
                                      {label}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Shipping Address & Action Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                          <div className="text-[12px] text-neutral-600">
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
                              <p className="text-neutral-400">
                                Standard Free Delivery across India
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => reorder(order)}
                              className="inline-flex items-center gap-1.5 bg-[#0C1B2E] hover:bg-[#1D5CAD] text-white text-[12px] font-bold px-4 py-2 rounded-full transition cursor-pointer"
                            >
                              <RotateCcw size={13} /> Buy Again
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setInvoiceId(showInvoice ? null : order.id)
                              }
                              className="inline-flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[12px] font-bold px-3.5 py-2 rounded-full transition cursor-pointer"
                            >
                              <FileText size={13} />{' '}
                              {showInvoice ? 'Hide Summary' : 'Order Summary'}
                            </button>
                            {!order.cancelled && order.status <= 1 && (
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

                        {showInvoice && (
                          <div className="border-t border-dashed border-black/15 pt-4 text-[12.5px] text-neutral-600 grid sm:grid-cols-2 gap-3">
                            <div>
                              <p className="font-bold text-neutral-800">
                                Customer Details
                              </p>
                              <p>{order.customerName || user.name}</p>
                              <p>{order.customerEmail || user.email}</p>
                              {(order.phone || user.phone) && (
                                <p>{order.phone || user.phone}</p>
                              )}
                            </div>
                            <div className="sm:text-right space-y-1">
                              <p>
                                Items Subtotal:{' '}
                                <strong className="text-neutral-800">
                                  {formatINR(order.subtotal)}
                                </strong>
                              </p>
                              <p>
                                Shipping:{' '}
                                <strong className="text-emerald-700">FREE</strong>
                              </p>
                              <p className="text-[13.5px] font-extrabold text-[#0C1B2E]">
                                Grand Total (incl. GST): {formatINR(order.total)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SAVED ADDRESSES */}
        {tab === 'addresses' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-extrabold text-lg">
                Saved Delivery Addresses
              </h2>
              <button
                type="button"
                onClick={() => setShowAddrForm((v) => !v)}
                className="inline-flex items-center gap-1.5 bg-[#0C1B2E] hover:bg-[#1D5CAD] text-white text-[12.5px] font-bold px-4 py-2 rounded-full transition cursor-pointer"
              >
                <Plus size={15} /> {showAddrForm ? 'Close' : 'Add New Address'}
              </button>
            </div>

            {showAddrForm && (
              <form
                onSubmit={handleAddAddress}
                className="bg-white rounded-2xl border border-black/5 p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-wrap gap-2">
                  {['Home', 'Office', 'Other'].map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setAddrLabel(lbl)}
                      className={`text-[12px] font-bold px-3.5 py-1.5 rounded-full border transition cursor-pointer ${
                        addrLabel === lbl
                          ? 'bg-[#0C1B2E] text-white border-[#0C1B2E]'
                          : 'bg-neutral-50 border-black/10'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    required
                    value={addrName}
                    onChange={(e) => setAddrName(e.target.value)}
                    placeholder="Receiver Full Name"
                    className="w-full bg-neutral-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                  />
                  <input
                    required
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value)}
                    placeholder="Mobile Number"
                    className="w-full bg-neutral-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                  />
                </div>

                <input
                  required
                  value={addrLine}
                  onChange={(e) => setAddrLine(e.target.value)}
                  placeholder="Flat / House No., Building, Street, Area"
                  className="w-full bg-neutral-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                />

                <div className="grid sm:grid-cols-3 gap-3">
                  <input
                    required
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                    placeholder="City"
                    className="w-full bg-neutral-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                  />
                  <input
                    value={addrState}
                    onChange={(e) => setAddrState(e.target.value)}
                    placeholder="State"
                    className="w-full bg-neutral-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                  />
                  <input
                    required
                    value={addrPin}
                    onChange={(e) => setAddrPin(e.target.value)}
                    placeholder="PIN Code (e.g. 400001)"
                    className="w-full bg-neutral-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                  />
                </div>

                <label className="flex items-center gap-2 text-[13px] text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addrDefault}
                    onChange={(e) => setAddrDefault(e.target.checked)}
                    className="accent-[#1D5CAD]"
                  />
                  Set as default delivery address
                </label>

                <button
                  type="submit"
                  className="bg-[#1D5CAD] hover:bg-[#16467E] text-white text-[13px] font-bold px-6 py-2.5 rounded-full transition cursor-pointer"
                >
                  Save Address
                </button>
              </form>
            )}

            {addresses.length === 0 ? (
              <div className="bg-white rounded-2xl border border-black/5 p-8 text-center">
                <p className="font-bold text-neutral-800">No saved addresses yet</p>
                <p className="text-[13px] text-neutral-500 mt-1">
                  Add your home or office address for faster 1-click checkout.
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {addresses.map((a) => (
                  <div
                    key={a.id}
                    className={`bg-white rounded-2xl border p-5 flex flex-col justify-between gap-4 ${
                      a.isDefault ? 'border-[#1D5CAD]/50' : 'border-black/5'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider bg-neutral-100 px-2.5 py-0.5 rounded-full">
                          {a.label || 'Home'}
                        </span>
                        {a.isDefault && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1D5CAD]">
                            <Check size={12} /> Default
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-[14px]">{a.fullName}</p>
                      <p className="text-[12.5px] text-neutral-600 mt-1 leading-relaxed">
                        {a.line1}, {a.city}
                        {a.state ? `, ${a.state}` : ''} — {a.pincode}
                      </p>
                      {a.phone && (
                        <p className="text-[12px] text-neutral-500 mt-1">
                          Phone: {a.phone}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-black/5 text-[12px]">
                      {!a.isDefault ? (
                        <button
                          type="button"
                          onClick={() => setDefaultAddress(a.id)}
                          className="font-bold text-[#1D5CAD] hover:underline cursor-pointer"
                        >
                          Set as Default
                        </button>
                      ) : (
                        <span className="text-neutral-400">Primary address</span>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteAddress(a.id)}
                        className="inline-flex items-center gap-1 text-red-600 hover:underline font-semibold cursor-pointer"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PROFILE & SECURITY */}
        {tab === 'profile' && (
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <form
              onSubmit={handleProfileSave}
              className="bg-white rounded-2xl border border-black/5 p-5 sm:p-6 space-y-4"
            >
              <h2 className="font-display font-extrabold text-lg">
                Account Information
              </h2>
              <div>
                <label className="block text-[12px] font-bold text-neutral-700 mb-1">
                  Email Address
                </label>
                <input
                  disabled
                  value={user.email}
                  className="w-full bg-neutral-100 text-neutral-500 rounded-xl px-4 py-2.5 text-sm outline-none cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-neutral-700 mb-1">
                  Full Name
                </label>
                <input
                  required
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className="w-full bg-neutral-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-neutral-700 mb-1">
                  Mobile Number
                </label>
                <input
                  value={pPhone}
                  onChange={(e) => setPPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-neutral-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                />
              </div>
              <button
                type="submit"
                className="bg-[#0C1B2E] hover:bg-[#1D5CAD] text-white text-[13px] font-bold px-5 py-2.5 rounded-full transition cursor-pointer"
              >
                Save Changes
              </button>
            </form>

            <form
              onSubmit={handlePasswordSave}
              className="bg-white rounded-2xl border border-black/5 p-5 sm:p-6 space-y-4"
            >
              <h2 className="font-display font-extrabold text-lg">
                Change Password
              </h2>
              {pwMsg && (
                <p
                  className={`text-[12.5px] font-semibold px-3.5 py-2 rounded-xl ${
                    pwMsg.includes('successfully')
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {pwMsg}
                </p>
              )}
              <div>
                <label className="block text-[12px] font-bold text-neutral-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={curPw}
                  onChange={(e) => setCurPw(e.target.value)}
                  className="w-full bg-neutral-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-neutral-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full bg-neutral-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[#1D5CAD]/40"
                />
              </div>
              <button
                type="submit"
                className="bg-[#0C1B2E] hover:bg-[#1D5CAD] text-white text-[13px] font-bold px-5 py-2.5 rounded-full transition cursor-pointer"
              >
                Update Password
              </button>
            </form>
          </div>
        )}
      </section>
    </>
  )
}
