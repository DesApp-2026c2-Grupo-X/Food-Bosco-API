import { ORDER_STATUS, RIDER_STATUS } from '../config/constants'
import type { OrderStatusChangedEvent } from '../config/messaging/events'
import { DeliveryOrderService } from '../delivery-order/delivery-order.service'
import { RiderOrchestrator } from '../rider/rider.orchestrator'
import { TripService } from '../trip/trip.service'
import { OrderLifecycleOrchestrator } from './order-lifecycle.orchestrator'

const event = (overrides: Partial<OrderStatusChangedEvent> = {}): OrderStatusChangedEvent => ({
  type: 'order.status_changed',
  version: 1,
  eventId: 'e1',
  orderId: 'ord-1',
  status: ORDER_STATUS.readyForDelivery,
  branchId: 'b1',
  branchLocation: { latitude: -34.6, longitude: -58.4 },
  deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
  occurredAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const makeOrchestrator = () => {
  const deliveryOrderService = {
    isEventProcessed: jest.fn().mockResolvedValue(false),
    applyStatusChange: jest.fn().mockResolvedValue(undefined),
    markEventProcessed: jest.fn().mockResolvedValue(true),
  }
  const tripService = {
    cancelOrderByOrderId: jest.fn().mockResolvedValue(null),
    hasActiveTrip: jest.fn().mockResolvedValue(false),
  }
  const riderOrchestrator = {
    setStatus: jest.fn().mockResolvedValue(undefined),
  }
  const orchestrator = new OrderLifecycleOrchestrator(
    deliveryOrderService as unknown as DeliveryOrderService,
    tripService as unknown as TripService,
    riderOrchestrator as unknown as RiderOrchestrator,
  )

  return { orchestrator, deliveryOrderService, tripService, riderOrchestrator }
}

describe('OrderLifecycleOrchestrator (RQ-DLV-03)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('procesa un evento READY_FOR_DELIVERY y lo marca como procesado', async () => {
    const { orchestrator, deliveryOrderService, tripService } = makeOrchestrator()

    await orchestrator.handleOrderStatusChanged(event())

    expect(deliveryOrderService.applyStatusChange).toHaveBeenCalledWith(event())
    expect(tripService.cancelOrderByOrderId).not.toHaveBeenCalled()
    expect(deliveryOrderService.markEventProcessed).toHaveBeenCalledWith('e1')
  })

  it('ignora un evento ya procesado', async () => {
    const { orchestrator, deliveryOrderService, tripService } = makeOrchestrator()
    deliveryOrderService.isEventProcessed.mockResolvedValue(true)

    await orchestrator.handleOrderStatusChanged(event({ status: ORDER_STATUS.cancelled }))

    expect(deliveryOrderService.applyStatusChange).not.toHaveBeenCalled()
    expect(tripService.cancelOrderByOrderId).not.toHaveBeenCalled()
    expect(deliveryOrderService.markEventProcessed).not.toHaveBeenCalled()
  })

  it('cierra el viaje y libera al rider cuando la orden cancelada era la última', async () => {
    const { orchestrator, deliveryOrderService, tripService, riderOrchestrator } =
      makeOrchestrator()
    tripService.cancelOrderByOrderId.mockResolvedValue({
      trip: { id: 't1' },
      closed: true,
      riderId: 'rider-1',
      wasActive: true,
    })

    await orchestrator.handleOrderStatusChanged(event({ status: ORDER_STATUS.cancelled }))

    expect(tripService.cancelOrderByOrderId).toHaveBeenCalledWith('ord-1')
    expect(tripService.hasActiveTrip).toHaveBeenCalledWith('rider-1')
    expect(riderOrchestrator.setStatus).toHaveBeenCalledWith('rider-1', RIDER_STATUS.free)
    expect(deliveryOrderService.markEventProcessed).toHaveBeenCalledWith('e1')
  })

  it.each([
    {
      name: 'el viaje sigue con otras órdenes',
      result: { closed: false, riderId: 'rider-1', wasActive: true },
    },
    { name: 'no existe un viaje abierto', result: null },
    {
      name: 'el viaje cerrado nunca estuvo activo',
      result: { closed: true, riderId: 'rider-1', wasActive: false },
    },
  ])('no libera al rider cuando $name', async ({ result }) => {
    const { orchestrator, tripService, riderOrchestrator } = makeOrchestrator()
    tripService.cancelOrderByOrderId.mockResolvedValue(result)

    await orchestrator.handleOrderStatusChanged(event({ status: ORDER_STATUS.cancelled }))

    expect(riderOrchestrator.setStatus).not.toHaveBeenCalled()
  })

  it('no libera al rider si todavía tiene otro viaje activo', async () => {
    const { orchestrator, tripService, riderOrchestrator } = makeOrchestrator()
    tripService.cancelOrderByOrderId.mockResolvedValue({
      trip: { id: 't1' },
      closed: true,
      riderId: 'rider-1',
      wasActive: true,
    })
    tripService.hasActiveTrip.mockResolvedValue(true)

    await orchestrator.handleOrderStatusChanged(event({ status: ORDER_STATUS.cancelled }))

    expect(riderOrchestrator.setStatus).not.toHaveBeenCalled()
  })

  it('no cancela viajes ante un evento DELIVERED', async () => {
    const { orchestrator, tripService } = makeOrchestrator()

    await orchestrator.handleOrderStatusChanged(event({ status: ORDER_STATUS.delivered }))

    expect(tripService.cancelOrderByOrderId).not.toHaveBeenCalled()
  })

  it('no marca el evento si falla la actualización del pool', async () => {
    const { orchestrator, deliveryOrderService } = makeOrchestrator()
    deliveryOrderService.applyStatusChange.mockRejectedValue(new Error('pool boom'))

    await expect(orchestrator.handleOrderStatusChanged(event())).rejects.toThrow('pool boom')
    expect(deliveryOrderService.markEventProcessed).not.toHaveBeenCalled()
  })

  it('no marca el evento si falla la cancelación del viaje', async () => {
    const { orchestrator, deliveryOrderService, tripService } = makeOrchestrator()
    tripService.cancelOrderByOrderId.mockRejectedValue(new Error('trip boom'))

    await expect(
      orchestrator.handleOrderStatusChanged(event({ status: ORDER_STATUS.cancelled })),
    ).rejects.toThrow('trip boom')
    expect(deliveryOrderService.markEventProcessed).not.toHaveBeenCalled()
  })
})
