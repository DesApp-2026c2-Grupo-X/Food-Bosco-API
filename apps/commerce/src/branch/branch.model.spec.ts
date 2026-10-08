import { isBranchOpenNow } from './branch.model'
import type { PublicBranchHour } from './branch.model'

const ARGENTINA_UTC_OFFSET_HOURS = 3

// Construye el instante UTC que corresponde a una hora de pared de Argentina (GMT-3),
// independientemente de la zona horaria de la máquina que corre los tests.
const argentinaInstant = (
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds = 0,
): Date =>
  new Date(Date.UTC(year, month - 1, day, hours + ARGENTINA_UTC_OFFSET_HOURS, minutes, seconds))

const hour = (overrides: Partial<PublicBranchHour> = {}): PublicBranchHour => ({
  dayOfWeek: 1,
  opening: '08:00',
  closing: '20:00',
  closed: false,
  ...overrides,
})

const mondayAt = (time: string): Date => {
  const [hours, minutes] = time.split(':').map((part) => Number(part))
  return argentinaInstant(2026, 8, 24, hours, minutes)
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
    {
      name: 'un segundo antes de abrir',
      at: argentinaInstant(2026, 8, 24, 7, 59, 59),
      expected: false,
    },
    {
      name: 'exactamente al abrir',
      at: argentinaInstant(2026, 8, 24, 8, 0, 0),
      expected: true,
    },
    {
      name: 'un segundo antes de cerrar',
      at: argentinaInstant(2026, 8, 24, 19, 59, 59),
      expected: true,
    },
    {
      name: 'exactamente al cerrar',
      at: argentinaInstant(2026, 8, 24, 20, 0, 0),
      expected: false,
    },
    {
      name: 'un segundo después de cerrar',
      at: argentinaInstant(2026, 8, 24, 20, 0, 1),
      expected: false,
    },
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
    {
      name: 'apertura igual al cierre (rango vacío)',
      hour: { opening: '08:00', closing: '08:00' },
    },
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

describe('isBranchOpenNow — zona horaria de Argentina (GMT-3)', () => {
  // El instante es el mismo en UTC para los tres casos; lo que cambia es el día/hora
  // de pared con el que debe evaluarse la sucursal.
  const tuesdayEarlyUtc = new Date(Date.UTC(2026, 7, 25, 2, 0, 0)) // martes 02:00 UTC = lunes 23:00 AR

  it.each([
    {
      name: 'evalúa con el día argentino aunque en UTC ya sea el día siguiente',
      at: tuesdayEarlyUtc,
      hours: [hour({ dayOfWeek: 1, opening: '23:00', closing: '23:59' })],
      expected: true,
    },
    {
      name: 'no usa el día UTC cuando en Argentina todavía es el día anterior',
      at: tuesdayEarlyUtc,
      hours: [hour({ dayOfWeek: 2, opening: '01:00', closing: '03:00' })],
      expected: false,
    },
    {
      name: 'desplaza tres horas hacia atrás respecto de UTC',
      at: new Date(Date.UTC(2026, 7, 24, 12, 0, 0)), // 12:00 UTC = 09:00 AR
      hours: [hour({ dayOfWeek: 1, opening: '09:00', closing: '09:30' })],
      expected: true,
    },
  ])('$name → $expected', ({ at, hours, expected }) => {
    expect(isBranchOpenNow(hours, at)).toBe(expected)
  })
})

describe('isBranchOpenNow — rango nocturno (RQ-BRN-03)', () => {
  // Un horario 22:00 → 02:00 cruza medianoche: el cierre es menor que la apertura,
  // por lo que la sucursal está abierta desde las 22:00 hasta las 02:00 del día siguiente.
  const overnightHours = [
    hour({ dayOfWeek: 1, opening: '22:00', closing: '02:00' }),
    hour({ dayOfWeek: 2, opening: '22:00', closing: '02:00' }),
  ]

  it.each([
    { name: 'justo al abrir (22:00)', at: argentinaInstant(2026, 8, 24, 22, 0), expected: true },
    {
      name: 'antes de medianoche (23:00)',
      at: argentinaInstant(2026, 8, 24, 23, 0),
      expected: true,
    },
    {
      name: 'un minuto antes de cerrar (01:59)',
      at: argentinaInstant(2026, 8, 25, 1, 59),
      expected: true,
    },
    { name: 'justo al cerrar (02:00)', at: argentinaInstant(2026, 8, 25, 2, 0), expected: false },
    {
      name: 'de madrugada cerrado (03:00)',
      at: argentinaInstant(2026, 8, 25, 3, 0),
      expected: false,
    },
    {
      name: 'antes de abrir (21:59)',
      at: argentinaInstant(2026, 8, 24, 21, 59),
      expected: false,
    },
    {
      name: 'pleno mediodía cerrado (12:00)',
      at: argentinaInstant(2026, 8, 24, 12, 0),
      expected: false,
    },
  ])('$name → $expected', ({ at, expected }) => {
    expect(isBranchOpenNow(overnightHours, at)).toBe(expected)
  })
})
