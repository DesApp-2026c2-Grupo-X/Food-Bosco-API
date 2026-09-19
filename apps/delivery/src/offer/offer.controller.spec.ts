import 'reflect-metadata'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { ROLES_KEY } from '../config/security/roles.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import type { PublicTrip } from '../trip/trip.model'
import { TripService } from '../trip/trip.service'
import { OfferController } from './offer.controller'
import { OfferOrchestrator } from './offer.orchestrator'

const auth: AuthContext = {
  authenticated: true,
  userId: 'u1',
  roles: [ROLES.rider],
  branchId: null,
}

const trip: PublicTrip = {
  id: 't1',
  riderId: 'u1',
  status: 'active',
  orders: [],
  distanceKm: 5,
  estimatedMinutes: 12,
  estimatedEarnings: 1500,
  earnings: null,
  startedAt: null,
  completedAt: null,
  expiresAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const makeController = () => {
  const orchestrator = {
    listOffers: jest.fn(),
    acceptOffer: jest.fn(),
    rejectOffer: jest.fn(),
    markPickup: jest.fn(),
    markDeliver: jest.fn(),
  }
  const tripService = {
    listByRider: jest.fn(),
    findByIdForRider: jest.fn(),
  }
  const controller = new OfferController(
    orchestrator as unknown as OfferOrchestrator,
    tripService as unknown as TripService,
  )
  return { controller, orchestrator, tripService }
}

describe('OfferController (RQ-DLV-13)', () => {
  it('declara el rol rider a nivel de controlador', () => {
    expect(Reflect.getMetadata(ROLES_KEY, OfferController)).toEqual([ROLES.rider])
  })

  it('listOffers delega el userId autenticado en el orchestrator', async () => {
    const { controller, orchestrator } = makeController()
    orchestrator.listOffers.mockResolvedValue({ data: [] })

    await controller.listOffers(auth)

    expect(orchestrator.listOffers).toHaveBeenCalledWith('u1')
  })

  it('usa cadena vacía cuando no hay userId (contexto anónimo)', async () => {
    const { controller, orchestrator } = makeController()
    orchestrator.listOffers.mockResolvedValue({ data: [] })

    await controller.listOffers({ ...auth, userId: null })

    expect(orchestrator.listOffers).toHaveBeenCalledWith('')
  })

  it('accept delega oferta y rider al orchestrator', async () => {
    const { controller, orchestrator } = makeController()
    orchestrator.acceptOffer.mockResolvedValue(trip)

    const result = await controller.accept(auth, 't1')

    expect(orchestrator.acceptOffer).toHaveBeenCalledWith('u1', 't1')
    expect(result).toBe(trip)
  })

  it('reject delega y responde { ok: true }', async () => {
    const { controller, orchestrator } = makeController()
    orchestrator.rejectOffer.mockResolvedValue(undefined)

    const result = await controller.reject(auth, 't1')

    expect(orchestrator.rejectOffer).toHaveBeenCalledWith('u1', 't1')
    expect(result).toEqual({ ok: true })
  })

  it('pickup y deliver delegan tripId y orderId', async () => {
    const { controller, orchestrator } = makeController()
    orchestrator.markPickup.mockResolvedValue(trip)
    orchestrator.markDeliver.mockResolvedValue(trip)

    await controller.pickup(auth, 't1', 'ord-1')
    await controller.deliver(auth, 't1', 'ord-1')

    expect(orchestrator.markPickup).toHaveBeenCalledWith('u1', 't1', 'ord-1')
    expect(orchestrator.markDeliver).toHaveBeenCalledWith('u1', 't1', 'ord-1')
  })

  it('list aplica los valores por defecto de paginación (limit 20, offset 0)', async () => {
    const { controller, tripService } = makeController()
    tripService.listByRider.mockResolvedValue({ data: [], meta: { total: 0, limit: 20, offset: 0 } })

    await controller.list(auth, {})

    expect(tripService.listByRider).toHaveBeenCalledWith('u1', 20, 0)
  })

  it('list respeta limit y offset provistos', async () => {
    const { controller, tripService } = makeController()
    tripService.listByRider.mockResolvedValue({ data: [], meta: { total: 0, limit: 5, offset: 10 } })

    await controller.list(auth, { limit: 5, offset: 10 })

    expect(tripService.listByRider).toHaveBeenCalledWith('u1', 5, 10)
  })

  it('get devuelve el viaje del repartidor', async () => {
    const { controller, tripService } = makeController()
    tripService.findByIdForRider.mockResolvedValue(trip)

    const result = await controller.get(auth, 't1')

    expect(tripService.findByIdForRider).toHaveBeenCalledWith('t1', 'u1')
    expect(result).toBe(trip)
  })

  it('get lanza TRIP_NOT_FOUND con mensaje y status cuando el viaje no es del rider', async () => {
    const { controller, tripService } = makeController()
    tripService.findByIdForRider.mockResolvedValue(null)

    try {
      await controller.get(auth, 't1')
      throw new Error('Se esperaba DomainException')
    } catch (error) {
      const domainError = error as DomainException
      expect(domainError.code).toBe(ERROR_CODES.tripNotFound)
      expect(domainError.message).toBe('Viaje no encontrado')
      expect(domainError.getStatus()).toBe(404)
    }
  })

  it.each([
    { method: 'acceptOffer' as const, code: ERROR_CODES.offerNotFound, message: 'Oferta no encontrada', status: 404 },
    { method: 'rejectOffer' as const, code: ERROR_CODES.offerExpired, message: 'La oferta venció', status: 409 },
    { method: 'markPickup' as const, code: ERROR_CODES.tripNotFound, message: 'Viaje no encontrado', status: 404 },
    { method: 'markDeliver' as const, code: ERROR_CODES.orderNotInTrip, message: 'La orden no pertenece al viaje', status: 404 },
  ])('propaga el error de dominio de $method (código + mensaje + status)', async ({ method, code, message, status }) => {
    const { controller, orchestrator } = makeController()
    const failure = new DomainException(code, message, status)
    orchestrator[method].mockRejectedValue(failure)

    const invocation =
      method === 'acceptOffer'
        ? controller.accept(auth, 't1')
        : method === 'rejectOffer'
          ? controller.reject(auth, 't1')
          : method === 'markPickup'
            ? controller.pickup(auth, 't1', 'ord-1')
            : controller.deliver(auth, 't1', 'ord-1')

    await expect(invocation).rejects.toMatchObject({ code, message, status })
  })
})
