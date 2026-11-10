import { BUSINESS_TIME_ZONE } from '../constants'

export const timeToMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null
  const [hours, minutes] = value.split(':').map((part) => Number(part))
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

const argentinaClockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export interface ArgentinaClock {
  dayOfWeek: number
  minutes: number
}

export const getArgentinaClock = (instant: Date): ArgentinaClock => {
  const parts = argentinaClockFormatter.formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)

  const year = read('year')
  const month = read('month')
  const day = read('day')
  const hour = read('hour')
  const minute = read('minute')

  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return { dayOfWeek, minutes: hour * 60 + minute }
}

export const isWithinTimeWindow = (
  nowMinutes: number,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): boolean => {
  if (!startTime || !endTime) return true
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  if (start === null || end === null) return true

  if (end < start) {
    // Cruza medianoche (ej. 22:00 a 02:00)
    return nowMinutes >= start || nowMinutes <= end
  }
  return nowMinutes >= start && nowMinutes <= end
}
