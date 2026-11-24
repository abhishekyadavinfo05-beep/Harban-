// Supabase Edge Function: razorpay
// Deploy as function name: "razorpay"
// Required Secrets in Supabase Dashboard -> Edge Functions -> Secrets:
//   RAZORPAY_KEY_ID=rzp_test_... (or rzp_live_...)
//   RAZORPAY_KEY_SECRET=...
//   RAZORPAY_MODE=test (or live)
//   RAZORPAY_ENABLED=true

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function cleanEnv(name: string): string {
  return (Deno.env.get(name) || '').trim().replace(/^['"]|['"]$/g, '')
}

function parseEnvBool(name: string, fallback = true): boolean {
  const raw = cleanEnv(name).toLowerCase()
  if (!raw) return fallback
  if (['true', '1', 'yes', 'on'].includes(raw)) return true
  if (['false', '0', 'no', 'off'].includes(raw)) return false
  return fallback
}

function getConfig() {
  const keyId = cleanEnv('RAZORPAY_KEY_ID') || cleanEnv('RAZORPAY_TEST_KEY_ID')
  const keySecret =
    cleanEnv('RAZORPAY_KEY_SECRET') || cleanEnv('RAZORPAY_TEST_KEY_SECRET')
  const hasCredentials =
    Boolean(keyId) &&
    Boolean(keySecret) &&
    !keyId.startsWith('MY_') &&
    !keySecret.startsWith('MY_')
  const enabled = parseEnvBool('RAZORPAY_ENABLED', true)
  const requestedMode = cleanEnv('RAZORPAY_MODE').toLowerCase()
  const mode =
    (requestedMode === 'live' ||
      (!requestedMode && keyId.startsWith('rzp_live_'))) &&
    keyId.startsWith('rzp_live_')
      ? 'live'
      : 'test'

  return { enabled, mode, hasCredentials, keyId, keySecret }
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const cfg = getConfig()

  if (req.method === 'GET') {
    return jsonResponse({
      razorpayEnabled: cfg.enabled,
      razorpayMode: cfg.mode,
      razorpayConfigured: cfg.hasCredentials,
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'config').toLowerCase()

    if (action === 'config') {
      return jsonResponse({
        razorpayEnabled: cfg.enabled,
        razorpayMode: cfg.mode,
        razorpayConfigured: cfg.hasCredentials,
      })
    }

    if (!cfg.enabled) {
      return jsonResponse(
        {
          enabled: false,
          verified: false,
          error: 'Razorpay online payments are currently disabled.',
        },
        503,
      )
    }

    if (action === 'create-order') {
      const amount = Math.max(100, Math.round((Number(body.amount) || 0) * 100))
      const receipt = `rcpt_${Date.now()}`

      if (cfg.hasCredentials) {
        const authBasic = btoa(`${cfg.keyId}:${cfg.keySecret}`)
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
            notes: {
              store: 'HARBAN',
              ...(body.customerEmail
                ? { email: String(body.customerEmail) }
                : {}),
              ...(body.customerPhone
                ? { phone: String(body.customerPhone) }
                : {}),
            },
          }),
        })
        const rzpData = await rzpRes.json().catch(() => ({}))
        if (!rzpRes.ok) {
          return jsonResponse(
            {
              error:
                rzpData?.error?.description ||
                'Razorpay order creation failed. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
            },
            400,
          )
        }

        return jsonResponse({
          enabled: true,
          mode: cfg.mode,
          hasCredentials: true,
          keyId: cfg.keyId,
          orderId: rzpData.id,
          amount: rzpData.amount,
          currency: rzpData.currency || 'INR',
        })
      }

      return jsonResponse({
        enabled: true,
        mode: 'test',
        hasCredentials: false,
        orderId: `order_test_${Date.now()}`,
        amount,
        currency: 'INR',
      })
    }

    if (action === 'verify') {
      const orderId = String(body.razorpay_order_id || '').trim()
      const paymentId = String(body.razorpay_payment_id || '').trim()
      const signature = String(body.razorpay_signature || '').trim()

      if (!cfg.hasCredentials) {
        return jsonResponse({ verified: true, mode: 'test' })
      }
      if (!orderId || !paymentId || !signature) {
        return jsonResponse(
          { verified: false, error: 'Missing Razorpay signature fields.' },
          400,
        )
      }

      const expected = await hmacSha256Hex(
        cfg.keySecret,
        `${orderId}|${paymentId}`,
      )
      if (!timingSafeEqualStr(expected, signature)) {
        return jsonResponse(
          { verified: false, error: 'Invalid Razorpay payment signature.' },
          400,
        )
      }

      return jsonResponse({ verified: true, mode: cfg.mode })
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400)
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Razorpay function error.',
      },
      500,
    )
  }
})
