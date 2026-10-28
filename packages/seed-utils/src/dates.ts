/**
 * Zona horaria del negocio: America/Argentina/Buenos_Aires.
 * Argentina no aplica horario de verano desde 2009, así que el offset fijo
 * alcanza para construir fechas locales sin depender de la TZ del servidor.
 */
export const BUSINESS_UTC_OFFSET_HOURS = -3

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000

const SHIFT_MS = BUSINESS_UTC_OFFSET_HOURS * MS_PER_HOUR

/**
 * Construye un instante a partir de un día local (hace `daysAgo` días) y una
 * hora local expresada en minutos desde la medianoche.
 *
 * Ejemplo: `localDateAt(now, 0, 12 * 60)` devuelve hoy a las 12:00 en Buenos Aires.
 */
export const localDateAt = (reference: Date, daysAgo: number, minutesOfDay: number): Date => {
  const local = new Date(reference.getTime() + SHIFT_MS)
  const localMidnightUtc = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysAgo,
  )

  return new Date(localMidnightUtc - SHIFT_MS + minutesOfDay * MS_PER_MINUTE)
}

/** Día de la semana local (0 = domingo … 6 = sábado) de hace `daysAgo` días. */
export const localDayOfWeek = (reference: Date, daysAgo: number): number =>
  new Date(reference.getTime() + SHIFT_MS - daysAgo * MS_PER_DAY).getUTCDay()

/** Suma minutos a un instante. */
export const addMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() + minutes * MS_PER_MINUTE)

/** Minutos transcurridos entre dos instantes (puede ser negativo). */
export const minutesBetween = (from: Date, to: Date): number =>
  (to.getTime() - from.getTime()) / MS_PER_MINUTE
