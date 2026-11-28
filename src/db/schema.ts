import { relations } from 'drizzle-orm'
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export interface ProductSpec {
  label: string
  value: string
}

export interface ProductVariantOption {
  id?: string
  sku: string
  size?: string
  color?: string
  label?: string
  price: number
  mrp?: number
  stock: number
  isActive?: boolean
}

export interface ShippingAddressSnapshot {
  label?: string
  fullName: string
  phone?: string
  line1: string
  city: string
  state?: string
  pincode: string
}

export interface FulfillmentItemSnapshot {
  productId: string
  productName: string
  sku?: string
  variantLabel?: string
  qty: number
}

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  blurb: text('blurb').notNull(),
  image: text('image').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  sku: text('sku').notNull().default(''),
  name: text('name').notNull(),
  tagline: text('tagline').notNull(),
  price: integer('price').notNull(),
  mrp: integer('mrp').notNull(),
  rating: real('rating').notNull().default(4.7),
  reviewsCount: integer('reviews_count').notNull().default(0),
  image: text('image').notNull(),
  images: jsonb('images').$type<string[]>().notNull().default([]),
  category: text('category')
    .references(() => categories.id)
    .notNull(),
  badge: text('badge'),
  shortDesc: text('short_desc').notNull(),
  description: text('description').notNull(),
  features: jsonb('features').$type<string[]>().notNull().default([]),
  specs: jsonb('specs').$type<ProductSpec[]>().notNull().default([]),
  variants: jsonb('variants').$type<ProductVariantOption[]>().notNull().default([]),
  stock: integer('stock').notNull().default(50),
  meeshoUrl: text('meesho_url'),
  isActive: boolean('is_active').notNull().default(true),
  isFeatured: boolean('is_featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productId: text('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  sku: text('sku').notNull().default(''),
  size: text('size').notNull().default(''),
  color: text('color').notNull().default(''),
  price: integer('price').notNull(),
  mrp: integer('mrp').notNull().default(0),
  stock: integer('stock').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),
  productId: text('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  url: text('url').notNull(),
  alt: text('alt').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  productId: text('product_id'),
  authorName: text('author_name').notNull(),
  city: text('city').notNull(),
  quote: text('quote').notNull(),
  productName: text('product_name').notNull(),
  rating: integer('rating').notNull().default(5),
  isApproved: boolean('is_approved').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const faqs = pgTable('faqs', {
  id: serial('id').primaryKey(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  phone: text('phone').default(''),
  role: text('role').notNull().default('customer'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  label: text('label').notNull().default('Home'),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull().default(''),
  line1: text('line1').notNull(),
  city: text('city').notNull(),
  state: text('state').default(''),
  pincode: text('pincode').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderCode: text('order_code').notNull().unique(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  customerEmail: text('customer_email'),
  customerName: text('customer_name').notNull(),
  phone: text('phone').default(''),
  shippingAddress: jsonb('shipping_address').$type<ShippingAddressSnapshot | null>(),
  billingAddress: jsonb('billing_address').$type<ShippingAddressSnapshot | null>(),
  paymentMethod: text('payment_method').notNull().default('Cash on Delivery'),
  paymentStatus: text('payment_status').notNull().default('pending'),
  razorpayOrderId: text('razorpay_order_id'),
  razorpayPaymentId: text('razorpay_payment_id'),
  subtotal: integer('subtotal').notNull(),
  discountCode: text('discount_code'),
  discountAmount: integer('discount_amount').notNull().default(0),
  shipping: integer('shipping').notNull().default(0),
  total: integer('total').notNull(),
  status: integer('status').notNull().default(1),
  fulfillmentStatus: text('fulfillment_status').notNull().default('unfulfilled'),
  cancelled: boolean('cancelled').notNull().default(false),
  refundStatus: text('refund_status').notNull().default('none'),
  refundAmount: integer('refund_amount').notNull().default(0),
  internalNotes: text('internal_notes').notNull().default(''),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  etaAt: timestamp('eta_at').notNull(),
  placedAt: timestamp('placed_at').defaultNow().notNull(),
})

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  productImage: text('product_image').notNull(),
  sku: text('sku'),
  variantLabel: text('variant_label'),
  unitPrice: integer('unit_price').notNull(),
  qty: integer('qty').notNull(),
  fulfilledQty: integer('fulfilled_qty').notNull().default(0),
})

export const fulfillments = pgTable('fulfillments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  orderCode: text('order_code').notNull(),
  status: text('status').notNull().default('unfulfilled'),
  courierPartner: text('courier_partner').notNull().default(''),
  trackingNumber: text('tracking_number').notNull().default(''),
  trackingUrl: text('tracking_url').notNull().default(''),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
  items: jsonb('items').$type<FulfillmentItemSnapshot[]>().notNull().default([]),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  orderCode: text('order_code').notNull(),
  provider: text('provider').notNull().default('cod'),
  method: text('method').notNull().default('Cash on Delivery'),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('INR'),
  status: text('status').notNull().default('pending'),
  razorpayOrderId: text('razorpay_order_id'),
  razorpayPaymentId: text('razorpay_payment_id'),
  signatureVerified: boolean('signature_verified').notNull().default(false),
  refundedAmount: integer('refunded_amount').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const inventoryLogs = pgTable('inventory_logs', {
  id: serial('id').primaryKey(),
  productId: text('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  productName: text('product_name').notNull(),
  variantSku: text('variant_sku').notNull().default(''),
  previousStock: integer('previous_stock').notNull(),
  changeQty: integer('change_qty').notNull(),
  newStock: integer('new_stock').notNull(),
  reason: text('reason').notNull().default('manual_adjustment'),
  referenceId: text('reference_id'),
  actorEmail: text('actor_email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const discounts = pgTable('discounts', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').notNull().default(''),
  discountType: text('discount_type').notNull().default('percentage'),
  value: integer('value').notNull(),
  minOrderValue: integer('min_order_value').notNull().default(0),
  maxDiscount: integer('max_discount'),
  usageLimit: integer('usage_limit'),
  usedCount: integer('used_count').notNull().default(0),
  startsAt: timestamp('starts_at'),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const cartEvents = pgTable('cart_events', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull().default(''),
  eventType: text('event_type').notNull(),
  customerEmail: text('customer_email'),
  customerName: text('customer_name'),
  productId: text('product_id'),
  productName: text('product_name'),
  unitPrice: integer('unit_price'),
  qty: integer('qty').notNull().default(1),
  cartTotal: integer('cart_total').notNull().default(0),
  cartItems: jsonb('cart_items').$type<Record<string, unknown>[]>().notNull().default([]),
  paymentMethod: text('payment_method'),
  orderCode: text('order_code'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const productViews = pgTable('product_views', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull().default(''),
  viewType: text('view_type').notNull().default('quick_view'),
  productId: text('product_id'),
  productName: text('product_name'),
  category: text('category'),
  customerEmail: text('customer_email'),
  searchQuery: text('search_query'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const clickEvents = pgTable('click_events', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull().default(''),
  eventType: text('event_type').notNull().default('product_click'),
  productId: text('product_id'),
  productName: text('product_name'),
  category: text('category'),
  source: text('source'),
  targetUrl: text('target_url'),
  customerEmail: text('customer_email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const checkoutEvents = pgTable('checkout_events', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull().default(''),
  step: text('step').notNull().default('initiated'),
  cartTotal: integer('cart_total').notNull().default(0),
  discountCode: text('discount_code'),
  paymentMethod: text('payment_method'),
  customerEmail: text('customer_email'),
  orderCode: text('order_code'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const marketingAttributions = pgTable('marketing_attributions', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull().default(''),
  source: text('source').notNull().default('direct'),
  medium: text('medium').notNull().default('none'),
  campaign: text('campaign').notNull().default(''),
  referrer: text('referrer').notNull().default(''),
  landingPath: text('landing_path').notNull().default('/'),
  orderCode: text('order_code'),
  revenue: integer('revenue').notNull().default(0),
  customerEmail: text('customer_email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const storeSettings = pgTable('store_settings', {
  id: text('id').primaryKey(),
  storeName: text('store_name').notNull().default('HARBAN'),
  supportEmail: text('support_email').notNull().default('harban.official@gmail.com'),
  supportPhone: text('support_phone').notNull().default('+91 95551 37346'),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  freeShippingThreshold: integer('free_shipping_threshold').notNull().default(1500),
  razorpayTestMode: boolean('razorpay_test_mode').notNull().default(true),
  courierProvider: text('courier_provider').notNull().default('Manual / Configurable'),
  courierApiEndpoint: text('courier_api_endpoint').notNull().default(''),
  courierAutoDispatch: boolean('courier_auto_dispatch').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const contactMessages = pgTable('contact_messages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}))

export const productsRelations = relations(products, ({ one, many }) => ({
  categoryMeta: one(categories, {
    fields: [products.category],
    references: [categories.id],
  }),
  variantsList: many(productVariants),
  imagesList: many(productImages),
  inventoryLogs: many(inventoryLogs),
}))

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
}))

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}))

export const inventoryLogsRelations = relations(inventoryLogs, ({ one }) => ({
  product: one(products, {
    fields: [inventoryLogs.productId],
    references: [products.id],
  }),
}))

export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  orders: many(orders),
}))

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, {
    fields: [addresses.userId],
    references: [users.id],
  }),
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
  fulfillments: many(fulfillments),
  payments: many(payments),
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}))

export const fulfillmentsRelations = relations(fulfillments, ({ one }) => ({
  order: one(orders, {
    fields: [fulfillments.orderId],
    references: [orders.id],
  }),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}))
