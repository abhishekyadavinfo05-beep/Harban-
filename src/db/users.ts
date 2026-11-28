import { and, desc, eq } from 'drizzle-orm'
import { db } from './index.ts'
import { addresses, users } from './schema.ts'

export interface AddressInput {
  id?: number
  label?: string
  fullName: string
  phone?: string
  line1: string
  city: string
  state?: string
  pincode: string
  isDefault?: boolean
}

export function isAdminEmail(email: string): boolean {
  const clean = email.trim().toLowerCase()
  const raw =
    process.env.ADMIN_EMAILS ||
    'abhishekyadavinfo05@gmail.com,harban.official@gmail.com'
  const list = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return list.includes(clean)
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  name?: string,
) {
  try {
    const cleanEmail = email.trim().toLowerCase()
    const cleanName = (
      name ||
      cleanEmail.split('@')[0] ||
      'HARBAN Customer'
    ).trim()
    const defaultRole = isAdminEmail(cleanEmail) ? 'admin' : 'customer'

    const byEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1)

    if (byEmail.length > 0) {
      const nextRole =
        byEmail[0].role === 'admin' || defaultRole === 'admin'
          ? 'admin'
          : 'customer'
      if (byEmail[0].uid !== uid || byEmail[0].role !== nextRole) {
        const updated = await db
          .update(users)
          .set({
            uid,
            name: byEmail[0].name || cleanName,
            role: nextRole,
          })
          .where(eq(users.id, byEmail[0].id))
          .returning()
        return updated[0]
      }
      return byEmail[0]
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email: cleanEmail,
        name: cleanName,
        role: defaultRole,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: cleanEmail,
          role: defaultRole,
        },
      })
      .returning()

    return result[0]
  } catch (error) {
    console.error('Database user upsert failed:', error)
    throw new Error('Unable to sync customer account.', { cause: error })
  }
}

export async function findUserByEmail(email: string) {
  try {
    const cleanEmail = email.trim().toLowerCase()
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1)
    if (rows[0] && rows[0].role !== 'admin' && isAdminEmail(cleanEmail)) {
      const promoted = await db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.id, rows[0].id))
        .returning()
      return promoted[0]
    }
    return rows[0] ?? null
  } catch (error) {
    console.error('Database query findUserByEmail failed:', error)
    throw new Error('Unable to look up customer account.', { cause: error })
  }
}

export async function findUserByUid(uid: string) {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1)
    return rows[0] ?? null
  } catch (error) {
    console.error('Database query findUserByUid failed:', error)
    throw new Error('Unable to load customer profile.', { cause: error })
  }
}

export async function createEmailUser({
  uid,
  name,
  email,
  phone,
  passwordHash,
}: {
  uid: string
  name: string
  email: string
  phone?: string
  passwordHash: string
}) {
  try {
    const cleanEmail = email.trim().toLowerCase()
    const role = isAdminEmail(cleanEmail) ? 'admin' : 'customer'
    const rows = await db
      .insert(users)
      .values({
        uid,
        name: name.trim(),
        email: cleanEmail,
        phone: (phone || '').trim(),
        role,
        passwordHash,
      })
      .returning()
    return rows[0]
  } catch (error) {
    console.error('Database createEmailUser failed:', error)
    throw new Error('Unable to create customer account.', { cause: error })
  }
}

export async function updateUserProfile(
  userId: number,
  { name, phone }: { name: string; phone?: string },
) {
  try {
    const rows = await db
      .update(users)
      .set({
        name: name.trim(),
        phone: (phone || '').trim(),
      })
      .where(eq(users.id, userId))
      .returning()
    return rows[0]
  } catch (error) {
    console.error('Database updateUserProfile failed:', error)
    throw new Error('Unable to update profile.', { cause: error })
  }
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  try {
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId))
  } catch (error) {
    console.error('Database updateUserPassword failed:', error)
    throw new Error('Unable to update password.', { cause: error })
  }
}

export async function getUserAddresses(userId: number) {
  try {
    return await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, userId))
      .orderBy(desc(addresses.isDefault), desc(addresses.createdAt))
  } catch (error) {
    console.error('Database getUserAddresses failed:', error)
    throw new Error('Unable to fetch saved addresses.', { cause: error })
  }
}

export async function saveUserAddress(userId: number, input: AddressInput) {
  try {
    const existing = await getUserAddresses(userId)
    const makeDefault = Boolean(input.isDefault) || existing.length === 0

    if (makeDefault) {
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, userId))
    }

    if (input.id) {
      const updated = await db
        .update(addresses)
        .set({
          label: input.label || 'Home',
          fullName: input.fullName.trim(),
          phone: (input.phone || '').trim(),
          line1: input.line1.trim(),
          city: input.city.trim(),
          state: (input.state || '').trim(),
          pincode: input.pincode.trim(),
          isDefault: makeDefault,
        })
        .where(and(eq(addresses.id, input.id), eq(addresses.userId, userId)))
        .returning()
      if (updated[0]) return updated[0]
    }

    const inserted = await db
      .insert(addresses)
      .values({
        userId,
        label: input.label || 'Home',
        fullName: input.fullName.trim(),
        phone: (input.phone || '').trim(),
        line1: input.line1.trim(),
        city: input.city.trim(),
        state: (input.state || '').trim(),
        pincode: input.pincode.trim(),
        isDefault: makeDefault,
      })
      .returning()

    return inserted[0]
  } catch (error) {
    console.error('Database saveUserAddress failed:', error)
    throw new Error('Unable to save delivery address.', { cause: error })
  }
}

export async function deleteUserAddress(userId: number, addrId: number) {
  try {
    await db
      .delete(addresses)
      .where(and(eq(addresses.id, addrId), eq(addresses.userId, userId)))

    const remaining = await getUserAddresses(userId)
    if (remaining.length > 0 && !remaining.some((a) => a.isDefault)) {
      await db
        .update(addresses)
        .set({ isDefault: true })
        .where(eq(addresses.id, remaining[0].id))
    }
  } catch (error) {
    console.error('Database deleteUserAddress failed:', error)
    throw new Error('Unable to remove delivery address.', { cause: error })
  }
}

export async function setDefaultUserAddress(userId: number, addrId: number) {
  try {
    await db
      .update(addresses)
      .set({ isDefault: false })
      .where(eq(addresses.userId, userId))

    await db
      .update(addresses)
      .set({ isDefault: true })
      .where(and(eq(addresses.id, addrId), eq(addresses.userId, userId)))
  } catch (error) {
    console.error('Database setDefaultUserAddress failed:', error)
    throw new Error('Unable to update default address.', { cause: error })
  }
}

export async function listUsersForAdmin() {
  try {
    const rows = await db
      .select({
        id: users.id,
        uid: users.uid,
        email: users.email,
        name: users.name,
        phone: users.phone,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(500)
    return rows
  } catch (error) {
    console.error('Database listUsersForAdmin failed:', error)
    throw new Error('Unable to load customers.', { cause: error })
  }
}

export async function createAdminCustomerInDb(input: {
  name: string
  email: string
  phone?: string
  role?: string
}) {
  const cleanName = String(input.name || '').trim()
  const cleanEmail = String(input.email || '').trim().toLowerCase()
  const cleanPhone = String(input.phone || '').trim()
  const cleanRole =
    input.role === 'admin' || isAdminEmail(cleanEmail) ? 'admin' : 'customer'

  if (!cleanName) throw new Error('Customer name is required.')
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.')
  }

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1)
    if (existing[0]) {
      throw new Error('A customer with this email already exists.')
    }

    const uid = `admin:${crypto.randomUUID()}`
    const inserted = await db
      .insert(users)
      .values({
        uid,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: cleanRole,
      })
      .returning({
        id: users.id,
        uid: users.uid,
        email: users.email,
        name: users.name,
        phone: users.phone,
        role: users.role,
        createdAt: users.createdAt,
      })
    return inserted[0]
  } catch (error) {
    console.error('Database createAdminCustomerInDb failed:', error)
    throw error instanceof Error
      ? error
      : new Error('Unable to create customer account.')
  }
}

export async function updateUserRoleInDb(
  uid: string,
  role: 'admin' | 'customer',
  actorEmail?: string,
) {
  const cleanUid = String(uid || '').trim()
  const cleanRole = role === 'admin' ? 'admin' : 'customer'
  if (!cleanUid) throw new Error('User ID is required.')

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.uid, cleanUid))
    .limit(1)
  const existing = rows[0]
  if (!existing) throw new Error('User not found.')

  if (cleanRole !== 'admin' && isAdminEmail(existing.email)) {
    throw new Error('Primary allowlisted owner accounts cannot be demoted.')
  }
  if (
    cleanRole !== 'admin' &&
    actorEmail &&
    existing.email.toLowerCase() === actorEmail.trim().toLowerCase()
  ) {
    throw new Error('You cannot remove your own admin access.')
  }

  const updated = await db
    .update(users)
    .set({ role: cleanRole })
    .where(eq(users.uid, cleanUid))
    .returning({
      id: users.id,
      uid: users.uid,
      email: users.email,
      name: users.name,
      phone: users.phone,
      role: users.role,
      createdAt: users.createdAt,
    })
  return updated[0]
}

export async function deleteCustomerInDb(uid: string, actorEmail?: string) {
  const cleanUid = String(uid || '').trim()
  if (!cleanUid) throw new Error('User ID is required.')

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.uid, cleanUid))
    .limit(1)
  const existing = rows[0]
  if (!existing) return null

  if (isAdminEmail(existing.email)) {
    throw new Error('Primary owner account cannot be deleted.')
  }
  if (
    actorEmail &&
    existing.email.toLowerCase() === actorEmail.trim().toLowerCase()
  ) {
    throw new Error('You cannot delete your currently signed-in account.')
  }

  await db.delete(users).where(eq(users.uid, cleanUid))
  return existing
}


