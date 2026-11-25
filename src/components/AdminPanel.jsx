import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  HelpCircle,
  Home,
  Inbox,
  Megaphone,
  Menu,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  Tag,
  Users,
  X,
} from 'lucide-react'
import { formatINR, useShop } from '../store/shop'
import { matchesSearch } from '../lib/search'
import AdminCategoriesSection from './admin/AdminCategoriesSection'
import AdminCustomersSection from './admin/AdminCustomersSection'
import AdminDiscountsSection from './admin/AdminDiscountsSection'
import AdminHomeSection from './admin/AdminHomeSection'
import {
  AdminAnalyticsSection,
  AdminMarketingSection,
  AdminReportsSection,
  AdminSettingsSection,
} from './admin/AdminInsightsSections'
import AdminOrdersSection from './admin/AdminOrdersSection'
import { AdminInventorySection } from './admin/AdminPreviewSections'
import AdminProductsSection from './admin/AdminProductsSection'

const PRIMARY_NAV = [
  { id: 'home', label: 'Dashboard', icon: Home },
  {
    id: 'orders',
    label: 'Orders',
    icon: Inbox,
    children: [
      { id: 'orders', label: 'All Orders' },
      { id: 'orders_drafts', label: 'Drafts' },
      { id: 'abandoned_checkouts', label: 'Abandoned checkouts' },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    icon: Tag,
    children: [
      { id: 'products', label: 'All Products' },
      { id: 'products_add', label: 'Add Product' },
      { id: 'collections', label: 'Categories' },
      { id: 'products_variants', label: 'Variants' },
      { id: 'inventory', label: 'Inventory' },
    ],
  },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'discounts', label: 'Discounts', icon: ShoppingBag },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings', icon: Settings },
]

function parseAdminRoute(routeStr) {
  if (!routeStr || routeStr === 'admin' || routeStr === 'admin:home') {
    return { section: 'home', detailId: null }
  }
  if (!routeStr.startsWith('admin:')) {
    return { section: 'home', detailId: null }
  }
  const rest = routeStr.slice('admin:'.length)
  if (!rest) return { section: 'home', detailId: null }
  const colonIdx = rest.indexOf(':')
  const section = colonIdx === -1 ? rest : rest.slice(0, colonIdx)
  const rawDetail = colonIdx === -1 ? '' : rest.slice(colonIdx + 1)
  return {
    section: section || 'home',
    detailId: rawDetail ? rawDetail : null,
  }
}

function sectionToAdminRoute(id) {
  if (!id || id === 'home') return 'admin'
  return `admin:${id}`
}

export default function AdminPanel() {
  const {
    loadAdminOverview,
    syncAdminSupabase,
    saveAdminSettings,
    updateAdminCustomerRole,
    deleteAdminCustomer,
    saveAdminProduct,
    updateAdminProductQuick,
    updateAdminStock,
    deleteAdminProduct,
    saveAdminCategory,
    deleteAdminCategory,
    saveAdminDiscount,
    deleteAdminDiscount,
    createAdminCustomer,
    createAdminOrder,
    updateAdminOrder,
    uploadAdminImage,
    pushToast,
    user,
    route,
    go,
  } = useShop()

  const { section, detailId } = useMemo(() => parseAdminRoute(route), [route])
  const selectedOrderCode = section === 'orders' ? detailId : null
  const selectedProductId = section === 'products' ? detailId : null
  const selectedCustomerId = section === 'customers' ? detailId : null
  const selectedDiscountId = section === 'discounts' ? detailId : null
  const settingsTab = section === 'settings' && detailId ? detailId : 'general'

  const [navHistory, setNavHistory] = useState(() => ({
    stack: [route && route.startsWith('admin') ? route : 'admin'],
    idx: 0,
  }))
  const pendingHistoryStepRef = useRef(null)

  useEffect(() => {
    if (!route || (route !== 'admin' && !route.startsWith('admin:'))) return
    const step = pendingHistoryStepRef.current
    pendingHistoryStepRef.current = null
    setNavHistory((prev) => {
      if (step === 'back') {
        if (prev.idx > 0 && prev.stack[prev.idx - 1] === route) {
          return { ...prev, idx: prev.idx - 1 }
        }
      } else if (step === 'forward') {
        if (prev.idx < prev.stack.length - 1 && prev.stack[prev.idx + 1] === route) {
          return { ...prev, idx: prev.idx + 1 }
        }
      }
      if (prev.stack[prev.idx] === route) return prev
      if (prev.idx > 0 && prev.stack[prev.idx - 1] === route) {
        return { ...prev, idx: prev.idx - 1 }
      }
      if (prev.idx < prev.stack.length - 1 && prev.stack[prev.idx + 1] === route) {
        return { ...prev, idx: prev.idx + 1 }
      }
      const nextStack = [...prev.stack.slice(0, prev.idx + 1), route]
      if (nextStack.length > 50) {
        nextStack.shift()
      }
      return { stack: nextStack, idx: nextStack.length - 1 }
    })
  }, [route])

  const canGoBack = navHistory.idx > 0
  const canGoForward = navHistory.idx < navHistory.stack.length - 1

  const handleHistoryBack = useCallback(() => {
    if (!canGoBack) return
    pendingHistoryStepRef.current = 'back'
    window.history.back()
  }, [canGoBack])

  const handleHistoryForward = useCallback(() => {
    if (!canGoForward) return
    pendingHistoryStepRef.current = 'forward'
    window.history.forward()
  }, [canGoForward])

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncingSupabase, setSyncingSupabase] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [createOrderTrigger, setCreateOrderTrigger] = useState(0)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [cmdQuery, setCmdQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [overview, setOverview] = useState({
    products: [],
    categories: [],
    orders: [],
    customers: [],
    discounts: [],
    inventoryLogs: [],
    settings: null,
    integrations: null,
  })

  const reload = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await loadAdminOverview()
      setOverview(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load admin data'
      setLoadError(msg)
      pushToast(msg)
    } finally {
      setLoading(false)
    }
  }, [loadAdminOverview, pushToast])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((v) => !v)
      }
      if (e.key === 'Escape') {
        setCmdOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const selectSection = useCallback(
    (id) => {
      setNotifOpen(false)
      setMobileMenuOpen(false)
      go(sectionToAdminRoute(id))
    },
    [go],
  )

  const handleOpenOrder = useCallback(
    (code) => {
      setNotifOpen(false)
      setMobileMenuOpen(false)
      if (!code) {
        go('admin:orders')
        return
      }
      go(`admin:orders:${code}`)
    },
    [go],
  )

  const handleOpenProduct = useCallback(
    (productId) => {
      setNotifOpen(false)
      setMobileMenuOpen(false)
      if (!productId) {
        go('admin:products')
        return
      }
      go(`admin:products:${productId}`)
    },
    [go],
  )

  const handleOpenCustomer = useCallback(
    (customerId) => {
      setNotifOpen(false)
      setMobileMenuOpen(false)
      if (!customerId) {
        go('admin:customers')
        return
      }
      go(`admin:customers:${customerId}`)
    },
    [go],
  )

  const handleOpenDiscount = useCallback(
    (discountId) => {
      setNotifOpen(false)
      setMobileMenuOpen(false)
      if (!discountId) {
        go('admin:discounts')
        return
      }
      go(`admin:discounts:${discountId}`)
    },
    [go],
  )

  const handleQuickAddProduct = useCallback(() => {
    setNotifOpen(false)
    setMobileMenuOpen(false)
    go('admin:products_add')
  }, [go])

  const handleQuickCreateOrder = useCallback(() => {
    setNotifOpen(false)
    setMobileMenuOpen(false)
    go('admin:orders')
    setCreateOrderTrigger((n) => n + 1)
  }, [go])

  const openOrdersCount = (overview.orders || []).filter(
    (o) => !o.cancelled && o.orderStatus !== 'cancelled' && o.orderStatus !== 'delivered',
  ).length

  const notifications = useMemo(() => {
    const lowThresh = Number(overview.settings?.lowStockThreshold ?? 5)
    const pendingOrders = (overview.orders || [])
      .filter((o) => !o.cancelled && (o.orderStatus === 'pending' || o.orderStatus === 'confirmed'))
      .slice(0, 4)
      .map((o) => ({
        id: `ord-${o.id}`,
        title: `Order #${o.id} · ${o.customerName}`,
        sub: `${formatINR(o.total)} · ${o.orderStatus || 'pending'}`,
        action: () => handleOpenOrder(o.id),
      }))
    const lowStockItems = (overview.products || [])
      .filter((p) => (p.stock ?? 0) <= lowThresh)
      .slice(0, 4)
      .map((p) => ({
        id: `prod-${p.id}`,
        title:
          (p.stock ?? 0) === 0
            ? `Out of stock: ${p.name}`
            : `Low stock (${p.stock}): ${p.name}`,
        sub: p.sku || p.id,
        action: () => handleOpenProduct(p.id),
      }))
    return [...pendingOrders, ...lowStockItems]
  }, [overview.orders, overview.products, overview.settings, handleOpenOrder, handleOpenProduct])

  const handleSyncSupabase = async () => {
    setSyncingSupabase(true)
    try {
      await syncAdminSupabase()
      await reload()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Supabase sync failed')
    } finally {
      setSyncingSupabase(false)
    }
  }

  const categoryNameMap = useMemo(
    () => new Map((overview.categories || []).map((c) => [c.id, c.label])),
    [overview.categories],
  )

  const cmdResults = useMemo(() => {
    const orderMatches = (overview.orders || [])
      .filter((o) =>
        matchesSearch(
          cmdQuery,
          o.id,
          o.customerName,
          o.customerEmail,
          o.phone,
          o.courierPartner,
          o.trackingNumber,
          o.items,
          o.shippingAddress,
        ),
      )
      .slice(0, 5)
    const productMatches = (overview.products || [])
      .filter((p) =>
        matchesSearch(
          cmdQuery,
          p.name,
          p.sku,
          p.id,
          p.brand,
          p.category,
          categoryNameMap.get(p.category),
          p.tagline,
          p.short,
          p.variants,
        ),
      )
      .slice(0, 6)
    const discountMatches = (overview.discounts || [])
      .filter((d) =>
        matchesSearch(cmdQuery, d.code, d.description, d.discountType, d.value),
      )
      .slice(0, 4)
    const customerMatches = (overview.customers || [])
      .filter((c) => matchesSearch(cmdQuery, c.name, c.email, c.phone, c.role))
      .slice(0, 4)

    return {
      orderMatches,
      productMatches,
      discountMatches,
      customerMatches,
    }
  }, [cmdQuery, overview, categoryNameMap])

  const openFirstCmdMatch = () => {
    if (cmdResults.productMatches[0]) {
      setCmdOpen(false)
      handleOpenProduct(cmdResults.productMatches[0].id)
      return
    }
    if (cmdResults.orderMatches[0]) {
      setCmdOpen(false)
      handleOpenOrder(cmdResults.orderMatches[0].id)
      return
    }
    if (cmdResults.customerMatches[0]) {
      setCmdOpen(false)
      handleOpenCustomer(cmdResults.customerMatches[0].id)
      return
    }
    if (cmdResults.discountMatches[0]) {
      setCmdOpen(false)
      handleOpenDiscount(cmdResults.discountMatches[0].id)
    }
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0F111A] text-[#CBD5E1]">
      {/* Brand Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-white/5">
        <button
          type="button"
          onClick={() => selectSection('home')}
          className="flex items-center gap-2.5 text-left cursor-pointer"
        >
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#4F46E5] text-white grid place-items-center shrink-0 shadow-sm">
            <ShoppingBag size={16} />
          </span>
          <div className="leading-tight">
            <span className="font-display font-black text-[15px] text-white tracking-wider block">
              HARBAN
            </span>
            <span className="text-[10.5px] text-[#94A3B8] font-medium block">
              Admin
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1 text-[#94A3B8] hover:text-white cursor-pointer"
          aria-label="Close sidebar"
        >
          <X size={16} />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {PRIMARY_NAV.map(({ id, label, icon: Icon, children }) => {
          const isDirectActive =
            id === 'products'
              ? section === 'products'
              : section === id
          const hasActiveChild =
            id === 'orders'
              ? ['orders', 'orders_drafts', 'abandoned_checkouts'].includes(section)
              : id === 'products'
                ? ['products_add', 'collections', 'products_brands', 'products_variants', 'inventory'].includes(section)
                : false
          const showChildren =
            Boolean(children) && (isDirectActive || hasActiveChild)

          return (
            <div key={id}>
              <button
                type="button"
                onClick={() => selectSection(id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition cursor-pointer ${
                  isDirectActive
                    ? 'bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] text-white shadow-xs'
                    : hasActiveChild
                      ? 'bg-white/10 text-white'
                      : 'text-[#94A3B8] hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon size={16} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </span>
                {id === 'orders' && (
                  <span
                    className={`text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-full font-bold ${
                      isDirectActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[#6D28D9] text-white'
                    }`}
                  >
                    {openOrdersCount || overview.orders?.length || 0}
                  </span>
                )}
              </button>

              {showChildren && (
                <div className="mt-1 ml-2 pl-4 border-l border-white/10 space-y-0.5 bg-white/[0.03] rounded-r-xl py-1 pr-1.5">
                  {children.map((ch) => {
                    const childActive =
                      ch.id === 'products'
                        ? section === 'products' && !detailId
                        : ch.id === 'orders'
                          ? section === 'orders' && !detailId
                          : section === ch.id
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => selectSection(ch.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition cursor-pointer flex items-center gap-2 ${
                          childActive
                            ? 'bg-white/10 text-white font-semibold'
                            : 'text-[#94A3B8] hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span
                          className={`w-1 h-1 rounded-full ${
                            childActive ? 'bg-white' : 'bg-[#64748B]'
                          }`}
                        />
                        {ch.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom View Store */}
      <div className="px-3 py-3 border-t border-white/10">
        <button
          type="button"
          onClick={() => go('home')}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-[#CBD5E1] hover:bg-white/5 hover:text-white transition cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            <Eye size={16} />
            <span>View Store</span>
          </span>
          <ExternalLink size={13} className="text-[#94A3B8]" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex bg-[#F6F7FB] text-[#111827]">
      {/* Fixed Left Sidebar (Desktop) */}
      <aside className="no-print hidden lg:block w-[228px] shrink-0 bg-[#0F111A]">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-[75] lg:hidden">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-[248px] h-full shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Right Workspace Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean White Top Header Bar */}
        <header className="no-print h-[60px] bg-white border-b border-[#EAECF0] px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-40">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-[#4B5563] hover:bg-[#F3F4F6] cursor-pointer"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>

            {/* In-Dashboard Back / Forward Navigation */}
            <div className="inline-flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleHistoryBack}
                disabled={!canGoBack}
                title="Back"
                aria-label="Go back"
                className="w-8 h-8 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F4F5F8] disabled:opacity-35 disabled:cursor-not-allowed grid place-items-center text-[#374151] transition cursor-pointer"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                type="button"
                onClick={handleHistoryForward}
                disabled={!canGoForward}
                title="Forward"
                aria-label="Go forward"
                className="w-8 h-8 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F4F5F8] disabled:opacity-35 disabled:cursor-not-allowed grid place-items-center text-[#374151] transition cursor-pointer"
              >
                <ArrowRight size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setCmdQuery('')
                setCmdOpen(true)
              }}
              className="flex-1 max-w-md bg-[#F4F5F8] hover:bg-[#ECEEF2] border border-[#E5E7EB] rounded-xl px-3.5 py-2 flex items-center justify-between gap-2 text-[12.5px] text-[#6B7280] transition cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <Search size={14} className="shrink-0 text-[#9CA3AF]" />
                <span className="truncate">
                  Search products, orders, customers...
                </span>
              </span>
              <kbd className="hidden sm:inline-block text-[10.5px] font-mono bg-white text-[#6B7280] px-1.5 py-0.5 rounded border border-[#E5E7EB]">
                Ctrl K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              title="Refresh store data"
              className="w-9 h-9 rounded-xl border border-[#EAECF0] hover:bg-[#F4F5F8] grid place-items-center text-[#4B5563] cursor-pointer"
              aria-label="Refresh store data"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                title="Store notifications"
                className="relative w-9 h-9 rounded-xl border border-[#EAECF0] hover:bg-[#F4F5F8] grid place-items-center text-[#4B5563] cursor-pointer"
                aria-label="Notifications"
              >
                <Bell size={15} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#6D28D9]" />
                )}
              </button>

              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-[#EAECF0] shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#EAECF0] flex items-center justify-between">
                      <span className="font-display font-bold text-[13px] text-[#111827]">
                        Notifications ({notifications.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="text-[#6B7280] hover:text-[#111827] cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-[#EAECF0]">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-[12px] text-[#6B7280] text-center">
                          All orders fulfilled and inventory levels healthy.
                        </p>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={n.action}
                            className="w-full text-left px-4 py-2.5 hover:bg-[#F9FAFB] cursor-pointer"
                          >
                            <p className="text-[12.5px] font-semibold text-[#111827] truncate">
                              {n.title}
                            </p>
                            <p className="text-[11px] text-[#6B7280] mt-0.5 truncate">
                              {n.sub}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => go('support')}
              title="Store support & help"
              className="hidden sm:grid w-9 h-9 rounded-xl border border-[#EAECF0] hover:bg-[#F4F5F8] place-items-center text-[#4B5563] cursor-pointer"
              aria-label="Help"
            >
              <HelpCircle size={15} />
            </button>

            <button
              type="button"
              onClick={() => go('account')}
              className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-[#F4F5F8] transition text-left cursor-pointer"
            >
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6D28D9] to-[#4F46E5] text-white font-display font-bold text-[12px] grid place-items-center shrink-0">
                {(user?.name || 'H').slice(0, 1).toUpperCase()}
              </span>
              <div className="hidden sm:block leading-tight">
                <p className="text-[12.5px] font-bold text-[#111827]">
                  {user?.name || 'Harban Admin'}
                </p>
                <p className="text-[11px] text-[#6B7280] truncate max-w-[140px]">
                  {user?.email || 'admin@harban.in'}
                </p>
              </div>
            </button>
          </div>
        </header>

        {/* Main Content Canvas */}
        <main className="flex-1 p-4 sm:p-6">
          <div className="max-w-[1440px] mx-auto space-y-4">
            {loadError && (
              <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-[13px] font-semibold px-4 py-3 rounded-xl flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  {loadError}
                </span>
                <button
                  type="button"
                  onClick={reload}
                  className="text-[12px] font-bold underline cursor-pointer shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {loading && overview.products.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#EAECF0] p-10 text-center text-[13px] text-[#6B7280]">
                Loading HARBAN admin workspace...
              </div>
            ) : section === 'home' ? (
              <AdminHomeSection
                overview={overview}
                onNavigate={selectSection}
                onOpenOrder={handleOpenOrder}
                onOpenProduct={handleOpenProduct}
                onAddProduct={handleQuickAddProduct}
                onCreateOrderAction={handleQuickCreateOrder}
                onSyncSupabase={handleSyncSupabase}
                syncingSupabase={syncingSupabase}
              />
            ) : section === 'orders' ||
              section === 'orders_drafts' ||
              section === 'abandoned_checkouts' ? (
              <AdminOrdersSection
                overview={overview}
                viewMode={
                  section === 'orders_drafts'
                    ? 'drafts'
                    : section === 'abandoned_checkouts'
                      ? 'abandoned'
                      : 'all'
                }
                selectedOrderCode={selectedOrderCode}
                onOpenOrder={handleOpenOrder}
                onCloseOrder={() => selectSection('orders')}
                onOpenProduct={handleOpenProduct}
                onOpenCustomer={handleOpenCustomer}
                externalCreateTrigger={createOrderTrigger}
                onCreateOrder={createAdminOrder}
                onUpdateOrder={updateAdminOrder}
                onReload={reload}
                pushToast={pushToast}
              />
            ) : section === 'products' ||
              section === 'products_add' ||
              section === 'products_brands' ||
              section === 'products_variants' ? (
              <AdminProductsSection
                mode={
                  section === 'products_add'
                    ? 'add'
                    : section === 'products_brands'
                      ? 'brands'
                      : section === 'products_variants'
                        ? 'variants'
                        : 'all'
                }
                selectedProductId={selectedProductId}
                onOpenProduct={handleOpenProduct}
                onStartNewProduct={() => selectSection('products_add')}
                onCloseProduct={() => selectSection('products')}
                products={overview.products}
                categories={overview.categories}
                lowStockThreshold={Number(overview.settings?.lowStockThreshold ?? 5)}
                onSaveProduct={saveAdminProduct}
                onQuickUpdateProduct={updateAdminProductQuick}
                onUpdateStock={updateAdminStock}
                onDeleteProduct={deleteAdminProduct}
                onUploadImage={uploadAdminImage}
                onReload={reload}
                pushToast={pushToast}
              />
            ) : section === 'collections' ? (
              <AdminCategoriesSection
                categories={overview.categories}
                products={overview.products}
                onSaveCategory={saveAdminCategory}
                onDeleteCategory={deleteAdminCategory}
                onUploadImage={uploadAdminImage}
                onReload={reload}
                pushToast={pushToast}
              />
            ) : section === 'inventory' ? (
              <AdminInventorySection
                overview={overview}
                onUpdateStock={updateAdminStock}
                onReload={reload}
                pushToast={pushToast}
              />
            ) : section === 'customers' ? (
              <AdminCustomersSection
                overview={overview}
                selectedCustomerId={selectedCustomerId}
                onOpenCustomer={handleOpenCustomer}
                onCloseCustomer={() => selectSection('customers')}
                onOpenOrder={handleOpenOrder}
                onCreateCustomer={createAdminCustomer}
                onReload={reload}
                pushToast={pushToast}
              />
            ) : section === 'discounts' ? (
              <AdminDiscountsSection
                discounts={overview.discounts || []}
                orders={overview.orders || []}
                selectedDiscountId={selectedDiscountId}
                onClearSelectedDiscount={() => {}}
                onSaveDiscount={saveAdminDiscount}
                onDeleteDiscount={deleteAdminDiscount}
                onReload={reload}
                pushToast={pushToast}
              />
            ) : section === 'marketing' ? (
              <AdminMarketingSection
                overview={overview}
                onNavigate={selectSection}
                onSaveSettings={saveAdminSettings}
                onReload={reload}
                pushToast={pushToast}
              />
            ) : section === 'analytics' ? (
              <AdminAnalyticsSection
                overview={overview}
                pushToast={pushToast}
              />
            ) : section === 'reports' ? (
              <AdminReportsSection overview={overview} pushToast={pushToast} />
            ) : section === 'settings' ? (
              <AdminSettingsSection
                overview={overview}
                activeTabProp={settingsTab}
                onTabChange={(tab) => go(`admin:settings:${tab}`)}
                onSyncSupabase={handleSyncSupabase}
                syncingSupabase={syncingSupabase}
                onSaveSettings={saveAdminSettings}
                onUpdateUserRole={updateAdminCustomerRole}
                onCreateUser={createAdminCustomer}
                onDeleteUser={deleteAdminCustomer}
                onReload={reload}
                pushToast={pushToast}
              />
            ) : (
              <AdminHomeSection
                overview={overview}
                onNavigate={selectSection}
                onOpenOrder={handleOpenOrder}
                onOpenProduct={handleOpenProduct}
                onAddProduct={handleQuickAddProduct}
                onCreateOrderAction={handleQuickCreateOrder}
                onSyncSupabase={handleSyncSupabase}
                syncingSupabase={syncingSupabase}
              />
            )}
          </div>
        </main>
      </div>

      {/* Ctrl+K Quick Command Search Modal */}
      {cmdOpen && (
        <div className="fixed inset-0 z-[95] grid place-items-start justify-center p-4 pt-16">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-xs"
            onClick={() => setCmdOpen(false)}
          />
          <div className="relative bg-white rounded-xl border border-[#E3E3E3] max-w-xl w-full shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#EAEAEA] flex items-center gap-2.5">
              <Search size={15} className="text-[#616161] shrink-0" />
              <input
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    openFirstCmdMatch()
                  }
                }}
                placeholder="Jump to order ID, product, SKU, discount code or customer..."
                className="w-full outline-none text-[13.5px] text-[#1A1A1A]"
              />
              {cmdQuery && (
                <button
                  type="button"
                  onClick={() => setCmdQuery('')}
                  className="p-1 text-[#616161] hover:text-[#1A1A1A] cursor-pointer"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setCmdOpen(false)}
                className="text-[11px] font-mono bg-[#F1F1F1] px-2 py-0.5 rounded text-[#616161] cursor-pointer"
              >
                ESC
              </button>
            </div>

            <div className="max-h-[380px] overflow-y-auto divide-y divide-[#EAEAEA] text-[12.5px]">
              {cmdResults.orderMatches.length > 0 && (
                <div className="p-2">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#616161]">
                    Orders
                  </p>
                  {cmdResults.orderMatches.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setCmdOpen(false)
                        handleOpenOrder(o.id)
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#F7F7F7] flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span>
                        <strong className="font-mono text-[#5B21B6]">#{o.id}</strong>{' '}
                        <span className="text-[#616161]">· {o.customerName}</span>
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatINR(o.total)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {cmdResults.productMatches.length > 0 && (
                <div className="p-2">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#616161]">
                    Products
                  </p>
                  {cmdResults.productMatches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setCmdOpen(false)
                        handleOpenProduct(p.id)
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#F7F7F7] flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="truncate font-semibold text-[#1A1A1A]">
                        {p.name}
                        <span className="ml-2 text-[11px] font-mono font-normal text-[#616161]">
                          {p.sku || p.id}
                        </span>
                      </span>
                      <span className="text-[#616161] font-mono text-[11.5px] shrink-0">
                        {p.stock ?? 0} in stock · {formatINR(p.price)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {cmdResults.discountMatches.length > 0 && (
                <div className="p-2">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#616161]">
                    Discounts
                  </p>
                  {cmdResults.discountMatches.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setCmdOpen(false)
                        handleOpenDiscount(d.id)
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#F7F7F7] flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="font-mono font-bold text-[#1A1A1A]">
                        {d.code}
                      </span>
                      <span className="text-[#616161]">
                        {d.isActive !== false ? 'Active' : 'Disabled'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {cmdResults.customerMatches.length > 0 && (
                <div className="p-2">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#616161]">
                    Customers
                  </p>
                  {cmdResults.customerMatches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCmdOpen(false)
                        handleOpenCustomer(c.id)
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#F7F7F7] flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="font-semibold text-[#1A1A1A]">{c.name}</span>
                      <span className="text-[#616161] truncate">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}

              {cmdResults.orderMatches.length === 0 &&
                cmdResults.productMatches.length === 0 &&
                cmdResults.discountMatches.length === 0 &&
                cmdResults.customerMatches.length === 0 && (
                  <div className="p-8 text-center text-[#616161]">
                    No matches for &ldquo;{cmdQuery}&rdquo;
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
