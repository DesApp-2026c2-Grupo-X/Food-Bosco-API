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

describe('isBranchOpenNow — día cerrado (RQ-BRN-06)', () => {
  it.each([
    { name: 'domingo', dayOfWeek: 0 },
    { name: 'miércoles', dayOfWeek: 3 },
    { name: 'sábado', dayOfWeek: 6 },
  ])('con el día $name marcado cerrado → false', ({ dayOfWeek }) => {
    expect(isBranchOpenNow([hour({ dayOfWeek, closed: true })], mondayAt('12:00'))).toBe(false)
  })
})

describe('isBranchOpenNow — límites de hora exactos (RQ-BRN-03)', () => {
  it.each([
    { name: 'un segundo antes de abrir', at: new Date(2026, 7, 24, 7, 59, 59), expected: false },
    { name: 'exactamente al abrir', at: new Date(2026, 7, 24, 8, 0, 0), expected: true },
    { name: 'un segundo antes de cerrar', at: new Date(2026, 7, 24, 19, 59, 59), expected: true },
    { name: 'exactamente al cerrar', at: new Date(2026, 7, 24, 20, 0, 0), expected: false },
    { name: 'un segundo después de cerrar', at: new Date(2026, 7, 24, 20, 0, 1), expected: false },
  ])('$name → $expected', ({ at, expected }) => {
    expect(isBranchOpenNow([hour()], at)).toBe(expected)
  })
})

describe('isBranchOpenNow — horarios inválidos (RQ-BRN-03)', () => {
  it.each([
    { name: 'apertura con formato no numérico', hour: { opening: '8am' } },
    { name: 'cierre con formato no numérico', hour: { closing: 'noche' } },
    { name: 'apertura vacía', hour: { opening: '' } },
    { name: 'cierre vacío', hour: { closing: '' } },
    { name: 'apertura igual al cierre (rango vacío)', hour: { opening: '08:00', closing: '08:00' } },
  ])('$name → false', ({ hour: overrides }) => {
    expect(isBranchOpenNow([hour(overrides)], mondayAt('12:00'))).toBe(false)
  })
})

describe('isBranchOpenNow — selección de día', () => {
  it('usa el horario que coincide con el día de la fecha', () => {
    const hours = [
      hour({ dayOfWeek: 0, closed: true }),
      hour({ dayOfWeek: 1, opening: '09:00', closing: '10:00' }),
    ]

    expect(isBranchOpenNow(hours, mondayAt('09:30'))).toBe(true)
    expect(isBranchOpenNow(hours, mondayAt('08:30'))).toBe(false)
  })
})

describe('isBranchOpenNow — rango nocturno', () => {
  // KNOWN BUG: no soporta horarios que cruzan medianoche (22:00 → 02:00).
  // `current >= opening && current < closing` da false para 23:00 porque el
  // cierre (02:00 → 120) es menor que la apertura (22:00 → 1320).
  // Impacto: una sucursal con turno noche aparece siempre cerrada.
  const overnightHours = [
    hour({ dayOfWeek: 1, opening: '22:00', closing: '02:00' }),
    hour({ dayOfWeek: 2, opening: '22:00', closing: '02:00' }),
  ]

  it.each([
    { name: 'antes de medianoche', at: new Date(2026, 7, 24, 23, 0), expected: false },
    { name: 'después de medianoche', at: new Date(2026, 7, 25, 1, 0), expected: false },
  ])('$name → $expected (comportamiento actual)', ({ at, expected }) => {
    expect(isBranchOpenNow(overnightHours, at)).toBe(expected)
  })
})
