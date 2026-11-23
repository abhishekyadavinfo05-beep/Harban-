function parseEnvBool(val, fallback = true) {
  if (val === undefined || val === '') return fallback
  const normalized = String(val).trim().replace(/^['"]|['"]$/g, '').toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function cleanEnvStr(val) {
  return String(val || '').trim().replace(/^['"]|['"]$/g, '')
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  }
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const enabled = parseEnvBool(process.env.RAZORPAY_ENABLED, true)
  if (!enabled) {
    return json(503, {
      enabled: false,
      error: 'Razorpay online payments are currently disabled.',
    })
  }

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
  const requestedMode = cleanEnvStr(process.env.RAZORPAY_MODE).toLowerCase()
  const mode =
    (requestedMode === 'live' || (!requestedMode && keyId.startsWith('rzp_live_'))) &&
    keyId.startsWith('rzp_live_')
      ? 'live'
      : 'test'

  try {
    const body = event.body ? JSON.parse(event.body) : {}
    const amount = Math.max(100, Math.round((Number(body.amount) || 0) * 100))
    const receipt = `rcpt_${Date.now()}`

    if (hasCredentials) {
      const authBasic = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
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
            ...(body.customerEmail ? { email: String(body.customerEmail) } : {}),
            ...(body.customerPhone ? { phone: String(body.customerPhone) } : {}),
          },
        }),
      })
      const rzpData = await rzpRes.json().catch(() => ({}))
      if (!rzpRes.ok) {
        return json(400, {
          error:
            rzpData?.error?.description ||
            'Razorpay order creation failed. Check Razorpay credentials.',
        })
      }

      return json(200, {
        enabled: true,
        mode,
        hasCredentials: true,
        keyId,
        orderId: rzpData.id,
        amount: rzpData.amount,
        currency: rzpData.currency || 'INR',
      })
    }

    return json(200, {
      enabled: true,
      mode: 'test',
      hasCredentials: false,
      orderId: `order_test_${Date.now()}`,
      amount,
      currency: 'INR',
    })
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : 'Payment init failed.',
    })
  }
}
