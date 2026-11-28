import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileBarChart2,
  HeartPulse,
  LayoutGrid,
  Package,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tag,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import Img from '../Img'
import { formatINR } from '../../store/shop'

const STATUS_BADGE = {
  pending: { label: 'Pending', cls: 'bg-[#F1F2F4] text-[#111315] border border-[#E2E4E8]' },
  confirmed: { label: 'Confirmed', cls: 'bg-[#E5FC6B] text-[#141700]' },
  processing: { label: 'Processing', cls: 'bg-[#FEF3C7] text-[#92400E]' },
  shipped: { label: 'Shipped', cls: 'bg-[#E8F1FF] text-[#1D4ED8]' },
  delivered: { label: 'Delivered', cls: 'bg-[#DCFCE7] text-[#15803D]' },
  cancelled: { label: 'Cancelled', cls: 'bg-[#FEE2E2] text-[#B91C1C]' },
}

const DONUT_META = [
  { key: 'delivered', label: 'Delivered', color: '#16A34A' },
  { key: 'shipped', label: 'Shipped', color: '#16181A' },
  { key: 'processing', label: 'Processing', color: '#D97706' },
  { key: 'pending', label: 'Pending', color: '#94A3B8' },
  { key: 'cancelled', label: 'Cancelled', color: '#EF4444' },
]

function resolveOrderStage(o) {
  if (o.cancelled || o.orderStatus === 'cancelled') return 'cancelled'
  const raw = (o.orderStatus || '').toLowerCase()
  if (raw === 'confirmed') return 'processing'
  if (['pending', 'processing', 'shipped', 'delivered'].includes(raw)) return raw
  if (o.status >= 4) return 'delivered'
  if (o.status >= 2) return 'shipped'
  if (o.status === 1) return 'processing'
  return 'pending'
}

function getInitials(name) {
  const parts = String(name || 'H').trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
  }
  return String(name || 'H').slice(0, 2).toUpperCase()
}

function formatAxisINR(v) {
  if (v >= 100000) return `₹${Math.round(v / 1000)}K`
  if (v >= 1000) return `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K`
  return `₹${Math.round(v)}`
}

export default function AdminHomeSection({
  overview,
  onNavigate,
  onOpenOrder,
  onOpenProduct,
  onAddProduct,
  onCreateOrderAction,
  onSyncSupabase,
  syncingSupabase = false,
}) {
  const orders = overview.orders || []
  const products = overview.products || []
  const customers = overview.customers || []
  const views = overview.productViews || []
  const threshold = Number(overview.settings?.lowStockThreshold ?? 5)
  const sbInfo = overview.integrations?.supabase || {}
  const rzpInfo = overview.integrations?.razorpay || {}

  const [period, setPeriod] = useState('30d')
  const [chartMetric, setChartMetric] = useState('sales')
  const [hoverIdx, setHoverIdx] = useState(null)

  const periodCutoff = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime()
    if (period === 'today') return startOfToday
    if (period === '7d') return startOfToday - 6 * 86400_000
    if (period === '30d') return startOfToday - 29 * 86400_000
    return 0
  }, [period])

  const periodOrders = useMemo(
    () => orders.filter((o) => o.placedAt >= periodCutoff),
    [orders, periodCutoff],
  )
  const validPeriodOrders = useMemo(
    () =>
      periodOrders.filter(
        (o) => !o.cancelled && o.orderStatus !== 'cancelled',
      ),
    [periodOrders],
  )
  const periodSales = useMemo(
    () => validPeriodOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
    [validPeriodOrders],
  )
  const periodViews = useMemo(
    () =>
      views.filter((v) => {
        const ts = v.createdAt ? new Date(v.createdAt).getTime() : 0
        return ts >= periodCutoff
      }),
    [views, periodCutoff],
  )

  const activeProducts = products.filter((p) => p.isActive !== false)
  const alertProducts = products.filter((p) => (p.stock ?? 0) <= threshold)
  const orderedCustomerEmails = useMemo(
    () =>
      new Set(
        orders
          .filter((o) => o.customerEmail)
          .map((o) => o.customerEmail.toLowerCase()),
      ),
    [orders],
  )

  // Daily series for Sales Overview smooth chart
  const chartSeries = useMemo(() => {
    const bucketCount = period === 'today' ? 8 : period === '7d' ? 7 : 11
    const now = Date.now()
    const windowMs =
      period === 'today'
        ? 24 * 3600_000
        : period === '7d'
          ? 7 * 86400_000
          : period === '30d'
            ? 30 * 86400_000
            : Math.max(
                7 * 86400_000,
                now -
                  Math.min(
                    ...orders.map((o) => o.placedAt || now),
                    now - 14 * 86400_000,
                  ),
              )
    const start = now - windowMs
    const step = windowMs / bucketCount

    const points = Array.from({ length: bucketCount }, (_, i) => {
      const bStart = start + i * step
      const bEnd = bStart + step
      const labelDate = new Date(bEnd)
      const label =
        period === 'today'
          ? labelDate.toLocaleTimeString('en-IN', {
              hour: 'numeric',
              hour12: true,
            })
          : labelDate.toLocaleDateString('en-IN', {
              month: 'short',
              day: 'numeric',
            })
      return { label, sales: 0, orders: 0, visitors: 0 }
    })

    for (const o of validPeriodOrders) {
      const idx = Math.min(
        bucketCount - 1,
        Math.max(0, Math.floor((o.placedAt - start) / step)),
      )
      if (points[idx]) {
        points[idx].sales += Number(o.total) || 0
        points[idx].orders += 1
      }
    }

    for (const v of periodViews) {
      const ts = v.createdAt ? new Date(v.createdAt).getTime() : 0
      const idx = Math.min(
        bucketCount - 1,
        Math.max(0, Math.floor((ts - start) / step)),
      )
      if (points[idx]) {
        points[idx].visitors += 1
      }
    }

    return points
  }, [period, orders, validPeriodOrders, periodViews])

  const maxChartVal = useMemo(() => {
    const rawMax = Math.max(
      1,
      ...chartSeries.map((pt) => pt[chartMetric] || 0),
    )
    if (chartMetric === 'sales') {
      return Math.max(1000, Math.ceil(rawMax / 1000) * 1000)
    }
    return Math.max(4, Math.ceil(rawMax / 2) * 2)
  }, [chartSeries, chartMetric])

  const svgCoords = useMemo(() => {
    const w = 540
    const h = 155
    const padX = 12
    const padY = 14
    const innerW = w - padX * 2
    const innerH = h - padY * 2
    const n = chartSeries.length
    return chartSeries.map((pt, idx) => {
      const x = padX + (n <= 1 ? innerW / 2 : (idx / (n - 1)) * innerW)
      const val = pt[chartMetric] || 0
      const y = padY + innerH - (val / maxChartVal) * innerH
      return { x, y, val, label: pt.label }
    })
  }, [chartSeries, chartMetric, maxChartVal])

  const linePath = useMemo(() => {
    if (svgCoords.length === 0) return ''
    if (svgCoords.length === 1) return `M ${svgCoords[0].x} ${svgCoords[0].y}`
    let d = `M ${svgCoords[0].x} ${svgCoords[0].y}`
    for (let i = 0; i < svgCoords.length - 1; i++) {
      const p0 = svgCoords[i]
      const p1 = svgCoords[i + 1]
      const midX = (p0.x + p1.x) / 2
      d += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`
    }
    return d
  }, [svgCoords])

  const areaPath = useMemo(() => {
    if (!linePath || svgCoords.length === 0) return ''
    const last = svgCoords[svgCoords.length - 1]
    const first = svgCoords[0]
    return `${linePath} L ${last.x} 155 L ${first.x} 155 Z`
  }, [linePath, svgCoords])

  // Donut Order Status Counts
  const statusCounts = useMemo(() => {
    const map = {
      delivered: 0,
      shipped: 0,
      processing: 0,
      pending: 0,
      cancelled: 0,
    }
    for (const o of periodOrders) {
      const key = resolveOrderStage(o)
      if (key in map) map[key] += 1
    }
    return map
  }, [periodOrders])

  const totalDonutOrders = periodOrders.length
  const donutSegments = useMemo(() => {
    const r = 48
    const circ = 2 * Math.PI * r
    let offset = 0
    return DONUT_META.map((seg) => {
      const count = statusCounts[seg.key] || 0
      const pct = totalDonutOrders > 0 ? (count / totalDonutOrders) * 100 : 0
      const dashLen = totalDonutOrders > 0 ? (count / totalDonutOrders) * circ : 0
      const item = {
        ...seg,
        count,
        pct: pct.toFixed(1),
        dashArray: `${Math.max(0, dashLen - 1.5)} ${circ}`,
        dashOffset: -offset,
      }
      offset += dashLen
      return item
    })
  }, [statusCounts, totalDonutOrders])

  // Top Selling Products (computed from real order line items, falling back to rating/reviews)
  const topProductsList = useMemo(() => {
    const soldMap = new Map()
    for (const o of orders) {
      if (o.cancelled || o.orderStatus === 'cancelled') continue
      for (const item of o.items || []) {
        soldMap.set(item.id, (soldMap.get(item.id) || 0) + (Number(item.qty) || 0))
      }
    }
    return [...products]
      .map((p) => ({
        ...p,
        unitsSold: soldMap.get(p.id) || 0,
      }))
      .sort((a, b) => b.unitsSold - a.unitsSold || (b.reviews || 0) - (a.reviews || 0))
      .slice(0, 4)
  }, [products, orders])

  const periodLabel =
    period === 'today'
      ? 'Today'
      : period === '7d'
        ? 'Last 7 Days'
        : period === '30d'
          ? 'Last 30 Days'
          : 'All Time'

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[24px] text-[#111315] tracking-tight leading-tight">
            Dashboard
          </h1>
          <p className="text-[13px] text-[#686E78] mt-0.5">
            Welcome back! Here&apos;s what&apos;s happening with your store today.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 bg-gradient-to-b from-white to-[#F3F4F6] border border-[#D6DAE0] rounded-xl px-3.5 py-2 shadow-[0_4px_10px_-2px_rgba(17,19,21,0.09),0_1px_2px_rgba(17,19,21,0.05),inset_0_1px_0_#fff]">
          <Calendar size={14} className="text-[#5C626B]" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Select dashboard timeframe"
            className="bg-transparent text-[12.5px] font-semibold text-[#111315] outline-none cursor-pointer pr-1"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Row 1: 5 Crisp KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] text-[#16181A] grid place-items-center shrink-0">
            <ShoppingCart size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#686E78]">Total Sales</p>
            <p className="font-display font-bold text-[20px] text-[#111315] mt-0.5 tabular-nums truncate">
              {formatINR(periodSales)}
            </p>
            <p className="text-[11px] font-semibold bg-[#E5FC6B] text-[#141700] px-1.5 py-0.5 rounded-md mt-1 inline-flex items-center gap-1">
              <TrendingUp size={11} />
              <span>
                {validPeriodOrders.length} active · {periodLabel}
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('orders')}
          className="text-left bg-white hover:border-[#C7CCD2] rounded-[18px] border border-[#E2E4E8] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] flex items-start gap-3 transition cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] text-[#16181A] grid place-items-center shrink-0">
            <ShoppingBag size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#686E78]">Total Orders</p>
            <p className="font-display font-bold text-[20px] text-[#111315] mt-0.5 tabular-nums">
              {periodOrders.length}
            </p>
            <p className="text-[11px] font-medium text-[#686E78] mt-1 tabular-nums">
              {orders.length} total stored
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('customers')}
          className="text-left bg-white hover:border-[#C7CCD2] rounded-[18px] border border-[#E2E4E8] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] flex items-start gap-3 transition cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] text-[#16181A] grid place-items-center shrink-0">
            <Users size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#686E78]">Total Customers</p>
            <p className="font-display font-bold text-[20px] text-[#111315] mt-0.5 tabular-nums">
              {customers.length}
            </p>
            <p className="text-[11px] font-medium text-[#15803D] mt-1 tabular-nums">
              {orderedCustomerEmails.size} placed orders
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('products')}
          className="text-left bg-white hover:border-[#C7CCD2] rounded-[18px] border border-[#E2E4E8] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] flex items-start gap-3 transition cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] text-[#16181A] grid place-items-center shrink-0">
            <Package size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#686E78]">Total Products</p>
            <p className="font-display font-bold text-[20px] text-[#111315] mt-0.5 tabular-nums">
              {products.length}
            </p>
            <p className="text-[11px] font-medium text-[#15803D] mt-1 tabular-nums">
              {activeProducts.length} live on store
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('inventory')}
          className={`text-left rounded-[18px] border p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] flex items-start gap-3 transition cursor-pointer ${
            alertProducts.length > 0
              ? 'bg-[#FFF5F6] border-[#FECDD3] hover:border-[#FDA4AF]'
              : 'bg-white border-[#E2E4E8] hover:border-[#C7CCD2]'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${
              alertProducts.length > 0
                ? 'bg-[#FFE4E6] text-[#E11D48]'
                : 'bg-[#F3F4F6] text-[#16181A]'
            }`}
          >
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#686E78]">Low Stock</p>
            <p className="font-display font-bold text-[20px] text-[#111315] mt-0.5 tabular-nums">
              {alertProducts.length}
            </p>
            <p
              className={`text-[11px] font-semibold mt-1 ${
                alertProducts.length > 0 ? 'text-[#E11D48]' : 'text-[#15803D]'
              }`}
            >
              {alertProducts.length > 0 ? 'Need attention' : `All above ${threshold} qty`}
            </p>
          </div>
        </button>
      </div>

      {/* Row 2: Sales Overview Chart + Order Status Donut + Quick Actions */}
      <div className="grid lg:grid-cols-[1.45fr_1fr_272px] gap-4 items-stretch">
        {/* Sales Overview Smooth SVG Line & Area Chart */}
        <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-bold text-[#111315] flex items-center gap-2">
                <LayoutGrid size={15} className="text-[#16181A]" />
                Sales Overview
              </p>
              <div className="flex items-baseline gap-2.5 mt-1.5">
                <span className="font-display font-bold text-[26px] text-[#111315] tabular-nums">
                  {chartMetric === 'sales'
                    ? formatINR(periodSales)
                    : chartMetric === 'orders'
                      ? `${validPeriodOrders.length} orders`
                      : `${periodViews.length} views`}
                </span>
                <span className="text-[11.5px] font-semibold bg-[#E5FC6B] text-[#141700] px-2 py-0.5 rounded-md">
                  {periodLabel}
                </span>
              </div>
            </div>

            <div className="inline-flex items-center p-1 bg-[#EAECEF] border border-[#D8DCE2] rounded-xl text-[12px] font-semibold shadow-[inset_0_1.5px_3px_rgba(17,19,21,0.07)]">
              {[
                { id: 'sales', label: 'Sales' },
                { id: 'orders', label: 'Orders' },
                { id: 'visitors', label: 'Visitors' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setChartMetric(t.id)
                    setHoverIdx(null)
                  }}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    chartMetric === t.id
                      ? 'bg-[#16181A] text-white'
                      : 'text-[#5C626B] hover:text-[#111315]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 relative">
            <div className="flex gap-2 items-stretch">
              <div className="flex flex-col justify-between text-[10.5px] text-[#8A9099] font-mono tabular-nums py-1 text-right min-w-[38px]">
                <span>
                  {chartMetric === 'sales'
                    ? formatAxisINR(maxChartVal)
                    : maxChartVal}
                </span>
                <span>
                  {chartMetric === 'sales'
                    ? formatAxisINR(maxChartVal * 0.5)
                    : Math.round(maxChartVal * 0.5)}
                </span>
                <span>{chartMetric === 'sales' ? '₹0' : '0'}</span>
              </div>

              <div className="flex-1 min-w-0">
                <svg
                  viewBox="0 0 540 165"
                  className="w-full h-[165px] overflow-visible"
                >
                  <defs>
                    <linearGradient id="harbanSalesArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16181A" stopOpacity="0.14" />
                      <stop offset="100%" stopColor="#16181A" stopOpacity="0.01" />
                    </linearGradient>
                    <linearGradient id="harbanBarLightFront" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F8FAFC" />
                      <stop offset="100%" stopColor="#E4E7EC" />
                    </linearGradient>
                    <linearGradient id="harbanBarDarkFront" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#32363C" />
                      <stop offset="100%" stopColor="#121417" />
                    </linearGradient>
                    <filter id="harbanLineShadow" x="-10%" y="-20%" width="120%" height="160%">
                      <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#111315" floodOpacity="0.18" />
                    </filter>
                  </defs>

                  {[14, 50, 86, 122, 155].map((yPos) => (
                    <line
                      key={yPos}
                      x1="0"
                      x2="540"
                      y1={yPos}
                      y2={yPos}
                      stroke="#E5E8ED"
                      strokeDasharray={yPos === 155 ? undefined : '3 3'}
                      strokeWidth="1"
                    />
                  ))}

                  {/* 3D Isometric Extruded Bars behind trend line */}
                  {svgCoords.map((pt, idx) => {
                    const barW = Math.min(
                      24,
                      Math.max(12, Math.floor(420 / Math.max(1, svgCoords.length)) * 0.45),
                    )
                    const dx = 6
                    const dy = 4
                    const baseY = 155
                    const x0 = pt.x - barW / 2 - dx / 2
                    const y0 = Math.min(148, pt.y)
                    const barH = Math.max(5, baseY - y0)
                    const isActive = hoverIdx === idx
                    return (
                      <g key={`bar-${pt.label}-${idx}`} opacity={isActive ? 1 : 0.9}>
                        {/* Top 3D beveled cap */}
                        <polygon
                          points={`${x0},${y0} ${x0 + dx},${y0 - dy} ${x0 + barW + dx},${y0 - dy} ${x0 + barW},${y0}`}
                          fill={isActive ? '#474C56' : '#FFFFFF'}
                          stroke={isActive ? '#16181A' : '#D5DAE2'}
                          strokeWidth="0.7"
                        />
                        {/* Right 3D extruded depth face */}
                        <polygon
                          points={`${x0 + barW},${y0} ${x0 + barW + dx},${y0 - dy} ${x0 + barW + dx},${baseY - dy} ${x0 + barW},${baseY}`}
                          fill={isActive ? '#0C0E10' : '#CDD3DD'}
                          stroke={isActive ? '#0C0E10' : '#C3C9D4'}
                          strokeWidth="0.7"
                        />
                        {/* Front 3D face */}
                        <rect
                          x={x0}
                          y={y0}
                          width={barW}
                          height={barH}
                          fill={isActive ? 'url(#harbanBarDarkFront)' : 'url(#harbanBarLightFront)'}
                          stroke={isActive ? '#16181A' : '#D5DAE2'}
                          strokeWidth="0.7"
                        />
                      </g>
                    )
                  })}

                  {areaPath && <path d={areaPath} fill="url(#harbanSalesArea)" />}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#16181A"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      filter="url(#harbanLineShadow)"
                    />
                  )}

                  {svgCoords.map((pt, idx) => (
                    <g key={`${pt.label}-${idx}`}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={hoverIdx === idx ? 5.8 : 3.5}
                        fill={hoverIdx === idx ? '#D9F94F' : '#FFFFFF'}
                        stroke="#16181A"
                        strokeWidth="2.2"
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={14}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoverIdx(idx)}
                        onMouseLeave={() => setHoverIdx(null)}
                      />
                    </g>
                  ))}
                </svg>

                <div className="flex justify-between text-[10.5px] text-[#8A9099] px-1 mt-1 tabular-nums">
                  {chartSeries
                    .filter((_, idx) => idx % 2 === 0 || idx === chartSeries.length - 1)
                    .map((pt, idx) => (
                      <span key={`${pt.label}-${idx}`}>{pt.label}</span>
                    ))}
                </div>
              </div>
            </div>

            {hoverIdx !== null && svgCoords[hoverIdx] && (
              <div className="absolute top-1 right-2 bg-gradient-to-b from-[#2B2F36] to-[#121417] text-white border border-white/15 text-[11px] font-semibold px-3 py-1.5 rounded-xl shadow-[0_10px_24px_-4px_rgba(14,16,18,0.45),inset_0_1px_0_rgba(255,255,255,0.22)] tabular-nums pointer-events-none">
                {svgCoords[hoverIdx].label}:{' '}
                {chartMetric === 'sales'
                  ? formatINR(svgCoords[hoverIdx].val)
                  : `${svgCoords[hoverIdx].val} ${chartMetric}`}
              </div>
            )}
          </div>
        </div>

        {/* Order Status Donut Breakdown */}
        <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] flex flex-col justify-between">
          <h2 className="font-display font-bold text-[14px] text-[#111315] flex items-center gap-2">
            <ShoppingBag size={15} className="text-[#16181A]" />
            Order Status
          </h2>

          <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-5 my-auto py-3">
            <div className="relative w-[132px] h-[132px] shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90 drop-shadow-[0_8px_14px_rgba(17,19,21,0.12)]">
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="#EBEEF2"
                  strokeWidth="14"
                />
                {totalDonutOrders > 0 &&
                  donutSegments.map((seg) =>
                    seg.count > 0 ? (
                      <circle
                        key={seg.key}
                        cx="60"
                        cy="60"
                        r="48"
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="14"
                        strokeDasharray={seg.dashArray}
                        strokeDashoffset={seg.dashOffset}
                        strokeLinecap="butt"
                      />
                    ) : null,
                  )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-display font-bold text-[22px] text-[#111315] leading-none tabular-nums">
                  {totalDonutOrders}
                </span>
                <span className="text-[11px] text-[#686E78] mt-1">
                  Total Orders
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-[140px] space-y-2 text-[12px]">
              {donutSegments.map((seg) => (
                <button
                  key={seg.key}
                  type="button"
                  onClick={() => onNavigate('orders')}
                  className="w-full flex items-center justify-between gap-2 hover:bg-[#F9FAFB] px-1.5 py-0.5 rounded cursor-pointer"
                >
                  <span className="flex items-center gap-2 text-[#374151]">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    {seg.label}
                  </span>
                  <span className="tabular-nums text-[#111827] font-semibold">
                    {seg.count}{' '}
                    <span className="text-[#9CA3AF] font-normal">
                      ({seg.pct}%)
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] flex flex-col justify-between">
          <h2 className="font-display font-bold text-[14px] text-[#111315] flex items-center gap-2 mb-3">
            <Zap size={15} className="text-[#16181A]" />
            Quick Actions
          </h2>

          <div className="space-y-2.5 flex-1 flex flex-col justify-center">
            <button
              type="button"
              onClick={onAddProduct}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#16181A] hover:bg-[#272A2E] text-white text-[13px] font-semibold py-2.5 px-4 rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus size={15} /> Add Product
            </button>

            <button
              type="button"
              onClick={onCreateOrderAction}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#F7F8FA] hover:bg-[#ECEEF0] border border-[#E2E4E8] text-[#111315] text-[13px] font-semibold py-2.5 px-4 rounded-xl transition cursor-pointer"
            >
              <ClipboardList size={14} className="text-[#5C626B]" /> Create Order
            </button>

            <button
              type="button"
              onClick={() => onNavigate('discounts')}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#F7F8FA] hover:bg-[#ECEEF0] border border-[#E2E4E8] text-[#111315] text-[13px] font-semibold py-2.5 px-4 rounded-xl transition cursor-pointer"
            >
              <Tag size={14} className="text-[#5C626B]" /> Add Discount
            </button>

            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#F7F8FA] hover:bg-[#ECEEF0] border border-[#E2E4E8] text-[#111315] text-[13px] font-semibold py-2.5 px-4 rounded-xl transition cursor-pointer"
            >
              <FileBarChart2 size={14} className="text-[#5C626B]" /> View Reports
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Orders Table + Top Products + Store Health */}
      <div className="grid lg:grid-cols-[1.45fr_1fr_272px] gap-4 items-stretch">
        {/* Recent Orders Table */}
        <div className="bg-white rounded-[18px] border border-[#E2E4E8] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.03)] flex flex-col">
          <div className="px-5 py-3.5 border-b border-[#E2E4E8] flex items-center justify-between">
            <h2 className="font-display font-bold text-[14.5px] text-[#111315] flex items-center gap-2">
              <ShoppingCart size={15} className="text-[#16181A]" />
              Recent Orders
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('orders')}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#111315] hover:underline cursor-pointer"
            >
              View All Orders <ArrowRight size={13} />
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-[#686E78]">
              No customer orders yet. Orders placed via checkout or Create Order appear here immediately.
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-[#F7F8FA] text-[#686E78] font-medium border-b border-[#E2E4E8]">
                  <tr>
                    <th className="py-2.5 px-4">Order ID</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Payment</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEEF0]">
                  {orders.slice(0, 5).map((o) => {
                    const stKey = o.cancelled
                      ? 'cancelled'
                      : o.orderStatus || 'pending'
                    const st = STATUS_BADGE[stKey] || STATUS_BADGE.pending
                    const isPaid = (o.paymentStatus || '').toLowerCase() === 'paid'
                    return (
                      <tr
                        key={o.id}
                        onClick={() => onOpenOrder?.(o.id)}
                        className="hover:bg-[#F7F8FA] cursor-pointer"
                      >
                        <td className="py-2.5 px-4 font-mono font-bold text-[#111315] whitespace-nowrap">
                          #{o.id}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#ECEEF0] text-[#111315] text-[10px] font-bold grid place-items-center shrink-0">
                              {getInitials(o.customerName)}
                            </span>
                            <span className="font-medium text-[#111315] truncate max-w-[130px]">
                              {o.customerName}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#111315] tabular-nums whitespace-nowrap">
                          {formatINR(o.total)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                              isPaid
                                ? 'bg-[#DCFCE7] text-[#15803D]'
                                : 'bg-[#F1F2F4] text-[#4B5563]'
                            }`}
                          >
                            {isPaid
                              ? 'Paid'
                              : String(o.paymentMethod).toLowerCase().includes('cod')
                                ? 'COD'
                                : o.paymentStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${st.cls}`}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-[#686E78] whitespace-nowrap">
                          {new Date(o.placedAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-[18px] border border-[#E2E4E8] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.03)] flex flex-col">
          <div className="px-5 py-3.5 border-b border-[#E2E4E8] flex items-center justify-between">
            <h2 className="font-display font-bold text-[14.5px] text-[#111315] flex items-center gap-2">
              <Tag size={15} className="text-[#16181A]" />
              Top Products
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#111315] hover:underline cursor-pointer"
            >
              View All Products <ArrowRight size={13} />
            </button>
          </div>

          <div className="divide-y divide-[#ECEEF0] flex-1">
            {topProductsList.map((p) => (
              <div
                key={p.id}
                onClick={() => onOpenProduct?.(p.id)}
                className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#F7F8FA] cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Img
                    src={p.image}
                    alt={p.name}
                    className="w-10 h-10 rounded-lg object-cover border border-[#D8DCE2] bg-[#F7F8FA] shrink-0 shadow-[0_4px_10px_-2px_rgba(17,19,21,0.12)]"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-[13px] text-[#111315] truncate">
                      {p.name}
                    </p>
                    <p className="text-[11.5px] text-[#686E78] tabular-nums">
                      {p.unitsSold} sold · {formatINR(p.price)}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[11.5px] font-semibold tabular-nums shrink-0 ${
                    (p.stock ?? 0) <= threshold
                      ? 'text-[#E11D48]'
                      : 'text-[#15803D]'
                  }`}
                >
                  {p.stock ?? 0} left
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Store Health Card */}
        <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-[14.5px] text-[#111315] flex items-center gap-2">
              <HeartPulse size={15} className="text-[#16181A]" />
              Store Health
            </h2>
            <button
              type="button"
              onClick={onSyncSupabase}
              disabled={syncingSupabase}
              className="text-[11px] font-semibold text-[#111315] bg-[#ECEEF0] hover:bg-[#E2E4E8] px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-50"
            >
              {syncingSupabase ? 'Syncing...' : 'Sync'}
            </button>
          </div>

          <div className="space-y-2.5 flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-2.5 bg-gradient-to-b from-white to-[#F5F6F8] border border-[#DBDFE5] rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold text-[#111315] shadow-[0_4px_10px_-3px_rgba(17,19,21,0.07),inset_0_1px_0_#fff]">
              <CheckCircle2 size={15} className="text-[#16A34A] shrink-0" />
              <span>Website Online</span>
            </div>

            <div className="flex items-center gap-2.5 bg-gradient-to-b from-white to-[#F5F6F8] border border-[#DBDFE5] rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold text-[#111315] shadow-[0_4px_10px_-3px_rgba(17,19,21,0.07),inset_0_1px_0_#fff]">
              <CheckCircle2 size={15} className="text-[#16A34A] shrink-0" />
              <span>
                Payments (Razorpay {rzpInfo.enabled ? (rzpInfo.mode || 'Test') : 'Off'})
              </span>
            </div>

            <div className="flex items-center gap-2.5 bg-gradient-to-b from-white to-[#F5F6F8] border border-[#DBDFE5] rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold text-[#111315] shadow-[0_4px_10px_-3px_rgba(17,19,21,0.07),inset_0_1px_0_#fff]">
              <CheckCircle2 size={15} className="text-[#16A34A] shrink-0" />
              <span>
                Storage (Supabase {sbInfo.schemaReady ? 'Connected' : 'Ready'})
              </span>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="w-full text-left flex items-center gap-2.5 bg-white hover:bg-[#ECEEF0] border border-[#DBDFE5] rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold text-[#111315] transition cursor-pointer"
            >
              <Store size={15} className="text-[#16A34A] shrink-0" />
              <span>Inventory Sync ({products.length} SKUs)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
