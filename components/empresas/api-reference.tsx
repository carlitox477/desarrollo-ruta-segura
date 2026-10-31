const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/v1/alerts',
    summary: 'Alertas activas alrededor de un punto.',
    example: `curl "$BASE/api/v1/alerts?lat=-34.6037&lng=-58.3816&radius=800" \\
  -H "Authorization: Bearer rs_live_..."`,
  },
  {
    method: 'POST',
    path: '/api/v1/route-risk',
    summary: 'Riesgo de un recorrido: nivel, penalización y alertas cercanas.',
    example: `curl -X POST "$BASE/api/v1/route-risk" \\
  -H "Authorization: Bearer rs_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"coordinates":[[-58.3816,-34.6037],[-58.3925,-34.5955]]}'`,
  },
]

export function ApiReference() {
  return (
    <div className="flex flex-col gap-4">
      {ENDPOINTS.map((endpoint) => (
        <div key={endpoint.path} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-xs font-medium text-primary">
              {endpoint.method}
            </span>
            <code className="font-mono text-sm">{endpoint.path}</code>
            <span className="text-sm text-muted-foreground">{endpoint.summary}</span>
          </div>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
            <code>{endpoint.example}</code>
          </pre>
        </div>
      ))}
      <p className="text-sm leading-relaxed text-muted-foreground">
        {'Límite: 120 llamadas por minuto por clave. Errores 4xx/5xx no se facturan. Respuestas en JSON.'}
      </p>
    </div>
  )
}
