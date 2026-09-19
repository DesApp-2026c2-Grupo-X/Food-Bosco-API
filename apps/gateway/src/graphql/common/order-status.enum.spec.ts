import { OrderStatus, orderStatusFromRest, orderStatusToRest } from './order-status.enum'

describe('orderStatusFromRest', () => {
  it.each<[string, OrderStatus]>([
    ['pending', OrderStatus.PENDING],
    ['confirmed', OrderStatus.CONFIRMED],
    ['preparing', OrderStatus.PREPARING],
    ['ready_for_delivery', OrderStatus.READY_FOR_DELIVERY],
    ['on_the_way', OrderStatus.ON_THE_WAY],
    ['delivered', OrderStatus.DELIVERED],
    ['cancelled', OrderStatus.CANCELLED],
  ])('convierte "%s" a %s', (rest, status) => {
    expect(orderStatusFromRest(rest)).toBe(status)
  })

  it.each(['PENDING', 'Confirmed', 'READY_FOR_DELIVERY', 'On_The_Way'])(
    'es insensible a mayúsculas: %s',
    (value) => {
      expect(orderStatusFromRest(value)).toBe(orderStatusFromRest(value.toLowerCase()))
    },
  )

  it.each(['', 'foo', 'en_camino', 'pending ', ' pending'])(
    'lanza error para un valor desconocido %p',
    (value) => {
      expect(() => orderStatusFromRest(value)).toThrow(`Unknown order status: ${value}`)
    },
  )
})

describe('orderStatusToRest', () => {
  it.each<[OrderStatus, string]>([
    [OrderStatus.PENDING, 'pending'],
    [OrderStatus.CONFIRMED, 'confirmed'],
    [OrderStatus.PREPARING, 'preparing'],
    [OrderStatus.READY_FOR_DELIVERY, 'ready_for_delivery'],
    [OrderStatus.ON_THE_WAY, 'on_the_way'],
    [OrderStatus.DELIVERED, 'delivered'],
    [OrderStatus.CANCELLED, 'cancelled'],
  ])('convierte %s a "%s"', (status, rest) => {
    expect(orderStatusToRest(status)).toBe(rest)
  })

  it.each(Object.values(OrderStatus))('es inversa de orderStatusFromRest para %s', (status) => {
    expect(orderStatusFromRest(orderStatusToRest(status))).toBe(status)
  })
})
