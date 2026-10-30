const EARTH_RADIUS_M = 6_371_000
const toRad = (d: number) => (d * Math.PI) / 180

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/**
 * Distance from point P to segment AB in meters, using a local equirectangular
 * projection (accurate to well under 1% at city scale).
 */
export function pointToSegmentMeters(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
) {
  const kx = Math.cos(toRad(pLat)) * EARTH_RADIUS_M * (Math.PI / 180)
  const ky = EARTH_RADIUS_M * (Math.PI / 180)
  const ax = (aLng - pLng) * kx
  const ay = (aLat - pLat) * ky
  const bx = (bLng - pLng) * kx
  const by = (bLat - pLat) * ky
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.sqrt(cx * cx + cy * cy)
}

/** Offsets a point by meters north/east. */
export function offsetPoint(lat: number, lng: number, northM: number, eastM: number) {
  const dLat = (northM / EARTH_RADIUS_M) * (180 / Math.PI)
  const dLng = (eastM / (EARTH_RADIUS_M * Math.cos(toRad(lat)))) * (180 / Math.PI)
  return { lat: lat + dLat, lng: lng + dLng }
}
