import { NextResponse } from 'next/server'
import { getOpenArgStatus } from '@/lib/openarg'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getOpenArgStatus())
}
