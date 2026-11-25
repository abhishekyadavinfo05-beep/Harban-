import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  ExternalLink,
  Mail,
  MapPin,
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
  onOpenCustomer,
  onCloseCustomer,
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
        aov: validOrders.length > 0 ? Math.round(spend / validOrders.length) : 0,
        latestOrder,
        locationCity,
      }
    })
  }, [customers, orders])

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

  const activeDetail = useMemo(() => {
    if (!selectedCustomerId) return null
    return (
      enriched.find(
        (c) =>
          String(c.id) === String(selectedCustomerId) ||
          String(c.uid || '') === String(selectedCustomerId),
      ) || null
    )
  }, [enriched, selectedCustomerId])

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
      if (created?.id) onOpenCustomer?.(created.id)
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

  const modalsJsx = (
    <>
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
    </>
  )

  /* ------------------------------------------ FULL-PAGE CUSTOMER DETAIL */
  if (selectedCustomerId) {
    if (!activeDetail) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onCloseCustomer?.()}
              className="w-9 h-9 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] grid place-items-center text-[#111827] cursor-pointer"
              aria-label="Back to customers"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="font-display font-bold text-[20px] text-[#111827]">
              Customer not found
            </h1>
          </div>
          <div className="bg-white rounded-2xl border border-[#EAECF0] p-10 text-center space-y-3 shadow-2xs">
            <p className="text-[13px] text-[#6B7280]">
              Customer profile was not found.
            </p>
            <button
              type="button"
              onClick={() => onCloseCustomer?.()}
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] text-white text-[12.5px] font-semibold px-4 py-2 rounded-xl cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to Customers
            </button>
          </div>
          {modalsJsx}
        </div>
      )
    }

    const navList = filtered.some((c) => c.id === activeDetail.id) ? filtered : enriched
    const currIdx = navList.findIndex((c) => c.id === activeDetail.id)
    const prevCustomer = currIdx > 0 ? navList[currIdx - 1] : null
    const nextCustomer =
      currIdx >= 0 && currIdx < navList.length - 1 ? navList[currIdx + 1] : null

    const shippingAddr = activeDetail.latestOrder?.shippingAddress || null

    return (
      <div className="space-y-4">
        {/* Top Bar */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => onCloseCustomer?.()}
              title="Back to Customers"
              aria-label="Back to Customers"
              className="mt-0.5 w-9 h-9 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] grid place-items-center text-[#111827] shadow-2xs shrink-0 cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-full bg-gradient-to-br from-[#6D28D9] to-[#4F46E5] text-white font-display font-bold text-[14px] grid place-items-center shrink-0">
                {getInitials(activeDetail.name)}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display font-bold text-[22px] text-[#111827] tracking-tight">
                    {activeDetail.name}
                  </h1>
                  <span
                    className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md capitalize ${
                      activeDetail.role === 'admin'
                        ? 'bg-[#F3E8FF] text-[#6D28D9]'
                        : 'bg-[#DCFCE7] text-[#15803D]'
                    }`}
                  >
                    {activeDetail.role || 'customer'}
                  </span>
                </div>
                <p className="text-[12.5px] text-[#6B7280] mt-0.5">
                  {activeDetail.locationCity ? `${activeDetail.locationCity} · ` : ''}
                  {activeDetail.createdAt
                    ? `Customer since ${new Date(activeDetail.createdAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}`
                    : activeDetail.email}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`mailto:${activeDetail.email}`}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#111827] px-3.5 py-2 rounded-xl shadow-2xs"
            >
              <Mail size={14} className="text-[#4B5563]" /> Send Email
            </a>

            <div className="inline-flex items-center rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                disabled={!prevCustomer}
                onClick={() => prevCustomer && onOpenCustomer?.(prevCustomer.id)}
                title={prevCustomer ? `Previous: ${prevCustomer.name}` : 'First customer'}
                aria-label="Previous customer"
                className="w-9 h-9 grid place-items-center text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer border-r border-[#E5E7EB]"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                disabled={!nextCustomer}
                onClick={() => nextCustomer && onOpenCustomer?.(nextCustomer.id)}
                title={nextCustomer ? `Next: ${nextCustomer.name}` : 'Last customer'}
                aria-label="Next customer"
                className="w-9 h-9 grid place-items-center text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* 2-Column Customer Detail Workspace */}
        <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
          {/* Left Column */}
          <div className="space-y-4 min-w-0">
            {/* Lifetime Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-[#EAECF0] p-4 shadow-2xs">
                <p className="text-[12px] text-[#6B7280]">Amount Spent</p>
                <p className="font-display font-bold text-[20px] text-[#111827] mt-1 tabular-nums">
                  {formatINR(activeDetail.spend)}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-[#EAECF0] p-4 shadow-2xs">
                <p className="text-[12px] text-[#6B7280]">Total Orders</p>
                <p className="font-display font-bold text-[20px] text-[#111827] mt-1 tabular-nums">
                  {activeDetail.ordersCount}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-[#EAECF0] p-4 shadow-2xs col-span-2 sm:col-span-1">
                <p className="text-[12px] text-[#6B7280]">Average Order Value</p>
                <p className="font-display font-bold text-[20px] text-[#111827] mt-1 tabular-nums">
                  {formatINR(activeDetail.aov)}
                </p>
              </div>
            </div>

            {/* Customer Orders Table */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-2xs overflow-hidden">
              <div className="px-5 py-4 border-b border-[#EAECF0] flex items-center justify-between">
                <h2 className="font-display font-bold text-[15px] text-[#111827] flex items-center gap-2">
                  <ShoppingBag size={15} className="text-[#5B21B6]" />
                  Orders ({activeDetail.allOrders.length})
                </h2>
              </div>

              {activeDetail.allOrders.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-[#6B7280]">
                  This customer has not placed any orders yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12.5px]">
                    <thead className="bg-[#F9FAFB] text-[#6B7280] font-medium border-b border-[#EAECF0]">
                      <tr>
                        <th className="py-3 px-4">Order ID</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Items</th>
                        <th className="py-3 px-3">Payment</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAECF0]">
                      {activeDetail.allOrders.map((ord) => (
                        <tr
                          key={ord.id}
                          onClick={() => onOpenOrder?.(ord.id)}
                          className="hover:bg-[#F9FAFB] cursor-pointer"
                        >
                          <td className="py-3 px-4 font-mono font-bold text-[#5B21B6] inline-flex items-center gap-1">
                            #{ord.id} <ExternalLink size={11} />
                          </td>
                          <td className="py-3 px-3 text-[#6B7280] whitespace-nowrap">
                            {new Date(ord.placedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3 px-3 text-[#374151] tabular-nums">
                            {(ord.items || []).reduce((s, it) => s + (it.qty || 1), 0)} item(s)
                          </td>
                          <td className="py-3 px-3 capitalize text-[#374151]">
                            {ord.paymentStatus || 'pending'}
                          </td>
                          <td className="py-3 px-3 capitalize text-[#374151]">
                            {ord.cancelled ? 'cancelled' : ord.orderStatus || 'pending'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold tabular-nums text-[#111827]">
                            {formatINR(ord.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <aside className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#EAECF0] p-4 space-y-3 shadow-2xs">
              <h3 className="font-display font-bold text-[13.5px] text-[#111827]">
                Contact information
              </h3>
              <div className="space-y-2 text-[12.5px] text-[#4B5563]">
                <a
                  href={`mailto:${activeDetail.email}`}
                  className="flex items-center gap-2 text-[#5B21B6] hover:underline truncate"
                >
                  <Mail size={13} className="text-[#9CA3AF] shrink-0" />
                  <span className="truncate">{activeDetail.email}</span>
                </a>
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
            </div>

            <div className="bg-white rounded-2xl border border-[#EAECF0] p-4 space-y-2.5 shadow-2xs">
              <h3 className="font-display font-bold text-[13.5px] text-[#111827] flex items-center gap-1.5">
                <MapPin size={14} className="text-[#5B21B6]" /> Default address
              </h3>
              {shippingAddr ? (
                <div className="text-[12.5px] text-[#4B5563] leading-relaxed">
                  <p className="font-semibold text-[#111827]">
                    {shippingAddr.fullName || activeDetail.name}
                  </p>
                  <p>{shippingAddr.line1}</p>
                  <p>
                    {shippingAddr.city}
                    {shippingAddr.state ? `, ${shippingAddr.state}` : ''}
                    {shippingAddr.pincode ? ` - ${shippingAddr.pincode}` : ''}
                  </p>
                  <p className="text-[#6B7280]">India</p>
                </div>
              ) : (
                <p className="text-[12px] text-[#9CA3AF]">
                  No shipping address recorded yet.
                </p>
              )}
            </div>
          </aside>
        </div>

        {modalsJsx}
      </div>
    )
  }

  /* ------------------------------------------ FULL-WIDTH CUSTOMERS LIST */
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[22px] text-[#111827] tracking-tight leading-tight">
            Customers
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            Click any customer to open their profile, shipping details and complete order history.
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

      {/* Full-Width Customers Directory */}
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
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onOpenCustomer?.(c.id)}
                    className="hover:bg-[#F9FAFB] cursor-pointer"
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalsJsx}
    </div>
  )
}
