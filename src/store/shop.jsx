import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  RecaptchaVerifier,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { auth, googleAuthProvider, phoneOtpAuth } from '../lib/firebase'
import {
  consumeOAuthCallbackError,
  getBrowserSupabase,
  sbCancelOrder,
  sbChangePassword,
  sbCreateAdminOrder,
  sbCreateCustomer,
  sbDeleteAddress,
  sbDeleteCategory,
  sbDeleteDiscount,
  sbDeleteProduct,
  sbGetAccount,
  sbGetAdminOverview,
  sbGetStorefront,
  sbLogCartEvent,
  sbLogViewEvent,
  sbLoginWithEmail,
  sbLoginWithGoogle,
  sbLogout,
  sbPlaceOrder,
  sbRegisterWithEmail,
  sbSaveAddress,
  sbSaveCategory,
  sbSaveDiscount,
  sbSaveProduct,
  sbSendContactMessage,
  sbSetDefaultAddress,
  sbSubscribeNewsletter,
  sbTrackOrderByCode,
  sbUpdateAdminOrder,
  sbUpdateProductQuick,
  sbUpdateProfile,
  sbUpdateStock,
  sbUploadImage,
} from '../lib/supabaseBrowser'
import {
  categories as initialCategories,
  faqs as initialFaqs,
  marqueeStats as initialMarqueeStats,
  products as initialProducts,
  testimonials as initialTestimonials,
} from '../data/products'

const ShopContext = createContext(null)

/* ---------------------------------------------------------------- helpers */

export const formatINR = (n) => `Rs. ${Number(n).toLocaleString('en-IN')}`

export const discountOf = (p) => Math.round(((p.mrp - p.price) / p.mrp) * 100)

export const FREE_SHIP_THRESHOLD = 1500

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

function getClientSessionId() {
  const existing = readLocal('harban-sid', null)
  if (existing) return existing
  const created = `sid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  writeLocal('harban-sid', created)
  return created
}

export const ORDER_STAGES = [
  'Order placed',
  'Packed',
  'Shipped',
  'Out for delivery',
  'Delivered',
]

export const NAV_ITEMS = [
  { id: 'home', label: 'Home' },
  { id: 'trimmers', label: 'Trimmers' },
  { id: 'accessories', label: 'Accessories' },
  { id: 'support', label: 'Support' },
]

const STATIC_ROUTE_PATHS = {
  home: '/',
  all: '/shop',
  trimmers: '/trimmers',
  accessories: '/accessories',
  story: '/story',
  account: '/account',
  orders: '/orders',
  admin: '/admin',
  support: '/support',
  contact: '/contact',
  checkout: '/checkout',
  'order-confirmed': '/order-confirmed',
}

function routeToPath(nextRoute) {
  if (!nextRoute || nextRoute === 'home') return '/'
  if (STATIC_ROUTE_PATHS[nextRoute]) return STATIC_ROUTE_PATHS[nextRoute]
  if (nextRoute.startsWith('policy:')) {
    return `/policy/${encodeURIComponent(nextRoute.slice('policy:'.length))}`
  }
  if (nextRoute.startsWith('product:')) {
    return `/product/${encodeURIComponent(nextRoute.slice('product:'.length))}`
  }
  return `/category/${encodeURIComponent(nextRoute)}`
}

function pathToRoute(pathname) {
  const clean = String(pathname || '/').replace(/\/+$/, '') || '/'
  if (clean === '/') return 'home'
  if (clean === '/my-orders' || clean === '/track' || clean === '/track-order') {
    return 'orders'
  }
  for (const [key, path] of Object.entries(STATIC_ROUTE_PATHS)) {
    if (path === clean) return key
  }
  if (clean.startsWith('/policy/')) {
    return `policy:${decodeURIComponent(clean.slice('/policy/'.length))}`
  }
  if (clean.startsWith('/product/')) {
    return `product:${decodeURIComponent(clean.slice('/product/'.length))}`
  }
  if (clean.startsWith('/category/')) {
    return decodeURIComponent(clean.slice('/category/'.length))
  }
  const bare = clean.slice(1)
  if (bare && !bare.includes('/')) return decodeURIComponent(bare)
  return 'home'
}

function hasOAuthCallbackParams() {
  if (typeof window === 'undefined') return false
  const s = window.location.search || ''
  const h = window.location.hash || ''
  return (
    s.includes('code=') ||
    s.includes('error=') ||
    h.includes('access_token=') ||
    h.includes('error=')
  )
}

function resolveApiBase() {
  const raw = String(import.meta.env.VITE_API_BASE_URL || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/+$/, '')
  if (!raw) return ''
  // Ignore non-URL strings (e.g. a bare Supabase project ID) or Supabase project URLs
  if (!/^https?:\/\/[^/\s]+/i.test(raw)) return ''
  try {
    const host = new URL(raw).hostname.toLowerCase()
    if (host.endsWith('.supabase.co') || host.endsWith('.supabase.in')) return ''
  } catch {
    return ''
  }
  return raw
}

const API_BASE = resolveApiBase()
const SESSION_TOKEN_KEY = 'harban-session-token'

function readSessionToken() {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

function writeSessionToken(token) {
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token)
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY)
    }
  } catch {
    /* ignore storage errors */
  }
}

class BackendUnavailableError extends Error {
  constructor() {
    super('API backend unavailable; using Supabase direct mode.')
    this.name = 'BackendUnavailableError'
  }
}

let detectedMode = API_BASE ? 'api' : null
let modeProbePromise = null

async function probeBackendMode() {
  if (detectedMode) return detectedMode
  if (modeProbePromise) return modeProbePromise

  modeProbePromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/storefront`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const ct = (res.headers.get('content-type') || '').toLowerCase()
      if (ct.includes('application/json') && res.status !== 404 && res.status !== 405) {
        detectedMode = 'api'
        return 'api'
      }
    } catch {
      /* fallback to supabase direct mode */
    }
    detectedMode = 'supabase'
    return 'supabase'
  })()

  return modeProbePromise
}

async function apiFetch(url, options = {}) {
  if (detectedMode === 'supabase') {
    throw new BackendUnavailableError()
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken()
      if (token) headers.Authorization = `Bearer ${token}`
    } catch {
      /* ignore token fetch failure; server handles auth */
    }
  }
  if (!headers.Authorization) {
    const storedToken = readSessionToken()
    if (storedToken) {
      headers.Authorization = `Bearer ${storedToken}`
    }
  }

  const targetUrl = url.startsWith('http') ? url : `${API_BASE}${url}`
  let res
  try {
    res = await fetch(targetUrl, {
      credentials: 'include',
      ...options,
      headers,
    })
  } catch {
    if (!API_BASE) {
      detectedMode = 'supabase'
      throw new BackendUnavailableError()
    }
    throw new Error('Network error. Please check your connection.')
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase()
  const isJson = contentType.includes('application/json')
  if (!isJson || res.status === 404 || res.status === 405) {
    if (!API_BASE && !contentType.includes('application/json')) {
      detectedMode = 'supabase'
      throw new BackendUnavailableError()
    }
    if (res.status === 404 && !isJson) {
      detectedMode = 'supabase'
      throw new BackendUnavailableError()
    }
  }

  const data = isJson ? await res.json().catch(() => ({})) : {}
  if (!res.ok) {
    throw new Error(data.error || 'Request failed. Please try again.')
  }
  detectedMode = 'api'
  return data
}

async function withSupabaseFallback(apiFn, supabaseFn) {
  try {
    return await apiFn()
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      return supabaseFn()
    }
    throw err
  }
}

/* -------------------------------------------------------------- provider */

export function ShopProvider({ children }) {
  const [sessionId] = useState(() => getClientSessionId())
  const [products, setProducts] = useState(initialProducts)
  const [categories, setCategories] = useState(initialCategories)
  const [testimonials, setTestimonials] = useState(initialTestimonials)
  const [faqs, setFaqs] = useState(initialFaqs)
  const [marqueeStats, setMarqueeStats] = useState(initialMarqueeStats)
  const [payments, setPayments] = useState({
    razorpayEnabled: true,
    razorpayMode: 'test',
    razorpayConfigured: false,
  })

  const [cart, setCart] = useState(() => readLocal('harban-cart', []))
  const [orders, setOrders] = useState([])
  const [lastOrder, setLastOrder] = useState(null)
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authCallbackError, setAuthCallbackError] = useState('')

  const [cartOpen, setCartOpenState] = useState(false)
  const [trackOpen, setTrackOpenState] = useState(false)
  const [search, setSearch] = useState('')
  const [quickView, setQuickViewState] = useState(null)
  const [toasts, setToasts] = useState([])
  const [route, setRouteState] = useState(() =>
    typeof window !== 'undefined' ? pathToRoute(window.location.pathname) : 'home',
  )

  const routeRef = useRef(route)
  const productsRef = useRef(products)
  const cartOpenRef = useRef(cartOpen)
  const trackOpenRef = useRef(trackOpen)
  const quickViewRef = useRef(quickView)
  useEffect(() => {
    routeRef.current = route
  }, [route])
  useEffect(() => {
    productsRef.current = products
  }, [products])
  useEffect(() => {
    cartOpenRef.current = cartOpen
  }, [cartOpen])
  useEffect(() => {
    trackOpenRef.current = trackOpen
  }, [trackOpen])
  useEffect(() => {
    quickViewRef.current = quickView
  }, [quickView])

  const pushOverlayHistory = useCallback((overlayType, extra = {}) => {
    if (typeof window === 'undefined') return
    try {
      const currentRoute = routeRef.current || 'home'
      const nextState = {
        harban: true,
        route: currentRoute,
        overlay: overlayType,
        ...extra,
      }
      const targetPath = routeToPath(currentRoute)
      if (window.history.state?.overlay) {
        window.history.replaceState(nextState, '', targetPath)
      } else {
        window.history.pushState(nextState, '', targetPath)
      }
    } catch {
      /* ignore history API restrictions */
    }
  }, [])

  const popOverlayHistoryIfActive = useCallback((overlayType) => {
    if (typeof window === 'undefined') return
    queueMicrotask(() => {
      try {
        if (window.history.state?.harban && window.history.state?.overlay === overlayType) {
          window.history.back()
        }
      } catch {
        /* ignore history API restrictions */
      }
    })
  }, [])

  const navigateRoute = useCallback((next, { replace = false } = {}) => {
    const target = next || 'home'
    const prev = routeRef.current
    routeRef.current = target
    cartOpenRef.current = false
    trackOpenRef.current = false
    quickViewRef.current = null
    setRouteState(target)
    setCartOpenState(false)
    setTrackOpenState(false)
    setQuickViewState(null)

    if (typeof window !== 'undefined') {
      try {
        const targetPath = routeToPath(target)
        const nextState = { harban: true, route: target, overlay: null }
        const curState = window.history.state
        if (replace || curState?.overlay) {
          window.history.replaceState(nextState, '', targetPath)
        } else if (
          prev !== target ||
          window.location.pathname !== targetPath ||
          curState?.route !== target
        ) {
          window.history.pushState(nextState, '', targetPath)
        }
      } catch {
        /* ignore history API restrictions */
      }
    }
  }, [])

  const setCartOpen = useCallback(
    (next) => {
      const prev = cartOpenRef.current
      const resolved = typeof next === 'function' ? Boolean(next(prev)) : Boolean(next)
      cartOpenRef.current = resolved
      setCartOpenState(resolved)
      if (resolved && !prev) {
        trackOpenRef.current = false
        quickViewRef.current = null
        setTrackOpenState(false)
        setQuickViewState(null)
        pushOverlayHistory('cart')
      } else if (!resolved && prev) {
        popOverlayHistoryIfActive('cart')
      }
    },
    [popOverlayHistoryIfActive, pushOverlayHistory],
  )

  const setTrackOpen = useCallback(
    (next) => {
      const prev = trackOpenRef.current
      const resolved = typeof next === 'function' ? Boolean(next(prev)) : Boolean(next)
      trackOpenRef.current = resolved
      setTrackOpenState(resolved)
      if (resolved && !prev) {
        cartOpenRef.current = false
        quickViewRef.current = null
        setCartOpenState(false)
        setQuickViewState(null)
        pushOverlayHistory('track')
      } else if (!resolved && prev) {
        popOverlayHistoryIfActive('track')
      }
    },
    [popOverlayHistoryIfActive, pushOverlayHistory],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!hasOAuthCallbackParams()) {
      try {
        const initialRoute = routeRef.current || 'home'
        window.history.replaceState(
          { harban: true, route: initialRoute, overlay: null },
          '',
          routeToPath(initialRoute),
        )
      } catch {
        /* ignore history API restrictions */
      }
    }

    const onPopState = (event) => {
      const st = event.state
      const nextRoute =
        st?.harban && st?.route ? st.route : pathToRoute(window.location.pathname)
      const nextOverlay = st?.harban ? st.overlay || null : null
      const routeChanged = nextRoute !== routeRef.current

      routeRef.current = nextRoute
      cartOpenRef.current = nextOverlay === 'cart'
      trackOpenRef.current = nextOverlay === 'track'
      const matchedProduct =
        nextOverlay === 'quickview' && st?.quickViewId
          ? productsRef.current.find((p) => p.id === st.quickViewId) || null
          : null
      quickViewRef.current = matchedProduct

      setRouteState(nextRoute)
      setCartOpenState(nextOverlay === 'cart')
      setTrackOpenState(nextOverlay === 'track')
      setQuickViewState(matchedProduct)

      if (routeChanged) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => writeLocal('harban-cart', cart), [cart])

  const pushToast = useCallback((message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts((t) => [...t, { id, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])

  const refreshStorefront = useCallback(async () => {
    try {
      const data = await withSupabaseFallback(
        async () => {
          try {
            return await apiFetch('/api/storefront', { cache: 'no-store' })
          } catch (firstErr) {
            if (firstErr instanceof BackendUnavailableError) throw firstErr
            await new Promise((r) => setTimeout(r, 600))
            return apiFetch('/api/storefront', { cache: 'no-store' })
          }
        },
        () => sbGetStorefront(false),
      )
      if (Array.isArray(data.products)) {
        setProducts(data.products)
      }
      if (Array.isArray(data.categories) && data.categories.length) {
        setCategories(data.categories)
      }
      if (Array.isArray(data.testimonials) && data.testimonials.length) {
        setTestimonials(data.testimonials)
      }
      if (Array.isArray(data.faqs) && data.faqs.length) {
        setFaqs(data.faqs)
      }
      if (Array.isArray(data.marqueeStats) && data.marqueeStats.length) {
        setMarqueeStats(data.marqueeStats)
      }
      if (data.payments && typeof data.payments.razorpayEnabled === 'boolean') {
        setPayments({
          razorpayEnabled: data.payments.razorpayEnabled,
          razorpayMode: data.payments.razorpayMode || 'test',
          razorpayConfigured: Boolean(data.payments.razorpayConfigured),
        })
      }
      // On static hosts (Netlify / Firebase Hosting), probe /api/payments/razorpay/config
      if (detectedMode === 'supabase') {
        try {
          const cfgRes = await fetch(`${API_BASE}/api/payments/razorpay/config`, {
            cache: 'no-store',
          })
          const ct = (cfgRes.headers.get('content-type') || '').toLowerCase()
          if (cfgRes.ok && ct.includes('application/json')) {
            const cfg = await cfgRes.json()
            if (typeof cfg.razorpayEnabled === 'boolean') {
              setPayments({
                razorpayEnabled: cfg.razorpayEnabled,
                razorpayMode: cfg.razorpayMode || 'test',
                razorpayConfigured: Boolean(cfg.razorpayConfigured),
              })
            }
          } else {
            setPayments({
              razorpayEnabled: false,
              razorpayMode: 'test',
              razorpayConfigured: false,
            })
          }
        } catch {
          setPayments({
            razorpayEnabled: false,
            razorpayMode: 'test',
            razorpayConfigured: false,
          })
        }
      }
    } catch {
      try {
        const fallbackData = await sbGetStorefront(false)
        if (Array.isArray(fallbackData.products) && fallbackData.products.length) {
          setProducts(fallbackData.products)
        }
        if (Array.isArray(fallbackData.categories) && fallbackData.categories.length) {
          setCategories(fallbackData.categories)
        }
      } catch {
        /* keep already-loaded seed/cached storefront state */
      }
    }
  }, [])

  useEffect(() => {
    refreshStorefront()
    let lastRefreshAt = Date.now()
    const onResume = () => {
      if (document.visibilityState === 'hidden') return
      if (Date.now() - lastRefreshAt < 5000) return
      lastRefreshAt = Date.now()
      refreshStorefront()
    }
    window.addEventListener('focus', onResume)
    document.addEventListener('visibilitychange', onResume)
    return () => {
      window.removeEventListener('focus', onResume)
      document.removeEventListener('visibilitychange', onResume)
    }
  }, [refreshStorefront])

  const sendCartTelemetry = useCallback(
    (payload) => {
      const fullPayload = {
        sessionId,
        customerEmail: user?.email || null,
        customerName: user?.name || null,
        ...payload,
      }
      void withSupabaseFallback(
        () =>
          apiFetch('/api/events/cart', {
            method: 'POST',
            body: JSON.stringify(fullPayload),
          }),
        () => sbLogCartEvent(fullPayload),
      ).catch(() => {})
    },
    [sessionId, user],
  )

  const sendViewTelemetry = useCallback(
    (payload) => {
      const fullPayload = {
        sessionId,
        customerEmail: user?.email || null,
        ...payload,
      }
      void withSupabaseFallback(
        () =>
          apiFetch('/api/events/view', {
            method: 'POST',
            body: JSON.stringify(fullPayload),
          }),
        () => sbLogViewEvent(fullPayload),
      ).catch(() => {})
    },
    [sessionId, user],
  )

  const setQuickView = useCallback(
    (product) => {
      const prev = quickViewRef.current
      const nextProduct = product || null
      quickViewRef.current = nextProduct
      setQuickViewState(nextProduct)
      if (nextProduct) {
        cartOpenRef.current = false
        trackOpenRef.current = false
        setCartOpenState(false)
        setTrackOpenState(false)
        pushOverlayHistory('quickview', { quickViewId: nextProduct.id })
        sendViewTelemetry({
          viewType: 'quick_view',
          productId: nextProduct.id,
          productName: nextProduct.name,
          category: nextProduct.category,
        })
      } else if (prev) {
        popOverlayHistoryIfActive('quickview')
      }
    },
    [popOverlayHistoryIfActive, pushOverlayHistory, sendViewTelemetry],
  )

  /* Sync authenticated customer account & order history */
  const refreshAccount = useCallback(async () => {
    try {
      let data = await withSupabaseFallback(
        () => apiFetch('/api/auth/me'),
        () => sbGetAccount(),
      )
      if (!data?.user) {
        const sbData = await sbGetAccount().catch(() => ({ user: null, orders: [] }))
        if (sbData?.user) {
          data = sbData
        }
      }
      setUser(data.user ?? null)
      const list = Array.isArray(data.orders) ? data.orders : []
      setOrders(list)
      if (list[0]) setLastOrder((prev) => prev ?? list[0])
      return data
    } catch {
      setUser(null)
      return { user: null, orders: [] }
    } finally {
      setAuthReady(true)
    }
  }, [])

  useEffect(() => {
    const cbErr = consumeOAuthCallbackError()
    if (cbErr) {
      setAuthCallbackError(cbErr)
      navigateRoute('account', { replace: true })
    }

    const unsubFirebase = onAuthStateChanged(auth, () => {
      refreshAccount()
    })
    const sb = getBrowserSupabase()
    const {
      data: { subscription: sbSub },
    } = sb.auth.onAuthStateChange(async (event, session) => {
      if (session || detectedMode === 'supabase') {
        const data = await refreshAccount()
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            const returnRoute = sessionStorage.getItem('harban-oauth-return')
            if (returnRoute) {
              sessionStorage.removeItem('harban-oauth-return')
              const dest =
                returnRoute === 'admin' && data?.user?.role === 'admin'
                  ? 'admin'
                  : 'account'
              navigateRoute(dest, { replace: true })
              pushToast(`Welcome, ${data?.user?.name?.split(' ')[0] || 'Customer'}!`)
            } else if (hasOAuthCallbackParams()) {
              const target = routeRef.current || 'home'
              window.history.replaceState(
                { harban: true, route: target, overlay: null },
                '',
                routeToPath(target),
              )
            }
          } catch {
            /* ignore sessionStorage / history errors */
          }
        }
      }
    })
    return () => {
      unsubFirebase()
      sbSub.unsubscribe()
    }
  }, [navigateRoute, pushToast, refreshAccount])

  const loginWithGoogle = useCallback(async () => {
    try {
      setAuthCallbackError('')
      const mode = await probeBackendMode()
      if (mode === 'supabase') {
        try {
          sessionStorage.setItem('harban-oauth-return', route || 'account')
        } catch {
          /* ignore */
        }
        await sbLoginWithGoogle()
        return { ok: true }
      }
      await signInWithPopup(auth, googleAuthProvider)
      const data = await withSupabaseFallback(
        () => apiFetch('/api/auth/google', { method: 'POST' }),
        () => sbGetAccount(),
      )
      if (data?.sessionToken) writeSessionToken(data.sessionToken)
      setUser(data.user ?? null)
      setOrders(Array.isArray(data.orders) ? data.orders : [])
      pushToast(`Welcome, ${data.user?.name?.split(' ')[0] || 'Customer'}!`)
      return { ok: true }
    } catch (error) {
      const code = error?.code || ''
      if (code === 'auth/unauthorized-domain' && detectedMode === 'supabase') {
        try {
          try {
            sessionStorage.setItem('harban-oauth-return', route || 'account')
          } catch {
            /* ignore */
          }
          await sbLoginWithGoogle()
          return { ok: true }
        } catch (sbErr) {
          return {
            ok: false,
            error:
              sbErr instanceof Error
                ? sbErr.message
                : 'Google Sign-In failed.',
          }
        }
      }
      let msg =
        error instanceof Error
          ? error.message
          : 'Google sign-in was cancelled or failed.'
      if (code === 'auth/unauthorized-domain') {
        const host =
          typeof window !== 'undefined' ? window.location.hostname : ''
        msg = `Google Sign-In is not authorized on "${host}" yet. Add this domain in Firebase Console → Authentication → Settings → Authorized domains, or sign in with Email & Password above.`
      } else if (code === 'auth/popup-blocked') {
        msg = 'Google Sign-In popup was blocked by your browser. Please allow popups and try again.'
      } else if (code === 'auth/popup-closed-by-user') {
        msg = 'Google Sign-In popup was closed before completing sign-in.'
      }
      return {
        ok: false,
        error: msg,
      }
    }
  }, [pushToast, route])

  const registerWithEmail = useCallback(
    async ({ name, email, phone = '', password }) => {
      try {
        const data = await withSupabaseFallback(
          () =>
            apiFetch('/api/auth/register', {
              method: 'POST',
              body: JSON.stringify({ name, email, phone, password }),
            }),
          () => sbRegisterWithEmail({ name, email, phone, password }),
        )
        if (data?.verificationRequired) {
          pushToast('Confirmation link sent to your email!')
          return {
            ok: true,
            verificationRequired: true,
            message: data.message,
          }
        }
        if (data?.sessionToken) writeSessionToken(data.sessionToken)
        setUser(data.user ?? null)
        setOrders(Array.isArray(data.orders) ? data.orders : [])
        pushToast(`Welcome to HARBAN, ${data.user?.name?.split(' ')[0] || ''}!`)
        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error ? error.message : 'Unable to create account.',
        }
      }
    },
    [pushToast],
  )

  const loginWithEmail = useCallback(
    async ({ email, password }) => {
      try {
        const data = await withSupabaseFallback(
          () =>
            apiFetch('/api/auth/login', {
              method: 'POST',
              body: JSON.stringify({ email, password }),
            }),
          () => sbLoginWithEmail({ email, password }),
        )
        if (data?.sessionToken) writeSessionToken(data.sessionToken)
        setUser(data.user ?? null)
        setOrders(Array.isArray(data.orders) ? data.orders : [])
        pushToast(`Signed in as ${data.user?.name?.split(' ')[0] || ''}`)
        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Sign in failed.',
        }
      }
    },
    [pushToast],
  )

  const logout = useCallback(async () => {
    writeSessionToken('')
    try {
      if (auth.currentUser) await signOut(auth)
      await withSupabaseFallback(
        () => apiFetch('/api/auth/logout', { method: 'POST' }),
        () => sbLogout(),
      )
      await sbLogout().catch(() => {})
    } catch {
      /* best-effort logout */
    }
    setUser(null)
    setOrders([])
    pushToast('Signed out of your account')
  }, [pushToast])

  const updateProfile = useCallback(
    async ({ name, phone }) => {
      try {
        const data = await withSupabaseFallback(
          () =>
            apiFetch('/api/account/profile', {
              method: 'PATCH',
              body: JSON.stringify({ name, phone }),
            }),
          () => sbUpdateProfile({ name, phone }),
        )
        setUser(data.user)
        pushToast('Profile updated')
        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error ? error.message : 'Unable to update profile.',
        }
      }
    },
    [pushToast],
  )

  const changePassword = useCallback(
    async ({ currentPassword, newPassword }) => {
      try {
        await withSupabaseFallback(
          () =>
            apiFetch('/api/account/password', {
              method: 'POST',
              body: JSON.stringify({ currentPassword, newPassword }),
            }),
          () => sbChangePassword({ currentPassword, newPassword }),
        )
        pushToast('Password updated')
        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error ? error.message : 'Unable to change password.',
        }
      }
    },
    [pushToast],
  )

  const saveAddress = useCallback(
    async (addr, { silent = false } = {}) => {
      try {
        const data = await withSupabaseFallback(
          () =>
            apiFetch('/api/account/addresses', {
              method: 'POST',
              body: JSON.stringify(addr),
            }),
          () => sbSaveAddress(addr),
        )
        setUser(data.user)
        if (!silent) pushToast('Address saved')
        return { ok: true }
      } catch (error) {
        if (!silent) {
          pushToast(
            error instanceof Error ? error.message : 'Unable to save address.',
          )
        }
        return { ok: false }
      }
    },
    [pushToast],
  )

  const deleteAddress = useCallback(
    async (addrId) => {
      try {
        const data = await withSupabaseFallback(
          () =>
            apiFetch(`/api/account/addresses/${addrId}`, {
              method: 'DELETE',
            }),
          () => sbDeleteAddress(addrId),
        )
        setUser(data.user)
        pushToast('Address removed')
      } catch (error) {
        pushToast(
          error instanceof Error ? error.message : 'Unable to remove address.',
        )
      }
    },
    [pushToast],
  )

  const setDefaultAddress = useCallback(
    async (addrId) => {
      try {
        const data = await withSupabaseFallback(
          () =>
            apiFetch(`/api/account/addresses/${addrId}/default`, {
              method: 'PATCH',
            }),
          () => sbSetDefaultAddress(addrId),
        )
        setUser(data.user)
        pushToast('Default delivery address updated')
      } catch (error) {
        pushToast(
          error instanceof Error
            ? error.message
            : 'Unable to update default address.',
        )
      }
    },
    [pushToast],
  )

  const addToCart = useCallback(
    (product, qty = 1, eventType = 'add_to_cart', variant = null) => {
      const effectivePrice = variant ? Number(variant.price ?? product.price) : product.price
      const effectiveStock = variant
        ? typeof variant.stock === 'number'
          ? variant.stock
          : 50
        : typeof product.stock === 'number'
          ? product.stock
          : 50
      const variantLabel = variant
        ? variant.label || [variant.size, variant.color].filter(Boolean).join(' / ')
        : null

      if (effectiveStock <= 0) {
        pushToast(`${product.name} is currently out of stock`)
        return false
      }

      let nextTotal = 0
      let nextItems = []
      setCart((c) => {
        const found = c.find(
          (i) => i.id === product.id && (i.variantLabel || null) === (variantLabel || null),
        )
        if (found) {
          const updatedQty = Math.min(effectiveStock, found.qty + qty)
          nextItems = c.map((i) =>
            i.id === product.id && (i.variantLabel || null) === (variantLabel || null)
              ? { ...i, qty: updatedQty }
              : i,
          )
        } else {
          const initialQty = Math.min(effectiveStock, qty)
          nextItems = [
            ...c,
            {
              id: product.id,
              name: product.name,
              image: product.image,
              price: effectivePrice,
              sku: variant?.sku || product.sku || null,
              variantLabel,
              qty: initialQty,
            },
          ]
        }
        nextTotal = nextItems.reduce((s, i) => s + i.price * i.qty, 0)
        return nextItems
      })

      sendCartTelemetry({
        eventType,
        productId: product.id,
        productName: variantLabel ? `${product.name} (${variantLabel})` : product.name,
        unitPrice: effectivePrice,
        qty,
        cartTotal: nextTotal,
        cartItems: nextItems,
      })

      pushToast(`${product.name} added to cart`)
      return true
    },
    [pushToast, sendCartTelemetry],
  )

  const setQty = useCallback(
    (id, qty) => {
      const prod = products.find((p) => p.id === id)
      const cap = typeof prod?.stock === 'number' ? prod.stock : 99
      const clampedQty = qty <= 0 ? 0 : Math.min(cap, qty)

      setCart((c) => {
        const next =
          clampedQty <= 0
            ? c.filter((i) => i.id !== id)
            : c.map((i) => (i.id === id ? { ...i, qty: clampedQty } : i))
        const total = next.reduce((s, i) => s + i.price * i.qty, 0)
        sendCartTelemetry({
          eventType: clampedQty <= 0 ? 'remove_from_cart' : 'update_qty',
          productId: id,
          productName: prod?.name || id,
          unitPrice: prod?.price ?? null,
          qty: clampedQty,
          cartTotal: total,
          cartItems: next,
        })
        return next
      })
    },
    [products, sendCartTelemetry],
  )

  const removeFromCart = useCallback(
    (id) => {
      const prod = products.find((p) => p.id === id)
      setCart((c) => {
        const next = c.filter((i) => i.id !== id)
        const total = next.reduce((s, i) => s + i.price * i.qty, 0)
        sendCartTelemetry({
          eventType: 'remove_from_cart',
          productId: id,
          productName: prod?.name || id,
          qty: 0,
          cartTotal: total,
          cartItems: next,
        })
        return next
      })
    },
    [products, sendCartTelemetry],
  )

  const clearCart = useCallback(() => setCart([]), [])

  const buyNow = useCallback(
    (product, qty = 1, variant = null) => {
      const added = addToCart(product, qty, 'buy_now', variant)
      if (added) {
        navigateRoute('checkout')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
    [addToCart, navigateRoute],
  )

  const trackCheckoutStarted = useCallback(() => {
    const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
    sendCartTelemetry({
      eventType: 'checkout_started',
      qty: cart.reduce((s, i) => s + i.qty, 0),
      cartTotal,
      cartItems: cart,
    })
  }, [cart, sendCartTelemetry])

  const createRazorpayOrder = useCallback(async (amount, meta = {}) => {
    const res = await fetch(`${API_BASE}/api/payments/razorpay/create-order`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        customerEmail: meta.customerEmail || '',
        customerPhone: meta.customerPhone || '',
      }),
    })
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (!ct.includes('application/json')) {
      throw new Error(
        'Razorpay payment endpoint unavailable. Please redeploy or check server configuration.',
      )
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error || 'Unable to initialize Razorpay payment.')
    }
    return data
  }, [])

  const verifyRazorpayPayment = useCallback(async (payload) => {
    const res = await fetch(`${API_BASE}/api/payments/razorpay/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    })
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (!ct.includes('application/json')) {
      throw new Error('Unable to verify Razorpay payment signature.')
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.verified) {
      throw new Error(data?.error || 'Payment signature verification failed.')
    }
    return data
  }, [])

  const sendPhoneOtp = useCallback(async (phone) => {
    const init = await apiFetch('/api/otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    })
    if (init.delivery === 'sms') {
      return init
    }

    try {
      if (window.__harbanRecaptcha) {
        try {
          window.__harbanRecaptcha.clear()
        } catch {
          /* ignore prior verifier cleanup */
        }
        window.__harbanRecaptcha = null
      }

      let container = document.getElementById('harban-phone-recaptcha')
      if (!container) {
        container = document.createElement('div')
        container.id = 'harban-phone-recaptcha'
        container.style.display = 'none'
        document.body.appendChild(container)
      }
      container.innerHTML = ''

      phoneOtpAuth.useDeviceLanguage()
      const verifier = new RecaptchaVerifier(phoneOtpAuth, container, {
        size: 'invisible',
      })
      window.__harbanRecaptcha = verifier

      const confirmation = await signInWithPhoneNumber(
        phoneOtpAuth,
        init.e164Phone,
        verifier,
      )
      window.__harbanOtpConfirmation = confirmation

      return {
        ok: true,
        delivery: 'firebase_phone',
        phone: init.phone,
        maskedPhone: init.maskedPhone,
        challengeToken: 'firebase_phone',
      }
    } catch (err) {
      const code = err?.code || ''
      if (code === 'auth/operation-not-allowed') {
        throw new Error(
          'SMS OTP requires Phone Sign-In enabled in Firebase Console (Authentication > Sign-in method > Phone) or an SMS API key on the server.',
        )
      }
      if (code === 'auth/too-many-requests') {
        throw new Error('Too many OTP attempts. Please wait a few minutes and try again.')
      }
      if (code === 'auth/unauthorized-domain') {
        throw new Error(
          'Add this website domain to Firebase Console > Authentication > Settings > Authorized domains to send SMS OTP.',
        )
      }
      if (code === 'auth/invalid-phone-number') {
        throw new Error('Please enter a valid 10-digit Indian mobile number.')
      }
      throw new Error(
        err instanceof Error
          ? err.message
          : 'Unable to send SMS OTP. Please try again.',
      )
    }
  }, [])

  const verifyPhoneOtp = useCallback(async ({ phone, otp, challengeToken }) => {
    if (challengeToken === 'firebase_phone') {
      const confirmation = window.__harbanOtpConfirmation
      if (!confirmation) {
        throw new Error('OTP session expired. Please click Send OTP again.')
      }
      try {
        const cred = await confirmation.confirm(otp)
        const firebaseIdToken = await cred.user.getIdToken()
        await signOut(phoneOtpAuth).catch(() => {})
        window.__harbanOtpConfirmation = null
        return apiFetch('/api/otp/verify-firebase', {
          method: 'POST',
          body: JSON.stringify({ phone, firebaseIdToken }),
        })
      } catch (err) {
        const code = err?.code || ''
        if (code === 'auth/invalid-verification-code') {
          throw new Error('Incorrect OTP code. Check the SMS on your phone.')
        }
        if (code === 'auth/code-expired') {
          throw new Error('OTP expired. Please request a new SMS OTP.')
        }
        throw new Error(
          err instanceof Error ? err.message : 'OTP verification failed.',
        )
      }
    }

    return apiFetch('/api/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, challengeToken }),
    })
  }, [])

  const placeOrder = useCallback(
    async (details = {}) => {
      if (!cart.length) return null
      try {
        const payload = {
          name: details.name || user?.name || 'Customer',
          email: details.email || user?.email || '',
          phone: details.phone || user?.phone || '',
          otpToken: details.otpToken || '',
          address: details.address || null,
          paymentMethod: details.paymentMethod || 'Cash on Delivery',
          paymentStatus: details.paymentStatus || 'pending',
          razorpayOrderId: details.razorpayOrderId || null,
          razorpayPaymentId: details.razorpayPaymentId || null,
          items: cart.map((i) => ({
            id: i.id,
            qty: i.qty,
            variantLabel: i.variantLabel || null,
            sku: i.sku || null,
          })),
        }
        const data = await withSupabaseFallback(
          () =>
            apiFetch('/api/orders', {
              method: 'POST',
              body: JSON.stringify(payload),
            }),
          () => sbPlaceOrder(payload),
        )
        const created = data.order
        setLastOrder(created)
        setOrders((prev) => [created, ...prev])
        clearCart()
        navigateRoute('order-confirmed')
        void refreshStorefront()
        return created
      } catch (error) {
        pushToast(
          error instanceof Error
            ? error.message
            : 'Unable to place order. Please try again.',
        )
        return null
      }
    },
    [cart, clearCart, navigateRoute, pushToast, refreshStorefront, user],
  )

  const trackOrderByCode = useCallback(async (code) => {
    const clean = code.trim().toUpperCase()
    if (!clean) return null
    try {
      const data = await withSupabaseFallback(
        () => apiFetch(`/api/orders/track/${encodeURIComponent(clean)}`),
        () => sbTrackOrderByCode(clean),
      )
      return data.order ?? null
    } catch {
      return null
    }
  }, [])

  const cancelOrder = useCallback(
    async (orderId) => {
      try {
        const data = await withSupabaseFallback(
          () =>
            apiFetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
              method: 'POST',
            }),
          () => sbCancelOrder(orderId),
        )
        const updated = data.order
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? updated : o)),
        )
        pushToast('Order cancelled')
      } catch (error) {
        pushToast(
          error instanceof Error ? error.message : 'Unable to cancel order.',
        )
      }
    },
    [pushToast],
  )

  const reorder = useCallback(
    (order) => {
      if (!order?.items?.length) return
      order.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.id) ?? item
        addToCart(prod, item.qty)
      })
      navigateRoute('checkout')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [addToCart, navigateRoute, products],
  )

  const subscribeNewsletter = useCallback(async (email) => {
    try {
      await withSupabaseFallback(
        () =>
          apiFetch('/api/newsletter', {
            method: 'POST',
            body: JSON.stringify({ email }),
          }),
        () => sbSubscribeNewsletter(email),
      )
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Subscription failed.',
      }
    }
  }, [])

  const sendContactMessage = useCallback(async ({ name, email, message }) => {
    try {
      await withSupabaseFallback(
        () =>
          apiFetch('/api/contact', {
            method: 'POST',
            body: JSON.stringify({ name, email, message }),
          }),
        () => sbSendContactMessage({ name, email, message }),
      )
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : 'Unable to send message.',
      }
    }
  }, [])

  /* ---------------------------------------------- Admin Studio Operations */
  const loadAdminOverview = useCallback(async () => {
    return withSupabaseFallback(
      () => apiFetch('/api/admin/overview'),
      () => sbGetAdminOverview(),
    )
  }, [])

  const syncAdminSupabase = useCallback(async () => {
    return withSupabaseFallback(
      () => apiFetch('/api/admin/supabase/sync', { method: 'POST' }),
      async () => ({ ok: true, supabase: (await sbGetAdminOverview()).integrations.supabase }),
    )
  }, [])

  const saveAdminProduct = useCallback(
    async (payload) => {
      const data = await withSupabaseFallback(
        () =>
          apiFetch('/api/admin/products', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        () => sbSaveProduct(payload),
      )
      await refreshStorefront()
      pushToast(`Saved ${data.product?.name || 'product'}`)
      return data.product
    },
    [pushToast, refreshStorefront],
  )

  const updateAdminProductQuick = useCallback(
    async (productId, patch) => {
      const data = await withSupabaseFallback(
        () =>
          apiFetch(`/api/admin/products/${encodeURIComponent(productId)}/quick`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
          }),
        () => sbUpdateProductQuick(productId, patch),
      )
      await refreshStorefront()
      pushToast(`Updated ${data.product?.name || 'product'}`)
      return data.product
    },
    [pushToast, refreshStorefront],
  )

  const updateAdminStock = useCallback(
    async (productId, stock) => {
      const data = await withSupabaseFallback(
        () =>
          apiFetch(`/api/admin/products/${encodeURIComponent(productId)}/stock`, {
            method: 'PATCH',
            body: JSON.stringify({ stock }),
          }),
        () => sbUpdateStock(productId, stock),
      )
      await refreshStorefront()
      pushToast(`Stock updated (${data.product?.stock ?? stock})`)
      return data.product
    },
    [pushToast, refreshStorefront],
  )

  const deleteAdminProduct = useCallback(
    async (productId) => {
      await withSupabaseFallback(
        () =>
          apiFetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
            method: 'DELETE',
          }),
        () => sbDeleteProduct(productId),
      )
      await refreshStorefront()
      pushToast('Product removed')
    },
    [pushToast, refreshStorefront],
  )

  const saveAdminCategory = useCallback(
    async (payload) => {
      const data = await withSupabaseFallback(
        () =>
          apiFetch('/api/admin/categories', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        () => sbSaveCategory(payload),
      )
      await refreshStorefront()
      pushToast(`Saved category ${data.category?.label || ''}`)
      return data.category
    },
    [pushToast, refreshStorefront],
  )

  const deleteAdminCategory = useCallback(
    async (categoryId) => {
      await withSupabaseFallback(
        () =>
          apiFetch(`/api/admin/categories/${encodeURIComponent(categoryId)}`, {
            method: 'DELETE',
          }),
        () => sbDeleteCategory(categoryId),
      )
      await refreshStorefront()
      pushToast('Category removed')
    },
    [pushToast, refreshStorefront],
  )

  const createAdminOrder = useCallback(
    async (payload) => {
      const data = await withSupabaseFallback(
        () =>
          apiFetch('/api/admin/orders', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        () => sbCreateAdminOrder(payload),
      )
      await refreshStorefront()
      pushToast(`Order #${data.order?.id || ''} created`)
      return data.order
    },
    [pushToast, refreshStorefront],
  )

  const updateAdminOrder = useCallback(
    async (orderCode, patch) => {
      const data = await withSupabaseFallback(
        () =>
          apiFetch(`/api/admin/orders/${encodeURIComponent(orderCode)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
          }),
        () => sbUpdateAdminOrder(orderCode, patch),
      )
      pushToast(`Order ${orderCode} updated`)
      return data.order
    },
    [pushToast],
  )

  const uploadAdminImage = useCallback(async ({ filename, mimeType, dataBase64 }) => {
    const data = await withSupabaseFallback(
      () =>
        apiFetch('/api/admin/upload', {
          method: 'POST',
          body: JSON.stringify({ filename, mimeType, dataBase64 }),
        }),
      () => sbUploadImage({ filename, mimeType, dataBase64 }),
    )
    return data.url
  }, [])

  const saveAdminDiscount = useCallback(
    async (payload) => {
      const data = await withSupabaseFallback(
        () =>
          apiFetch('/api/admin/discounts', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        () => sbSaveDiscount(payload),
      )
      pushToast(`Discount ${data.discount.code} saved`)
      return data.discount
    },
    [pushToast],
  )

  const deleteAdminDiscount = useCallback(
    async (id) => {
      await withSupabaseFallback(
        () =>
          apiFetch(`/api/admin/discounts/${encodeURIComponent(id)}`, {
            method: 'DELETE',
          }),
        () => sbDeleteDiscount(id),
      )
      pushToast('Discount deleted')
    },
    [pushToast],
  )

  const createAdminCustomer = useCallback(
    async (payload) => {
      const data = await withSupabaseFallback(
        () =>
          apiFetch('/api/admin/customers', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        () => sbCreateCustomer(payload),
      )
      pushToast(`Added customer ${data.customer?.name || ''}`)
      return data.customer
    },
    [pushToast],
  )

  const go = useCallback(
    (next) => {
      navigateRoute(next)
      if (next !== 'all') setSearch('')
      if (next?.startsWith('product:')) {
        const pid = next.slice('product:'.length)
        const matched = products.find((p) => p.id === pid)
        sendViewTelemetry({
          viewType: 'product_page',
          productId: pid,
          productName: matched?.name || pid,
          category: matched?.category || null,
        })
      } else if (['beard', 'body', 'nose', 'accessories', 'trimmers'].includes(next)) {
        sendViewTelemetry({
          viewType: 'category_click',
          category: next,
        })
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [navigateRoute, products, sendViewTelemetry],
  )

  const value = useMemo(() => {
    const cartCount = cart.reduce((s, i) => s + i.qty, 0)
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
    return {
      products,
      categories,
      testimonials,
      faqs,
      marqueeStats,
      payments,
      cart,
      cartCount,
      subtotal,
      shipping: 0,
      total: subtotal,
      addToCart,
      setQty,
      removeFromCart,
      clearCart,
      buyNow,
      trackCheckoutStarted,
      createRazorpayOrder,
      verifyRazorpayPayment,
      sendPhoneOtp,
      verifyPhoneOtp,
      placeOrder,
      trackOrderByCode,
      cancelOrder,
      reorder,
      orders,
      userOrders: orders,
      lastOrder,
      user,
      authReady,
      authCallbackError,
      setAuthCallbackError,
      loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      logout,
      updateProfile,
      changePassword,
      saveAddress,
      deleteAddress,
      setDefaultAddress,
      subscribeNewsletter,
      sendContactMessage,
      refreshStorefront,
      loadAdminOverview,
      syncAdminSupabase,
      saveAdminProduct,
      updateAdminProductQuick,
      updateAdminStock,
      deleteAdminProduct,
      saveAdminCategory,
      deleteAdminCategory,
      saveAdminDiscount,
      deleteAdminDiscount,
      createAdminCustomer,
      createAdminOrder,
      updateAdminOrder,
      uploadAdminImage,
      cartOpen,
      setCartOpen,
      trackOpen,
      setTrackOpen,
      search,
      setSearch,
      quickView,
      setQuickView,
      toasts,
      pushToast,
      route,
      go,
    }
  }, [
    products,
    categories,
    testimonials,
    faqs,
    marqueeStats,
    payments,
    cart,
    orders,
    lastOrder,
    user,
    authReady,
    authCallbackError,
    addToCart,
    setQty,
    removeFromCart,
    clearCart,
    buyNow,
    trackCheckoutStarted,
    createRazorpayOrder,
    verifyRazorpayPayment,
    sendPhoneOtp,
    verifyPhoneOtp,
    placeOrder,
    trackOrderByCode,
    cancelOrder,
    reorder,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout,
    updateProfile,
    changePassword,
    saveAddress,
    deleteAddress,
    setDefaultAddress,
    subscribeNewsletter,
    sendContactMessage,
    refreshStorefront,
    loadAdminOverview,
    syncAdminSupabase,
    saveAdminProduct,
    updateAdminProductQuick,
    updateAdminStock,
    deleteAdminProduct,
    saveAdminCategory,
    deleteAdminCategory,
    saveAdminDiscount,
    deleteAdminDiscount,
    createAdminCustomer,
    createAdminOrder,
    updateAdminOrder,
    uploadAdminImage,
    cartOpen,
    setCartOpen,
    trackOpen,
    setTrackOpen,
    search,
    quickView,
    setQuickView,
    toasts,
    pushToast,
    route,
    go,
  ])

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShop() {
  const ctx = useContext(ShopContext)
  if (!ctx) throw new Error('useShop must be used inside ShopProvider')
  return ctx
}
