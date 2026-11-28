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
    ],
  },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'customers', label: 'Customers', icon: Users },
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

const SECTION_TITLES = {
  home: 'Overview',
  orders: 'Orders',
  orders_drafts: 'Draft Orders',
  abandoned_checkouts: 'Abandoned Checkouts',
  products: 'Products',
  products_add: 'Add Product',
  collections: 'Categories',
  products_brands: 'Brands',
  products_variants: 'Variants',
  inventory: 'Inventory',
  customers: 'Customers',
  discounts: 'Discounts',
  marketing: 'Marketing',
  analytics: 'Analytics',
  reports: 'Reports',
  settings: 'Settings',
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
    <div className="admin-sidebar-3d flex flex-col h-full text-[#111315] lg:rounded-[20px] overflow-hidden">
      {/* Brand Header */}
      <div className="px-3.5 pt-3.5 pb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => selectSection('home')}
          className="flex items-center gap-2.5 text-left cursor-pointer min-w-0"
        >
          <span className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#34383F] to-[#121417] border border-black/40 text-white grid place-items-center shrink-0 shadow-[0_6px_14px_-3px_rgba(14,16,18,0.4),inset_0_1px_0_rgba(255,255,255,0.25)]">
            <ShoppingBag size={15} />
          </span>
          <div className="leading-tight min-w-0">
            <span className="font-display font-bold text-[14.5px] text-[#111315] tracking-tight block truncate">
              HARBAN
            </span>
            <span className="text-[11px] text-[#7A8089] font-medium block truncate">
              Ops workspace
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-[#686E78] hover:bg-black/5 hover:text-[#111315] cursor-pointer"
          aria-label="Close sidebar"
        >
          <X size={16} />
        </button>
      </div>

      {/* Sidebar Quick Search Trigger */}
      <div className="px-3 pb-2.5">
        <button
          type="button"
          onClick={() => {
            setCmdQuery('')
            setCmdOpen(true)
          }}
          className="admin-well-3d w-full hover:brightness-[0.98] rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 text-[12px] text-[#686E78] transition cursor-pointer"
        >
          <span className="flex items-center gap-2 truncate">
            <Search size={13} className="shrink-0 text-[#8A9099]" />
            <span className="truncate">Search</span>
          </span>
          <kbd className="text-[10px] font-mono bg-white text-[#686E78] px-1.5 py-0.5 rounded border border-[#D4D8DF] shadow-[0_2px_4px_rgba(17,19,21,0.08),inset_0_1px_0_#fff]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2.5 py-1 space-y-0.5 overflow-y-auto">
        <p className="px-2.5 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A9099]">
          Workspace
        </p>
        {PRIMARY_NAV.map(({ id, label, icon: Icon, children }) => {
          const isDirectActive =
            id === 'products'
              ? section === 'products'
              : section === id
          const hasActiveChild =
            id === 'orders'
              ? ['orders', 'orders_drafts', 'abandoned_checkouts'].includes(section)
              : id === 'products'
                ? ['products_add', 'collections', 'products_brands', 'products_variants'].includes(section)
                : false
          const showChildren =
            Boolean(children) && (isDirectActive || hasActiveChild)

          return (
            <div key={id}>
              <button
                type="button"
                onClick={() => selectSection(id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[13px] transition cursor-pointer ${
                  isDirectActive
                    ? 'admin-nav-active-3d text-[#111315] font-semibold'
                    : hasActiveChild
                      ? 'bg-white/75 border border-[#D9DDE3] text-[#111315] font-semibold shadow-[0_3px_8px_-2px_rgba(17,19,21,0.06)]'
                      : 'border border-transparent text-[#5C626B] font-medium hover:bg-black/[0.035] hover:text-[#111315]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    size={15}
                    className={`shrink-0 ${
                      isDirectActive || hasActiveChild ? 'text-[#16181A]' : 'text-[#7A8089]'
                    }`}
                  />
                  <span className="truncate">{label}</span>
                </span>
                {id === 'orders' && (
                  <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-full font-bold bg-[#D9F94F] text-[#111315]">
                    {openOrdersCount || overview.orders?.length || 0}
                  </span>
                )}
              </button>

              {showChildren && (
                <div className="mt-1 ml-3 pl-3 border-l border-[#E2E4E8] space-y-0.5 py-0.5">
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
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] transition cursor-pointer flex items-center gap-2 ${
                          childActive
                            ? 'admin-nav-active-3d text-[#111315] font-semibold'
                            : 'text-[#686E78] font-medium hover:bg-black/[0.035] hover:text-[#111315]'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            childActive
                              ? 'bg-[#A6EB00] shadow-[0_0_6px_rgba(166,235,0,0.9)]'
                              : 'bg-[#C4C9D0]'
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
      <div className="p-2.5 border-t border-[#E2E4E8]">
        <button
          type="button"
          onClick={() => go('home')}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[#E2E4E8] text-[12.5px] font-semibold text-[#111315] hover:bg-[#F1F2F4] transition cursor-pointer shadow-2xs"
        >
          <span className="flex items-center gap-2">
            <Eye size={14} className="text-[#5C626B]" />
            <span>View Store</span>
          </span>
          <ExternalLink size={12} className="text-[#8A9099]" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="admin-fieldnote-3d min-h-screen flex bg-[#E4E7EB] text-[#111315] lg:p-3.5 lg:gap-3.5">
      {/* Slim Obsidian Icon Rail + Light Floating Workspace Sidebar (Desktop) */}
      <aside className="no-print hidden lg:flex gap-3 shrink-0">
        <div className="admin-rail-3d w-[52px] shrink-0 text-[#8E939C] rounded-[20px] py-3 flex flex-col items-center justify-between sticky top-3.5 h-[calc(100vh-28px)]">
          <div className="flex flex-col items-center gap-1.5 w-full px-1.5">
            <button
              type="button"
              onClick={() => selectSection('home')}
              title="HARBAN Admin"
              className="w-9 h-9 rounded-xl bg-gradient-to-b from-[#3A3E46] to-[#23262B] border border-white/15 text-white grid place-items-center mb-1.5 cursor-pointer hover:brightness-110 transition shadow-[0_6px_12px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.22)]"
            >
              <ShoppingBag size={15} />
            </button>

            {PRIMARY_NAV.filter((n) => n.id !== 'settings').map(({ id, label, icon: Icon }) => {
              const isRailActive =
                id === 'products'
                  ? section === 'products' ||
                    ['products_add', 'collections', 'products_brands', 'products_variants'].includes(section)
                  : id === 'orders'
                    ? ['orders', 'orders_drafts', 'abandoned_checkouts'].includes(section)
                    : section === id
              return (
                <button
                  key={`rail-${id}`}
                  type="button"
                  onClick={() => selectSection(id)}
                  title={label}
                  aria-label={label}
                  className={`relative w-9 h-9 rounded-xl grid place-items-center transition cursor-pointer ${
                    isRailActive
                      ? 'admin-rail-btn-active text-white'
                      : 'text-[#8E939C] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={15} />
                  {isRailActive && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#D9F94F] shadow-[0_0_8px_rgba(217,249,79,0.9)]" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col items-center gap-1.5 w-full px-1.5 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => selectSection('settings')}
              title="Settings"
              aria-label="Settings"
              className={`relative w-9 h-9 rounded-xl grid place-items-center transition cursor-pointer ${
                section === 'settings'
                  ? 'admin-rail-btn-active text-white'
                  : 'text-[#8E939C] hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings size={15} />
              {section === 'settings' && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#D9F94F] shadow-[0_0_8px_rgba(217,249,79,0.9)]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => go('home')}
              title="View Store"
              aria-label="View Store"
              className="w-9 h-9 rounded-xl grid place-items-center text-[#8E939C] hover:text-white hover:bg-white/5 transition cursor-pointer"
            >
              <Eye size={15} />
            </button>
          </div>
        </div>

        <div className="w-[224px] shrink-0 sticky top-3.5 h-[calc(100vh-28px)]">
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-[75] lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-[256px] h-full shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Right Workspace Column */}
      <div className="admin-workspace-3d flex-1 min-w-0 flex flex-col lg:rounded-[22px]">
        {/* Clean Light Top Header Bar */}
        <header className="no-print h-[60px] bg-white/75 backdrop-blur-md border-b border-[#D9DDE3] lg:rounded-t-[22px] px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-40">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-[#4B5563] hover:bg-[#ECEEF0] cursor-pointer"
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
                className="w-8 h-8 rounded-xl border border-[#E2E4E8] bg-white hover:bg-[#ECEEF0] disabled:opacity-35 disabled:cursor-not-allowed grid place-items-center text-[#374151] transition cursor-pointer"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                type="button"
                onClick={handleHistoryForward}
                disabled={!canGoForward}
                title="Forward"
                aria-label="Go forward"
                className="w-8 h-8 rounded-xl border border-[#E2E4E8] bg-white hover:bg-[#ECEEF0] disabled:opacity-35 disabled:cursor-not-allowed grid place-items-center text-[#374151] transition cursor-pointer"
              >
                <ArrowRight size={14} />
              </button>
            </div>

            <span className="hidden xl:inline-block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7A8089] whitespace-nowrap px-1">
              HARBAN / {SECTION_TITLES[section] || 'Overview'}
            </span>

            <button
              type="button"
              onClick={() => {
                setCmdQuery('')
                setCmdOpen(true)
              }}
              className="flex-1 max-w-md bg-white hover:bg-[#ECEEF0]/60 border border-[#D8DCE2] rounded-xl px-3.5 py-2 flex items-center justify-between gap-2 text-[12.5px] text-[#686E78] transition cursor-pointer shadow-[inset_0_1px_2px_rgba(17,19,21,0.05),0_2px_6px_rgba(17,19,21,0.06)]"
            >
              <span className="flex items-center gap-2 truncate">
                <Search size={14} className="shrink-0 text-[#8A9099]" />
                <span className="truncate">
                  Search products, orders, customers...
                </span>
              </span>
              <kbd className="hidden sm:inline-block text-[10.5px] font-mono bg-[#F4F5F7] text-[#686E78] px-1.5 py-0.5 rounded border border-[#D8DCE2] shadow-[0_1px_2px_rgba(17,19,21,0.07)]">
                Ctrl K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              title="Refresh store data"
              className="w-9 h-9 rounded-xl bg-white border border-[#E2E4E8] hover:bg-[#ECEEF0] grid place-items-center text-[#4B5563] cursor-pointer transition"
              aria-label="Refresh store data"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                title="Store notifications"
                className="relative w-9 h-9 rounded-xl bg-white border border-[#E2E4E8] hover:bg-[#ECEEF0] grid place-items-center text-[#4B5563] cursor-pointer transition"
                aria-label="Notifications"
              >
                <Bell size={15} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#B8E600] ring-2 ring-white" />
                )}
              </button>

              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-[#E2E4E8] shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#E2E4E8] flex items-center justify-between">
                      <span className="font-display font-bold text-[13px] text-[#111315]">
                        Notifications ({notifications.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="text-[#686E78] hover:text-[#111315] cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-[#ECEEF0]">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-[12px] text-[#686E78] text-center">
                          All orders fulfilled and inventory levels healthy.
                        </p>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={n.action}
                            className="w-full text-left px-4 py-2.5 hover:bg-[#F7F8FA] cursor-pointer"
                          >
                            <p className="text-[12.5px] font-semibold text-[#111315] truncate">
                              {n.title}
                            </p>
                            <p className="text-[11px] text-[#686E78] mt-0.5 truncate">
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
              className="hidden sm:grid w-9 h-9 rounded-xl bg-white border border-[#E2E4E8] hover:bg-[#ECEEF0] place-items-center text-[#4B5563] cursor-pointer transition"
              aria-label="Help"
            >
              <HelpCircle size={15} />
            </button>

            <button
              type="button"
              onClick={() => go('account')}
              className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-xl bg-white border border-[#E2E4E8] hover:bg-[#ECEEF0]/60 transition text-left cursor-pointer"
            >
              <span className="w-7 h-7 rounded-lg bg-[#16181A] text-white font-display font-bold text-[11px] grid place-items-center shrink-0">
                {(user?.name || 'H').slice(0, 1).toUpperCase()}
              </span>
              <div className="hidden sm:block leading-tight">
                <p className="text-[12px] font-bold text-[#111315]">
                  {user?.name || 'Harban Admin'}
                </p>
                <p className="text-[10.5px] text-[#686E78] truncate max-w-[140px]">
                  {user?.email || 'harban.official@gmail.com'}
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
              <div className="bg-white rounded-[18px] border border-[#DBDFE5] p-10 text-center text-[13px] text-[#686E78]">
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
          <div className="relative bg-white rounded-[18px] border border-[#DBDFE5] max-w-xl w-full shadow-[0_24px_60px_-12px_rgba(14,16,18,0.38)] overflow-hidden">
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
                        <strong className="font-mono text-[#111315]">#{o.id}</strong>{' '}
                        <span className="text-[#686E78]">· {o.customerName}</span>
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
