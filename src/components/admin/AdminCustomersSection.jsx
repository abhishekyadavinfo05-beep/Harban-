import { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  CreditCard,
  Download,
  ExternalLink,
  Mail,
  Phone,
  Plus,
  Repeat,
  Search,
  ShoppingBag,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { matchesSearch } from '../../lib/search'
import { formatINR } from '../../store/shop'

function getInitials(name) {
  const parts = String(name || 'H').trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
  }
  return String(name || 'H').slice(0, 2).toUpperCase()
}

function phoneTail(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : digits
}

export default function AdminCustomersSection({
  overview,
  selectedCustomerId = null,
  onClearSelectedCustomer,
  onOpenOrder,
  onCreateCustomer,
  onReload,
  pushToast,
}) {
  const customers = overview.customers || []
  const orders = overview.orders || []
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [inspectCustomer, setInspectCustomer] = useState(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', role: 'customer' })
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importCsvText, setImportCsvText] = useState('')
  const [importing, setImporting] = useState(false)

  const enriched = useMemo(() => {
    return customers.map((c) => {
      const custEmail = (c.email || '').trim().toLowerCase()
      const custPhone = phoneTail(c.phone)
      const allCustOrders = orders.filter((o) => {
        const ordEmail = (o.customerEmail || '').trim().toLowerCase()
        const ordPhone = phoneTail(o.phone)
        if (custEmail && ordEmail && custEmail === ordEmail) return true
        if (custPhone && custPhone.length >= 10 && ordPhone === custPhone) return true
        return false
      })
      const validOrders = allCustOrders.filter(
        (o) => !o.cancelled && o.orderStatus !== 'cancelled',
      )
      const spend = validOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)
      const latestOrder = allCustOrders[0] || null
      const locationCity =
        latestOrder?.shippingAddress?.city ||
        latestOrder?.shippingAddress?.state ||
        ''
      return {
        ...c,
        allOrders: allCustOrders,
        ordersCount: allCustOrders.length,
        validCount: validOrders.length,
        spend,
        latestOrder,
        locationCity,
      }
    })
  }, [customers, orders])

  useEffect(() => {
    if (!selectedCustomerId) return
    const target = enriched.find((c) => c.id === selectedCustomerId)
    if (target) {
      setInspectCustomer(target)
    }
    onClearSelectedCustomer?.()
  }, [selectedCustomerId, enriched, onClearSelectedCustomer])

  const counts = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const withOrders = enriched.filter((c) => c.ordersCount > 0).length
    const repeatBuyers = enriched.filter((c) => c.ordersCount > 1).length
    const newThisMonth = enriched.filter(
      (c) => c.createdAt && new Date(c.createdAt).getTime() >= monthStart,
    ).length
    const totalSpend = enriched.reduce((s, c) => s + c.spend, 0)
    const totalValidOrders = enriched.reduce((s, c) => s + c.validCount, 0)
    const aov = totalValidOrders > 0 ? Math.round(totalSpend / totalValidOrders) : 0
    return {
      all: enriched.length,
      withOrders,
      repeatBuyers,
      admins: enriched.filter((c) => c.role === 'admin').length,
      newThisMonth,
      totalSpend,
      aov,
    }
  }, [enriched])

  const filtered = useMemo(() => {
    const now = Date.now()
    return enriched.filter((c) => {
      if (tab === 'ordered' && c.ordersCount === 0) return false
      if (tab === 'repeat' && c.ordersCount < 2) return false
      if (tab === 'admin' && c.role !== 'admin') return false
      if (roleFilter !== 'all' && (c.role || 'customer') !== roleFilter) return false
      if (dateRange === '30d' && c.createdAt) {
        if (now - new Date(c.createdAt).getTime() > 30 * 86400000) return false
      }
      if (dateRange === '7d' && c.createdAt) {
        if (now - new Date(c.createdAt).getTime() > 7 * 86400000) return false
      }
      return matchesSearch(
        search,
        c.name,
        c.email,
        c.phone,
        c.role,
        c.locationCity,
      )
    })
  }, [enriched, search, tab, roleFilter, dateRange])

  const activeDetail =
    enriched.find((c) => c.id === inspectCustomer?.id) || inspectCustomer || filtered[0] || null

  const handleExportCsv = () => {
    const header = ['Name', 'Email', 'Phone', 'Role', 'Location', 'Orders', 'AmountSpentINR']
    const rows = filtered.map((c) => [
      c.name,
      c.email,
      c.phone || '',
      c.role || 'customer',
      c.locationCity || '',
      c.ordersCount,
      c.spend,
    ])
    const csv = [header, ...rows]
      .map((line) =>
        line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `HARBAN-Customers-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    pushToast(`Exported ${filtered.length} customer(s)`)
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!onCreateCustomer || adding) return
    setAdding(true)
    setAddError('')
    try {
      const created = await onCreateCustomer(addForm)
      setAddOpen(false)
      setAddForm({ name: '', email: '', phone: '', role: 'customer' })
      await onReload?.()
      if (created) setInspectCustomer({ ...created, allOrders: [], ordersCount: 0, spend: 0 })
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Unable to add customer')
    } finally {
      setAdding(false)
    }
  }

  const handleImportSubmit = async (e) => {
    e.preventDefault()
    if (!onCreateCustomer || !importCsvText.trim() || importing) return
    setImporting(true)
    let added = 0
    try {
      const lines = importCsvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      for (let i = 0; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        if (i === 0 && /name|email/i.test(cols[0] || '')) continue
        const name = cols[0]
        const email = cols[1]
        if (!name || !email) continue
        try {
          await onCreateCustomer({
            name,
            email,
            phone: cols[2] || '',
            role: cols[3] === 'admin' ? 'admin' : 'customer',
          })
          added++
        } catch {
          /* skip duplicates */
        }
      }
      pushToast(`Imported ${added} new customer${added === 1 ? '' : 's'}`)
      setImportCsvText('')
      setImportOpen(false)
      await onReload?.()
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[22px] text-[#111827] tracking-tight leading-tight">
            Customers
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            Manage your customer base, view order history and track lifetime value.
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
          {onCreateCustomer && (
            <button
              type="button"
              onClick={() => {
                setAddError('')
                setAddOpen(true)
              }}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] hover:opacity-95 text-white px-4 py-2 rounded-xl shadow-xs cursor-pointer"
            >
              <Plus size={14} /> Add Customer
            </button>
          )}
        </div>
      </div>

      {/* 5 Pastel KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl border border-[#EAECF0] p-4 shadow-2xs flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#F3E8FF] text-[#6D28D9] grid place-items-center shrink-0">
            <Users size={18} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">Total Customers</p>
            <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
              {counts.all}
            </p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">{counts.withOrders} ordered</p>
          </div>
        </div>
        <div className="bg-[#F0FDF4] rounded-2xl border border-[#DCFCE7] p-4 shadow-2xs flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#DCFCE7] text-[#16A34A] grid place-items-center shrink-0">
            <Repeat size={18} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">Repeat Customers</p>
            <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
              {counts.repeatBuyers}
            </p>
            <p className="text-[11px] text-[#16A34A] mt-0.5">2+ orders</p>
          </div>
        </div>
        <div className="bg-[#FFFBEB] rounded-2xl border border-[#FEF3C7] p-4 shadow-2xs flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#FEF3C7] text-[#D97706] grid place-items-center shrink-0">
            <UserPlus size={18} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">New This Month</p>
            <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
              {counts.newThisMonth}
            </p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">Signups</p>
          </div>
        </div>
        <div className="bg-[#EFF6FF] rounded-2xl border border-[#DBEAFE] p-4 shadow-2xs flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#DBEAFE] text-[#2563EB] grid place-items-center shrink-0">
            <TrendingUp size={18} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">Avg Order Value</p>
            <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
              {formatINR(counts.aov)}
            </p>
            <p className="text-[11px] text-[#2563EB] mt-0.5">Completed orders</p>
          </div>
        </div>
        <div className="bg-[#FFF5F6] rounded-2xl border border-[#FFE4E6] p-4 shadow-2xs flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#FFE4E6] text-[#E11D48] grid place-items-center shrink-0">
            <CreditCard size={18} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">Total Revenue</p>
            <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
              {formatINR(counts.totalSpend)}
            </p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">Lifetime spend</p>
          </div>
        </div>
      </div>

      {/* Directory + Sticky Right-Side Profile */}
      <div className="grid xl:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="bg-white rounded-2xl border border-[#EAECF0] overflow-hidden shadow-2xs">
          <div className="px-4 pt-1 border-b border-[#EAECF0] flex items-center gap-5 overflow-x-auto text-[12.5px]">
            {[
              { id: 'all', label: `All Customers (${counts.all})` },
              { id: 'ordered', label: `With Orders (${counts.withOrders})` },
              { id: 'repeat', label: `Repeat Buyers (${counts.repeatBuyers})` },
              { id: 'admin', label: `Admins (${counts.admins})` },
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
            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 flex-1 min-w-[200px]">
              <Search size={14} className="text-[#9CA3AF] shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer by name, email, phone or city..."
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
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12px] font-medium text-[#374151] outline-none cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="30d">Last 30 Days</option>
              <option value="7d">Last 7 Days</option>
            </select>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12px] font-medium text-[#374151] outline-none cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-[#6B7280]">
              No customers match your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-[#F9FAFB] text-[#6B7280] font-medium border-b border-[#EAECF0]">
                  <tr>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-3">Email &amp; Phone</th>
                    <th className="py-3 px-3">Location</th>
                    <th className="py-3 px-3 text-right">Orders</th>
                    <th className="py-3 px-3 text-right">Total Spent</th>
                    <th className="py-3 px-4">Last Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0]">
                  {filtered.map((c) => {
                    const selected = activeDetail?.id === c.id
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setInspectCustomer(c)}
                        className={`hover:bg-[#F9FAFB] cursor-pointer ${
                          selected ? 'bg-[#F5F3FF]/70' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-full bg-[#F3E8FF] text-[#5B21B6] text-[11px] font-bold grid place-items-center shrink-0">
                              {getInitials(c.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#111827] truncate">{c.name}</p>
                              <span
                                className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${
                                  c.role === 'admin'
                                    ? 'bg-[#F3E8FF] text-[#6D28D9]'
                                    : 'bg-[#DCFCE7] text-[#15803D]'
                                }`}
                              >
                                {c.role || 'customer'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <p className="text-[#374151]">{c.email}</p>
                          <p className="text-[11px] text-[#6B7280] font-mono">
                            {c.phone || '—'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-[#6B7280]">
                          {c.locationCity || '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-[#111827] tabular-nums">
                          {c.ordersCount}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-[#111827] tabular-nums">
                          {formatINR(c.spend)}
                        </td>
                        <td className="py-3 px-4 text-[#6B7280] whitespace-nowrap">
                          {c.latestOrder ? (
                            <>
                              <span className="font-mono font-semibold text-[#5B21B6] block">
                                #{c.latestOrder.id}
                              </span>
                              <span className="text-[11px]">
                                {new Date(c.latestOrder.placedAt).toLocaleDateString('en-IN', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sticky Customer Details Side Card */}
        <aside className="bg-white rounded-2xl border border-[#EAECF0] p-5 space-y-4 shadow-2xs xl:sticky xl:top-20">
          {!activeDetail ? (
            <div className="py-8 text-center text-[13px] text-[#6B7280]">
              Select a customer to view profile details and order history.
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#EAECF0]">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-11 h-11 rounded-full bg-gradient-to-br from-[#6D28D9] to-[#4F46E5] text-white font-display font-bold text-[14px] grid place-items-center shrink-0">
                    {getInitials(activeDetail.name)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display font-bold text-[16px] text-[#111827] truncate">
                      {activeDetail.name}
                    </h2>
                    <span className="inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded bg-[#DCFCE7] text-[#15803D] capitalize">
                      {activeDetail.role || 'customer'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-[12.5px] text-[#4B5563]">
                <p className="flex items-center gap-2 truncate">
                  <Mail size={13} className="text-[#9CA3AF] shrink-0" />
                  <span className="truncate">{activeDetail.email}</span>
                </p>
                <p className="flex items-center gap-2 font-mono">
                  <Phone size={13} className="text-[#9CA3AF] shrink-0" />
                  <span>{activeDetail.phone || 'Not provided'}</span>
                </p>
                {activeDetail.createdAt && (
                  <p className="flex items-center gap-2">
                    <Calendar size={13} className="text-[#9CA3AF] shrink-0" />
                    <span>
                      Joined{' '}
                      {new Date(activeDetail.createdAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-[12px]">
                <div className="bg-[#F9FAFB] border border-[#EAECF0] rounded-xl p-3">
                  <p className="text-[#6B7280]">Total Orders</p>
                  <p className="font-display font-bold text-[18px] text-[#111827] tabular-nums mt-0.5">
                    {activeDetail.ordersCount}
                  </p>
                </div>
                <div className="bg-[#F9FAFB] border border-[#EAECF0] rounded-xl p-3">
                  <p className="text-[#6B7280]">Total Spent</p>
                  <p className="font-display font-bold text-[18px] text-[#111827] tabular-nums mt-0.5">
                    {formatINR(activeDetail.spend)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-display font-bold text-[13px] text-[#111827] flex items-center gap-1.5">
                  <ShoppingBag size={14} className="text-[#5B21B6]" />
                  Recent Orders ({activeDetail.allOrders.length})
                </p>
                {activeDetail.allOrders.length === 0 ? (
                  <p className="text-[12px] text-[#6B7280] bg-[#F9FAFB] border border-[#EAECF0] rounded-xl p-3 text-center">
                    No orders placed yet.
                  </p>
                ) : (
                  <div className="divide-y divide-[#EAECF0] border border-[#EAECF0] rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    {activeDetail.allOrders.slice(0, 6).map((ord) => (
                      <button
                        key={ord.id}
                        type="button"
                        onClick={() => onOpenOrder?.(ord.id)}
                        className="w-full text-left px-3 py-2.5 hover:bg-[#F9FAFB] flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-[12px] text-[#5B21B6] flex items-center gap-1">
                            #{ord.id}
                            <ExternalLink size={10} />
                          </p>
                          <p className="text-[11px] text-[#6B7280]">
                            {new Date(ord.placedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}{' '}
                            · {ord.orderStatus || 'pending'}
                          </p>
                        </div>
                        <span className="font-bold text-[12.5px] tabular-nums text-[#111827]">
                          {formatINR(ord.total)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {activeDetail.allOrders[0] ? (
                  <button
                    type="button"
                    onClick={() => onOpenOrder?.(activeDetail.allOrders[0].id)}
                    className="bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] text-white text-[12px] font-semibold py-2 rounded-xl cursor-pointer text-center"
                  >
                    Latest Order
                  </button>
                ) : (
                  <span />
                )}
                <a
                  href={`mailto:${activeDetail.email}`}
                  className="bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#5B21B6] text-[#111827] text-[12px] font-semibold py-2 rounded-xl text-center inline-flex items-center justify-center gap-1"
                >
                  <Mail size={12} /> Send Email
                </a>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Add Customer Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-[85] grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setAddOpen(false)}
          />
          <form
            onSubmit={handleCreateSubmit}
            className="relative bg-white rounded-2xl border border-[#EAECF0] max-w-md w-full p-5 space-y-3.5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-[16px] text-[#111827]">
                Add Customer
              </h3>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="p-1 text-[#6B7280] hover:text-[#111827] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {addError && (
              <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-[12px] font-semibold px-3 py-2 rounded-xl">
                {addError}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                Full Name *
              </label>
              <input
                required
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Rahul Sharma"
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#5B21B6]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                Email Address *
              </label>
              <input
                required
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="rahul@example.com"
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#5B21B6]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                  Phone Number
                </label>
                <input
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 9876543210"
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                  Role
                </label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm outline-none"
                >
                  <option value="customer">Customer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="px-4 py-2 text-[12.5px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adding}
                className="px-4 py-2 text-[12.5px] font-semibold bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                {adding ? 'Saving...' : 'Create Customer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Import Customers CSV Modal */}
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
                Import Customers (CSV)
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
              Paste CSV lines formatted as: <code>name, email, phone, role</code>
            </p>
            <textarea
              rows={5}
              required
              value={importCsvText}
              onChange={(e) => setImportCsvText(e.target.value)}
              placeholder={`Priya Singh, priya@example.com, +919123456780, customer`}
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
                {importing ? 'Importing...' : 'Import Customers'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
