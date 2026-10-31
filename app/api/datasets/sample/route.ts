import { getAnonymizedSample } from '@/lib/business/dataset'

const COLUMNS = [
  'id',
  'category',
  'severity',
  'lat',
  'lng',
  'occurredHour',
  'status',
  'confirmations',
  'flags',
  'isDemo',
] as const

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export async function GET() {
  const rows = await getAnonymizedSample()
  const body = [COLUMNS.join(','), ...rows.map((row) => COLUMNS.map((c) => csvCell(row[c])).join(','))].join('\n')

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="ruta-segura-muestra-anonimizada.csv"',
      'Cache-Control': 'public, max-age=600',
    },
  })
}
