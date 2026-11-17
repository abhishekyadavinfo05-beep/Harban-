import crypto from 'crypto'
import type { NextFunction, Request, Response } from 'express'
import { adminAuth } from '../lib/firebase-admin.ts'
import { getOrCreateUser } from '../db/users.ts'

export interface AuthSessionUser {
  uid: string
  email: string
  name?: string
}

export interface AuthRequest extends Request {
  authUser?: AuthSessionUser
}

const SESSION_COOKIE = 'harban_sid'

function getSigningSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.SQL_PASSWORD ||
    'harban-dev-session-key-change-in-prod'
  )
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHex] = storedHash.split(':')
  if (!salt || !expectedHex) return false
  const derived = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(expectedHex, 'hex')
  if (derived.length !== expected.length) return false
  return crypto.timingSafeEqual(derived, expected)
}

export function signSessionToken(payload: AuthSessionUser): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + 30 * 24 * 3600 * 1000 }),
  ).toString('base64url')
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(body)
    .digest('base64url')
  return `${body}.${sig}`
}

function verifySessionToken(token: string): AuthSessionUser | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = crypto
    .createHmac('sha256', getSigningSecret())
    .update(body)
    .digest('base64url')
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!parsed?.uid || !parsed?.email || Date.now() > parsed.exp) return null
    return {
      uid: String(parsed.uid),
      email: String(parsed.email),
      name: parsed.name ? String(parsed.name) : undefined,
    }
  } catch {
    return null
  }
}

function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export function setSessionCookie(res: Response, user: AuthSessionUser) {
  const token = signSessionToken(user)
  const isProd = process.env.NODE_ENV === 'production'
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: 30 * 24 * 3600 * 1000,
    path: '/',
  })
}

export function clearSessionCookie(res: Response) {
  const isProd = process.env.NODE_ENV === 'production'
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    path: '/',
  })
}

async function resolveAuth(req: AuthRequest): Promise<AuthSessionUser | null> {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1]
    const decoded = await adminAuth.verifyIdToken(token)
    if (decoded?.uid && decoded?.email) {
      return {
        uid: decoded.uid,
        email: decoded.email.toLowerCase(),
        name: typeof decoded.name === 'string' ? decoded.name : undefined,
      }
    }
  }

  const cookieToken = parseCookie(req.headers.cookie, SESSION_COOKIE)
  if (cookieToken) {
    return verifySessionToken(cookieToken)
  }
  return null
}

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const user = await resolveAuth(req)
    if (user) req.authUser = user
  } catch {
    /* ignore invalid/expired token for public routes */
  }
  next()
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await resolveAuth(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Sign in required' })
    }
    req.authUser = user
    next()
  } catch (error) {
    console.error('Error verifying authentication:', error)
    return res.status(401).json({ error: 'Unauthorized: Invalid session' })
  }
}

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.authUser || (await resolveAuth(req))
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Sign in required' })
    }
    req.authUser = user
    const dbUser = await getOrCreateUser(user.uid, user.email, user.name)
    if (dbUser.role !== 'admin') {
      return res
        .status(403)
        .json({ error: 'Forbidden: Administrator access required' })
    }
    next()
  } catch (error) {
    console.error('Error verifying admin access:', error)
    return res.status(403).json({ error: 'Forbidden: Administrator access required' })
  }
}

/* ----------------------------------------------------- Mobile OTP Verification */

export function normalizePhoneNumber(rawPhone: string): string | null {
  const digits = String(rawPhone || '').replace(/\D/g, '')
  let tenDigits = digits
  if (digits.length === 12 && digits.startsWith('91')) {
    tenDigits = digits.slice(2)
  } else if (digits.length === 11 && digits.startsWith('0')) {
    tenDigits = digits.slice(1)
  }
  if (!/^[1-9]\d{9}$/.test(tenDigits)) {
    return null
  }
  return tenDigits
}

function signPayload(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(body)
    .digest('base64url')
  return `${body}.${sig}`
}

function verifySignedPayload(token: string): Record<string, any> | null {
  const [body, sig] = String(token || '').split('.')
  if (!body || !sig) return null
  const expected = crypto
    .createHmac('sha256', getSigningSecret())
    .update(body)
    .digest('base64url')
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null
  }
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

export function createOtpChallenge(rawPhone: string): {
  phone: string
  otp: string
  challengeToken: string
} | null {
  const phone = normalizePhoneNumber(rawPhone)
  if (!phone) return null
  const otp = String(crypto.randomInt(100000, 1000000))
  const otpHmac = crypto
    .createHmac('sha256', getSigningSecret())
    .update(`otp:${phone}:${otp}`)
    .digest('hex')
  const challengeToken = signPayload({
    type: 'phone_otp_challenge',
    phone,
    otpHmac,
    exp: Date.now() + 5 * 60 * 1000,
  })
  return { phone, otp, challengeToken }
}

export function verifyOtpChallenge(
  rawPhone: string,
  otpInput: string,
  challengeToken: string,
): { valid: boolean; phone?: string; otpToken?: string } {
  const phone = normalizePhoneNumber(rawPhone)
  const cleanOtp = String(otpInput || '').trim()
  if (!phone || !/^\d{6}$/.test(cleanOtp)) {
    return { valid: false }
  }
  const parsed = verifySignedPayload(challengeToken)
  if (
    !parsed ||
    parsed.type !== 'phone_otp_challenge' ||
    parsed.phone !== phone ||
    typeof parsed.otpHmac !== 'string' ||
    typeof parsed.exp !== 'number' ||
    Date.now() > parsed.exp
  ) {
    return { valid: false }
  }
  const candidateHmac = crypto
    .createHmac('sha256', getSigningSecret())
    .update(`otp:${phone}:${cleanOtp}`)
    .digest('hex')
  if (candidateHmac.length !== parsed.otpHmac.length) {
    return { valid: false }
  }
  const matches = crypto.timingSafeEqual(
    Buffer.from(candidateHmac),
    Buffer.from(parsed.otpHmac),
  )
  if (!matches) {
    return { valid: false }
  }
  const otpToken = issueOtpProofToken(phone)
  if (!otpToken) return { valid: false }
  return { valid: true, phone, otpToken }
}

export function issueOtpProofToken(rawPhone: string): string | null {
  const phone = normalizePhoneNumber(rawPhone)
  if (!phone) return null
  return signPayload({
    type: 'phone_otp_verified',
    phone,
    exp: Date.now() + 15 * 60 * 1000,
  })
}

export async function verifyFirebasePhoneIdToken(
  idToken: string,
  rawPhone: string,
): Promise<{ valid: boolean; phone?: string; otpToken?: string; error?: string }> {
  const phone = normalizePhoneNumber(rawPhone)
  if (!phone) {
    return { valid: false, error: 'Please enter a valid 10-digit mobile number.' }
  }
  if (!idToken) {
    return { valid: false, error: 'Missing Firebase verification token.' }
  }
  try {
    const decoded = await adminAuth.verifyIdToken(idToken)
    const tokenPhone = normalizePhoneNumber(decoded?.phone_number || '')
    if (!tokenPhone || tokenPhone !== phone) {
      return {
        valid: false,
        error: 'Verified phone number does not match checkout mobile number.',
      }
    }
    const otpToken = issueOtpProofToken(phone)
    if (!otpToken) {
      return { valid: false, error: 'Unable to issue verification token.' }
    }
    return { valid: true, phone, otpToken }
  } catch (err: any) {
    return {
      valid: false,
      error: err?.message || 'Firebase phone verification failed.',
    }
  }
}

export function verifyOtpProofToken(
  rawPhone: string,
  otpToken: string,
): boolean {
  const phone = normalizePhoneNumber(rawPhone)
  if (!phone || !otpToken) return false
  const parsed = verifySignedPayload(otpToken)
  if (
    !parsed ||
    parsed.type !== 'phone_otp_verified' ||
    parsed.phone !== phone ||
    typeof parsed.exp !== 'number' ||
    Date.now() > parsed.exp
  ) {
    return false
  }
  return true
}


