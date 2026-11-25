import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Box,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  Truck,
  User,
  X,
  XCircle,
} from 'lucide-react'
import Img from '../Img'
import { formatINR } from '../../store/shop'
import { matchesSearch } from '../../lib/search'

const ORDER_STATUS_META = {
  pending: {
    label: 'Pending',
    fulfillmentLabel: 'Pending',
    nextCta: 'Confirm Order',
    nextPrimary: 'confirmed',
    cls: 'bg-[#EDE9FE] text-[#6D28D9]',
    next: ['confirmed', 'processing', 'shipped', 'delivered'],
  },
  confirmed: {
    label: 'Confirmed',
    fulfillmentLabel: 'Confirmed',
    nextCta: 'Start Processing',
    nextPrimary: 'processing',
    cls: 'bg-[#F3E8FF] text-[#7C3AED]',
    next: ['processing', 'shipped', 'delivered'],
  },
  processing: {
    label: 'Processing',
    fulfillmentLabel: 'Processing',
    nextCta: 'Mark as Shipped',
    nextPrimary: 'shipped',
    cls: 'bg-[#FEF3C7] text-[#B45309]',
    next: ['shipped', 'delivered'],
  },
  shipped: {
    label: 'Shipped',
    fulfillmentLabel: 'Shipped',
    nextCta: 'Mark as Delivered',
    nextPrimary: 'delivered',
    cls: 'bg-[#DBEAFE] text-[#1D4ED8]',
    next: ['delivered'],
  },
  delivered: {
    label: 'Delivered',
    fulfillmentLabel: 'Delivered',
    nextCta: '',
    nextPrimary: '',
    cls: 'bg-[#DCFCE7] text-[#15803D]',
    next: [],
  },
  cancelled: {
    label: 'Cancelled',
    fulfillmentLabel: 'Cancelled',
    nextCta: '',
    nextPrimary: '',
    cls: 'bg-[#FEE2E2] text-[#B91C1C]',
    next: [],
  },
}

function getOrderStatus(o) {
  if (o.cancelled || o.orderStatus === 'cancelled') return 'cancelled'
  return o.orderStatus && ORDER_STATUS_META[o.orderStatus]
    ? o.orderStatus
    : o.status >= 4
      ? 'delivered'
      : o.status >= 2
        ? 'shipped'
        : o.status === 1
          ? 'confirmed'
          : 'pending'
}

function phoneTail(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : digits
}

function formatDateLine(ts) {
  if (!ts) return { date: '—', time: '' }
  const d = new Date(ts)
  return {
    date: d.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    time: d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
  }
}

function formatDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildInvoiceHtml(order) {
  const addr = order.shippingAddress
  const addrLine = addr
    ? `${escapeHtml(addr.fullName || order.customerName)}<br>${escapeHtml(addr.line1 || '')}<br>${escapeHtml(addr.city || '')}${addr.state ? `, ${escapeHtml(addr.state)}` : ''} ${addr.pincode ? `- ${escapeHtml(addr.pincode)}` : ''}`
    : 'Standard India Delivery'

  const rowsHtml = (order.items || [])
    .map(
      (i, idx) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${idx + 1}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">
          <strong>${escapeHtml(i.name)}</strong>
          ${i.variantLabel ? `<div style="font-size:12px;color:#6b7280;">Option: ${escapeHtml(i.variantLabel)}</div>` : ''}
          ${i.sku ? `<div style="font-size:11px;color:#6b7280;">SKU: ${escapeHtml(i.sku)}</div>` : ''}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${i.qty}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">Rs. ${Number(i.price).toLocaleString('en-IN')}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">Rs. ${Number(i.price * i.qty).toLocaleString('en-IN')}</td>
      </tr>`,
    )
    .join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>HARBAN Invoice — ${escapeHtml(order.id)}</title>
</head>
<body style="font-family:Inter,Arial,sans-serif;color:#111827;max-width:780px;margin:32px auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #5B21B6;padding-bottom:16px;margin-bottom:20px;">
    <div>
      <div style="font-size:24px;font-weight:900;letter-spacing:0.06em;">HARBAN</div>
      <div style="font-size:12px;color:#4b5563;">Groom Better. Everyday. · care@harban.in</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:18px;font-weight:800;">TAX INVOICE</div>
      <div style="font-size:13px;font-family:monospace;">Order ID: #${escapeHtml(order.id)}</div>
      <div style="font-size:12px;color:#6b7280;">Date: ${escapeHtml(formatDateTime(order.placedAt))}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;font-size:13px;">
    <div style="background:#f8fafc;padding:12px;border-radius:8px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">Bill / Ship To</div>
      <div>${addrLine}</div>
      <div style="margin-top:4px;color:#4b5563;">Phone: ${escapeHtml(order.phone || '—')}</div>
      ${order.customerEmail ? `<div style="color:#4b5563;">Email: ${escapeHtml(order.customerEmail)}</div>` : ''}
    </div>
    <div style="background:#f8fafc;padding:12px;border-radius:8px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">Payment &amp; Dispatch</div>
      <div>Method: <strong>${escapeHtml(order.paymentMethod)}</strong></div>
      <div>Payment Status: <strong style="text-transform:uppercase;">${escapeHtml(order.paymentStatus)}</strong></div>
      ${order.razorpayPaymentId ? `<div>Razorpay ID: <code>${escapeHtml(order.razorpayPaymentId)}</code></div>` : ''}
      ${order.trackingNumber ? `<div>Tracking: ${escapeHtml(order.courierPartner || 'Courier')} · <code>${escapeHtml(order.trackingNumber)}</code></div>` : ''}
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="padding:10px 8px;text-align:left;">#</th>
        <th style="padding:10px 8px;text-align:left;">Product</th>
        <th style="padding:10px 8px;text-align:right;">Qty</th>
        <th style="padding:10px 8px;text-align:right;">Unit Price</th>
        <th style="padding:10px 8px;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div style="margin-left:auto;max-width:280px;font-size:13px;">
    <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Subtotal</span><span>Rs. ${Number(order.subtotal).toLocaleString('en-IN')}</span></div>
    ${order.discountAmount > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#059669;"><span>Discount ${order.discountCode ? `(${escapeHtml(order.discountCode)})` : ''}</span><span>- Rs. ${Number(order.discountAmount).toLocaleString('en-IN')}</span></div>` : ''}
    <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Shipping</span><span>${order.shipping === 0 ? 'Free' : `Rs. ${Number(order.shipping).toLocaleString('en-IN')}`}</span></div>
    <div style="display:flex;justify-content:space-between;padding:10px 0 0;margin-top:6px;border-top:2px solid #111827;font-size:16px;font-weight:800;"><span>Total (INR)</span><span>Rs. ${Number(order.total).toLocaleString('en-IN')}</span></div>
  </div>
  <p style="margin-top:32px;font-size:11px;color:#6b7280;text-align:center;">Thank you for choosing HARBAN. Inclusive of all applicable GST taxes.</p>
</body>
</html>`
}

function PaymentPill({ order }) {
  const payKey = String(order.paymentStatus || 'pending').toLowerCase()
  const methodLower = String(order.paymentMethod || '').toLowerCase()
  if (payKey === 'paid') {
    return (
      <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D] whitespace-nowrap">
        Paid
      </span>
    )
  }
  if (methodLower.includes('cod') || methodLower.includes('cash')) {
    return (
      <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#F3F4F6] text-[#374151] whitespace-nowrap">
        COD
      </span>
    )
  }
  if (payKey === 'failed') {
    return (
      <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#FEE2E2] text-[#B91C1C] whitespace-nowrap">
        Failed
      </span>
    )
  }
  if (payKey === 'refunded') {
    return (
      <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#F3F4F6] text-[#6B7280] whitespace-nowrap">
        Refunded
      </span>
    )
  }
  return (
    <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#FEF3C7] text-[#B45309] whitespace-nowrap">
      Pending
    </span>
  )
}

function OrderStatusPill({ statusKey }) {
  const meta = ORDER_STATUS_META[statusKey] || ORDER_STATUS_META.pending
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md whitespace-nowrap ${meta.cls}`}
    >
      {statusKey === 'delivered' && <CheckCircle2 size={11} />}
      {meta.label}
    </span>
  )
}

export default function AdminOrdersSection({
  overview,
  viewMode = 'all',
  selectedOrderCode = null,
  onOpenOrder,
  onCloseOrder,
  onOpenProduct,
  onOpenCustomer,
  externalCreateTrigger = 0,
  onCreateOrder,
  onUpdateOrder,
  onReload,
  pushToast,
}) {
  const orders = overview.orders || []
  const products = overview.products || []
  const customers = overview.customers || []
  const cartEvents = overview.cartEvents || []

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(
    viewMode === 'drafts' ? 'pending' : 'all',
  )
  const [channelFilter, setChannelFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [sortDir, setSortDir] = useState('desc')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)

  const [statusDraft, setStatusDraft] = useState('')
  const [courierPartner, setCourierPartner] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [paymentStatusDraft, setPaymentStatusDraft] = useState('pending')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [cancelModalOrder, setCancelModalOrder] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [invoiceOrder, setInvoiceOrder] = useState(null)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    customerName: '',
    phone: '',
    customerEmail: '',
    line1: '',
    city: '',
    state: '',
    pincode: '',
    paymentMethod: 'Admin Manual',
    paymentStatus: 'pending',
    orderStatus: 'confirmed',
    internalNotes: '',
    items: [],
  })
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    setStatusFilter(viewMode === 'drafts' ? 'pending' : 'all')
    setPage(1)
    setSelectedIds([])
  }, [viewMode])

  useEffect(() => {
    if (externalCreateTrigger > 0) {
      openCreateModal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalCreateTrigger])

  const activeOrder = useMemo(() => {
    if (!selectedOrderCode) return null
    return (
      orders.find(
        (o) => String(o.id).toLowerCase() === String(selectedOrderCode).toLowerCase(),
      ) || null
    )
  }, [orders, selectedOrderCode])

  useEffect(() => {
    if (activeOrder) {
      const st = getOrderStatus(activeOrder)
      setStatusDraft(st)
      setCourierPartner(activeOrder.courierPartner || '')
      setTrackingNumber(activeOrder.trackingNumber || '')
      setTrackingUrl(activeOrder.trackingUrl || '')
      setInternalNotes(activeOrder.internalNotes || '')
      setPaymentStatusDraft(activeOrder.paymentStatus || 'pending')
      setActionError('')
    }
  }, [activeOrder])

  const counts = useMemo(() => {
    const map = {
      all: orders.length,
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    }
    for (const o of orders) {
      const st = getOrderStatus(o)
      if (st in map) map[st] += 1
    }
    return map
  }, [orders])

  const filtered = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime()
    const sevenDaysAgo = startOfToday - 6 * 86400_000
    const thirtyDaysAgo = startOfToday - 29 * 86400_000
    const fromMs = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : null
    const toMs = customTo ? new Date(`${customTo}T23:59:59`).getTime() : null

    const list = orders.filter((o) => {
      const st = getOrderStatus(o)
      if (statusFilter === 'processing') {
        if (st !== 'processing' && st !== 'confirmed') return false
      } else if (statusFilter !== 'all' && st !== statusFilter) {
        return false
      }
      if (
        paymentFilter !== 'all' &&
        (o.paymentStatus || '').toLowerCase() !== paymentFilter
      ) {
        return false
      }
      if (channelFilter !== 'all') {
        const pm = String(o.paymentMethod || '').toLowerCase()
        if (channelFilter === 'cod' && !pm.includes('cod') && !pm.includes('cash'))
          return false
        if (channelFilter === 'razorpay' && !pm.includes('razorpay')) return false
        if (channelFilter === 'manual' && !pm.includes('manual') && !pm.includes('admin'))
          return false
      }
      if (dateFilter === 'today' && o.placedAt < startOfToday) return false
      if (dateFilter === '7d' && o.placedAt < sevenDaysAgo) return false
      if (dateFilter === '30d' && o.placedAt < thirtyDaysAgo) return false
      if (dateFilter === 'custom') {
        if (fromMs && o.placedAt < fromMs) return false
        if (toMs && o.placedAt > toMs) return false
      }
      if (!search.trim()) return true
      return matchesSearch(
        search,
        o.id,
        o.customerName,
        o.customerEmail,
        o.phone,
        o.paymentMethod,
        o.paymentStatus,
        o.courierPartner,
        o.trackingNumber,
        o.items,
        o.shippingAddress,
      )
    })

    return [...list].sort((a, b) =>
      sortDir === 'desc' ? b.placedAt - a.placedAt : a.placedAt - b.placedAt,
    )
  }, [
    orders,
    search,
    statusFilter,
    channelFilter,
    paymentFilter,
    dateFilter,
    customFrom,
    customTo,
    sortDir,
  ])

  const abandonedCheckouts = useMemo(() => {
    const completedOrderCodes = new Set(orders.map((o) => o.id))
    const sessionLatest = new Map()
    for (const ev of cartEvents) {
      if (ev.orderCode && completedOrderCodes.has(ev.orderCode)) continue
      if (ev.eventType === 'checkout_completed') continue
      if (!['checkout_started', 'add_to_cart'].includes(ev.eventType)) continue
      const key = ev.sessionId || ev.customerEmail || String(ev.id)
      if (!sessionLatest.has(key)) {
        sessionLatest.set(key, ev)
      }
    }
    return Array.from(sessionLatest.values()).filter((ev) =>
      matchesSearch(
        search,
        ev.customerName,
        ev.customerEmail,
        ev.productName,
        ev.sessionId,
      ),
    )
  }, [cartEvents, orders, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedOrders = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, safePage, pageSize])

  const allVisibleSelected =
    pagedOrders.length > 0 && pagedOrders.every((o) => selectedIds.includes(o.id))

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(pagedOrders.map((o) => o.id))
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)))
    } else {
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...pagedOrders.map((o) => o.id)])),
      )
    }
  }

  const toggleSelectRow = (orderId) => {
    setSelectedIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    )
  }

  const runOrderUpdate = async (orderCode, patch, successMsg) => {
    setActionBusy(true)
    setActionError('')
    try {
      await onUpdateOrder(orderCode, patch)
      if (successMsg) pushToast(successMsg)
      await onReload()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to update order'
      setActionError(msg)
      pushToast(msg)
      return false
    } finally {
      setActionBusy(false)
    }
  }

  const handleBulkStatus = async (nextStatus) => {
    if (selectedIds.length === 0 || actionBusy) return
    setActionBusy(true)
    let successCount = 0
    try {
      for (const code of selectedIds) {
        try {
          await onUpdateOrder(code, { orderStatus: nextStatus })
          successCount += 1
        } catch {
          // continue
        }
      }
      if (successCount > 0) {
        pushToast(`Updated ${successCount} order(s) to ${nextStatus}`)
        await onReload()
      } else {
        pushToast('No selected orders could transition to that status')
      }
      setSelectedIds([])
    } finally {
      setActionBusy(false)
    }
  }

  const handleConfirmCancel = async (e) => {
    e.preventDefault()
    if (!cancelModalOrder) return
    const reason = cancelReason.trim()
    if (reason.length < 3) {
      setActionError('Please enter a cancellation reason (at least 3 characters).')
      return
    }
    const ok = await runOrderUpdate(
      cancelModalOrder.id,
      { orderStatus: 'cancelled', cancelled: true, cancelReason: reason },
      `Order #${cancelModalOrder.id} cancelled & stock restored`,
    )
    if (ok) {
      setCancelModalOrder(null)
      setCancelReason('')
    }
  }

  const handleDownloadInvoice = (order) => {
    const html = buildInvoiceHtml(order)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `HARBAN-Invoice-${order.id}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    pushToast(`Invoice downloaded (#${order.id})`)
  }

  const handleExportCsv = (onlySelected = false) => {
    const rowsSource =
      onlySelected && selectedIds.length > 0
        ? filtered.filter((o) => selectedIds.includes(o.id))
        : filtered
    const header = [
      'OrderID',
      'Date',
      'Customer',
      'Phone',
      'Email',
      'PaymentMethod',
      'PaymentStatus',
      'OrderStatus',
      'TotalINR',
      'Courier',
      'TrackingNumber',
    ]
    const rows = rowsSource.map((o) => [
      `#${o.id}`,
      new Date(o.placedAt).toISOString(),
      o.customerName,
      o.phone || '',
      o.customerEmail || '',
      o.paymentMethod,
      o.paymentStatus,
      getOrderStatus(o),
      o.total,
      o.courierPartner || '',
      o.trackingNumber || '',
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
    link.download = `HARBAN-Orders-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    pushToast(`Exported ${rowsSource.length} order(s)`)
  }

  const openCreateModal = () => {
    const firstActive = products.find((p) => p.isActive !== false && (p.stock ?? 0) > 0)
    setCreateError('')
    setCreateForm({
      customerName: '',
      phone: '',
      customerEmail: '',
      line1: '',
      city: '',
      state: '',
      pincode: '',
      paymentMethod: 'Admin Manual',
      paymentStatus: 'pending',
      orderStatus: 'confirmed',
      internalNotes: '',
      items: firstActive ? [{ productId: firstActive.id, qty: 1 }] : [],
    })
    setCreateModalOpen(true)
  }

  const createSubtotal = useMemo(() => {
    return createForm.items.reduce((sum, line) => {
      const prod = products.find((p) => p.id === line.productId)
      return sum + (Number(prod?.price) || 0) * (Number(line.qty) || 0)
    }, 0)
  }, [createForm.items, products])

  const handleSubmitCreateOrder = async (e) => {
    e.preventDefault()
    if (!onCreateOrder || createSaving) return
    setCreateSaving(true)
    setCreateError('')
    try {
      const validItems = createForm.items
        .filter((i) => i.productId && Number(i.qty) > 0)
        .map((i) => ({ productId: i.productId, qty: Number(i.qty) }))

      if (!createForm.customerName.trim()) {
        throw new Error('Customer name is required.')
      }
      if (validItems.length === 0) {
        throw new Error('Add at least one in-stock product item.')
      }

      const created = await onCreateOrder({
        customerName: createForm.customerName.trim(),
        phone: createForm.phone.trim(),
        customerEmail: createForm.customerEmail.trim() || undefined,
        paymentMethod: createForm.paymentMethod,
        paymentStatus: createForm.paymentStatus,
        orderStatus: createForm.orderStatus,
        internalNotes: createForm.internalNotes.trim() || undefined,
        shippingAddress:
          createForm.line1.trim() || createForm.city.trim()
            ? {
                fullName: createForm.customerName.trim(),
                line1: createForm.line1.trim(),
                city: createForm.city.trim(),
                state: createForm.state.trim(),
                pincode: createForm.pincode.trim(),
              }
            : null,
        items: validItems,
      })

      setCreateModalOpen(false)
      await onReload()
      if (created?.id) onOpenOrder?.(created.id)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unable to create order')
    } finally {
      setCreateSaving(false)
    }
  }

  const copyShippingAddress = async (order) => {
    const addr = order?.shippingAddress
    if (!addr) return
    const text = [
      addr.fullName || order.customerName,
      addr.line1,
      [addr.city, addr.state, addr.pincode].filter(Boolean).join(', '),
      order.phone ? `Phone: ${order.phone}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      pushToast('Shipping address copied')
    } catch {
      pushToast('Copy not supported in this browser')
    }
  }

  const totalCount = Math.max(1, counts.all)
  const kpiCards = [
    {
      id: 'all',
      label: 'Total Orders',
      count: counts.all,
      sub: 'All recorded orders',
      subCls: 'text-[#15803D]',
      cardCls: 'bg-white border-[#EAECF0]',
      iconCls: 'bg-[#F3E8FF] text-[#6D28D9]',
      Icon: ShoppingCart,
    },
    {
      id: 'delivered',
      label: 'Delivered',
      count: counts.delivered,
      sub: `(${((counts.delivered / totalCount) * 100).toFixed(1)}%)`,
      subCls: 'text-[#6B7280]',
      cardCls: 'bg-[#F0FDF4] border-[#DCFCE7]',
      iconCls: 'bg-[#DCFCE7] text-[#16A34A]',
      Icon: CheckCircle2,
    },
    {
      id: 'shipped',
      label: 'Shipped',
      count: counts.shipped,
      sub: `(${((counts.shipped / totalCount) * 100).toFixed(1)}%)`,
      subCls: 'text-[#6B7280]',
      cardCls: 'bg-[#EFF6FF] border-[#DBEAFE]',
      iconCls: 'bg-[#DBEAFE] text-[#2563EB]',
      Icon: Truck,
    },
    {
      id: 'processing',
      label: 'Processing',
      count: counts.processing + counts.confirmed,
      sub: `(${(((counts.processing + counts.confirmed) / totalCount) * 100).toFixed(1)}%)`,
      subCls: 'text-[#6B7280]',
      cardCls: 'bg-[#FFFBEB] border-[#FEF3C7]',
      iconCls: 'bg-[#FEF3C7] text-[#D97706]',
      Icon: Box,
    },
    {
      id: 'pending',
      label: 'Pending',
      count: counts.pending,
      sub: `(${((counts.pending / totalCount) * 100).toFixed(1)}%)`,
      subCls: 'text-[#6B7280]',
      cardCls: 'bg-[#F5F3FF] border-[#EDE9FE]',
      iconCls: 'bg-[#EDE9FE] text-[#7C3AED]',
      Icon: Clock,
    },
    {
      id: 'cancelled',
      label: 'Cancelled',
      count: counts.cancelled,
      sub: `(${((counts.cancelled / totalCount) * 100).toFixed(1)}%)`,
      subCls: 'text-[#6B7280]',
      cardCls: 'bg-[#FFF5F6] border-[#FFE4E6]',
      iconCls: 'bg-[#FFE4E6] text-[#E11D48]',
      Icon: XCircle,
    },
  ]

  // Shared modals rendered across both List View & Order Detail View
  const modalsJsx = (
    <>
      {cancelModalOrder && (
        <div className="fixed inset-0 z-[85] grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setCancelModalOrder(null)}
          />
          <form
            onSubmit={handleConfirmCancel}
            className="relative bg-white rounded-2xl border border-[#EAECF0] max-w-md w-full p-5 space-y-4 shadow-xl"
          >
            <h3 className="font-display font-bold text-[16px] text-[#111827]">
              Cancel Order #{cancelModalOrder.id}?
            </h3>
            <p className="text-[12.5px] text-[#6B7280]">
              Cancelling restores ordered product stock cleanly once and locks future status updates.
            </p>
            <div>
              <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                Cancellation Reason *
              </label>
              <input
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer requested cancellation"
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#5B21B6]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                className="px-4 py-2 text-[12.5px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6] rounded-xl cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="submit"
                disabled={actionBusy}
                className="px-4 py-2 text-[12.5px] font-semibold bg-[#E11D48] hover:bg-[#BE123C] disabled:opacity-50 text-white rounded-xl cursor-pointer"
              >
                {actionBusy ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </form>
        </div>
      )}

      {invoiceOrder && (
        <div className="fixed inset-0 z-[90] grid place-items-center p-4">
          <div
            className="no-print absolute inset-0 bg-black/55 backdrop-blur-xs"
            onClick={() => setInvoiceOrder(null)}
          />
          <div className="relative bg-white rounded-2xl border border-[#EAECF0] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="no-print flex items-center justify-between border-b border-[#EAECF0] pb-3">
              <h3 className="font-display font-bold text-[15px] text-[#111827]">
                Invoice Preview · #{invoiceOrder.id}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] text-white text-[12px] font-semibold px-3.5 py-1.5 rounded-xl cursor-pointer"
                >
                  <Printer size={13} /> Print
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadInvoice(invoiceOrder)}
                  className="inline-flex items-center gap-1.5 border border-[#E5E7EB] text-[#111827] text-[12px] font-semibold px-3.5 py-1.5 rounded-xl cursor-pointer"
                >
                  <Download size={13} /> Download HTML
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceOrder(null)}
                  className="p-1.5 rounded-lg hover:bg-[#F3F4F6] text-[#6B7280] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="print-invoice space-y-5 text-[13px] text-[#111827]">
              <div className="flex justify-between items-start border-b-2 border-[#5B21B6] pb-4">
                <div>
                  <p className="font-display font-black text-[22px] tracking-wider">
                    HARBAN
                  </p>
                  <p className="text-[11.5px] text-[#6B7280]">
                    Groom Better. Everyday. · care@harban.in
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display font-extrabold text-[16px]">
                    TAX INVOICE
                  </p>
                  <p className="font-mono text-[12px]">#{invoiceOrder.id}</p>
                  <p className="text-[11.5px] text-[#6B7280]">
                    {formatDateTime(invoiceOrder.placedAt)}
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-[#F9FAFB] p-3 rounded-xl">
                  <p className="text-[10.5px] font-bold uppercase text-[#6B7280] mb-1">
                    Bill &amp; Ship To
                  </p>
                  <p className="font-bold">
                    {invoiceOrder.shippingAddress?.fullName ||
                      invoiceOrder.customerName}
                  </p>
                  {invoiceOrder.shippingAddress && (
                    <p className="text-[#374151]">
                      {invoiceOrder.shippingAddress.line1},{' '}
                      {invoiceOrder.shippingAddress.city}{' '}
                      {invoiceOrder.shippingAddress.pincode}
                    </p>
                  )}
                  <p className="text-[#374151] mt-1">
                    Phone: {invoiceOrder.phone || '—'}
                  </p>
                </div>
                <div className="bg-[#F9FAFB] p-3 rounded-xl">
                  <p className="text-[10.5px] font-bold uppercase text-[#6B7280] mb-1">
                    Payment &amp; Dispatch
                  </p>
                  <p>
                    Method: <strong>{invoiceOrder.paymentMethod}</strong>
                  </p>
                  <p className="uppercase text-[12px]">
                    Status: <strong>{invoiceOrder.paymentStatus}</strong>
                  </p>
                  {invoiceOrder.razorpayPaymentId && (
                    <p className="font-mono text-[11px] text-[#6B7280]">
                      RZP: {invoiceOrder.razorpayPaymentId}
                    </p>
                  )}
                  {invoiceOrder.trackingNumber && (
                    <p className="text-[11.5px] mt-1">
                      {invoiceOrder.courierPartner}:{' '}
                      <span className="font-mono">{invoiceOrder.trackingNumber}</span>
                    </p>
                  )}
                </div>
              </div>

              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F3F4F6] text-[11.5px] uppercase text-[#6B7280]">
                    <th className="py-2 px-3">Item</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-2 text-right">Price</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0]">
                  {(invoiceOrder.items || []).map((i, idx) => (
                    <tr key={`${i.id}-${idx}`}>
                      <td className="py-2.5 px-3">
                        <p className="font-bold">{i.name}</p>
                        {i.variantLabel && (
                          <p className="text-[11px] text-[#6B7280]">
                            {i.variantLabel}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        {i.qty}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        {formatINR(i.price)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                        {formatINR(i.price * i.qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="ml-auto max-w-[240px] space-y-1 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Subtotal</span>
                  <span className="tabular-nums">
                    {formatINR(invoiceOrder.subtotal)}
                  </span>
                </div>
                {invoiceOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-[#15803D]">
                    <span>Discount</span>
                    <span className="tabular-nums">
                      - {formatINR(invoiceOrder.discountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Shipping</span>
                  <span>
                    {invoiceOrder.shipping === 0
                      ? 'Free'
                      : formatINR(invoiceOrder.shipping)}
                  </span>
                </div>
                <div className="flex justify-between font-display font-black text-[15px] pt-1.5 border-t border-[#111827]">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatINR(invoiceOrder.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {createModalOpen && (
        <div className="fixed inset-0 z-[90] grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-xs"
            onClick={() => setCreateModalOpen(false)}
          />
          <form
            onSubmit={handleSubmitCreateOrder}
            className="relative bg-white rounded-2xl border border-[#EAECF0] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#EAECF0] pb-3">
              <div>
                <h2 className="font-display font-bold text-[16px] text-[#111827]">
                  Create Order
                </h2>
                <p className="text-[12px] text-[#6B7280]">
                  Creates a real order (#HB100+ sequence) and reserves product stock.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-[#6B7280] hover:text-[#111827] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {createError && (
              <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-[12px] font-semibold px-3 py-2 rounded-xl">
                {createError}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-semibold text-[#374151]">
                  Products *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const first = products.find(
                      (p) => p.isActive !== false && (p.stock ?? 0) > 0,
                    )
                    if (!first) return
                    setCreateForm((prev) => ({
                      ...prev,
                      items: [...prev.items, { productId: first.id, qty: 1 }],
                    }))
                  }}
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#5B21B6] hover:underline cursor-pointer"
                >
                  <Plus size={12} /> Add item
                </button>
              </div>

              <div className="space-y-2">
                {createForm.items.map((line, idx) => {
                  const selectedProd = products.find(
                    (p) => p.id === line.productId,
                  )
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl p-2"
                    >
                      <select
                        value={line.productId}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            items: prev.items.map((it, i) =>
                              i === idx ? { ...it, productId: e.target.value } : it,
                            ),
                          }))
                        }
                        className="flex-1 bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[12.5px] outline-none min-w-0"
                      >
                        {products
                          .filter((p) => p.isActive !== false)
                          .map((p) => (
                            <option
                              key={p.id}
                              value={p.id}
                              disabled={(p.stock ?? 0) <= 0}
                            >
                              {p.name} — {formatINR(p.price)} ({p.stock ?? 0} left)
                            </option>
                          ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, selectedProd?.stock ?? 99)}
                        value={line.qty}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            items: prev.items.map((it, i) =>
                              i === idx ? { ...it, qty: Number(e.target.value) } : it,
                            ),
                          }))
                        }
                        className="w-16 bg-white border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-[12.5px] text-center tabular-nums outline-none"
                      />
                      {createForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCreateForm((prev) => ({
                              ...prev,
                              items: prev.items.filter((_, i) => i !== idx),
                            }))
                          }
                          className="p-1.5 text-[#E11D48] hover:bg-[#FFF5F6] rounded-lg cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  Customer Name *
                </label>
                <input
                  required
                  value={createForm.customerName}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, customerName: e.target.value }))
                  }
                  placeholder="Rohan Sharma"
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] outline-none focus:border-[#5B21B6]"
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  Phone Number
                </label>
                <input
                  value={createForm.phone}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="9876543210"
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] font-mono outline-none focus:border-[#5B21B6]"
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={createForm.customerEmail}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, customerEmail: e.target.value }))
                  }
                  placeholder="customer@email.com"
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] outline-none focus:border-[#5B21B6]"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-4 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  Street Address
                </label>
                <input
                  value={createForm.line1}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, line1: e.target.value }))
                  }
                  placeholder="House/Flat, Street"
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  City
                </label>
                <input
                  value={createForm.city}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, city: e.target.value }))
                  }
                  placeholder="Mumbai"
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  Pincode
                </label>
                <input
                  value={createForm.pincode}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, pincode: e.target.value }))
                  }
                  placeholder="400001"
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] font-mono outline-none"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  Payment Method
                </label>
                <select
                  value={createForm.paymentMethod}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, paymentMethod: e.target.value }))
                  }
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] outline-none"
                >
                  <option value="Admin Manual">Admin Manual</option>
                  <option value="Cash on Delivery">Cash on Delivery</option>
                  <option value="Razorpay Online">Razorpay Online</option>
                </select>
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  Payment Status
                </label>
                <select
                  value={createForm.paymentStatus}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, paymentStatus: e.target.value }))
                  }
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  Initial Stage
                </label>
                <select
                  value={createForm.orderStatus}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, orderStatus: e.target.value }))
                  }
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                Internal Note (Optional)
              </label>
              <input
                value={createForm.internalNotes}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, internalNotes: e.target.value }))
                }
                placeholder="WhatsApp phone order or priority dispatch note"
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#EAECF0]">
              <div className="text-[13px]">
                <span className="text-[#6B7280]">Order Total: </span>
                <strong className="font-display text-[16px] text-[#111827] tabular-nums">
                  {formatINR(createSubtotal)}
                </strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-[12.5px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSaving}
                  className="px-4 py-2 text-[12.5px] font-semibold bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] disabled:opacity-50 text-white rounded-xl cursor-pointer"
                >
                  {createSaving ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  )

  /* ---------------------------------------------- ABANDONED CHECKOUTS VIEW */
  if (viewMode === 'abandoned') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-[22px] text-[#111827] tracking-tight">
              Abandoned checkouts
            </h1>
            <p className="text-[13px] text-[#6B7280] mt-0.5">
              Unfinished storefront sessions captured from live cart telemetry.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] hover:opacity-95 text-white px-4 py-2 rounded-xl shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus size={14} /> Create Order
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAECF0] overflow-hidden shadow-2xs">
          <div className="p-3.5 border-b border-[#EAECF0] flex items-center gap-2">
            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 w-full max-w-md">
              <Search size={14} className="text-[#9CA3AF] shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search abandoned checkouts by customer, email or product..."
                className="bg-transparent outline-none text-[12.5px] text-[#111827] w-full"
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
          </div>

          {abandonedCheckouts.length === 0 ? (
            <div className="p-10 text-center space-y-1">
              <p className="font-display font-bold text-[15px] text-[#111827]">
                No abandoned checkouts recorded
              </p>
              <p className="text-[12.5px] text-[#6B7280]">
                Unfinished storefront checkout sessions automatically appear here from live telemetry.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-[#F9FAFB] text-[#6B7280] font-medium border-b border-[#EAECF0]">
                  <tr>
                    <th className="py-2.5 px-4">Checkout</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Product / Cart</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0]">
                  {abandonedCheckouts.map((ev) => (
                    <tr key={ev.id} className="hover:bg-[#F9FAFB]">
                      <td className="py-3 px-4 font-mono font-bold text-[#5B21B6]">
                        #{String(ev.sessionId || ev.id).slice(0, 8)}
                      </td>
                      <td className="py-3 px-3 text-[#6B7280] whitespace-nowrap">
                        {formatDateTime(ev.createdAt)}
                      </td>
                      <td className="py-3 px-3 font-medium text-[#111827]">
                        {ev.customerName || ev.customerEmail || 'Guest shopper'}
                      </td>
                      <td className="py-3 px-3 text-[#6B7280] truncate max-w-[240px]">
                        {ev.productName || `${(ev.cartItems || []).length} cart item(s)`}
                      </td>
                      <td className="py-3 px-3 text-right font-bold tabular-nums text-[#111827]">
                        {formatINR(ev.cartTotal || 0)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#FEF3C7] text-[#B45309]">
                          Not recovered
                        </span>
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

  /* -------------------------------------------- FULL-PAGE ORDER DETAIL VIEW */
  if (selectedOrderCode) {
    if (!activeOrder) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onCloseOrder?.()}
              className="w-9 h-9 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] grid place-items-center text-[#111827] cursor-pointer"
              aria-label="Back to orders"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="font-display font-bold text-[20px] text-[#111827]">
              Order #{selectedOrderCode}
            </h1>
          </div>

          <div className="bg-white rounded-2xl border border-[#EAECF0] p-10 text-center space-y-3 shadow-2xs">
            <p className="font-display font-bold text-[16px] text-[#111827]">
              Order #{selectedOrderCode} not found
            </p>
            <p className="text-[13px] text-[#6B7280]">
              This order may not exist yet or was removed from the database.
            </p>
            <button
              type="button"
              onClick={() => onCloseOrder?.()}
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] text-white text-[12.5px] font-semibold px-4 py-2 rounded-xl cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to All Orders
            </button>
          </div>
          {modalsJsx}
        </div>
      )
    }

    const stKey = getOrderStatus(activeOrder)
    const stMeta = ORDER_STATUS_META[stKey] || ORDER_STATUS_META.pending
    const isTerminal = stKey === 'delivered' || stKey === 'cancelled'
    const itemCount = (activeOrder.items || []).reduce(
      (sum, it) => sum + (Number(it.qty) || 1),
      0,
    )

    // Prev / Next Order Navigation
    const navList = filtered.some((o) => o.id === activeOrder.id) ? filtered : orders
    const currIdx = navList.findIndex((o) => o.id === activeOrder.id)
    const prevOrder = currIdx > 0 ? navList[currIdx - 1] : null
    const nextOrder =
      currIdx >= 0 && currIdx < navList.length - 1 ? navList[currIdx + 1] : null

    // Match customer in customer directory for clickable cross-navigation
    const ordEmail = String(activeOrder.customerEmail || '').trim().toLowerCase()
    const ordPhone = phoneTail(activeOrder.phone)
    const matchedCustomer = customers.find((c) => {
      const cEmail = String(c.email || '').trim().toLowerCase()
      const cPhone = phoneTail(c.phone)
      if (ordEmail && cEmail && ordEmail === cEmail) return true
      if (ordPhone && ordPhone.length >= 10 && cPhone === ordPhone) return true
      return false
    })
    const customerOrderCount = orders.filter((o) => {
      const e = String(o.customerEmail || '').trim().toLowerCase()
      const p = phoneTail(o.phone)
      if (ordEmail && e && ordEmail === e) return true
      if (ordPhone && ordPhone.length >= 10 && p === ordPhone) return true
      return false
    }).length

    // Chronological Timeline Events
    const timelineEvents = []
    if (Array.isArray(activeOrder.timeline) && activeOrder.timeline.length > 0) {
      for (const ev of activeOrder.timeline) {
        timelineEvents.push({
          id: ev.id || `${ev.status}-${ev.createdAt}`,
          title: ev.notes || `Stage updated to ${ev.status}`,
          sub: ORDER_STATUS_META[ev.status]?.label || ev.status,
          ts: ev.createdAt,
        })
      }
    }
    if (timelineEvents.length === 0 && activeOrder.placedAt) {
      timelineEvents.push({
        id: 'placed',
        title: `Order #${activeOrder.id} placed via ${activeOrder.paymentMethod || 'Storefront'}`,
        sub: 'Order Created',
        ts: activeOrder.placedAt,
      })
    }

    return (
      <div className="space-y-4">
        {/* Shopify-Style Order Detail Top Bar */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => onCloseOrder?.()}
              title="Back to Orders"
              aria-label="Back to Orders"
              className="mt-0.5 w-9 h-9 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] grid place-items-center text-[#111827] shadow-2xs shrink-0 cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display font-bold text-[22px] text-[#111827] font-mono tracking-tight">
                  #{activeOrder.id}
                </h1>
                <PaymentPill order={activeOrder} />
                <OrderStatusPill statusKey={stKey} />
              </div>
              <p className="text-[12.5px] text-[#6B7280] mt-0.5">
                {formatDateTime(activeOrder.placedAt)}
                {activeOrder.paymentMethod ? ` · ${activeOrder.paymentMethod}` : ''}
                {activeOrder.utmSource ? ` · ${activeOrder.utmSource}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setInvoiceOrder(activeOrder)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#111827] px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer whitespace-nowrap"
            >
              <Printer size={14} className="text-[#4B5563]" /> Print Invoice
            </button>
            <button
              type="button"
              onClick={() => handleDownloadInvoice(activeOrder)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#111827] px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer whitespace-nowrap"
            >
              <Download size={14} className="text-[#4B5563]" /> Download HTML
            </button>

            <div className="inline-flex items-center rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                disabled={!prevOrder}
                onClick={() => prevOrder && onOpenOrder?.(prevOrder.id)}
                title={prevOrder ? `Previous: #${prevOrder.id}` : 'First order'}
                aria-label="Previous order"
                className="w-9 h-9 grid place-items-center text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer border-r border-[#E5E7EB]"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                disabled={!nextOrder}
                onClick={() => nextOrder && onOpenOrder?.(nextOrder.id)}
                title={nextOrder ? `Next: #${nextOrder.id}` : 'Last order'}
                aria-label="Next order"
                className="w-9 h-9 grid place-items-center text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>

        {actionError && (
          <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-[12.5px] font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Shopify 2-Column Order Detail Workspace */}
        <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
          {/* Left Main Column */}
          <div className="space-y-4 min-w-0">
            {/* Card 1: Fulfillment, Items & Dispatch Tracking */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-2xs overflow-hidden">
              <div className="px-5 py-4 border-b border-[#EAECF0] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-8 h-8 rounded-xl grid place-items-center shrink-0 ${stMeta.cls}`}
                  >
                    <Package size={15} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-[15px] text-[#111827]">
                        {stMeta.label}
                      </span>
                      <span className="text-[12px] text-[#6B7280] tabular-nums">
                        ({itemCount} item{itemCount === 1 ? '' : 's'})
                      </span>
                    </div>
                    <p className="text-[11.5px] text-[#6B7280]">
                      {activeOrder.trackingNumber
                        ? `${activeOrder.courierPartner || 'Courier'} · AWB ${activeOrder.trackingNumber}`
                        : activeOrder.shippingAddress?.city
                          ? `Destination: ${activeOrder.shippingAddress.city}${
                              activeOrder.shippingAddress.state
                                ? `, ${activeOrder.shippingAddress.state}`
                                : ''
                            }`
                          : 'Standard India Dispatch'}
                    </p>
                  </div>
                </div>

                {!isTerminal && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value)}
                      className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12px] font-semibold text-[#111827] outline-none cursor-pointer"
                    >
                      <option value={stKey}>Stage: {stMeta.label}</option>
                      {stMeta.next.map((nx) => (
                        <option key={nx} value={nx}>
                          Move to {ORDER_STATUS_META[nx].label}
                        </option>
                      ))}
                    </select>
                    {statusDraft !== stKey ? (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() =>
                          runOrderUpdate(
                            activeOrder.id,
                            { orderStatus: statusDraft },
                            `Order updated to ${ORDER_STATUS_META[statusDraft]?.label || statusDraft}`,
                          )
                        }
                        className="bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] hover:opacity-95 disabled:opacity-50 text-white text-[12.5px] font-semibold px-4 py-2 rounded-xl shadow-xs cursor-pointer whitespace-nowrap"
                      >
                        Update Status
                      </button>
                    ) : stMeta.nextPrimary ? (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() =>
                          runOrderUpdate(
                            activeOrder.id,
                            { orderStatus: stMeta.nextPrimary },
                            `Order updated to ${ORDER_STATUS_META[stMeta.nextPrimary]?.label}`,
                          )
                        }
                        className="bg-[#111827] hover:bg-[#1F2937] disabled:opacity-50 text-white text-[12.5px] font-semibold px-4 py-2 rounded-xl shadow-xs cursor-pointer whitespace-nowrap"
                      >
                        {stMeta.nextCta}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => {
                        setCancelReason('')
                        setActionError('')
                        setCancelModalOrder(activeOrder)
                      }}
                      className="inline-flex items-center gap-1 text-[12px] font-semibold bg-white border border-[#FECDD3] hover:bg-[#FFF5F6] disabled:opacity-40 text-[#E11D48] px-3 py-2 rounded-xl cursor-pointer whitespace-nowrap"
                    >
                      <XCircle size={13} /> Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Delivery Strip */}
              <div className="px-5 py-2.5 bg-[#F9FAFB] border-b border-[#EAECF0] flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#4B5563]">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Truck size={13} className="text-[#5B21B6]" />
                  {activeOrder.courierPartner || 'Standard Express Courier'}
                  {activeOrder.shipping === 0 ? ' · Free Shipping' : ''}
                </span>
                {activeOrder.shippingAddress?.city && (
                  <span className="inline-flex items-center gap-1 text-[#374151] font-medium">
                    <MapPin size={12} className="text-[#6B7280]" />
                    {activeOrder.shippingAddress.city}
                    {activeOrder.shippingAddress.pincode
                      ? ` · ${activeOrder.shippingAddress.pincode}`
                      : ''}
                  </span>
                )}
              </div>

              {/* Order Line Items */}
              <div className="divide-y divide-[#EAECF0]">
                {(activeOrder.items || []).map((item, idx) => {
                  const catalogProd = products.find((p) => p.id === item.id)
                  const canOpenProd = Boolean(catalogProd || item.id)
                  return (
                    <div
                      key={`${item.id}-${idx}`}
                      className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-[#FAFAFC]"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Img
                          src={item.image || catalogProd?.image}
                          alt={item.name}
                          className="w-12 h-12 rounded-xl object-cover border border-[#EAECF0] bg-[#F9FAFB] shrink-0"
                        />
                        <div className="min-w-0">
                          {canOpenProd && onOpenProduct ? (
                            <button
                              type="button"
                              onClick={() => onOpenProduct(item.id)}
                              className="font-semibold text-[13.5px] text-[#111827] hover:text-[#5B21B6] hover:underline text-left truncate block max-w-full cursor-pointer"
                            >
                              {item.name}
                            </button>
                          ) : (
                            <p className="font-semibold text-[13.5px] text-[#111827] truncate">
                              {item.name}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[#6B7280] mt-0.5">
                            {item.variantLabel && <span>{item.variantLabel}</span>}
                            {(item.sku || catalogProd?.sku) && (
                              <span className="font-mono">
                                SKU: {item.sku || catalogProd?.sku}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 shrink-0 text-[13px] tabular-nums">
                        <span className="text-[#6B7280] whitespace-nowrap">
                          {formatINR(item.price)} ×{' '}
                          <span className="inline-block px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[#111827] font-semibold">
                            {item.qty}
                          </span>
                        </span>
                        <span className="font-bold text-[#111827] min-w-[84px] text-right">
                          {formatINR(Number(item.price) * Number(item.qty))}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Card 2: Payment Summary Card */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-2xs overflow-hidden">
              <div className="px-5 py-4 border-b border-[#EAECF0] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-[#F3E8FF] text-[#6D28D9] grid place-items-center shrink-0">
                    <CreditCard size={15} />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-[15px] text-[#111827]">
                      Payment
                    </span>
                    <PaymentPill order={activeOrder} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={paymentStatusDraft}
                    onChange={(e) => setPaymentStatusDraft(e.target.value)}
                    className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-[12px] font-semibold text-[#111827] outline-none cursor-pointer"
                  >
                    <option value="pending">Pending</option>
                    <option value="initiated">Initiated</option>
                    <option value="paid">Paid</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                  <button
                    type="button"
                    disabled={actionBusy || paymentStatusDraft === (activeOrder.paymentStatus || 'pending')}
                    onClick={() =>
                      runOrderUpdate(
                        activeOrder.id,
                        { paymentStatus: paymentStatusDraft },
                        `Payment marked as ${paymentStatusDraft}`,
                      )
                    }
                    className="border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] disabled:opacity-45 text-[#111827] text-[12px] font-semibold px-3 py-1.5 rounded-xl cursor-pointer"
                  >
                    Update Payment
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-2.5 text-[13px]">
                <div className="flex justify-between text-[#4B5563]">
                  <span>
                    Subtotal{' '}
                    <span className="text-[#9CA3AF]">
                      ({itemCount} item{itemCount === 1 ? '' : 's'})
                    </span>
                  </span>
                  <span className="tabular-nums font-medium text-[#111827]">
                    {formatINR(activeOrder.subtotal)}
                  </span>
                </div>
                {Number(activeOrder.discountAmount) > 0 && (
                  <div className="flex justify-between text-[#15803D]">
                    <span>
                      Discount{' '}
                      {activeOrder.discountCode ? (
                        <span className="font-mono text-[11.5px] font-semibold">
                          ({activeOrder.discountCode})
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular-nums font-semibold">
                      - {formatINR(activeOrder.discountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[#4B5563]">
                  <span>Shipping</span>
                  <span className="tabular-nums font-medium text-[#111827]">
                    {activeOrder.shipping === 0 ? 'Free (₹0)' : formatINR(activeOrder.shipping)}
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t border-[#EAECF0] font-display font-bold text-[15px] text-[#111827]">
                  <span>Total</span>
                  <span className="tabular-nums">{formatINR(activeOrder.total)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#F3F4F6] text-[12px] text-[#6B7280]">
                  <span>
                    {String(activeOrder.paymentStatus).toLowerCase() === 'paid'
                      ? 'Paid by customer'
                      : 'Balance via ' + (activeOrder.paymentMethod || 'Order')}
                  </span>
                  <span className="font-mono tabular-nums text-[#111827]">
                    {activeOrder.razorpayPaymentId || activeOrder.paymentMethod}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Order Timeline */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-2xs p-5 space-y-3">
              <h2 className="font-display font-bold text-[14px] text-[#111827] flex items-center gap-1.5">
                <FileText size={14} className="text-[#5B21B6]" /> Order Timeline
              </h2>
              <div className="space-y-3 pl-2 border-l border-[#E5E7EB]">
                {timelineEvents.map((ev, idx) => (
                  <div key={`${ev.id}-${idx}`} className="relative pl-4">
                    <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-[#5B21B6]" />
                    <p className="text-[12.5px] font-semibold text-[#111827]">
                      {ev.title}
                    </p>
                    <p className="text-[11px] text-[#6B7280] tabular-nums">
                      {formatDateTime(ev.ts)}
                    </p>
                  </div>
                ))}
                {activeOrder.cancelledReason && (
                  <div className="relative pl-4">
                    <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-[#E11D48]" />
                    <p className="text-[12.5px] font-semibold text-[#B91C1C]">
                      Cancelled: {activeOrder.cancelledReason}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Inspector Sidebar Column */}
          <aside className="space-y-4">
            {/* Notes Card */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-2xs p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-[13.5px] text-[#111827]">
                  Notes
                </h3>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() =>
                    runOrderUpdate(
                      activeOrder.id,
                      { internalNotes },
                      'Order note saved',
                    )
                  }
                  className="text-[11.5px] font-semibold text-[#5B21B6] hover:underline cursor-pointer disabled:opacity-50"
                >
                  Save note
                </button>
              </div>
              <textarea
                rows={3}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Add internal dispatch or customer notes..."
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] outline-none focus:border-[#5B21B6] resize-none"
              />
            </div>

            {/* Customer Card */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-2xs p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-[13.5px] text-[#111827] flex items-center gap-1.5">
                  <User size={14} className="text-[#5B21B6]" /> Customer
                </h3>
                <span className="text-[11.5px] text-[#6B7280] tabular-nums">
                  {customerOrderCount} order{customerOrderCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="space-y-1.5 text-[12.5px]">
                {matchedCustomer && onOpenCustomer ? (
                  <button
                    type="button"
                    onClick={() => onOpenCustomer(matchedCustomer.id)}
                    className="font-semibold text-[#5B21B6] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    {activeOrder.customerName}
                    <ExternalLink size={11} />
                  </button>
                ) : (
                  <p className="font-semibold text-[#111827]">
                    {activeOrder.customerName}
                  </p>
                )}
                {activeOrder.customerEmail && (
                  <a
                    href={`mailto:${activeOrder.customerEmail}`}
                    className="flex items-center gap-1.5 text-[#4B5563] hover:text-[#111827] truncate"
                  >
                    <Mail size={12} className="text-[#9CA3AF] shrink-0" />
                    <span className="truncate">{activeOrder.customerEmail}</span>
                  </a>
                )}
                {activeOrder.phone && (
                  <p className="flex items-center gap-1.5 text-[#4B5563] font-mono text-[12px]">
                    <Phone size={12} className="text-[#9CA3AF] shrink-0" />
                    <span>{activeOrder.phone}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Shipping Address Card */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-2xs p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-[13.5px] text-[#111827] flex items-center gap-1.5">
                  <MapPin size={14} className="text-[#5B21B6]" /> Shipping address
                </h3>
                {activeOrder.shippingAddress && (
                  <button
                    type="button"
                    onClick={() => copyShippingAddress(activeOrder)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B7280] hover:text-[#111827] cursor-pointer"
                  >
                    <Copy size={11} /> Copy
                  </button>
                )}
              </div>
              {activeOrder.shippingAddress ? (
                <div className="text-[12.5px] text-[#4B5563] leading-relaxed">
                  <p className="font-semibold text-[#111827]">
                    {activeOrder.shippingAddress.fullName || activeOrder.customerName}
                  </p>
                  <p>{activeOrder.shippingAddress.line1}</p>
                  <p>
                    {activeOrder.shippingAddress.city}
                    {activeOrder.shippingAddress.state
                      ? `, ${activeOrder.shippingAddress.state}`
                      : ''}
                    {activeOrder.shippingAddress.pincode
                      ? ` - ${activeOrder.shippingAddress.pincode}`
                      : ''}
                  </p>
                  <p className="text-[#6B7280]">India</p>
                </div>
              ) : (
                <p className="text-[12px] text-[#9CA3AF]">
                  No shipping address recorded.
                </p>
              )}
            </div>

            {/* Additional & Channel Details Card */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-2xs p-4 space-y-2.5 text-[12.5px]">
              <h3 className="font-display font-bold text-[13.5px] text-[#111827]">
                Additional details
              </h3>
              <div className="space-y-2 pt-1">
                <div>
                  <p className="text-[11px] text-[#6B7280]">Order ID</p>
                  <p className="font-mono font-semibold text-[#111827]">
                    #{activeOrder.id}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#6B7280]">Channel / Payment Method</p>
                  <p className="font-medium text-[#111827]">
                    {activeOrder.paymentMethod || 'HARBAN Storefront'}
                  </p>
                </div>
                {activeOrder.razorpayOrderId && (
                  <div>
                    <p className="text-[11px] text-[#6B7280]">Razorpay Order ID</p>
                    <p className="font-mono text-[11.5px] text-[#374151] break-all">
                      {activeOrder.razorpayOrderId}
                    </p>
                  </div>
                )}
                {(activeOrder.utmSource || activeOrder.utmMedium || activeOrder.utmCampaign) && (
                  <div>
                    <p className="text-[11px] text-[#6B7280]">Campaign Attribution</p>
                    <p className="text-[#374151]">
                      {[activeOrder.utmSource, activeOrder.utmMedium, activeOrder.utmCampaign]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Courier & AWB Tracking Card */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-2xs p-4 space-y-3">
              <h3 className="font-display font-bold text-[13.5px] text-[#111827] flex items-center gap-1.5">
                <Truck size={14} className="text-[#5B21B6]" /> Courier &amp; AWB Tracking
              </h3>
              <div className="space-y-2.5 text-[12.5px]">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] mb-1">
                    Courier Partner
                  </label>
                  <input
                    list="harban-couriers"
                    value={courierPartner}
                    onChange={(e) => setCourierPartner(e.target.value)}
                    placeholder="e.g. Delhivery"
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 outline-none focus:border-[#5B21B6]"
                  />
                  <datalist id="harban-couriers">
                    <option value="Delhivery" />
                    <option value="Blue Dart" />
                    <option value="DTDC" />
                    <option value="Ekart Logistics" />
                    <option value="Xpressbees" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] mb-1">
                    AWB / Tracking Number
                  </label>
                  <input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="AWB123456789"
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 font-mono outline-none focus:border-[#5B21B6]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] mb-1">
                    Tracking URL (Optional)
                  </label>
                  <input
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    placeholder="https://track..."
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 outline-none focus:border-[#5B21B6]"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() =>
                  runOrderUpdate(
                    activeOrder.id,
                    {
                      courierPartner,
                      trackingNumber,
                      trackingUrl,
                    },
                    'Courier tracking updated',
                  )
                }
                className="w-full bg-[#111827] hover:bg-[#1F2937] disabled:opacity-50 text-white text-[12px] font-semibold px-4 py-2 rounded-xl cursor-pointer"
              >
                Save Tracking
              </button>
            </div>
          </aside>
        </div>

        {modalsJsx}
      </div>
    )
  }

  /* ---------------------------------------------- FULL-WIDTH ORDERS LIST */
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[22px] text-[#111827] tracking-tight leading-tight">
            {viewMode === 'drafts' ? 'Draft & Pending Orders' : 'Orders'}
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            Click any order to view full fulfillment details, customer profile and invoice.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExportCsv(false)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#111827] px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer whitespace-nowrap"
          >
            <Download size={14} className="text-[#4B5563]" /> Export
          </button>

          <button
            type="button"
            onClick={() => {
              const target = pagedOrders[0]
              if (target) setInvoiceOrder(target)
              else pushToast('No orders visible to print')
            }}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#111827] px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer whitespace-nowrap"
          >
            <Printer size={14} className="text-[#4B5563]" /> Print
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] hover:opacity-95 text-white px-4 py-2 rounded-xl shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus size={14} /> Create Order
          </button>
        </div>
      </div>

      {/* Row 1: 6 Pastel KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpiCards.map((card) => {
          const Icon = card.Icon
          const isSelected = statusFilter === card.id && card.id !== 'all'
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                setStatusFilter(card.id)
                setPage(1)
              }}
              className={`text-left rounded-2xl border p-3.5 shadow-2xs flex items-start gap-3 transition cursor-pointer ${card.cardCls} ${
                isSelected ? 'ring-2 ring-[#5B21B6]/50' : 'hover:border-[#C4B5FD]'
              }`}
            >
              <span
                className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${card.iconCls}`}
              >
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-[#6B7280] truncate">
                  {card.label}
                </p>
                <p className="font-display font-bold text-[20px] text-[#111827] leading-tight mt-0.5 tabular-nums">
                  {card.count}
                </p>
                <p className={`text-[11px] font-medium mt-0.5 tabular-nums ${card.subCls}`}>
                  {card.sub}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Full-Width Orders Table Card */}
      <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-2xs overflow-hidden">
        {/* Underline Tab Bar */}
        <div className="px-4 pt-1 border-b border-[#EAECF0] flex items-center gap-5 overflow-x-auto text-[12.5px]">
          {[
            { id: 'all', label: `All Orders (${counts.all})` },
            { id: 'pending', label: `Pending (${counts.pending})` },
            {
              id: 'processing',
              label: `Processing (${counts.processing + counts.confirmed})`,
            },
            { id: 'shipped', label: `Shipped (${counts.shipped})` },
            { id: 'delivered', label: `Delivered (${counts.delivered})` },
            { id: 'cancelled', label: `Cancelled (${counts.cancelled})` },
          ].map((tab) => {
            const active = statusFilter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id)
                  setPage(1)
                }}
                className={`py-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
                  active
                    ? 'border-[#5B21B6] text-[#5B21B6] font-semibold'
                    : 'border-transparent text-[#6B7280] hover:text-[#111827] font-medium'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Search & Dropdown Filters Row */}
        <div className="p-3.5 border-b border-[#EAECF0] flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 flex-1 min-w-[210px]">
            <Search size={14} className="text-[#9CA3AF] shrink-0" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by Order ID, customer, phone or email..."
              className="bg-transparent outline-none text-[12.5px] text-[#111827] placeholder:text-[#9CA3AF] w-full min-w-0"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setPage(1)
                }}
                className="text-[#6B7280] hover:text-[#111827] cursor-pointer"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 bg-white border border-[#E5E7EB] rounded-xl px-2.5 py-2 text-[12px] font-medium text-[#374151]">
            <Calendar size={13} className="text-[#6B7280]" />
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value)
                setPage(1)
              }}
              className="bg-transparent outline-none cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value)
              setPage(1)
            }}
            className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12px] font-medium text-[#374151] outline-none cursor-pointer"
          >
            <option value="all">All Payment</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending / COD</option>
            <option value="initiated">Initiated</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>

          <select
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value)
              setPage(1)
            }}
            className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12px] font-medium text-[#374151] outline-none cursor-pointer"
          >
            <option value="all">All Channels</option>
            <option value="razorpay">Razorpay Online</option>
            <option value="cod">Cash on Delivery</option>
            <option value="manual">Admin Manual</option>
          </select>

          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-medium cursor-pointer transition ${
              showMoreFilters
                ? 'border-[#5B21B6] bg-[#F5F3FF] text-[#5B21B6]'
                : 'border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#374151]'
            }`}
          >
            <SlidersHorizontal size={13} /> More Filters
          </button>
        </div>

        {showMoreFilters && (
          <div className="px-4 py-2.5 bg-[#F9FAFB] border-b border-[#EAECF0] flex flex-wrap items-center gap-2.5 text-[12px]">
            {dateFilter === 'custom' && (
              <>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => {
                    setCustomFrom(e.target.value)
                    setPage(1)
                  }}
                  className="bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1 outline-none"
                />
                <span className="text-[#6B7280]">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => {
                    setCustomTo(e.target.value)
                    setPage(1)
                  }}
                  className="bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1 outline-none"
                />
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
                setPaymentFilter('all')
                setChannelFilter('all')
                setDateFilter('all')
                setCustomFrom('')
                setCustomTo('')
                setPage(1)
              }}
              className="text-[12px] font-semibold text-[#5B21B6] hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="px-4 py-2 bg-[#F5F3FF] border-b border-[#EDE9FE] flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <span className="font-semibold text-[#5B21B6] tabular-nums">
              {selectedIds.length} order{selectedIds.length === 1 ? '' : 's'} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => handleBulkStatus('processing')}
                className="px-2.5 py-1 bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] rounded-lg font-semibold text-[#111827] cursor-pointer"
              >
                Mark Processing
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => handleBulkStatus('shipped')}
                className="px-2.5 py-1 bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] rounded-lg font-semibold text-[#111827] cursor-pointer"
              >
                Mark Shipped
              </button>
              <button
                type="button"
                onClick={() => handleExportCsv(true)}
                className="px-2.5 py-1 bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] rounded-lg font-semibold text-[#111827] cursor-pointer"
              >
                Export Selected
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-2 py-1 text-[#6B7280] hover:text-[#111827] font-semibold cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Orders Table */}
        {pagedOrders.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="font-display font-bold text-[15px] text-[#111827]">
              No orders match your filter
            </p>
            <p className="text-[12.5px] text-[#6B7280]">
              Try resetting filters or create a manual order.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-2 inline-flex items-center gap-1.5 bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] text-white text-[12.5px] font-semibold px-4 py-2 rounded-xl cursor-pointer"
            >
              <Plus size={13} /> Create Order
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px] border-collapse">
              <thead className="bg-[#F9FAFB] text-[#6B7280] font-medium border-b border-[#EAECF0]">
                <tr>
                  <th className="w-10 py-3 pl-4 pr-2">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all visible orders"
                      className="rounded border-[#D1D5DB] accent-[#5B21B6] cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-2.5 font-medium">Order ID</th>
                  <th className="py-3 px-2.5 font-medium">
                    <button
                      type="button"
                      onClick={() =>
                        setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
                      }
                      className="inline-flex items-center gap-1 font-medium text-[#6B7280] hover:text-[#111827] cursor-pointer"
                    >
                      Date
                      {sortDir === 'desc' ? (
                        <ArrowDown size={12} />
                      ) : (
                        <ArrowUp size={12} />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-2.5 font-medium">Customer</th>
                  <th className="py-3 px-2.5 font-medium">Items</th>
                  <th className="py-3 px-2.5 font-medium">Amount</th>
                  <th className="py-3 px-2.5 font-medium">Payment</th>
                  <th className="py-3 px-2.5 font-medium">Status</th>
                  <th className="py-3 px-2.5 font-medium">Fulfillment</th>
                  <th className="py-3 pl-2.5 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#EAECF0]">
                {pagedOrders.map((order) => {
                  const stKey = getOrderStatus(order)
                  const dt = formatDateLine(order.placedAt)
                  const isChecked = selectedIds.includes(order.id)
                  const firstItems = (order.items || []).slice(0, 2)
                  const extraItemsCount = Math.max(0, (order.items || []).length - 2)

                  return (
                    <tr
                      key={order.id}
                      onClick={() => onOpenOrder?.(order.id)}
                      className="cursor-pointer transition-colors hover:bg-[#F9FAFB]"
                    >
                      <td
                        className="py-3 pl-4 pr-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(order.id)}
                          aria-label={`Select order ${order.id}`}
                          className="rounded border-[#D1D5DB] accent-[#5B21B6] cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-2.5 font-mono font-bold text-[#5B21B6] whitespace-nowrap">
                        #{order.id}
                      </td>

                      <td className="py-3 px-2.5 whitespace-nowrap leading-tight">
                        <span className="font-medium text-[#111827] block">
                          {dt.date}
                        </span>
                        <span className="text-[11px] text-[#6B7280] tabular-nums">
                          {dt.time}
                        </span>
                      </td>

                      <td className="py-3 px-2.5 whitespace-nowrap leading-tight">
                        <span className="font-semibold text-[#111827] block">
                          {order.customerName}
                        </span>
                        <span className="text-[11px] text-[#6B7280] font-mono">
                          {order.phone || order.customerEmail || 'Guest'}
                        </span>
                      </td>

                      <td className="py-3 px-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {firstItems.map((it, idx) => (
                            <Img
                              key={`${it.id}-${idx}`}
                              src={it.image}
                              alt={it.name}
                              className="w-8 h-8 rounded-lg object-cover border border-[#EAECF0] bg-[#F9FAFB] shrink-0"
                            />
                          ))}
                          {extraItemsCount > 0 && (
                            <span className="w-7 h-7 rounded-lg bg-[#F3F4F6] text-[#374151] text-[10.5px] font-bold grid place-items-center shrink-0">
                              +{extraItemsCount}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-2.5 font-bold text-[#111827] tabular-nums whitespace-nowrap">
                        {formatINR(order.total)}
                      </td>

                      <td className="py-3 px-2.5 whitespace-nowrap">
                        <PaymentPill order={order} />
                      </td>

                      <td className="py-3 px-2.5 whitespace-nowrap">
                        <OrderStatusPill statusKey={stKey} />
                      </td>

                      <td className="py-3 px-2.5 whitespace-nowrap text-[11.5px] leading-tight">
                        {order.courierPartner || order.trackingNumber ? (
                          <div>
                            <span className="font-semibold text-[#111827] inline-flex items-center gap-1">
                              <Truck size={11} className="text-[#5B21B6]" />
                              {order.courierPartner || 'Courier'}
                            </span>
                            {order.trackingNumber && (
                              <span className="block text-[10.5px] font-mono text-[#6B7280]">
                                AWB: {order.trackingNumber}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#9CA3AF]">—</span>
                        )}
                      </td>

                      <td
                        className="py-3 pl-2.5 pr-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenOrder?.(order.id)}
                            title="Open order page"
                            className="w-7 h-7 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] grid place-items-center text-[#4B5563] cursor-pointer"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenOrder?.(order.id)}
                            title="Manage order"
                            className="w-7 h-7 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] grid place-items-center text-[#4B5563] cursor-pointer"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setInvoiceOrder(order)}
                            title="Print invoice"
                            className="w-7 h-7 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] grid place-items-center text-[#4B5563] cursor-pointer"
                          >
                            <Printer size={13} />
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

        {/* Purple Pagination Footer */}
        <div className="px-4 py-3 border-t border-[#EAECF0] bg-white flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#6B7280]">
          <span>
            Showing{' '}
            <strong className="text-[#111827] tabular-nums">
              {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
              {Math.min(safePage * pageSize, filtered.length)}
            </strong>{' '}
            of <strong className="text-[#111827] tabular-nums">{filtered.length}</strong> orders
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="w-8 h-8 rounded-lg border border-[#E5E7EB] bg-white disabled:opacity-40 grid place-items-center text-[#4B5563] hover:bg-[#F9FAFB] cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(
              (pg) => (
                <button
                  key={pg}
                  type="button"
                  onClick={() => setPage(pg)}
                  className={`w-8 h-8 rounded-lg text-[12px] font-semibold tabular-nums transition cursor-pointer ${
                    safePage === pg
                      ? 'bg-[#6D28D9] text-white shadow-2xs'
                      : 'border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {pg}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="w-8 h-8 rounded-lg border border-[#E5E7EB] bg-white disabled:opacity-40 grid place-items-center text-[#4B5563] hover:bg-[#F9FAFB] cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {modalsJsx}
    </div>
  )
}
