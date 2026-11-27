import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Box,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  PauseCircle,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react'
import Img from '../Img'
import InlineStockControl from './InlineStockControl'
import { formatINR } from '../../store/shop'
import { matchesSearch } from '../../lib/search'

function createEmptyProduct(defaultCategory = 'beard') {
  return {
    id: '',
    sku: '',
    brand: 'HARBAN',
    name: '',
    tagline: '',
    category: defaultCategory,
    price: 1299,
    mrp: 1999,
    stock: 25,
    image: '/images/product-ht100.jpg',
    images: ['/images/product-ht100.jpg'],
    badge: '',
    short: '',
    description: '',
    features: [],
    specs: [],
    variants: [],
    meeshoUrl: '',
    isActive: true,
    isFeatured: false,
  }
}

export default function AdminProductsSection({
  mode = 'all',
  products = [],
  categories = [],
  lowStockThreshold = 5,
  onSaveProduct,
  onQuickUpdateProduct,
  onUpdateStock,
  onDeleteProduct,
  onUploadImage,
  onReload,
  pushToast,
  selectedProductId = null,
  onOpenProduct,
  onStartNewProduct,
  onCloseProduct,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('default')
  const [selectedIds, setSelectedIds] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)

  const [form, setForm] = useState(() =>
    createEmptyProduct(categories[0]?.id || 'beard'),
  )
  const [formError, setFormError] = useState('')
  const [newImageUrl, setNewImageUrl] = useState('')
  const [newFeature, setNewFeature] = useState('')
  const [uploadingImages, setUploadingImages] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Quick Price & Stock Modal
  const [quickTarget, setQuickTarget] = useState(null)
  const [quickForm, setQuickForm] = useState({
    price: 0,
    mrp: 0,
    stock: 0,
    variants: [],
  })
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickError, setQuickError] = useState('')

  // Product Preview Before Publishing
  const [previewProduct, setPreviewProduct] = useState(null)
  const [previewImgIdx, setPreviewImgIdx] = useState(0)
  const [previewVariantIdx, setPreviewVariantIdx] = useState(0)

  const isCreateMode = mode === 'add'
  const isDetailView = isCreateMode || Boolean(selectedProductId)
  const loadedKeyRef = useRef('')

  const activeCatalogProduct = useMemo(() => {
    if (!selectedProductId) return null
    return products.find((p) => p.id === selectedProductId) || null
  }, [products, selectedProductId])

  useEffect(() => {
    if (isCreateMode) {
      if (loadedKeyRef.current !== 'new') {
        loadedKeyRef.current = 'new'
        setFormError('')
        setForm(createEmptyProduct(categories[0]?.id || 'beard'))
      }
      return
    }
    if (selectedProductId && activeCatalogProduct) {
      if (loadedKeyRef.current !== activeCatalogProduct.id) {
        loadedKeyRef.current = activeCatalogProduct.id
        const p = activeCatalogProduct
        const gallery =
          Array.isArray(p.images) && p.images.length > 0
            ? p.images
            : [p.image || '/images/product-ht100.jpg']
        setFormError('')
        setForm({
          id: p.id,
          sku: p.sku || '',
          brand: p.brand || 'HARBAN',
          name: p.name,
          tagline: p.tagline || '',
          category: p.category,
          price: p.price,
          mrp: p.mrp,
          stock: typeof p.stock === 'number' ? p.stock : 25,
          image: gallery[0],
          images: gallery,
          badge: p.badge || '',
          short: p.short || '',
          description: p.description || '',
          features: Array.isArray(p.features) ? p.features : [],
          specs: Array.isArray(p.specs)
            ? p.specs.filter((s) => String(s.label || '').toLowerCase() !== 'brand')
            : [],
          variants: Array.isArray(p.variants) ? p.variants : [],
          meeshoUrl: p.meeshoUrl || '',
          isActive: p.isActive !== false,
          isFeatured: Boolean(p.isFeatured),
        })
      }
      return
    }
    if (!selectedProductId && !isCreateMode) {
      loadedKeyRef.current = ''
    }
  }, [isCreateMode, selectedProductId, activeCatalogProduct, categories])

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.label])),
    [categories],
  )

  const brandOptions = useMemo(() => {
    const set = new Set()
    for (const p of products) {
      set.add((p.brand || 'HARBAN').trim())
    }
    return Array.from(set).sort()
  }, [products])

  const stats = useMemo(() => {
    const active = products.filter((p) => p.isActive !== false).length
    const draft = products.filter((p) => p.isActive === false).length
    const outOfStock = products.filter((p) => (p.stock ?? 0) === 0).length
    const lowStock = products.filter(
      (p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= lowStockThreshold,
    ).length
    const featured = products.filter((p) => p.isFeatured).length
    return {
      total: products.length,
      active,
      draft,
      lowStock,
      outOfStock,
      featured,
    }
  }, [products, lowStockThreshold])

  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false
      if (brandFilter !== 'all' && (p.brand || 'HARBAN') !== brandFilter)
        return false
      if (statusFilter === 'active' && p.isActive === false) return false
      if (statusFilter === 'disabled' && p.isActive !== false) return false
      if (statusFilter === 'featured' && !p.isFeatured) return false
      if (
        statusFilter === 'low_stock' &&
        ((p.stock ?? 0) === 0 || (p.stock ?? 0) > lowStockThreshold)
      ) {
        return false
      }
      if (statusFilter === 'out_of_stock' && (p.stock ?? 0) !== 0) return false
      if (mode === 'variants' && (!p.variants || p.variants.length === 0)) {
        return false
      }
      if (!searchQuery.trim()) return true
      return matchesSearch(
        searchQuery,
        p.name,
        p.id,
        p.sku,
        p.brand,
        p.category,
        categoryMap.get(p.category),
        p.tagline,
        p.short,
        p.description,
        p.badge,
        p.price,
        p.variants,
      )
    })

    if (sortBy === 'name_asc') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name))
    }
    if (sortBy === 'price_asc') {
      return [...list].sort((a, b) => Number(a.price) - Number(b.price))
    }
    if (sortBy === 'price_desc') {
      return [...list].sort((a, b) => Number(b.price) - Number(a.price))
    }
    if (sortBy === 'stock_asc') {
      return [...list].sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    }
    if (sortBy === 'stock_desc') {
      return [...list].sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0))
    }
    return list
  }, [
    products,
    searchQuery,
    categoryFilter,
    brandFilter,
    statusFilter,
    sortBy,
    lowStockThreshold,
    categoryMap,
    mode,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedProducts = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, safePage, pageSize])

  const allVisibleSelected =
    pagedProducts.length > 0 &&
    pagedProducts.every((p) => selectedIds.includes(p.id))

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(pagedProducts.map((p) => p.id))
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)))
    } else {
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...pagedProducts.map((p) => p.id)])),
      )
    }
  }

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const openQuickModal = (p) => {
    setQuickTarget(p)
    setQuickError('')
    setQuickForm({
      price: Number(p.price) || 0,
      mrp: Number(p.mrp) || 0,
      stock: Number(p.stock ?? 0),
      variants: Array.isArray(p.variants)
        ? p.variants.map((v) => ({ ...v }))
        : [],
    })
  }

  const handleQuickModalSave = async (e) => {
    e.preventDefault()
    if (!quickTarget || quickSaving) return
    if (
      Number(quickForm.price) < 0 ||
      Number(quickForm.mrp) < Number(quickForm.price)
    ) {
      setQuickError('MRP must be greater than or equal to selling price.')
      return
    }
    setQuickSaving(true)
    setQuickError('')
    try {
      await onQuickUpdateProduct(quickTarget.id, {
        price: Number(quickForm.price),
        mrp: Number(quickForm.mrp),
        stock: Math.max(0, Math.floor(Number(quickForm.stock) || 0)),
        variants: quickForm.variants.map((v) => ({
          ...v,
          price: Number(v.price) || Number(quickForm.price),
          mrp: Number(v.mrp) || Number(quickForm.mrp),
          stock: Math.max(0, Math.floor(Number(v.stock) || 0)),
        })),
      })
      pushToast(`Updated price & stock for ${quickTarget.name}`)
      setQuickTarget(null)
      await onReload()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Quick update failed'
      setQuickError(msg)
      pushToast(msg)
    } finally {
      setQuickSaving(false)
    }
  }

  const handleMultiImageUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploadingImages(true)
    setFormError('')
    const uploadedUrls = []
    try {
      for (const file of files) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
          reader.readAsDataURL(file)
        })
        const url = await onUploadImage({
          filename: file.name,
          mimeType: file.type || 'image/jpeg',
          dataBase64: dataUrl,
        })
        uploadedUrls.push(url)
      }
      if (uploadedUrls.length > 0) {
        setForm((prev) => {
          const nextImages = Array.from(
            new Set([...(prev.images || []), ...uploadedUrls]),
          )
          return {
            ...prev,
            images: nextImages,
            image: nextImages[0] || prev.image,
          }
        })
        pushToast(
          `${uploadedUrls.length} image${uploadedUrls.length === 1 ? '' : 's'} uploaded`,
        )
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Storage upload failed — verify product-images bucket.'
      setFormError(msg)
      pushToast(msg)
    } finally {
      setUploadingImages(false)
      e.target.value = ''
    }
  }

  const addImageByUrl = () => {
    const clean = newImageUrl.trim()
    if (!clean) return
    setForm((prev) => {
      const next = Array.from(new Set([...(prev.images || []), clean]))
      return { ...prev, images: next, image: next[0] || clean }
    })
    setNewImageUrl('')
  }

  const moveImage = (idx, dir) => {
    setForm((prev) => {
      const next = [...(prev.images || [])]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      const [item] = next.splice(idx, 1)
      next.splice(target, 0, item)
      return { ...prev, images: next, image: next[0] || prev.image }
    })
  }

  const removeImage = (idx) => {
    setForm((prev) => {
      const next = (prev.images || []).filter((_, i) => i !== idx)
      return {
        ...prev,
        images: next,
        image: next[0] || '/images/product-ht100.jpg',
      }
    })
  }

  const addVariantRow = () => {
    setForm((prev) => ({
      ...prev,
      variants: [
        ...(prev.variants || []),
        {
          sku: prev.sku ? `${prev.sku}-V${(prev.variants?.length || 0) + 1}` : '',
          size: '',
          color: '',
          price: Number(prev.price) || 0,
          mrp: Number(prev.mrp) || 0,
          stock: Number(prev.stock) || 10,
          isActive: true,
        },
      ],
    }))
  }

  const updateVariantField = (idx, key, val) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => (i === idx ? { ...v, [key]: val } : v)),
    }))
  }

  const removeVariantRow = (idx) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== idx),
    }))
  }

  const buildSanitizedPayload = () => {
    const slug =
      form.id.trim() ||
      form.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    const gallery =
      form.images && form.images.length > 0
        ? form.images
        : [form.image || '/images/product-ht100.jpg']
    return {
      ...form,
      id: slug,
      brand: form.brand?.trim() || 'HARBAN',
      price: Number(form.price) || 0,
      mrp: Number(form.mrp) || 0,
      stock: Math.max(0, Math.floor(Number(form.stock) || 0)),
      image: gallery[0],
      images: gallery,
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    if (Number(form.price) < 0 || Number(form.mrp) < Number(form.price)) {
      setFormError('MRP must be greater than or equal to selling price.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const payload = buildSanitizedPayload()
      await onSaveProduct(payload)
      pushToast(`Saved product: ${payload.name}`)
      await onReload()
      loadedKeyRef.current = ''
      if (isCreateMode && onOpenProduct) {
        onOpenProduct(payload.id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save product'
      setFormError(msg)
      pushToast(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleFlag = async (p, field) => {
    try {
      await onQuickUpdateProduct(p.id, { [field]: !p[field] })
      pushToast(
        `${p.name} marked as ${
          field === 'isActive'
            ? !p.isActive
              ? 'Active'
              : 'Draft'
            : !p.isFeatured
              ? 'Featured'
              : 'Standard'
        }`,
      )
      await onReload()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Update failed')
    }
  }

  const handleQuickStock = async (p, nextStock) => {
    try {
      await onUpdateStock(p.id, Math.max(0, nextStock))
      await onReload()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Stock update failed')
    }
  }

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return
    const deletingId = confirmDelete.id
    try {
      await onDeleteProduct(deletingId)
      setConfirmDelete(null)
      await onReload()
      if (selectedProductId === deletingId) {
        onCloseProduct?.()
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Delete failed')
      setConfirmDelete(null)
    }
  }

  const marginPct =
    Number(form.mrp) > 0 && Number(form.mrp) >= Number(form.price)
      ? Math.round(((Number(form.mrp) - Number(form.price)) / Number(form.mrp)) * 100)
      : 0

  const applyDiscountPercent = (pct) => {
    const clean = Math.max(0, Math.min(95, Number(pct) || 0))
    const mrpVal = Number(form.mrp) || 0
    if (mrpVal <= 0) return
    const nextPrice = Math.max(0, Math.round(mrpVal * (1 - clean / 100)))
    setForm((p) => ({ ...p, price: nextPrice }))
  }

  const openPreview = () => {
    setPreviewImgIdx(0)
    setPreviewVariantIdx(0)
    setPreviewProduct(buildSanitizedPayload())
  }

  const openSavedPreview = (p) => {
    const gallery =
      Array.isArray(p.images) && p.images.length > 0
        ? p.images
        : [p.image || '/images/product-ht100.jpg']
    setPreviewImgIdx(0)
    setPreviewVariantIdx(0)
    setPreviewProduct({
      ...p,
      images: gallery,
      variants: Array.isArray(p.variants) ? p.variants : [],
      features: Array.isArray(p.features) ? p.features : [],
    })
  }

  const handleExportCsv = () => {
    const header = [
      'ID',
      'SKU',
      'Name',
      'Status',
      'Stock',
      'Category',
      'PriceINR',
      'MRP',
      'Brand',
    ]
    const rows = filteredProducts.map((p) => [
      p.id,
      p.sku || '',
      p.name,
      p.isActive !== false ? 'Active' : 'Draft',
      p.stock ?? 0,
      categoryMap.get(p.category) || p.category,
      p.price,
      p.mrp,
      p.brand || 'HARBAN',
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
    link.download = `HARBAN-Products-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    pushToast(`Exported ${filteredProducts.length} product(s)`)
  }

  const sharedModals = (
    <>
      {quickTarget && (
        <div className="fixed inset-0 z-[82] grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setQuickTarget(null)}
          />
          <form
            onSubmit={handleQuickModalSave}
            className="relative bg-white rounded-2xl border border-[#EAECF0] max-w-lg w-full p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-[16px] text-[#111827]">
                  Quick Update Price &amp; Stock
                </h3>
                <p className="text-[12px] text-[#6B7280]">
                  {quickTarget.name} ·{' '}
                  <span className="font-mono">{quickTarget.sku || quickTarget.id}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickTarget(null)}
                className="p-1 text-[#6B7280] hover:text-[#111827] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {quickError && (
              <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-[12px] font-semibold px-3 py-2 rounded-xl">
                {quickError}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                  Selling Price (INR)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  value={quickForm.price}
                  onChange={(e) =>
                    setQuickForm((q) => ({ ...q, price: Number(e.target.value) }))
                  }
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[13px] tabular-nums outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                  MRP (INR)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  value={quickForm.mrp}
                  onChange={(e) =>
                    setQuickForm((q) => ({ ...q, mrp: Number(e.target.value) }))
                  }
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[13px] tabular-nums outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                  Stock Qty
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  value={quickForm.stock}
                  onChange={(e) =>
                    setQuickForm((q) => ({ ...q, stock: Number(e.target.value) }))
                  }
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[13px] tabular-nums outline-none"
                />
              </div>
            </div>

            {quickForm.variants.length > 0 && (
              <div className="space-y-2 border-t border-[#EAECF0] pt-3">
                <p className="text-[11.5px] font-bold text-[#111827]">
                  Variant Stock &amp; Pricing ({quickForm.variants.length})
                </p>
                <div className="max-h-44 overflow-y-auto space-y-1.5">
                  {quickForm.variants.map((v, idx) => (
                    <div
                      key={v.id || idx}
                      className="grid grid-cols-[1.5fr_1fr_1fr] gap-2 items-center bg-[#F9FAFB] px-2.5 py-1.5 rounded-xl text-[12px]"
                    >
                      <span className="font-semibold truncate">
                        {[v.size, v.color].filter(Boolean).join(' / ') ||
                          v.sku ||
                          `Variant ${idx + 1}`}
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={v.price ?? quickForm.price}
                        onChange={(e) =>
                          setQuickForm((q) => ({
                            ...q,
                            variants: q.variants.map((row, i) =>
                              i === idx ? { ...row, price: Number(e.target.value) } : row,
                            ),
                          }))
                        }
                        className="bg-white border border-[#E5E7EB] rounded-lg px-2 py-1 tabular-nums outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        value={v.stock ?? 0}
                        onChange={(e) =>
                          setQuickForm((q) => ({
                            ...q,
                            variants: q.variants.map((row, i) =>
                              i === idx ? { ...row, stock: Number(e.target.value) } : row,
                            ),
                          }))
                        }
                        className="bg-white border border-[#E5E7EB] rounded-lg px-2 py-1 tabular-nums outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickTarget(null)}
                className="px-4 py-2 text-[12.5px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={quickSaving}
                className="px-4 py-2 text-[12.5px] font-semibold bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] disabled:opacity-50 text-white rounded-xl cursor-pointer"
              >
                {quickSaving ? 'Updating...' : 'Save Price & Stock'}
              </button>
            </div>
          </form>
        </div>
      )}

      {previewProduct && (
        <div className="fixed inset-0 z-[85] grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-xs"
            onClick={() => setPreviewProduct(null)}
          />
          <div className="relative bg-white rounded-2xl border border-[#EAECF0] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EAECF0] pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#5B21B6]">
                  Storefront Pre-Publish Preview
                </p>
                <h3 className="font-display font-bold text-[17px] text-[#111827]">
                  {previewProduct.name || 'Untitled Product'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProduct(null)}
                className="p-1.5 rounded-lg hover:bg-[#F3F4F6] text-[#6B7280] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid sm:grid-cols-[1fr_1.15fr] gap-5">
              <div className="space-y-2.5">
                <div className="aspect-square rounded-2xl overflow-hidden bg-[#F9FAFB] border border-[#EAECF0] relative">
                  <Img
                    src={
                      previewProduct.images[previewImgIdx] || previewProduct.image
                    }
                    alt={previewProduct.name}
                    className="w-full h-full object-cover"
                  />
                  {previewProduct.badge && (
                    <span className="absolute top-3 left-3 bg-[#111827] text-white text-[10.5px] font-bold uppercase tracking-wide px-2.5 py-1 rounded">
                      {previewProduct.badge}
                    </span>
                  )}
                </div>
                {previewProduct.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {previewProduct.images.map((src, idx) => (
                      <button
                        key={`${src}-${idx}`}
                        type="button"
                        onClick={() => setPreviewImgIdx(idx)}
                        className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer ${
                          previewImgIdx === idx
                            ? 'border-[#5B21B6]'
                            : 'border-[#EAECF0]'
                        }`}
                      >
                        <Img src={src} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11.5px] font-bold text-[#5B21B6]">
                  <span>{previewProduct.brand || 'HARBAN'}</span>
                  <span className="text-[#D1D5DB]">·</span>
                  <span>
                    {categoryMap.get(previewProduct.category) ||
                      previewProduct.category}
                  </span>
                </div>

                <h4 className="font-display font-bold text-[20px] text-[#111827] leading-tight">
                  {previewProduct.name || 'Product Name'}
                </h4>

                {previewProduct.tagline && (
                  <p className="text-[13px] text-[#6B7280]">{previewProduct.tagline}</p>
                )}

                <div className="flex items-baseline gap-2.5">
                  <span className="font-display font-bold text-[22px] text-[#111827] tabular-nums">
                    {formatINR(previewProduct.price)}
                  </span>
                  {previewProduct.mrp > previewProduct.price && (
                    <>
                      <span className="text-[14px] text-[#9CA3AF] line-through tabular-nums">
                        {formatINR(previewProduct.mrp)}
                      </span>
                      <span className="text-[12px] font-bold text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-md">
                        {Math.round(
                          ((previewProduct.mrp - previewProduct.price) /
                            previewProduct.mrp) *
                            100,
                        )}
                        % OFF
                      </span>
                    </>
                  )}
                </div>

                <p className="text-[12px] font-semibold text-[#6B7280]">
                  Availability:{' '}
                  <span
                    className={
                      previewProduct.stock === 0
                        ? 'text-[#E11D48]'
                        : 'text-[#15803D]'
                    }
                  >
                    {previewProduct.stock === 0
                      ? 'Out of Stock'
                      : `In Stock (${previewProduct.stock} units)`}
                  </span>
                </p>

                {previewProduct.variants.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase text-[#6B7280]">
                      Available Options
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {previewProduct.variants.map((v, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPreviewVariantIdx(idx)}
                          className={`px-2.5 py-1 rounded-lg border text-[12px] font-semibold cursor-pointer ${
                            previewVariantIdx === idx
                              ? 'border-[#5B21B6] bg-[#F5F3FF] text-[#5B21B6]'
                              : 'border-[#E5E7EB] text-[#6B7280]'
                          }`}
                        >
                          {[v.size, v.color].filter(Boolean).join(' / ') || v.sku}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {previewProduct.description && (
                  <p className="text-[12.5px] text-[#4B5563] leading-relaxed border-t border-[#EAECF0] pt-2.5">
                    {previewProduct.description}
                  </p>
                )}

                {previewProduct.features.length > 0 && (
                  <ul className="space-y-1 text-[12px] text-[#374151] list-disc pl-4">
                    {previewProduct.features.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="relative bg-white rounded-2xl border border-[#EAECF0] max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-display font-bold text-[16px] text-[#111827]">
              Delete product permanently?
            </h3>
            <p className="text-[13px] text-[#6B7280] leading-relaxed">
              This will permanently remove <strong>{confirmDelete.name}</strong> (
              {confirmDelete.sku || confirmDelete.id}) from your store catalog. Past order history items keep their snapshot.
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
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  /* ------------------------------------- FULL-PAGE PRODUCT DETAIL / CREATE */
  if (isDetailView) {
    if (!isCreateMode && !activeCatalogProduct) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onCloseProduct?.()}
              className="w-9 h-9 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] grid place-items-center text-[#111827] cursor-pointer"
              aria-label="Back to products"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="font-display font-bold text-[20px] text-[#111827]">
              Product not found
            </h1>
          </div>

          <div className="bg-white rounded-2xl border border-[#EAECF0] p-10 text-center space-y-3 shadow-2xs">
            <p className="text-[13px] text-[#6B7280]">
              We couldn&apos;t find product ID <span className="font-mono">{selectedProductId}</span>.
            </p>
            <button
              type="button"
              onClick={() => onCloseProduct?.()}
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] text-white text-[12.5px] font-semibold px-4 py-2 rounded-xl cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to All Products
            </button>
          </div>
          {sharedModals}
        </div>
      )
    }

    const navList = filteredProducts.some((p) => p.id === selectedProductId)
      ? filteredProducts
      : products
    const currIdx = !isCreateMode
      ? navList.findIndex((p) => p.id === selectedProductId)
      : -1
    const prevProd = currIdx > 0 ? navList[currIdx - 1] : null
    const nextProd =
      currIdx >= 0 && currIdx < navList.length - 1 ? navList[currIdx + 1] : null

    return (
      <form onSubmit={handleSave} className="space-y-4">
        {/* Shopify-Style Product Top Bar */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <button
              type="button"
              onClick={() => onCloseProduct?.()}
              title="Back to Products"
              aria-label="Back to Products"
              className="mt-0.5 w-9 h-9 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] grid place-items-center text-[#111827] shadow-2xs shrink-0 cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display font-bold text-[22px] text-[#111827] tracking-tight truncate max-w-[480px]">
                  {isCreateMode ? 'Add Product' : form.name || form.id}
                </h1>
                <span
                  className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${
                    form.isActive
                      ? 'bg-[#DCFCE7] text-[#15803D]'
                      : 'bg-[#F3F4F6] text-[#4B5563]'
                  }`}
                >
                  {form.isActive ? 'Active' : 'Draft'}
                </span>
              </div>
              <p className="text-[12.5px] text-[#6B7280] mt-0.5">
                {isCreateMode
                  ? 'Create a new product listing for the live HARBAN catalog.'
                  : `${form.sku || form.id} · ${categoryMap.get(form.category) || form.category}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openPreview}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#111827] px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer whitespace-nowrap"
            >
              <Eye size={14} className="text-[#4B5563]" /> Preview
            </button>

            {!isCreateMode && activeCatalogProduct && (
              <button
                type="button"
                onClick={() => setConfirmDelete(activeCatalogProduct)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-white border border-[#FECDD3] hover:bg-[#FFF5F6] text-[#E11D48] px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer whitespace-nowrap"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}

            {!isCreateMode && (
              <div className="inline-flex items-center rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-2xs">
                <button
                  type="button"
                  disabled={!prevProd}
                  onClick={() => prevProd && onOpenProduct?.(prevProd.id)}
                  title={prevProd ? `Previous: ${prevProd.name}` : 'First product'}
                  aria-label="Previous product"
                  className="w-9 h-9 grid place-items-center text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer border-r border-[#E5E7EB]"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  disabled={!nextProd}
                  onClick={() => nextProd && onOpenProduct?.(nextProd.id)}
                  title={nextProd ? `Next: ${nextProd.name}` : 'Last product'}
                  aria-label="Next product"
                  className="w-9 h-9 grid place-items-center text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] hover:opacity-95 disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-xl shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              {saving ? 'Saving...' : isCreateMode ? 'Publish Product' : 'Save Changes'}
            </button>
          </div>
        </div>

        {formError && (
          <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-[12.5px] font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Shopify 2-Column Product Workspace */}
        <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
          {/* Left Primary Column */}
          <div className="space-y-4 min-w-0">
            {/* Core Copy Card */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] p-5 space-y-4 shadow-2xs">
              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  Title *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. HARBAN HT-200 Pro Beard Trimmer"
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2.5 text-[14px] font-medium outline-none focus:border-[#5B21B6]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  Short Tagline (Storefront Card Subtitle)
                </label>
                <input
                  value={form.tagline}
                  onChange={(e) => setForm((p) => ({ ...p, tagline: e.target.value }))}
                  placeholder="Zero-gap titanium blades · 90 min USB-C runtime"
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-[13px] outline-none focus:border-[#5B21B6]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Detailed product overview displayed on Product Page & Quick View..."
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-[#5B21B6] resize-none"
                />
              </div>
            </div>

            {/* Media Gallery Card */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] p-5 space-y-3.5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display font-bold text-[14px] text-[#111827]">
                    Media ({form.images?.length || 0})
                  </h2>
                  <p className="text-[11.5px] text-[#6B7280]">
                    First image is the primary storefront thumbnail.
                  </p>
                </div>
                <label className="inline-flex items-center gap-1.5 bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#5B21B6] text-[#111827] text-[12px] font-semibold px-3.5 py-2 rounded-xl cursor-pointer transition">
                  <Upload size={13} />
                  {uploadingImages ? 'Uploading...' : 'Upload Images'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleMultiImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <input
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="Or paste image URL (e.g. /images/product-ht100.jpg or https://...)"
                  className="flex-1 min-w-0 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] outline-none focus:border-[#5B21B6]"
                />
                <button
                  type="button"
                  onClick={addImageByUrl}
                  className="shrink-0 bg-white border border-[#E5E7EB] hover:border-[#5B21B6] text-[#111827] text-[12px] font-semibold px-3.5 py-2 rounded-xl cursor-pointer"
                >
                  Add URL
                </button>
              </div>

              {form.images && form.images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                  {form.images.map((src, idx) => (
                    <div
                      key={`${src}-${idx}`}
                      className={`bg-[#F9FAFB] rounded-xl border p-1.5 space-y-1.5 ${
                        idx === 0 ? 'border-[#5B21B6]' : 'border-[#EAECF0]'
                      }`}
                    >
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-white">
                        <Img
                          src={src}
                          alt={`Gallery ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {idx === 0 && (
                          <span className="absolute top-1 left-1 bg-[#5B21B6] text-white text-[9.5px] font-bold px-1.5 py-0.5 rounded">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveImage(idx, -1)}
                            className="p-1 text-[#6B7280] hover:text-[#111827] disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowLeft size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === form.images.length - 1}
                            onClick={() => moveImage(idx, 1)}
                            className="p-1 text-[#6B7280] hover:text-[#111827] disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowRight size={12} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="p-1 text-[#E11D48] hover:bg-[#FFF5F6] rounded cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pricing Card */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] p-5 space-y-3.5 shadow-2xs">
              <h2 className="font-display font-bold text-[14px] text-[#111827]">
                Pricing
              </h2>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Selling Price (INR)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, price: Number(e.target.value) }))
                    }
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-[13px] tabular-nums outline-none focus:border-[#5B21B6]"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Compare-at / MRP (INR)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.mrp}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, mrp: Number(e.target.value) }))
                    }
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-[13px] tabular-nums outline-none focus:border-[#5B21B6]"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Discount (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="95"
                    value={marginPct}
                    onChange={(e) => applyDiscountPercent(e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-[13px] tabular-nums outline-none focus:border-[#5B21B6]"
                  />
                </div>
              </div>
            </div>

            {/* Inventory & Identifiers Card */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] p-5 space-y-3.5 shadow-2xs">
              <h2 className="font-display font-bold text-[14px] text-[#111827]">
                Inventory &amp; Catalog Identifiers
              </h2>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    SKU (Stock Keeping Unit)
                  </label>
                  <input
                    value={form.sku}
                    onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                    placeholder="HRB-HT200-BLK"
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-[13px] font-mono outline-none focus:border-[#5B21B6]"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Available Quantity
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, stock: Number(e.target.value) }))
                    }
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-[13px] tabular-nums outline-none focus:border-[#5B21B6]"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    URL Handle / Slug
                  </label>
                  <input
                    value={form.id}
                    disabled={!isCreateMode}
                    onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))}
                    placeholder="auto-generated"
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-[13px] font-mono outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  Meesho External Link (Optional)
                </label>
                <input
                  value={form.meeshoUrl}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, meeshoUrl: e.target.value }))
                  }
                  placeholder="https://www.meesho.com/..."
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-[13px] outline-none focus:border-[#5B21B6]"
                />
              </div>
            </div>

            {/* Variants Builder Card */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display font-bold text-[14px] text-[#111827]">
                    Variants ({form.variants?.length || 0})
                  </h2>
                  <p className="text-[11.5px] text-[#6B7280]">
                    Add size, color or edition options with independent SKU, pricing &amp; stock.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addVariantRow}
                  className="inline-flex items-center gap-1 bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#5B21B6] text-[12px] font-semibold px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  <Plus size={13} /> Add Variant
                </button>
              </div>

              {form.variants && form.variants.length > 0 && (
                <div className="space-y-2">
                  {form.variants.map((v, idx) => (
                    <div
                      key={`variant-${idx}`}
                      className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-[#F9FAFB] p-2.5 rounded-xl border border-[#EAECF0] items-center"
                    >
                      <input
                        value={v.size || ''}
                        onChange={(e) => updateVariantField(idx, 'size', e.target.value)}
                        placeholder="Size / Edition"
                        className="bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[12px] outline-none"
                      />
                      <input
                        value={v.color || ''}
                        onChange={(e) => updateVariantField(idx, 'color', e.target.value)}
                        placeholder="Color"
                        className="bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[12px] outline-none"
                      />
                      <input
                        value={v.sku || ''}
                        onChange={(e) => updateVariantField(idx, 'sku', e.target.value)}
                        placeholder="Variant SKU"
                        className="bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[12px] font-mono outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        value={v.price ?? form.price}
                        onChange={(e) =>
                          updateVariantField(idx, 'price', Number(e.target.value))
                        }
                        placeholder="Price"
                        className="bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[12px] tabular-nums outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        value={v.stock ?? 0}
                        onChange={(e) =>
                          updateVariantField(idx, 'stock', Number(e.target.value))
                        }
                        placeholder="Stock"
                        className="bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[12px] tabular-nums outline-none"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <label className="text-[11px] font-semibold flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={v.isActive !== false}
                            onChange={(e) =>
                              updateVariantField(idx, 'isActive', e.target.checked)
                            }
                            className="accent-[#5B21B6]"
                          />
                          Active
                        </label>
                        <button
                          type="button"
                          onClick={() => removeVariantRow(idx)}
                          className="text-[#E11D48] hover:bg-[#FFF5F6] p-1 rounded cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Key Highlights & Technical Specs */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-[#EAECF0] p-5 space-y-2.5 shadow-2xs">
                <h2 className="font-display font-bold text-[13.5px] text-[#111827]">
                  Key Highlights ({form.features?.length || 0})
                </h2>
                <div className="flex gap-2">
                  <input
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    placeholder="Add highlight bullet..."
                    className="flex-1 min-w-0 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-[12.5px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newFeature.trim()) return
                      setForm((p) => ({
                        ...p,
                        features: [...(p.features || []), newFeature.trim()],
                      }))
                      setNewFeature('')
                    }}
                    className="bg-[#111827] text-white text-[12px] font-semibold px-3 rounded-xl cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {(form.features || []).map((f, idx) => (
                    <div
                      key={`${f}-${idx}`}
                      className="flex items-center justify-between gap-2 text-[12px] bg-[#F9FAFB] px-2.5 py-1.5 rounded-lg"
                    >
                      <span className="truncate">{f}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            features: p.features.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-[#E11D48] shrink-0 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#EAECF0] p-5 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-[13.5px] text-[#111827]">
                    Specifications ({form.specs?.length || 0})
                  </h2>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        specs: [...(p.specs || []), { label: '', value: '' }],
                      }))
                    }
                    className="text-[11.5px] font-semibold text-[#5B21B6] hover:underline cursor-pointer"
                  >
                    + Add Spec Row
                  </button>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {(form.specs || []).map((s, idx) => (
                    <div key={`spec-${idx}`} className="flex items-center gap-1.5">
                      <input
                        value={s.label}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            specs: p.specs.map((row, i) =>
                              i === idx ? { ...row, label: e.target.value } : row,
                            ),
                          }))
                        }
                        placeholder="Label (e.g. Battery)"
                        className="w-1/2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[12px] outline-none"
                      />
                      <input
                        value={s.value}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            specs: p.specs.map((row, i) =>
                              i === idx ? { ...row, value: e.target.value } : row,
                            ),
                          }))
                        }
                        placeholder="Value (e.g. 90 mins)"
                        className="w-1/2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[12px] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            specs: p.specs.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-[#E11D48] p-1 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Organization & Publishing Sidebar */}
          <aside className="space-y-4">
            {/* Publishing Status Card */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] p-4 space-y-3 shadow-2xs">
              <h3 className="font-display font-bold text-[13.5px] text-[#111827]">
                Status &amp; Visibility
              </h3>
              <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F9FAFB] border border-[#EAECF0] text-[12.5px] font-semibold text-[#111827] cursor-pointer">
                <span>Enabled on Storefront</span>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, isActive: e.target.checked }))
                  }
                  className="accent-[#5B21B6]"
                />
              </label>
              <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F9FAFB] border border-[#EAECF0] text-[12.5px] font-semibold text-[#111827] cursor-pointer">
                <span>Featured Product</span>
                <input
                  type="checkbox"
                  checked={Boolean(form.isFeatured)}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, isFeatured: e.target.checked }))
                  }
                  className="accent-[#5B21B6]"
                />
              </label>
            </div>

            {/* Product Organization Card */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] p-4 space-y-3 shadow-2xs">
              <h3 className="font-display font-bold text-[13.5px] text-[#111827]">
                Product Organization
              </h3>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  Category *
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  Brand / Vendor *
                </label>
                <input
                  required
                  value={form.brand}
                  onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                  placeholder="HARBAN"
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                  Storefront Badge
                </label>
                <input
                  value={form.badge}
                  onChange={(e) => setForm((p) => ({ ...p, badge: e.target.value }))}
                  placeholder="Bestseller / New"
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12.5px] outline-none"
                />
              </div>
            </div>

            {/* Storefront Snapshot Preview Card */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-[13.5px] text-[#111827]">
                  Storefront Snapshot
                </h3>
                <button
                  type="button"
                  onClick={openPreview}
                  className="text-[11.5px] font-semibold text-[#5B21B6] hover:underline cursor-pointer"
                >
                  Full Preview
                </button>
              </div>
              <div className="aspect-square rounded-xl overflow-hidden bg-[#F9FAFB] border border-[#EAECF0]">
                <Img
                  src={form.images?.[0] || form.image}
                  alt={form.name || 'Product preview'}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#5B21B6]">
                  {form.brand || 'HARBAN'} ·{' '}
                  {categoryMap.get(form.category) || form.category}
                </p>
                <p className="font-display font-bold text-[14px] text-[#111827] mt-0.5 truncate">
                  {form.name || 'Untitled Product'}
                </p>
                <div className="flex items-baseline gap-2 mt-1 tabular-nums">
                  <span className="font-bold text-[15px] text-[#111827]">
                    {formatINR(form.price)}
                  </span>
                  {Number(form.mrp) > Number(form.price) && (
                    <>
                      <span className="text-[12px] text-[#9CA3AF] line-through">
                        {formatINR(form.mrp)}
                      </span>
                      <span className="text-[11px] font-bold text-[#15803D]">
                        {marginPct}% OFF
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {sharedModals}
      </form>
    )
  }

  const kpiCards = [
    {
      id: 'all',
      label: 'Total Products',
      count: stats.total,
      sub: `${brandOptions.length} active brand${brandOptions.length === 1 ? '' : 's'}`,
      subCls: 'text-[#15803D]',
      cardCls: 'bg-white border-[#EAECF0]',
      iconCls: 'bg-[#F3E8FF] text-[#6D28D9]',
      Icon: Box,
    },
    {
      id: 'active',
      label: 'Active Products',
      count: stats.active,
      sub: 'Live on storefront',
      subCls: 'text-[#15803D]',
      cardCls: 'bg-[#F0FDF4] border-[#DCFCE7]',
      iconCls: 'bg-[#DCFCE7] text-[#16A34A]',
      Icon: CheckCircle2,
    },
    {
      id: 'disabled',
      label: 'Draft Products',
      count: stats.draft,
      sub: 'Hidden from store',
      subCls: 'text-[#6B7280]',
      cardCls: 'bg-[#FFFBEB] border-[#FEF3C7]',
      iconCls: 'bg-[#FEF3C7] text-[#D97706]',
      Icon: PauseCircle,
    },
    {
      id: 'out_of_stock',
      label: 'Out of Stock',
      count: stats.outOfStock,
      sub: stats.outOfStock > 0 ? 'Restock needed' : 'All stocked',
      subCls: stats.outOfStock > 0 ? 'text-[#E11D48]' : 'text-[#6B7280]',
      cardCls: 'bg-[#FFF5F6] border-[#FFE4E6]',
      iconCls: 'bg-[#FFE4E6] text-[#E11D48]',
      Icon: XCircle,
    },
    {
      id: 'low_stock',
      label: 'Low Stock',
      count: stats.lowStock,
      sub: `Threshold ≤ ${lowStockThreshold}`,
      subCls: 'text-[#0284C7]',
      cardCls: 'bg-[#EFF6FF] border-[#DBEAFE]',
      iconCls: 'bg-[#DBEAFE] text-[#0284C7]',
      Icon: Tag,
    },
  ]

  /* -------------------------------------------- FULL-WIDTH PRODUCTS TABLE */
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[22px] text-[#111827] tracking-tight leading-tight">
            {mode === 'variants' ? 'Product Variants' : 'Products'}
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            Click any product to open its full detail editor, gallery and variants.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#111827] px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer whitespace-nowrap"
          >
            <Download size={14} className="text-[#4B5563]" /> Export
          </button>
          <button
            type="button"
            onClick={() => onStartNewProduct?.()}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] hover:opacity-95 text-white text-[12.5px] font-semibold px-4 py-2 rounded-xl shadow-xs transition cursor-pointer whitespace-nowrap"
          >
            <Plus size={14} /> Add Product
          </button>
        </div>
      </div>

      {/* Row 1: 5 Pastel KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
              className={`text-left rounded-2xl border p-4 shadow-2xs flex items-start gap-3 transition cursor-pointer ${card.cardCls} ${
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
                <p className={`text-[11px] font-medium mt-0.5 truncate ${card.subCls}`}>
                  {card.sub}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Main Products White Card Container */}
      <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-2xs overflow-hidden">
        {/* Underline Filter Tabs */}
        <div className="px-4 pt-1 border-b border-[#EAECF0] flex items-center gap-5 overflow-x-auto text-[12.5px]">
          {[
            { id: 'all', label: `All Products (${stats.total})` },
            { id: 'active', label: `Active (${stats.active})` },
            { id: 'disabled', label: `Draft (${stats.draft})` },
            { id: 'out_of_stock', label: `Out of Stock (${stats.outOfStock})` },
            { id: 'low_stock', label: `Low Stock (${stats.lowStock})` },
            { id: 'featured', label: `Featured (${stats.featured})` },
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

        {/* Search & Filter Row */}
        <div className="p-3.5 border-b border-[#EAECF0] flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 flex-1 min-w-[210px]">
            <Search size={14} className="text-[#9CA3AF] shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Search products by name, SKU, or category..."
              className="bg-transparent outline-none text-[12.5px] text-[#111827] placeholder:text-[#9CA3AF] w-full min-w-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setPage(1)
                }}
                className="text-[#6B7280] hover:text-[#111827] cursor-pointer"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setPage(1)
            }}
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
            onChange={(e) => {
              setBrandFilter(e.target.value)
              setPage(1)
            }}
            className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12px] font-medium text-[#374151] outline-none cursor-pointer"
          >
            <option value="all">All Brands</option>
            {brandOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value)
              setPage(1)
            }}
            className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12px] font-medium text-[#374151] outline-none cursor-pointer"
          >
            <option value="default">Sort: Storefront</option>
            <option value="name_asc">Title: A → Z</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="stock_asc">Stock: Low → High</option>
            <option value="stock_desc">Stock: High → Low</option>
          </select>
        </div>

        {/* High-Density Products Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12.5px] border-collapse">
            <thead className="bg-[#F9FAFB] text-[#6B7280] font-medium border-b border-[#EAECF0]">
              <tr>
                <th className="w-10 py-3 pl-4 pr-2">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible products"
                    className="rounded border-[#D1D5DB] accent-[#5B21B6] cursor-pointer"
                  />
                </th>
                <th className="py-3 px-2.5 font-medium">Product</th>
                <th className="py-3 px-2.5 font-medium">SKU</th>
                <th className="py-3 px-2.5 font-medium">Category</th>
                <th className="py-3 px-2.5 font-medium">Price</th>
                <th className="py-3 px-2.5 font-medium">Stock</th>
                <th className="py-3 px-2.5 font-medium">Status</th>
                <th className="py-3 pl-2.5 pr-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF0]">
              {pagedProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[#6B7280]">
                    No products match your search or filter.
                  </td>
                </tr>
              ) : (
                pagedProducts.map((p) => {
                  const stockNum = p.stock ?? 0
                  const out = stockNum === 0
                  const low = !out && stockNum <= lowStockThreshold
                  const disc =
                    Number(p.mrp) > Number(p.price) && Number(p.mrp) > 0
                      ? Math.round(((p.mrp - p.price) / p.mrp) * 100)
                      : 0
                  const isChecked = selectedIds.includes(p.id)
                  const variantMeta = p.variants?.length
                    ? `${p.variants.length} Variant${p.variants.length === 1 ? '' : 's'}`
                    : `${p.brand || 'HARBAN'} · ${p.images?.length || 1} photo${(p.images?.length || 1) === 1 ? '' : 's'}`

                  const statusPill =
                    p.isActive === false
                      ? { label: 'Draft', cls: 'bg-[#F3F4F6] text-[#4B5563]' }
                      : out
                        ? { label: 'Out of Stock', cls: 'bg-[#FEE2E2] text-[#B91C1C]' }
                        : low
                          ? { label: 'Low Stock', cls: 'bg-[#FEF3C7] text-[#B45309]' }
                          : { label: 'Active', cls: 'bg-[#DCFCE7] text-[#15803D]' }

                  return (
                    <tr
                      key={p.id}
                      onClick={() => onOpenProduct?.(p.id)}
                      className={`hover:bg-[#F9FAFB] cursor-pointer ${
                        isChecked ? 'bg-[#F5F3FF]/60' : ''
                      }`}
                    >
                      <td
                        className="py-3 pl-4 pr-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(p.id)}
                          aria-label={`Select ${p.name}`}
                          className="rounded border-[#D1D5DB] accent-[#5B21B6] cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-2.5">
                        <div className="flex items-center gap-3 min-w-[230px]">
                          <Img
                            src={p.image}
                            alt={p.name}
                            className="w-10 h-10 rounded-xl object-cover border border-[#EAECF0] bg-[#F9FAFB] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-[#111827] hover:text-[#5B21B6] truncate max-w-[230px]">
                                {p.name}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleFlag(p, 'isFeatured')
                                }}
                                title={
                                  p.isFeatured ? 'Featured product' : 'Mark featured'
                                }
                                className="cursor-pointer shrink-0"
                              >
                                <Star
                                  size={12}
                                  className={
                                    p.isFeatured
                                      ? 'fill-[#F59E0B] text-[#D97706]'
                                      : 'text-[#D1D5DB] hover:text-[#6B7280]'
                                  }
                                />
                              </button>
                            </div>
                            <p className="text-[11px] text-[#6B7280] truncate">
                              {variantMeta}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-2.5 font-mono text-[12px] text-[#374151] whitespace-nowrap">
                        {p.sku || p.id}
                      </td>

                      <td className="py-3 px-2.5 whitespace-nowrap">
                        <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#F3E8FF] text-[#6D28D9]">
                          {categoryMap.get(p.category) || p.category}
                        </span>
                      </td>

                      <td className="py-3 px-2.5 tabular-nums whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#111827]">
                            {formatINR(p.price)}
                          </span>
                          {Number(p.mrp) > Number(p.price) && (
                            <span className="text-[11px] text-[#9CA3AF] line-through">
                              {formatINR(p.mrp)}
                            </span>
                          )}
                          {disc > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E11D48] text-white">
                              {disc}% OFF
                            </span>
                          )}
                        </div>
                      </td>

                      <td
                        className="py-3 px-2.5 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <InlineStockControl
                          stock={stockNum}
                          colorClass={
                            out
                              ? 'text-[#E11D48]'
                              : low
                                ? 'text-[#D97706]'
                                : 'text-[#111827]'
                          }
                          onSave={(next) => handleQuickStock(p, next)}
                        />
                      </td>

                      <td
                        className="py-3 px-2.5 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleFlag(p, 'isActive')}
                          title="Click to toggle Active / Draft"
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md cursor-pointer ${statusPill.cls}`}
                        >
                          {statusPill.label}
                        </button>
                      </td>

                      <td
                        className="py-3 pl-2.5 pr-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openSavedPreview(p)}
                            title="Preview product card"
                            className="w-7 h-7 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] grid place-items-center text-[#4B5563] cursor-pointer"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenProduct?.(p.id)}
                            title="Open product editor"
                            className="w-7 h-7 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] grid place-items-center text-[#4B5563] cursor-pointer"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openQuickModal(p)}
                            title="Quick update price & stock"
                            className="w-7 h-7 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] grid place-items-center text-[#4B5563] cursor-pointer"
                          >
                            <SlidersHorizontal size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(p)}
                            title="Delete product"
                            className="w-7 h-7 rounded-lg border border-[#FECDD3] hover:bg-[#FFF5F6] grid place-items-center text-[#E11D48] cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Purple Pagination Footer */}
        <div className="px-4 py-3 border-t border-[#EAECF0] bg-white flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#6B7280]">
          <span>
            Showing{' '}
            <strong className="text-[#111827] tabular-nums">
              {filteredProducts.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
              {Math.min(safePage * pageSize, filteredProducts.length)}
            </strong>{' '}
            of{' '}
            <strong className="text-[#111827] tabular-nums">
              {filteredProducts.length}
            </strong>{' '}
            products
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

      {sharedModals}
    </div>
  )
}
