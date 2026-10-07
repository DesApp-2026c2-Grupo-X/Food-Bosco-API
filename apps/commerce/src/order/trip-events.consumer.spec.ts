import { EventBus } from '../config/messaging/event-bus'
import { TRIP_ACCEPTED_EVENT, TRIP_COMPLETED_EVENT } from '../config/messaging/events'
import type { TripAcceptedEvent, TripCompletedEvent } from '../config/messaging/events'
import { OrderService } from './order.service'
import { TripEventsConsumer } from './trip-events.consumer'

type Handler = (event: unknown) => Promise<void>

const makeConsumer = () => {
  const handlers = new Map<string, Handler>()
  const eventBus = {
    subscribe: jest.fn((type: string, handler: Handler) => {
      handlers.set(type, handler)
      return Promise.resolve()
    }),
  }
  const orderService = { markAssigned: jest.fn().mockResolvedValue(undefined) }
  const consumer = new TripEventsConsumer(
    eventBus as unknown as EventBus,
    orderService as unknown as OrderService,
  )
  return { consumer, eventBus, orderService, handlers }
}

const tripAccepted = (overrides: Partial<TripAcceptedEvent> = {}): TripAcceptedEvent => ({
  type: TRIP_ACCEPTED_EVENT,
  version: 1,
  eventId: 'evt-1',
  tripId: 't1',
  riderId: 'r1',
  orderIds: ['o1'],
  ...overrides,
})

describe('TripEventsConsumer.onModuleInit (RQ-ORD-16)', () => {
  it('se suscribe a trip.accepted y trip.completed', async () => {
    const { consumer, eventBus } = makeConsumer()

    await consumer.onModuleInit()

    expect(eventBus.subscribe).toHaveBeenCalledWith(TRIP_ACCEPTED_EVENT, expect.any(Function))
    expect(eventBus.subscribe).toHaveBeenCalledWith(TRIP_COMPLETED_EVENT, expect.any(Function))
  })
})

describe('TripEventsConsumer — trip.accepted', () => {
  const cases: Array<{ name: string; event: TripAcceptedEvent }> = [
    { name: 'un pedido', event: tripAccepted() },
    { name: 'varios pedidos', event: tripAccepted({ orderIds: ['o1', 'o2', 'o3'], tripId: 't9' }) },
    { name: 'sin pedidos', event: tripAccepted({ orderIds: [] }) },
  ]

  it.each(cases)('$name → asigna el viaje y el repartidor', async ({ event }) => {
    const { consumer, orderService, handlers } = makeConsumer()
    await consumer.onModuleInit()

    await handlers.get(TRIP_ACCEPTED_EVENT)?.(event)

    expect(orderService.markAssigned).toHaveBeenCalledWith(
      event.orderIds,
      event.tripId,
      event.riderId,
    )
  })
})

describe('TripEventsConsumer — trip.completed', () => {
  it('es un no-op idempotente: no marca pedidos', async () => {
    const { consumer, orderService, handlers } = makeConsumer()
    await consumer.onModuleInit()
    const event: TripCompletedEvent = {
      type: TRIP_COMPLETED_EVENT,
      version: 1,
      eventId: 'evt-2',
      tripId: 't1',
      riderId: 'r1',
      orderIds: ['o1'],
    }

    const result = handlers.get(TRIP_COMPLETED_EVENT)?.(event)

    expect(result).toBeUndefined()
    expect(orderService.markAssigned).not.toHaveBeenCalled()
  })
})
