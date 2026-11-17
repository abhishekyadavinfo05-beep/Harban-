import { and, asc, desc, eq, gte, inArray, or, sql } from 'drizzle-orm'
import {
  categories as seedCategories,
  faqs as seedFaqs,
  marqueeStats,
  products as seedProducts,
  testimonials as seedReviews,
} from '../data/products.js'
import {
  deleteCategoryFromSupabase,
  deleteDiscountFromSupabase,
  deleteOrderFromSupabaseByCode,
  deleteProductFromSupabase,
  fetchCatalogFromSupabase,
  logCartEventToSupabase,
  logProductViewToSupabase,
  syncCatalogToSupabase,
  syncCategoryToSupabase,
  syncDiscountToSupabase,
  syncOrderToSupabase,
  syncProductToSupabase,
} from '../lib/supabase.ts'
import { db } from './index.ts'
import {
  type ProductVariantOption,
  type ShippingAddressSnapshot,
  cartEvents,
  categories,
  checkoutEvents,
  clickEvents,
  contactMessages,
  discounts,
  faqs,
  fulfillments,
  inventoryLogs,
  marketingAttributions,
  newsletterSubscribers,
  orderItems,
  orders,
  payments,
  productImages,
  productVariants,
  productViews,
  products,
  reviews,
  storeSettings,
} from './schema.ts'

let seedPromise: Promise<void> | null = null

export async function seedStorefrontIfEmpty() {
  if (seedPromise) return seedPromise

  seedPromise = (async () => {
    try {
      const existingCats = await db.select().from(categories).limit(1)
      if (existingCats.length === 0) {
        await db
          .insert(categories)
          .values(
            seedCategories.map((c, idx) => ({
              id: c.id,
              label: c.label,
              blurb: c.blurb,
              image: c.image,
              sortOrder: idx,
            })),
          )
          .onConflictDoNothing()
      }

      const existingProds = await db.select().from(products).limit(1)
      if (existingProds.length === 0) {
        await db
          .insert(products)
          .values(
            seedProducts.map((p, idx) => ({
              id: p.id,
              name: p.name,
              tagline: p.tagline,
              price: p.price,
              mrp: p.mrp,
              rating: p.rating,
              reviewsCount: p.reviews,
              image: p.image,
              images: p.images || [p.image],
              category: p.category,
              badge: p.badge ?? null,
              shortDesc: p.short,
              description: p.description,
              features: p.features || [],
              specs: p.specs || [],
              stock: 50,
              meeshoUrl: null,
              isActive: true,
              sortOrder: idx,
            })),
          )
          .onConflictDoNothing()
      }

      const existingReviews = await db.select().from(reviews).limit(1)
      if (existingReviews.length === 0) {
        await db.insert(reviews).values(
          seedReviews.map((r) => ({
            authorName: r.n,
            city: r.c,
            quote: r.t,
            productName: r.p,
            rating: 5,
          })),
        )
      }

      const existingFaqs = await db.select().from(faqs).limit(1)
      if (existingFaqs.length === 0) {
        await db.insert(faqs).values(
          seedFaqs.map((f, idx) => ({
            question: f.q,
            answer: f.a,
            sortOrder: idx,
          })),
        )
      }
    } catch (error) {
      seedPromise = null
      console.error('Database seed failed:', error)
      throw new Error('Unable to initialize storefront data.', { cause: error })
    }
  })()

  return seedPromise
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

function serializeProduct(p: typeof products.$inferSelect) {
  const specsList = Array.isArray(p.specs) ? p.specs : []
  return {
    id: p.id,
    sku: p.sku || '',
    brand: extractBrand(specsList),
    name: p.name,
    tagline: p.tagline,
    price: p.price,
    mrp: p.mrp,
    rating: p.rating,
    reviews: p.reviewsCount,
    image: p.image,
    images: Array.isArray(p.images) && p.images.length > 0 ? p.images : [p.image],
    category: p.category,
    badge: p.badge ?? undefined,
    short: p.shortDesc,
    description: p.description,
    features: p.features,
    specs: specsList,
    variants: Array.isArray(p.variants) ? p.variants : [],
    stock: p.stock,
    meeshoUrl: p.meeshoUrl ?? null,
    isActive: p.isActive,
    isFeatured: Boolean(p.isFeatured),
    updatedAt: p.updatedAt ? p.updatedAt.getTime() : Date.now(),
  }
}

let reconcileInFlight: Promise<void> | null = null

export async function reconcileSupabaseCatalogToCloudSql(): Promise<void> {
  if (reconcileInFlight) return reconcileInFlight

  reconcileInFlight = (async () => {
    try {
      const sbData = await fetchCatalogFromSupabase()
      if (!sbData.ok) return

      // If Supabase catalog tables are completely empty on a fresh database, seed them once from Cloud SQL
      if (sbData.products.length === 0 && sbData.categories.length === 0) {
        const [catRows, prodRows, revRows, faqRows] = await Promise.all([
          db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id)),
          db.select().from(products).orderBy(asc(products.sortOrder), asc(products.id)),
          db.select().from(reviews).orderBy(asc(reviews.id)),
          db.select().from(faqs).orderBy(asc(faqs.sortOrder)),
        ])
        if (prodRows.length > 0 || catRows.length > 0) {
          await syncCatalogToSupabase({
            categories: catRows.map((c) => ({
              id: c.id,
              label: c.label,
              blurb: c.blurb,
              image: c.image,
              isActive: c.isActive !== false,
            })),
            products: prodRows.map(serializeProduct),
            testimonials: revRows.map((r) => ({
              n: r.authorName,
              c: r.city,
              t: r.quote,
              p: r.productName,
              rating: r.rating,
            })),
            faqs: faqRows.map((f) => ({ q: f.question, a: f.answer })),
          })
        }
        return
      }

      await db.transaction(async (tx) => {
        const existingCats = await tx.select().from(categories)
        const existingCatMap = new Map(existingCats.map((c) => [c.id, c]))

        // 1. Reconcile categories from Supabase -> Cloud SQL
        for (const sbCat of sbData.categories) {
          const prev = existingCatMap.get(sbCat.id)
          if (!prev) {
            await tx
              .insert(categories)
              .values({
                id: sbCat.id,
                label: sbCat.label,
                blurb: sbCat.blurb,
                image: sbCat.image,
                isActive: sbCat.isActive,
                sortOrder: sbCat.sortOrder,
                updatedAt: new Date(),
              })
              .onConflictDoNothing()
          } else if (
            prev.label !== sbCat.label ||
            prev.blurb !== sbCat.blurb ||
            prev.image !== sbCat.image ||
            (prev.isActive !== false) !== sbCat.isActive ||
            prev.sortOrder !== sbCat.sortOrder
          ) {
            await tx
              .update(categories)
              .set({
                label: sbCat.label,
                blurb: sbCat.blurb,
                image: sbCat.image,
                isActive: sbCat.isActive,
                sortOrder: sbCat.sortOrder,
                updatedAt: new Date(),
              })
              .where(eq(categories.id, sbCat.id))
          }
        }

        // Ensure any product category added directly in Supabase exists in Cloud SQL categories (FK safety)
        const knownCategoryIds = new Set([
          ...existingCats.map((c) => c.id),
          ...sbData.categories.map((c) => c.id),
        ])
        for (const sbProd of sbData.products) {
          if (sbProd.category && !knownCategoryIds.has(sbProd.category)) {
            knownCategoryIds.add(sbProd.category)
            const prettyLabel = sbProd.category
              .split(/[-_]+/)
              .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
              .join(' ')
            await tx
              .insert(categories)
              .values({
                id: sbProd.category,
                label: prettyLabel || sbProd.category,
                blurb: '',
                image: sbProd.image || '/images/product-ht100.jpg',
                isActive: true,
                sortOrder: knownCategoryIds.size,
                updatedAt: new Date(),
              })
              .onConflictDoNothing()
          }
        }

        // 2. Reconcile products from Supabase -> Cloud SQL
        if (sbData.products.length > 0) {
          const existingProds = await tx.select().from(products)
          const existingProdMap = new Map(existingProds.map((p) => [p.id, p]))
          const sbProdIds = new Set(sbData.products.map((p) => p.id))

          for (const sbProd of sbData.products) {
            const prev = existingProdMap.get(sbProd.id)
            const mergedSku = sbProd.sku !== undefined ? sbProd.sku : prev?.sku ?? ''
            const mergedFeatured =
              sbProd.isFeatured !== undefined
                ? sbProd.isFeatured
                : Boolean(prev?.isFeatured)
            const mergedVariants =
              sbProd.variants !== undefined ? sbProd.variants : prev?.variants ?? []

            if (!prev) {
              await tx.insert(products).values({
                id: sbProd.id,
                sku: mergedSku,
                name: sbProd.name,
                tagline: sbProd.tagline,
                category: sbProd.category,
                price: sbProd.price,
                mrp: sbProd.mrp,
                stock: sbProd.stock,
                rating: sbProd.rating,
                reviewsCount: sbProd.reviewsCount,
                image: sbProd.image,
                images: sbProd.images,
                badge: sbProd.badge,
                shortDesc: sbProd.shortDesc,
                description: sbProd.description,
                features: sbProd.features,
                specs: sbProd.specs,
                variants: mergedVariants,
                meeshoUrl: sbProd.meeshoUrl,
                isActive: sbProd.isActive,
                isFeatured: mergedFeatured,
                sortOrder: sbProd.sortOrder,
                updatedAt: new Date(),
              })
              if (sbProd.images.length > 0) {
                await tx.insert(productImages).values(
                  sbProd.images.map((url, idx) => ({
                    productId: sbProd.id,
                    url,
                    alt: sbProd.name,
                    sortOrder: idx,
                    isPrimary: idx === 0,
                  })),
                )
              }
            } else {
              const changed =
                prev.name !== sbProd.name ||
                prev.tagline !== sbProd.tagline ||
                prev.category !== sbProd.category ||
                prev.price !== sbProd.price ||
                prev.mrp !== sbProd.mrp ||
                prev.stock !== sbProd.stock ||
                Math.abs((prev.rating ?? 0) - sbProd.rating) > 0.001 ||
                prev.reviewsCount !== sbProd.reviewsCount ||
                prev.image !== sbProd.image ||
                JSON.stringify(prev.images) !== JSON.stringify(sbProd.images) ||
                (prev.badge ?? null) !== sbProd.badge ||
                prev.shortDesc !== sbProd.shortDesc ||
                prev.description !== sbProd.description ||
                JSON.stringify(prev.features) !== JSON.stringify(sbProd.features) ||
                JSON.stringify(prev.specs) !== JSON.stringify(sbProd.specs) ||
                (prev.meeshoUrl ?? null) !== sbProd.meeshoUrl ||
                Boolean(prev.isActive) !== sbProd.isActive ||
                prev.sortOrder !== sbProd.sortOrder ||
                (prev.sku ?? '') !== mergedSku ||
                Boolean(prev.isFeatured) !== mergedFeatured ||
                JSON.stringify(prev.variants) !== JSON.stringify(mergedVariants)

              if (changed) {
                await tx
                  .update(products)
                  .set({
                    sku: mergedSku,
                    name: sbProd.name,
                    tagline: sbProd.tagline,
                    category: sbProd.category,
                    price: sbProd.price,
                    mrp: sbProd.mrp,
                    stock: sbProd.stock,
                    rating: sbProd.rating,
                    reviewsCount: sbProd.reviewsCount,
                    image: sbProd.image,
                    images: sbProd.images,
                    badge: sbProd.badge,
                    shortDesc: sbProd.shortDesc,
                    description: sbProd.description,
                    features: sbProd.features,
                    specs: sbProd.specs,
                    variants: mergedVariants,
                    meeshoUrl: sbProd.meeshoUrl,
                    isActive: sbProd.isActive,
                    isFeatured: mergedFeatured,
                    sortOrder: sbProd.sortOrder,
                    updatedAt: new Date(),
                  })
                  .where(eq(products.id, sbProd.id))

                if (JSON.stringify(prev.images) !== JSON.stringify(sbProd.images)) {
                  await tx.delete(productImages).where(eq(productImages.productId, sbProd.id))
                  if (sbProd.images.length > 0) {
                    await tx.insert(productImages).values(
                      sbProd.images.map((url, idx) => ({
                        productId: sbProd.id,
                        url,
                        alt: sbProd.name,
                        sortOrder: idx,
                        isPrimary: idx === 0,
                      })),
                    )
                  }
                }
              }
            }
          }

          // 3. Remove products deleted directly in Supabase
          for (const existing of existingProds) {
            if (!sbProdIds.has(existing.id)) {
              await tx.delete(products).where(eq(products.id, existing.id))
            }
          }
        }
      })
    } catch (err) {
      console.warn(
        '[Supabase catalog pull skipped]:',
        err instanceof Error ? err.message : String(err),
      )
    } finally {
      reconcileInFlight = null
    }
  })()

  return reconcileInFlight
}

export async function getStorefrontData(includeInactive = false) {
  try {
    await seedStorefrontIfEmpty()
    await reconcileSupabaseCatalogToCloudSql()

    const [catRows, prodRows, revRows, faqRows] = await Promise.all([
      db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id)),
      db.select().from(products).orderBy(asc(products.sortOrder), asc(products.id)),
      db.select().from(reviews).orderBy(asc(reviews.id)),
      db.select().from(faqs).orderBy(asc(faqs.sortOrder)),
    ])

    return {
      categories: catRows
        .filter((c) => includeInactive || c.isActive !== false)
        .map((c) => ({
          id: c.id,
          label: c.label,
          blurb: c.blurb,
          image: c.image,
          isActive: c.isActive !== false,
          sortOrder: c.sortOrder,
        })),
      products: prodRows
        .filter((p) => includeInactive || p.isActive)
        .map(serializeProduct),
      testimonials: revRows
        .filter((r) => includeInactive || r.isApproved !== false)
        .map((r) => ({
          id: r.id,
          productId: r.productId ?? null,
          n: r.authorName,
          c: r.city,
          t: r.quote,
          p: r.productName,
          rating: r.rating,
          isApproved: r.isApproved !== false,
          createdAt: r.createdAt ? r.createdAt.getTime() : Date.now(),
        })),
      faqs: faqRows.map((f) => ({
        q: f.question,
        a: f.answer,
      })),
      marqueeStats,
    }
  } catch (error) {
    console.error('Database getStorefrontData failed:', error)
    throw new Error('Unable to load storefront catalog.', { cause: error })
  }
}

function parseHbOrderNumber(code: string | null | undefined): number | null {
  const m = /^HB(\d+)$/i.exec(String(code || '').trim())
  return m ? Number(m[1]) : null
}

async function getNextOrderCode(executor: typeof db = db): Promise<string> {
  const existing = await executor.select({ orderCode: orders.orderCode }).from(orders)
  let maxNum = 99
  for (const row of existing) {
    const n = parseHbOrderNumber(row.orderCode)
    if (n !== null && n > maxNum) maxNum = n
  }
  return `HB${maxNum + 1}`
}

let normalizeOrderCodesPromise: Promise<void> | null = null

export async function normalizeLegacyOrderCodes() {
  if (normalizeOrderCodesPromise) return normalizeOrderCodesPromise

  normalizeOrderCodesPromise = (async () => {
    try {
      const legacyCheck = await db
        .select({ id: orders.id, orderCode: orders.orderCode })
        .from(orders)
        .orderBy(asc(orders.placedAt), asc(orders.id))

      const hasLegacy = legacyCheck.some((r) => !/^HB\d+$/i.test(r.orderCode))
      if (!hasLegacy) return

      const migrated: { oldCode: string; newCode: string; orderId: number }[] = []

      await db.transaction(async (tx) => {
        const allRows = await tx
          .select()
          .from(orders)
          .orderBy(asc(orders.placedAt), asc(orders.id))

        let maxNum = 99
        for (const r of allRows) {
          const n = parseHbOrderNumber(r.orderCode)
          if (n !== null && n > maxNum) maxNum = n
        }

        for (const row of allRows) {
          if (/^HB\d+$/i.test(row.orderCode)) continue
          maxNum += 1
          const oldCode = row.orderCode
          const newCode = `HB${maxNum}`

          await tx
            .update(orders)
            .set({ orderCode: newCode })
            .where(eq(orders.id, row.id))
          await tx
            .update(payments)
            .set({ orderCode: newCode })
            .where(eq(payments.orderId, row.id))
          await tx
            .update(fulfillments)
            .set({ orderCode: newCode })
            .where(eq(fulfillments.orderId, row.id))
          await tx
            .update(inventoryLogs)
            .set({ referenceId: newCode })
            .where(eq(inventoryLogs.referenceId, oldCode))
          await tx
            .update(cartEvents)
            .set({ orderCode: newCode })
            .where(eq(cartEvents.orderCode, oldCode))
          await tx
            .update(checkoutEvents)
            .set({ orderCode: newCode })
            .where(eq(checkoutEvents.orderCode, oldCode))

          migrated.push({ oldCode, newCode, orderId: row.id })
        }
      })

      for (const m of migrated) {
        await deleteOrderFromSupabaseByCode(m.oldCode)
        const updated = await getOrderByCode(m.newCode)
        if (updated) {
          await syncOrderToSupabase(updated)
        }
      }
    } catch (err) {
      console.warn(
        '[Order code normalization skipped]:',
        err instanceof Error ? err.message : String(err),
      )
    }
  })()

  return normalizeOrderCodesPromise
}

export type OrderWorkflowStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

const ORDER_STATUS_TO_STAGE: Record<OrderWorkflowStatus, number> = {
  pending: 0,
  confirmed: 1,
  processing: 1,
  shipped: 2,
  delivered: 4,
  cancelled: 0,
}

const VALID_ORDER_TRANSITIONS: Record<OrderWorkflowStatus, OrderWorkflowStatus[]> = {
  pending: ['pending', 'confirmed', 'processing', 'cancelled'],
  confirmed: ['confirmed', 'processing', 'shipped', 'cancelled'],
  processing: ['processing', 'shipped', 'cancelled'],
  shipped: ['shipped', 'delivered', 'cancelled'],
  delivered: ['delivered'],
  cancelled: ['cancelled'],
}

export function deriveWorkflowStatus(
  row: Pick<typeof orders.$inferSelect, 'cancelled' | 'fulfillmentStatus' | 'status'>,
): OrderWorkflowStatus {
  if (row.cancelled) return 'cancelled'
  const raw = (row.fulfillmentStatus || '').toLowerCase()
  if (
    raw === 'pending' ||
    raw === 'confirmed' ||
    raw === 'processing' ||
    raw === 'shipped' ||
    raw === 'delivered' ||
    raw === 'cancelled'
  ) {
    return raw
  }
  if (row.status >= 4) return 'delivered'
  if (row.status >= 2) return 'shipped'
  if (row.status === 1) return 'confirmed'
  return 'pending'
}

export interface CreateOrderInput {
  userId?: number | null
  customerUid?: string | null
  customerEmail?: string | null
  customerName: string
  phone?: string
  shippingAddress?: ShippingAddressSnapshot | null
  paymentMethod?: string
  paymentStatus?: string
  razorpayOrderId?: string | null
  razorpayPaymentId?: string | null
  items: { productId: string; qty: number; variantLabel?: string | null; sku?: string | null }[]
}

function serializeOrder(
  row: typeof orders.$inferSelect,
  items: (typeof orderItems.$inferSelect)[],
  customerUid?: string | null,
  fulfillmentRows: (typeof fulfillments.$inferSelect)[] = [],
  paymentRows: (typeof payments.$inferSelect)[] = [],
) {
  const workflowStatus = deriveWorkflowStatus(row)
  const orderedEvents = [...fulfillmentRows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )
  const latestWithTracking = [...orderedEvents]
    .reverse()
    .find((f) => f.courierPartner || f.trackingNumber || f.trackingUrl)
  const latestFulfillment = orderedEvents[orderedEvents.length - 1] || null
  const primaryPayment = paymentRows[0] || null

  const timeline =
    orderedEvents.length > 0
      ? orderedEvents.map((f) => ({
          id: f.id,
          status: f.status,
          courierPartner: f.courierPartner || '',
          trackingNumber: f.trackingNumber || '',
          trackingUrl: f.trackingUrl || '',
          notes: f.notes || '',
          createdAt: f.createdAt.getTime(),
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
              : `Order placed via ${row.paymentMethod}`,
            createdAt: row.placedAt.getTime(),
          },
        ]

  const cancelEntry = [...orderedEvents]
    .reverse()
    .find((f) => f.status === 'cancelled' && f.notes)

  return {
    id: row.orderCode,
    dbId: row.id,
    customerUid: customerUid ?? null,
    customerEmail: row.customerEmail,
    customerName: row.customerName,
    phone: row.phone || '',
    shippingAddress: row.shippingAddress,
    billingAddress: row.billingAddress ?? null,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    razorpayOrderId: row.razorpayOrderId ?? null,
    razorpayPaymentId: row.razorpayPaymentId ?? null,
    paymentDetails: primaryPayment
      ? {
          provider: primaryPayment.provider,
          method: primaryPayment.method,
          amount: primaryPayment.amount,
          currency: primaryPayment.currency,
          status: primaryPayment.status,
          razorpayOrderId: primaryPayment.razorpayOrderId ?? null,
          razorpayPaymentId: primaryPayment.razorpayPaymentId ?? null,
          signatureVerified: Boolean(primaryPayment.signatureVerified),
          refundedAmount: primaryPayment.refundedAmount ?? 0,
          createdAt: primaryPayment.createdAt.getTime(),
        }
      : null,
    subtotal: row.subtotal,
    discountCode: row.discountCode ?? null,
    discountAmount: row.discountAmount ?? 0,
    shipping: row.shipping,
    total: row.total,
    status: row.status,
    orderStatus: workflowStatus,
    fulfillmentStatus: workflowStatus,
    cancelled: row.cancelled,
    cancelReason: cancelEntry ? cancelEntry.notes.replace(/^Cancelled:\s*/i, '') : null,
    courierPartner: latestWithTracking?.courierPartner || '',
    trackingNumber: latestWithTracking?.trackingNumber || '',
    trackingUrl: latestWithTracking?.trackingUrl || '',
    shippedAt: latestFulfillment?.shippedAt ? latestFulfillment.shippedAt.getTime() : null,
    deliveredAt: latestFulfillment?.deliveredAt ? latestFulfillment.deliveredAt.getTime() : null,
    timeline,
    refundStatus: row.refundStatus || 'none',
    refundAmount: row.refundAmount ?? 0,
    internalNotes: row.internalNotes || '',
    utmSource: row.utmSource ?? null,
    utmMedium: row.utmMedium ?? null,
    utmCampaign: row.utmCampaign ?? null,
    placedAt: row.placedAt.getTime(),
    eta: row.etaAt.getTime(),
    items: items.map((i) => ({
      id: i.productId,
      name: i.productName,
      image: i.productImage,
      sku: i.sku ?? null,
      variantLabel: i.variantLabel ?? null,
      price: i.unitPrice,
      qty: i.qty,
      fulfilledQty: i.fulfilledQty ?? 0,
    })),
  }
}

export async function createOrderInDb(input: CreateOrderInput) {
  try {
    await seedStorefrontIfEmpty()
    await normalizeLegacyOrderCodes()

    // Merge duplicate line items cleanly before transaction so stock checks never double-count incorrectly
    const mergedRaw = new Map<string, { productId: string; qty: number; variantLabel?: string | null; sku?: string | null }>()
    for (const item of input.items) {
      const qty = Math.floor(Number(item.qty) || 0)
      if (!item.productId || qty < 1) continue
      const key = `${item.productId}::${item.variantLabel || ''}::${item.sku || ''}`
      const existing = mergedRaw.get(key)
      if (existing) {
        existing.qty += qty
      } else {
        mergedRaw.set(key, {
          productId: String(item.productId),
          qty,
          variantLabel: item.variantLabel ?? null,
          sku: item.sku ?? null,
        })
      }
    }

    if (mergedRaw.size === 0) {
      throw new Error('No valid items in order.')
    }

    const txResult = await db.transaction(async (tx) => {
      const productIds = Array.from(new Set(Array.from(mergedRaw.values()).map((i) => i.productId)))
      const catalogRows = await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds))
      const catalogMap = new Map(catalogRows.map((p) => [p.id, p]))

      const normalizedItems: {
        productId: string
        productName: string
        productImage: string
        sku: string
        variantLabel: string | null
        unitPrice: number
        qty: number
        prod: typeof products.$inferSelect
      }[] = []

      for (const item of mergedRaw.values()) {
        const prod = catalogMap.get(item.productId)
        if (!prod || !prod.isActive) {
          throw new Error('One or more selected products are no longer available.')
        }
        const variantsList = Array.isArray(prod.variants) ? prod.variants : []
        const matchedVariant = item.variantLabel
          ? variantsList.find((v) => {
              const label = v.label || [v.size, v.color].filter(Boolean).join(' / ')
              return (
                v.isActive !== false &&
                (label === item.variantLabel || (item.sku && v.sku === item.sku))
              )
            })
          : null

        const effectiveUnitPrice = matchedVariant
          ? Math.max(0, Math.round(Number(matchedVariant.price ?? prod.price)))
          : prod.price
        const effectiveSku = matchedVariant?.sku || item.sku || prod.sku || ''

        if (prod.stock <= 0) {
          throw new Error(`${prod.name} is currently out of stock.`)
        }
        if (item.qty > prod.stock) {
          throw new Error(
            `Only ${prod.stock} unit${prod.stock === 1 ? '' : 's'} left in stock for ${prod.name}.`,
          )
        }
        if (matchedVariant && typeof matchedVariant.stock === 'number' && item.qty > matchedVariant.stock) {
          throw new Error(
            `Only ${matchedVariant.stock} unit${matchedVariant.stock === 1 ? '' : 's'} left for ${prod.name} (${item.variantLabel}).`,
          )
        }

        normalizedItems.push({
          productId: prod.id,
          productName: prod.name,
          productImage: prod.image,
          sku: effectiveSku,
          variantLabel: item.variantLabel ?? null,
          unitPrice: effectiveUnitPrice,
          qty: item.qty,
          prod,
        })
      }

      const subtotal = normalizedItems.reduce(
        (sum, item) => sum + item.unitPrice * item.qty,
        0,
      )
      const shipping = 0
      const total = subtotal + shipping
      const etaAt = new Date(Date.now() + 96 * 3600 * 1000)

      const nextOrderCode = await getNextOrderCode(tx as unknown as typeof db)

      const insertedOrders = await tx
        .insert(orders)
        .values({
          orderCode: nextOrderCode,
          userId: input.userId ?? null,
          customerEmail: input.customerEmail
            ? input.customerEmail.trim().toLowerCase()
            : null,
          customerName: input.customerName.trim() || 'HARBAN Customer',
          phone: (input.phone || '').trim(),
          shippingAddress: input.shippingAddress ?? null,
          paymentMethod: input.paymentMethod || 'Cash on Delivery',
          paymentStatus: input.paymentStatus || 'pending',
          razorpayOrderId: input.razorpayOrderId ?? null,
          razorpayPaymentId: input.razorpayPaymentId ?? null,
          subtotal,
          shipping,
          total,
          status: 0,
          fulfillmentStatus: 'pending',
          cancelled: false,
          etaAt,
        })
        .returning()

      const orderRow = insertedOrders[0]

      const insertedItems = await tx
        .insert(orderItems)
        .values(
          normalizedItems.map((i) => ({
            orderId: orderRow.id,
            productId: i.productId,
            productName: i.productName,
            productImage: i.productImage,
            sku: i.sku || null,
            variantLabel: i.variantLabel,
            unitPrice: i.unitPrice,
            qty: i.qty,
          })),
        )
        .returning()

      const updatedProductsToSync: (typeof products.$inferSelect)[] = []

      // Atomic stock decrement inside DB transaction (prevents oversell or duplicate deduction)
      for (const item of normalizedItems) {
        const decremented = await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${item.qty}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(products.id, item.productId),
              gte(products.stock, item.qty),
              eq(products.isActive, true),
            ),
          )
          .returning()

        const updatedProd = decremented[0]
        if (!updatedProd) {
          throw new Error(
            `Insufficient stock for ${item.productName}. Please refresh your cart.`,
          )
        }

        // Also update variant stock if a tracked variant was purchased
        if (item.variantLabel && Array.isArray(updatedProd.variants) && updatedProd.variants.length > 0) {
          const nextVariants = updatedProd.variants.map((v) => {
            const lbl = v.label || [v.size, v.color].filter(Boolean).join(' / ')
            if (lbl === item.variantLabel || (item.sku && v.sku === item.sku)) {
              return { ...v, stock: Math.max(0, (Number(v.stock) || 0) - item.qty) }
            }
            return v
          })
          await tx
            .update(products)
            .set({ variants: nextVariants })
            .where(eq(products.id, item.productId))
          updatedProd.variants = nextVariants
        }

        const prevStock = updatedProd.stock + item.qty
        await tx.insert(inventoryLogs).values({
          productId: updatedProd.id,
          productName: updatedProd.name,
          variantSku: item.sku || updatedProd.sku || '',
          previousStock: prevStock,
          changeQty: -item.qty,
          newStock: updatedProd.stock,
          reason: 'order_placed',
          referenceId: orderRow.orderCode,
          actorEmail: input.customerEmail ?? null,
        })

        updatedProductsToSync.push(updatedProd)
      }

      const paymentRows = await tx
        .insert(payments)
        .values({
          orderId: orderRow.id,
          orderCode: orderRow.orderCode,
          provider: (input.paymentMethod || '').toLowerCase().includes('razorpay')
            ? 'razorpay'
            : 'cod',
          method: orderRow.paymentMethod,
          amount: orderRow.total,
          currency: 'INR',
          status: orderRow.paymentStatus,
          razorpayOrderId: orderRow.razorpayOrderId ?? null,
          razorpayPaymentId: orderRow.razorpayPaymentId ?? null,
          signatureVerified: orderRow.paymentStatus === 'paid',
        })
        .returning()

      const fulfillmentRows = await tx
        .insert(fulfillments)
        .values({
          orderId: orderRow.id,
          orderCode: orderRow.orderCode,
          status: 'pending',
          notes: `Order placed via ${orderRow.paymentMethod}${orderRow.paymentStatus === 'paid' ? ' (Paid)' : ''}`,
        })
        .returning()

      return {
        serialized: serializeOrder(
          orderRow,
          insertedItems,
          input.customerUid,
          fulfillmentRows,
          paymentRows,
        ),
        updatedProductsToSync,
      }
    })

    await Promise.all([
      ...txResult.updatedProductsToSync.map((p) => {
        const s = serializeProduct(p)
        return syncProductToSupabase({ ...s, badge: s.badge ?? null })
      }),
      syncOrderToSupabase(txResult.serialized),
    ])
    void logCartEventInDb({
      sessionId: input.customerUid || txResult.serialized.id,
      eventType: 'checkout_completed',
      customerUid: input.customerUid ?? null,
      customerEmail: txResult.serialized.customerEmail,
      customerName: txResult.serialized.customerName,
      cartTotal: txResult.serialized.total,
      cartItems: txResult.serialized.items,
      paymentMethod: txResult.serialized.paymentMethod,
      orderCode: txResult.serialized.id,
    })

    return txResult.serialized
  } catch (error) {
    console.error('Database createOrderInDb failed:', error)
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Unable to place order. Please try again.',
      { cause: error },
    )
  }
}

export async function getOrdersForCustomer(userId: number, email: string) {
  try {
    await normalizeLegacyOrderCodes()
    const cleanEmail = email.trim().toLowerCase()
    const orderRows = await db
      .select()
      .from(orders)
      .where(or(eq(orders.userId, userId), eq(orders.customerEmail, cleanEmail)))
      .orderBy(desc(orders.placedAt))

    if (orderRows.length === 0) return []

    const orderIds = orderRows.map((o) => o.id)
    const [allItems, allFulfillments, allPayments] = await Promise.all([
      db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
      db.select().from(fulfillments).where(inArray(fulfillments.orderId, orderIds)),
      db.select().from(payments).where(inArray(payments.orderId, orderIds)),
    ])

    return orderRows.map((row) =>
      serializeOrder(
        row,
        allItems.filter((i) => i.orderId === row.id),
        null,
        allFulfillments.filter((f) => f.orderId === row.id),
        allPayments.filter((p) => p.orderId === row.id),
      ),
    )
  } catch (error) {
    console.error('Database getOrdersForCustomer failed:', error)
    throw new Error('Unable to load customer orders.', { cause: error })
  }
}

export async function getOrderByCode(orderCode: string) {
  try {
    const clean = orderCode.trim().replace(/^#+/, '').toUpperCase()
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.orderCode, clean))
      .limit(1)

    if (!rows[0]) return null
    const [items, fRows, pRows] = await Promise.all([
      db.select().from(orderItems).where(eq(orderItems.orderId, rows[0].id)),
      db.select().from(fulfillments).where(eq(fulfillments.orderId, rows[0].id)),
      db.select().from(payments).where(eq(payments.orderId, rows[0].id)),
    ])
    return serializeOrder(rows[0], items, null, fRows, pRows)
  } catch (error) {
    console.error('Database getOrderByCode failed:', error)
    throw new Error('Unable to track order.', { cause: error })
  }
}

export async function cancelCustomerOrder(
  orderCode: string,
  userId: number,
  email: string,
) {
  try {
    const cleanEmail = email.trim().toLowerCase()
    const cleanCode = orderCode.trim().replace(/^#+/, '').toUpperCase()

    const txRes = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderCode, cleanCode))
        .limit(1)

      const order = rows[0]
      if (!order) return null
      const ownsOrder =
        order.userId === userId ||
        (order.customerEmail && order.customerEmail.toLowerCase() === cleanEmail)
      if (!ownsOrder || order.cancelled || order.status > 1) return null

      const updated = await tx
        .update(orders)
        .set({ cancelled: true, fulfillmentStatus: 'cancelled' })
        .where(eq(orders.id, order.id))
        .returning()

      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))

      // Prevent duplicate restock
      const existingRestock = await tx
        .select()
        .from(inventoryLogs)
        .where(
          and(
            eq(inventoryLogs.referenceId, order.orderCode),
            eq(inventoryLogs.reason, 'order_cancelled_restock'),
          ),
        )
        .limit(1)

      const updatedProductsToSync: (typeof products.$inferSelect)[] = []
      if (existingRestock.length === 0) {
        for (const item of items) {
          const updatedProd = await tx
            .update(products)
            .set({ stock: sql`${products.stock} + ${item.qty}`, updatedAt: new Date() })
            .where(eq(products.id, item.productId))
            .returning()
          if (updatedProd[0]) {
            await tx.insert(inventoryLogs).values({
              productId: updatedProd[0].id,
              productName: updatedProd[0].name,
              variantSku: item.sku || updatedProd[0].sku || '',
              previousStock: updatedProd[0].stock - item.qty,
              changeQty: item.qty,
              newStock: updatedProd[0].stock,
              reason: 'order_cancelled_restock',
              referenceId: order.orderCode,
              actorEmail: cleanEmail,
            })
            updatedProductsToSync.push(updatedProd[0])
          }
        }
      }

      await tx.insert(fulfillments).values({
        orderId: order.id,
        orderCode: order.orderCode,
        status: 'cancelled',
        notes: 'Cancelled: Customer requested cancellation',
      })

      const [fRows, pRows] = await Promise.all([
        tx.select().from(fulfillments).where(eq(fulfillments.orderId, order.id)),
        tx.select().from(payments).where(eq(payments.orderId, order.id)),
      ])

      return {
        serialized: serializeOrder(updated[0], items, null, fRows, pRows),
        updatedProductsToSync,
      }
    })

    if (!txRes) return null
    await Promise.all([
      ...txRes.updatedProductsToSync.map((p) => {
        const s = serializeProduct(p)
        return syncProductToSupabase({ ...s, badge: s.badge ?? null })
      }),
      syncOrderToSupabase(txRes.serialized),
    ])
    return txRes.serialized
  } catch (error) {
    console.error('Database cancelCustomerOrder failed:', error)
    throw new Error('Unable to cancel order.', { cause: error })
  }
}

/* ----------------------------------------------------- Admin & Inventory */

export async function getAllOrdersForAdmin() {
  try {
    await normalizeLegacyOrderCodes()
    const orderRows = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.placedAt))
      .limit(250)

    if (orderRows.length === 0) return []
    const orderIds = orderRows.map((o) => o.id)
    const [allItems, allFulfillments, allPayments] = await Promise.all([
      db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
      db.select().from(fulfillments).where(inArray(fulfillments.orderId, orderIds)),
      db.select().from(payments).where(inArray(payments.orderId, orderIds)),
    ])

    return orderRows.map((row) =>
      serializeOrder(
        row,
        allItems.filter((i) => i.orderId === row.id),
        null,
        allFulfillments.filter((f) => f.orderId === row.id),
        allPayments.filter((p) => p.orderId === row.id),
      ),
    )
  } catch (error) {
    console.error('Database getAllOrdersForAdmin failed:', error)
    throw new Error('Unable to load admin orders.', { cause: error })
  }
}

export async function updateOrderAdminInDb(
  orderCode: string,
  patch: {
    orderStatus?: OrderWorkflowStatus
    status?: number
    cancelled?: boolean
    paymentStatus?: string
    courierPartner?: string
    trackingNumber?: string
    trackingUrl?: string
    internalNotes?: string
    cancelReason?: string
  },
  actorEmail?: string,
) {
  try {
    const clean = orderCode.trim().replace(/^#+/, '').toUpperCase()

    const txRes = await db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderCode, clean))
        .limit(1)
      const existing = existingRows[0]
      if (!existing) return null

      const currentStatus = deriveWorkflowStatus(existing)

      // Determine requested workflow status
      let targetStatus: OrderWorkflowStatus = currentStatus
      if (patch.orderStatus) {
        const cleanReq = patch.orderStatus.toLowerCase() as OrderWorkflowStatus
        if (!(cleanReq in VALID_ORDER_TRANSITIONS)) {
          throw new Error(`Invalid order status "${patch.orderStatus}".`)
        }
        targetStatus = cleanReq
      } else if (patch.cancelled === true) {
        targetStatus = 'cancelled'
      } else if (typeof patch.status === 'number') {
        const mapByNum: Record<number, OrderWorkflowStatus> = {
          0: 'pending',
          1: 'confirmed',
          2: 'shipped',
          3: 'shipped',
          4: 'delivered',
        }
        targetStatus = mapByNum[Math.max(0, Math.min(4, Math.floor(patch.status)))] || currentStatus
      }

      // Enforce state transition rules
      if (targetStatus !== currentStatus) {
        const allowed = VALID_ORDER_TRANSITIONS[currentStatus] || []
        if (!allowed.includes(targetStatus)) {
          throw new Error(
            `Cannot change order from "${currentStatus}" to "${targetStatus}".`,
          )
        }
      }

      if (targetStatus === 'cancelled' && currentStatus !== 'cancelled') {
        const reason = String(patch.cancelReason || '').trim()
        if (reason.length < 3) {
          throw new Error('Please provide a cancellation reason (at least 3 characters).')
        }
      }

      const nextCancelled = targetStatus === 'cancelled'
      const nextStageNum =
        targetStatus === 'cancelled'
          ? existing.status
          : ORDER_STATUS_TO_STAGE[targetStatus]

      const nextPaymentStatus =
        typeof patch.paymentStatus === 'string' && patch.paymentStatus.trim()
          ? patch.paymentStatus.trim().toLowerCase()
          : existing.paymentStatus

      const nextInternalNotes =
        typeof patch.internalNotes === 'string'
          ? patch.internalNotes
          : existing.internalNotes

      const updated = await tx
        .update(orders)
        .set({
          status: nextStageNum,
          fulfillmentStatus: targetStatus,
          cancelled: nextCancelled,
          paymentStatus: nextPaymentStatus,
          internalNotes: nextInternalNotes,
        })
        .where(eq(orders.id, existing.id))
        .returning()

      if (nextPaymentStatus !== existing.paymentStatus) {
        await tx
          .update(payments)
          .set({ status: nextPaymentStatus })
          .where(eq(payments.orderId, existing.id))
      }

      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, existing.id))

      const updatedProductsToSync: (typeof products.$inferSelect)[] = []

      // Atomic idempotent stock restock on first cancellation only
      if (targetStatus === 'cancelled' && currentStatus !== 'cancelled') {
        const existingRestock = await tx
          .select()
          .from(inventoryLogs)
          .where(
            and(
              eq(inventoryLogs.referenceId, existing.orderCode),
              eq(inventoryLogs.reason, 'order_cancelled_restock'),
            ),
          )
          .limit(1)

        if (existingRestock.length === 0) {
          for (const item of items) {
            const restocked = await tx
              .update(products)
              .set({ stock: sql`${products.stock} + ${item.qty}`, updatedAt: new Date() })
              .where(eq(products.id, item.productId))
              .returning()
            if (restocked[0]) {
              await tx.insert(inventoryLogs).values({
                productId: restocked[0].id,
                productName: restocked[0].name,
                variantSku: item.sku || restocked[0].sku || '',
                previousStock: restocked[0].stock - item.qty,
                changeQty: item.qty,
                newStock: restocked[0].stock,
                reason: 'order_cancelled_restock',
                referenceId: existing.orderCode,
                actorEmail: actorEmail ?? null,
              })
              updatedProductsToSync.push(restocked[0])
            }
          }
        }
      }

      // Append timeline/fulfillment record when status, courier/tracking, or notes change
      const courierClean =
        typeof patch.courierPartner === 'string' ? patch.courierPartner.trim() : ''
      const trackingClean =
        typeof patch.trackingNumber === 'string' ? patch.trackingNumber.trim() : ''
      const trackingUrlClean =
        typeof patch.trackingUrl === 'string' ? patch.trackingUrl.trim() : ''

      const existingFulfillments = await tx
        .select()
        .from(fulfillments)
        .where(eq(fulfillments.orderId, existing.id))
      const prevTracking = existingFulfillments
        .slice()
        .reverse()
        .find((f) => f.courierPartner || f.trackingNumber || f.trackingUrl)

      const courierChanged =
        (typeof patch.courierPartner === 'string' &&
          courierClean !== (prevTracking?.courierPartner || '')) ||
        (typeof patch.trackingNumber === 'string' &&
          trackingClean !== (prevTracking?.trackingNumber || '')) ||
        (typeof patch.trackingUrl === 'string' &&
          trackingUrlClean !== (prevTracking?.trackingUrl || ''))

      const noteMessages: string[] = []
      if (targetStatus !== currentStatus) {
        if (targetStatus === 'cancelled') {
          noteMessages.push(`Cancelled: ${String(patch.cancelReason || '').trim()}`)
        } else {
          noteMessages.push(`Status updated to ${targetStatus.toUpperCase()}`)
        }
      }
      if (courierChanged && (courierClean || trackingClean)) {
        noteMessages.push(
          `Tracking saved: ${courierClean || 'Courier'}${trackingClean ? ` · AWB ${trackingClean}` : ''}`,
        )
      }
      if (nextPaymentStatus !== existing.paymentStatus) {
        noteMessages.push(`Payment status set to ${nextPaymentStatus.toUpperCase()}`)
      }
      if (
        typeof patch.internalNotes === 'string' &&
        patch.internalNotes.trim() !== (existing.internalNotes || '').trim() &&
        noteMessages.length === 0
      ) {
        noteMessages.push('Internal order notes updated')
      }

      if (noteMessages.length > 0) {
        await tx.insert(fulfillments).values({
          orderId: existing.id,
          orderCode: existing.orderCode,
          status: targetStatus,
          courierPartner:
            typeof patch.courierPartner === 'string'
              ? courierClean
              : prevTracking?.courierPartner || '',
          trackingNumber:
            typeof patch.trackingNumber === 'string'
              ? trackingClean
              : prevTracking?.trackingNumber || '',
          trackingUrl:
            typeof patch.trackingUrl === 'string'
              ? trackingUrlClean
              : prevTracking?.trackingUrl || '',
          shippedAt: targetStatus === 'shipped' ? new Date() : null,
          deliveredAt: targetStatus === 'delivered' ? new Date() : null,
          notes: `${noteMessages.join(' · ')}${actorEmail ? ` (${actorEmail})` : ''}`,
        })
      }

      const [fRows, pRows] = await Promise.all([
        tx.select().from(fulfillments).where(eq(fulfillments.orderId, existing.id)),
        tx.select().from(payments).where(eq(payments.orderId, existing.id)),
      ])

      return {
        serialized: serializeOrder(updated[0], items, null, fRows, pRows),
        updatedProductsToSync,
      }
    })

    if (!txRes) return null
    await Promise.all([
      ...txRes.updatedProductsToSync.map((p) => {
        const s = serializeProduct(p)
        return syncProductToSupabase({ ...s, badge: s.badge ?? null })
      }),
      syncOrderToSupabase(txRes.serialized),
    ])
    return txRes.serialized
  } catch (error) {
    console.error('Database updateOrderAdminInDb failed:', error)
    throw error instanceof Error
      ? error
      : new Error('Unable to update order.', { cause: error })
  }
}

export async function upsertProductInDb(
  input: {
    id: string
    sku?: string
    brand?: string
    name: string
    tagline?: string
    category: string
    price: number
    mrp: number
    stock?: number
    image?: string
    images?: string[]
    badge?: string | null
    short?: string
    description?: string
    features?: string[]
    specs?: { label: string; value: string }[]
    variants?: ProductVariantOption[]
    meeshoUrl?: string | null
    isActive?: boolean
    isFeatured?: boolean
  },
  actorEmail?: string,
) {
  try {
    const cleanId = input.id
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')

    if (!cleanId) throw new Error('Product ID is required.')
    if (!input.name || !input.name.trim()) {
      throw new Error('Product title is required.')
    }

    const basePrice = Math.round(Number(input.price))
    const baseMrp = Math.round(Number(input.mrp ?? basePrice))
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      throw new Error('Selling price must be 0 or greater.')
    }
    if (!Number.isFinite(baseMrp) || baseMrp < basePrice) {
      throw new Error('MRP must be greater than or equal to selling price.')
    }

    const serialized = await db.transaction(async (tx) => {
      const catRows = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, input.category))
        .limit(1)
      if (!catRows[0]) {
        throw new Error(`Category "${input.category}" does not exist.`)
      }

      const existing = await tx
        .select()
        .from(products)
        .where(eq(products.id, cleanId))
        .limit(1)

      const rawImages = Array.isArray(input.images)
        ? input.images.map((u) => String(u || '').trim()).filter(Boolean)
        : []
      const fallbackImg =
        String(input.image || '').trim() ||
        rawImages[0] ||
        existing[0]?.image ||
        '/images/product-ht100.jpg'
      const finalImages =
        rawImages.length > 0
          ? Array.from(new Set(rawImages))
          : existing[0]?.images?.length
            ? existing[0].images
            : [fallbackImg]
      const primaryImage = finalImages[0] || fallbackImg

      const cleanVariants: ProductVariantOption[] = Array.isArray(input.variants)
        ? input.variants
            .filter((v) => v && (v.size?.trim() || v.color?.trim() || v.sku?.trim()))
            .map((v, idx) => {
              const vp = Math.max(0, Math.round(Number(v.price ?? basePrice) || basePrice))
              const vm = Math.max(vp, Math.round(Number(v.mrp ?? baseMrp) || baseMrp))
              return {
                id: v.id || `v_${idx + 1}`,
                sku: (v.sku || '').trim(),
                size: (v.size || '').trim(),
                color: (v.color || '').trim(),
                label: [v.size?.trim(), v.color?.trim()].filter(Boolean).join(' / '),
                price: vp,
                mrp: vm,
                stock: Math.max(0, Math.round(Number(v.stock ?? 0) || 0)),
                isActive: v.isActive !== false,
              }
            })
        : existing[0]?.variants ?? []

      const baseSpecs = Array.isArray(input.specs)
        ? input.specs.filter((s) => s.label?.trim() && s.value?.trim())
        : existing[0]?.specs ?? []
      const brandClean = (input.brand ?? extractBrand(baseSpecs)).trim() || 'HARBAN'
      const nonBrandSpecs = baseSpecs.filter(
        (s) => s.label.trim().toLowerCase() !== 'brand',
      )
      const mergedSpecs = [{ label: 'Brand', value: brandClean }, ...nonBrandSpecs]

      const nextStock = Math.max(
        0,
        Math.round(Number(input.stock ?? existing[0]?.stock ?? 25)),
      )
      const prevStock = existing[0]?.stock ?? 0

      let normalizedMeeshoUrl: string | null | undefined = undefined
      if (input.meeshoUrl !== undefined) {
        const rawUrl = String(input.meeshoUrl || '').trim()
        if (!rawUrl) {
          normalizedMeeshoUrl = null
        } else {
          const withProto = /^https?:\/\//i.test(rawUrl)
            ? rawUrl
            : `https://${rawUrl.replace(/^\/+/, '')}`
          try {
            const parsed = new URL(withProto)
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
              throw new Error('Invalid URL protocol')
            }
            normalizedMeeshoUrl = parsed.toString()
          } catch {
            throw new Error(
              'Please enter a valid Meesho URL (e.g. https://www.meesho.com/...).',
            )
          }
        }
      }

      const values = {
        id: cleanId,
        sku: (input.sku ?? existing[0]?.sku ?? '').trim(),
        name: input.name.trim(),
        tagline: (input.tagline ?? existing[0]?.tagline ?? '').trim(),
        category: input.category,
        price: basePrice,
        mrp: baseMrp,
        stock: nextStock,
        image: primaryImage,
        images: finalImages,
        badge:
          input.badge !== undefined
            ? input.badge || null
            : (existing[0]?.badge ?? null),
        shortDesc: (input.short ?? existing[0]?.shortDesc ?? input.tagline ?? '').trim(),
        description: (
          input.description ??
          existing[0]?.description ??
          input.short ??
          ''
        ).trim(),
        features: Array.isArray(input.features)
          ? input.features.map((f) => f.trim()).filter(Boolean)
          : existing[0]?.features ?? [],
        specs: mergedSpecs,
        variants: cleanVariants,
        meeshoUrl:
          normalizedMeeshoUrl !== undefined
            ? normalizedMeeshoUrl
            : (existing[0]?.meeshoUrl ?? null),
        isActive:
          typeof input.isActive === 'boolean'
            ? input.isActive
            : (existing[0]?.isActive ?? true),
        isFeatured:
          typeof input.isFeatured === 'boolean'
            ? input.isFeatured
            : Boolean(existing[0]?.isFeatured),
        updatedAt: new Date(),
      }

      const rows = existing[0]
        ? await tx
            .update(products)
            .set(values)
            .where(eq(products.id, cleanId))
            .returning()
        : await tx.insert(products).values(values).returning()

      await tx.delete(productImages).where(eq(productImages.productId, cleanId))
      if (finalImages.length > 0) {
        await tx.insert(productImages).values(
          finalImages.map((url, idx) => ({
            productId: cleanId,
            url,
            alt: values.name,
            sortOrder: idx,
            isPrimary: idx === 0,
          })),
        )
      }

      await tx.delete(productVariants).where(eq(productVariants.productId, cleanId))
      if (cleanVariants.length > 0) {
        await tx.insert(productVariants).values(
          cleanVariants.map((v) => ({
            productId: cleanId,
            sku: v.sku || '',
            size: v.size || '',
            color: v.color || '',
            price: v.price,
            mrp: v.mrp ?? baseMrp,
            stock: v.stock,
            isActive: v.isActive !== false,
          })),
        )
      }

      if (!existing[0] || prevStock !== nextStock) {
        await tx.insert(inventoryLogs).values({
          productId: cleanId,
          productName: values.name,
          variantSku: values.sku,
          previousStock: prevStock,
          changeQty: nextStock - prevStock,
          newStock: nextStock,
          reason: existing[0] ? 'product_edit' : 'initial_stock',
          actorEmail: actorEmail ?? null,
        })
      }

      return serializeProduct(rows[0])
    })

    await syncProductToSupabase({ ...serialized, badge: serialized.badge ?? null })
    return serialized
  } catch (error) {
    console.error('Database upsertProductInDb failed:', error)
    throw error instanceof Error
      ? error
      : new Error('Unable to save product.', { cause: error })
  }
}

export async function updateProductQuickInDb(
  id: string,
  patch: {
    price?: number
    mrp?: number
    stock?: number
    isActive?: boolean
    isFeatured?: boolean
    variants?: ProductVariantOption[]
  },
  actorEmail?: string,
) {
  try {
    const serialized = await db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(products)
        .where(eq(products.id, id))
        .limit(1)
      const existing = existingRows[0]
      if (!existing) return null

      const nextPrice =
        patch.price !== undefined
          ? Math.round(Number(patch.price))
          : existing.price
      const nextMrp =
        patch.mrp !== undefined ? Math.round(Number(patch.mrp)) : existing.mrp
      const nextStock =
        patch.stock !== undefined
          ? Math.max(0, Math.round(Number(patch.stock)))
          : existing.stock

      if (!Number.isFinite(nextPrice) || nextPrice < 0) {
        throw new Error('Selling price must be 0 or greater.')
      }
      if (!Number.isFinite(nextMrp) || nextMrp < nextPrice) {
        throw new Error('MRP must be greater than or equal to selling price.')
      }

      const nextVariants: ProductVariantOption[] = Array.isArray(patch.variants)
        ? patch.variants.map((v, idx) => ({
            id: v.id || `v_${idx + 1}`,
            sku: (v.sku || '').trim(),
            size: (v.size || '').trim(),
            color: (v.color || '').trim(),
            label: v.label || [v.size?.trim(), v.color?.trim()].filter(Boolean).join(' / '),
            price: Math.max(0, Math.round(Number(v.price ?? nextPrice) || nextPrice)),
            mrp: Math.max(0, Math.round(Number(v.mrp ?? nextMrp) || nextMrp)),
            stock: Math.max(0, Math.round(Number(v.stock ?? 0) || 0)),
            isActive: v.isActive !== false,
          }))
        : existing.variants

      const updatedRows = await tx
        .update(products)
        .set({
          price: nextPrice,
          mrp: nextMrp,
          stock: nextStock,
          isActive:
            typeof patch.isActive === 'boolean' ? patch.isActive : existing.isActive,
          isFeatured:
            typeof patch.isFeatured === 'boolean'
              ? patch.isFeatured
              : existing.isFeatured,
          variants: nextVariants,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id))
        .returning()

      if (Array.isArray(patch.variants)) {
        await tx.delete(productVariants).where(eq(productVariants.productId, id))
        if (nextVariants.length > 0) {
          await tx.insert(productVariants).values(
            nextVariants.map((v) => ({
              productId: id,
              sku: v.sku || '',
              size: v.size || '',
              color: v.color || '',
              price: v.price,
              mrp: v.mrp ?? nextMrp,
              stock: v.stock,
              isActive: v.isActive !== false,
            })),
          )
        }
      }

      if (existing.stock !== nextStock) {
        await tx.insert(inventoryLogs).values({
          productId: id,
          productName: existing.name,
          variantSku: existing.sku || '',
          previousStock: existing.stock,
          changeQty: nextStock - existing.stock,
          newStock: nextStock,
          reason: 'quick_price_stock_edit',
          actorEmail: actorEmail ?? null,
        })
      }

      return serializeProduct(updatedRows[0])
    })

    if (!serialized) return null
    await syncProductToSupabase({ ...serialized, badge: serialized.badge ?? null })
    return serialized
  } catch (error) {
    console.error('Database updateProductQuickInDb failed:', error)
    throw error instanceof Error
      ? error
      : new Error('Unable to update product pricing & stock.', { cause: error })
  }
}

export async function updateProductStockInDb(
  id: string,
  stock: number,
  actorEmail?: string,
  reason = 'manual_adjustment',
) {
  try {
    const serialized = await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(products)
        .where(eq(products.id, id))
        .limit(1)
      if (!existing[0]) return null

      const cleanStock = Math.max(0, Math.round(Number(stock) || 0))
      const rows = await tx
        .update(products)
        .set({ stock: cleanStock, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning()
      if (!rows[0]) return null

      if (existing[0].stock !== cleanStock) {
        await tx.insert(inventoryLogs).values({
          productId: id,
          productName: rows[0].name,
          variantSku: rows[0].sku || '',
          previousStock: existing[0].stock,
          changeQty: cleanStock - existing[0].stock,
          newStock: cleanStock,
          reason,
          actorEmail: actorEmail ?? null,
        })
      }

      return serializeProduct(rows[0])
    })

    if (!serialized) return null
    await syncProductToSupabase({ ...serialized, badge: serialized.badge ?? null })
    return serialized
  } catch (error) {
    console.error('Database updateProductStockInDb failed:', error)
    throw new Error('Unable to update stock.', { cause: error })
  }
}

export async function deleteProductFromDb(id: string) {
  try {
    await db.delete(products).where(eq(products.id, id))
    await deleteProductFromSupabase(id)
  } catch (error) {
    console.error('Database deleteProductFromDb failed:', error)
    throw new Error('Unable to delete product.', { cause: error })
  }
}

export async function upsertCategoryInDb(input: {
  id: string
  label: string
  blurb?: string
  image?: string
  isActive?: boolean
  sortOrder?: number
}) {
  try {
    const cleanId = input.id
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
    const values = {
      id: cleanId,
      label: input.label.trim(),
      blurb: (input.blurb || '').trim(),
      image: (input.image || '/images/product-ht100.jpg').trim(),
      isActive: input.isActive !== false,
      sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
      updatedAt: new Date(),
    }
    const rows = await db
      .insert(categories)
      .values(values)
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          label: values.label,
          blurb: values.blurb,
          image: values.image,
          isActive: values.isActive,
          sortOrder: values.sortOrder,
          updatedAt: new Date(),
        },
      })
      .returning()
    await syncCategoryToSupabase(rows[0])
    return rows[0]
  } catch (error) {
    console.error('Database upsertCategoryInDb failed:', error)
    throw new Error('Unable to save category.', { cause: error })
  }
}

export async function deleteCategoryFromDb(id: string) {
  try {
    const linked = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.category, id))
      .limit(1)
    if (linked.length > 0) {
      throw new Error(
        'Cannot delete category while products are assigned to it. Move those products first.',
      )
    }
    await db.delete(categories).where(eq(categories.id, id))
    await deleteCategoryFromSupabase(id)
  } catch (error) {
    console.error('Database deleteCategoryFromDb failed:', error)
    throw error instanceof Error ? error : new Error('Unable to delete category.')
  }
}

/* ---------------------------------------- Telemetry (Cart & Click Views) */

export async function logCartEventInDb(input: {
  sessionId?: string
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
  try {
    await db.insert(cartEvents).values({
      sessionId: input.sessionId || '',
      eventType: input.eventType,
      customerEmail: input.customerEmail ?? null,
      customerName: input.customerName ?? null,
      productId: input.productId ?? null,
      productName: input.productName ?? null,
      unitPrice: input.unitPrice ?? null,
      qty: input.qty ?? 1,
      cartTotal: input.cartTotal ?? 0,
      cartItems: input.cartItems ?? [],
      paymentMethod: input.paymentMethod ?? null,
      orderCode: input.orderCode ?? null,
    })

    void logCartEventToSupabase({
      sessionId: input.sessionId || '',
      eventType: input.eventType,
      customerUid: input.customerUid ?? null,
      customerEmail: input.customerEmail ?? null,
      customerName: input.customerName ?? null,
      productId: input.productId ?? null,
      productName: input.productName ?? null,
      unitPrice: input.unitPrice ?? null,
      qty: input.qty ?? 1,
      cartTotal: input.cartTotal ?? 0,
      cartItems: input.cartItems ?? [],
      paymentMethod: input.paymentMethod ?? null,
      orderCode: input.orderCode ?? null,
    })
  } catch (error) {
    console.error('logCartEventInDb failed:', error)
  }
}

export async function logProductViewInDb(input: {
  sessionId?: string
  viewType: string
  productId?: string | null
  productName?: string | null
  category?: string | null
  customerUid?: string | null
  customerEmail?: string | null
  searchQuery?: string | null
}) {
  try {
    await db.insert(productViews).values({
      sessionId: input.sessionId || '',
      viewType: input.viewType,
      productId: input.productId ?? null,
      productName: input.productName ?? null,
      category: input.category ?? null,
      customerEmail: input.customerEmail ?? null,
      searchQuery: input.searchQuery ?? null,
    })

    void logProductViewToSupabase({
      sessionId: input.sessionId || '',
      viewType: input.viewType,
      productId: input.productId ?? null,
      productName: input.productName ?? null,
      category: input.category ?? null,
      customerUid: input.customerUid ?? null,
      customerEmail: input.customerEmail ?? null,
      searchQuery: input.searchQuery ?? null,
    })
  } catch (error) {
    console.error('logProductViewInDb failed:', error)
  }
}

export async function getRecentActivityForAdmin() {
  try {
    const [
      recentCart,
      recentViews,
      recentInventoryLogs,
      discountRows,
      fulfillmentRows,
      settingsRows,
      marketingRows,
      clickRows,
      checkoutRows,
    ] = await Promise.all([
      db.select().from(cartEvents).orderBy(desc(cartEvents.createdAt)).limit(200),
      db.select().from(productViews).orderBy(desc(productViews.createdAt)).limit(200),
      db.select().from(inventoryLogs).orderBy(desc(inventoryLogs.createdAt)).limit(100),
      db.select().from(discounts).orderBy(desc(discounts.createdAt)).limit(100),
      db.select().from(fulfillments).orderBy(desc(fulfillments.createdAt)).limit(150),
      db.select().from(storeSettings).where(eq(storeSettings.id, 'default')).limit(1),
      db
        .select()
        .from(marketingAttributions)
        .orderBy(desc(marketingAttributions.createdAt))
        .limit(150),
      db.select().from(clickEvents).orderBy(desc(clickEvents.createdAt)).limit(150),
      db
        .select()
        .from(checkoutEvents)
        .orderBy(desc(checkoutEvents.createdAt))
        .limit(150),
    ])

    let settings = settingsRows[0]
    if (!settings) {
      const inserted = await db
        .insert(storeSettings)
        .values({ id: 'default' })
        .onConflictDoNothing()
        .returning()
      settings =
        inserted[0] ??
        (
          await db
            .select()
            .from(storeSettings)
            .where(eq(storeSettings.id, 'default'))
            .limit(1)
        )[0]
    }

    return {
      cartEvents: recentCart,
      productViews: recentViews,
      inventoryLogs: recentInventoryLogs,
      discounts: discountRows,
      fulfillments: fulfillmentRows,
      settings,
      marketingAttributions: marketingRows,
      clickEvents: clickRows,
      checkoutEvents: checkoutRows,
    }
  } catch (error) {
    console.error('getRecentActivityForAdmin failed:', error)
    throw new Error('Unable to load activity feed.', { cause: error })
  }
}

export async function addNewsletterSubscriber(email: string) {
  try {
    const clean = email.trim().toLowerCase()
    await db
      .insert(newsletterSubscribers)
      .values({ email: clean })
      .onConflictDoNothing()
  } catch (error) {
    console.error('Database addNewsletterSubscriber failed:', error)
    throw new Error('Unable to subscribe right now.', { cause: error })
  }
}

export async function addContactMessage(input: {
  name: string
  email: string
  message: string
}) {
  try {
    const inserted = await db
      .insert(contactMessages)
      .values({
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        message: input.message.trim(),
      })
      .returning()
    return inserted[0]
  } catch (error) {
    console.error('Database addContactMessage failed:', error)
    throw new Error('Unable to send message right now.', { cause: error })
  }
}

export async function upsertDiscountInDb(input: {
  id?: number
  code: string
  description?: string
  discountType?: string
  value: number
  minOrderValue?: number
  maxDiscount?: number | null
  usageLimit?: number | null
  startsAt?: string | Date | null
  expiresAt?: string | Date | null
  isActive?: boolean
}) {
  const cleanCode = String(input.code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
  if (cleanCode.length < 2) {
    throw new Error('Discount code must be at least 2 alphanumeric characters.')
  }
  const discountType = input.discountType === 'fixed' ? 'fixed' : 'percentage'
  const cleanValue = Math.round(Number(input.value) || 0)
  if (cleanValue < 1) {
    throw new Error('Discount value must be at least 1.')
  }
  if (discountType === 'percentage' && cleanValue > 100) {
    throw new Error('Percentage discount cannot exceed 100%.')
  }
  const minOrderValue = Math.max(0, Math.round(Number(input.minOrderValue) || 0))
  const maxDiscount =
    input.maxDiscount !== undefined &&
    input.maxDiscount !== null &&
    String(input.maxDiscount).trim() !== '' &&
    Number(input.maxDiscount) > 0
      ? Math.round(Number(input.maxDiscount))
      : null
  const usageLimit =
    input.usageLimit !== undefined &&
    input.usageLimit !== null &&
    String(input.usageLimit).trim() !== '' &&
    Number(input.usageLimit) > 0
      ? Math.round(Number(input.usageLimit))
      : null
  const parseOptDate = (val: unknown): Date | null => {
    if (!val) return null
    const d = val instanceof Date ? val : new Date(String(val))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const startsAt = parseOptDate(input.startsAt)
  const expiresAt = parseOptDate(input.expiresAt)
  if (startsAt && expiresAt && expiresAt.getTime() < startsAt.getTime()) {
    throw new Error('End date must be on or after start date.')
  }
  const isActive = input.isActive !== false
  const description = String(input.description || '').trim()

  try {
    let row
    if (input.id && Number.isFinite(Number(input.id))) {
      const updated = await db
        .update(discounts)
        .set({
          code: cleanCode,
          description,
          discountType,
          value: cleanValue,
          minOrderValue,
          maxDiscount,
          usageLimit,
          startsAt,
          expiresAt,
          isActive,
        })
        .where(eq(discounts.id, Number(input.id)))
        .returning()
      row = updated[0]
    }
    if (!row) {
      const inserted = await db
        .insert(discounts)
        .values({
          code: cleanCode,
          description,
          discountType,
          value: cleanValue,
          minOrderValue,
          maxDiscount,
          usageLimit,
          startsAt,
          expiresAt,
          isActive,
        })
        .onConflictDoUpdate({
          target: discounts.code,
          set: {
            description,
            discountType,
            value: cleanValue,
            minOrderValue,
            maxDiscount,
            usageLimit,
            startsAt,
            expiresAt,
            isActive,
          },
        })
        .returning()
      row = inserted[0]
    }

    void syncDiscountToSupabase({
      code: row.code,
      description: row.description,
      discountType: row.discountType,
      value: row.value,
      minOrderValue: row.minOrderValue,
      maxDiscount: row.maxDiscount,
      usageLimit: row.usageLimit,
      usedCount: row.usedCount,
      isActive: row.isActive,
    })

    return row
  } catch (error) {
    console.error('Database upsertDiscountInDb failed:', error)
    throw error instanceof Error
      ? error
      : new Error('Unable to save discount code.')
  }
}

export async function deleteDiscountFromDb(id: number) {
  try {
    const existing = await db
      .select()
      .from(discounts)
      .where(eq(discounts.id, Number(id)))
      .limit(1)
    if (existing[0]) {
      await db.delete(discounts).where(eq(discounts.id, Number(id)))
      void deleteDiscountFromSupabase(existing[0].code)
    }
  } catch (error) {
    console.error('Database deleteDiscountFromDb failed:', error)
    throw new Error('Unable to delete discount.', { cause: error })
  }
}

