import { ERROR_CODES } from '../config/constants'
import { AuthClient } from '../config/http/auth.client'
import { PublicRider } from './rider.model'
import { RiderService } from './rider.service'
import { RiderOrchestrator } from './rider.orchestrator'

const rider: PublicRider = {
  id: 'r1',
  userId: 'u1',
  firstName: 'Juan',
  lastName: 'Perez',
  vehicle: 'Moto',
  phone: '11223344',
  available: false,
  status: 'offline',
  currentLocation: null,
}

const makeOrchestrator = () => {
  const riderService = {
    findByUserId: jest.fn(),
    create: jest.fn(),
    updateProfile: jest.fn(),
    setAvailability: jest.fn(),
    updateLocation: jest.fn(),
    setStatus: jest.fn(),
  }
  const authClient = { getUser: jest.fn() }
  const orchestrator = new RiderOrchestrator(
    riderService as unknown as RiderService,
    authClient as unknown as AuthClient,
  )

  return { orchestrator, riderService, authClient }
}

describe('RiderOrchestrator.getProfile (onboarding, RQ-DLV-11)', () => {
  it('devuelve el perfil existente sin llamar a Auth', async () => {
    const { orchestrator, riderService, authClient } = makeOrchestrator()
    riderService.findByUserId.mockResolvedValue(rider)

    const result = await orchestrator.getProfile('u1')

    expect(result.id).toBe('r1')
    expect(authClient.getUser).not.toHaveBeenCalled()
    expect(riderService.create).not.toHaveBeenCalled()
  })

  it('crea el rider desde Auth cuando no existe (snapshot)', async () => {
    const { orchestrator, riderService, authClient } = makeOrchestrator()
    riderService.findByUserId.mockResolvedValue(null)
    authClient.getUser.mockResolvedValue({
      id: 'u1',
      firstName: 'Juan',
      lastName: 'Perez',
      phone: '11223344',
      vehicle: 'Moto',
      role: 'rider',
    })
    riderService.create.mockResolvedValue(rider)

    const result = await orchestrator.getProfile('u1')

    expect(authClient.getUser).toHaveBeenCalledWith('u1')
    expect(riderService.create).toHaveBeenCalledWith({
      userId: 'u1',
      firstName: 'Juan',
      lastName: 'Perez',
      vehicle: 'Moto',
      phone: '11223344',
    })
    expect(result.userId).toBe('u1')
  })

  it('lanza RIDER_NOT_FOUND si Auth no conoce al usuario', async () => {
    const { orchestrator, riderService, authClient } = makeOrchestrator()
    riderService.findByUserId.mockResolvedValue(null)
    authClient.getUser.mockResolvedValue(null)

    await expect(orchestrator.getProfile('u1')).rejects.toMatchObject({
      code: ERROR_CODES.riderNotFound,
    })
    expect(riderService.create).not.toHaveBeenCalled()
  })
})

describe('RiderOrchestrator.setAvailability / updateLocation', () => {
  it('asegura el perfil antes de cambiar disponibilidad', async () => {
    const { orchestrator, riderService, authClient } = makeOrchestrator()
    riderService.findByUserId.mockResolvedValue(null)
    authClient.getUser.mockResolvedValue({
      id: 'u1',
      firstName: 'J',
      lastName: 'P',
      phone: '1',
      vehicle: null,
      role: 'rider',
    })
    riderService.create.mockResolvedValue(rider)
    riderService.setAvailability.mockResolvedValue({ ...rider, available: true, status: 'free' })

    const result = await orchestrator.setAvailability('u1', true)

    expect(riderService.setAvailability).toHaveBeenCalledWith('u1', true)
    expect(result.available).toBe(true)
  })

  it('setStatus delega en el servicio primario', async () => {
    const { orchestrator, riderService } = makeOrchestrator()

    await orchestrator.setStatus('u1', 'on_trip')

    expect(riderService.setStatus).toHaveBeenCalledWith('u1', 'on_trip')
  })
})
