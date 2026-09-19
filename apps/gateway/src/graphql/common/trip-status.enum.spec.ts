import { TripStatus, tripStatusFromRest } from './trip-status.enum'

describe('tripStatusFromRest', () => {
  it.each<[string, TripStatus]>([
    ['offered', TripStatus.OFFERED],
    ['active', TripStatus.ACTIVE],
    ['completed', TripStatus.COMPLETED],
    ['cancelled', TripStatus.CANCELLED],
  ])('convierte "%s" a %s', (rest, status) => {
    expect(tripStatusFromRest(rest)).toBe(status)
  })

  it.each(['OFFERED', 'Active', 'COMPLETED', 'Cancelled'])(
    'es insensible a mayúsculas: %s',
    (value) => {
      expect(tripStatusFromRest(value)).toBe(tripStatusFromRest(value.toLowerCase()))
    },
  )

  it.each(['', 'foo', 'en_curso', 'active ', 'active\n'])(
    'lanza error para un valor desconocido %p',
    (value) => {
      expect(() => tripStatusFromRest(value)).toThrow(`Unknown trip status: ${value}`)
    },
  )
})
