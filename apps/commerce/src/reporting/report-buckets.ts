import { BUSINESS_TIME_ZONE } from '../config/constants'
import type { ReportGroupBy } from './reporting.model'

const MS_PER_DAY = 24 * 60 * 60 * 1000

interface CalendarDate {
  year: number
  month: number
  day: number
}

const calendarFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const toCalendarDate = (date: Date): CalendarDate => {
  const parts = calendarFormatter.formatToParts(date)
  const read = (type: string): number => Number(parts.find((part) => part.type === type)?.value)

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
  }
}

const toUtcDate = ({ year, month, day }: CalendarDate): Date =>
  new Date(Date.UTC(year, month - 1, day))

const pad = (value: number): string => String(value).padStart(2, '0')

const isoWeekLabel = ({ year, month, day }: CalendarDate): string => {
  const date = toUtcDate({ year, month, day })
  const dayNumber = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber)

  const isoYear = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7)

  return `${isoYear}-W${pad(week)}`
}

const startOfIsoWeek = (calendar: CalendarDate): Date => {
  const date = toUtcDate(calendar)
  const dayNumber = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - dayNumber + 1)
  return date
}

const bucketLabel = (calendar: CalendarDate, groupBy: ReportGroupBy): string => {
  if (groupBy === 'day') return `${calendar.year}-${pad(calendar.month)}-${pad(calendar.day)}`
  if (groupBy === 'week') return isoWeekLabel(calendar)
  return `${calendar.year}-${pad(calendar.month)}`
}

const toCalendarDateUtc = (date: Date): CalendarDate => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
})

const enumerateDays = (from: CalendarDate, to: CalendarDate): string[] => {
  const cursor = toUtcDate(from)
  const end = toUtcDate(to)
  const buckets: string[] = []

  while (cursor.getTime() <= end.getTime()) {
    buckets.push(bucketLabel(toCalendarDateUtc(cursor), 'day'))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return buckets
}

const enumerateWeeks = (from: CalendarDate, to: CalendarDate): string[] => {
  const cursor = startOfIsoWeek(from)
  const end = toUtcDate(to)
  const buckets: string[] = []

  while (cursor.getTime() <= end.getTime()) {
    buckets.push(isoWeekLabel(toCalendarDateUtc(cursor)))
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }

  return buckets
}

const enumerateMonths = (from: CalendarDate, to: CalendarDate): string[] => {
  const cursor = new Date(Date.UTC(from.year, from.month - 1, 1))
  const end = new Date(Date.UTC(to.year, to.month - 1, 1))
  const buckets: string[] = []

  while (cursor.getTime() <= end.getTime()) {
    buckets.push(
      bucketLabel(
        {
          year: cursor.getUTCFullYear(),
          month: cursor.getUTCMonth() + 1,
          day: cursor.getUTCDate(),
        },
        'month',
      ),
    )
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return buckets
}

export const enumerateReportBuckets = (from: Date, to: Date, groupBy: ReportGroupBy): string[] => {
  const start = toCalendarDate(from)
  const end = toCalendarDate(to)

  if (groupBy === 'day') return enumerateDays(start, end)
  if (groupBy === 'week') return enumerateWeeks(start, end)
  return enumerateMonths(start, end)
}

export const fillReportSeries = <T extends { bucket: string }>(
  rows: T[],
  from: Date,
  to: Date,
  groupBy: ReportGroupBy,
  createEmpty: (bucket: string) => T,
): T[] => {
  const rowsByBucket = new Map(rows.map((row) => [row.bucket, row]))

  return enumerateReportBuckets(from, to, groupBy).map(
    (bucket) => rowsByBucket.get(bucket) ?? createEmpty(bucket),
  )
}
