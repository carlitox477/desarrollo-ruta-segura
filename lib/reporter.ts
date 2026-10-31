import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'

const COOKIE = 'rs_device'

/**
 * Anonymous reporter identity: hash of a device cookie.
 * Used for ownership (withdraw), rate limiting, duplicate detection and flagging; never exposed.
 */
export async function getReporterHash() {
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
