export interface CourierPartnerConfig {
  connected: boolean
  apiKey: string
}

export interface ExtendedStoreSettings {
  id: string
  storeName: string
  supportEmail: string
  supportPhone: string
  lowStockThreshold: number
  freeShippingThreshold: number
  razorpayTestMode: boolean
  courierProvider: string
  courierApiEndpoint: string
  courierAutoDispatch: boolean
  general: {
    storeUrl: string
    currency: 'INR' | 'USD'
    timezone: string
    language: 'English' | 'Hindi'
    storeStatus: boolean
  }
  storeInfo: {
    addressLine1: string
    city: string
    state: string
    pincode: string
    country: string
    gstin: string
  }
  payments: {
    razorpayEnabled: boolean
    upiEnabled: boolean
    cardsEnabled: boolean
    netbankingEnabled: boolean
    codEnabled: boolean
  }
  shipping: {
    freeShippingMin: number
    standardCharge: number
    couriers: Record<string, CourierPartnerConfig>
  }
  notifications: {
    orderEmail: boolean
    smsAlerts: boolean
    whatsappUpdates: boolean
    adminAlertEmail: string
  }
  appearance: {
    primaryColor: string
    accentColor: string
  }
  seo: {
    metaTitle: string
    metaDesc: string
    gaMeasurementId: string
    metaPixelId: string
  }
  marketing: {
    googleAdsConnected: boolean
    googleAdsId: string
    metaAdsConnected: boolean
    metaPageId: string
    whatsappConnected: boolean
    whatsappNumber: string
  }
}

export const DEFAULT_COURIER_NAMES = [
  'Delhivery',
  'Blue Dart',
  'DTDC',
  'Ekart Logistics',
] as const

export const DEFAULT_STORE_SETTINGS: ExtendedStoreSettings = {
  id: 'default',
  storeName: 'HARBAN',
  supportEmail: 'harban.official@gmail.com',
  supportPhone: '+91 95551 37346',
  lowStockThreshold: 5,
  freeShippingThreshold: 1500,
  razorpayTestMode: false,
  courierProvider: 'Manual / Configurable',
  courierApiEndpoint: '',
  courierAutoDispatch: false,
  general: {
    storeUrl: 'https://harban.web.app',
    currency: 'INR',
    timezone: '(GMT+05:30) India Standard Time — Mumbai',
    language: 'English',
    storeStatus: true,
  },
  storeInfo: {
    addressLine1: 'A-101, Goregaon West',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400104',
    country: 'India',
    gstin: '',
  },
  payments: {
    razorpayEnabled: true,
    upiEnabled: true,
    cardsEnabled: true,
    netbankingEnabled: true,
    codEnabled: true,
  },
  shipping: {
    freeShippingMin: 1500,
    standardCharge: 0,
    couriers: {
      Delhivery: { connected: false, apiKey: '' },
      'Blue Dart': { connected: false, apiKey: '' },
      DTDC: { connected: false, apiKey: '' },
      'Ekart Logistics': { connected: false, apiKey: '' },
    },
  },
  notifications: {
    orderEmail: true,
    smsAlerts: true,
    whatsappUpdates: true,
    adminAlertEmail: 'harban.official@gmail.com',
  },
  appearance: {
    primaryColor: '#0C1B2E',
    accentColor: '#1D5CAD',
  },
  seo: {
    metaTitle: 'HARBAN — Groom Better. Everyday. | Precision Trimmers',
    metaDesc:
      'HARBAN — precision trimmers and grooming essentials for modern men. Free shipping, 1-year warranty, easy returns.',
    gaMeasurementId: '',
    metaPixelId: '',
  },
  marketing: {
    googleAdsConnected: false,
    googleAdsId: '',
    metaAdsConnected: false,
    metaPageId: '',
    whatsappConnected: false,
    whatsappNumber: '+91 95551 37346',
  },
}

function parsePackedConfig(rawEndpoint: unknown): Record<string, any> | null {
  if (typeof rawEndpoint !== 'string') return null
  const trimmed = rawEndpoint.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && parsed.__harbanConfig === 1) {
      return parsed
    }
  } catch {
    /* ignore malformed JSON */
  }
  return null
}

function normalizeCouriers(raw: any): Record<string, CourierPartnerConfig> {
  const out: Record<string, CourierPartnerConfig> = {}
  for (const name of DEFAULT_COURIER_NAMES) {
    const src = raw?.[name]
    if (typeof src === 'boolean') {
      out[name] = { connected: src, apiKey: '' }
    } else if (src && typeof src === 'object') {
      out[name] = {
        connected: Boolean(src.connected),
        apiKey: String(src.apiKey || ''),
      }
    } else {
      out[name] = { connected: false, apiKey: '' }
    }
  }
  return out
}

export function unpackStoreSettings(row: any): ExtendedStoreSettings {
  const src = row && typeof row === 'object' ? row : {}
  const rawEndpoint =
    src.courierApiEndpoint ?? src.courier_api_endpoint ?? ''
  const packed = parsePackedConfig(rawEndpoint)

  const freeMin = Math.max(
    0,
    Number(
      src.freeShippingThreshold ??
        src.free_shipping_threshold ??
        packed?.shipping?.freeShippingMin ??
        DEFAULT_STORE_SETTINGS.freeShippingThreshold,
    ) || 0,
  )

  const courierEndpoint = packed
    ? String(packed.endpoint || '')
    : String(rawEndpoint || '')

  const courierProvider = String(
    src.courierProvider ??
      src.courier_provider ??
      DEFAULT_STORE_SETTINGS.courierProvider,
  )

  const normalizeLegacyEmail = (val: unknown, fallback: string) => {
    const str = String(val || '').trim()
    if (!str || str.toLowerCase() === 'care@harban.in') return fallback
    return str
  }

  const normalizeLegacyPhone = (val: unknown, fallback: string) => {
    const str = String(val || '').trim()
    if (
      !str ||
      str === '+91 98765 43210' ||
      str === '+91 9876543210' ||
      str === '9876543210'
    ) {
      return fallback
    }
    return str
  }

  const resolvedSupportEmail = normalizeLegacyEmail(
    src.supportEmail ?? src.support_email,
    DEFAULT_STORE_SETTINGS.supportEmail,
  )
  const resolvedSupportPhone = normalizeLegacyPhone(
    src.supportPhone ?? src.support_phone,
    DEFAULT_STORE_SETTINGS.supportPhone,
  )

  return {
    id: String(src.id || 'default'),
    storeName: String(
      src.storeName ?? src.store_name ?? DEFAULT_STORE_SETTINGS.storeName,
    ),
    supportEmail: resolvedSupportEmail,
    supportPhone: resolvedSupportPhone,
    lowStockThreshold: Math.max(
      0,
      Number(
        src.lowStockThreshold ??
          src.low_stock_threshold ??
          DEFAULT_STORE_SETTINGS.lowStockThreshold,
      ) || 5,
    ),
    freeShippingThreshold: freeMin,
    razorpayTestMode: Boolean(
      src.razorpayTestMode ?? src.razorpay_test_mode ?? false,
    ),
    courierProvider,
    courierApiEndpoint: courierEndpoint,
    courierAutoDispatch: Boolean(
      src.courierAutoDispatch ?? src.courier_auto_dispatch ?? false,
    ),
    general: {
      storeUrl: String(
        src.general?.storeUrl ??
          packed?.general?.storeUrl ??
          DEFAULT_STORE_SETTINGS.general.storeUrl,
      ),
      currency:
        (src.general?.currency ?? packed?.general?.currency) === 'USD'
          ? 'USD'
          : 'INR',
      timezone: String(
        src.general?.timezone ??
          packed?.general?.timezone ??
          DEFAULT_STORE_SETTINGS.general.timezone,
      ),
      language:
        (src.general?.language ?? packed?.general?.language) === 'Hindi'
          ? 'Hindi'
          : 'English',
      storeStatus:
        (src.general?.storeStatus ?? packed?.general?.storeStatus) !== false,
    },
    storeInfo: {
      addressLine1: String(
        src.storeInfo?.addressLine1 ??
          packed?.storeInfo?.addressLine1 ??
          DEFAULT_STORE_SETTINGS.storeInfo.addressLine1,
      ),
      city: String(
        src.storeInfo?.city ??
          packed?.storeInfo?.city ??
          DEFAULT_STORE_SETTINGS.storeInfo.city,
      ),
      state: String(
        src.storeInfo?.state ??
          packed?.storeInfo?.state ??
          DEFAULT_STORE_SETTINGS.storeInfo.state,
      ),
      pincode: String(
        src.storeInfo?.pincode ??
          packed?.storeInfo?.pincode ??
          DEFAULT_STORE_SETTINGS.storeInfo.pincode,
      ),
      country: String(
        src.storeInfo?.country ??
          packed?.storeInfo?.country ??
          DEFAULT_STORE_SETTINGS.storeInfo.country,
      ),
      gstin: String(
        src.storeInfo?.gstin ?? packed?.storeInfo?.gstin ?? '',
      ),
    },
    payments: {
      razorpayEnabled:
        (src.payments?.razorpayEnabled ??
          packed?.payments?.razorpayEnabled) !== false,
      upiEnabled:
        (src.payments?.upiEnabled ?? packed?.payments?.upiEnabled) !== false,
      cardsEnabled:
        (src.payments?.cardsEnabled ?? packed?.payments?.cardsEnabled) !== false,
      netbankingEnabled:
        (src.payments?.netbankingEnabled ??
          packed?.payments?.netbankingEnabled) !== false,
      codEnabled:
        (src.payments?.codEnabled ?? packed?.payments?.codEnabled) !== false,
    },
    shipping: {
      freeShippingMin: freeMin,
      standardCharge: Math.max(
        0,
        Number(
          src.shipping?.standardCharge ??
            packed?.shipping?.standardCharge ??
            DEFAULT_STORE_SETTINGS.shipping.standardCharge,
        ) || 0,
      ),
      couriers: normalizeCouriers(
        src.shipping?.couriers ?? packed?.shipping?.couriers,
      ),
    },
    notifications: {
      orderEmail:
        (src.notifications?.orderEmail ?? packed?.notifications?.orderEmail) !==
        false,
      smsAlerts:
        (src.notifications?.smsAlerts ?? packed?.notifications?.smsAlerts) !==
        false,
      whatsappUpdates:
        (src.notifications?.whatsappUpdates ??
          packed?.notifications?.whatsappUpdates) !== false,
      adminAlertEmail: normalizeLegacyEmail(
        src.notifications?.adminAlertEmail ??
          packed?.notifications?.adminAlertEmail ??
          resolvedSupportEmail,
        DEFAULT_STORE_SETTINGS.notifications.adminAlertEmail,
      ),
    },
    appearance: {
      primaryColor: String(
        src.appearance?.primaryColor ??
          packed?.appearance?.primaryColor ??
          DEFAULT_STORE_SETTINGS.appearance.primaryColor,
      ),
      accentColor: String(
        src.appearance?.accentColor ??
          packed?.appearance?.accentColor ??
          DEFAULT_STORE_SETTINGS.appearance.accentColor,
      ),
    },
    seo: {
      metaTitle: String(
        src.seo?.metaTitle ??
          packed?.seo?.metaTitle ??
          DEFAULT_STORE_SETTINGS.seo.metaTitle,
      ),
      metaDesc: String(
        src.seo?.metaDesc ??
          packed?.seo?.metaDesc ??
          DEFAULT_STORE_SETTINGS.seo.metaDesc,
      ),
      gaMeasurementId: String(
        src.seo?.gaMeasurementId ?? packed?.seo?.gaMeasurementId ?? '',
      ),
      metaPixelId: String(
        src.seo?.metaPixelId ?? packed?.seo?.metaPixelId ?? '',
      ),
    },
    marketing: {
      googleAdsConnected: Boolean(
        src.marketing?.googleAdsConnected ??
          packed?.marketing?.googleAdsConnected,
      ),
      googleAdsId: String(
        src.marketing?.googleAdsId ?? packed?.marketing?.googleAdsId ?? '',
      ),
      metaAdsConnected: Boolean(
        src.marketing?.metaAdsConnected ?? packed?.marketing?.metaAdsConnected,
      ),
      metaPageId: String(
        src.marketing?.metaPageId ?? packed?.marketing?.metaPageId ?? '',
      ),
      whatsappConnected: Boolean(
        src.marketing?.whatsappConnected ??
          packed?.marketing?.whatsappConnected,
      ),
      whatsappNumber: normalizeLegacyPhone(
        src.marketing?.whatsappNumber ?? packed?.marketing?.whatsappNumber,
        DEFAULT_STORE_SETTINGS.marketing.whatsappNumber,
      ),
    },
  }
}

export function packStoreSettings(
  input: Partial<ExtendedStoreSettings>,
  existingRow?: any,
) {
  const base = unpackStoreSettings(existingRow)
  const merged: ExtendedStoreSettings = {
    ...base,
    storeName:
      input.storeName !== undefined
        ? String(input.storeName).trim() || base.storeName
        : base.storeName,
    supportEmail:
      input.supportEmail !== undefined
        ? String(input.supportEmail).trim() || base.supportEmail
        : base.supportEmail,
    supportPhone:
      input.supportPhone !== undefined
        ? String(input.supportPhone).trim()
        : base.supportPhone,
    lowStockThreshold:
      input.lowStockThreshold !== undefined
        ? Math.max(0, Math.round(Number(input.lowStockThreshold) || 0))
        : base.lowStockThreshold,
    freeShippingThreshold:
      input.freeShippingThreshold !== undefined
        ? Math.max(0, Math.round(Number(input.freeShippingThreshold) || 0))
        : input.shipping?.freeShippingMin !== undefined
          ? Math.max(0, Math.round(Number(input.shipping.freeShippingMin) || 0))
          : base.freeShippingThreshold,
    razorpayTestMode:
      input.razorpayTestMode !== undefined
        ? Boolean(input.razorpayTestMode)
        : base.razorpayTestMode,
    courierProvider:
      input.courierProvider !== undefined
        ? String(input.courierProvider).trim() || base.courierProvider
        : base.courierProvider,
    courierApiEndpoint:
      input.courierApiEndpoint !== undefined
        ? String(input.courierApiEndpoint).trim()
        : base.courierApiEndpoint,
    courierAutoDispatch:
      input.courierAutoDispatch !== undefined
        ? Boolean(input.courierAutoDispatch)
        : base.courierAutoDispatch,
    general: { ...base.general, ...(input.general || {}) },
    storeInfo: { ...base.storeInfo, ...(input.storeInfo || {}) },
    payments: { ...base.payments, ...(input.payments || {}) },
    shipping: {
      freeShippingMin:
        input.shipping?.freeShippingMin !== undefined
          ? Math.max(0, Math.round(Number(input.shipping.freeShippingMin) || 0))
          : input.freeShippingThreshold !== undefined
            ? Math.max(0, Math.round(Number(input.freeShippingThreshold) || 0))
            : base.shipping.freeShippingMin,
      standardCharge:
        input.shipping?.standardCharge !== undefined
          ? Math.max(0, Math.round(Number(input.shipping.standardCharge) || 0))
          : base.shipping.standardCharge,
      couriers: normalizeCouriers({
        ...base.shipping.couriers,
        ...(input.shipping?.couriers || {}),
      }),
    },
    notifications: { ...base.notifications, ...(input.notifications || {}) },
    appearance: { ...base.appearance, ...(input.appearance || {}) },
    seo: { ...base.seo, ...(input.seo || {}) },
    marketing: { ...base.marketing, ...(input.marketing || {}) },
  }

  const packedEndpoint = JSON.stringify({
    __harbanConfig: 1,
    endpoint: merged.courierApiEndpoint,
    general: merged.general,
    storeInfo: merged.storeInfo,
    payments: merged.payments,
    shipping: merged.shipping,
    notifications: merged.notifications,
    appearance: merged.appearance,
    seo: merged.seo,
    marketing: merged.marketing,
  })

  return {
    merged,
    dbValues: {
      id: 'default',
      storeName: merged.storeName,
      supportEmail: merged.supportEmail,
      supportPhone: merged.supportPhone,
      lowStockThreshold: merged.lowStockThreshold,
      freeShippingThreshold: merged.freeShippingThreshold,
      razorpayTestMode: merged.razorpayTestMode,
      courierProvider: merged.courierProvider,
      courierApiEndpoint: packedEndpoint,
      courierAutoDispatch: merged.courierAutoDispatch,
      updatedAt: new Date(),
    },
    supabaseRow: {
      id: 'default',
      store_name: merged.storeName,
      support_email: merged.supportEmail,
      support_phone: merged.supportPhone,
      low_stock_threshold: merged.lowStockThreshold,
      free_shipping_threshold: merged.freeShippingThreshold,
      razorpay_test_mode: merged.razorpayTestMode,
      courier_provider: merged.courierProvider,
      courier_api_endpoint: packedEndpoint,
      courier_auto_dispatch: merged.courierAutoDispatch,
      updated_at: new Date().toISOString(),
    },
  }
}
