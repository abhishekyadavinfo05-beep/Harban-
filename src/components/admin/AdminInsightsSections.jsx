import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BarChart2,
  Bell,
  CheckCircle2,
  CreditCard,
  Download,
  Globe,
  Lock,
  Megaphone,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  Trash2,
  Truck,
  UserCheck,
  Users,
} from 'lucide-react'
import { DEFAULT_COURIER_NAMES, DEFAULT_STORE_SETTINGS } from '../../lib/storeSettings'

const OWNER_EMAILS = ['abhishekyadavinfo05@gmail.com', 'harban.official@gmail.com']

const TIMEZONES = [
  '(GMT+05:30) India Standard Time — Mumbai',
  '(GMT+00:00) Coordinated Universal Time — UTC',
  '(GMT+04:00) Gulf Standard Time — Dubai',
  '(GMT+08:00) Singapore Standard Time — Singapore',
  '(GMT-05:00) Eastern Time — New York',
]

function isOwnerEmail(email) {
  return OWNER_EMAILS.includes(String(email || '').trim().toLowerCase())
}

function isSyntheticTestEmail(email) {
  return /^__tmp_/i.test(String(email || '').trim())
}

function toMs(val) {
  if (!val) return 0
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0
  const ms = new Date(val).getTime()
  return Number.isFinite(ms) ? ms : 0
}

function getOrderAmount(o) {
  return Number(o?.total ?? o?.totalAmount ?? 0) || 0
}

function csvCell(val) {
  if (val === null || val === undefined) return '""'
  const s =
    typeof val === 'object' ? JSON.stringify(val) : String(val)
  return `"${s.replace(/"/g, '""')}"`
}

function buildCsvContent(headers, rows) {
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) {
    lines.push(row.map(csvCell).join(','))
  }
  return `\uFEFF${lines.join('\r\n')}`
}

function triggerDownload(filename, content, mimeType) {
  if (typeof window === 'undefined') return
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadCsv(filename, headers, rows) {
  triggerDownload(filename, buildCsvContent(headers, rows), 'text/csv;charset=utf-8;')
}

function getRangeCutoff(range) {
  const now = new Date()
  if (range === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return start.getTime()
  }
  if (range === '7days') return Date.now() - 7 * 86400 * 1000
  if (range === '30days') return Date.now() - 30 * 86400 * 1000
  if (range === '12months') return Date.now() - 365 * 86400 * 1000
  return 0
}

/* ============================================================================
 * ANALYTICS SECTION
 * ========================================================================== */

export function AdminAnalyticsSection({ overview, pushToast }) {
  const [timeRange, setTimeRange] = useState('30days')
  const orders = overview.orders || []
  const products = overview.products || []
  const productViews = overview.productViews || []
  const cartEvents = overview.cartEvents || []
  const checkoutEvents = overview.checkoutEvents || []

  const cutoff = getRangeCutoff(timeRange)

  const filteredOrders = useMemo(
    () => orders.filter((o) => toMs(o.placedAt ?? o.createdAt) >= cutoff),
    [orders, cutoff],
  )
  const filteredViews = useMemo(
    () => productViews.filter((v) => toMs(v.createdAt ?? v.created_at) >= cutoff),
    [productViews, cutoff],
  )
  const filteredCart = useMemo(
    () => cartEvents.filter((c) => toMs(c.createdAt ?? c.created_at) >= cutoff),
    [cartEvents, cutoff],
  )
  const filteredCheckouts = useMemo(
    () => checkoutEvents.filter((c) => toMs(c.createdAt ?? c.created_at) >= cutoff),
    [checkoutEvents, cutoff],
  )

  const validOrders = filteredOrders.filter(
    (o) => !o.cancelled && o.orderStatus !== 'cancelled',
  )
  const totalRevenue = validOrders.reduce((sum, o) => sum + getOrderAmount(o), 0)
  const totalOrdersCount = validOrders.length
  const avgOrderValue =
    totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0

  const funnelSessions = filteredViews.length + filteredCheckouts.length
  const conversionRate =
    totalOrdersCount === 0
      ? '0.0%'
      : funnelSessions > 0
        ? `${Math.min(100, (totalOrdersCount / funnelSessions) * 100).toFixed(1)}%`
        : '100.0%'

  const chartOrders = useMemo(() => validOrders.slice(0, 12).reverse(), [validOrders])
  const maxOrderAmount = useMemo(
    () => Math.max(1, ...chartOrders.map(getOrderAmount)),
    [chartOrders],
  )

  const paymentBreakdown = useMemo(() => {
    let onlineCount = 0
    let onlineAmt = 0
    let codCount = 0
    let codAmt = 0
    for (const o of validOrders) {
      const amt = getOrderAmount(o)
      const method = String(o.paymentMethod || '').toLowerCase()
      if (method.includes('razorpay') || method.includes('online') || method.includes('upi') || method.includes('card')) {
        onlineCount += 1
        onlineAmt += amt
      } else {
        codCount += 1
        codAmt += amt
      }
    }
    return { onlineCount, onlineAmt, codCount, codAmt }
  }, [validOrders])

  const unitsSoldMap = useMemo(() => {
    const map = new Map()
    for (const o of validOrders) {
      for (const item of o.items || []) {
        const key = String(item.id || item.productId || item.name || '')
        if (!key) continue
        map.set(key, (map.get(key) || 0) + (Number(item.qty) || 1))
      }
    }
    return map
  }, [validOrders])

  const handleExportAnalytics = () => {
    const headers = [
      'Order Code',
      'Placed Date',
      'Customer',
      'Email',
      'Payment Method',
      'Payment Status',
      'Order Status',
      'Subtotal (INR)',
      'Shipping (INR)',
      'Discount (INR)',
      'Total (INR)',
    ]
    const rows = filteredOrders.map((o) => [
      o.id || o.orderCode || '',
      new Date(toMs(o.placedAt ?? o.createdAt) || Date.now()).toISOString(),
      o.customerName || 'Guest',
      o.customerEmail || '',
      o.paymentMethod || '',
      o.paymentStatus || '',
      o.cancelled ? 'cancelled' : o.orderStatus || 'pending',
      o.subtotal ?? getOrderAmount(o),
      o.shipping ?? 0,
      o.discount ?? 0,
      getOrderAmount(o),
    ])
    const dateTag = new Date().toISOString().slice(0, 10)
    downloadCsv(`harban-analytics-${timeRange}-${dateTag}.csv`, headers, rows)
    pushToast?.(`Exported ${filteredOrders.length} analytics records to CSV`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[22px] text-[#111827] tracking-tight leading-tight">
            Analytics &amp; Insights
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            Real-time performance metrics, sales trends, and conversion insights from your live database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] font-semibold text-[#111827] shadow-2xs outline-none cursor-pointer"
          >
            <option value="today">Today</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="12months">Last 12 months</option>
          </select>
          <button
            type="button"
            onClick={handleExportAnalytics}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#111827] px-4 py-2 rounded-xl shadow-2xs cursor-pointer"
          >
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Total Revenue',
            value: `₹${totalRevenue.toLocaleString('en-IN')}`,
            sub: `${totalOrdersCount} active orders`,
          },
          {
            title: 'Total Orders',
            value: totalOrdersCount.toLocaleString('en-IN'),
            sub: `${filteredOrders.length} total recorded`,
          },
          {
            title: 'Conversion Rate',
            value: conversionRate,
            sub: `${filteredViews.length} views · ${filteredCart.length} cart events`,
          },
          {
            title: 'Average Order Value',
            value: `₹${avgOrderValue.toLocaleString('en-IN')}`,
            sub: 'Per non-cancelled order',
          },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white rounded-[18px] border border-[#E2E4E8] p-5 space-y-2 shadow-2xs">
            <p className="text-[12.5px] font-semibold text-[#6B7078]">{kpi.title}</p>
            <div className="flex flex-col gap-1">
              <span className="font-display font-bold text-[24px] text-[#111315] tracking-tight">
                {kpi.value}
              </span>
              <span className="text-[11.5px] text-[#15803D] font-medium">{kpi.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-[18px] border border-[#E2E4E8] p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E2E4E8] pb-3">
            <div>
              <h2 className="font-display font-bold text-[16px] text-[#111315]">
                Sales Revenue Trend
              </h2>
              <p className="text-[12.5px] text-[#6B7078]">
                Recent non-cancelled orders scaled proportionally in ₹.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11.5px]">
              <span className="font-semibold text-[#15803D] bg-[#DCFCE7] px-2.5 py-1 rounded-lg">
                Online: {paymentBreakdown.onlineCount} (₹{paymentBreakdown.onlineAmt.toLocaleString('en-IN')})
              </span>
              <span className="font-semibold text-[#374151] bg-[#F1F2F4] px-2.5 py-1 rounded-lg">
                COD: {paymentBreakdown.codCount} (₹{paymentBreakdown.codAmt.toLocaleString('en-IN')})
              </span>
            </div>
          </div>

          {chartOrders.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center text-[#6B7078] text-[13px] bg-[#F7F8FA] rounded-xl border border-dashed border-[#E2E4E8]">
              <BarChart2 size={32} className="text-[#9CA3AF] mb-2" />
              <p>No sales recorded in this period.</p>
              <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">
                Revenue bars populate automatically once orders are placed.
              </p>
            </div>
          ) : (
            <div className="h-64 flex items-end justify-between gap-2 pt-8 pb-2 px-3 bg-[#ECEFF3] rounded-xl border border-[#D8DCE2] shadow-[inset_0_2px_5px_rgba(17,19,21,0.06)]">
              {chartOrders.map((o, i) => {
                const amt = getOrderAmount(o)
                const pct = Math.max(12, Math.round((amt / maxOrderAmount) * 100))
                const dt = toMs(o.placedAt ?? o.createdAt)
                const shortDate = dt
                  ? new Date(dt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })
                  : ''
                return (
                  <div
                    key={o.id || i}
                    className="flex-1 min-w-0 flex flex-col items-center gap-1.5 h-full justify-end group"
                  >
                    <div
                      style={{ height: `${pct}%` }}
                      className="w-full max-w-[44px] bg-gradient-to-b from-[#34383F] via-[#17191C] to-[#0E1012] border border-black/25 shadow-[5px_8px_14px_rgba(17,19,21,0.24),inset_1px_1px_0_rgba(255,255,255,0.28)] hover:brightness-110 rounded-t-lg transition-all relative"
                    >
                      <span className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-gradient-to-b from-[#2B2F36] to-[#121417] text-white border border-white/15 shadow-[0_6px_14px_rgba(14,16,18,0.4)] text-[10px] font-semibold px-2 py-0.5 rounded-md transition whitespace-nowrap z-10 pointer-events-none">
                        ₹{amt.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-[#374151] truncate max-w-full">
                      #{o.id}
                    </span>
                    <span className="text-[9.5px] text-[#9CA3AF] truncate max-w-full">
                      {shortDate}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-6 space-y-4 shadow-2xs">
          <div className="border-b border-[#E2E4E8] pb-3">
            <h2 className="font-display font-bold text-[16px] text-[#111315]">
              Product Performance &amp; Stock
            </h2>
            <p className="text-[12.5px] text-[#686E78]">Units sold &amp; live stock catalog.</p>
          </div>
          <div className="space-y-3">
            {products.slice(0, 6).map((p, idx) => {
              const sold = unitsSoldMap.get(String(p.id)) || unitsSoldMap.get(String(p.name)) || 0
              return (
                <div
                  key={p.id || idx}
                  className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0 gap-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={p.imageUrl || p.image || '/images/product-ht100.jpg'}
                      alt=""
                      className="w-9 h-9 rounded-xl object-cover bg-[#F3F4F6] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#111827] truncate">
                        {p.name || p.title}
                      </p>
                      <p className="text-[11.5px] text-[#6B7280]">
                        ₹{Number(p.price || 0).toLocaleString('en-IN')} · {sold} sold
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                      (p.stock ?? 0) > 0
                        ? 'bg-[#DCFCE7] text-[#15803D]'
                        : 'bg-[#FEE2E2] text-[#B91C1C]'
                    }`}
                  >
                    {p.stock ?? 0} in stock
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
 * MARKETING SECTION
 * ========================================================================== */

export function AdminMarketingSection({
  overview,
  onNavigate,
  onSaveSettings,
  onReload,
  pushToast,
}) {
  const mkt = overview.settings?.marketing || DEFAULT_STORE_SETTINGS.marketing

  const [googleAdsConnected, setGoogleAdsConnected] = useState(
    Boolean(mkt.googleAdsConnected),
  )
  const [googleAdsId, setGoogleAdsId] = useState(mkt.googleAdsId || '')
  const [metaAdsConnected, setMetaAdsConnected] = useState(
    Boolean(mkt.metaAdsConnected),
  )
  const [metaPageId, setMetaPageId] = useState(mkt.metaPageId || '')
  const [whatsappConnected, setWhatsappConnected] = useState(
    Boolean(mkt.whatsappConnected),
  )
  const [whatsappNumber, setWhatsappNumber] = useState(
    mkt.whatsappNumber || '+91 95551 37346',
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const next = overview.settings?.marketing
    if (!next) return
    setGoogleAdsConnected(Boolean(next.googleAdsConnected))
    setGoogleAdsId(next.googleAdsId || '')
    setMetaAdsConnected(Boolean(next.metaAdsConnected))
    setMetaPageId(next.metaPageId || '')
    setWhatsappConnected(Boolean(next.whatsappConnected))
    setWhatsappNumber(next.whatsappNumber || '+91 95551 37346')
  }, [overview.settings])

  const customers = (overview.customers || []).filter(
    (c) => !isSyntheticTestEmail(c.email),
  )
  const discounts = overview.discounts || []
  const activeDiscounts = discounts.filter((d) => d.isActive !== false)
  const attributions = overview.marketingAttributions || []
  const attributedOrders = (overview.orders || []).filter(
    (o) => o.utmSource || o.utmCampaign,
  )

  const connectedCount =
    (googleAdsConnected ? 1 : 0) +
    (metaAdsConnected ? 1 : 0) +
    (whatsappConnected ? 1 : 0)

  const persistMarketing = async (nextMarketing, message) => {
    if (!onSaveSettings) return
    setSaving(true)
    try {
      await onSaveSettings({ marketing: nextMarketing }, { silent: Boolean(message) })
      if (message) pushToast?.(message)
      await onReload?.()
    } catch (err) {
      pushToast?.(
        err instanceof Error ? err.message : 'Unable to save channel settings.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleToggleChannel = async (channel) => {
    if (channel === 'google') {
      const nextConnected = !googleAdsConnected
      setGoogleAdsConnected(nextConnected)
      await persistMarketing(
        {
          googleAdsConnected: nextConnected,
          googleAdsId: googleAdsId.trim(),
          metaAdsConnected,
          metaPageId: metaPageId.trim(),
          whatsappConnected,
          whatsappNumber: whatsappNumber.trim(),
        },
        nextConnected
          ? 'Google Ads & Tag connected and saved'
          : 'Google Ads disconnected',
      )
    } else if (channel === 'meta') {
      const nextConnected = !metaAdsConnected
      setMetaAdsConnected(nextConnected)
      await persistMarketing(
        {
          googleAdsConnected,
          googleAdsId: googleAdsId.trim(),
          metaAdsConnected: nextConnected,
          metaPageId: metaPageId.trim(),
          whatsappConnected,
          whatsappNumber: whatsappNumber.trim(),
        },
        nextConnected
          ? 'Meta Ads & Pixel connected and saved'
          : 'Meta Ads disconnected',
      )
    } else if (channel === 'whatsapp') {
      const nextConnected = !whatsappConnected
      setWhatsappConnected(nextConnected)
      await persistMarketing(
        {
          googleAdsConnected,
          googleAdsId: googleAdsId.trim(),
          metaAdsConnected,
          metaPageId: metaPageId.trim(),
          whatsappConnected: nextConnected,
          whatsappNumber: whatsappNumber.trim(),
        },
        nextConnected
          ? 'WhatsApp Business connected and saved'
          : 'WhatsApp Business disconnected',
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[22px] text-[#111827] tracking-tight leading-tight">
            Marketing &amp; Campaigns
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            Connect live tracking channels, view UTM attributions, and launch promo codes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate?.('discounts')}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-[#16181A] hover:bg-[#272A2E] text-white px-4 py-2 rounded-xl shadow-xs cursor-pointer"
        >
          <Megaphone size={14} /> Manage Promo Campaigns
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-5 space-y-2 shadow-2xs">
          <p className="text-[12.5px] font-semibold text-[#6B7078]">
            Connected Ad Channels
          </p>
          <p className="font-display font-bold text-[24px] text-[#111315]">
            {connectedCount} / 3
          </p>
          <p className="text-[12px] text-[#6B7078]">
            {connectedCount > 0 ? 'Channel settings synced to database' : 'No ad channels connected yet'}
          </p>
        </div>

        <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-5 space-y-2 shadow-2xs">
          <p className="text-[12.5px] font-semibold text-[#6B7078]">
            Registered Customers
          </p>
          <p className="font-display font-bold text-[24px] text-[#111315]">
            {customers.length}
          </p>
          <p className="text-[12px] text-[#6B7078]">Active customer accounts in DB</p>
        </div>

        <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-5 space-y-2 shadow-2xs">
          <p className="text-[12.5px] font-semibold text-[#6B7078]">
            Active Discount Codes
          </p>
          <p className="font-display font-bold text-[24px] text-[#111315]">
            {activeDiscounts.length}
          </p>
          <p className="text-[12px] text-[#6B7078]">
            {attributedOrders.length} UTM-attributed orders recorded
          </p>
        </div>
      </div>

      <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-6 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-bold text-[16px] text-[#111315]">
              Advertising &amp; Integration Channels
            </h2>
            <p className="text-[12.5px] text-[#6B7078]">
              Enter your live tracking IDs or Business numbers and save to persist across both servers.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              persistMarketing(
                {
                  googleAdsConnected,
                  googleAdsId: googleAdsId.trim(),
                  metaAdsConnected,
                  metaPageId: metaPageId.trim(),
                  whatsappConnected,
                  whatsappNumber: whatsappNumber.trim(),
                },
                'Marketing channel IDs saved',
              )
            }
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold bg-[#16181A] hover:bg-[#272A2E] text-white px-3.5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
          >
            <Save size={13} /> {saving ? 'Saving...' : 'Save Channel IDs'}
          </button>
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#F7F8FA] rounded-xl border border-[#E2E4E8]">
            <div className="space-y-1 flex-1">
              <p className="font-semibold text-[13.5px] text-[#111315]">
                Google Shopping &amp; Ads Tag
              </p>
              <input
                value={googleAdsId}
                onChange={(e) => setGoogleAdsId(e.target.value)}
                placeholder="Enter Google Ads ID (e.g. AW-123456789)"
                className="w-full max-w-sm bg-white border border-[#E2E4E8] rounded-lg px-3 py-1.5 text-[12.5px] outline-none focus:border-[#16181A]"
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleToggleChannel('google')}
              className={`text-[12px] font-semibold px-4 py-2 rounded-xl cursor-pointer transition shrink-0 ${
                googleAdsConnected
                  ? 'bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]'
                  : 'bg-[#16181A] text-white hover:bg-[#272A2E]'
              }`}
            >
              {googleAdsConnected ? 'Connected ✓' : 'Connect Google Ads'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#F7F8FA] rounded-xl border border-[#E2E4E8]">
            <div className="space-y-1 flex-1">
              <p className="font-semibold text-[13.5px] text-[#111315]">
                Meta Ads (Instagram &amp; Facebook Pixel)
              </p>
              <input
                value={metaPageId}
                onChange={(e) => setMetaPageId(e.target.value)}
                placeholder="Enter Meta Pixel / Page ID"
                className="w-full max-w-sm bg-white border border-[#E2E4E8] rounded-lg px-3 py-1.5 text-[12.5px] outline-none focus:border-[#16181A]"
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleToggleChannel('meta')}
              className={`text-[12px] font-semibold px-4 py-2 rounded-xl cursor-pointer transition shrink-0 ${
                metaAdsConnected
                  ? 'bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]'
                  : 'bg-[#16181A] text-white hover:bg-[#272A2E]'
              }`}
            >
              {metaAdsConnected ? 'Connected ✓' : 'Connect Meta Ads'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#F7F8FA] rounded-xl border border-[#E2E4E8]">
            <div className="space-y-1 flex-1">
              <p className="font-semibold text-[13.5px] text-[#111315]">
                WhatsApp Business API
              </p>
              <input
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+91 95551 37346"
                className="w-full max-w-sm bg-white border border-[#E2E4E8] rounded-lg px-3 py-1.5 text-[12.5px] outline-none focus:border-[#16181A]"
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleToggleChannel('whatsapp')}
              className={`text-[12px] font-semibold px-4 py-2 rounded-xl cursor-pointer transition shrink-0 ${
                whatsappConnected
                  ? 'bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]'
                  : 'bg-[#16181A] text-white hover:bg-[#272A2E]'
              }`}
            >
              {whatsappConnected ? 'Connected ✓' : 'Connect WhatsApp API'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E2E4E8] pb-2.5">
            <h3 className="font-display font-bold text-[15px] text-[#111315]">
              Live Promo Codes
            </h3>
            <button
              type="button"
              onClick={() => onNavigate?.('discounts')}
              className="text-[12px] font-semibold text-[#111315] hover:underline cursor-pointer"
            >
              Open Discounts →
            </button>
          </div>
          {discounts.length === 0 ? (
            <p className="text-[12.5px] text-[#6B7078] py-4 text-center">
              No discount codes configured yet. Create one in Discounts.
            </p>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {discounts.slice(0, 5).map((d) => (
                <div key={d.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-mono font-bold text-[13px] text-[#111315]">
                      {d.code}
                    </p>
                    <p className="text-[11.5px] text-[#6B7078]">
                      {d.discountType === 'fixed' ? `₹${d.value} off` : `${d.value}% off`} · Used {d.usedCount ?? 0} times
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      d.isActive !== false
                        ? 'bg-[#DCFCE7] text-[#15803D]'
                        : 'bg-[#F1F2F4] text-[#6B7078]'
                    }`}
                  >
                    {d.isActive !== false ? 'Active' : 'Paused'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-5 space-y-3 shadow-2xs">
          <div className="border-b border-[#E2E4E8] pb-2.5">
            <h3 className="font-display font-bold text-[15px] text-[#111827]">
              UTM Campaign Attributions
            </h3>
          </div>
          {attributions.length === 0 && attributedOrders.length === 0 ? (
            <p className="text-[12.5px] text-[#6B7280] py-4 text-center">
              No UTM campaign traffic recorded yet. Links with ?utm_source=... appear here automatically.
            </p>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {(attributions.length > 0 ? attributions : attributedOrders)
                .slice(0, 5)
                .map((row, idx) => (
                  <div key={row.id || idx} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-semibold text-[#111827]">
                        {row.utmSource || row.utm_source || 'Direct'}{' '}
                        {(row.utmCampaign || row.utm_campaign) &&
                          `· ${row.utmCampaign || row.utm_campaign}`}
                      </p>
                      <p className="text-[11.5px] text-[#6B7280]">
                        {row.utmMedium || row.utm_medium || 'campaign'}
                      </p>
                    </div>
                    <span className="text-[12px] font-semibold text-[#111827]">
                      {row.orderCode || row.order_code || `#${row.id}`}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
 * REPORTS SECTION
 * ========================================================================== */

export function AdminReportsSection({ overview, pushToast }) {
  const orders = overview.orders || []
  const products = overview.products || []
  const customers = (overview.customers || []).filter(
    (c) => !isSyntheticTestEmail(c.email),
  )

  const buildGstReport = () => {
    const headers = [
      'Order Code',
      'Date',
      'Customer',
      'State',
      'Payment Status',
      'Order Status',
      'Subtotal (INR)',
      'Shipping (INR)',
      'Discount (INR)',
      'Taxable Value (18% Base)',
      'GST 18% (INR)',
      'Total Payable (INR)',
    ]
    const rows = orders.map((o) => {
      const total = getOrderAmount(o)
      const taxable = Math.round((total / 1.18) * 100) / 100
      const gst = Math.round((total - taxable) * 100) / 100
      return [
        o.id || o.orderCode || '',
        new Date(toMs(o.placedAt ?? o.createdAt) || Date.now()).toISOString().slice(0, 10),
        o.customerName || 'Guest',
        o.shippingAddress?.state || '',
        o.paymentStatus || 'pending',
        o.cancelled ? 'cancelled' : o.orderStatus || 'pending',
        o.subtotal ?? total,
        o.shipping ?? 0,
        o.discount ?? 0,
        taxable.toFixed(2),
        gst.toFixed(2),
        total,
      ]
    })
    return { headers, rows }
  }

  const buildInventoryReport = () => {
    const headers = [
      'Product ID',
      'SKU',
      'Product Title',
      'Category',
      'Selling Price (INR)',
      'MRP (INR)',
      'Current Stock',
      'Stock Valuation (INR)',
      'Status',
    ]
    const rows = products.map((p) => {
      const price = Number(p.price || 0)
      const stock = Number(p.stock ?? 0)
      return [
        p.id || '',
        p.sku || '',
        p.name || p.title || '',
        p.category || '',
        price,
        Number(p.mrp ?? price),
        stock,
        price * stock,
        p.isActive === false ? 'Draft' : stock > 0 ? 'Active' : 'Out of stock',
      ]
    })
    return { headers, rows }
  }

  const buildCustomerReport = () => {
    const orderStats = new Map()
    for (const o of orders) {
      if (o.cancelled || o.orderStatus === 'cancelled') continue
      const key = String(o.customerEmail || '').trim().toLowerCase()
      if (!key) continue
      const prev = orderStats.get(key) || { count: 0, spend: 0 }
      prev.count += 1
      prev.spend += getOrderAmount(o)
      orderStats.set(key, prev)
    }
    const headers = [
      'UID',
      'Name',
      'Email',
      'Phone',
      'Role',
      'Orders Count',
      'Total Spend (INR)',
      'Joined Date',
    ]
    const rows = customers.map((c) => {
      const stat = orderStats.get(String(c.email || '').trim().toLowerCase()) || {
        count: 0,
        spend: 0,
      }
      return [
        c.uid || c.id || '',
        c.name || '',
        c.email || '',
        c.phone || '',
        c.role || 'customer',
        stat.count,
        stat.spend,
        c.createdAt ? new Date(toMs(c.createdAt)).toISOString().slice(0, 10) : '',
      ]
    })
    return { headers, rows }
  }

  const buildSettlementReport = () => {
    const headers = [
      'Order Code',
      'Date',
      'Customer',
      'Payment Method',
      'Payment Status',
      'Refund Status',
      'Refund Amount (INR)',
      'Order Total (INR)',
      'Net Settlement (INR)',
    ]
    const rows = orders.map((o) => {
      const total = getOrderAmount(o)
      const refund = Number(o.refundAmount || 0)
      const net = o.cancelled ? Math.max(0, total - refund) : Math.max(0, total - refund)
      return [
        o.id || o.orderCode || '',
        new Date(toMs(o.placedAt ?? o.createdAt) || Date.now()).toISOString().slice(0, 10),
        o.customerName || 'Guest',
        o.paymentMethod || 'COD',
        o.paymentStatus || 'pending',
        o.refundStatus || 'none',
        refund,
        total,
        o.cancelled && o.paymentStatus !== 'paid' ? 0 : net,
      ]
    })
    return { headers, rows }
  }

  const handleDownloadSingle = (key) => {
    const dateTag = new Date().toISOString().slice(0, 10)
    if (key === 'gst') {
      const { headers, rows } = buildGstReport()
      downloadCsv(`harban-gst-summary-${dateTag}.csv`, headers, rows)
      pushToast?.('GST Summary Report downloaded')
    } else if (key === 'inventory') {
      const { headers, rows } = buildInventoryReport()
      downloadCsv(`harban-inventory-valuation-${dateTag}.csv`, headers, rows)
      pushToast?.('Inventory Valuation Report downloaded')
    } else if (key === 'customers') {
      const { headers, rows } = buildCustomerReport()
      downloadCsv(`harban-customer-database-${dateTag}.csv`, headers, rows)
      pushToast?.('Customer Database Report downloaded')
    } else if (key === 'settlement') {
      const { headers, rows } = buildSettlementReport()
      downloadCsv(`harban-payment-settlement-${dateTag}.csv`, headers, rows)
      pushToast?.('Payment Settlement Report downloaded')
    }
  }

  const handleDownloadAll = () => {
    const dateTag = new Date().toISOString().slice(0, 10)
    const gst = buildGstReport()
    const inv = buildInventoryReport()
    const cust = buildCustomerReport()
    const sett = buildSettlementReport()
    const combined = [
      '=== GST SUMMARY REPORT ===',
      buildCsvContent(gst.headers, gst.rows).replace(/^\uFEFF/, ''),
      '',
      '=== INVENTORY VALUATION REPORT ===',
      buildCsvContent(inv.headers, inv.rows).replace(/^\uFEFF/, ''),
      '',
      '=== CUSTOMER DATABASE REPORT ===',
      buildCsvContent(cust.headers, cust.rows).replace(/^\uFEFF/, ''),
      '',
      '=== PAYMENT SETTLEMENT REPORT ===',
      buildCsvContent(sett.headers, sett.rows).replace(/^\uFEFF/, ''),
    ].join('\r\n')
    triggerDownload(
      `harban-all-reports-${dateTag}.csv`,
      `\uFEFF${combined}`,
      'text/csv;charset=utf-8;',
    )
    pushToast?.('Complete store reports bundle downloaded as CSV')
  }

  const reports = [
    {
      key: 'gst',
      title: 'GST Summary Report',
      desc: `${orders.length} orders recorded with taxable value and 18% GST breakup.`,
      count: `${orders.length} records`,
    },
    {
      key: 'inventory',
      title: 'Inventory Valuation Report',
      desc: `${products.length} products currently in catalog with live stock valuation.`,
      count: `${products.length} SKUs`,
    },
    {
      key: 'customers',
      title: 'Customer Database Report',
      desc: `${customers.length} registered customer accounts with order count and total spend.`,
      count: `${customers.length} customers`,
    },
    {
      key: 'settlement',
      title: 'Payment Settlement Report',
      desc: 'Razorpay and COD payment reconciliation, refunds, and net settlement.',
      count: `${orders.length} transactions`,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[22px] text-[#111827] tracking-tight leading-tight">
            Financial &amp; Inventory Reports
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            Download real-time CSV reports generated directly from your live database records.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadAll}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-[#16181A] hover:bg-[#272A2E] text-white px-4 py-2 rounded-xl shadow-xs cursor-pointer"
        >
          <Download size={14} /> Download All Reports (CSV)
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {reports.map((rep) => (
          <div
            key={rep.key}
            className="bg-white rounded-[18px] border border-[#E2E4E8] p-5 space-y-3 shadow-2xs flex flex-col justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-[15px] text-[#111315]">
                  {rep.title}
                </h3>
                <span className="text-[11px] font-semibold bg-[#F1F2F4] text-[#111315] border border-[#E2E4E8] px-2.5 py-0.5 rounded-md shrink-0">
                  {rep.count}
                </span>
              </div>
              <p className="text-[12.5px] text-[#6B7078]">{rep.desc}</p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-[#E2E4E8]">
              <span className="text-[11.5px] text-[#9CA3AF]">Live from Database</span>
              <button
                type="button"
                onClick={() => handleDownloadSingle(rep.key)}
                className="text-[12px] font-semibold text-[#111315] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Download CSV <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================================================================
 * SETTINGS SECTION (ALL 10 TABS PERSISTED)
 * ========================================================================== */

const SETTING_TABS = [
  { id: 'general', label: 'General', icon: Sliders },
  { id: 'store_info', label: 'Store Information', icon: ShoppingBag },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'shipping', label: 'Shipping & Delivery', icon: Truck },
  { id: 'users', label: 'Users & Roles', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'seo', label: 'SEO & Analytics', icon: Globe },
  { id: 'integrations', label: 'Integrations', icon: Server },
  { id: 'advanced', label: 'Advanced', icon: Lock },
]

function normalizeCouriersState(raw) {
  const out = {}
  for (const name of DEFAULT_COURIER_NAMES) {
    const src = raw?.[name]
    out[name] = {
      connected: Boolean(src?.connected),
      apiKey: String(src?.apiKey || ''),
    }
  }
  return out
}

export function AdminSettingsSection({
  overview,
  activeTabProp = 'general',
  onTabChange,
  onSyncSupabase,
  syncingSupabase = false,
  onSaveSettings,
  onUpdateUserRole,
  onCreateUser,
  onDeleteUser,
  onReload,
  pushToast,
}) {
  const s = overview.settings || DEFAULT_STORE_SETTINGS
  const sb = overview.integrations?.supabase || {}
  const rzp = overview.integrations?.razorpay || {}

  const [localTab, setLocalTab] = useState(activeTabProp || 'general')
  const validTab = SETTING_TABS.some((t) => t.id === activeTabProp)
    ? activeTabProp
    : localTab
  const activeTab = onTabChange ? validTab : localTab
  const setActiveTab = (tabId) => {
    setLocalTab(tabId)
    onTabChange?.(tabId)
  }
  const [saving, setSaving] = useState(false)

  // General
  const [storeName, setStoreName] = useState(s.storeName || 'HARBAN')
  const [storeEmail, setStoreEmail] = useState(s.supportEmail || 'harban.official@gmail.com')
  const [storeUrl, setStoreUrl] = useState(
    s.general?.storeUrl || 'https://harban.web.app',
  )
  const [supportPhone, setSupportPhone] = useState(s.supportPhone || '+91 95551 37346')
  const [currency, setCurrency] = useState(s.general?.currency || 'INR')
  const [timezone, setTimezone] = useState(
    s.general?.timezone || '(GMT+05:30) India Standard Time — Mumbai',
  )
  const [language, setLanguage] = useState(s.general?.language || 'English')
  const [storeStatus, setStoreStatus] = useState(s.general?.storeStatus !== false)

  // Store Information
  const [addressLine1, setAddressLine1] = useState(
    s.storeInfo?.addressLine1 || 'A-101, Goregaon West',
  )
  const [city, setCity] = useState(s.storeInfo?.city || 'Mumbai')
  const [stateName, setStateName] = useState(s.storeInfo?.state || 'Maharashtra')
  const [pincode, setPincode] = useState(s.storeInfo?.pincode || '400104')
  const [country, setCountry] = useState(s.storeInfo?.country || 'India')
  const [gstin, setGstin] = useState(s.storeInfo?.gstin || '')

  // Payments
  const isLiveMode = rzp.mode === 'live'
  const isConfigured = Boolean(rzp.configured)
  const [razorpayEnabled, setRazorpayEnabled] = useState(
    s.payments?.razorpayEnabled !== false && rzp.enabled !== false,
  )
  const [upiEnabled, setUpiEnabled] = useState(s.payments?.upiEnabled !== false)
  const [cardsEnabled, setCardsEnabled] = useState(s.payments?.cardsEnabled !== false)
  const [netbankingEnabled, setNetbankingEnabled] = useState(
    s.payments?.netbankingEnabled !== false,
  )
  const [codEnabled, setCodEnabled] = useState(s.payments?.codEnabled !== false)

  // Shipping
  const [freeShippingMin, setFreeShippingMin] = useState(
    String(s.shipping?.freeShippingMin ?? s.freeShippingThreshold ?? 1500),
  )
  const [standardCharge, setStandardCharge] = useState(
    String(s.shipping?.standardCharge ?? 0),
  )
  const [courierAutoDispatch, setCourierAutoDispatch] = useState(
    Boolean(s.courierAutoDispatch),
  )
  const [couriers, setCouriers] = useState(() =>
    normalizeCouriersState(s.shipping?.couriers),
  )

  // Notifications
  const [notifEmail, setNotifEmail] = useState(s.notifications?.orderEmail !== false)
  const [notifSms, setNotifSms] = useState(s.notifications?.smsAlerts !== false)
  const [notifWhatsapp, setNotifWhatsapp] = useState(
    s.notifications?.whatsappUpdates !== false,
  )
  const [adminAlertEmail, setAdminAlertEmail] = useState(
    s.notifications?.adminAlertEmail || s.supportEmail || 'harban.official@gmail.com',
  )

  // Appearance
  const [primaryColor, setPrimaryColor] = useState(
    s.appearance?.primaryColor || '#0C1B2E',
  )
  const [accentColor, setAccentColor] = useState(
    s.appearance?.accentColor || '#1D5CAD',
  )

  // SEO & Analytics
  const [metaTitle, setMetaTitle] = useState(
    s.seo?.metaTitle || DEFAULT_STORE_SETTINGS.seo.metaTitle,
  )
  const [metaDesc, setMetaDesc] = useState(
    s.seo?.metaDesc || DEFAULT_STORE_SETTINGS.seo.metaDesc,
  )
  const [gaMeasurementId, setGaMeasurementId] = useState(
    s.seo?.gaMeasurementId || '',
  )
  const [metaPixelId, setMetaPixelId] = useState(s.seo?.metaPixelId || '')

  // Advanced
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(s.lowStockThreshold ?? 5),
  )

  // Users & Roles state
  const [userSearch, setUserSearch] = useState('')
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPhone, setNewUserPhone] = useState('')
  const [newUserRole, setNewUserRole] = useState('admin')
  const [userBusyUid, setUserBusyUid] = useState('')

  useEffect(() => {
    const src = overview.settings
    if (!src) return
    setStoreName(src.storeName || 'HARBAN')
    setStoreEmail(src.supportEmail || 'harban.official@gmail.com')
    setSupportPhone(src.supportPhone || '+91 95551 37346')
    setLowStockThreshold(String(src.lowStockThreshold ?? 5))
    setCourierAutoDispatch(Boolean(src.courierAutoDispatch))

    if (src.general) {
      setStoreUrl(src.general.storeUrl || 'https://harban.web.app')
      setCurrency(src.general.currency || 'INR')
      setTimezone(
        src.general.timezone || '(GMT+05:30) India Standard Time — Mumbai',
      )
      setLanguage(src.general.language || 'English')
      setStoreStatus(src.general.storeStatus !== false)
    }
    if (src.storeInfo) {
      setAddressLine1(src.storeInfo.addressLine1 || 'A-101, Goregaon West')
      setCity(src.storeInfo.city || 'Mumbai')
      setStateName(src.storeInfo.state || 'Maharashtra')
      setPincode(src.storeInfo.pincode || '400104')
      setCountry(src.storeInfo.country || 'India')
      setGstin(src.storeInfo.gstin || '')
    }
    if (src.payments) {
      setRazorpayEnabled(src.payments.razorpayEnabled !== false)
      setUpiEnabled(src.payments.upiEnabled !== false)
      setCardsEnabled(src.payments.cardsEnabled !== false)
      setNetbankingEnabled(src.payments.netbankingEnabled !== false)
      setCodEnabled(src.payments.codEnabled !== false)
    }
    if (src.shipping) {
      setFreeShippingMin(
        String(src.shipping.freeShippingMin ?? src.freeShippingThreshold ?? 1500),
      )
      setStandardCharge(String(src.shipping.standardCharge ?? 0))
      setCouriers(normalizeCouriersState(src.shipping.couriers))
    }
    if (src.notifications) {
      setNotifEmail(src.notifications.orderEmail !== false)
      setNotifSms(src.notifications.smsAlerts !== false)
      setNotifWhatsapp(src.notifications.whatsappUpdates !== false)
      setAdminAlertEmail(
        src.notifications.adminAlertEmail || src.supportEmail || 'harban.official@gmail.com',
      )
    }
    if (src.appearance) {
      setPrimaryColor(src.appearance.primaryColor || '#0C1B2E')
      setAccentColor(src.appearance.accentColor || '#1D5CAD')
    }
    if (src.seo) {
      setMetaTitle(src.seo.metaTitle || DEFAULT_STORE_SETTINGS.seo.metaTitle)
      setMetaDesc(src.seo.metaDesc || DEFAULT_STORE_SETTINGS.seo.metaDesc)
      setGaMeasurementId(src.seo.gaMeasurementId || '')
      setMetaPixelId(src.seo.metaPixelId || '')
    }
  }, [overview.settings])

  const buildPayload = (courierOverride) => {
    const freeMinNum = Math.max(0, Math.round(Number(freeShippingMin) || 0))
    const stdChargeNum = Math.max(0, Math.round(Number(standardCharge) || 0))
    const lowStockNum = Math.max(0, Math.round(Number(lowStockThreshold) || 0))
    const activeCouriers = courierOverride || couriers
    const connectedNames = Object.entries(activeCouriers)
      .filter(([, v]) => v?.connected)
      .map(([k]) => k)

    return {
      storeName: storeName.trim() || 'HARBAN',
      supportEmail: storeEmail.trim() || 'harban.official@gmail.com',
      supportPhone: supportPhone.trim(),
      lowStockThreshold: lowStockNum,
      freeShippingThreshold: freeMinNum,
      courierProvider:
        connectedNames.length > 0
          ? connectedNames.join(', ')
          : 'Manual / Configurable',
      courierAutoDispatch,
      general: {
        storeUrl: storeUrl.trim() || 'https://harban.web.app',
        currency,
        timezone,
        language,
        storeStatus,
      },
      storeInfo: {
        addressLine1: addressLine1.trim(),
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        country: country.trim(),
        gstin: gstin.trim().toUpperCase(),
      },
      payments: {
        razorpayEnabled,
        upiEnabled,
        cardsEnabled,
        netbankingEnabled,
        codEnabled,
      },
      shipping: {
        freeShippingMin: freeMinNum,
        standardCharge: stdChargeNum,
        couriers: activeCouriers,
      },
      notifications: {
        orderEmail: notifEmail,
        smsAlerts: notifSms,
        whatsappUpdates: notifWhatsapp,
        adminAlertEmail: adminAlertEmail.trim() || storeEmail.trim(),
      },
      appearance: {
        primaryColor,
        accentColor,
      },
      seo: {
        metaTitle: metaTitle.trim(),
        metaDesc: metaDesc.trim(),
        gaMeasurementId: gaMeasurementId.trim(),
        metaPixelId: metaPixelId.trim(),
      },
    }
  }

  const handleSave = async (e) => {
    e?.preventDefault()
    if (!onSaveSettings) return
    setSaving(true)
    try {
      await onSaveSettings(buildPayload())
      await onReload?.()
    } catch (err) {
      pushToast?.(
        err instanceof Error ? err.message : 'Unable to save settings.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleToggleCourier = async (name) => {
    const nextCouriers = {
      ...couriers,
      [name]: {
        connected: !couriers[name]?.connected,
        apiKey: couriers[name]?.apiKey || '',
      },
    }
    setCouriers(nextCouriers)
    if (!onSaveSettings) return
    setSaving(true)
    try {
      await onSaveSettings(buildPayload(nextCouriers), { silent: true })
      pushToast?.(
        nextCouriers[name].connected
          ? `${name} connected & saved`
          : `${name} disconnected & saved`,
      )
      await onReload?.()
    } catch (err) {
      pushToast?.(
        err instanceof Error ? err.message : `Failed to update ${name}.`,
      )
    } finally {
      setSaving(false)
    }
  }

  const allAccounts = overview.customers || []
  const syntheticAccounts = allAccounts.filter((c) =>
    isSyntheticTestEmail(c.email),
  )
  const visibleAccounts = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    const clean = allAccounts.filter((c) => !isSyntheticTestEmail(c.email))
    const sorted = [...clean].sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1
      if (a.role !== 'admin' && b.role === 'admin') return 1
      return String(a.name || '').localeCompare(String(b.name || ''))
    })
    if (!q) return sorted
    return sorted.filter(
      (u) =>
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q),
    )
  }, [allAccounts, userSearch])

  const handleAddUser = async (e) => {
    e.preventDefault()
    if (!onCreateUser) return
    setUserBusyUid('new')
    try {
      await onCreateUser({
        name: newUserName,
        email: newUserEmail,
        phone: newUserPhone,
        role: newUserRole,
      })
      setNewUserName('')
      setNewUserEmail('')
      setNewUserPhone('')
      setShowAddUser(false)
      await onReload?.()
    } catch (err) {
      pushToast?.(
        err instanceof Error ? err.message : 'Unable to add user account.',
      )
    } finally {
      setUserBusyUid('')
    }
  }

  const handleRoleChange = async (account, nextRole) => {
    if (!onUpdateUserRole) return
    const uid = account.uid || account.id
    setUserBusyUid(uid)
    try {
      await onUpdateUserRole(uid, nextRole)
      await onReload?.()
    } catch (err) {
      pushToast?.(
        err instanceof Error ? err.message : 'Unable to update role.',
      )
    } finally {
      setUserBusyUid('')
    }
  }

  const handleDeleteAccount = async (account) => {
    if (!onDeleteUser) return
    const uid = account.uid || account.id
    setUserBusyUid(uid)
    try {
      await onDeleteUser(uid)
      await onReload?.()
    } catch (err) {
      pushToast?.(
        err instanceof Error ? err.message : 'Unable to remove account.',
      )
    } finally {
      setUserBusyUid('')
    }
  }

  const handleCleanupTestAccounts = async () => {
    if (!onDeleteUser || syntheticAccounts.length === 0) return
    setUserBusyUid('cleanup')
    try {
      for (const acc of syntheticAccounts) {
        await onDeleteUser(acc.uid || acc.id)
      }
      await onReload?.()
    } catch (err) {
      pushToast?.(
        err instanceof Error ? err.message : 'Unable to clean test accounts.',
      )
    } finally {
      setUserBusyUid('')
    }
  }

  const handleClearCache = async () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('harban-store-settings')
      }
      await onReload?.()
      pushToast?.('Store cache refreshed from live database')
    } catch {
      pushToast?.('Unable to refresh cache right now')
    }
  }

  const handleExportBackup = () => {
    const dateTag = new Date().toISOString().slice(0, 10)
    const backup = {
      exportedAt: new Date().toISOString(),
      store: storeName,
      settings: buildPayload(),
      categories: overview.categories || [],
      products: overview.products || [],
      discounts: overview.discounts || [],
      orders: overview.orders || [],
      customers: allAccounts.filter((c) => !isSyntheticTestEmail(c.email)),
    }
    triggerDownload(
      `harban-store-backup-${dateTag}.json`,
      JSON.stringify(backup, null, 2),
      'application/json;charset=utf-8;',
    )
    pushToast?.('Full store JSON backup downloaded')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[22px] text-[#111827] tracking-tight leading-tight">
            Settings
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            Manage your store, payment, shipping, team roles, notifications and appearance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSyncSupabase}
            disabled={syncingSupabase}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#111827] px-4 py-2 rounded-xl shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncingSupabase ? 'animate-spin' : ''} />
            {syncingSupabase ? 'Syncing...' : 'Sync Supabase'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-[#16181A] hover:bg-[#272A2E] text-white px-4 py-2 rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-5 items-start">
        <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-2 space-y-0.5 shadow-2xs">
          {SETTING_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition cursor-pointer ${
                  isActive
                    ? 'bg-[#16181A] text-white'
                    : 'text-[#4B5563] hover:bg-[#F7F8FA] hover:text-[#111315]'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon size={16} className={isActive ? 'text-white' : 'text-[#6B7078]'} />
                  <span className="truncate">{tab.label}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="space-y-4">
          {activeTab === 'general' && (
            <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-6 space-y-5 shadow-2xs">
              <div className="border-b border-[#E2E4E8] pb-3">
                <h2 className="font-display font-bold text-[16px] text-[#111315]">
                  General Settings
                </h2>
                <p className="text-[12.5px] text-[#6B7078]">
                  Configure your basic store details and localization.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Store Name *
                  </label>
                  <input
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#16181A]"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Store Email *
                  </label>
                  <input
                    value={storeEmail}
                    onChange={(e) => setStoreEmail(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#16181A]"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Store URL
                  </label>
                  <input
                    value={storeUrl}
                    onChange={(e) => setStoreUrl(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#16181A]"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Support Phone
                  </label>
                  <input
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#16181A]"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Default Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="INR">INR — Indian Rupee (₹)</option>
                    <option value="USD">USD — US Dollar ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3 py-2.5 text-sm outline-none"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi (हिंदी)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#E2E4E8]">
                <div>
                  <p className="font-semibold text-[13.5px] text-[#111315]">Store Status</p>
                  <p className="text-[12px] text-[#6B7078]">
                    {storeStatus
                      ? 'Your store is currently live and accepting orders.'
                      : 'Store is currently paused (maintenance flag saved).'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={storeStatus}
                    onChange={(e) => setStoreStatus(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#16181A]" />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'store_info' && (
            <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-6 space-y-4 shadow-2xs">
              <div className="border-b border-[#E2E4E8] pb-3">
                <h2 className="font-display font-bold text-[16px] text-[#111315]">
                  Store Information &amp; Address
                </h2>
                <p className="text-[12.5px] text-[#6B7078]">
                  Business registration and physical operating address for invoices and labels.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Address Line 1 *
                  </label>
                  <input
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#16181A]"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    City *
                  </label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#16181A]"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    State *
                  </label>
                  <input
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#16181A]"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    PIN Code *
                  </label>
                  <input
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#16181A]"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Country *
                  </label>
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#16181A]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  GSTIN (Optional)
                </label>
                <input
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="27AABCH0000A1Z5"
                  className="w-full max-w-sm bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm outline-none uppercase font-mono focus:border-[#16181A]"
                />
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-6 space-y-5 shadow-2xs">
              <div className="border-b border-[#E2E4E8] pb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display font-bold text-[16px] text-[#111827]">
                    Payment Gateways
                  </h2>
                  <p className="text-[12.5px] text-[#6B7280]">
                    Control checkout payment options (Razorpay UPI/Cards/NetBanking and Cash on Delivery).
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full ${
                    isConfigured
                      ? 'bg-[#DCFCE7] text-[#15803D]'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  <CheckCircle2 size={13} />
                  {isConfigured ? 'Keys Connected' : 'Sandbox Test Mode'}
                </span>
              </div>

              <div className="bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-[15px] text-[#111315]">
                      Razorpay
                    </span>
                    <span className="text-[11px] bg-[#16181A] text-white px-2 py-0.5 rounded font-mono">
                      {isLiveMode ? 'Live Mode' : 'Test Mode'}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={razorpayEnabled}
                      onChange={(e) => setRazorpayEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#16181A]" />
                  </label>
                </div>

                <div className="rounded-lg bg-white border border-[#E2E4E8] p-3.5 text-[12.5px] text-[#374151] space-y-1.5">
                  <p className="font-semibold text-[#111315]">
                    {isConfigured
                      ? 'Razorpay live credentials are connected and active on your domain.'
                      : 'Set server-side Razorpay keys in Edge Function / server environment.'}
                  </p>
                  <p className="font-mono text-[11.5px] text-[#6B7078]">
                    RAZORPAY_KEY_ID · RAZORPAY_KEY_SECRET · RAZORPAY_MODE={isLiveMode ? 'live' : 'test'}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <p className="font-display font-bold text-[13.5px] text-[#111315]">
                  Checkout Payment Methods
                </p>
                {[
                  {
                    name: 'UPI (Google Pay, PhonePe, Paytm)',
                    active: upiEnabled,
                    setActive: setUpiEnabled,
                  },
                  {
                    name: 'Credit & Debit Cards',
                    active: cardsEnabled,
                    setActive: setCardsEnabled,
                  },
                  {
                    name: 'Net Banking',
                    active: netbankingEnabled,
                    setActive: setNetbankingEnabled,
                  },
                  {
                    name: 'Cash on Delivery (COD)',
                    active: codEnabled,
                    setActive: setCodEnabled,
                  },
                ].map((pm) => (
                  <div
                    key={pm.name}
                    className="flex items-center justify-between bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-4 py-3"
                  >
                    <span className="text-[13px] font-medium text-[#111315]">{pm.name}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pm.active}
                        onChange={(e) => pm.setActive(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#16181A]" />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-6 space-y-4 shadow-2xs">
              <div className="border-b border-[#E2E4E8] pb-3">
                <h2 className="font-display font-bold text-[16px] text-[#111315]">
                  Shipping &amp; Delivery Rules
                </h2>
                <p className="text-[12.5px] text-[#6B7078]">
                  Configure live cart/checkout free shipping threshold and delivery courier integrations.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Free Shipping Minimum Order Value (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={freeShippingMin}
                    onChange={(e) => setFreeShippingMin(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm outline-none tabular-nums focus:border-[#16181A]"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Standard Shipping Charge (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={standardCharge}
                    onChange={(e) => setStandardCharge(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm outline-none tabular-nums focus:border-[#16181A]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-4 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-[#111315]">
                    Auto-Dispatch Confirmed Orders
                  </p>
                  <p className="text-[11.5px] text-[#6B7078]">
                    Automatically queue confirmed orders for your active courier partner.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={courierAutoDispatch}
                    onChange={(e) => setCourierAutoDispatch(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#16181A]" />
                </label>
              </div>

              <div className="space-y-2.5 pt-2">
                <p className="font-display font-bold text-[13.5px] text-[#111315]">
                  Courier Partner Integrations
                </p>
                <p className="text-[12px] text-[#6B7078]">
                  Enter partner API token if available and click Connect to persist in database.
                </p>
                {[
                  { name: 'Delhivery', desc: 'Pan-India surface & express shipping API' },
                  { name: 'Blue Dart', desc: 'Air express & door-to-door delivery' },
                  { name: 'DTDC', desc: 'Domestic & international courier services' },
                  { name: 'Ekart Logistics', desc: 'E-commerce fulfillment & logistics' },
                ].map((c) => {
                  const cfg = couriers[c.name] || { connected: false, apiKey: '' }
                  return (
                    <div
                      key={c.name}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-4 py-3.5"
                    >
                      <div className="space-y-1 flex-1">
                        <p className="text-[13.5px] font-semibold text-[#111315]">
                          {c.name}
                        </p>
                        <p className="text-[12px] text-[#6B7078]">
                          {cfg.connected
                            ? 'Connected — Active & persisted'
                            : `${c.desc} — Disconnected`}
                        </p>
                        <input
                          value={cfg.apiKey}
                          onChange={(e) =>
                            setCouriers((prev) => ({
                              ...prev,
                              [c.name]: { ...prev[c.name], apiKey: e.target.value },
                            }))
                          }
                          placeholder={`${c.name} API key / client token (optional)`}
                          className="w-full max-w-sm bg-white border border-[#E2E4E8] rounded-lg px-3 py-1.5 text-[12px] outline-none focus:border-[#16181A]"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleToggleCourier(c.name)}
                        className={`text-[12px] font-semibold px-4 py-2 rounded-xl cursor-pointer transition shrink-0 ${
                          cfg.connected
                            ? 'bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]'
                            : 'bg-[#16181A] text-white hover:bg-[#272A2E]'
                        }`}
                      >
                        {cfg.connected ? 'Connected ✓' : 'Connect'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-6 space-y-4 shadow-2xs">
              <div className="border-b border-[#E2E4E8] pb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display font-bold text-[16px] text-[#111315]">
                    Users &amp; Admin Roles
                  </h2>
                  <p className="text-[12.5px] text-[#6B7078]">
                    Add team members, promote customers to admins, or revoke permissions.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold bg-[#E5FC6B] text-[#141700] px-3 py-1 rounded-xl">
                    {visibleAccounts.filter((c) => c.role === 'admin').length} Admins
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddUser((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold bg-[#16181A] hover:bg-[#272A2E] text-white px-3.5 py-1.5 rounded-xl cursor-pointer"
                  >
                    <Plus size={13} /> Add User
                  </button>
                </div>
              </div>

              {syntheticAccounts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] text-amber-800">
                    {syntheticAccounts.length} automated verification account(s) detected in database.
                  </p>
                  <button
                    type="button"
                    disabled={userBusyUid === 'cleanup'}
                    onClick={handleCleanupTestAccounts}
                    className="text-[12px] font-semibold text-amber-900 underline cursor-pointer disabled:opacity-50"
                  >
                    {userBusyUid === 'cleanup' ? 'Cleaning...' : 'Remove test accounts'}
                  </button>
                </div>
              )}

              {showAddUser && (
                <form
                  onSubmit={handleAddUser}
                  className="bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl p-4 space-y-3"
                >
                  <p className="font-semibold text-[13px] text-[#111315]">
                    Add Team Member / Customer
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <input
                      required
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Full Name *"
                      className="bg-white border border-[#E2E4E8] rounded-lg px-3 py-2 text-[12.5px] outline-none"
                    />
                    <input
                      required
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="Email Address *"
                      className="bg-white border border-[#E2E4E8] rounded-lg px-3 py-2 text-[12.5px] outline-none"
                    />
                    <input
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                      placeholder="Phone (optional)"
                      className="bg-white border border-[#E2E4E8] rounded-lg px-3 py-2 text-[12.5px] outline-none"
                    />
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      className="bg-white border border-[#E2E4E8] rounded-lg px-3 py-2 text-[12.5px] outline-none"
                    >
                      <option value="admin">Administrator</option>
                      <option value="customer">Customer</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={userBusyUid === 'new'}
                      className="bg-[#16181A] hover:bg-[#272A2E] text-white text-[12px] font-semibold px-4 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      {userBusyUid === 'new' ? 'Adding...' : 'Create User'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddUser(false)}
                      className="text-[12px] text-[#6B7078] px-3 py-1.5 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search admins or customers by name or email..."
                  className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl pl-9 pr-3.5 py-2 text-[12.5px] outline-none focus:border-[#16181A]"
                />
              </div>

              <div className="divide-y divide-[#E2E4E8]">
                {visibleAccounts.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-[#6B7078]">
                    No matching users found.
                  </p>
                ) : (
                  visibleAccounts.map((acc) => {
                    const uid = acc.uid || acc.id
                    const isOwner = isOwnerEmail(acc.email)
                    const isAdmin = acc.role === 'admin'
                    const busy = userBusyUid === uid
                    return (
                      <div
                        key={uid}
                        className="py-3 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[13px] text-[#111315] truncate">
                              {acc.name}
                            </p>
                            {isOwner && (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold bg-[#FEF3C7] text-[#92400E] px-2 py-0.5 rounded-full">
                                <ShieldCheck size={11} /> Owner
                              </span>
                            )}
                          </div>
                          <p className="text-[11.5px] text-[#6B7078] truncate">
                            {acc.email} {acc.phone ? `· ${acc.phone}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded ${
                              isAdmin
                                ? 'bg-[#16181A] text-white'
                                : 'bg-[#F1F2F4] text-[#374151]'
                            }`}
                          >
                            {isAdmin ? 'Administrator' : 'Customer'}
                          </span>
                          {!isOwner && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  handleRoleChange(
                                    acc,
                                    isAdmin ? 'customer' : 'admin',
                                  )
                                }
                                className="inline-flex items-center gap-1 text-[11.5px] font-semibold bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#111827] px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-50"
                              >
                                <UserCheck size={12} />
                                {isAdmin ? 'Revoke Admin' : 'Make Admin'}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleDeleteAccount(acc)}
                                className="p-1.5 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2] cursor-pointer disabled:opacity-50"
                                title="Remove user"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-6 space-y-4 shadow-2xs">
              <div className="border-b border-[#E2E4E8] pb-3">
                <h2 className="font-display font-bold text-[16px] text-[#111315]">
                  Notifications &amp; Alerts
                </h2>
                <p className="text-[12.5px] text-[#6B7078]">
                  Configure automated customer notifications and admin order alerts.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  {
                    label: 'Order Confirmation Email to Customer',
                    val: notifEmail,
                    set: setNotifEmail,
                  },
                  {
                    label: 'SMS Dispatch & Tracking Alerts',
                    val: notifSms,
                    set: setNotifSms,
                  },
                  {
                    label: 'WhatsApp Order Updates',
                    val: notifWhatsapp,
                    set: setNotifWhatsapp,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-4 py-3"
                  >
                    <span className="text-[13px] font-medium text-[#111315]">
                      {item.label}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.val}
                        onChange={(e) => item.set(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#16181A]" />
                    </label>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  Admin Alert Recipient Email
                </label>
                <input
                  type="email"
                  value={adminAlertEmail}
                  onChange={(e) => setAdminAlertEmail(e.target.value)}
                  className="w-full max-w-sm bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#16181A]"
                />
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-6 space-y-4 shadow-2xs">
              <div className="border-b border-[#E2E4E8] pb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-display font-bold text-[16px] text-[#111315]">
                    Storefront Appearance
                  </h2>
                  <p className="text-[12.5px] text-[#6B7078]">
                    Customize brand primary and accent theme colors persisted across sessions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPrimaryColor('#0C1B2E')
                    setAccentColor('#1D5CAD')
                  }}
                  className="text-[12px] font-semibold text-[#111315] hover:underline cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Primary Brand Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-11 h-10 rounded-lg border border-[#E2E4E8] cursor-pointer bg-white p-0.5"
                    />
                    <input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3 py-2 text-sm font-mono uppercase outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-11 h-10 rounded-lg border border-[#E2E4E8] cursor-pointer bg-white p-0.5"
                    />
                    <input
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="flex-1 bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3 py-2 text-sm font-mono uppercase outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-[#E2E4E8] p-4 flex items-center justify-between gap-4 bg-[#F7F8FA]">
                <div className="flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-xl border border-black/10"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <span
                    className="w-9 h-9 rounded-xl border border-black/10"
                    style={{ backgroundColor: accentColor }}
                  />
                  <div>
                    <p className="text-[13px] font-semibold text-[#111315]">
                      Theme Preview ({storeName})
                    </p>
                    <p className="text-[11.5px] text-[#6B7078]">
                      Saved colors apply as CSS variables (--harban-primary, --harban-accent).
                    </p>
                  </div>
                </div>
                <span
                  className="text-white text-[12px] font-semibold px-3.5 py-1.5 rounded-lg"
                  style={{ backgroundColor: accentColor }}
                >
                  Shop Now
                </span>
              </div>
            </div>
          )}

          {activeTab === 'seo' && (
            <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-6 space-y-4 shadow-2xs">
              <div className="border-b border-[#E2E4E8] pb-3">
                <h2 className="font-display font-bold text-[16px] text-[#111315]">
                  SEO &amp; Analytics Metadata
                </h2>
                <p className="text-[12.5px] text-[#6B7078]">
                  Optimize document title, meta description, and analytics measurement IDs.
                </p>
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  Default Meta Title
                </label>
                <input
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#16181A]"
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  Default Meta Description
                </label>
                <textarea
                  rows={2}
                  value={metaDesc}
                  onChange={(e) => setMetaDesc(e.target.value)}
                  className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2 text-sm outline-none resize-none focus:border-[#16181A]"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Google Analytics Measurement ID
                  </label>
                  <input
                    value={gaMeasurementId}
                    onChange={(e) => setGaMeasurementId(e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:border-[#16181A]"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Meta Pixel ID
                  </label>
                  <input
                    value={metaPixelId}
                    onChange={(e) => setMetaPixelId(e.target.value)}
                    placeholder="123456789012345"
                    className="w-full bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:border-[#16181A]"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-6 space-y-4 shadow-2xs">
              <div className="border-b border-[#E2E4E8] pb-3">
                <h2 className="font-display font-bold text-[16px] text-[#111315]">
                  Integrations &amp; APIs
                </h2>
                <p className="text-[12.5px] text-[#6B7078]">
                  Supabase database sync and Razorpay live payment gateway status.
                </p>
              </div>
              <div className="bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-semibold text-[13.5px] text-[#111315]">
                    Supabase Cloud Sync
                  </p>
                  <p className="text-[12px] text-[#6B7078]">
                    Project:{' '}
                    <code className="text-[#111315] font-semibold font-mono">
                      {sb.projectId || 'yynubnoijafkzcengteb'}
                    </code>{' '}
                    · Schema: {sb.schemaReady !== false ? 'Ready' : 'Pending'}
                  </p>
                  {sb.counts && (
                    <p className="text-[11.5px] text-[#6B7078]">
                      Products: {sb.counts.products ?? 0} · Categories:{' '}
                      {sb.counts.categories ?? 0} · Orders: {sb.counts.orders ?? 0} · Customers:{' '}
                      {sb.counts.customers ?? 0}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onSyncSupabase}
                  disabled={syncingSupabase}
                  className="bg-[#16181A] hover:bg-[#272A2E] text-white text-[12px] font-semibold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {syncingSupabase ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>

              <div className="bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-semibold text-[13.5px] text-[#111315]">
                    Razorpay Live Checkout
                  </p>
                  <p className="text-[12px] text-[#6B7078]">
                    Status: {isConfigured ? 'Keys Connected' : 'Not Configured'} · Mode:{' '}
                    {isLiveMode ? 'Live' : 'Test'}
                  </p>
                </div>
                <span
                  className={`text-[11.5px] font-semibold px-3 py-1 rounded-full ${
                    isConfigured
                      ? 'bg-[#DCFCE7] text-[#15803D]'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {isConfigured ? 'Active' : 'Setup Needed'}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="bg-white rounded-[18px] border border-[#E2E4E8] p-6 space-y-4 shadow-2xs">
              <div className="border-b border-[#E2E4E8] pb-3">
                <h2 className="font-display font-bold text-[16px] text-[#111315]">
                  Advanced Settings &amp; Security
                </h2>
                <p className="text-[12.5px] text-[#6B7078]">
                  Inventory threshold alerts, cache maintenance, and JSON store backup.
                </p>
              </div>

              <div className="bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[13px] text-[#111315]">
                    Low Stock Alert Threshold
                  </p>
                  <p className="text-[11.5px] text-[#6B7078]">
                    Products at or below this quantity trigger admin low-stock warnings.
                  </p>
                </div>
                <input
                  type="number"
                  min="0"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  className="w-24 bg-white border border-[#E2E4E8] rounded-xl px-3 py-2 text-sm font-semibold text-center tabular-nums outline-none focus:border-[#16181A]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl p-4">
                <div>
                  <p className="font-semibold text-[13px] text-[#111315]">
                    Refresh Cache From Live DB
                  </p>
                  <p className="text-[11.5px] text-[#6B7078]">
                    Clears local cached storefront settings and reloads fresh database state.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearCache}
                  className="bg-white border border-[#E2E4E8] hover:bg-[#F1F2F4] text-[#111315] text-[12px] font-semibold px-3.5 py-2 rounded-xl cursor-pointer"
                >
                  Clear Cache
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F7F8FA] border border-[#E2E4E8] rounded-xl p-4">
                <div>
                  <p className="font-semibold text-[13px] text-[#111315]">
                    Export Store Backup (JSON)
                  </p>
                  <p className="text-[11.5px] text-[#6B7078]">
                    Download a snapshot of products, categories, orders, customers, and settings.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="inline-flex items-center gap-1.5 bg-[#16181A] hover:bg-[#272A2E] text-white text-[12px] font-semibold px-4 py-2 rounded-xl cursor-pointer"
                >
                  <Download size={13} /> Export JSON Backup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
