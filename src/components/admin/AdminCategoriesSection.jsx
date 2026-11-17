import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Download,
  EyeOff,
  FolderKanban,
  Layers,
  LayoutGrid,
  List,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import Img from '../Img'
import { matchesSearch } from '../../lib/search'

const EMPTY_CATEGORY = {
  id: '',
  label: '',
  blurb: '',
  image: '/images/product-ht100.jpg',
  isActive: true,
  sortOrder: 0,
}

export default function AdminCategoriesSection({
  categories = [],
  products = [],
  onSaveCategory,
  onDeleteCategory,
  onUploadImage,
  onReload,
  pushToast,
}) {
  const [form, setForm] = useState(EMPTY_CATEGORY)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('list')
  const [importOpen, setImportOpen] = useState(false)
  const [importCsvText, setImportCsvText] = useState('')
  const [importing, setImporting] = useState(false)

  const productCounts = useMemo(() => {
    const map = new Map()
    for (const p of products) {
      map.set(p.category, (map.get(p.category) || 0) + 1)
    }
    return map
  }, [products])

  const stats = useMemo(() => {
    const active = categories.filter((c) => c.isActive !== false).length
    const inactive = categories.length - active
    const withProducts = categories.filter(
      (c) => (productCounts.get(c.id) || 0) > 0,
    ).length
    const empty = categories.length - withProducts
    return {
      total: categories.length,
      active,
      inactive,
      withProducts,
      empty,
    }
  }, [categories, productCounts])

  const filtered = useMemo(() => {
    return [...categories]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .filter((c) => {
        const isActive = c.isActive !== false
        if (statusFilter === 'active' && !isActive) return false
        if (statusFilter === 'inactive' && isActive) return false
        if (statusFilter === 'with_products' && (productCounts.get(c.id) || 0) === 0)
          return false
        if (statusFilter === 'empty' && (productCounts.get(c.id) || 0) > 0)
          return false
        return matchesSearch(search, c.label, c.id, c.blurb)
      })
  }, [categories, statusFilter, search, productCounts])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('Unable to read file'))
        reader.readAsDataURL(file)
      })
      const url = await onUploadImage({
        filename: file.name,
        mimeType: file.type || 'image/jpeg',
        dataBase64: dataUrl,
      })
      setForm((prev) => ({ ...prev, image: url }))
      pushToast('Category image uploaded to Supabase Storage')
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.label.trim() || saving) return
    setSaving(true)
    try {
      const cleanId =
        form.id.trim() ||
        form.label
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      await onSaveCategory({
        ...form,
        id: cleanId,
        sortOrder: Number(form.sortOrder) || 0,
      })
      setForm(EMPTY_CATEGORY)
      setEditingId(null)
      await onReload()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  const handleMoveOrder = async (cat, delta) => {
    try {
      await onSaveCategory({
        id: cat.id,
        label: cat.label,
        blurb: cat.blurb || '',
        image: cat.image || '/images/product-ht100.jpg',
        isActive: cat.isActive !== false,
        sortOrder: (Number(cat.sortOrder) || 0) + delta,
      })
      await onReload()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to reorder')
    }
  }

  const handleToggleActive = async (cat) => {
    try {
      await onSaveCategory({
        id: cat.id,
        label: cat.label,
        blurb: cat.blurb || '',
        image: cat.image || '/images/product-ht100.jpg',
        isActive: cat.isActive === false,
        sortOrder: Number(cat.sortOrder) || 0,
      })
      await onReload()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Status update failed')
    }
  }

  const handleDuplicate = (cat) => {
    setEditingId(null)
    setForm({
      id: `${cat.id}-copy`,
      label: `${cat.label} Copy`,
      blurb: cat.blurb || '',
      image: cat.image || '/images/product-ht100.jpg',
      isActive: true,
      sortOrder: (Number(cat.sortOrder) || 0) + 1,
    })
    pushToast(`Loaded copy of "${cat.label}" — edit and save`)
  }

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return
    try {
      await onDeleteCategory(confirmDelete.id)
      if (editingId === confirmDelete.id) {
        setForm(EMPTY_CATEGORY)
        setEditingId(null)
      }
      setConfirmDelete(null)
      await onReload()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Cannot delete category')
      setConfirmDelete(null)
    }
  }

  const handleExportCsv = () => {
    const header = ['ID', 'Label', 'Blurb', 'SortOrder', 'Status', 'ProductCount', 'Image']
    const rows = filtered.map((c) => [
      c.id,
      c.label,
      c.blurb || '',
      c.sortOrder ?? 0,
      c.isActive !== false ? 'Active' : 'Inactive',
      productCounts.get(c.id) || 0,
      c.image || '',
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
    link.download = `HARBAN-Categories-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    pushToast(`Exported ${filtered.length} categories`)
  }

  const handleImportSubmit = async (e) => {
    e.preventDefault()
    if (!importCsvText.trim() || importing) return
    setImporting(true)
    try {
      const lines = importCsvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      let imported = 0
      for (let i = 0; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        if (i === 0 && /label|id|name/i.test(cols[0] || '')) continue
        const label = cols[1] || cols[0]
        const id =
          (cols[0] || label)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || `cat-${Date.now()}-${i}`
        if (!label) continue
        await onSaveCategory({
          id,
          label,
          blurb: cols[2] || '',
          sortOrder: Number(cols[3]) || i,
          isActive: cols[4] ? !/inactive|false|0/i.test(cols[4]) : true,
          image: cols[5] || '/images/product-ht100.jpg',
        })
        imported++
      }
      pushToast(`Imported ${imported} categor${imported === 1 ? 'y' : 'ies'}`)
      setImportCsvText('')
      setImportOpen(false)
      await onReload()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[22px] text-[#111827] tracking-tight leading-tight">
            Categories
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            Organize your product categories and display order cleanly.
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
          <button
            type="button"
            onClick={() => {
              setEditingId(null)
              setForm(EMPTY_CATEGORY)
            }}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] hover:opacity-95 text-white px-4 py-2 rounded-xl shadow-xs cursor-pointer"
          >
            <Plus size={14} /> Add Category
          </button>
        </div>
      </div>

      {/* 5 Pastel KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            id: 'all',
            label: 'Total Categories',
            count: stats.total,
            sub: 'Synced catalog groups',
            cardCls: 'bg-white border-[#EAECF0]',
            iconCls: 'bg-[#F3E8FF] text-[#6D28D9]',
            Icon: Layers,
          },
          {
            id: 'active',
            label: 'Active Categories',
            count: stats.active,
            sub: 'Live on storefront',
            cardCls: 'bg-[#F0FDF4] border-[#DCFCE7]',
            iconCls: 'bg-[#DCFCE7] text-[#16A34A]',
            Icon: CheckCircle2,
          },
          {
            id: 'inactive',
            label: 'Inactive',
            count: stats.inactive,
            sub: 'Hidden from menu',
            cardCls: 'bg-[#FFFBEB] border-[#FEF3C7]',
            iconCls: 'bg-[#FEF3C7] text-[#D97706]',
            Icon: EyeOff,
          },
          {
            id: 'with_products',
            label: 'With Products',
            count: stats.withProducts,
            sub: `${products.length} items total`,
            cardCls: 'bg-[#EFF6FF] border-[#DBEAFE]',
            iconCls: 'bg-[#DBEAFE] text-[#2563EB]',
            Icon: Package,
          },
          {
            id: 'empty',
            label: 'Empty Categories',
            count: stats.empty,
            sub: stats.empty > 0 ? 'Needs products' : 'All populated',
            cardCls: 'bg-[#FFF5F6] border-[#FFE4E6]',
            iconCls: 'bg-[#FFE4E6] text-[#E11D48]',
            Icon: FolderKanban,
          },
        ].map((card) => {
          const Icon = card.Icon
          const isSelected = statusFilter === card.id && card.id !== 'all'
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setStatusFilter(card.id)}
              className={`text-left rounded-2xl border p-4 shadow-2xs flex items-start gap-3 transition cursor-pointer ${card.cardCls} ${
                isSelected ? 'ring-2 ring-[#5B21B6]/50' : 'hover:border-[#C4B5FD]'
              }`}
            >
              <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${card.iconCls}`}>
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-[#6B7280] truncate">{card.label}</p>
                <p className="font-display font-bold text-[20px] text-[#111827] mt-0.5 tabular-nums">
                  {card.count}
                </p>
                <p className="text-[11px] text-[#6B7280] truncate mt-0.5">{card.sub}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Main Split Workspace */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
        <div className="bg-white rounded-2xl border border-[#EAECF0] overflow-hidden shadow-2xs">
          {/* Toolbar */}
          <div className="p-3.5 border-b border-[#EAECF0] flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 flex-1 min-w-[200px]">
              <Search size={14} className="text-[#9CA3AF] shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories by name or slug..."
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

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12px] font-medium text-[#374151] outline-none cursor-pointer"
              >
                <option value="all">All Status ({stats.total})</option>
                <option value="active">Active ({stats.active})</option>
                <option value="inactive">Inactive ({stats.inactive})</option>
                <option value="with_products">With Products ({stats.withProducts})</option>
                <option value="empty">Empty ({stats.empty})</option>
              </select>

              <div className="inline-flex bg-[#F3F4F6] p-0.5 rounded-xl border border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                    viewMode === 'list' ? 'bg-white text-[#111827] shadow-2xs' : 'text-[#6B7280]'
                  }`}
                >
                  <List size={13} /> List
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                    viewMode === 'grid' ? 'bg-white text-[#111827] shadow-2xs' : 'text-[#6B7280]'
                  }`}
                >
                  <LayoutGrid size={13} /> Grid
                </button>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-[#6B7280]">
              No categories match your current filter.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="p-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((c) => {
                const count = productCounts.get(c.id) || 0
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-[#EAECF0] p-3.5 space-y-3 hover:border-[#C4B5FD] bg-white transition"
                  >
                    <div className="flex items-start gap-3">
                      <Img
                        src={c.image}
                        alt={c.label}
                        className="w-12 h-12 rounded-xl object-cover border border-[#EAECF0] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[13.5px] text-[#111827] truncate">
                          {c.label}
                        </p>
                        <p className="text-[11px] font-mono text-[#5B21B6]">/{c.id}</p>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">
                          {count} product{count === 1 ? '' : 's'} · Order {c.sortOrder ?? 0}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#EAECF0]">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(c)}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md cursor-pointer ${
                          c.isActive !== false
                            ? 'bg-[#DCFCE7] text-[#15803D]'
                            : 'bg-[#F3F4F6] text-[#6B7280]'
                        }`}
                      >
                        {c.isActive !== false ? 'Active' : 'Inactive'}
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(c.id)
                            setForm({
                              id: c.id,
                              label: c.label,
                              blurb: c.blurb || '',
                              image: c.image || '/images/product-ht100.jpg',
                              isActive: c.isActive !== false,
                              sortOrder: c.sortOrder ?? 0,
                            })
                          }}
                          className="w-7 h-7 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] grid place-items-center text-[#4B5563] cursor-pointer"
                          title="Edit"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={count > 0}
                          onClick={() => setConfirmDelete(c)}
                          className="w-7 h-7 rounded-lg border border-[#FECDD3] hover:bg-[#FFF5F6] disabled:opacity-30 grid place-items-center text-[#E11D48] cursor-pointer"
                          title={count > 0 ? 'Reassign products first' : 'Delete'}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-[#F9FAFB] text-[#6B7280] font-medium border-b border-[#EAECF0]">
                  <tr>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-3">Slug / URL</th>
                    <th className="py-3 px-3">Products</th>
                    <th className="py-3 px-3">Sort Order</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0]">
                  {filtered.map((c) => {
                    const count = productCounts.get(c.id) || 0
                    const isEditingRow = editingId === c.id
                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-[#F9FAFB] ${isEditingRow ? 'bg-[#F5F3FF]/60' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3 min-w-[180px]">
                            <Img
                              src={c.image}
                              alt={c.label}
                              className="w-10 h-10 rounded-xl object-cover border border-[#EAECF0] bg-[#F9FAFB] shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-[#111827] truncate">{c.label}</p>
                              <p className="text-[11px] text-[#6B7280] truncate max-w-[200px]">
                                {c.blurb || 'No description'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[12px] text-[#5B21B6]">
                          /{c.id}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#111827] tabular-nums">
                          {count} product{count === 1 ? '' : 's'}
                        </td>
                        <td className="py-3 px-3">
                          <div className="inline-flex items-center gap-1">
                            <span className="font-mono text-[12px] w-6 text-[#374151] tabular-nums">
                              {c.sortOrder ?? 0}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleMoveOrder(c, -1)}
                              className="w-6 h-6 rounded border border-[#E5E7EB] hover:bg-white grid place-items-center text-[#4B5563] cursor-pointer"
                              title="Move up"
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveOrder(c, 1)}
                              className="w-6 h-6 rounded border border-[#E5E7EB] hover:bg-white grid place-items-center text-[#4B5563] cursor-pointer"
                              title="Move down"
                            >
                              <ArrowDown size={11} />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(c)}
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md cursor-pointer ${
                              c.isActive !== false
                                ? 'bg-[#DCFCE7] text-[#15803D]'
                                : 'bg-[#F3F4F6] text-[#6B7280]'
                            }`}
                          >
                            {c.isActive !== false ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(c.id)
                                setForm({
                                  id: c.id,
                                  label: c.label,
                                  blurb: c.blurb || '',
                                  image: c.image || '/images/product-ht100.jpg',
                                  isActive: c.isActive !== false,
                                  sortOrder: c.sortOrder ?? 0,
                                })
                              }}
                              className="w-7 h-7 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] grid place-items-center text-[#4B5563] cursor-pointer"
                              title="Edit category"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicate(c)}
                              className="w-7 h-7 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] grid place-items-center text-[#4B5563] cursor-pointer"
                              title="Duplicate category"
                            >
                              <Copy size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={count > 0}
                              title={
                                count > 0
                                  ? 'Reassign products before deleting'
                                  : 'Delete category'
                              }
                              onClick={() => setConfirmDelete(c)}
                              className="w-7 h-7 rounded-lg border border-[#FECDD3] hover:bg-[#FFF5F6] disabled:opacity-30 disabled:cursor-not-allowed grid place-items-center text-[#E11D48] cursor-pointer"
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

        {/* Sticky Category Create / Edit Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-[#EAECF0] p-5 space-y-3.5 shadow-2xs lg:sticky lg:top-20"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-[#EAECF0]">
            <h2 className="font-display font-bold text-[15px] text-[#111827] flex items-center gap-2">
              <FolderKanban size={16} className="text-[#5B21B6]" />
              {editingId ? `Edit "${form.label}"` : 'Add Category'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null)
                  setForm(EMPTY_CATEGORY)
                }}
                className="text-[12px] font-semibold text-[#5B21B6] hover:underline cursor-pointer"
              >
                New
              </button>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#374151] mb-1">
              Category Name *
            </label>
            <input
              required
              value={form.label}
              onChange={(e) => setForm((c) => ({ ...c, label: e.target.value }))}
              placeholder="e.g. Beard Trimmers"
              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#5B21B6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                Slug / URL
              </label>
              <input
                value={form.id}
                disabled={Boolean(editingId)}
                onChange={(e) => setForm((c) => ({ ...c, id: e.target.value }))}
                placeholder="auto-generated"
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm font-mono outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((c) => ({ ...c, sortOrder: Number(e.target.value) }))
                }
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm tabular-nums outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#374151] mb-1">
              Description / Subtitle
            </label>
            <input
              value={form.blurb}
              onChange={(e) => setForm((c) => ({ ...c, blurb: e.target.value }))}
              placeholder="Precision styling for daily routines"
              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#5B21B6]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#374151] mb-1">
              Cover Image URL or Upload
            </label>
            <div className="flex items-center gap-2">
              <input
                value={form.image}
                onChange={(e) => setForm((c) => ({ ...c, image: e.target.value }))}
                placeholder="/images/product-ht100.jpg"
                className="flex-1 min-w-0 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm outline-none"
              />
              <label className="shrink-0 inline-flex items-center gap-1.5 bg-[#F3E8FF] hover:bg-[#EDE9FE] text-[#5B21B6] text-[12px] font-semibold px-3 py-2 rounded-xl cursor-pointer transition">
                <Upload size={13} />
                {uploading ? '...' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#374151] cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive !== false}
              onChange={(e) =>
                setForm((c) => ({ ...c, isActive: e.target.checked }))
              }
              className="accent-[#5B21B6]"
            />
            Visible on Storefront
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#5B21B6] to-[#4F46E5] hover:opacity-95 text-white text-[13px] font-semibold py-2.5 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
          >
            <Plus size={14} />
            {saving ? 'Saving...' : editingId ? 'Update Category' : 'Create Category'}
          </button>
        </form>
      </div>

      {/* Import Categories CSV Modal */}
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
                Import Categories (CSV)
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
              Paste CSV lines formatted as: <code>id, label, blurb, sortOrder, active</code>
            </p>
            <textarea
              rows={5}
              required
              value={importCsvText}
              onChange={(e) => setImportCsvText(e.target.value)}
              placeholder={`beard, Beard Trimmers, Clean sharp trims, 1, active\nnose, Ear & Nose, Precision detailing, 2, active`}
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
                {importing ? 'Importing...' : 'Import Categories'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="relative bg-white rounded-2xl border border-[#EAECF0] max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-display font-bold text-[16px] text-[#111827]">
              Delete category?
            </h3>
            <p className="text-[13px] text-[#6B7280]">
              Remove <strong>{confirmDelete.label}</strong> (/{confirmDelete.id}) from catalog categories?
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
