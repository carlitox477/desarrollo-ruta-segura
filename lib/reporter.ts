import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { cookies, headers } from 'next/headers'

const COOKIE = 'rs_device'

/**
 * Anonymous reporter identity: hash of a device cookie + client IP.
 * Used only for rate limiting, duplicate detection and flagging; never exposed.
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
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'
  return createHash('sha256').update(`${device}|${ip}|ruta-segura`).digest('hex').slice(0, 32)
}
