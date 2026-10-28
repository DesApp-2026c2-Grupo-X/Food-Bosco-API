/**
 * Identificador de lote de seed: timestamp UTC compacto + semilla en base 36.
 * Permite distinguir los datos de demo de los reales y borrarlos por lote.
 */
export const createBatchId = (seed: number, now: Date = new Date()): string => {
  const stamp = now
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14)
  return `${stamp}-${Math.trunc(Math.abs(seed)).toString(36)}`
}
