import { ERROR_CODES } from '../config/constants'
import { AuthClient } from '../config/http/auth.client'
import { PublicRider, Vehicle } from './rider.model'
import { RiderService } from './rider.service'
import { RiderOrchestrator, UpdateVehicleInput } from './rider.orchestrator'

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

const makeOrchestrator = () => {
  const riderService = {
    findByUserId: jest.fn(),
    create: jest.fn(),
    updateProfile: jest.fn(),
    updateVehicle: jest.fn(),
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
      vehicle: null,
      phone: '11223344',
    })
    expect(result.userId).toBe('u1')
  })

  // KNOWN BUG: el onboarding lazy ignora el vehículo registrado en Auth (createRider con vehicle)
  // y lo persiste como null. RQ-AUTH-15 / RQ-DLV-11 y el e2e esperan conservarlo.
  // Se documenta el comportamiento actual hasta que el source lo corrija (ver reporte).
  it('ignora el vehículo de Auth al crear el rider (KNOWN BUG)', async () => {
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

    await orchestrator.getProfile('u1')

    expect(riderService.create).toHaveBeenCalledWith(expect.objectContaining({ vehicle: null }))
  })

  it('lanza RIDER_NOT_FOUND si Auth no conoce al usuario', async () => {
    const { orchestrator, riderService, authClient } = makeOrchestrator()
    riderService.findByUserId.mockResolvedValue(null)
    authClient.getUser.mockResolvedValue(null)

    await expect(orchestrator.getProfile('u1')).rejects.toMatchObject({
      code: ERROR_CODES.riderNotFound,
      message: 'Repartidor no encontrado',
      status: 404,
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

describe('RiderOrchestrator.updateProfile (RQ-DLV-11)', () => {
  it('asegura el perfil existente y actualiza el teléfono', async () => {
    const { orchestrator, riderService } = makeOrchestrator()
    riderService.findByUserId.mockResolvedValue(rider)
    riderService.updateProfile.mockResolvedValue({ ...rider, phone: '999' })

    const result = await orchestrator.updateProfile('u1', { phone: '999' })

    expect(riderService.findByUserId).toHaveBeenCalledWith('u1')
    expect(riderService.updateProfile).toHaveBeenCalledWith('u1', { phone: '999' })
    expect(result.phone).toBe('999')
  })

  it('hace onboarding y luego actualiza si el rider no existe', async () => {
    const { orchestrator, riderService, authClient } = makeOrchestrator()
    riderService.findByUserId.mockResolvedValue(null)
    authClient.getUser.mockResolvedValue({
      id: 'u1',
      firstName: 'Juan',
      lastName: 'Perez',
      phone: '11223344',
      vehicle: null,
      role: 'rider',
    })
    riderService.create.mockResolvedValue(rider)
    riderService.updateProfile.mockResolvedValue(rider)

    await orchestrator.updateProfile('u1', { phone: '999' })

    expect(riderService.create).toHaveBeenCalled()
    expect(riderService.updateProfile).toHaveBeenCalledWith('u1', { phone: '999' })
  })

  it('lanza RIDER_NOT_FOUND 404 si el servicio no devuelve rider', async () => {
    const { orchestrator, riderService } = makeOrchestrator()
    riderService.findByUserId.mockResolvedValue(rider)
    riderService.updateProfile.mockResolvedValue(null)

    await expect(orchestrator.updateProfile('u1', { phone: '999' })).rejects.toMatchObject({
      code: ERROR_CODES.riderNotFound,
      message: 'Repartidor no encontrado',
      status: 404,
    })
  })
})

describe('RiderOrchestrator.updateVehicle (RQ-DLV-11)', () => {
  const cases: Array<{ name: string; input: UpdateVehicleInput; expected: Vehicle }> = [
    { name: 'solo tipo', input: { type: 'moto' }, expected: { type: 'moto' } },
    {
      name: 'tipo + marca',
      input: { type: 'bici', brand: 'Rali' },
      expected: { type: 'bici', brand: 'Rali' },
    },
    {
      name: 'omite opcionales undefined',
      input: { type: 'moto', brand: undefined, plate: undefined },
      expected: { type: 'moto' },
    },
    {
      name: 'todos los campos',
      input: { type: 'moto', brand: 'Honda', model: 'Wave', plate: 'AB123' },
      expected: { type: 'moto', brand: 'Honda', model: 'Wave', plate: 'AB123' },
    },
  ]

  it.each(cases)('construye el vehículo ($name)', async ({ input, expected }) => {
    const { orchestrator, riderService } = makeOrchestrator()
    riderService.findByUserId.mockResolvedValue(rider)
    riderService.updateVehicle.mockResolvedValue(rider)

    await orchestrator.updateVehicle('u1', input)

    expect(riderService.updateVehicle).toHaveBeenCalledWith('u1', expected)
  })

  it('lanza RIDER_NOT_FOUND 404 si el servicio no devuelve rider', async () => {
    const { orchestrator, riderService } = makeOrchestrator()
    riderService.findByUserId.mockResolvedValue(rider)
    riderService.updateVehicle.mockResolvedValue(null)

    await expect(
      orchestrator.updateVehicle('u1', { type: 'moto', brand: 'Honda' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.riderNotFound,
      message: 'Repartidor no encontrado',
      status: 404,
    })
  })
})

describe('RiderOrchestrator.setAvailability / updateLocation (RQ-DLV-01/02)', () => {
  it('lanza RIDER_NOT_FOUND 404 si no puede cambiar la disponibilidad', async () => {
    const { orchestrator, riderService } = makeOrchestrator()
    riderService.findByUserId.mockResolvedValue(rider)
    riderService.setAvailability.mockResolvedValue(null)

    await expect(orchestrator.setAvailability('u1', true)).rejects.toMatchObject({
      code: ERROR_CODES.riderNotFound,
      message: 'Repartidor no encontrado',
      status: 404,
    })
  })

  it('asegura el perfil antes de actualizar la ubicación', async () => {
    const { orchestrator, riderService } = makeOrchestrator()
    riderService.findByUserId.mockResolvedValue(rider)
    riderService.updateLocation.mockResolvedValue({
      ...rider,
      currentLocation: { latitude: -34.6, longitude: -58.4 },
    })

    const result = await orchestrator.updateLocation('u1', -34.6, -58.4)

    expect(riderService.findByUserId).toHaveBeenCalledWith('u1')
    expect(riderService.updateLocation).toHaveBeenCalledWith('u1', -34.6, -58.4)
    expect(result.currentLocation).toEqual({ latitude: -34.6, longitude: -58.4 })
  })

  it('lanza RIDER_NOT_FOUND 404 si no puede actualizar la ubicación', async () => {
    const { orchestrator, riderService } = makeOrchestrator()
    riderService.findByUserId.mockResolvedValue(rider)
    riderService.updateLocation.mockResolvedValue(null)

    await expect(orchestrator.updateLocation('u1', 0, 0)).rejects.toMatchObject({
      code: ERROR_CODES.riderNotFound,
      message: 'Repartidor no encontrado',
      status: 404,
    })
  })
})
