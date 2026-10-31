import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { auth } from '@/lib/auth'

const COOKIE = 'rs_device'

/**
 * Reporter identity used for ownership (withdraw), rate limiting, duplicate detection and flagging.
 * Signed-in users are identified by their account so their reports follow them across devices;
 * anonymous users fall back to a hashed device cookie. The raw identifier is never exposed.
 */
export async function getReporterHash() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (session?.user) {
    return createHash('sha256').update(`user:${session.user.id}|ruta-segura`).digest('hex').slice(0, 32)
  }

  const jar = await cookies()
  let device = jar.get(COOKIE)?.value
  if (!device) {
    device = randomUUID()
    jar.set(COOKIE, device, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    })
  }
  // IP is deliberately excluded: proxies and mobile networks rotate it, which would make
  // users lose ownership of their own reports (and break withdraw/flag dedupe).
  return createHash('sha256').update(`${device}|ruta-segura`).digest('hex').slice(0, 32)
}
