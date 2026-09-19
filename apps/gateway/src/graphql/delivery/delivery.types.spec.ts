import { OrderStatus } from '../common/order-status.enum'
import { TripStatus } from '../common/trip-status.enum'
import { mapRider, mapTrip, mapTripOffer, mapTripOrder } from './delivery.types'

describe('mapRider', () => {
  it('mapea todos los campos del rider con vehículo y ubicación', () => {
    const result = mapRider({
      id: 'r1',
      userId: 'u1',
      firstName: 'Juan',
      lastName: 'Perez',
      vehicle: { type: 'moto', brand: 'Honda', model: 'CG', plate: 'AB123' },
      phone: '11223344',
      available: true,
      currentLocation: { latitude: -34.6, longitude: -58.4 },
    })

    expect(result).toEqual({
      id: 'r1',
      userId: 'u1',
      firstName: 'Juan',
      lastName: 'Perez',
      vehicle: { type: 'moto', brand: 'Honda', model: 'CG', plate: 'AB123' },
      phone: '11223344',
      available: true,
      currentLocation: { latitude: -34.6, longitude: -58.4 },
    })
  })

  it('usa _id cuando no viene id y null cuando faltan opcionales', () => {
    const result = mapRider({ _id: 'r9', userId: 'u9' })

    expect(result).toMatchObject({
      id: 'r9',
      userId: 'u9',
      firstName: null,
      lastName: null,
      vehicle: null,
      phone: null,
      available: false,
      currentLocation: null,
    })
  })

  it('vehicle presente sin campos opcionales → nulls', () => {
    const result = mapRider({ id: 'r1', vehicle: { type: 'bici' } })

    expect(result.vehicle).toEqual({ type: 'bici', brand: null, model: null, plate: null })
  })

  it('currentLocation presente con valores por defecto', () => {
    const result = mapRider({ id: 'r1', currentLocation: {} })

    expect(result.currentLocation).toEqual({ latitude: 0, longitude: 0 })
  })
})

describe('mapTripOffer', () => {
  it('mapea la oferta con números y expiración', () => {
    const result = mapTripOffer({
      id: 't1',
      orderCount: 2,
      distanceKm: 5.5,
      estimatedMinutes: 13,
      estimatedEarnings: 1200,
      expiresAt: '2026-01-01T00:01:00.000Z',
    })

    expect(result).toEqual({
      id: 't1',
      orderCount: 2,
      distanceKm: 5.5,
      estimatedMinutes: 13,
      estimatedEarnings: 1200,
      expiresAt: '2026-01-01T00:01:00.000Z',
    })
  })

  it.each([undefined, null])('expiresAt %p → null', (expiresAt) => {
    expect(mapTripOffer({ id: 't1', expiresAt }).expiresAt).toBeNull()
  })

  it('normaliza numéricos ausentes a 0 y usa _id', () => {
    const result = mapTripOffer({ _id: 't9' })

    expect(result).toEqual({
      id: 't9',
      orderCount: 0,
      distanceKm: 0,
      estimatedMinutes: 0,
      estimatedEarnings: 0,
      expiresAt: null,
    })
  })
})

describe('mapTripOrder', () => {
  it('mapea la orden del viaje con dirección y estado', () => {
    const result = mapTripOrder({
      orderId: 'ord-1',
      pickupBranchId: 'b1',
      pickupLocation: { latitude: -34.6, longitude: -58.4 },
      deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
      status: 'ready_for_delivery',
      pickedUpAt: null,
      deliveredAt: null,
    })

    expect(result).toEqual({
      orderId: 'ord-1',
      pickupBranchId: 'b1',
      pickupLocation: { latitude: -34.6, longitude: -58.4 },
      deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
      status: OrderStatus.READY_FOR_DELIVERY,
      pickedUpAt: null,
      deliveredAt: null,
    })
  })

  it('normaliza sub-objetos ausentes', () => {
    const result = mapTripOrder({ orderId: 'ord-1', status: 'pending' })

    expect(result.pickupLocation).toEqual({ latitude: 0, longitude: 0 })
    expect(result.deliveryAddress).toEqual({ text: '', latitude: 0, longitude: 0 })
  })

  it('lanza error para un estado de pedido desconocido', () => {
    expect(() => mapTripOrder({ orderId: 'ord-1', status: 'weird' })).toThrow(
      'Unknown order status: weird',
    )
  })
})

describe('mapTrip', () => {
  it('mapea el viaje completo con sus órdenes', () => {
    const result = mapTrip({
      id: 't1',
      riderId: 'u1',
      status: 'active',
      orders: [
        { orderId: 'ord-1', pickupBranchId: 'b1', status: 'on_the_way' },
        { orderId: 'ord-2', pickupBranchId: 'b1', status: 'delivered' },
      ],
      distanceKm: 5,
      estimatedMinutes: 12,
      estimatedEarnings: 1500,
      earnings: 1400,
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: null,
      expiresAt: null,
    })

    expect(result.id).toBe('t1')
    expect(result.riderId).toBe('u1')
    expect(result.status).toBe(TripStatus.ACTIVE)
    expect(result.orders.map((order) => order.status)).toEqual([
      OrderStatus.ON_THE_WAY,
      OrderStatus.DELIVERED,
    ])
    expect(result.earnings).toBe(1400)
  })

  it('ignora entradas inválidas en orders', () => {
    const result = mapTrip({
      id: 't1',
      status: 'completed',
      orders: [null, 'x', 5, { orderId: 'ord-1', status: 'delivered' }],
    })

    expect(result.orders).toHaveLength(1)
    expect(result.orders[0].orderId).toBe('ord-1')
  })

  it('orders ausente → []', () => {
    expect(mapTrip({ id: 't1', status: 'cancelled' }).orders).toEqual([])
  })

  it('earnings nulo → null y numéricos ausentes → 0', () => {
    const result = mapTrip({ id: 't1', status: 'completed' })

    expect(result).toMatchObject({
      distanceKm: 0,
      estimatedMinutes: 0,
      estimatedEarnings: 0,
      earnings: null,
      startedAt: null,
      completedAt: null,
      expiresAt: null,
    })
  })

  it('lanza error para un estado de viaje desconocido', () => {
    expect(() => mapTrip({ id: 't1', status: 'weird' })).toThrow('Unknown trip status: weird')
  })
})
