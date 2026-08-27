import { isBranchOpenNow } from './branch.model'
import type { PublicBranchHour } from './branch.model'

const hour = (overrides: Partial<PublicBranchHour> = {}): PublicBranchHour => ({
  dayOfWeek: 1,
  opening: '08:00',
  closing: '20:00',
  closed: false,
  ...overrides,
})

const mondayAt = (time: string): Date => {
  const [hours, minutes] = time.split(':').map((part) => Number(part))
  return new Date(2026, 7, 24, hours, minutes)
}

describe('isBranchOpenNow (RQ-BRN-06)', () => {
  it.each([
    { name: 'antes de abrir', time: '07:59', expected: false },
    { name: 'justo al abrir', time: '08:00', expected: true },
    { name: 'a media mañana', time: '12:00', expected: true },
    { name: 'justo al cerrar', time: '20:00', expected: false },
    { name: 'después de cerrar', time: '20:01', expected: false },
  ])('$name → $expected', ({ time, expected }) => {
    expect(isBranchOpenNow([hour()], mondayAt(time))).toBe(expected)
  })

  it('devuelve false si el día está marcado cerrado', () => {
    expect(isBranchOpenNow([hour({ closed: true })], mondayAt('12:00'))).toBe(false)
  })

  it('devuelve false si no hay horario para ese día', () => {
    expect(isBranchOpenNow([hour({ dayOfWeek: 2 })], mondayAt('12:00'))).toBe(false)
  })

  it('devuelve false si faltan horarios de apertura o cierre', () => {
    expect(isBranchOpenNow([hour({ opening: null })], mondayAt('12:00'))).toBe(false)
    expect(isBranchOpenNow([hour({ closing: null })], mondayAt('12:00'))).toBe(false)
  })
})
