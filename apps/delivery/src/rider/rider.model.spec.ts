import { RIDER_STATUS } from '../config/constants'
import { isRiderStale, serializeRider } from './rider.model'
import type { PublicRider, Rider, RiderDocument } from './rider.model'

const buildDoc = (overrides: Partial<Rider> = {}): RiderDocument =>
  ({
    _id: { toString: () => 'r1' },
    userId: 'u1',
    firstName: 'Juan',
    lastName: 'Perez',
    vehicle: { type: 'moto', brand: 'Honda' },
    phone: '11223344',
    available: true,
    status: RIDER_STATUS.free,
    currentLocation: { latitude: -34.6, longitude: -58.4 },
    lastSeenAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2025-12-31T00:00:00.000Z'),
    updatedAt: new Date('2025-12-31T00:00:00.000Z'),
    ...overrides,
  }) as unknown as RiderDocument

describe('serializeRider (RQ-DLV-11)', () => {
  it('mapea el documento completo a la proyección pública', () => {
    const result = serializeRider(buildDoc())

    expect(result).toEqual({
      id: 'r1',
      userId: 'u1',
      firstName: 'Juan',
      lastName: 'Perez',
      vehicle: { type: 'moto', brand: 'Honda' },
      phone: '11223344',
      available: true,
      status: RIDER_STATUS.free,
      currentLocation: { latitude: -34.6, longitude: -58.4 },
      lastSeenAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('no expone campos internos de Mongoose', () => {
    const result = serializeRider(buildDoc())

    expect(result).not.toHaveProperty('_id')
    expect(result).not.toHaveProperty('__v')
    expect(result).not.toHaveProperty('createdAt')
    expect(result).not.toHaveProperty('updatedAt')
    expect(Object.keys(result).sort()).toEqual([
      'available',
      'currentLocation',
      'firstName',
      'id',
      'lastName',
      'lastSeenAt',
      'phone',
      'status',
      'userId',
      'vehicle',
    ])
  })

  const nullableCases: Array<{
    name: string
    overrides: Partial<Rider>
    field: 'vehicle' | 'currentLocation' | 'lastSeenAt'
  }> = [
    { name: 'vehículo', overrides: { vehicle: null }, field: 'vehicle' },
    { name: 'ubicación', overrides: { currentLocation: null }, field: 'currentLocation' },
    { name: 'lastSeenAt nulo', overrides: { lastSeenAt: null }, field: 'lastSeenAt' },
    { name: 'lastSeenAt ausente', overrides: { lastSeenAt: undefined }, field: 'lastSeenAt' },
  ]

  it.each(nullableCases)('normaliza $name a null', ({ overrides, field }) => {
    const result = serializeRider(buildDoc(overrides))

    expect(result[field]).toBeNull()
  })
})

describe('isRiderStale (RQ-DLV-03)', () => {
  const now = new Date('2026-01-01T00:00:00.000Z')

  const riderAt = (lastSeenAt: string | null): PublicRider => ({
    id: 'r1',
    userId: 'u1',
    firstName: 'J',
    lastName: 'P',
    vehicle: null,
    phone: '1',
    available: true,
    status: RIDER_STATUS.free,
    currentLocation: { latitude: 0, longitude: 0 },
    lastSeenAt,
  })

  const cases: Array<{ name: string; lastSeenAt: string | null; expected: boolean }> = [
    { name: 'sin reporte de presencia', lastSeenAt: null, expected: true },
    { name: 'justo en el umbral (no vencido)', lastSeenAt: '2025-12-31T23:59:59.000Z', expected: false },
    { name: '1 ms por debajo del umbral', lastSeenAt: '2025-12-31T23:59:59.001Z', expected: false },
    { name: '1 ms por encima del umbral', lastSeenAt: '2025-12-31T23:59:58.999Z', expected: true },
    { name: 'reporte futuro', lastSeenAt: '2026-01-01T00:00:01.000Z', expected: false },
  ]

  it.each(cases)('$name → stale=$expected', ({ lastSeenAt, expected }) => {
    expect(isRiderStale(riderAt(lastSeenAt), 1000, now)).toBe(expected)
  })
})
