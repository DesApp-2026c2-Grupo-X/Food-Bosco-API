import { ERROR_CODES, ROLES } from '../config/constants'
import type { AuthContext } from '../config/security/jwt.service'
import type { PublicAddress } from './address.model'
import { AddressController } from './address.controller'
import { AddressService } from './address.service'
import type { CreateAddressDto } from './dto/create-address.dto'

const auth = (overrides: Partial<AuthContext> = {}): AuthContext => ({
  authenticated: true,
  userId: 'u1',
  roles: [ROLES.customer],
  branchId: null,
  ...overrides,
})

const publicAddress = (overrides: Partial<PublicAddress> = {}): PublicAddress => ({
  id: 'a1',
  label: 'Casa',
  text: 'Av. Siempre Viva 123',
  city: 'CABA',
  postalCode: '1000',
  latitude: -34.6,
  longitude: -58.4,
  active: true,
  ...overrides,
})

const createDto: CreateAddressDto = {
  label: 'Casa',
  text: 'Av. Siempre Viva 123',
  city: 'CABA',
  postalCode: '1000',
  latitude: -34.6,
  longitude: -58.4,
}

interface ServiceMock {
  listByUser: jest.Mock
  findOwned: jest.Mock
  create: jest.Mock
  update: jest.Mock
  remove: jest.Mock
}

const makeController = (overrides: Partial<ServiceMock> = {}) => {
  const service: ServiceMock = {
    listByUser: jest.fn().mockResolvedValue({ data: [] }),
    findOwned: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    ...overrides,
  }
  return { service, controller: new AddressController(service as unknown as AddressService) }
}

describe('AddressController.list (RQ-AUTH-19)', () => {
  it('lista solo las direcciones del usuario autenticado', async () => {
    const { service, controller } = makeController({
      listByUser: jest.fn().mockResolvedValue({ data: [publicAddress()] }),
    })

    const result = await controller.list(auth())

    expect(service.listByUser).toHaveBeenCalledWith('u1')
    expect(result.data).toHaveLength(1)
  })

  it('usa cadena vacía si el contexto no trae userId (aislamiento defensivo)', async () => {
    const { service, controller } = makeController()

    await controller.list(auth({ userId: null }))

    expect(service.listByUser).toHaveBeenCalledWith('')
  })
})

describe('AddressController.create (RQ-AUTH-20/22)', () => {
  it('crea la dirección para el usuario autenticado con el DTO recibido', async () => {
    const { service, controller } = makeController({
      create: jest.fn().mockResolvedValue(publicAddress()),
    })

    const result = await controller.create(auth(), createDto)

    expect(service.create).toHaveBeenCalledWith('u1', createDto)
    expect(result.id).toBe('a1')
  })
})

describe('AddressController.get (RQ-AUTH-20)', () => {
  it('devuelve la dirección propia cuando existe', async () => {
    const { service, controller } = makeController({
      findOwned: jest.fn().mockResolvedValue(publicAddress()),
    })

    const result = await controller.get(auth(), 'a1')

    expect(service.findOwned).toHaveBeenCalledWith('a1', 'u1')
    expect(result.id).toBe('a1')
  })

  it.each([
    { name: 'dirección inexistente', userId: 'u1' },
    { name: 'dirección de otro cliente', userId: 'otro' },
  ])('lanza ADDRESS_NOT_FOUND 404: $name', async ({ userId }) => {
    const { controller } = makeController({ findOwned: jest.fn().mockResolvedValue(null) })

    await expect(controller.get(auth({ userId }), 'a1')).rejects.toMatchObject({
      code: ERROR_CODES.addressNotFound,
      message: 'Dirección no encontrada',
      status: 404,
    })
  })
})

describe('AddressController.update (RQ-AUTH-20)', () => {
  it('actualiza la dirección propia y pasa userId como alcance', async () => {
    const { service, controller } = makeController({
      update: jest.fn().mockResolvedValue(publicAddress({ label: 'Trabajo' })),
    })

    const result = await controller.update(auth(), 'a1', { label: 'Trabajo' })

    expect(service.update).toHaveBeenCalledWith('a1', 'u1', { label: 'Trabajo' })
    expect(result.label).toBe('Trabajo')
  })

  it.each([
    { name: 'dirección inexistente', userId: 'u1' },
    { name: 'dirección de otro cliente', userId: 'otro' },
  ])('lanza ADDRESS_NOT_FOUND 404: $name', async ({ userId }) => {
    const { controller } = makeController({ update: jest.fn().mockResolvedValue(null) })

    await expect(controller.update(auth({ userId }), 'a1', { label: 'X' })).rejects.toMatchObject({
      code: ERROR_CODES.addressNotFound,
      message: 'Dirección no encontrada',
      status: 404,
    })
  })
})

describe('AddressController.remove (RQ-AUTH-21)', () => {
  it('desactiva la dirección propia y devuelve { ok: true }', async () => {
    const { service, controller } = makeController({
      remove: jest.fn().mockResolvedValue(true),
    })

    await expect(controller.remove(auth(), 'a1')).resolves.toEqual({ ok: true })
    expect(service.remove).toHaveBeenCalledWith('a1', 'u1')
  })

  it.each([
    { name: 'dirección inexistente', userId: 'u1' },
    { name: 'dirección de otro cliente', userId: 'otro' },
    { name: 'dirección ya desactivada', userId: 'u1' },
  ])('lanza ADDRESS_NOT_FOUND 404: $name', async ({ userId }) => {
    const { controller } = makeController({ remove: jest.fn().mockResolvedValue(false) })

    await expect(controller.remove(auth({ userId }), 'a1')).rejects.toMatchObject({
      code: ERROR_CODES.addressNotFound,
      message: 'Dirección no encontrada',
      status: 404,
    })
  })
})
