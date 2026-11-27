import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Download,
  Package,
  Pencil,
  Plus,
  Search,
  Upload,
  X,
  XCircle,
} from 'lucide-react'
import Img from '../Img'
import InlineStockControl from './InlineStockControl'
import { ORDER_STAGES, formatINR } from '../../store/shop'
import { matchesSearch } from '../../lib/search'

function EmptyState({ title, body, actionLabel, onAction }) {
  return (
    <div className="bg-white rounded-2xl border border-[#EAECF0] p-8 sm:p-10 text-center shadow-2xs">
      <h3 className="font-display font-bold text-[15px] text-[#111827]">{title}</h3>
      <p className="text-[13px] text-[#6B7280] mt-1 max-w-md mx-auto">{body}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] text-white text-[12.5px] font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function AdminOrdersPreview({ overview, onUpdateOrder, onReload, pushToast }) {
  const [search, setSearch] = useState('')
  const orders = (overview.orders || []).filter((o) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      o.id.toLowerCase().includes(q) ||
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.customerEmail || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-[#EAECF0] p-3.5 flex flex-wrap items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search orders by Order ID, customer name or email..."
          className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-[13px] w-full sm:max-w-sm outline-none"
        />
        <span className="text-[12px] font-semibold text-[#6B7280] tabular-nums">
          {orders.length} order{orders.length === 1 ? '' : 's'}
        </span>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders match"
          body="Real customer orders placed on HARBAN checkout (COD or Razorpay) appear here."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#EAECF0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-[#F9FAFB] text-[#6B7280] font-medium border-b border-[#EAECF0]">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Items</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 px-3">Stage</th>
                  <th className="py-3 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAECF0]">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#F9FAFB]">
                    <td className="py-3 px-4 font-mono font-bold text-[#5B21B6]">
                      #{order.id}
                      <span className="block text-[11px] font-normal text-[#6B7280]">
                        {new Date(order.placedAt).toLocaleDateString('en-IN')}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-[#111827]">{order.customerName}</p>
                      <p className="text-[11px] text-[#6B7280]">
                        {order.customerEmail || order.phone || 'Guest'}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-[#4B5563] max-w-[220px] truncate">
                      {order.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}
                    </td>
                    <td className="py-3 px-3 text-[#374151]">
                      <span className="font-semibold">{order.paymentMethod}</span>
                      <span className="block text-[11px] text-[#6B7280] uppercase">
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {order.cancelled ? (
                        <span className="text-[#E11D48] font-bold">Cancelled</span>
                      ) : (
                        <select
                          value={order.status}
                          onChange={async (e) => {
                            try {
                              await onUpdateOrder(order.id, {
                                status: Number(e.target.value),
                                cancelled: false,
                              })
                              await onReload()
                            } catch (err) {
                              pushToast(
                                err instanceof Error ? err.message : 'Update failed',
                              )
                            }
                          }}
                          className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-2.5 py-1 text-[12px] font-semibold outline-none"
                        >
                          {ORDER_STAGES.map((lbl, idx) => (
                            <option key={lbl} value={idx}>
                              {lbl}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold tabular-nums">
                      {formatINR(order.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminCustomersPreview({ overview }) {
  const customers = overview.customers || []
  const orders = overview.orders || []

  return customers.length === 0 ? (
    <EmptyState
      title="No registered customers yet"
      body="Customer accounts appear here as shoppers sign up via Email or Google Sign-In."
    />
  ) : (
    <div className="bg-white rounded-2xl border border-[#EAECF0] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#EAECF0] flex items-center justify-between">
        <h2 className="font-display font-bold text-[14.5px] text-[#111827] tabular-nums">
          Registered Customer Directory ({customers.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12.5px]">
          <thead className="bg-[#F9FAFB] text-[#6B7280] font-medium border-b border-[#EAECF0]">
            <tr>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-3">Phone</th>
              <th className="py-3 px-3">Role</th>
              <th className="py-3 px-3 text-right">Orders</th>
              <th className="py-3 px-4 text-right">Total Spend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAECF0]">
            {customers.map((c) => {
              const custOrders = orders.filter(
                (o) =>
                  !o.cancelled &&
                  o.customerEmail &&
                  o.customerEmail.toLowerCase() === c.email.toLowerCase(),
              )
              const spend = custOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)
              return (
                <tr key={c.id} className="hover:bg-[#F9FAFB]">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-[#111827]">{c.name}</p>
                    <p className="text-[11.5px] text-[#6B7280]">{c.email}</p>
                  </td>
                  <td className="py-3 px-3 font-mono text-[#4B5563]">{c.phone || '—'}</td>
                  <td className="py-3 px-3 uppercase text-[11px] font-bold text-[#5B21B6]">
                    {c.role}
                  </td>
                  <td className="py-3 px-3 text-right font-bold tabular-nums">
                    {custOrders.length}
                  </td>
                  <td className="py-3 px-4 text-right font-bold tabular-nums">
                    {formatINR(spend)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AdminInventorySection({ overview, onUpdateStock, onReload, pushToast }) {
  const products = overview.products || []
  const categories = overview.categories || []
  const logs = overview.inventoryLogs || []
  const threshold = Number(overview.settings?.lowStockThreshold ?? 5)

  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('all')

  const [adjustTarget, setAdjustTarget] = useState(null)
  const [adjustQty, setAdjustQty] = useState(0)
  const [adjustSaving, setAdjustSaving] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importCsvText, setImportCsvText] = useState('')
  const [importing, setImporting] = useState(false)

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.label])),
    [categories],
  )

  const brandOptions = useMemo(() => {
    const s = new Set()
    for (const p of products) s.add((p.brand || 'HARBAN').trim())
    return Array.from(s).sort()
  }, [products])

  const stats = useMemo(() => {
    const totalUnits = products.reduce((s, p) => s + (Number(p.stock) || 0), 0)
    const out = products.filter((p) => (p.stock ?? 0) === 0).length
    const low = products.filter(
      (p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= threshold,
    ).length
    const healthy = products.length - out - low
    return { totalSkus: products.length, totalUnits, out, low, healthy }
  }, [products, threshold])

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const qty = p.stock ?? 0
      if (tab === 'low' && (qty === 0 || qty > threshold)) return false
      if (tab === 'out' && qty !== 0) return false
      if (tab === 'healthy' && qty <= threshold) return false
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false
      if (brandFilter !== 'all' && (p.brand || 'HARBAN') !== brandFilter) return false
      return matchesSearch(
        search,
        p.name,
        p.sku,
        p.id,
        p.category,
        categoryMap.get(p.category),
        p.brand,
      )
    })
  }, [products, tab, categoryFilter, brandFilter, search, threshold, categoryMap])

  const handleExportCsv = () => {
    const header = ['ID', 'SKU', 'Product', 'Category', 'Brand', 'Stock', 'PriceINR', 'Status']
    const rows = filteredProducts.map((p) => {
      const qty = p.stock ?? 0
      const status = qty === 0 ? 'Out of Stock' : qty <= threshold ? 'Low Stock' : 'In Stock'
      return [
        p.id,
        p.sku || '',
        p.name,
        categoryMap.get(p.category) || p.category,
        p.brand || 'HARBAN',
        qty,
        p.price,
        status,
      ]
    })
    const csv = [header, ...rows]
      .map((line) =>
        line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `HARBAN-Inventory-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    pushToast(`Exported ${filteredProducts.length} inventory item(s)`)
  }

  const handleAdjustSave = async (e) => {
    e.preventDefault()
    if (!adjustTarget || adjustSaving) return
    setAdjustSaving(true)
    try {
      await onUpdateStock(adjustTarget.id, Math.max(0, Math.floor(Number(adjustQty) || 0)))
      setAdjustTarget(null)
      await onReload()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Stock update failed')
    } finally {
      setAdjustSaving(false)
    }
  }

  const handleImportSubmit = async (e) => {
    e.preventDefault()
    if (!importCsvText.trim() || importing) return
    setImporting(true)
    let updated = 0
    try {
      const lines = importCsvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      for (let i = 0; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        if (i === 0 && /id|sku/i.test(cols[0] || '')) continue
        const ref = (cols[0] || '').toLowerCase()
        const qty = Number(cols[1])
        if (!ref || Number.isNaN(qty)) continue
        const match = products.find(
          (p) =>
            p.id.toLowerCase() === ref ||
            (p.sku && p.sku.toLowerCase() === ref),
        )
        if (match) {
          await onUpdateStock(match.id, Math.max(0, Math.floor(qty)))
          updated++
        }
      }
      pushToast(`Updated stock for ${updated} product${updated === 1 ? '' : 's'}`)
      setImportCsvText('')
      setImportOpen(false)
      await onReload()
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[22px] text-[#111827] tracking-tight leading-tight">
            Inventory
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            Track stock levels, manage low-stock alerts and adjust product quantities.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#111827] px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer"
          >
            <Upload size={13} className="text-[#4B5563]" /> Import
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#111827] px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer"
          >
            <Download size={13} className="text-[#4B5563]" /> Export
          </button>
          {products[0] && (
            <button
              type="button"
              onClick={() => {
                setAdjustTarget(products[0])
                setAdjustQty(products[0].stock ?? 0)
              }}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] hover:opacity-95 text-white px-4 py-2 rounded-xl shadow-xs cursor-pointer"
            >
              <Plus size={14} /> Update Stock
            </button>
          )}
        </div>
      </div>

      {/* 5 Pastel KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl border border-[#EAECF0] p-4 shadow-2xs flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#F3E8FF] text-[#6D28D9] grid place-items-center shrink-0">
            <Boxes size={18} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">Total Stock Units</p>
            <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
              {stats.totalUnits}
            </p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">Live units</p>
          </div>
        </div>
        <div className="bg-[#F0FDF4] rounded-2xl border border-[#DCFCE7] p-4 shadow-2xs flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#DCFCE7] text-[#16A34A] grid place-items-center shrink-0">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">In Stock</p>
            <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
              {stats.healthy}
            </p>
            <p className="text-[11px] text-[#16A34A] mt-0.5">Healthy SKUs</p>
          </div>
        </div>
        <div className="bg-[#FFFBEB] rounded-2xl border border-[#FEF3C7] p-4 shadow-2xs flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#FEF3C7] text-[#D97706] grid place-items-center shrink-0">
            <AlertTriangle size={18} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">
              Low Stock (≤{threshold})
            </p>
            <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
              {stats.low}
            </p>
            <p className="text-[11px] text-[#D97706] mt-0.5">Restock soon</p>
          </div>
        </div>
        <div className="bg-[#FFF5F6] rounded-2xl border border-[#FFE4E6] p-4 shadow-2xs flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#FFE4E6] text-[#E11D48] grid place-items-center shrink-0">
            <XCircle size={18} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">Out of Stock</p>
            <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
              {stats.out}
            </p>
            <p className="text-[11px] text-[#E11D48] mt-0.5">Needs attention</p>
          </div>
        </div>
        <div className="bg-[#EFF6FF] rounded-2xl border border-[#DBEAFE] p-4 shadow-2xs flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#DBEAFE] text-[#2563EB] grid place-items-center shrink-0">
            <Package size={18} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">Total Products</p>
            <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
              {stats.totalSkus}
            </p>
            <p className="text-[11px] text-[#2563EB] mt-0.5">Active &amp; Drafts</p>
          </div>
        </div>
      </div>

      {/* Live Stock Table Card */}
      <div className="bg-white rounded-2xl border border-[#EAECF0] overflow-hidden shadow-2xs">
        <div className="px-4 pt-1 border-b border-[#EAECF0] flex items-center gap-5 overflow-x-auto text-[12.5px]">
          {[
            { id: 'all', label: `All Inventory (${stats.totalSkus})` },
            { id: 'healthy', label: `In Stock (${stats.healthy})` },
            { id: 'low', label: `Low Stock (${stats.low})` },
            { id: 'out', label: `Out of Stock (${stats.out})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`py-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
                tab === t.id
                  ? 'border-[#5B21B6] text-[#5B21B6] font-semibold'
                  : 'border-transparent text-[#6B7280] hover:text-[#111827] font-medium'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-3.5 border-b border-[#EAECF0] flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 flex-1 min-w-[210px]">
            <Search size={14} className="text-[#9CA3AF] shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU or product name..."
              className="bg-transparent outline-none text-[12.5px] text-[#111827] placeholder:text-[#9CA3AF] w-full"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-[#6B7280] hover:text-[#111827] cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12px] font-medium text-[#374151] outline-none cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12px] font-medium text-[#374151] outline-none cursor-pointer"
          >
            <option value="all">All Brands</option>
            {brandOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead className="bg-[#F9FAFB] text-[#6B7280] font-medium border-b border-[#EAECF0]">
              <tr>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-3">SKU</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Available Stock</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Last Updated</th>
                <th className="py-3 px-4 text-right">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF0]">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-[#F9FAFB]">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <Img
                        src={p.image}
                        alt={p.name}
                        className="w-9 h-9 rounded-lg object-cover border border-[#EAECF0] bg-[#F9FAFB] shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="font-semibold text-[#111827] block truncate max-w-[220px]">
                          {p.name}
                        </span>
                        <span className="text-[11px] text-[#6B7280]">
                          {p.variants?.length
                            ? `${p.variants.length} Variants`
                            : p.brand || 'HARBAN'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-[12px] text-[#4B5563]">
                    {p.sku || p.id}
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#F3E8FF] text-[#6D28D9]">
                      {categoryMap.get(p.category) || p.category}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <InlineStockControl
                      stock={p.stock ?? 0}
                      minusFirst
                      onSave={async (next) => {
                        try {
                          await onUpdateStock(p.id, next)
                          await onReload()
                        } catch (err) {
                          pushToast(
                            err instanceof Error ? err.message : 'Stock update failed',
                          )
                        }
                      }}
                    />
                  </td>
                  <td className="py-3 px-3">
                    {(p.stock ?? 0) === 0 ? (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#FEE2E2] text-[#B91C1C]">
                        Out of Stock
                      </span>
                    ) : (p.stock ?? 0) <= threshold ? (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#FEF3C7] text-[#B45309]">
                        Low Stock
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D]">
                        In Stock
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-[11px] text-[#6B7280] whitespace-nowrap">
                    {p.updatedAt
                      ? new Date(p.updatedAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Synced'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustTarget(p)
                        setAdjustQty(p.stock ?? 0)
                      }}
                      className="w-7 h-7 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] inline-grid place-items-center text-[#4B5563] cursor-pointer"
                      title="Set exact stock quantity"
                    >
                      <Pencil size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit History Card */}
      <div className="bg-white rounded-2xl border border-[#EAECF0] overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 border-b border-[#EAECF0]">
          <h3 className="font-display font-bold text-[14.5px] text-[#111827]">
            Inventory Audit History ({logs.length})
          </h3>
        </div>
        {logs.length === 0 ? (
          <div className="p-6 text-[12.5px] text-[#6B7280] text-center">
            No stock adjustments recorded yet. Adjusting stock or receiving an order automatically logs an audit entry here.
          </div>
        ) : (
          <div className="divide-y divide-[#EAECF0] max-h-[320px] overflow-y-auto">
            {logs.map((l) => (
              <div
                key={l.id}
                className="px-5 py-2.5 flex items-center justify-between gap-3 text-[12px]"
              >
                <div>
                  <span className="font-semibold text-[#111827]">{l.productName}</span>
                  <span className="text-[#6B7280] ml-2">
                    {l.reason} {l.referenceId ? `(${l.referenceId})` : ''}
                  </span>
                </div>
                <div className="font-mono tabular-nums text-right">
                  <span
                    className={
                      l.changeQty >= 0
                        ? 'text-[#15803D] font-bold'
                        : 'text-[#E11D48] font-bold'
                    }
                  >
                    {l.changeQty >= 0 ? `+${l.changeQty}` : l.changeQty}
                  </span>{' '}
                  <span className="text-[#6B7280]">
                    ({l.previousStock} → {l.newStock})
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Update Stock Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-[85] grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setAdjustTarget(null)}
          />
          <form
            onSubmit={handleAdjustSave}
            className="relative bg-white rounded-2xl border border-[#EAECF0] max-w-sm w-full p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-[16px] text-[#111827]">
                Update Stock Quantity
              </h3>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="p-1 text-[#6B7280] hover:text-[#111827] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                Product
              </label>
              <select
                value={adjustTarget.id}
                onChange={(e) => {
                  const found = products.find((p) => p.id === e.target.value)
                  if (found) {
                    setAdjustTarget(found)
                    setAdjustQty(found.stock ?? 0)
                  }
                }}
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku || p.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                New Stock Quantity
              </label>
              <input
                required
                type="number"
                min="0"
                value={adjustQty}
                onChange={(e) => setAdjustQty(Number(e.target.value))}
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm tabular-nums outline-none focus:border-[#5B21B6]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="px-4 py-2 text-[12.5px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adjustSaving}
                className="px-4 py-2 text-[12.5px] font-semibold bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                {adjustSaving ? 'Saving...' : 'Update Stock'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk CSV Stock Import */}
      {importOpen && (
        <div className="fixed inset-0 z-[85] grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setImportOpen(false)}
          />
          <form
            onSubmit={handleImportSubmit}
            className="relative bg-white rounded-2xl border border-[#EAECF0] max-w-lg w-full p-5 space-y-3.5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-[16px] text-[#111827]">
                Bulk Import Stock (CSV)
              </h3>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="p-1 text-[#6B7280] hover:text-[#111827] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[12px] text-[#6B7280]">
              Paste CSV lines formatted as: <code>product_id_or_sku, stock_qty</code>
            </p>
            <textarea
              rows={5}
              required
              value={importCsvText}
              onChange={(e) => setImportCsvText(e.target.value)}
              placeholder={`ht100, 45\npro-trim, 30`}
              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-3 text-[12px] font-mono outline-none focus:border-[#5B21B6]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="px-4 py-2 text-[12.5px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={importing}
                className="px-4 py-2 text-[12.5px] font-semibold bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                {importing ? 'Updating...' : 'Apply Stock Updates'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
