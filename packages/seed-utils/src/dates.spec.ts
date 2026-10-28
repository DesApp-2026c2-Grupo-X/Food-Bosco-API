import { addMinutes, localDateAt, localDayOfWeek, minutesBetween } from './dates'

describe('localDateAt', () => {
  const reference = new Date('2026-10-27T15:00:00.000Z') // 12:00 en Buenos Aires

  it('construye el mediodía local de hoy', () => {
    expect(localDateAt(reference, 0, 12 * 60).toISOString()).toBe('2026-10-27T15:00:00.000Z')
  })

  it('construye la medianoche local (03:00 UTC)', () => {
    expect(localDateAt(reference, 0, 0).toISOString()).toBe('2026-10-27T03:00:00.000Z')
  })

  it('resta días de calendario locales', () => {
    expect(localDateAt(reference, 1, 12 * 60).toISOString()).toBe('2026-10-26T15:00:00.000Z')
    expect(localDateAt(reference, 31, 12 * 60).toISOString()).toBe('2026-09-26T15:00:00.000Z')
  })

  it('cruza el cambio de mes y de año', () => {
    const newYear = new Date('2027-01-01T02:30:00.000Z') // 2026-12-31 23:30 local

    expect(localDateAt(newYear, 0, 23 * 60).toISOString()).toBe('2027-01-01T02:00:00.000Z')
    expect(localDateAt(newYear, 1, 23 * 60).toISOString()).toBe('2026-12-31T02:00:00.000Z')
  })
})

describe('localDayOfWeek', () => {
  it('devuelve el día local (0 = domingo … 6 = sábado)', () => {
    const tuesday = new Date('2026-10-27T15:00:00.000Z')

    expect(localDayOfWeek(tuesday, 0)).toBe(2)
    expect(localDayOfWeek(tuesday, 1)).toBe(1)
  })
})

describe('addMinutes / minutesBetween', () => {
  it('suma minutos y calcula diferencias', () => {
    const start = new Date('2026-10-27T15:00:00.000Z')
    const end = addMinutes(start, 90)

    expect(end.toISOString()).toBe('2026-10-27T16:30:00.000Z')
    expect(minutesBetween(start, end)).toBe(90)
    expect(minutesBetween(end, start)).toBe(-90)
  })
})
