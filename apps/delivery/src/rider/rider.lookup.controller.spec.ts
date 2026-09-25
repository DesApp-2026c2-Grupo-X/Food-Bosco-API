import { NotFoundException } from '@nestjs/common'
import { INTERNAL_KEY } from '../config/security/internal.decorator'
import type { PublicRider } from './rider.model'
import { RiderLookupController } from './rider.lookup.controller'
import { RiderService } from './rider.service'

const rider: PublicRider = {
  id: 'r1',
  userId: 'u1',
  firstName: 'Juan',
  lastName: 'Perez',
  vehicle: null,
  phone: '11223344',
  available: false,
  status: 'offline',
  currentLocation: null,
  lastSeenAt: null,
}

const makeController = () => {
  const service = { findByUserId: jest.fn() }
  const controller = new RiderLookupController(service as unknown as RiderService)
  return { controller, service }
}

const captureError = async (promise: Promise<unknown>): Promise<unknown> => {
  let captured: unknown = null
  await promise.catch((error: unknown) => {
    captured = error
  })
  return captured
}

describe('RiderLookupController — acceso interno (RQ-SEC-04)', () => {
  it('marca byUserId como endpoint interno', () => {
    expect(Reflect.getMetadata(INTERNAL_KEY, RiderLookupController.prototype.byUserId)).toBe(true)
  })
})

describe('RiderLookupController.byUserId (RQ-DLV-13)', () => {
  it('devuelve el rider y consulta por userId', async () => {
    const { controller, service } = makeController()
    service.findByUserId.mockResolvedValue(rider)

    const result = await controller.byUserId('u1')

    expect(service.findByUserId).toHaveBeenCalledWith('u1')
    expect(result).toEqual(rider)
  })

  it.each([
    { name: 'usuario inexistente', userId: 'nope' },
    { name: 'userId vacío', userId: '' },
  ])('lanza 404 con mensaje si no existe ($name)', async ({ userId }) => {
    const { controller, service } = makeController()
    service.findByUserId.mockResolvedValue(null)

    const error = await captureError(controller.byUserId(userId))

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).getStatus()).toBe(404)
    expect((error as NotFoundException).message).toBe('Repartidor no encontrado')
    expect(service.findByUserId).toHaveBeenCalledWith(userId)
  })
})
