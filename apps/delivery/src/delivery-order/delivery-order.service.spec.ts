import { DeliveryOrder, DeliveryOrderDocument } from './delivery-order.model'
import { DeliveryOrderRepository } from './delivery-order.repository'
import { DeliveryOrderService } from './delivery-order.service'
import type { OrderStatusChangedEvent } from '../config/messaging/events'

const buildDoc = (overrides: Partial<DeliveryOrder> = {}): DeliveryOrderDocument =>
  ({
    _id: { toString: () => 'o1' },
    orderId: 'ord-1',
    branchId: 'b1',
    branchLocation: { latitude: -34.6, longitude: -58.4 },
    deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
    status: 'ready',
    tripId: null,
    reservedUntil: null,
    rotationRoster: null,
    rotationIndex: null,
    rotationTurnUntil: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as DeliveryOrderDocument

const event = (status: string): OrderStatusChangedEvent => ({
  type: 'order.status_changed',
  version: 1,
  eventId: 'e1',
  orderId: 'ord-1',
  status,
  branchId: 'b1',
  branchLocation: { latitude: -34.6, longitude: -58.4 },
  deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
  occurredAt: '2026-01-01T00:00:00.000Z',
})

describe('DeliveryOrderService.handleOrderStatusChanged (RQ-DLV-03)', () => {
  const repository = { upsertReady: jest.fn(), remove: jest.fn() }
  const service = new DeliveryOrderService(repository as unknown as DeliveryOrderRepository)

  beforeEach(() => jest.clearAllMocks())

  it('agrega la orden al pool cuando pasa a READY_FOR_DELIVERY', async () => {
    await service.handleOrderStatusChanged(event('ready_for_delivery'))

    expect(repository.upsertReady).toHaveBeenCalledWith({
      orderId: 'ord-1',
      branchId: 'b1',
      branchLocation: { latitude: -34.6, longitude: -58.4 },
      deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
    })
  })

  it.each(['cancelled', 'delivered'])('quita la orden del pool si pasa a %s', async (status) => {
    await service.handleOrderStatusChanged(event(status))

    expect(repository.remove).toHaveBeenCalledWith('ord-1')
    expect(repository.upsertReady).not.toHaveBeenCalled()
  })

  it.each(['pending', 'confirmed', 'preparing', 'on_the_way'])(
    'ignora el estado %s',
    async (status) => {
      await service.handleOrderStatusChanged(event(status))

      expect(repository.upsertReady).not.toHaveBeenCalled()
      expect(repository.remove).not.toHaveBeenCalled()
    },
  )
})

const activeCtx = () => ({
  isActive: jest.fn().mockResolvedValue(true),
  eligibleNear: jest.fn().mockResolvedValue([]),
})

const ctx = (overrides: Partial<ReturnType<typeof activeCtx>> = {}) => ({
  ...activeCtx(),
  ...overrides,
})

describe('DeliveryOrderService.claimableForRider (rotación)', () => {
  it('devuelve la orden cuando es el turno del rider', async () => {
    const repository = {
      listReadyDocs: jest
        .fn()
        .mockResolvedValue([
          buildDoc({ rotationRoster: ['u2', 'u1'], rotationIndex: 1, status: 'ready' }),
        ]),
    }
    const service = new DeliveryOrderService(repository as unknown as DeliveryOrderRepository)

    const result = await service.claimableForRider(
      'u1',
      new Date('2026-01-01T00:00:00.000Z'),
      ctx(),
    )

    expect(result).toHaveLength(1)
    expect(result[0].orderId).toBe('ord-1')
  })

  it('no devuelve la orden cuando no es el turno del rider', async () => {
    const repository = {
      listReadyDocs: jest.fn().mockResolvedValue([
        buildDoc({
          rotationRoster: ['u1', 'u2'],
          rotationIndex: 0,
          rotationTurnUntil: new Date('2026-12-31T00:00:00.000Z'),
          status: 'ready',
        }),
      ]),
    }
    const service = new DeliveryOrderService(repository as unknown as DeliveryOrderRepository)

    const result = await service.claimableForRider(
      'u2',
      new Date('2026-01-01T00:00:00.000Z'),
      ctx(),
    )

    expect(result).toHaveLength(0)
  })

  it('saltea al instante a un rider del turno que se desconectó', async () => {
    const repository = {
      listReadyDocs: jest.fn().mockResolvedValue([
        buildDoc({
          rotationRoster: ['u1', 'u2'],
          rotationIndex: 0,
          rotationTurnUntil: new Date('2026-12-31T00:00:00.000Z'),
          status: 'ready',
        }),
      ]),
    }
    const service = new DeliveryOrderService(repository as unknown as DeliveryOrderRepository)

    const result = await service.claimableForRider(
      'u2',
      new Date('2026-01-01T00:00:00.000Z'),
      ctx({
        isActive: jest
          .fn()
          .mockResolvedValueOnce(false) // u1 se desconectó
          .mockResolvedValueOnce(true), // u2 sigue activo
      }),
    )

    expect(result).toHaveLength(1)
    expect(result[0].orderId).toBe('ord-1')
  })
})

describe('DeliveryOrderService.reserve / markAssigned / release', () => {
  it('reserva un conjunto de órdenes con fecha límite', async () => {
    const repository = { reserve: jest.fn().mockResolvedValue(undefined) }
    const service = new DeliveryOrderService(repository as unknown as DeliveryOrderRepository)
    const until = new Date('2026-01-01T00:01:00.000Z')

    await service.reserve(['ord-1', 'ord-2'], 't1', until)

    expect(repository.reserve).toHaveBeenCalledWith(['ord-1', 'ord-2'], 't1', until)
  })

  it('marca las órdenes como asignadas al aceptar', async () => {
    const repository = { markAssigned: jest.fn().mockResolvedValue(undefined) }
    const service = new DeliveryOrderService(repository as unknown as DeliveryOrderRepository)

    await service.markAssigned(['ord-1'], 't1')

    expect(repository.markAssigned).toHaveBeenCalledWith(['ord-1'], 't1')
  })

  it('al liberar un viaje avanza la rotación al siguiente rider', async () => {
    const doc = buildDoc({
      status: 'reserved',
      tripId: 't1',
      reservedUntil: new Date('2026-01-01T00:01:00.000Z'),
      rotationRoster: ['u1', 'u2'],
      rotationIndex: 0,
      rotationTurnUntil: new Date('2026-01-01T00:00:30.000Z'),
    })
    const repository = { findReservedDocsByTripId: jest.fn().mockResolvedValue([doc]) }
    const service = new DeliveryOrderService(repository as unknown as DeliveryOrderRepository)

    await service.releaseByTrip('t1', new Date('2026-01-02T00:00:00.000Z'), ctx())

    expect(doc.status).toBe('ready')
    expect(doc.tripId).toBeNull()
    expect(doc.reservedUntil).toBeNull()
    expect(doc.rotationIndex).toBe(1)
    expect(doc.save).toHaveBeenCalled()
  })

  it('releaseExpired libera y devuelve los tripIds vencidos', async () => {
    const doc = buildDoc({
      status: 'reserved',
      tripId: 't1',
      reservedUntil: new Date('2026-01-01T00:00:00.000Z'),
      rotationRoster: ['u1', 'u2'],
      rotationIndex: 0,
    })
    const repository = { findExpiredReservedDocs: jest.fn().mockResolvedValue([doc]) }
    const service = new DeliveryOrderService(repository as unknown as DeliveryOrderRepository)

    const result = await service.releaseExpired(new Date('2026-01-02T00:00:00.000Z'), ctx())

    expect(result).toEqual(['t1'])
    expect(doc.rotationIndex).toBe(1)
    expect(doc.save).toHaveBeenCalled()
  })

  it('al cerrar la ronda prioriza a los riders nuevos del roster', async () => {
    const doc = buildDoc({
      status: 'reserved',
      tripId: 't1',
      reservedUntil: new Date('2026-01-01T00:00:00.000Z'),
      rotationRoster: ['u1', 'u2'],
      rotationIndex: 1,
    })
    const repository = { findReservedDocsByTripId: jest.fn().mockResolvedValue([doc]) }
    const service = new DeliveryOrderService(repository as unknown as DeliveryOrderRepository)

    await service.releaseByTrip(
      't1',
      new Date('2026-01-02T00:00:00.000Z'),
      ctx({ eligibleNear: jest.fn().mockResolvedValue(['u3', 'u1', 'u2']) }),
    )

    expect(doc.rotationRoster).toEqual(['u3', 'u1', 'u2'])
    expect(doc.rotationIndex).toBe(0)
    expect(doc.status).toBe('ready')
  })
})
