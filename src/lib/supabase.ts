import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://yynubnoijafkzcengteb.supabase.co'
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_IYHHRJTMjJp3v0q3gZaV2w_fo7Runex'

const ORDER_STAGE_LABELS = [
  'Order placed',
  'Packed',
  'Shipped',
  'Out for delivery',
  'Delivered',
]

function cleanEnvValue(val: string | undefined): string {
  return (val || '').trim().replace(/^['"]|['"]$/g, '')
}

function resolveSupabaseUrl(): string {
  const raw = cleanEnvValue(
    process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_ID,
  )
  if (!raw) return DEFAULT_SUPABASE_URL
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw.replace(/\/+$/, '')
  }
  if (/^[a-z0-9-]+$/i.test(raw)) {
    return `https://${raw}.supabase.co`
  }
  return DEFAULT_SUPABASE_URL
}

function resolveSupabaseKey(): {
  key: string
  hasServiceRole: boolean
  hasPublishable: boolean
} {
  const serviceKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const publishableKey = cleanEnvValue(
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
  )
  const hasServiceRole =
    Boolean(serviceKey) && !serviceKey.startsWith('MY_')
  const hasPublishable =
    Boolean(publishableKey) && !publishableKey.startsWith('MY_')

  const key = hasServiceRole
    ? serviceKey
    : hasPublishable
      ? publishableKey
      : DEFAULT_SUPABASE_PUBLISHABLE_KEY

  return {
    key,
    hasServiceRole,
    hasPublishable: hasPublishable || Boolean(DEFAULT_SUPABASE_PUBLISHABLE_KEY),
  }
}

let cachedClient: SupabaseClient | null = null
let cachedSig = ''

export function getSupabaseClient(): SupabaseClient {
  const url = resolveSupabaseUrl()
  const { key } = resolveSupabaseKey()
  const sig = `${url}|${key.slice(0, 12)}`
  if (cachedClient && cachedSig === sig) return cachedClient

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  cachedSig = sig
  return cachedClient
}

function assertSbOk<T extends { error: { code?: string; message: string } | null }>(
  res: T,
  label: string,
): T {
  if (res.error) {
    const err = new Error(
      `${res.error.code ? `${res.error.code}: ` : ''}${res.error.message}`,
    )
    console.warn(`[Supabase sync failed: ${label}] ${err.message}`)
    throw err
  }
  return res
}

async function runSupabaseSync(
  label: string,
  fn: (sb: SupabaseClient) => Promise<void>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = getSupabaseClient()
    await fn(sb)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[Supabase sync skipped: ${label}] ${message}`)
    return { ok: false, error: message }
  }
}

export async function ensureSupabaseStorageBucket(): Promise<{
  ok: boolean
  error?: string
}> {
  try {
    const sb = getSupabaseClient()
    const { data: bucket, error: getErr } = await sb.storage.getBucket(
      'product-images',
    )
    if (bucket && !getErr) return { ok: true }
    const { error: createErr } = await sb.storage.createBucket('product-images', {
      public: true,
    })
    if (createErr && !createErr.message.toLowerCase().includes('already exists')) {
      return { ok: false, error: createErr.message }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Bucket check failed',
    }
  }
}

export async function getSupabaseHealth() {
  const url = resolveSupabaseUrl()
  const { hasServiceRole, hasPublishable } = resolveSupabaseKey()
  const sb = getSupabaseClient()

  const tables = [
    'categories',
    'products',
    'customers',
    'orders',
    'cart_events',
    'product_views',
  ] as const

  const counts: Record<string, number> = {}
  let schemaReady = true
  let schemaError: string | null = null

  for (const table of tables) {
    const res = await sb.from(table).select('*', { count: 'exact' }).limit(1)
    if (res.error || res.status >= 400) {
      schemaReady = false
      if (!schemaError) {
        schemaError = res.error
          ? `${res.error.code ? `${res.error.code}: ` : ''}${res.error.message}`
          : `HTTP ${res.status} querying public.${table}`
      }
      counts[table] = 0
    } else {
      counts[table] = res.count ?? (Array.isArray(res.data) ? res.data.length : 0)
    }
  }

  const bucketCheck = await ensureSupabaseStorageBucket()

  return {
    url,
    projectId: url.replace(/^https?:\/\//, '').split('.')[0] || 'yynubnoijafkzcengteb',
    hasServiceRole,
    hasPublishable,
    schemaReady,
    storageReady: bucketCheck.ok,
    counts,
    error: schemaError,
  }
}

export interface SupabasePulledCategory {
  id: string
  label: string
  blurb: string
  image: string
  isActive: boolean
  sortOrder: number
}

export interface SupabasePulledProduct {
  id: string
  name: string
  tagline: string
  category: string
  price: number
  mrp: number
  stock: number
  rating: number
  reviewsCount: number
  image: string
  images: string[]
  badge: string | null
  shortDesc: string
  description: string
  features: string[]
  specs: { label: string; value: string }[]
  meeshoUrl: string | null
  isActive: boolean
  sortOrder: number
  sku?: string
  isFeatured?: boolean
  variants?: {
    id: string
    sku: string
    size: string
    color: string
    label?: string
    price: number
    mrp?: number
    stock: number
    isActive: boolean
  }[]
}

export async function fetchCatalogFromSupabase(): Promise<{
  ok: boolean
  categories: SupabasePulledCategory[]
  products: SupabasePulledProduct[]
  error?: string
}> {
  try {
    const sb = getSupabaseClient()
    const [catRes, prodRes] = await Promise.all([
      sb
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true }),
      sb
        .from('products')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true }),
    ])

    if (catRes.error) {
      return {
        ok: false,
        categories: [],
        products: [],
        error: catRes.error.message,
      }
    }
    if (prodRes.error) {
      return {
        ok: false,
        categories: [],
        products: [],
        error: prodRes.error.message,
      }
    }

    const categories: SupabasePulledCategory[] = (catRes.data || [])
      .filter((c: any) => c && typeof c.id === 'string' && c.id.trim())
      .map((c: any, idx: number) => ({
        id: String(c.id).trim().toLowerCase(),
        label: String(c.label || c.id).trim(),
        blurb: String(c.blurb || '').trim(),
        image: String(c.image || '/images/product-ht100.jpg').trim(),
        isActive: c.is_active !== false,
        sortOrder: Number.isFinite(Number(c.sort_order)) ? Number(c.sort_order) : idx,
      }))

    const products: SupabasePulledProduct[] = (prodRes.data || [])
      .filter((r: any) => r && typeof r.id === 'string' && r.id.trim())
      .map((r: any, idx: number) => {
        const rawImages = Array.isArray(r.images)
          ? r.images.map((u: unknown) => String(u || '').trim()).filter(Boolean)
          : []
        const primary =
          String(r.image || '').trim() || rawImages[0] || '/images/product-ht100.jpg'
        const normalizedImages = primary
          ? [primary, ...rawImages.filter((u: string) => u !== primary)]
          : rawImages

        const price = Math.max(0, Math.round(Number(r.price ?? 0) || 0))
        const mrp = Math.max(price, Math.round(Number(r.mrp ?? price) || price))
        const stock = Math.max(0, Math.round(Number(r.stock ?? 50) || 0))
        const tagline = String(
          r.tagline || r.short_desc || 'Precision Grooming',
        ).trim()
        const shortDesc = String(r.short_desc || r.tagline || '').trim()
        const description = String(
          r.description || r.short_desc || r.tagline || '',
        ).trim()

        return {
          id: String(r.id).trim(),
          name: String(r.name || r.id).trim(),
          tagline,
          category: String(r.category || 'beard').trim().toLowerCase(),
          price,
          mrp,
          stock,
          rating: Number.isFinite(Number(r.rating)) ? Number(r.rating) : 4.7,
          reviewsCount: Math.max(
            0,
            Math.round(Number(r.reviews_count ?? r.reviews ?? 0) || 0),
          ),
          image: primary,
          images: normalizedImages,
          badge: r.badge ? String(r.badge).trim() : null,
          shortDesc,
          description,
          features: Array.isArray(r.features)
            ? r.features.map((f: unknown) => String(f || '').trim()).filter(Boolean)
            : [],
          specs: Array.isArray(r.specs)
            ? r.specs
                .filter((s: any) => s && s.label && s.value)
                .map((s: any) => ({
                  label: String(s.label).trim(),
                  value: String(s.value).trim(),
                }))
            : [],
          meeshoUrl: r.meesho_url ? String(r.meesho_url).trim() : null,
          isActive: r.is_active !== false,
          sortOrder: Number.isFinite(Number(r.sort_order))
            ? Number(r.sort_order)
            : idx,
          sku: typeof r.sku === 'string' ? r.sku : undefined,
          isFeatured:
            typeof r.is_featured === 'boolean' ? r.is_featured : undefined,
          variants: Array.isArray(r.variants)
            ? r.variants.map((v: any, vIdx: number) => ({
                id: String(v?.id || `v_${vIdx + 1}`),
                sku: String(v?.sku || ''),
                size: String(v?.size || ''),
                color: String(v?.color || ''),
                label: v?.label ? String(v.label) : undefined,
                price: Math.max(0, Math.round(Number(v?.price ?? price) || price)),
                mrp: v?.mrp !== undefined ? Math.max(0, Math.round(Number(v.mrp))) : undefined,
                stock: Math.max(0, Math.round(Number(v?.stock ?? 0) || 0)),
                isActive: v?.isActive !== false,
              }))
            : undefined,
        }
      })

    return { ok: true, categories, products }
  } catch (err) {
    return {
      ok: false,
      categories: [],
      products: [],
      error: err instanceof Error ? err.message : 'Failed to fetch from Supabase',
    }
  }
}

export async function syncCatalogToSupabase(payload: {
  categories: {
    id: string
    label: string
    blurb: string
    image: string
    isActive?: boolean
  }[]
  products: {
    id: string
    sku?: string
    name: string
    tagline: string
    category: string
    price: number
    mrp: number
    stock?: number
    rating: number
    reviews: number
    image: string
    images?: string[]
    badge?: string
    short: string
    description: string
    features?: string[]
    specs?: { label: string; value: string }[]
    variants?: {
      id?: string
      sku?: string
      size?: string
      color?: string
      price: number
      mrp?: number
      stock: number
      isActive?: boolean
    }[]
    meeshoUrl?: string | null
    isActive?: boolean
    isFeatured?: boolean
  }[]
  testimonials: { n: string; c: string; t: string; p: string; rating?: number }[]
  faqs: { q: string; a: string }[]
}) {
  return runSupabaseSync('catalog', async (sb) => {
    if (payload.categories.length) {
      assertSbOk(
        await sb.from('categories').upsert(
          payload.categories.map((c, idx) => ({
            id: c.id,
            label: c.label,
            blurb: c.blurb,
            image: c.image,
            sort_order: idx,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'id' },
        ),
        'categories',
      )
    }

    if (payload.products.length) {
      assertSbOk(
        await sb.from('products').upsert(
          payload.products.map((p, idx) => ({
            id: p.id,
            name: p.name,
            tagline: p.tagline,
            category: p.category,
            price: p.price,
            mrp: p.mrp,
            stock: p.stock ?? 50,
            rating: p.rating,
            reviews_count: p.reviews,
            image: p.image,
            images: p.images || [p.image],
            badge: p.badge ?? null,
            short_desc: p.short,
            description: p.description,
            features: p.features || [],
            specs: p.specs || [],
            meesho_url: p.meeshoUrl ?? null,
            is_active: p.isActive ?? true,
            sort_order: idx,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'id' },
        ),
        'products',
      )
    }
  })
}

export async function syncProductToSupabase(p: {
  id: string
  sku?: string
  name: string
  tagline: string
  category: string
  price: number
  mrp: number
  stock: number
  rating: number
  reviews: number
  image: string
  images: string[]
  badge?: string | null
  short: string
  description: string
  features: string[]
  specs: { label: string; value: string }[]
  variants?: {
    id?: string
    sku?: string
    size?: string
    color?: string
    price: number
    mrp?: number
    stock: number
    isActive?: boolean
  }[]
  meeshoUrl?: string | null
  isActive?: boolean
  isFeatured?: boolean
}) {
  return runSupabaseSync('product', async (sb) => {
    assertSbOk(
      await sb.from('products').upsert(
        {
          id: p.id,
          name: p.name,
          tagline: p.tagline,
          category: p.category,
          price: p.price,
          mrp: p.mrp,
          stock: p.stock,
          rating: p.rating,
          reviews_count: p.reviews,
          image: p.image,
          images: p.images,
          badge: p.badge ?? null,
          short_desc: p.short,
          description: p.description,
          features: p.features,
          specs: p.specs,
          meesho_url: p.meeshoUrl ?? null,
          is_active: p.isActive ?? true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      ),
      'product',
    )

    // Best-effort extended Shopify columns & child tables (only populated once 003_shopify_platform.sql is applied)
    await sb
      .from('products')
      .update({
        sku: p.sku || '',
        is_featured: Boolean(p.isFeatured),
        variants: p.variants || [],
      })
      .eq('id', p.id)

    if (p.images.length > 0) {
      await sb.from('product_images').delete().eq('product_id', p.id)
      await sb.from('product_images').insert(
        p.images.map((url, idx) => ({
          product_id: p.id,
          url,
          alt: p.name,
          sort_order: idx,
          is_primary: idx === 0,
        })),
      )
    }

    if (Array.isArray(p.variants)) {
      await sb.from('product_variants').delete().eq('product_id', p.id)
      if (p.variants.length > 0) {
        await sb.from('product_variants').insert(
          p.variants.map((v) => ({
            product_id: p.id,
            sku: v.sku || '',
            size: v.size || '',
            color: v.color || '',
            price: Number(v.price ?? p.price) || 0,
            mrp: Number(v.mrp ?? p.mrp) || 0,
            stock: Number(v.stock ?? 0) || 0,
            is_active: v.isActive !== false,
          })),
        )
      }
    }
  })
}

export async function deleteProductFromSupabase(id: string) {
  return runSupabaseSync('delete-product', async (sb) => {
    assertSbOk(await sb.from('products').delete().eq('id', id), 'delete-product')
  })
}

export async function syncCategoryToSupabase(c: {
  id: string
  label: string
  blurb: string
  image: string
  isActive?: boolean
  sortOrder?: number
}) {
  return runSupabaseSync('category', async (sb) => {
    assertSbOk(
      await sb.from('categories').upsert(
        {
          id: c.id,
          label: c.label,
          blurb: c.blurb,
          image: c.image,
          sort_order: c.sortOrder ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      ),
      'category',
    )
  })
}

export async function deleteCategoryFromSupabase(id: string) {
  return runSupabaseSync('delete-category', async (sb) => {
    assertSbOk(await sb.from('categories').delete().eq('id', id), 'delete-category')
  })
}

export async function syncCustomerToSupabase(
  user: {
    uid: string
    email: string
    name: string
    phone?: string | null
    role?: string
    createdAt?: Date | number
  },
  addresses: {
    id: number
    label: string
    fullName: string
    phone: string
    line1: string
    city: string
    state?: string | null
    pincode: string
    isDefault: boolean
  }[] = [],
) {
  return runSupabaseSync('customer', async (sb) => {
    assertSbOk(
      await sb.from('customers').upsert(
        {
          uid: user.uid,
          email: user.email.toLowerCase(),
          name: user.name,
          phone: user.phone || '',
          role: user.role || 'customer',
          auth_provider: user.uid.startsWith('email:') ? 'email' : 'google',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'uid' },
      ),
      'customer',
    )

    if (addresses.length > 0) {
      assertSbOk(
        await sb.from('customer_addresses').upsert(
          addresses.map((a) => ({
            source_id: a.id,
            customer_uid: user.uid,
            customer_email: user.email.toLowerCase(),
            label: a.label,
            full_name: a.fullName,
            phone: a.phone,
            line1: a.line1,
            city: a.city,
            state: a.state || '',
            pincode: a.pincode,
            is_default: a.isDefault,
          })),
          { onConflict: 'source_id' },
        ),
        'customer_addresses',
      )
    }
  })
}

export async function deleteAddressFromSupabase(sourceId: number) {
  return runSupabaseSync('delete-address', async (sb) => {
    assertSbOk(
      await sb.from('customer_addresses').delete().eq('source_id', sourceId),
      'delete-address',
    )
  })
}

export async function syncOrderToSupabase(order: {
  id: string
  customerUid?: string | null
  customerName: string
  customerEmail?: string | null
  phone?: string
  shippingAddress?: object | null
  paymentMethod?: string
  paymentStatus?: string
  razorpayOrderId?: string | null
  razorpayPaymentId?: string | null
  subtotal: number
  shipping: number
  total: number
  status: number
  cancelled: boolean
  placedAt: number
  eta: number
  items: { id: string; name: string; image: string; price: number; qty: number }[]
}) {
  return runSupabaseSync('order', async (sb) => {
    const statusLabel = order.cancelled
      ? 'Cancelled'
      : ORDER_STAGE_LABELS[order.status] || 'Order placed'
    const itemsSummary = order.items
      .map((i) => `${i.name} x${i.qty}`)
      .join(', ')

    assertSbOk(
      await sb.from('orders').upsert(
        {
          order_code: order.id,
          customer_uid: order.customerUid ?? null,
          customer_name: order.customerName,
          customer_email: order.customerEmail ?? null,
          phone: order.phone || '',
          shipping_address: order.shippingAddress ?? null,
          payment_method: order.paymentMethod || 'Cash on Delivery',
          payment_status: order.paymentStatus || 'pending',
          razorpay_order_id: order.razorpayOrderId ?? null,
          razorpay_payment_id: order.razorpayPaymentId ?? null,
          subtotal: order.subtotal,
          shipping: order.shipping,
          total: order.total,
          status: order.status,
          status_label: statusLabel,
          cancelled: order.cancelled,
          items: order.items,
          items_summary: itemsSummary,
          eta_at: new Date(order.eta).toISOString(),
          placed_at: new Date(order.placedAt).toISOString(),
        },
        { onConflict: 'order_code' },
      ),
      'orders',
    )

    assertSbOk(
      await sb.from('order_items').delete().eq('order_code', order.id),
      'order_items_delete',
    )
    if (order.items.length > 0) {
      assertSbOk(
        await sb.from('order_items').insert(
          order.items.map((i) => ({
            order_code: order.id,
            product_id: i.id,
            product_name: i.name,
            product_image: i.image,
            unit_price: i.price,
            qty: i.qty,
          })),
        ),
        'order_items_insert',
      )
    }
  })
}

export async function deleteOrderFromSupabaseByCode(orderCode: string) {
  return runSupabaseSync('order_code_cleanup', async (sb) => {
    await sb.from('order_items').delete().eq('order_code', orderCode)
    await sb.from('orders').delete().eq('order_code', orderCode)
  })
}

export async function logCartEventToSupabase(event: {
  sessionId: string
  eventType: string
  customerUid?: string | null
  customerEmail?: string | null
  customerName?: string | null
  productId?: string | null
  productName?: string | null
  unitPrice?: number | null
  qty?: number
  cartTotal?: number
  cartItems?: Record<string, unknown>[]
  paymentMethod?: string | null
  orderCode?: string | null
}) {
  return runSupabaseSync('cart-event', async (sb) => {
    assertSbOk(
      await sb.from('cart_events').insert({
        session_id: event.sessionId,
        event_type: event.eventType,
        customer_uid: event.customerUid ?? null,
        customer_email: event.customerEmail ?? null,
        customer_name: event.customerName ?? null,
        product_id: event.productId ?? null,
        product_name: event.productName ?? null,
        unit_price: event.unitPrice ?? null,
        qty: event.qty ?? 1,
        cart_total: event.cartTotal ?? 0,
        cart_items: event.cartItems ?? [],
        payment_method: event.paymentMethod ?? null,
        order_code: event.orderCode ?? null,
      }),
      'cart_events',
    )
  })
}

export async function logProductViewToSupabase(event: {
  sessionId: string
  viewType: string
  productId?: string | null
  productName?: string | null
  category?: string | null
  customerUid?: string | null
  customerEmail?: string | null
  searchQuery?: string | null
}) {
  return runSupabaseSync('product-view', async (sb) => {
    assertSbOk(
      await sb.from('product_views').insert({
        session_id: event.sessionId,
        view_type: event.viewType,
        product_id: event.productId ?? null,
        product_name: event.productName ?? null,
        category: event.category ?? null,
        customer_uid: event.customerUid ?? null,
        customer_email: event.customerEmail ?? null,
        search_query: event.searchQuery ?? null,
      }),
      'product_views',
    )
  })
}

export async function syncNewsletterToSupabase(email: string) {
  return runSupabaseSync('newsletter', async (sb) => {
    assertSbOk(
      await sb
        .from('newsletter_subscribers')
        .upsert({ email: email.toLowerCase() }, { onConflict: 'email' }),
      'newsletter',
    )
  })
}

export async function syncContactMessageToSupabase(msg: {
  name: string
  email: string
  message: string
}) {
  return runSupabaseSync('contact', async (sb) => {
    assertSbOk(
      await sb.from('contact_messages').insert({
        name: msg.name,
        email: msg.email.toLowerCase(),
        message: msg.message,
      }),
      'contact',
    )
  })
}

export async function syncFullDatasetToSupabase(data: {
  categories: { id: string; label: string; blurb: string; image: string }[]
  products: Parameters<typeof syncCatalogToSupabase>[0]['products']
  testimonials: { n: string; c: string; t: string; p: string; rating?: number }[]
  faqs: { q: string; a: string }[]
  customers: {
    uid: string
    email: string
    name: string
    phone?: string | null
    role?: string
  }[]
  orders: Parameters<typeof syncOrderToSupabase>[0][]
}) {
  const catResult = await syncCatalogToSupabase({
    categories: data.categories,
    products: data.products,
    testimonials: data.testimonials,
    faqs: data.faqs,
  })
  if (!catResult.ok) return catResult

  for (const cust of data.customers) {
    const res = await syncCustomerToSupabase(cust, [])
    if (!res.ok) return res
  }

  for (const ord of data.orders) {
    const res = await syncOrderToSupabase(ord)
    if (!res.ok) return res
  }

  return getSupabaseHealth()
}

export async function uploadProductImageToSupabaseStorage(input: {
  filename: string
  mimeType: string
  buffer: Buffer
}): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    await ensureSupabaseStorageBucket()
    const sb = getSupabaseClient()
    const cleanName = input.filename.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
    const objectPath = `products/${Date.now()}-${cleanName}`

    const { error } = await sb.storage
      .from('product-images')
      .upload(objectPath, input.buffer, {
        contentType: input.mimeType || 'image/jpeg',
        upsert: true,
      })

    if (error) {
      return { ok: false, error: error.message }
    }

    const { data } = sb.storage.from('product-images').getPublicUrl(objectPath)
    return { ok: true, url: data.publicUrl }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Supabase Storage upload failed.',
    }
  }
}

export async function syncDiscountToSupabase(discount: {
  code: string
  description: string
  discountType: string
  value: number
  minOrderValue: number
  maxDiscount?: number | null
  usageLimit?: number | null
  usedCount?: number
  isActive: boolean
}) {
  return runSupabaseSync('discount-upsert', async (sb) => {
    const { error } = await sb.from('discounts').upsert(
      {
        code: discount.code,
        description: discount.description || '',
        discount_type: discount.discountType,
        value: discount.value,
        min_order_value: discount.minOrderValue,
        max_discount: discount.maxDiscount ?? null,
        usage_limit: discount.usageLimit ?? null,
        used_count: discount.usedCount ?? 0,
        is_active: discount.isActive,
      },
      { onConflict: 'code' },
    )
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      throw new Error(`discounts: ${error.message}`)
    }
  })
}

export async function deleteDiscountFromSupabase(code: string) {
  return runSupabaseSync('discount-delete', async (sb) => {
    const { error } = await sb.from('discounts').delete().eq('code', code)
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      throw new Error(`discounts_delete: ${error.message}`)
    }
  })
}

export async function syncStoreSettingsToSupabase(row: Record<string, unknown>) {
  return runSupabaseSync('store-settings-upsert', async (sb) => {
    const { error } = await sb
      .from('store_settings')
      .upsert(row, { onConflict: 'id' })
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      throw new Error(`store_settings: ${error.message}`)
    }
  })
}

export async function deleteCustomerFromSupabase(uid: string) {
  return runSupabaseSync('customer-delete', async (sb) => {
    const { error } = await sb.from('customers').delete().eq('uid', uid)
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      throw new Error(`customers_delete: ${error.message}`)
    }
  })
}

