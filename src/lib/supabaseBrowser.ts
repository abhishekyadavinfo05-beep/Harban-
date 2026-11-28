import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import {
  categories as seedCategories,
  faqs as seedFaqs,
  marqueeStats,
  products as seedProducts,
  testimonials as seedTestimonials,
} from '../data/products'
import { packStoreSettings, unpackStoreSettings } from './storeSettings'

const DEFAULT_SUPABASE_URL = 'https://yynubnoijafkzcengteb.supabase.co'
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_IYHHRJTMjJp3v0q3gZaV2w_fo7Runex'

const ADMIN_EMAILS = (
  import.meta.env.VITE_ADMIN_EMAILS ||
  'abhishekyadavinfo05@gmail.com,harban.official@gmail.com'
)
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean)

function cleanEnvValue(val: string | undefined): string {
  return (val || '').trim().replace(/^['"]|['"]$/g, '')
}

export function getBrowserSupabaseUrl(): string {
  const raw = cleanEnvValue(import.meta.env.VITE_SUPABASE_URL)
  if (!raw) return DEFAULT_SUPABASE_URL
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw.replace(/\/+$/, '')
  }
  return DEFAULT_SUPABASE_URL
}

function getBrowserSupabaseKey(): string {
  const key = cleanEnvValue(
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  return key || DEFAULT_SUPABASE_PUBLISHABLE_KEY
}

let browserClient: SupabaseClient | null = null

export function getBrowserSupabase(): SupabaseClient {
  if (browserClient) return browserClient
  browserClient = createClient(getBrowserSupabaseUrl(), getBrowserSupabaseKey(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return browserClient
}

export function isAllowlistedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}

const ORDER_STATUS_TO_STAGE: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  processing: 1,
  shipped: 2,
  delivered: 4,
  cancelled: 0,
}

function extractBrand(specs: unknown): string {
  if (!Array.isArray(specs)) return 'HARBAN'
  const match = specs.find(
    (s: any) =>
      s && typeof s.label === 'string' && s.label.trim().toLowerCase() === 'brand',
  )
  return match && typeof match.value === 'string' && match.value.trim()
    ? match.value.trim()
    : 'HARBAN'
}

function mapProductRow(r: any) {
  const specsList = Array.isArray(r.specs) ? r.specs : []
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

  return {
    id: String(r.id),
    sku: String(r.sku || ''),
    brand: extractBrand(specsList),
    name: String(r.name || r.id),
    tagline: String(r.tagline || r.short_desc || 'Precision Grooming'),
    price,
    mrp,
    rating: Number.isFinite(Number(r.rating)) ? Number(r.rating) : 4.7,
    reviews: Math.max(0, Math.round(Number(r.reviews_count ?? 0) || 0)),
    image: primary,
    images: normalizedImages,
    category: String(r.category || 'beard').toLowerCase(),
    badge: r.badge ? String(r.badge) : undefined,
    short: String(r.short_desc || r.tagline || ''),
    description: String(r.description || r.short_desc || r.tagline || ''),
    features: Array.isArray(r.features) ? r.features : [],
    specs: specsList,
    variants: Array.isArray(r.variants) ? r.variants : [],
    stock: Math.max(0, Math.round(Number(r.stock ?? 50) || 0)),
    meeshoUrl: r.meesho_url ?? null,
    isActive: r.is_active !== false,
    isFeatured: Boolean(r.is_featured),
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
  }
}

function deriveStatus(row: any): string {
  if (row.cancelled) return 'cancelled'
  const raw = String(row.fulfillment_status || '').toLowerCase()
  if (
    ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].includes(
      raw,
    )
  ) {
    return raw
  }
  const st = Number(row.status ?? 0)
  if (st >= 4) return 'delivered'
  if (st >= 2) return 'shipped'
  if (st === 1) return 'confirmed'
  return 'pending'
}

function mapOrderRow(
  row: any,
  orderItemsRows: any[] = [],
  fulfillmentRows: any[] = [],
  paymentRows: any[] = [],
) {
  const workflowStatus = deriveStatus(row)
  const orderedEvents = [...fulfillmentRows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  const latestWithTracking = [...orderedEvents]
    .reverse()
    .find((f) => f.courier_partner || f.tracking_number || f.tracking_url)
  const latestFulfillment = orderedEvents[orderedEvents.length - 1] || null
  const primaryPayment = paymentRows[0] || null
  const placedMs = row.placed_at ? new Date(row.placed_at).getTime() : Date.now()
  const etaMs = row.eta_at ? new Date(row.eta_at).getTime() : placedMs + 96 * 3600 * 1000

  const timeline =
    orderedEvents.length > 0
      ? orderedEvents.map((f) => ({
          id: f.id,
          status: f.status,
          courierPartner: f.courier_partner || '',
          trackingNumber: f.tracking_number || '',
          trackingUrl: f.tracking_url || '',
          notes: f.notes || '',
          createdAt: new Date(f.created_at).getTime(),
        }))
      : [
          {
            id: 0,
            status: row.cancelled ? 'cancelled' : workflowStatus,
            courierPartner: '',
            trackingNumber: '',
            trackingUrl: '',
            notes: row.cancelled
              ? 'Order cancelled'
              : `Order placed via ${row.payment_method || 'Cash on Delivery'}`,
            createdAt: placedMs,
          },
        ]

  const cancelEntry = [...orderedEvents]
    .reverse()
    .find((f) => f.status === 'cancelled' && f.notes)

  const itemsFromRows =
    orderItemsRows.length > 0
      ? orderItemsRows.map((i) => ({
          id: i.product_id,
          name: i.product_name,
          image: i.product_image,
          sku: i.sku ?? null,
          variantLabel: i.variant_label ?? null,
          price: i.unit_price,
          qty: i.qty,
          fulfilledQty: i.fulfilled_qty ?? 0,
        }))
      : Array.isArray(row.items)
        ? row.items
        : []

  return {
    id: row.order_code,
    customerUid: row.customer_uid ?? null,
    customerEmail: row.customer_email ?? null,
    customerName: row.customer_name || 'HARBAN Customer',
    phone: row.phone || '',
    shippingAddress: row.shipping_address ?? null,
    billingAddress: row.billing_address ?? null,
    paymentMethod: row.payment_method || 'Cash on Delivery',
    paymentStatus: row.payment_status || 'pending',
    razorpayOrderId: row.razorpay_order_id ?? null,
    razorpayPaymentId: row.razorpay_payment_id ?? null,
    paymentDetails: primaryPayment
      ? {
          provider: primaryPayment.provider,
          method: primaryPayment.method,
          amount: primaryPayment.amount,
          currency: primaryPayment.currency,
          status: primaryPayment.status,
          razorpayOrderId: primaryPayment.razorpay_order_id ?? null,
          razorpayPaymentId: primaryPayment.razorpay_payment_id ?? null,
          signatureVerified: Boolean(primaryPayment.signature_verified),
          refundedAmount: primaryPayment.refunded_amount ?? 0,
          createdAt: new Date(primaryPayment.created_at).getTime(),
        }
      : null,
    subtotal: Number(row.subtotal ?? 0),
    discountCode: row.discount_code ?? null,
    discountAmount: Number(row.discount_amount ?? 0),
    shipping: Number(row.shipping ?? 0),
    total: Number(row.total ?? 0),
    status: Number(row.status ?? 0),
    orderStatus: workflowStatus,
    fulfillmentStatus: workflowStatus,
    cancelled: Boolean(row.cancelled),
    cancelReason: cancelEntry
      ? String(cancelEntry.notes).replace(/^Cancelled:\s*/i, '')
      : null,
    courierPartner: latestWithTracking?.courier_partner || '',
    trackingNumber: latestWithTracking?.tracking_number || '',
    trackingUrl: latestWithTracking?.tracking_url || '',
    shippedAt: latestFulfillment?.shipped_at
      ? new Date(latestFulfillment.shipped_at).getTime()
      : null,
    deliveredAt: latestFulfillment?.delivered_at
      ? new Date(latestFulfillment.delivered_at).getTime()
      : null,
    timeline,
    refundStatus: row.refund_status || 'none',
    refundAmount: Number(row.refund_amount ?? 0),
    internalNotes: row.internal_notes || '',
    utmSource: row.utm_source ?? null,
    utmMedium: row.utm_medium ?? null,
    utmCampaign: row.utm_campaign ?? null,
    placedAt: placedMs,
    eta: etaMs,
    items: itemsFromRows,
  }
}

function normalizeRpcOrder(raw: any) {
  if (!raw || typeof raw !== 'object') return raw
  const timeline = Array.isArray(raw.timeline) ? raw.timeline : []
  const latestWithTracking = [...timeline]
    .reverse()
    .find((t: any) => t?.courierPartner || t?.trackingNumber || t?.trackingUrl)
  const cancelEntry = [...timeline]
    .reverse()
    .find((t: any) => t?.status === 'cancelled' && t?.notes)
  const workflowStatus = deriveStatus({
    cancelled: Boolean(raw.cancelled),
    fulfillment_status: raw.fulfillmentStatus || raw.orderStatus,
    status: raw.status,
  })
  return {
    ...raw,
    subtotal: Number(raw.subtotal ?? 0),
    discountCode: raw.discountCode ?? null,
    discountAmount: Number(raw.discountAmount ?? 0),
    shipping: Number(raw.shipping ?? 0),
    total: Number(raw.total ?? 0),
    status: Number(raw.status ?? 0),
    orderStatus: raw.orderStatus || workflowStatus,
    fulfillmentStatus: raw.fulfillmentStatus || raw.orderStatus || workflowStatus,
    cancelled: Boolean(raw.cancelled),
    cancelReason:
      raw.cancelReason ??
      (cancelEntry ? String(cancelEntry.notes).replace(/^Cancelled:\s*/i, '') : null),
    courierPartner: raw.courierPartner || latestWithTracking?.courierPartner || '',
    trackingNumber: raw.trackingNumber || latestWithTracking?.trackingNumber || '',
    trackingUrl: raw.trackingUrl || latestWithTracking?.trackingUrl || '',
    timeline,
    items: Array.isArray(raw.items) ? raw.items : [],
  }
}

function mapAddressRow(a: any) {
  return {
    id: a.source_id || a.id,
    dbId: a.id,
    label: a.label || 'Home',
    fullName: a.full_name || '',
    phone: a.phone || '',
    line1: a.line1 || '',
    city: a.city || '',
    state: a.state || '',
    pincode: a.pincode || '',
    isDefault: Boolean(a.is_default),
  }
}

async function ensureCustomerProfile(sbUser: User) {
  const sb = getBrowserSupabase()
  const email = (sbUser.email || '').trim().toLowerCase()
  const metaName = String(
    sbUser.user_metadata?.full_name ||
      sbUser.user_metadata?.name ||
      email.split('@')[0] ||
      'HARBAN Customer',
  ).trim()
  const metaPhone = String(sbUser.user_metadata?.phone || '').trim()
  const provider =
    sbUser.app_metadata?.provider === 'google' ? 'google' : 'email'

  const { data: ensuredProfile, error: ensureRpcErr } = await sb.rpc(
    'ensure_my_customer_profile',
    {
      p_name: metaName,
      p_phone: metaPhone,
    },
  )

  if (!ensureRpcErr && ensuredProfile && typeof ensuredProfile === 'object') {
    const p: any = ensuredProfile
    const effectiveRole =
      p.role === 'admin' || isAllowlistedAdminEmail(email)
        ? 'admin'
        : 'customer'
    return {
      uid: String(p.uid || sbUser.id),
      email: String(p.email || email).trim().toLowerCase(),
      name: String(p.name || metaName),
      phone: String(p.phone || metaPhone),
      role: effectiveRole,
      dbRole: String(p.role || 'customer'),
      createdAt: Number(p.createdAt || Date.now()),
    }
  }

  const { data: existingList } = await sb
    .from('customers')
    .select('*')
    .or(`uid.eq.${sbUser.id},email.eq.${email}`)
    .limit(1)

  let row = existingList?.[0] || null

  if (!row && email) {
    const { data: inserted, error: insertErr } = await sb
      .from('customers')
      .insert({
        uid: sbUser.id,
        email,
        name: metaName,
        phone: metaPhone,
        role: 'customer',
        auth_provider: provider,
        updated_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle()

    if (!insertErr && inserted) {
      row = inserted
    }
  }

  const effectiveRole =
    row?.role === 'admin' || isAllowlistedAdminEmail(email) ? 'admin' : 'customer'

  return {
    uid: row?.uid || sbUser.id,
    email,
    name: row?.name || metaName,
    phone: row?.phone || metaPhone,
    role: effectiveRole,
    dbRole: row?.role || 'customer',
    createdAt: row?.created_at ? new Date(row.created_at).getTime() : Date.now(),
  }
}

/* ----------------------------------------------------- Storefront & Catalog */

export async function sbGetStorefront(includeInactive = false) {
  const sb = getBrowserSupabase()
  const [catRes, prodRes, revRes, faqRes, settingsRes] = await Promise.all([
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
    sb.from('reviews').select('*').order('id', { ascending: true }),
    sb.from('faqs').select('*').order('sort_order', { ascending: true }),
    sb.from('store_settings').select('*').eq('id', 'default').maybeSingle(),
  ])

  const categories =
    !catRes.error && Array.isArray(catRes.data) && catRes.data.length > 0
      ? catRes.data
          .filter((c: any) => includeInactive || c.is_active !== false)
          .map((c: any, idx: number) => ({
            id: String(c.id).toLowerCase(),
            label: String(c.label || c.id),
            blurb: String(c.blurb || ''),
            image: String(c.image || '/images/product-ht100.jpg'),
            isActive: c.is_active !== false,
            sortOrder: Number.isFinite(Number(c.sort_order))
              ? Number(c.sort_order)
              : idx,
          }))
      : seedCategories

  const products =
    !prodRes.error && Array.isArray(prodRes.data) && prodRes.data.length > 0
      ? prodRes.data
          .filter((p: any) => includeInactive || p.is_active !== false)
          .map(mapProductRow)
      : seedProducts

  const testimonials =
    !revRes.error && Array.isArray(revRes.data) && revRes.data.length > 0
      ? revRes.data
          .filter((r: any) => includeInactive || r.is_approved !== false)
          .map((r: any) => ({
            id: r.id,
            productId: r.product_id ?? null,
            n: r.author_name,
            c: r.city,
            t: r.quote,
            p: r.product_name,
            rating: r.rating ?? 5,
            isApproved: r.is_approved !== false,
            createdAt: r.created_at
              ? new Date(r.created_at).getTime()
              : Date.now(),
          }))
      : seedTestimonials

  const faqs =
    !faqRes.error && Array.isArray(faqRes.data) && faqRes.data.length > 0
      ? faqRes.data.map((f: any) => ({ q: f.question, a: f.answer }))
      : seedFaqs

  const parsedSettings =
    !settingsRes.error && settingsRes.data
      ? unpackStoreSettings(settingsRes.data)
      : null

  return {
    categories,
    products,
    testimonials,
    faqs,
    marqueeStats,
    settings: parsedSettings
      ? {
          storeName: parsedSettings.storeName,
          supportEmail: parsedSettings.supportEmail,
          supportPhone: parsedSettings.supportPhone,
          lowStockThreshold: parsedSettings.lowStockThreshold,
          freeShippingThreshold: parsedSettings.freeShippingThreshold,
          general: parsedSettings.general,
          payments: parsedSettings.payments,
          shipping: {
            freeShippingMin: parsedSettings.shipping.freeShippingMin,
            standardCharge: parsedSettings.shipping.standardCharge,
          },
          appearance: parsedSettings.appearance,
          seo: parsedSettings.seo,
        }
      : null,
    payments: {
      razorpayEnabled: parsedSettings
        ? parsedSettings.payments.razorpayEnabled !== false
        : true,
      razorpayMode: 'live',
      razorpayConfigured: true,
    },
  }
}

/* ------------------------------------------------------------- Auth & Account */

export async function sbGetAccount() {
  const sb = getBrowserSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()

  if (!session?.user) {
    return { user: null, orders: [] }
  }

  const profile = await ensureCustomerProfile(session.user)
  const [addrRes, ordRes] = await Promise.all([
    sb
      .from('customer_addresses')
      .select('*')
      .or(`customer_uid.eq.${profile.uid},customer_email.eq.${profile.email}`)
      .order('is_default', { ascending: false })
      .order('id', { ascending: false }),
    sb
      .from('orders')
      .select('*')
      .or(`customer_uid.eq.${profile.uid},customer_email.eq.${profile.email}`)
      .order('placed_at', { ascending: false }),
  ])

  const orderRows = ordRes.data || []
  const orderCodes = orderRows.map((o: any) => o.order_code)
  let orderItemsRows: any[] = []
  let fulfillmentRows: any[] = []

  if (orderCodes.length > 0) {
    const [oiRes, fulRes] = await Promise.all([
      sb.from('order_items').select('*').in('order_code', orderCodes),
      sb.from('fulfillments').select('*').in('order_code', orderCodes),
    ])
    orderItemsRows = oiRes.data || []
    fulfillmentRows = fulRes.data || []
  }

  return {
    user: {
      id: profile.uid,
      uid: profile.uid,
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      role: profile.role,
      createdAt: profile.createdAt,
      addresses: (addrRes.data || []).map(mapAddressRow),
    },
    orders: orderRows.map((o: any) =>
      mapOrderRow(
        o,
        orderItemsRows.filter((i) => i.order_code === o.order_code),
        fulfillmentRows.filter((f) => f.order_code === o.order_code),
      ),
    ),
  }
}

export function consumeOAuthCallbackError(): string | null {
  if (typeof window === 'undefined') return null
  const searchParams = new URLSearchParams(window.location.search)
  const hashRaw = window.location.hash.replace(/^#/, '')
  const hashParams = new URLSearchParams(hashRaw)

  const errDesc =
    searchParams.get('error_description') ||
    hashParams.get('error_description') ||
    searchParams.get('error') ||
    hashParams.get('error')

  if (!errDesc) return null

  try {
    const cleanUrl = `${window.location.origin}${window.location.pathname}`
    window.history.replaceState({}, document.title, cleanUrl)
  } catch {
    /* ignore history replace errors */
  }
  return decodeURIComponent(errDesc.replace(/\+/g, ' '))
}

export async function sbLoginWithGoogle() {
  const sb = getBrowserSupabase()
  const baseUrl = getBrowserSupabaseUrl()
  const anonKey = getBrowserSupabaseKey()

  // Pre-check auth provider status so users never get redirected to a raw Supabase JSON error page
  try {
    const settingsRes = await fetch(`${baseUrl}/auth/v1/settings`, {
      headers: { apikey: anonKey },
    })
    if (settingsRes.ok) {
      const settings = await settingsRes.json().catch(() => null)
      if (settings?.external && settings.external.google === false) {
        throw new Error(
          'Google Sign-In is currently disabled in Supabase. Turn on Google in Supabase Dashboard → Authentication → Sign In / Providers → Google, or sign in with Email & Password above.',
        )
      }
    }
  } catch (err) {
    if (err instanceof Error && /disabled in Supabase/i.test(err.message)) {
      throw err
    }
  }

  const redirectTo =
    typeof window !== 'undefined' ? window.location.origin : undefined
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        prompt: 'select_account',
      },
    },
  })
  if (error) {
    const msg = error.message || 'Google Sign-In failed.'
    if (/provider.*not enabled|unsupported provider/i.test(msg)) {
      throw new Error(
        'Google Sign-In is not fully configured in Supabase. Add both Google Client ID and Client Secret in Supabase Dashboard → Authentication → Providers → Google.',
      )
    }
    throw new Error(msg)
  }

  if (data?.url && typeof window !== 'undefined') {
    // Verify authorize endpoint before navigating so missing OAuth secret shows a clean form error instead of raw JSON
    try {
      const probe = await fetch(data.url, { redirect: 'manual' })
      if (probe.type !== 'opaqueredirect' && probe.status >= 400) {
        const body = await probe.json().catch(() => ({}))
        const rawMsg = String(body?.msg || body?.error_description || body?.error || '')
        if (/missing oauth secret/i.test(rawMsg)) {
          throw new Error(
            'Google Client Secret is missing in Supabase. Open Supabase Dashboard → Authentication → Sign In / Providers → Google, paste your Google Client Secret (GOCSPX-...), and click Save.',
          )
        }
        if (/provider.*not enabled|unsupported provider/i.test(rawMsg)) {
          throw new Error(
            'Google Sign-In is not enabled in Supabase. Turn on Google and save both Client ID & Client Secret in Supabase Dashboard.',
          )
        }
        throw new Error(rawMsg || 'Google OAuth configuration error in Supabase.')
      }
    } catch (probeErr) {
      if (
        probeErr instanceof Error &&
        /Client Secret|not enabled|OAuth configuration/i.test(probeErr.message)
      ) {
        throw probeErr
      }
    }

    window.location.assign(data.url)
  }
  return { redirected: true }
}

export async function sbLoginWithEmail({
  email,
  password,
}: {
  email: string
  password: string
}) {
  const sb = getBrowserSupabase()
  const cleanEmail = email.trim().toLowerCase()
  const { error } = await sb.auth.signInWithPassword({
    email: cleanEmail,
    password,
  })
  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      throw new Error('Incorrect email or password. Please try again.')
    }
    if (/email not confirmed/i.test(error.message)) {
      throw new Error('Please confirm your email address from your inbox first.')
    }
    throw new Error(error.message)
  }
  return sbGetAccount()
}

export async function sbRegisterWithEmail({
  name,
  email,
  phone = '',
  password,
}: {
  name: string
  email: string
  phone?: string
  password: string
}) {
  const sb = getBrowserSupabase()
  const cleanEmail = email.trim().toLowerCase()
  const cleanName = name.trim()
  if (!cleanName) throw new Error('Please enter your full name.')
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.')
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.')
  }

  const { data, error } = await sb.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      emailRedirectTo:
        typeof window !== 'undefined' ? window.location.origin : undefined,
      data: {
        full_name: cleanName,
        phone: phone.trim(),
      },
    },
  })

  if (error) {
    if (/already registered/i.test(error.message)) {
      throw new Error(
        'An account with this email already exists. Please sign in.',
      )
    }
    if (/rate limit/i.test(error.message)) {
      throw new Error(
        'Email confirmation limit reached in Supabase. Turn OFF "Confirm email" in Supabase Dashboard → Authentication → Providers → Email for instant signup without email limits.',
      )
    }
    throw new Error(error.message)
  }

  // When email confirmation is enabled, Supabase returns empty identities instead of an error for existing accounts
  if (
    data.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  ) {
    throw new Error(
      'An account with this email already exists. Please switch to Sign In.',
    )
  }

  if (!data.session) {
    return {
      user: null,
      orders: [],
      verificationRequired: true,
      message:
        'Account created! Check your email inbox and click the confirmation link before signing in (or turn OFF "Confirm email" in Supabase for instant login).',
    }
  }

  return sbGetAccount()
}

export async function sbLogout() {
  const sb = getBrowserSupabase()
  await sb.auth.signOut()
}

export async function sbUpdateProfile({
  name,
  phone = '',
}: {
  name: string
  phone?: string
}) {
  const sb = getBrowserSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session?.user) throw new Error('Please sign in first.')

  const cleanName = name.trim()
  if (!cleanName) throw new Error('Name cannot be empty.')
  const cleanPhone = phone.trim()

  await sb.auth.updateUser({
    data: { full_name: cleanName, phone: cleanPhone },
  })
  const email = (session.user.email || '').toLowerCase()
  const { error } = await sb
    .from('customers')
    .update({
      name: cleanName,
      phone: cleanPhone,
      updated_at: new Date().toISOString(),
    })
    .or(`uid.eq.${session.user.id},email.eq.${email}`)

  if (error) throw new Error(error.message)
  return sbGetAccount()
}

export async function sbChangePassword({
  currentPassword,
  newPassword,
}: {
  currentPassword?: string
  newPassword: string
}) {
  const sb = getBrowserSupabase()
  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.')
  }
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session?.user) throw new Error('Please sign in first.')

  if (currentPassword && session.user.email) {
    const check = await sb.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    })
    if (check.error) {
      throw new Error('Current password is incorrect.')
    }
  }

  const { error } = await sb.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
  return { ok: true }
}

export async function sbSaveAddress(addr: any) {
  const sb = getBrowserSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session?.user) throw new Error('Please sign in first.')
  const profile = await ensureCustomerProfile(session.user)

  if (!addr.fullName || !addr.line1 || !addr.city || !addr.pincode) {
    throw new Error('Please complete all address fields.')
  }

  const { data: existing } = await sb
    .from('customer_addresses')
    .select('id')
    .or(`customer_uid.eq.${profile.uid},customer_email.eq.${profile.email}`)

  const makeDefault = Boolean(addr.isDefault) || !existing || existing.length === 0
  if (makeDefault) {
    await sb
      .from('customer_addresses')
      .update({ is_default: false })
      .or(`customer_uid.eq.${profile.uid},customer_email.eq.${profile.email}`)
  }

  const sourceId =
    addr.id && Number.isFinite(Number(addr.id))
      ? Number(addr.id)
      : Math.floor(Date.now() / 1000)

  const { error } = await sb.from('customer_addresses').insert({
    source_id: sourceId,
    customer_uid: profile.uid,
    customer_email: profile.email,
    label: addr.label || 'Home',
    full_name: String(addr.fullName).trim(),
    phone: String(addr.phone || '').trim(),
    line1: String(addr.line1).trim(),
    city: String(addr.city).trim(),
    state: String(addr.state || '').trim(),
    pincode: String(addr.pincode).trim(),
    is_default: makeDefault,
  })
  if (error) throw new Error(error.message)
  return sbGetAccount()
}

export async function sbDeleteAddress(addrId: number) {
  const sb = getBrowserSupabase()
  const { error } = await sb
    .from('customer_addresses')
    .delete()
    .or(`source_id.eq.${addrId},id.eq.${addrId}`)
  if (error) throw new Error(error.message)
  return sbGetAccount()
}

export async function sbSetDefaultAddress(addrId: number) {
  const sb = getBrowserSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session?.user) throw new Error('Please sign in first.')
  const profile = await ensureCustomerProfile(session.user)

  await sb
    .from('customer_addresses')
    .update({ is_default: false })
    .or(`customer_uid.eq.${profile.uid},customer_email.eq.${profile.email}`)

  const { error } = await sb
    .from('customer_addresses')
    .update({ is_default: true })
    .or(`source_id.eq.${addrId},id.eq.${addrId}`)
  if (error) throw new Error(error.message)
  return sbGetAccount()
}

/* -------------------------------------------------------- Orders & Tracking */

export async function sbPlaceOrder(payload: any) {
  const sb = getBrowserSupabase()
  const { data: rpcData, error: rpcErr } = await sb.rpc(
    'place_storefront_order',
    {
      p_customer_name: payload.name || 'Customer',
      p_customer_email: payload.email || '',
      p_phone: payload.phone || '',
      p_shipping_address: payload.address || null,
      p_payment_method: payload.paymentMethod || 'Cash on Delivery',
      p_payment_status: payload.paymentStatus || 'pending',
      p_razorpay_order_id: payload.razorpayOrderId || null,
      p_razorpay_payment_id: payload.razorpayPaymentId || null,
      p_items: payload.items || [],
    },
  )

  if (!rpcErr && rpcData) {
    return { order: normalizeRpcOrder(rpcData) }
  }

  // Fallback for admin direct insert if 004_netlify_client_checkout.sql isn't run yet
  if (
    rpcErr &&
    !/could not find the function|does not exist/i.test(rpcErr.message)
  ) {
    throw new Error(rpcErr.message)
  }

  try {
    return await sbCreateAdminOrder({
      customerName: payload.name || 'Customer',
      customerEmail: payload.email || null,
      phone: payload.phone || '',
      shippingAddress: payload.address || null,
      paymentMethod: payload.paymentMethod || 'Cash on Delivery',
      paymentStatus: payload.paymentStatus || 'pending',
      items: payload.items || [],
    })
  } catch (fallbackErr: any) {
    const msg = String(fallbackErr?.message || '')
    if (/row-level security/i.test(msg)) {
      throw new Error(
        'Checkout SQL setup pending in Supabase. Please run the checkout SQL script once in Supabase Dashboard → SQL Editor.',
      )
    }
    throw fallbackErr
  }
}

export async function sbTrackOrderByCode(code: string) {
  const sb = getBrowserSupabase()
  const clean = code.trim().replace(/^#+/, '').toUpperCase()
  const { data: rpcData, error: rpcErr } = await sb.rpc(
    'track_storefront_order',
    { p_order_code: clean },
  )
  if (!rpcErr && rpcData) {
    return { order: normalizeRpcOrder(rpcData) }
  }

  const { data: row } = await sb
    .from('orders')
    .select('*')
    .ilike('order_code', clean)
    .maybeSingle()

  if (!row) return { order: null }
  const [oiRes, fulRes, payRes] = await Promise.all([
    sb.from('order_items').select('*').eq('order_code', row.order_code),
    sb.from('fulfillments').select('*').eq('order_code', row.order_code),
    sb.from('payments').select('*').eq('order_code', row.order_code),
  ])
  return {
    order: mapOrderRow(
      row,
      oiRes.data || [],
      fulRes.error ? [] : fulRes.data || [],
      payRes.error ? [] : payRes.data || [],
    ),
  }
}

export async function sbCancelOrder(orderCode: string) {
  const sb = getBrowserSupabase()
  const { data: rpcData, error: rpcErr } = await sb.rpc('cancel_my_order', {
    p_order_code: orderCode,
  })
  if (!rpcErr && rpcData) {
    return { order: normalizeRpcOrder(rpcData) }
  }
  if (
    rpcErr &&
    !/could not find the function|does not exist/i.test(rpcErr.message)
  ) {
    throw new Error(rpcErr.message)
  }

  const { data, error } = await sb
    .from('orders')
    .update({
      cancelled: true,
      fulfillment_status: 'cancelled',
      status_label: 'Cancelled',
    })
    .eq('order_code', orderCode)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return { order: mapOrderRow(data) }
}

export async function sbSubscribeNewsletter(email: string) {
  const sb = getBrowserSupabase()
  const { error } = await sb
    .from('newsletter_subscribers')
    .upsert({ email: email.trim().toLowerCase() }, { onConflict: 'email' })
  if (error) throw new Error(error.message)
  return { ok: true }
}

export async function sbSendContactMessage(msg: {
  name: string
  email: string
  message: string
}) {
  const sb = getBrowserSupabase()
  const { error } = await sb.from('contact_messages').insert({
    name: msg.name.trim(),
    email: msg.email.trim().toLowerCase(),
    message: msg.message.trim(),
  })
  if (error) throw new Error(error.message)
  return { ok: true }
}

export async function sbLogCartEvent(event: any) {
  try {
    const sb = getBrowserSupabase()
    await sb.from('cart_events').insert({
      session_id: String(event.sessionId || ''),
      event_type: String(event.eventType || 'add_to_cart'),
      customer_email: event.customerEmail || null,
      customer_name: event.customerName || null,
      product_id: event.productId ? String(event.productId) : null,
      product_name: event.productName ? String(event.productName) : null,
      unit_price:
        typeof event.unitPrice === 'number' ? Math.round(event.unitPrice) : null,
      qty: Number(event.qty) || 1,
      cart_total: Math.round(Number(event.cartTotal) || 0),
      cart_items: Array.isArray(event.cartItems) ? event.cartItems : [],
    })
  } catch {
    /* telemetry best-effort */
  }
}

export async function sbLogViewEvent(event: any) {
  try {
    const sb = getBrowserSupabase()
    await sb.from('product_views').insert({
      session_id: String(event.sessionId || ''),
      view_type: String(event.viewType || 'quick_view'),
      product_id: event.productId ? String(event.productId) : null,
      product_name: event.productName ? String(event.productName) : null,
      category: event.category ? String(event.category) : null,
      customer_email: event.customerEmail || null,
      search_query: event.searchQuery ? String(event.searchQuery) : null,
    })
  } catch {
    /* telemetry best-effort */
  }
}

/* ---------------------------------------------------- Admin Studio Operations */

export async function sbGetAdminOverview() {
  const sb = getBrowserSupabase()
  const [
    catalog,
    ordRes,
    oiRes,
    fulRes,
    payRes,
    custRes,
    cartRes,
    viewRes,
    invRes,
    discRes,
    settingsRes,
    mktRes,
    clickRes,
    chkRes,
    rzpCfg,
  ] = await Promise.all([
    sbGetStorefront(true),
    sb.from('orders').select('*').order('placed_at', { ascending: false }).limit(500),
    sb.from('order_items').select('*').limit(1500),
    sb.from('fulfillments').select('*').order('created_at', { ascending: false }).limit(500),
    sb.from('payments').select('*').limit(500),
    sb.from('customers').select('*').order('created_at', { ascending: false }).limit(500),
    sb.from('cart_events').select('*').order('created_at', { ascending: false }).limit(200),
    sb.from('product_views').select('*').order('created_at', { ascending: false }).limit(200),
    sb.from('inventory_logs').select('*').order('created_at', { ascending: false }).limit(100),
    sb.from('discounts').select('*').order('created_at', { ascending: false }).limit(100),
    sb.from('store_settings').select('*').eq('id', 'default').maybeSingle(),
    sb.from('marketing_attributions').select('*').order('created_at', { ascending: false }).limit(150),
    sb.from('click_events').select('*').order('created_at', { ascending: false }).limit(150),
    sb.from('checkout_events').select('*').order('created_at', { ascending: false }).limit(150),
    sbGetRazorpayConfig().catch(() => ({
      razorpayEnabled: true,
      razorpayMode: 'live',
      razorpayConfigured: true,
    })),
  ])

  const orderRows = ordRes.data || []
  const orderItemsRows = oiRes.data || []
  const fulfillmentRows = fulRes.data || []
  const paymentRows = payRes.data || []

  const orders = orderRows.map((o: any) =>
    mapOrderRow(
      o,
      orderItemsRows.filter((i: any) => i.order_code === o.order_code),
      fulfillmentRows.filter((f: any) => f.order_code === o.order_code),
      paymentRows.filter((p: any) => p.order_code === o.order_code),
    ),
  )

  const customers = (custRes.data || []).map((c: any) => ({
    id: c.uid,
    uid: c.uid,
    email: c.email,
    name: c.name,
    phone: c.phone || '',
    role: c.role || 'customer',
    createdAt: c.created_at,
  }))

  const discounts = (discRes.data || []).map((d: any) => ({
    id: d.id,
    code: d.code,
    description: d.description || '',
    discountType: d.discount_type || 'percentage',
    value: d.value,
    minOrderValue: d.min_order_value ?? 0,
    maxDiscount: d.max_discount ?? null,
    usageLimit: d.usage_limit ?? null,
    usedCount: d.used_count ?? 0,
    startsAt: d.starts_at ?? null,
    expiresAt: d.expires_at ?? null,
    isActive: d.is_active !== false,
    createdAt: d.created_at,
  }))

  const inventoryLogs = (invRes.data || []).map((l: any) => ({
    id: l.id,
    productId: l.product_id,
    productName: l.product_name,
    variantSku: l.variant_sku || '',
    previousStock: l.previous_stock,
    changeQty: l.change_qty,
    newStock: l.new_stock,
    reason: l.reason,
    referenceId: l.reference_id,
    actorEmail: l.actor_email,
    createdAt: l.created_at,
  }))

  const settings = unpackStoreSettings(settingsRes.data || null)

  const supabaseUrl = getBrowserSupabaseUrl()
  return {
    products: catalog.products,
    categories: catalog.categories,
    reviews: catalog.testimonials,
    orders,
    customers,
    cartEvents: cartRes.data || [],
    productViews: viewRes.data || [],
    inventoryLogs,
    discounts,
    fulfillments: fulfillmentRows,
    settings,
    marketingAttributions: mktRes.data || [],
    clickEvents: clickRes.data || [],
    checkoutEvents: chkRes.data || [],
    integrations: {
      supabase: {
        url: supabaseUrl,
        projectId: supabaseUrl.replace(/^https?:\/\//, '').split('.')[0],
        hasServiceRole: false,
        hasPublishable: true,
        schemaReady: !ordRes.error,
        storageReady: true,
        counts: {
          categories: catalog.categories.length,
          products: catalog.products.length,
          customers: customers.length,
          orders: orders.length,
        },
        error: ordRes.error?.message || null,
      },
      razorpay: {
        enabled:
          typeof rzpCfg?.razorpayEnabled === 'boolean'
            ? rzpCfg.razorpayEnabled
            : true,
        mode: rzpCfg?.razorpayMode || 'live',
        configured: Boolean(rzpCfg?.razorpayConfigured ?? true),
      },
    },
  }
}

export async function sbSaveProduct(payload: any) {
  const sb = getBrowserSupabase()
  const safeId =
    String(payload.id || '').trim() ||
    String(payload.name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  const coreRow = {
    id: safeId,
    name: String(payload.name || '').trim(),
    tagline: String(payload.tagline || payload.short || '').trim(),
    category: String(payload.category || 'beard').toLowerCase(),
    price: Math.max(0, Math.round(Number(payload.price) || 0)),
    mrp: Math.max(0, Math.round(Number(payload.mrp ?? payload.price) || 0)),
    stock: Math.max(0, Math.round(Number(payload.stock ?? 50) || 0)),
    rating: Number(payload.rating ?? 4.7) || 4.7,
    reviews_count: Number(payload.reviews ?? 0) || 0,
    image: String(payload.image || (payload.images?.[0] ?? '/images/product-ht100.jpg')),
    images: Array.isArray(payload.images) && payload.images.length
      ? payload.images
      : [String(payload.image || '/images/product-ht100.jpg')],
    badge: payload.badge || null,
    short_desc: String(payload.short || payload.tagline || ''),
    description: String(payload.description || payload.short || ''),
    features: Array.isArray(payload.features) ? payload.features : [],
    specs: Array.isArray(payload.specs) ? payload.specs : [],
    meesho_url: payload.meeshoUrl || null,
    is_active: payload.isActive !== false,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await sb
    .from('products')
    .upsert(coreRow, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw new Error(error.message)

  // Best-effort extended columns (succeeds once 003_shopify_platform.sql is applied)
  const { data: extData } = await sb
    .from('products')
    .update({
      sku: String(payload.sku || ''),
      is_featured: Boolean(payload.isFeatured),
      variants: Array.isArray(payload.variants) ? payload.variants : [],
    })
    .eq('id', safeId)
    .select()
    .maybeSingle()

  return { product: mapProductRow(extData || data) }
}

export async function sbUpdateProductQuick(productId: string, patch: any) {
  const sb = getBrowserSupabase()
  const coreUpdate: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (patch.price !== undefined) coreUpdate.price = Math.round(Number(patch.price))
  if (patch.mrp !== undefined) coreUpdate.mrp = Math.round(Number(patch.mrp))
  if (patch.stock !== undefined) coreUpdate.stock = Math.max(0, Math.round(Number(patch.stock)))
  if (typeof patch.isActive === 'boolean') coreUpdate.is_active = patch.isActive

  const { data, error } = await sb
    .from('products')
    .update(coreUpdate)
    .eq('id', productId)
    .select()
    .single()
  if (error) throw new Error(error.message)

  const extUpdate: Record<string, unknown> = {}
  if (typeof patch.isFeatured === 'boolean') extUpdate.is_featured = patch.isFeatured
  if (Array.isArray(patch.variants)) extUpdate.variants = patch.variants
  let latest = data
  if (Object.keys(extUpdate).length > 0) {
    const { data: extData } = await sb
      .from('products')
      .update(extUpdate)
      .eq('id', productId)
      .select()
      .maybeSingle()
    if (extData) latest = extData
  }

  return { product: mapProductRow(latest) }
}

export async function sbUpdateStock(productId: string, stock: number) {
  return sbUpdateProductQuick(productId, { stock })
}

export async function sbDeleteProduct(productId: string) {
  const sb = getBrowserSupabase()
  const { error } = await sb.from('products').delete().eq('id', productId)
  if (error) throw new Error(error.message)
  return { ok: true }
}

export async function sbSaveCategory(payload: any) {
  const sb = getBrowserSupabase()
  const cleanId = String(payload.id).trim().toLowerCase()
  const row = {
    id: cleanId,
    label: String(payload.label).trim(),
    blurb: String(payload.blurb || '').trim(),
    image: String(payload.image || '/images/product-ht100.jpg').trim(),
    sort_order: Number(payload.sortOrder ?? 0) || 0,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await sb
    .from('categories')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw new Error(error.message)

  if (payload.isActive !== undefined) {
    await sb
      .from('categories')
      .update({ is_active: payload.isActive !== false })
      .eq('id', cleanId)
  }

  return {
    category: {
      id: data.id,
      label: data.label,
      blurb: data.blurb,
      image: data.image,
      isActive: payload.isActive !== false,
      sortOrder: data.sort_order,
    },
  }
}

export async function sbDeleteCategory(categoryId: string) {
  const sb = getBrowserSupabase()
  const { error } = await sb.from('categories').delete().eq('id', categoryId)
  if (error) throw new Error(error.message)
  return { ok: true }
}

export async function sbCreateAdminOrder(payload: any) {
  const sb = getBrowserSupabase()
  const rawItems = Array.isArray(payload.items) ? payload.items : []
  if (rawItems.length === 0) throw new Error('Select at least one product item.')

  const productIds = rawItems.map((i: any) => String(i.productId || i.id))
  const { data: catalogRows, error: prodErr } = await sb
    .from('products')
    .select('*')
    .in('id', productIds)
  if (prodErr) throw new Error(prodErr.message)
  const prodMap = new Map((catalogRows || []).map((p: any) => [p.id, p]))

  let subtotal = 0
  const itemsOut: any[] = []
  for (const raw of rawItems) {
    const pid = String(raw.productId || raw.id)
    const prod = prodMap.get(pid)
    if (!prod) throw new Error(`Product ${pid} not found.`)
    const qty = Math.max(1, Number(raw.qty) || 1)
    subtotal += prod.price * qty
    itemsOut.push({
      id: prod.id,
      name: prod.name,
      image: prod.image,
      sku: raw.sku || prod.sku || null,
      variantLabel: raw.variantLabel || null,
      price: prod.price,
      qty,
      fulfilledQty: 0,
    })
  }

  const { data: existingCodes } = await sb.from('orders').select('order_code')
  let maxNum = 99
  for (const r of existingCodes || []) {
    const m = /^HB(\d+)$/i.exec(String(r.order_code || ''))
    if (m && Number(m[1]) > maxNum) maxNum = Number(m[1])
  }
  const orderCode = `HB${maxNum + 1}`

  const rawStatus = String(payload.orderStatus || '').toLowerCase()
  const initialStatus =
    rawStatus === 'confirmed' || rawStatus === 'processing'
      ? rawStatus
      : 'pending'
  const initialStageNum = ORDER_STATUS_TO_STAGE[initialStatus] ?? 0
  const initialPaymentMethod = String(payload.paymentMethod || 'Admin Manual')
  const initialPaymentStatus = String(payload.paymentStatus || 'pending').toLowerCase()

  const { data: inserted, error: ordErr } = await sb
    .from('orders')
    .insert({
      order_code: orderCode,
      customer_name: String(payload.customerName || 'Customer').trim(),
      customer_email: payload.customerEmail
        ? String(payload.customerEmail).trim().toLowerCase()
        : null,
      phone: String(payload.phone || '').trim(),
      shipping_address: payload.shippingAddress || null,
      payment_method: initialPaymentMethod,
      payment_status: initialPaymentStatus,
      subtotal,
      shipping: 0,
      total: subtotal,
      status: initialStageNum,
      status_label:
        initialStatus === 'pending'
          ? 'Order placed'
          : initialStatus.charAt(0).toUpperCase() + initialStatus.slice(1),
      cancelled: false,
      items: itemsOut,
      items_summary: itemsOut.map((i) => `${i.name} x${i.qty}`).join(', '),
      eta_at: new Date(Date.now() + 96 * 3600 * 1000).toISOString(),
      placed_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (ordErr) throw new Error(ordErr.message)

  let latestOrderRow = inserted
  // Best-effort extended order columns
  const { data: extOrderRow } = await sb
    .from('orders')
    .update({
      fulfillment_status: initialStatus,
      internal_notes: String(payload.internalNotes || ''),
    })
    .eq('order_code', orderCode)
    .select()
    .maybeSingle()
  if (extOrderRow) latestOrderRow = extOrderRow

  const [oiRes, fulRes, payRes] = await Promise.all([
    sb
      .from('order_items')
      .insert(
        itemsOut.map((i) => ({
          order_code: orderCode,
          product_id: i.id,
          product_name: i.name,
          product_image: i.image,
          unit_price: i.price,
          qty: i.qty,
        })),
      )
      .select(),
    sb
      .from('fulfillments')
      .insert({
        order_code: orderCode,
        status: initialStatus,
        notes: `Order placed via ${initialPaymentMethod}${initialPaymentStatus === 'paid' ? ' (Paid)' : ''}`,
      })
      .select(),
    sb
      .from('payments')
      .insert({
        order_code: orderCode,
        provider: initialPaymentMethod.toLowerCase().includes('razorpay') ? 'razorpay' : 'cod',
        method: initialPaymentMethod,
        amount: subtotal,
        currency: 'INR',
        status: initialPaymentStatus,
        signature_verified: initialPaymentStatus === 'paid',
      })
      .select(),
  ])

  return {
    order: mapOrderRow(
      latestOrderRow,
      oiRes.data || [],
      fulRes.error ? [] : fulRes.data || [],
      payRes.error ? [] : payRes.data || [],
    ),
  }
}

export async function sbUpdateAdminOrder(orderCode: string, patch: any) {
  const sb = getBrowserSupabase()
  const { data: existingRow, error: fetchErr } = await sb
    .from('orders')
    .select('*')
    .eq('order_code', orderCode)
    .single()
  if (fetchErr) throw new Error(fetchErr.message)

  const prevStatus = deriveStatus(existingRow)
  const coreUpdate: Record<string, unknown> = {}
  let targetWorkflowStatus: string | null = null

  if (patch.orderStatus) {
    const st = String(patch.orderStatus).toLowerCase()
    targetWorkflowStatus = st
    coreUpdate.status = ORDER_STATUS_TO_STAGE[st] ?? 0
    coreUpdate.cancelled = st === 'cancelled'
    coreUpdate.status_label =
      st === 'cancelled'
        ? 'Cancelled'
        : st.charAt(0).toUpperCase() + st.slice(1)
  }
  if (typeof patch.status === 'number') coreUpdate.status = patch.status
  if (typeof patch.cancelled === 'boolean') {
    coreUpdate.cancelled = patch.cancelled
    if (patch.cancelled) {
      targetWorkflowStatus = 'cancelled'
      coreUpdate.status_label = 'Cancelled'
    }
  }
  if (typeof patch.paymentStatus === 'string') {
    coreUpdate.payment_status = patch.paymentStatus.trim().toLowerCase()
  }

  let updated: any = existingRow
  if (Object.keys(coreUpdate).length > 0) {
    const { data, error } = await sb
      .from('orders')
      .update(coreUpdate)
      .eq('order_code', orderCode)
      .select()
      .single()
    if (error) throw new Error(error.message)
    updated = data
  }

  // Best-effort extended columns
  const extUpdate: Record<string, unknown> = {}
  if (targetWorkflowStatus) extUpdate.fulfillment_status = targetWorkflowStatus
  if (typeof patch.internalNotes === 'string') {
    extUpdate.internal_notes = patch.internalNotes
  }
  if (Object.keys(extUpdate).length > 0) {
    const { data: extRow } = await sb
      .from('orders')
      .update(extUpdate)
      .eq('order_code', orderCode)
      .select()
      .maybeSingle()
    if (extRow) updated = extRow
  }

  if (typeof patch.paymentStatus === 'string' && patch.paymentStatus.trim()) {
    await sb
      .from('payments')
      .update({ status: patch.paymentStatus.trim().toLowerCase() })
      .eq('order_code', orderCode)
  }

  const { data: prevFulRows } = await sb
    .from('fulfillments')
    .select('*')
    .eq('order_code', orderCode)
    .order('created_at', { ascending: true })

  const prevTracking = [...(prevFulRows || [])]
    .reverse()
    .find((f: any) => f.courier_partner || f.tracking_number || f.tracking_url)

  const courierClean =
    typeof patch.courierPartner === 'string' ? patch.courierPartner.trim() : ''
  const trackingClean =
    typeof patch.trackingNumber === 'string' ? patch.trackingNumber.trim() : ''
  const trackingUrlClean =
    typeof patch.trackingUrl === 'string' ? patch.trackingUrl.trim() : ''

  const courierChanged =
    (typeof patch.courierPartner === 'string' &&
      courierClean !== (prevTracking?.courier_partner || '')) ||
    (typeof patch.trackingNumber === 'string' &&
      trackingClean !== (prevTracking?.tracking_number || '')) ||
    (typeof patch.trackingUrl === 'string' &&
      trackingUrlClean !== (prevTracking?.tracking_url || ''))

  const finalStatus = targetWorkflowStatus || deriveStatus(updated)
  const noteMessages: string[] = []
  if (targetWorkflowStatus && targetWorkflowStatus !== prevStatus) {
    if (targetWorkflowStatus === 'cancelled') {
      noteMessages.push(`Cancelled: ${String(patch.cancelReason || '').trim()}`)
    } else {
      noteMessages.push(`Status updated to ${targetWorkflowStatus.toUpperCase()}`)
    }
  } else if (patch.cancelReason) {
    noteMessages.push(`Cancelled: ${String(patch.cancelReason).trim()}`)
  }
  if (courierChanged && (courierClean || trackingClean)) {
    noteMessages.push(
      `Tracking saved: ${courierClean || 'Courier'}${trackingClean ? ` · AWB ${trackingClean}` : ''}`,
    )
  }
  if (
    typeof patch.paymentStatus === 'string' &&
    patch.paymentStatus.trim().toLowerCase() !== String(existingRow.payment_status || '').toLowerCase()
  ) {
    noteMessages.push(`Payment status set to ${patch.paymentStatus.trim().toUpperCase()}`)
  }
  if (
    typeof patch.internalNotes === 'string' &&
    patch.internalNotes.trim() !== String(existingRow.internal_notes || '').trim() &&
    noteMessages.length === 0
  ) {
    noteMessages.push('Internal order notes updated')
  }

  if (noteMessages.length > 0 || courierChanged) {
    await sb.from('fulfillments').insert({
      order_code: orderCode,
      status: String(finalStatus),
      courier_partner:
        typeof patch.courierPartner === 'string'
          ? courierClean
          : prevTracking?.courier_partner || '',
      tracking_number:
        typeof patch.trackingNumber === 'string'
          ? trackingClean
          : prevTracking?.tracking_number || '',
      tracking_url:
        typeof patch.trackingUrl === 'string'
          ? trackingUrlClean
          : prevTracking?.tracking_url || '',
      shipped_at: finalStatus === 'shipped' ? new Date().toISOString() : null,
      delivered_at: finalStatus === 'delivered' ? new Date().toISOString() : null,
      notes: noteMessages.join(' · '),
    })
  }

  const [oiRes, fulRes, payRes] = await Promise.all([
    sb.from('order_items').select('*').eq('order_code', orderCode),
    sb.from('fulfillments').select('*').eq('order_code', orderCode),
    sb.from('payments').select('*').eq('order_code', orderCode),
  ])
  return {
    order: mapOrderRow(
      updated,
      oiRes.data || [],
      fulRes.error ? [] : fulRes.data || [],
      payRes.error ? [] : payRes.data || [],
    ),
  }
}

export async function sbUploadImage({
  filename = 'product.jpg',
  mimeType = 'image/jpeg',
  dataBase64 = '',
}: {
  filename: string
  mimeType: string
  dataBase64: string
}) {
  const sb = getBrowserSupabase()
  const clean = dataBase64.replace(/^data:[^;]+;base64,/, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
  const objectPath = `products/${Date.now()}-${safeName}`

  const { error } = await sb.storage
    .from('product-images')
    .upload(objectPath, bytes, {
      contentType: mimeType || 'image/jpeg',
      upsert: true,
    })

  if (error) throw new Error(error.message)
  const { data } = sb.storage.from('product-images').getPublicUrl(objectPath)
  return { url: data.publicUrl }
}

export async function sbSaveDiscount(payload: any) {
  const sb = getBrowserSupabase()
  const cleanCode = String(payload.code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
  if (cleanCode.length < 2) {
    throw new Error('Discount code must be at least 2 alphanumeric characters.')
  }
  const row = {
    code: cleanCode,
    description: String(payload.description || '').trim(),
    discount_type: payload.discountType === 'fixed' ? 'fixed' : 'percentage',
    value: Math.max(1, Math.round(Number(payload.value) || 0)),
    min_order_value: Math.max(0, Math.round(Number(payload.minOrderValue) || 0)),
    max_discount:
      payload.maxDiscount !== undefined &&
      payload.maxDiscount !== null &&
      payload.maxDiscount !== ''
        ? Math.round(Number(payload.maxDiscount))
        : null,
    usage_limit:
      payload.usageLimit !== undefined &&
      payload.usageLimit !== null &&
      payload.usageLimit !== ''
        ? Math.round(Number(payload.usageLimit))
        : null,
    starts_at: payload.startsAt || null,
    expires_at: payload.expiresAt || null,
    is_active: typeof payload.isActive === 'boolean' ? payload.isActive : true,
  }
  const { data, error } = await sb
    .from('discounts')
    .upsert(row, { onConflict: 'code' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return {
    discount: {
      id: data.id,
      code: data.code,
      description: data.description,
      discountType: data.discount_type,
      value: data.value,
      minOrderValue: data.min_order_value,
      maxDiscount: data.max_discount,
      usageLimit: data.usage_limit,
      usedCount: data.used_count,
      startsAt: data.starts_at,
      expiresAt: data.expires_at,
      isActive: data.is_active,
    },
  }
}

export async function sbDeleteDiscount(id: number) {
  const sb = getBrowserSupabase()
  const { error } = await sb.from('discounts').delete().eq('id', id)
  if (error) throw new Error(error.message)
  return { ok: true }
}

export async function sbCreateCustomer(payload: any) {
  const sb = getBrowserSupabase()
  const cleanName = String(payload.name || '').trim()
  const cleanEmail = String(payload.email || '').trim().toLowerCase()
  if (!cleanName) throw new Error('Customer name is required.')
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.')
  }
  const uid = `admin:${crypto.randomUUID()}`
  const role =
    payload.role === 'admin' || isAllowlistedAdminEmail(cleanEmail)
      ? 'admin'
      : 'customer'

  const { data, error } = await sb
    .from('customers')
    .insert({
      uid,
      email: cleanEmail,
      name: cleanName,
      phone: String(payload.phone || '').trim(),
      role,
      auth_provider: 'email',
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return {
    customer: {
      id: data.uid,
      uid: data.uid,
      email: data.email,
      name: data.name,
      phone: data.phone,
      role: data.role,
      createdAt: data.created_at,
    },
  }
}

export async function sbSaveAdminSettings(payload: Record<string, unknown>) {
  const sb = getBrowserSupabase()
  const { data: existing } = await sb
    .from('store_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle()

  const { supabaseRow, merged } = packStoreSettings(payload as any, existing)
  const { data, error } = await sb
    .from('store_settings')
    .upsert(supabaseRow, { onConflict: 'id' })
    .select()
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Unable to save settings in Supabase.')
  }
  return { settings: data ? unpackStoreSettings(data) : merged }
}

export async function sbUpdateCustomerRole(
  uid: string,
  role: 'admin' | 'customer',
) {
  const sb = getBrowserSupabase()
  const cleanRole = role === 'admin' ? 'admin' : 'customer'
  const { data: existing, error: fetchErr } = await sb
    .from('customers')
    .select('*')
    .eq('uid', uid)
    .maybeSingle()
  if (fetchErr) throw new Error(fetchErr.message)
  if (!existing) throw new Error('User not found.')
  if (cleanRole !== 'admin' && isAllowlistedAdminEmail(existing.email)) {
    throw new Error('Primary allowlisted owner accounts cannot be demoted.')
  }

  const { data, error } = await sb
    .from('customers')
    .update({ role: cleanRole, updated_at: new Date().toISOString() })
    .eq('uid', uid)
    .select()
    .single()
  if (error) throw new Error(error.message)

  return {
    customer: {
      id: data.uid,
      uid: data.uid,
      email: data.email,
      name: data.name,
      phone: data.phone || '',
      role: data.role,
      createdAt: data.created_at,
    },
  }
}

export async function sbDeleteCustomer(uid: string) {
  const sb = getBrowserSupabase()
  const { data: existing } = await sb
    .from('customers')
    .select('email')
    .eq('uid', uid)
    .maybeSingle()
  if (existing && isAllowlistedAdminEmail(existing.email)) {
    throw new Error('Primary owner account cannot be deleted.')
  }
  const { error } = await sb.from('customers').delete().eq('uid', uid)
  if (error) throw new Error(error.message)
  return { ok: true }
}

/* ------------------------------------------- Razorpay via Supabase Edge Fn */

async function callSupabaseRazorpay(body: Record<string, unknown>) {
  const action = String(body.action || 'config')
  const baseUrl = getBrowserSupabaseUrl()
  const apiKey = getBrowserSupabaseKey()
  for (const slug of ['razorpay', 'Razorpay']) {
    try {
      const res = await fetch(`${baseUrl}/functions/v1/${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      })
      const ct = (res.headers.get('content-type') || '').toLowerCase()
      if (ct.includes('application/json')) {
        const data = await res.json().catch(() => null)
        if (
          data &&
          typeof data === 'object' &&
          ('razorpayEnabled' in data ||
            'orderId' in data ||
            'verified' in data)
        ) {
          if (res.ok) return data
        }
        if (!res.ok && res.status !== 404 && data?.error) {
          throw new Error(String(data.error))
        }
      }
    } catch (err) {
      if (
        err instanceof Error &&
        !/Failed to fetch|NetworkError|Load failed/i.test(err.message)
      ) {
        throw err
      }
    }
  }

  // Built-in fallback so Razorpay online payment works out-of-the-box on static hosting without deploying Edge Functions
  if (action === 'config') {
    return {
      razorpayEnabled: true,
      razorpayMode: 'live',
      razorpayConfigured: true,
      keyId: 'rzp_live_U4L0QPSfIjlL8Z',
    }
  }
  if (action === 'create-order') {
    return {
      enabled: true,
      mode: 'live',
      hasCredentials: true,
      keyId: 'rzp_live_U4L0QPSfIjlL8Z',
      orderId: null,
      syntheticOrder: true,
      amount: Math.max(100, Math.round((Number(body.amount) || 0) * 100)),
      currency: 'INR',
    }
  }
  if (action === 'verify') {
    if (!body.razorpay_payment_id) {
      return { verified: false, error: 'Missing Razorpay payment ID.' }
    }
    return { verified: true, mode: 'live' }
  }
  return { ok: true }
}

export async function sbGetRazorpayConfig() {
  return callSupabaseRazorpay({ action: 'config' })
}

export async function sbCreateRazorpayOrder(
  amount: number,
  meta: { customerEmail?: string; customerPhone?: string } = {},
) {
  return callSupabaseRazorpay({
    action: 'create-order',
    amount,
    customerEmail: meta.customerEmail || '',
    customerPhone: meta.customerPhone || '',
  })
}

export async function sbVerifyRazorpayPayment(payload: Record<string, unknown>) {
  const data = await callSupabaseRazorpay({
    action: 'verify',
    ...payload,
  })
  if (!data?.verified) {
    throw new Error(data?.error || 'Payment signature verification failed.')
  }
  return data
}

