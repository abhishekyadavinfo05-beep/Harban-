import { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Pencil,
  Percent,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { matchesSearch } from '../../lib/search'
import { formatINR } from '../../store/shop'

function toDateInput(val) {
  if (!val) return ''
  const d = new Date(val)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function createEmptyDiscount() {
  return {
    id: null,
    code: '',
    description: '',
    discountType: 'percentage',
    value: 15,
    minOrderValue: 499,
    maxDiscount: '',
    usageLimitMode: 'unlimited',
    usageLimit: '',
    startsAt: '',
    expiresAt: '',
    isActive: true,
  }
}

function getDiscountLifecycle(d) {
  const now = Date.now()
  if (d.expiresAt && new Date(d.expiresAt).getTime() < now) return 'expired'
  if (d.startsAt && new Date(d.startsAt).getTime() > now) return 'scheduled'
  if (d.isActive === false) return 'disabled'
  return 'active'
}

export default function AdminDiscountsSection({
  discounts = [],
  orders = [],
  selectedDiscountId = null,
  onClearSelectedDiscount,
  onSaveDiscount,
  onDeleteDiscount,
  onReload,
  pushToast,
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [form, setForm] = useState(() => createEmptyDiscount())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const stats = useMemo(() => {
    let active = 0
    let scheduled = 0
    let expired = 0
    let disabled = 0
    for (const d of discounts) {
      const life = getDiscountLifecycle(d)
      if (life === 'active') active++
      else if (life === 'scheduled') scheduled++
      else if (life === 'expired') expired++
      else disabled++
    }
    const totalGiven = orders
      .filter((o) => !o.cancelled && o.orderStatus !== 'cancelled')
      .reduce((s, o) => s + (Number(o.discountAmount) || 0), 0)
    const totalRedemptions = discounts.reduce(
      (s, d) => s + (Number(d.usedCount) || 0),
      0,
    )
    return {
      total: discounts.length,
      active,
      scheduled,
      expired,
      disabled,
      totalGiven,
      totalRedemptions,
    }
  }, [discounts, orders])

  const filtered = useMemo(() => {
    return discounts.filter((d) => {
      const life = getDiscountLifecycle(d)
      if (statusFilter !== 'all' && life !== statusFilter) return false
      if (typeFilter !== 'all' && (d.discountType || 'percentage') !== typeFilter)
        return false
      return matchesSearch(search, d.code, d.description, d.discountType, d.value)
    })
  }, [discounts, search, statusFilter, typeFilter])

  const resetForm = () => {
    setFormError('')
    setForm(createEmptyDiscount())
  }

  const openEdit = (d) => {
    setFormError('')
    setForm({
      id: d.id,
      code: d.code || '',
      description: d.description || '',
      discountType: d.discountType === 'fixed' ? 'fixed' : 'percentage',
      value: Number(d.value) || 10,
      minOrderValue: Number(d.minOrderValue) || 0,
      maxDiscount: d.maxDiscount ? String(d.maxDiscount) : '',
      usageLimitMode: d.usageLimit ? 'limited' : 'unlimited',
      usageLimit: d.usageLimit ? String(d.usageLimit) : '50',
      startsAt: toDateInput(d.startsAt),
      expiresAt: toDateInput(d.expiresAt),
      isActive: d.isActive !== false,
    })
  }

  useEffect(() => {
    if (!selectedDiscountId) return
    const target = discounts.find((d) => d.id === selectedDiscountId)
    if (target) openEdit(target)
    onClearSelectedDiscount?.()
  }, [selectedDiscountId, discounts, onClearSelectedDiscount])

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let suffix = ''
    for (let i = 0; i < 4; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)]
    }
    setForm((prev) => ({ ...prev, code: `HARBAN${suffix}` }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setFormError('')
    try {
      await onSaveDiscount({
        id: form.id || undefined,
        code: form.code,
        description: form.description,
        discountType: form.discountType,
        value: Number(form.value),
        minOrderValue: Number(form.minOrderValue) || 0,
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
        usageLimit:
          form.usageLimitMode === 'limited' && form.usageLimit
            ? Number(form.usageLimit)
            : null,
        startsAt: form.startsAt || null,
        expiresAt: form.expiresAt || null,
        isActive: form.isActive,
      })
      resetForm()
      await onReload()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save discount'
      setFormError(msg)
      pushToast(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (d) => {
    try {
      await onSaveDiscount({
        id: d.id,
        code: d.code,
        description: d.description || '',
        discountType: d.discountType,
        value: d.value,
        minOrderValue: d.minOrderValue || 0,
        maxDiscount: d.maxDiscount ?? null,
        usageLimit: d.usageLimit ?? null,
        startsAt: d.startsAt || null,
        expiresAt: d.expiresAt || null,
        isActive: d.isActive === false,
      })
      await onReload()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Status update failed')
    }
  }

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return
    try {
      await onDeleteDiscount(confirmDelete.id)
      if (form.id === confirmDelete.id) resetForm()
      setConfirmDelete(null)
      await onReload()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Delete failed')
      setConfirmDelete(null)
    }
  }

  const handleExportCsv = () => {
    const header = [
      'Code',
      'Status',
      'Type',
      'Value',
      'MinOrderValue',
      'MaxDiscount',
      'UsageLimit',
      'UsedCount',
      'StartsAt',
      'ExpiresAt',
      'Description',
    ]
    const rows = filtered.map((d) => [
      d.code,
      getDiscountLifecycle(d),
      d.discountType,
      d.value,
      d.minOrderValue ?? 0,
      d.maxDiscount ?? '',
      d.usageLimit ?? '',
      d.usedCount ?? 0,
      toDateInput(d.startsAt),
      toDateInput(d.expiresAt),
      d.description || '',
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
    link.download = `HARBAN-Discounts-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    pushToast(`Exported ${filtered.length} discount(s)`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[22px] text-[#111827] tracking-tight leading-tight">
            Discounts
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            Create promo codes, coupons and automated store discounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#111827] px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer"
          >
            <Download size={14} className="text-[#4B5563]" /> Export
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] hover:opacity-95 text-white px-4 py-2 rounded-xl shadow-xs cursor-pointer"
          >
            <Plus size={14} /> Create Discount
          </button>
        </div>
      </div>

      {/* 5 Pastel KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl border border-[#EAECF0] p-4 shadow-2xs flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#F3E8FF] text-[#6D28D9] grid place-items-center shrink-0">
            <Tag size={18} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">Total Discounts</p>
            <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
              {stats.total}
            </p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">
              {stats.totalRedemptions} redemptions
            </p>
          </div>
        </div>
        <div className="bg-[#F0FDF4] rounded-2xl border border-[#DCFCE7] p-4 shadow-2xs flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#DCFCE7] text-[#16A34A] grid place-items-center shrink-0">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">Active Discounts</p>
            <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
              {stats.active}
            </p>
            <p className="text-[11px] text-[#16A34A] mt-0.5">Ready on checkout</p>
          </div>
        </div>
        <div className="bg-[#FFFBEB] rounded-2xl border border-[#FEF3C7] p-4 shadow-2xs flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#FEF3C7] text-[#D97706] grid place-items-center shrink-0">
            <Clock size={18} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">Scheduled</p>
            <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
              {stats.scheduled}
            </p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">Upcoming offers</p>
          </div>
        </div>
        <div className="bg-[#FFF5F6] rounded-2xl border border-[#FFE4E6] p-4 shadow-2xs flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#FFE4E6] text-[#E11D48] grid place-items-center shrink-0">
            <XCircle size={18} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">Expired</p>
            <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
              {stats.expired}
            </p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">{stats.disabled} paused</p>
          </div>
        </div>
        <div className="bg-[#EFF6FF] rounded-2xl border border-[#DBEAFE] p-4 shadow-2xs flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#DBEAFE] text-[#2563EB] grid place-items-center shrink-0">
            <CreditCard size={18} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">Total Discount Given</p>
            <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
              {formatINR(stats.totalGiven)}
            </p>
            <p className="text-[11px] text-[#2563EB] mt-0.5">Across orders</p>
          </div>
        </div>
      </div>

      {/* Split Workspace: Table Left, Sticky Create/Edit Panel Right */}
      <div className="grid xl:grid-cols-[1fr_360px] gap-4 items-start">
        <div className="bg-white rounded-2xl border border-[#EAECF0] overflow-hidden shadow-2xs">
          <div className="px-4 pt-1 border-b border-[#EAECF0] flex items-center gap-5 overflow-x-auto text-[12.5px]">
            {[
              { id: 'all', label: `All Discounts (${stats.total})` },
              { id: 'active', label: `Active (${stats.active})` },
              { id: 'scheduled', label: `Scheduled (${stats.scheduled})` },
              { id: 'expired', label: `Expired (${stats.expired})` },
              { id: 'disabled', label: `Disabled (${stats.disabled})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setStatusFilter(t.id)}
                className={`py-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
                  statusFilter === t.id
                    ? 'border-[#5B21B6] text-[#5B21B6] font-semibold'
                    : 'border-transparent text-[#6B7280] hover:text-[#111827] font-medium'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-3.5 border-b border-[#EAECF0] flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 flex-1 min-w-[200px]">
              <Search size={14} className="text-[#9CA3AF] shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search discount code or description..."
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
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12px] font-medium text-[#374151] outline-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (₹)</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="font-display font-bold text-[15px] text-[#111827]">
                No discount codes match
              </p>
              <p className="text-[12.5px] text-[#6B7280] max-w-sm mx-auto">
                Create a percentage or flat INR coupon on the right panel to reward HARBAN shoppers.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-[#F9FAFB] text-[#6B7280] font-medium border-b border-[#EAECF0]">
                  <tr>
                    <th className="py-3 px-4">Code &amp; Rule</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Discount</th>
                    <th className="py-3 px-3">Usage / Limit</th>
                    <th className="py-3 px-3">Validity</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0]">
                  {filtered.map((d) => {
                    const life = getDiscountLifecycle(d)
                    const badge =
                      life === 'active'
                        ? 'bg-[#DCFCE7] text-[#15803D]'
                        : life === 'scheduled'
                          ? 'bg-[#FEF3C7] text-[#B45309]'
                          : life === 'expired'
                            ? 'bg-[#FEE2E2] text-[#B91C1C]'
                            : 'bg-[#F3F4F6] text-[#4B5563]'

                    return (
                      <tr
                        key={d.id}
                        className={`hover:bg-[#F9FAFB] ${
                          form.id === d.id ? 'bg-[#F5F3FF]/60' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <p className="font-bold text-[#5B21B6] font-mono">{d.code}</p>
                          <p className="text-[11px] text-[#6B7280] mt-0.5 truncate max-w-[200px]">
                            {d.minOrderValue > 0 ? `Min ${formatINR(d.minOrderValue)}` : 'No min spend'}
                            {d.description ? ` · ${d.description}` : ''}
                          </p>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#F3E8FF] text-[#6D28D9]">
                            {d.discountType === 'fixed' ? 'Fixed INR' : 'Percentage'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-[#111827] tabular-nums whitespace-nowrap">
                          {d.discountType === 'fixed' ? formatINR(d.value) : `${d.value}% OFF`}
                          {d.maxDiscount && d.discountType !== 'fixed' && (
                            <span className="block text-[10.5px] font-normal text-[#6B7280]">
                              Up to {formatINR(d.maxDiscount)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 tabular-nums whitespace-nowrap text-[#374151]">
                          <span className="font-bold">{d.usedCount ?? 0}</span>
                          <span className="text-[#9CA3AF]">
                            {' '}
                            / {d.usageLimit ? d.usageLimit : '∞'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-[#6B7280] whitespace-nowrap">
                          {d.startsAt || d.expiresAt ? (
                            <>
                              {d.startsAt ? toDateInput(d.startsAt) : 'Now'} →{' '}
                              {d.expiresAt ? toDateInput(d.expiresAt) : 'No expiry'}
                            </>
                          ) : (
                            'Always valid'
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(d)}
                            title="Click to toggle active state"
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md capitalize cursor-pointer ${badge}`}
                          >
                            {life}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(d)}
                              className="w-7 h-7 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] grid place-items-center text-[#4B5563] cursor-pointer"
                              title="Edit discount"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(d)}
                              className="w-7 h-7 rounded-lg border border-[#FECDD3] hover:bg-[#FFF5F6] grid place-items-center text-[#E11D48] cursor-pointer"
                              title="Delete discount"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sticky Create / Edit Discount Form */}
        <form
          onSubmit={handleSave}
          className="bg-white rounded-2xl border border-[#EAECF0] p-5 space-y-3.5 shadow-2xs xl:sticky xl:top-20"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-[#EAECF0]">
            <h2 className="font-display font-bold text-[15px] text-[#111827] flex items-center gap-2">
              <Percent size={15} className="text-[#5B21B6]" />
              {form.id ? `Edit ${form.code}` : 'Create Discount'}
            </h2>
            {form.id && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[12px] font-semibold text-[#5B21B6] hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {formError && (
            <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-[12px] font-semibold px-3 py-2 rounded-xl">
              {formError}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-[#374151]">
                Discount Code *
              </label>
              <button
                type="button"
                onClick={generateCode}
                className="text-[11px] font-semibold text-[#5B21B6] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Sparkles size={11} /> Generate
              </button>
            </div>
            <input
              required
              value={form.code}
              onChange={(e) =>
                setForm((d) => ({ ...d, code: e.target.value.toUpperCase() }))
              }
              placeholder="e.g. HARBAN15"
              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm font-mono uppercase outline-none focus:border-[#5B21B6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                Discount Type
              </label>
              <select
                value={form.discountType}
                onChange={(e) => setForm((d) => ({ ...d, discountType: e.target.value }))}
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm outline-none"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed INR (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                Value *
              </label>
              <input
                required
                type="number"
                min="1"
                max={form.discountType === 'percentage' ? 100 : undefined}
                value={form.value}
                onChange={(e) => setForm((d) => ({ ...d, value: Number(e.target.value) }))}
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm tabular-nums outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                Min Order Amount (₹)
              </label>
              <input
                type="number"
                min="0"
                value={form.minOrderValue}
                onChange={(e) =>
                  setForm((d) => ({ ...d, minOrderValue: Number(e.target.value) }))
                }
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm tabular-nums outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                Max Discount Cap (₹)
              </label>
              <input
                type="number"
                min="0"
                value={form.maxDiscount}
                onChange={(e) => setForm((d) => ({ ...d, maxDiscount: e.target.value }))}
                placeholder="No cap"
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm tabular-nums outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                <Calendar size={11} className="inline mr-1" /> Start Date
              </label>
              <input
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm((d) => ({ ...d, startsAt: e.target.value }))}
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-2.5 py-2 text-[12px] outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                <Calendar size={11} className="inline mr-1" /> End Date
              </label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((d) => ({ ...d, expiresAt: e.target.value }))}
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-2.5 py-2 text-[12px] outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-[#374151]">
              Usage Limit
            </label>
            <div className="flex items-center gap-4 text-[12px] text-[#374151]">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="usageLimitMode"
                  checked={form.usageLimitMode === 'unlimited'}
                  onChange={() => setForm((d) => ({ ...d, usageLimitMode: 'unlimited' }))}
                  className="accent-[#5B21B6]"
                />
                Unlimited
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="usageLimitMode"
                  checked={form.usageLimitMode === 'limited'}
                  onChange={() =>
                    setForm((d) => ({
                      ...d,
                      usageLimitMode: 'limited',
                      usageLimit: d.usageLimit || '100',
                    }))
                  }
                  className="accent-[#5B21B6]"
                />
                Limit Uses
              </label>
            </div>
            {form.usageLimitMode === 'limited' && (
              <input
                type="number"
                min="1"
                value={form.usageLimit}
                onChange={(e) => setForm((d) => ({ ...d, usageLimit: e.target.value }))}
                placeholder="Maximum redemptions"
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-sm tabular-nums outline-none"
              />
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#374151] mb-1">
              Note / Campaign Label
            </label>
            <input
              value={form.description}
              onChange={(e) => setForm((d) => ({ ...d, description: e.target.value }))}
              placeholder="e.g. Summer grooming offer"
              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm outline-none"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#111827] cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((d) => ({ ...d, isActive: e.target.checked }))}
              className="accent-[#5B21B6]"
            />
            Active on Checkout
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] hover:opacity-95 text-white text-[13px] font-semibold py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : form.id ? 'Update Discount' : 'Save Discount'}
          </button>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[85] grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="relative bg-white rounded-2xl border border-[#EAECF0] max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-display font-bold text-[16px] text-[#111827]">
              Delete discount code?
            </h3>
            <p className="text-[13px] text-[#6B7280]">
              Remove coupon <strong>{confirmDelete.code}</strong> permanently?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-[12.5px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-[12.5px] font-semibold bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl cursor-pointer"
              >
                Delete Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
