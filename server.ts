import crypto from 'crypto'
import dotenv from 'dotenv'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer as createViteServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

import fs from 'fs'
try {
  const envPath = path.join(__dirname, '.env')
  if (fs.existsSync(envPath)) {
    const envParsed = dotenv.parse(fs.readFileSync(envPath, 'utf8'))
    for (const k of Object.keys(envParsed)) {
      process.env[k] = envParsed[k]
    }
  }
} catch (e) {
  // ignore
}

dotenv.config({ path: '.env.local' })
dotenv.config()
import {
  addContactMessage,
  addNewsletterSubscriber,
  cancelCustomerOrder,
  createOrderInDb,
  deleteCategoryFromDb,
  deleteDiscountFromDb,
  deleteProductFromDb,
  getAllOrdersForAdmin,
  getOrderByCode,
  getOrdersForCustomer,
  getRecentActivityForAdmin,
  getStorefrontData,
  logCartEventInDb,
  logProductViewInDb,
  updateOrderAdminInDb,
  updateProductQuickInDb,
  updateProductStockInDb,
  upsertCategoryInDb,
  upsertDiscountInDb,
  upsertProductInDb,
} from './src/db/store.ts'
import {
  createAdminCustomerInDb,
  createEmailUser,
  deleteUserAddress,
  findUserByEmail,
  getOrCreateUser,
  getUserAddresses,
  listUsersForAdmin,
  saveUserAddress,
  setDefaultUserAddress,
  updateUserPassword,
  updateUserProfile,
} from './src/db/users.ts'
import { withDbRetry } from './src/db/index.ts'
import {
  deleteAddressFromSupabase,
  getSupabaseHealth,
  syncContactMessageToSupabase,
  syncCustomerToSupabase,
  syncFullDatasetToSupabase,
  syncNewsletterToSupabase,
  uploadProductImageToSupabaseStorage,
} from './src/lib/supabase.ts'
import {
  type AuthRequest,
  clearSessionCookie,
  createOtpChallenge,
  hashPassword,
  normalizePhoneNumber,
  optionalAuth,
  requireAdmin,
  requireAuth,
  setSessionCookie,
  signSessionToken,
  verifyFirebasePhoneIdToken,
  verifyOtpChallenge,
  verifyOtpProofToken,
  verifyPassword,
} from './src/middleware/auth.ts'

async function resolveDbUser(req: AuthRequest) {
  if (!req.authUser) return null
  return withDbRetry(() =>
    getOrCreateUser(
      req.authUser!.uid,
      req.authUser!.email,
      req.authUser!.name,
    ),
  )
}

function toSafeUser(
  userRow: {
    id: number
    uid: string
    email: string
    name: string
    phone: string | null
    role: string
    createdAt: Date
  },
  addressRows: Awaited<ReturnType<typeof getUserAddresses>>,
) {
  return {
    id: userRow.id,
    uid: userRow.uid,
    email: userRow.email,
    name: userRow.name,
    phone: userRow.phone || '',
    role: userRow.role || 'customer',
    createdAt: userRow.createdAt.getTime(),
    addresses: addressRows.map((a) => ({
      id: a.id,
      label: a.label,
      fullName: a.fullName,
      phone: a.phone,
      line1: a.line1,
      city: a.city,
      state: a.state || '',
      pincode: a.pincode,
      isDefault: a.isDefault,
    })),
  }
}

function parseEnvBool(val: string | undefined, fallback = false): boolean {
  if (val === undefined || val === '') return fallback
  const normalized = val.trim().replace(/^['"]|['"]$/g, '').toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function cleanEnvStr(val: string | undefined): string {
  return (val || '').toString().replace(/[\r\n]+/g, '').trim().replace(/^['"]|['"]$/g, '').trim()
}

function getRazorpayConfig() {
  const keyId = cleanEnvStr(
    process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_TEST_KEY_ID,
  )
  const keySecret = cleanEnvStr(
    process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_TEST_KEY_SECRET,
  )
  const hasCredentials =
    Boolean(keyId) &&
    Boolean(keySecret) &&
    !keyId.startsWith('MY_') &&
    !keySecret.startsWith('MY_')
  const enabled = parseEnvBool(process.env.RAZORPAY_ENABLED, true)
  const requestedMode = cleanEnvStr(process.env.RAZORPAY_MODE).toLowerCase()
  const mode =
    (requestedMode === 'live' || (!requestedMode && keyId.startsWith('rzp_live_'))) &&
    keyId.startsWith('rzp_live_')
      ? 'live'
      : 'test'

  return {
    enabled,
    mode,
    hasCredentials,
    keyId,
    keySecret,
  }
}

async function startServer() {
  const app = express()
  app.use(express.json({ limit: '6mb' }))

  /* --------------------------------------------------- public storefront */
  app.get('/api/storefront', async (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store')
      const data = await getStorefrontData()
      const rzp = getRazorpayConfig()
      res.json({
        ...data,
        payments: {
          razorpayEnabled: rzp.enabled,
          razorpayMode: rzp.mode,
          razorpayConfigured: rzp.hasCredentials,
        },
      })
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Failed to load storefront data.' })
    }
  })

  /* ------------------------------------------------------------ auth API */
  app.get('/api/auth/me', optionalAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.authUser) {
        return res.json({ user: null, orders: [] })
      }
      const dbUser = await resolveDbUser(req)
      if (!dbUser) {
        return res.json({ user: null, orders: [] })
      }
      const [addrs, custOrders] = await Promise.all([
        getUserAddresses(dbUser.id),
        getOrdersForCustomer(dbUser.id, dbUser.email),
      ])
      void syncCustomerToSupabase(dbUser, addrs)
      res.json({
        user: toSafeUser(dbUser, addrs),
        orders: custOrders,
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load account.' })
    }
  })

  app.post('/api/auth/google', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req)
      if (!dbUser) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      const [addrs, custOrders] = await Promise.all([
        getUserAddresses(dbUser.id),
        getOrdersForCustomer(dbUser.id, dbUser.email),
      ])
      const sessionPayload = {
        uid: dbUser.uid,
        email: dbUser.email,
        name: dbUser.name,
      }
      setSessionCookie(res, sessionPayload, req)
      void syncCustomerToSupabase(dbUser, addrs)
      res.json({
        user: toSafeUser(dbUser, addrs),
        orders: custOrders,
        sessionToken: signSessionToken(sessionPayload),
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Google sign-in failed.' })
    }
  })

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, phone = '', password } = req.body || {}
      const cleanName = String(name || '').trim()
      const cleanEmail = String(email || '').trim().toLowerCase()
      const cleanPw = String(password || '')

      if (!cleanName) {
        return res.status(400).json({ error: 'Please enter your full name.' })
      }
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' })
      }
      if (cleanPw.length < 6) {
        return res
          .status(400)
          .json({ error: 'Password must be at least 6 characters.' })
      }

      const existing = await findUserByEmail(cleanEmail)
      if (existing) {
        return res.status(409).json({
          error: 'An account with this email already exists. Please sign in.',
        })
      }

      const uid = `email:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const dbUser = await createEmailUser({
        uid,
        name: cleanName,
        email: cleanEmail,
        phone: String(phone || '').trim(),
        passwordHash: hashPassword(cleanPw),
      })

      const sessionPayload = {
        uid: dbUser.uid,
        email: dbUser.email,
        name: dbUser.name,
      }
      setSessionCookie(res, sessionPayload, req)

      void syncCustomerToSupabase(dbUser, [])

      const custOrders = await getOrdersForCustomer(dbUser.id, dbUser.email)
      res.status(201).json({
        user: toSafeUser(dbUser, []),
        orders: custOrders,
        sessionToken: signSessionToken(sessionPayload),
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Registration failed.' })
    }
  })

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {}
      const cleanEmail = String(email || '').trim().toLowerCase()
      const cleanPw = String(password || '')

      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' })
      }

      const dbUser = await findUserByEmail(cleanEmail)
      if (!dbUser) {
        return res.status(404).json({
          error: 'No account found with this email. Create an account first.',
        })
      }

      if (!dbUser.passwordHash) {
        return res.status(400).json({
          error: 'This email uses Google Sign-In. Click Continue with Google.',
        })
      }

      if (!verifyPassword(cleanPw, dbUser.passwordHash)) {
        return res.status(401).json({ error: 'Incorrect password. Please try again.' })
      }

      const sessionPayload = {
        uid: dbUser.uid,
        email: dbUser.email,
        name: dbUser.name,
      }
      setSessionCookie(res, sessionPayload, req)

      const [addrs, custOrders] = await Promise.all([
        getUserAddresses(dbUser.id),
        getOrdersForCustomer(dbUser.id, dbUser.email),
      ])

      void syncCustomerToSupabase(dbUser, addrs)

      res.json({
        user: toSafeUser(dbUser, addrs),
        orders: custOrders,
        sessionToken: signSessionToken(sessionPayload),
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Sign in failed.' })
    }
  })

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(res, req)
    res.json({ ok: true })
  })

  /* ------------------------------------------------------ account actions */
  app.patch('/api/account/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req)
      if (!dbUser) return res.status(401).json({ error: 'Unauthorized' })

      const { name, phone = '' } = req.body || {}
      if (!String(name || '').trim()) {
        return res.status(400).json({ error: 'Name cannot be empty.' })
      }

      const updated = await updateUserProfile(dbUser.id, {
        name: String(name),
        phone: String(phone),
      })
      const addrs = await getUserAddresses(dbUser.id)
      void syncCustomerToSupabase(updated, addrs)
      res.json({ user: toSafeUser(updated, addrs) })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Profile update failed.' })
    }
  })

  app.post('/api/account/password', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req)
      if (!dbUser) return res.status(401).json({ error: 'Unauthorized' })

      const { currentPassword, newPassword } = req.body || {}
      if (
        dbUser.passwordHash &&
        !verifyPassword(String(currentPassword || ''), dbUser.passwordHash)
      ) {
        return res.status(400).json({ error: 'Current password is incorrect.' })
      }
      if (!newPassword || String(newPassword).length < 6) {
        return res
          .status(400)
          .json({ error: 'New password must be at least 6 characters.' })
      }

      await updateUserPassword(dbUser.id, hashPassword(String(newPassword)))
      res.json({ ok: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Password update failed.' })
    }
  })

  app.post('/api/account/addresses', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req)
      if (!dbUser) return res.status(401).json({ error: 'Unauthorized' })

      const body = req.body || {}
      if (!body.fullName || !body.line1 || !body.city || !body.pincode) {
        return res.status(400).json({ error: 'Please complete all address fields.' })
      }

      await saveUserAddress(dbUser.id, body)
      const addrs = await getUserAddresses(dbUser.id)
      void syncCustomerToSupabase(dbUser, addrs)
      res.json({ user: toSafeUser(dbUser, addrs) })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to save address.' })
    }
  })

  app.delete(
    '/api/account/addresses/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const dbUser = await resolveDbUser(req)
        if (!dbUser) return res.status(401).json({ error: 'Unauthorized' })

        const addrId = Number(req.params.id)
        if (!Number.isFinite(addrId)) {
          return res.status(400).json({ error: 'Invalid address ID.' })
        }

        await deleteUserAddress(dbUser.id, addrId)
        void deleteAddressFromSupabase(addrId)
        const addrs = await getUserAddresses(dbUser.id)
        void syncCustomerToSupabase(dbUser, addrs)
        res.json({ user: toSafeUser(dbUser, addrs) })
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to delete address.' })
      }
    },
  )

  app.patch(
    '/api/account/addresses/:id/default',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const dbUser = await resolveDbUser(req)
        if (!dbUser) return res.status(401).json({ error: 'Unauthorized' })

        const addrId = Number(req.params.id)
        if (!Number.isFinite(addrId)) {
          return res.status(400).json({ error: 'Invalid address ID.' })
        }

        await setDefaultUserAddress(dbUser.id, addrId)
        const addrs = await getUserAddresses(dbUser.id)
        void syncCustomerToSupabase(dbUser, addrs)
        res.json({ user: toSafeUser(dbUser, addrs) })
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message || 'Failed to set default address.' })
      }
    },
  )

  /* ------------------------------------------------ Mobile OTP Verification */
  app.post('/api/otp/send', async (req, res) => {
    try {
      const rawPhone = String(req.body?.phone || '').trim()
      const challenge = createOtpChallenge(rawPhone)
      if (!challenge) {
        return res
          .status(400)
          .json({ error: 'Please enter a valid 10-digit mobile number.' })
      }

      const envMap = process.env as Record<string, string | undefined>
      const fast2smsKey = cleanEnvStr(envMap['FAST2SMS_API_KEY'])
      if (fast2smsKey && !fast2smsKey.startsWith('MY_')) {
        const smsRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: fast2smsKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: challenge.otp,
            numbers: challenge.phone,
          }),
        })
        if (!smsRes.ok) {
          return res.status(502).json({
            error: 'Unable to deliver SMS OTP right now. Please try again.',
          })
        }
        return res.json({
          ok: true,
          delivery: 'sms',
          phone: challenge.phone,
          maskedPhone: `+91 ${challenge.phone.slice(0, 2)}••••${challenge.phone.slice(-4)}`,
          challengeToken: challenge.challengeToken,
          expiresInSeconds: 300,
        })
      }

      return res.json({
        ok: true,
        delivery: 'firebase_phone',
        phone: challenge.phone,
        e164Phone: `+91${challenge.phone}`,
        maskedPhone: `+91 ${challenge.phone.slice(0, 2)}••••${challenge.phone.slice(-4)}`,
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to send OTP.' })
    }
  })

  app.post('/api/otp/verify', (req, res) => {
    const { phone = '', otp = '', challengeToken = '' } = req.body || {}
    const result = verifyOtpChallenge(
      String(phone),
      String(otp),
      String(challengeToken),
    )
    if (!result.valid || !result.otpToken) {
      return res.status(400).json({
        verified: false,
        error: 'Invalid or expired OTP. Please check the 6-digit code.',
      })
    }
    res.json({
      verified: true,
      phone: result.phone,
      otpToken: result.otpToken,
    })
  })

  app.post('/api/otp/verify-firebase', async (req, res) => {
    const { phone = '', firebaseIdToken = '' } = req.body || {}
    const result = await verifyFirebasePhoneIdToken(
      String(firebaseIdToken),
      String(phone),
    )
    if (!result.valid || !result.otpToken) {
      return res.status(400).json({
        verified: false,
        error: result.error || 'Phone verification failed. Please try again.',
      })
    }
    res.json({
      verified: true,
      phone: result.phone,
      otpToken: result.otpToken,
    })
  })

  /* --------------------------------------------------------------- orders */
  app.get('/api/orders', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req)
      if (!dbUser) return res.status(401).json({ error: 'Unauthorized' })

      const list = await getOrdersForCustomer(dbUser.id, dbUser.email)
      res.json({ orders: list })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load orders.' })
    }
  })

  app.post('/api/orders', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req)
      const {
        name,
        email,
        phone,
        otpToken = '',
        address,
        paymentMethod = 'Cash on Delivery',
        paymentStatus = 'pending',
        razorpayOrderId = null,
        razorpayPaymentId = null,
        items = [],
      } = req.body || {}

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Cart is empty.' })
      }

      const targetPhone = String(phone || dbUser?.phone || '').trim()
      const normalizedPhone = normalizePhoneNumber(targetPhone)
      if (!normalizedPhone) {
        return res
          .status(400)
          .json({ error: 'Please enter a valid 10-digit mobile number.' })
      }

      const created = await createOrderInDb({
        userId: dbUser?.id ?? null,
        customerUid: dbUser?.uid ?? null,
        customerEmail: email || dbUser?.email || null,
        customerName: name || dbUser?.name || 'Customer',
        phone: targetPhone,
        shippingAddress: address || null,
        paymentMethod,
        paymentStatus,
        razorpayOrderId,
        razorpayPaymentId,
        items: items.map((i: any) => ({
          productId: String(i.id || i.productId),
          qty: Number(i.qty) || 1,
          variantLabel: typeof i.variantLabel === 'string' ? i.variantLabel : null,
          sku: typeof i.sku === 'string' ? i.sku : null,
        })),
      })

      res.status(201).json({ order: created })
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to place order.' })
    }
  })

  app.get('/api/orders/track/:code', async (req, res) => {
    try {
      const order = await getOrderByCode(req.params.code)
      if (!order) {
        return res.status(404).json({ error: 'Order not found.' })
      }
      res.json({ order })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to track order.' })
    }
  })

  app.post(
    '/api/orders/:code/cancel',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const dbUser = await resolveDbUser(req)
        if (!dbUser) return res.status(401).json({ error: 'Unauthorized' })

        const updated = await cancelCustomerOrder(
          req.params.code,
          dbUser.id,
          dbUser.email,
        )
        if (!updated) {
          return res
            .status(404)
            .json({ error: 'Order cannot be cancelled or not found.' })
        }
        res.json({ order: updated })
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to cancel order.' })
      }
    },
  )

  /* ------------------------------ Razorpay Gateway (Server-side Env Driven) */
  app.get('/api/payments/razorpay/config', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const rzp = getRazorpayConfig()
    res.json({
      razorpayEnabled: rzp.enabled,
      razorpayMode: rzp.mode,
      razorpayConfigured: rzp.hasCredentials,
    })
  })

  app.post(
    '/api/payments/razorpay/create-order',
    optionalAuth,
    async (req: AuthRequest, res) => {
      const rzp = getRazorpayConfig()
      if (!rzp.enabled) {
        return res.status(503).json({
          enabled: false,
          error: 'Razorpay online payments are currently disabled.',
        })
      }
      try {
        const amount = Math.max(
          100,
          Math.round((Number(req.body?.amount) || 0) * 100),
        )
        const receipt = `rcpt_${Date.now()}`

        if (rzp.hasCredentials) {
          const authBasic = Buffer.from(`${rzp.keyId}:${rzp.keySecret}`).toString(
            'base64',
          )
          const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${authBasic}`,
            },
            body: JSON.stringify({
              amount,
              currency: 'INR',
              receipt,
              payment_capture: 1,
              notes: {
                store: 'HARBAN',
                ...(req.body?.customerEmail
                  ? { email: String(req.body.customerEmail) }
                  : {}),
                ...(req.body?.customerPhone
                  ? { phone: String(req.body.customerPhone) }
                  : {}),
              },
            }),
          })
          const rzpData: any = await rzpRes.json().catch(() => ({}))
          if (!rzpRes.ok) {
            return res
              .status(400)
              .json({ error: rzpData?.error?.description || 'Razorpay order failed.' })
          }
          return res.json({
            enabled: true,
            mode: rzp.mode,
            hasCredentials: true,
            keyId: rzp.keyId,
            orderId: rzpData.id,
            amount: rzpData.amount,
            currency: rzpData.currency || 'INR',
          })
        }

        // Razorpay Test Mode enabled without gateway credentials yet
        return res.json({
          enabled: true,
          mode: 'test',
          hasCredentials: false,
          orderId: `order_test_${Date.now()}`,
          amount,
          currency: 'INR',
        })
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'Payment init failed.' })
      }
    },
  )

  app.post('/api/payments/razorpay/verify', (req, res) => {
    const rzp = getRazorpayConfig()
    if (!rzp.enabled) {
      return res.status(503).json({
        verified: false,
        enabled: false,
        error: 'Razorpay online payments are currently disabled.',
      })
    }
    const {
      razorpay_order_id = '',
      razorpay_payment_id = '',
      razorpay_signature = '',
    } = req.body || {}
    if (!rzp.hasCredentials) {
      return res.json({ verified: true, mode: 'test' })
    }
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        verified: false,
        error: 'Missing Razorpay payment signature fields.',
      })
    }
    const expected = crypto
      .createHmac('sha256', rzp.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')
    const expectedBuf = Buffer.from(expected, 'utf8')
    const providedBuf = Buffer.from(String(razorpay_signature), 'utf8')
    const valid =
      expectedBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, providedBuf)
    if (!valid) {
      return res.status(400).json({ verified: false, error: 'Invalid signature' })
    }
    res.json({ verified: true, mode: rzp.mode })
  })

  /* ------------------------------------ Storefront Telemetry (Cart & Views) */
  app.post('/api/events/cart', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req)
      const body = req.body || {}
      await logCartEventInDb({
        sessionId: String(body.sessionId || ''),
        eventType: String(body.eventType || 'add_to_cart'),
        customerUid: dbUser?.uid ?? null,
        customerEmail: body.customerEmail || dbUser?.email || null,
        customerName: body.customerName || dbUser?.name || null,
        productId: body.productId ? String(body.productId) : null,
        productName: body.productName ? String(body.productName) : null,
        unitPrice:
          typeof body.unitPrice === 'number' ? Math.round(body.unitPrice) : null,
        qty: Number(body.qty) || 1,
        cartTotal: Math.round(Number(body.cartTotal) || 0),
        cartItems: Array.isArray(body.cartItems) ? body.cartItems : [],
        paymentMethod: body.paymentMethod ? String(body.paymentMethod) : null,
        orderCode: body.orderCode ? String(body.orderCode) : null,
      })
      res.status(201).json({ ok: true })
    } catch {
      res.status(200).json({ ok: false })
    }
  })

  app.post('/api/events/view', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req)
      const body = req.body || {}
      await logProductViewInDb({
        sessionId: String(body.sessionId || ''),
        viewType: String(body.viewType || 'quick_view'),
        productId: body.productId ? String(body.productId) : null,
        productName: body.productName ? String(body.productName) : null,
        category: body.category ? String(body.category) : null,
        customerUid: dbUser?.uid ?? null,
        customerEmail: body.customerEmail || dbUser?.email || null,
        searchQuery: body.searchQuery ? String(body.searchQuery) : null,
      })
      res.status(201).json({ ok: true })
    } catch {
      res.status(200).json({ ok: false })
    }
  })

  /* --------------------------------------------------- newsletter & contact */
  app.post('/api/newsletter', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase()
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: 'Enter a valid email to subscribe.' })
      }
      await addNewsletterSubscriber(email)
      void syncNewsletterToSupabase(email)
      res.json({ ok: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Subscription failed.' })
    }
  })

  app.post('/api/contact', async (req, res) => {
    try {
      const { name, email, message } = req.body || {}
      if (
        !String(name || '').trim() ||
        !/^\S+@\S+\.\S+$/.test(String(email || '').trim()) ||
        !String(message || '').trim()
      ) {
        return res
          .status(400)
          .json({ error: 'Please fill in your name, email and message.' })
      }
      const cleanName = String(name).trim()
      const cleanEmail = String(email).trim()
      const cleanMsg = String(message).trim()
      await addContactMessage({
        name: cleanName,
        email: cleanEmail,
        message: cleanMsg,
      })
      void syncContactMessageToSupabase({
        name: cleanName,
        email: cleanEmail,
        message: cleanMsg,
      })
      res.status(201).json({ ok: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to send message.' })
    }
  })

  app.get('/api/integrations/status', async (_req, res) => {
    try {
      const [supabaseHealth] = await Promise.all([getSupabaseHealth()])
      const rzp = getRazorpayConfig()
      res.json({
        supabase: supabaseHealth,
        razorpay: {
          enabled: rzp.enabled,
          mode: rzp.mode,
          configured: rzp.hasCredentials,
        },
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Status check failed.' })
    }
  })

  /* ---------------------------------------------- Admin Studio (Protected) */
  app.get(
    '/api/admin/overview',
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        res.setHeader('Cache-Control', 'no-store')
        const [catalog, allOrders, customers, activity, supabaseHealth] =
          await Promise.all([
            getStorefrontData(true),
            getAllOrdersForAdmin(),
            listUsersForAdmin(),
            getRecentActivityForAdmin(),
            getSupabaseHealth(),
          ])
        const rzp = getRazorpayConfig()
        res.json({
          products: catalog.products,
          categories: catalog.categories,
          reviews: catalog.testimonials,
          orders: allOrders,
          customers,
          cartEvents: activity.cartEvents,
          productViews: activity.productViews,
          inventoryLogs: activity.inventoryLogs,
          discounts: activity.discounts,
          fulfillments: activity.fulfillments,
          settings: activity.settings,
          marketingAttributions: activity.marketingAttributions,
          clickEvents: activity.clickEvents,
          checkoutEvents: activity.checkoutEvents,
          integrations: {
            supabase: supabaseHealth,
            razorpay: {
              enabled: rzp.enabled,
              mode: rzp.mode,
              configured: rzp.hasCredentials,
            },
          },
        })
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message || 'Failed to load admin overview.' })
      }
    },
  )

  app.post(
    '/api/admin/supabase/sync',
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const [catalog, allOrders, customers] = await Promise.all([
          getStorefrontData(true),
          getAllOrdersForAdmin(),
          listUsersForAdmin(),
        ])
        const result = await syncFullDatasetToSupabase({
          categories: catalog.categories,
          products: catalog.products,
          testimonials: catalog.testimonials,
          faqs: catalog.faqs,
          customers: customers.map((c) => ({
            uid: c.uid,
            email: c.email,
            name: c.name,
            phone: c.phone,
            role: c.role,
          })),
          orders: allOrders,
        })
        if ('ok' in result && !result.ok) {
          return res.status(400).json({
            ok: false,
            error:
              result.error ||
              'Supabase tables are not initialized yet. Run supabase/schema.sql in Supabase SQL Editor.',
          })
        }
        res.json({ ok: true, supabase: result })
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'Supabase sync failed.' })
      }
    },
  )

  app.post(
    '/api/admin/products',
    requireAuth,
    requireAdmin,
    async (req: AuthRequest, res) => {
      try {
        const body = req.body || {}
        if (!body.name || !String(body.name).trim() || !body.category) {
          return res
            .status(400)
            .json({ error: 'Product title and category are required.' })
        }
        const safeId =
          String(body.id || '').trim() ||
          String(body.name)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
        const saved = await upsertProductInDb({ ...body, id: safeId }, req.authUser?.email)
        res.json({ product: saved })
      } catch (error: any) {
        const msg = error?.message || 'Failed to save product.'
        const isValidation =
          msg.includes('required') ||
          msg.includes('MRP') ||
          msg.includes('Selling price') ||
          msg.includes('does not exist') ||
          msg.includes('Meesho URL')
        res.status(isValidation ? 400 : 500).json({ error: msg })
      }
    },
  )

  app.patch(
    '/api/admin/products/:id/quick',
    requireAuth,
    requireAdmin,
    async (req: AuthRequest, res) => {
      try {
        const body = req.body || {}
        const updated = await updateProductQuickInDb(
          req.params.id,
          {
            price: body.price !== undefined ? Number(body.price) : undefined,
            mrp: body.mrp !== undefined ? Number(body.mrp) : undefined,
            stock: body.stock !== undefined ? Number(body.stock) : undefined,
            isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
            isFeatured:
              typeof body.isFeatured === 'boolean' ? body.isFeatured : undefined,
            variants: Array.isArray(body.variants) ? body.variants : undefined,
          },
          req.authUser?.email,
        )
        if (!updated) {
          return res.status(404).json({ error: 'Product not found.' })
        }
        res.json({ product: updated })
      } catch (error: any) {
        const msg = error?.message || 'Failed to update pricing & stock.'
        const isValidation =
          msg.includes('MRP') || msg.includes('Selling price') || msg.includes('valid')
        res.status(isValidation ? 400 : 500).json({ error: msg })
      }
    },
  )

  app.patch(
    '/api/admin/products/:id/stock',
    requireAuth,
    requireAdmin,
    async (req: AuthRequest, res) => {
      try {
        const updated = await updateProductStockInDb(
          req.params.id,
          Number(req.body?.stock),
          req.authUser?.email,
          typeof req.body?.reason === 'string' ? req.body.reason : 'manual_adjustment',
        )
        if (!updated) {
          return res.status(404).json({ error: 'Product not found.' })
        }
        res.json({ product: updated })
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to update stock.' })
      }
    },
  )

  app.delete(
    '/api/admin/products/:id',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        await deleteProductFromDb(req.params.id)
        res.json({ ok: true })
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to delete product.' })
      }
    },
  )

  app.post(
    '/api/admin/categories',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const body = req.body || {}
        if (!body.id || !body.label) {
          return res
            .status(400)
            .json({ error: 'Category ID and label are required.' })
        }
        const saved = await upsertCategoryInDb(body)
        res.json({ category: saved })
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message || 'Failed to save category.' })
      }
    },
  )

  app.delete(
    '/api/admin/categories/:id',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        await deleteCategoryFromDb(req.params.id)
        res.json({ ok: true })
      } catch (error: any) {
        res
          .status(400)
          .json({ error: error.message || 'Failed to delete category.' })
      }
    },
  )

  app.post(
    '/api/admin/discounts',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const body = req.body || {}
        const saved = await upsertDiscountInDb({
          id: body.id ? Number(body.id) : undefined,
          code: String(body.code || ''),
          description: String(body.description || ''),
          discountType: String(body.discountType || 'percentage'),
          value: Number(body.value),
          minOrderValue: Number(body.minOrderValue) || 0,
          maxDiscount:
            body.maxDiscount !== undefined && body.maxDiscount !== null && body.maxDiscount !== ''
              ? Number(body.maxDiscount)
              : null,
          usageLimit:
            body.usageLimit !== undefined && body.usageLimit !== null && body.usageLimit !== ''
              ? Number(body.usageLimit)
              : null,
          startsAt: body.startsAt || null,
          expiresAt: body.expiresAt || null,
          isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
        })
        res.json({ discount: saved })
      } catch (error: any) {
        const msg = error?.message || 'Failed to save discount.'
        const isValidation =
          msg.includes('must be') || msg.includes('cannot exceed')
        res.status(isValidation ? 400 : 500).json({ error: msg })
      }
    },
  )

  app.delete(
    '/api/admin/discounts/:id',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const id = Number(req.params.id)
        if (!Number.isFinite(id) || id <= 0) {
          return res.status(400).json({ error: 'Invalid discount ID.' })
        }
        await deleteDiscountFromDb(id)
        res.json({ ok: true })
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message || 'Failed to delete discount.' })
      }
    },
  )

  app.post(
    '/api/admin/customers',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const body = req.body || {}
        const created = await createAdminCustomerInDb({
          name: String(body.name || ''),
          email: String(body.email || ''),
          phone: String(body.phone || ''),
          role: String(body.role || 'customer'),
        })
        void syncCustomerToSupabase(
          {
            uid: created.uid,
            email: created.email,
            name: created.name,
            phone: created.phone,
            role: created.role,
          },
          [],
        )
        res.json({ customer: created })
      } catch (error: any) {
        const msg = error?.message || 'Failed to create customer.'
        const isValidation =
          msg.includes('required') ||
          msg.includes('valid') ||
          msg.includes('already exists')
        res.status(isValidation ? 400 : 500).json({ error: msg })
      }
    },
  )

  app.post(
    '/api/admin/orders',
    requireAuth,
    requireAdmin,
    async (req: AuthRequest, res) => {
      try {
        const body = req.body || {}
        const customerName = String(body.customerName || '').trim()
        const customerEmail = String(body.customerEmail || '').trim().toLowerCase() || null
        const phone = String(body.phone || '').trim()
        const items = Array.isArray(body.items) ? body.items : []

        if (!customerName) {
          return res.status(400).json({ error: 'Customer name is required.' })
        }
        if (items.length === 0) {
          return res.status(400).json({ error: 'Select at least one product item.' })
        }

        const created = await createOrderInDb({
          userId: null,
          customerUid: null,
          customerEmail,
          customerName,
          phone,
          shippingAddress: body.shippingAddress || null,
          paymentMethod: String(body.paymentMethod || 'Admin Manual'),
          paymentStatus: ['paid', 'pending', 'initiated'].includes(
            String(body.paymentStatus || '').toLowerCase(),
          )
            ? String(body.paymentStatus).toLowerCase()
            : 'pending',
          items: items.map((i: any) => ({
            productId: String(i.productId || i.id),
            qty: Math.max(1, Number(i.qty) || 1),
            variantLabel: typeof i.variantLabel === 'string' ? i.variantLabel : null,
            sku: typeof i.sku === 'string' ? i.sku : null,
          })),
        })

        let finalOrder = created
        const notes = String(body.internalNotes || '').trim()
        const rawStatus = String(body.orderStatus || '').toLowerCase()
        const initialStatus =
          rawStatus === 'confirmed' || rawStatus === 'processing'
            ? rawStatus
            : undefined
        if (notes || initialStatus) {
          const updated = await updateOrderAdminInDb(
            created.id,
            {
              internalNotes: notes || undefined,
              orderStatus: initialStatus,
            },
            req.authUser?.email,
          )
          if (updated) finalOrder = updated
        }

        res.status(201).json({ order: finalOrder })
      } catch (error: any) {
        res.status(400).json({ error: error?.message || 'Failed to create order.' })
      }
    },
  )

  app.patch(
    '/api/admin/orders/:code',
    requireAuth,
    requireAdmin,
    async (req: AuthRequest, res) => {
      try {
        const body = req.body || {}
        const updated = await updateOrderAdminInDb(
          req.params.code,
          {
            orderStatus:
              typeof body.orderStatus === 'string' ? body.orderStatus : undefined,
            status: typeof body.status === 'number' ? body.status : undefined,
            cancelled:
              typeof body.cancelled === 'boolean' ? body.cancelled : undefined,
            paymentStatus:
              typeof body.paymentStatus === 'string' ? body.paymentStatus : undefined,
            courierPartner:
              typeof body.courierPartner === 'string' ? body.courierPartner : undefined,
            trackingNumber:
              typeof body.trackingNumber === 'string' ? body.trackingNumber : undefined,
            trackingUrl:
              typeof body.trackingUrl === 'string' ? body.trackingUrl : undefined,
            internalNotes:
              typeof body.internalNotes === 'string' ? body.internalNotes : undefined,
            cancelReason:
              typeof body.cancelReason === 'string' ? body.cancelReason : undefined,
          },
          req.authUser?.email,
        )
        if (!updated) {
          return res.status(404).json({ error: 'Order not found.' })
        }
        res.json({ order: updated })
      } catch (error: any) {
        const msg = error?.message || 'Failed to update order.'
        const isValidation =
          msg.includes('Cannot change order') ||
          msg.includes('Invalid order status') ||
          msg.includes('cancellation reason')
        res.status(isValidation ? 400 : 500).json({ error: msg })
      }
    },
  )

  app.post(
    '/api/admin/upload',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const { filename = 'product.jpg', mimeType = 'image/jpeg', dataBase64 = '' } =
          req.body || {}
        if (!dataBase64) {
          return res.status(400).json({ error: 'Image payload missing.' })
        }
        const base64Clean = String(dataBase64).replace(/^data:[^;]+;base64,/, '')
        const buffer = Buffer.from(base64Clean, 'base64')
        const uploaded = await uploadProductImageToSupabaseStorage({
          filename: String(filename),
          mimeType: String(mimeType),
          buffer,
        })
        if (!uploaded.ok || !uploaded.url) {
          return res.status(400).json({
            error:
              uploaded.error ||
              'Ensure the public "product-images" Storage bucket is created in Supabase.',
          })
        }
        res.json({ url: uploaded.url })
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'Image upload failed.' })
      }
    },
  )

  /* --------------------------------------------------------- Vite / Static */
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distDir = path.join(__dirname, 'dist')
    app.use(express.static(distDir))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  const port = 3000
  app.listen(port, '0.0.0.0', () => {
    console.log(`HARBAN server listening on http://0.0.0.0:${port}`)
  })
}

startServer().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
