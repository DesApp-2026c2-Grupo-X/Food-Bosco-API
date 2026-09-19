import { ORDER_STATUS, TRIP_STATUS } from '../config/constants'
import { serializeTrip, serializeTripOrder } from './trip.model'
import type { Trip, TripDocument, TripOrder } from './trip.model'

const buildOrder = (overrides: Partial<TripOrder> = {}): TripOrder => ({
  orderId: 'ord-1',
  pickupBranchId: 'b1',
  pickupLocation: { latitude: -34.6, longitude: -58.4 },
  deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
  status: ORDER_STATUS.readyForDelivery,
  pickedUpAt: null,
  deliveredAt: null,
  ...overrides,
})

const buildDoc = (overrides: Partial<Trip> = {}): TripDocument =>
  ({
    _id: { toString: () => 't1' },
    riderId: 'u1',
    status: TRIP_STATUS.active,
    orders: [buildOrder()],
    distanceKm: 5,
    estimatedMinutes: 12,
    estimatedEarnings: 1500,
    earnings: 1500,
    startedAt: new Date('2026-01-01T00:01:00.000Z'),
    completedAt: new Date('2026-01-01T00:30:00.000Z'),
    expiresAt: new Date('2026-01-01T00:01:30.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as unknown as TripDocument

describe('serializeTripOrder (RQ-DLV-07)', () => {
  it('mapea la orden y convierte fechas a ISO', () => {
    const order = buildOrder({
      status: ORDER_STATUS.delivered,
      pickedUpAt: new Date('2026-01-01T00:10:00.000Z'),
      deliveredAt: new Date('2026-01-01T00:20:00.000Z'),
    })

    const result = serializeTripOrder(order)

    expect(result).toEqual({
      orderId: 'ord-1',
      pickupBranchId: 'b1',
      pickupLocation: { latitude: -34.6, longitude: -58.4 },
      deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
      status: ORDER_STATUS.delivered,
      pickedUpAt: '2026-01-01T00:10:00.000Z',
      deliveredAt: '2026-01-01T00:20:00.000Z',
    })
  })

  it.each([
    { name: 'ambas nulas', pickedUpAt: null, deliveredAt: null },
    { name: 'solo retiro', pickedUpAt: new Date('2026-01-01T00:10:00.000Z'), deliveredAt: null },
    { name: 'solo entrega', pickedUpAt: null, deliveredAt: new Date('2026-01-01T00:20:00.000Z') },
  ])('normaliza fechas ausentes ($name)', ({ pickedUpAt, deliveredAt }) => {
    const result = serializeTripOrder(buildOrder({ pickedUpAt, deliveredAt }))

    expect(result.pickedUpAt).toBe(pickedUpAt ? pickedUpAt.toISOString() : null)
    expect(result.deliveredAt).toBe(deliveredAt ? deliveredAt.toISOString() : null)
  })
})

describe('serializeTrip (RQ-DLV-06/08/10)', () => {
  it('mapea el documento completo a la proyección pública', () => {
    const result = serializeTrip(buildDoc())

    expect(result).toEqual({
      id: 't1',
      riderId: 'u1',
      status: TRIP_STATUS.active,
      orders: [
        {
          orderId: 'ord-1',
          pickupBranchId: 'b1',
          pickupLocation: { latitude: -34.6, longitude: -58.4 },
          deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
          status: ORDER_STATUS.readyForDelivery,
          pickedUpAt: null,
          deliveredAt: null,
        },
      ],
      distanceKm: 5,
      estimatedMinutes: 12,
      estimatedEarnings: 1500,
      earnings: 1500,
      startedAt: '2026-01-01T00:01:00.000Z',
      completedAt: '2026-01-01T00:30:00.000Z',
      expiresAt: '2026-01-01T00:01:30.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('no expone campos internos de Mongoose', () => {
    const result = serializeTrip(buildDoc())

    expect(result).not.toHaveProperty('_id')
    expect(result).not.toHaveProperty('__v')
    expect(result).not.toHaveProperty('updatedAt')
  })

  const nullableCases: Array<{
    name: string
    overrides: Partial<Trip>
    field: 'earnings' | 'startedAt' | 'completedAt' | 'expiresAt'
  }> = [
    { name: 'earnings', overrides: { earnings: null }, field: 'earnings' },
    { name: 'startedAt', overrides: { startedAt: null }, field: 'startedAt' },
    { name: 'completedAt', overrides: { completedAt: null }, field: 'completedAt' },
    { name: 'expiresAt', overrides: { expiresAt: null }, field: 'expiresAt' },
  ]

  it.each(nullableCases)('normaliza $name nulo a null', ({ overrides, field }) => {
    const result = serializeTrip(buildDoc(overrides))

    expect(result[field]).toBeNull()
  })

  it('devuelve createdAt vacío si el documento no lo trae (límite)', () => {
    const result = serializeTrip(buildDoc({ createdAt: undefined }))

    expect(result.createdAt).toBe('')
  })
})
