import { useState } from 'react'
import {
  Menu,
  Package,
  Search,
  ShoppingCart,
  User,
  X,
} from 'lucide-react'
import { NAV_ITEMS, useShop } from '../store/shop'

export default function Header() {
  const {
    cartCount,
    setCartOpen,
    setTrackOpen,
    search,
    setSearch,
    route,
    go,
    user,
  } = useShop()
  const [mobileNav, setMobileNav] = useState(false)

  const handleSearch = (value) => {
    setSearch(value)
    if (value.trim() && route !== 'all') go('all')
  }

  return (
    <header className="relative z-40 bg-white border-b border-black/5">
      {/* announcement strip */}
      <div className="bg-[#0C1B2E] text-white/85 text-[11px] sm:text-xs">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 truncate">
            <span>Free Shipping on All Orders</span>
            <span className="hidden sm:inline text-white/30">|</span>
            <span className="hidden sm:inline">1 Year Warranty</span>
            <span className="hidden md:inline text-white/30">|</span>
            <span className="hidden md:inline">Easy Returns</span>
          </p>
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={() => setTrackOpen(true)}
              className="flex items-center gap-1.5 hover:text-white transition"
            >
              <Package size={13} /> Track Order
            </button>
            <button
              onClick={() => go('support')}
              className="hidden sm:flex items-center gap-1.5 hover:text-white transition"
            >
              Help
            </button>
          </div>
        </div>
      </div>

      {/* main bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        <button
          onClick={() => go('home')}
          className="text-left leading-none shrink-0"
          aria-label="HARBAN home"
        >
          <span className="font-display font-900 text-[26px] sm:text-[30px] tracking-[0.18em] font-black">
            HARBAN
          </span>
          <span className="block text-[8.5px] tracking-[0.32em] text-neutral-500 font-semibold mt-0.5">
            GROOM BETTER. EVERYDAY.
          </span>
        </button>

        {/* desktop search */}
        <div className="hidden md:flex flex-1 max-w-md mx-auto items-center gap-2 bg-neutral-100 rounded-full px-4 py-2">
          <Search size={16} className="text-neutral-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search products..."
            className="bg-transparent outline-none text-sm w-full placeholder:text-neutral-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-neutral-400 hover:text-neutral-700"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* desktop nav */}
        <nav className="hidden lg:flex items-center gap-7 ml-2 text-[13.5px] font-semibold text-neutral-800">
          {NAV_ITEMS.map((item) => {
            const active =
              route === item.id ||
              (item.id === 'trimmers' && ['beard', 'body', 'nose'].includes(route))
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`transition hover:text-[#1D5CAD] ${
                  active ? 'text-[#1D5CAD]' : ''
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="flex items-center gap-1.5 ml-auto">
          {user?.role === 'admin' && (
            <button
              onClick={() => go('admin')}
              className={`hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-bold transition cursor-pointer ${
                route === 'admin'
                  ? 'bg-[#0C1B2E] text-white'
                  : 'bg-[#1D5CAD]/10 text-[#1D5CAD] hover:bg-[#1D5CAD] hover:text-white'
              }`}
            >
              Admin
            </button>
          )}
          <button
            onClick={() => go('account')}
            className={`inline-flex items-center justify-center gap-1.5 h-10 rounded-full transition cursor-pointer ${
              user
                ? 'px-2 sm:px-3 bg-[#0C1B2E]/5 hover:bg-[#1D5CAD]/10 text-[#0C1B2E]'
                : 'w-10 hover:bg-neutral-100'
            }`}
            aria-label={user ? `Account (${user.name})` : 'Sign in or create account'}
          >
            {user ? (
              <>
                <span className="w-6 h-6 rounded-full bg-[#1D5CAD] text-white text-[10px] font-black grid place-items-center shrink-0">
                  {user.name.trim().slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden sm:inline text-[12.5px] font-bold max-w-[90px] truncate">
                  {user.name.split(' ')[0]}
                </span>
              </>
            ) : (
              <User size={19} />
            )}
          </button>
          <button
            onClick={() => setCartOpen(true)}
            className="relative grid place-items-center w-10 h-10 rounded-full hover:bg-neutral-100 transition"
            aria-label={`Cart, ${cartCount} items`}
          >
            <ShoppingCart size={19} />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#1D5CAD] text-white text-[10px] font-bold grid place-items-center">
                {cartCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setMobileNav((v) => !v)}
            className="lg:hidden grid place-items-center w-10 h-10 rounded-full hover:bg-neutral-100 transition"
            aria-label="Menu"
          >
            {mobileNav ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* mobile search */}
      <div className="md:hidden px-4 pb-2.5">
        <div className="flex items-center gap-2 bg-neutral-100 rounded-full px-4 py-2">
          <Search size={16} className="text-neutral-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search products..."
            className="bg-transparent outline-none text-sm w-full min-w-0 placeholder:text-neutral-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-neutral-400 hover:text-neutral-700 shrink-0"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* mobile nav */}
      {mobileNav && (
        <nav className="lg:hidden border-t border-black/5 bg-white px-4 py-2 animate-fade-up">
          {NAV_ITEMS.map((item) => {
            const active =
              route === item.id ||
              (item.id === 'trimmers' && ['beard', 'body', 'nose'].includes(route))
            return (
              <button
                key={item.id}
                onClick={() => {
                  go(item.id)
                  setMobileNav(false)
                }}
                className={`block w-full text-left py-3 text-[14.5px] font-semibold border-b border-black/5 ${
                  active ? 'text-[#1D5CAD]' : 'text-neutral-800'
                }`}
              >
                {item.label}
              </button>
            )
          })}
          <button
            onClick={() => {
              go('account')
              setMobileNav(false)
            }}
            className={`block w-full text-left py-3 text-[14.5px] font-semibold border-b border-black/5 ${
              route === 'account' ? 'text-[#1D5CAD]' : 'text-neutral-800'
            }`}
          >
            {user ? `My Account (${user.name.split(' ')[0]})` : 'Sign In / Create Account'}
          </button>
          <button
            onClick={() => {
              setTrackOpen(true)
              setMobileNav(false)
            }}
            className="block w-full text-left py-3 text-[14.5px] font-semibold text-neutral-800"
          >
            Track Order
          </button>
        </nav>
      )}
    </header>
  )
}
