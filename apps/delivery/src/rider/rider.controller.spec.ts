import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { ROLES_KEY } from '../config/security/roles.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import type { PublicRider } from './rider.model'
import { RiderController } from './rider.controller'
import { RiderOrchestrator } from './rider.orchestrator'

const auth: AuthContext = { authenticated: true, userId: 'u1', roles: ['rider'], branchId: null }

const rider: PublicRider = {
  id: 'r1',
  userId: 'u1',
  firstName: 'Juan',
  lastName: 'Perez',
  vehicle: { type: 'moto', brand: 'Honda' },
  phone: '11223344',
  available: false,
  status: 'offline',
  currentLocation: null,
  lastSeenAt: null,
}

const makeController = () => {
  const orchestrator = {
    getProfile: jest.fn().mockResolvedValue(rider),
    updateProfile: jest.fn().mockResolvedValue(rider),
    updateVehicle: jest.fn().mockResolvedValue(rider),
    setAvailability: jest.fn().mockResolvedValue(rider),
    updateLocation: jest.fn().mockResolvedValue(rider),
  }
  const controller = new RiderController(orchestrator as unknown as RiderOrchestrator)
  return { controller, orchestrator }
}

describe('RiderController — acceso (RQ-SEC-04)', () => {
  it('exige el rol rider a nivel de controlador', () => {
    expect(Reflect.getMetadata(ROLES_KEY, RiderController)).toEqual([ROLES.rider])
  })
})

describe('RiderController.get (RQ-DLV-11)', () => {
  it('delega el perfil con el userId autenticado', async () => {
    const { controller, orchestrator } = makeController()

    await controller.get(auth)

    expect(orchestrator.getProfile).toHaveBeenCalledWith('u1')
  })

  it('usa cadena vacía cuando no hay userId', async () => {
    const { controller, orchestrator } = makeController()

    await controller.get({ ...auth, userId: null })

    expect(orchestrator.getProfile).toHaveBeenCalledWith('')
  })

  it('propaga el error de dominio con código, mensaje y status', async () => {
    const { controller, orchestrator } = makeController()
    orchestrator.getProfile.mockRejectedValue(
      new DomainException(ERROR_CODES.riderNotFound, 'Repartidor no encontrado', 404),
    )

    await expect(controller.get(auth)).rejects.toMatchObject({
      code: ERROR_CODES.riderNotFound,
      message: 'Repartidor no encontrado',
      status: 404,
    })
  })
})

describe('RiderController.update / updateVehicle (RQ-DLV-11)', () => {
  it('delega el perfil y el body al orchestrator', async () => {
    const { controller, orchestrator } = makeController()

    await controller.update(auth, { phone: '999' })

    expect(orchestrator.updateProfile).toHaveBeenCalledWith('u1', { phone: '999' })
  })

  it('delega el vehículo al orchestrator', async () => {
    const { controller, orchestrator } = makeController()

    await controller.updateVehicle(auth, { type: 'bici', brand: 'Rali' })

    expect(orchestrator.updateVehicle).toHaveBeenCalledWith('u1', { type: 'bici', brand: 'Rali' })
  })

  it('propaga el error de dominio al actualizar', async () => {
    const { controller, orchestrator } = makeController()
    orchestrator.updateProfile.mockRejectedValue(
      new DomainException(ERROR_CODES.riderNotFound, 'Repartidor no encontrado', 404),
    )

    await expect(controller.update(auth, { phone: '999' })).rejects.toMatchObject({
      code: ERROR_CODES.riderNotFound,
      message: 'Repartidor no encontrado',
      status: 404,
    })
  })
})

describe('RiderController.setAvailability (RQ-DLV-01)', () => {
  it.each([
    { name: 'online', online: true },
    { name: 'offline', online: false },
  ])('delega availability=$online ($name)', async ({ online }) => {
    const { controller, orchestrator } = makeController()

    await controller.setAvailability(auth, { online })

    expect(orchestrator.setAvailability).toHaveBeenCalledWith('u1', online)
  })

  it('propaga el error de dominio de disponibilidad', async () => {
    const { controller, orchestrator } = makeController()
    orchestrator.setAvailability.mockRejectedValue(
      new DomainException(ERROR_CODES.riderNotFound, 'Repartidor no encontrado', 404),
    )

    await expect(controller.setAvailability(auth, { online: true })).rejects.toMatchObject({
      code: ERROR_CODES.riderNotFound,
      status: 404,
    })
  })
})

describe('RiderController.updateLocation (RQ-DLV-02)', () => {
  it.each([
    { name: 'Buenos Aires', lat: -34.6, lng: -58.4 },
    { name: 'origen', lat: 0, lng: 0 },
    { name: 'límites', lat: 90, lng: 180 },
  ])('delega lat/lng del body ($name)', async ({ lat, lng }) => {
    const { controller, orchestrator } = makeController()

    await controller.updateLocation(auth, { lat, lng })

    expect(orchestrator.updateLocation).toHaveBeenCalledWith('u1', lat, lng)
  })
})
