import crypto from 'node:crypto'

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
    return json(405, { verified: false, error: 'Method not allowed' })
  }

  const enabled = parseEnvBool(process.env.RAZORPAY_ENABLED, true)
  if (!enabled) {
    return json(503, {
      verified: false,
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
    const razorpay_order_id = String(body.razorpay_order_id || '').trim()
    const razorpay_payment_id = String(body.razorpay_payment_id || '').trim()
    const razorpay_signature = String(body.razorpay_signature || '').trim()

    if (!hasCredentials) {
      return json(200, { verified: true, mode: 'test' })
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json(400, {
        verified: false,
        error: 'Missing Razorpay payment signature fields.',
      })
    }

    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    const expectedBuf = Buffer.from(expected, 'utf8')
    const providedBuf = Buffer.from(razorpay_signature, 'utf8')
    const valid =
      expectedBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, providedBuf)

    if (!valid) {
      return json(400, {
        verified: false,
        error: 'Invalid Razorpay payment signature.',
      })
    }

    return json(200, { verified: true, mode })
  } catch (error) {
    return json(500, {
      verified: false,
      error: error instanceof Error ? error.message : 'Verification failed.',
    })
  }
}
