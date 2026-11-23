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

export async function handler() {
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
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify({
      razorpayEnabled: enabled,
      razorpayMode: mode,
      razorpayConfigured: hasCredentials,
    }),
  }
}
