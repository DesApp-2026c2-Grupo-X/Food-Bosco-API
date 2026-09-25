import { AddressDocument } from './address.model'
import { AddressRepository } from './address.repository'
import { AddressService } from './address.service'

const buildDoc = (overrides: Record<string, unknown> = {}): AddressDocument =>
  ({
    _id: { toString: () => 'a1' },
    userId: 'u1',
    label: 'Casa',
    text: 'Av. Siempre Viva 123',
    city: 'CABA',
    postalCode: '1000',
    latitude: -34.6,
    longitude: -58.4,
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as unknown as AddressDocument

const dto = {
  label: 'Casa',
  text: 'Av. Siempre Viva 123',
  city: 'CABA',
  postalCode: '1000',
  latitude: -34.6,
  longitude: -58.4,
}

interface RepositoryMock {
  listByUser: jest.Mock
  findOwnedById: jest.Mock
  create: jest.Mock
  updateOwned: jest.Mock
  softDeleteOwned: jest.Mock
}

const makeService = (overrides: Partial<RepositoryMock> = {}) => {
  const repository: RepositoryMock = {
    listByUser: jest.fn(),
    findOwnedById: jest.fn(),
    create: jest.fn(),
    updateOwned: jest.fn(),
    softDeleteOwned: jest.fn(),
    ...overrides,
  }
  return { repository, service: new AddressService(repository as unknown as AddressRepository) }
}

describe('AddressService.listByUser (RQ-AUTH-19)', () => {
  it('lista las direcciones activas del usuario y las serializa', async () => {
    const { repository, service } = makeService()
    repository.listByUser.mockResolvedValue([buildDoc()])

    const result = await service.listByUser('u1')

    expect(repository.listByUser).toHaveBeenCalledWith('u1')
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('a1')
    expect(result.data[0].label).toBe('Casa')
  })

  it('devuelve una lista vacía cuando el usuario no tiene direcciones', async () => {
    const { repository, service } = makeService()
    repository.listByUser.mockResolvedValue([])

    await expect(service.listByUser('u1')).resolves.toEqual({ data: [] })
  })

  it('nunca expone el userId en el resultado serializado', async () => {
    const { repository, service } = makeService()
    repository.listByUser.mockResolvedValue([buildDoc({ userId: 'u1' })])

    const result = await service.listByUser('u1')

    expect((result.data[0] as unknown as Record<string, unknown>).userId).toBeUndefined()
  })
})

describe('AddressService.create (RQ-AUTH-20/22)', () => {
  it('crea una dirección asociada al usuario autenticado', async () => {
    const { repository, service } = makeService()
    repository.create.mockResolvedValue(buildDoc())

    const result = await service.create('u1', dto)

    expect(repository.create).toHaveBeenCalledWith('u1', dto)
    expect(result.id).toBe('a1')
    expect(result.label).toBe('Casa')
  })

  it.each([
    { name: 'sin ciudad ni código postal', patch: { city: undefined, postalCode: undefined } },
    { name: 'con ciudad y código postal', patch: { city: 'Córdoba', postalCode: '5000' } },
  ])('serializa campos opcionales: $name', async ({ patch }) => {
    const { repository, service } = makeService()
    repository.create.mockResolvedValue(buildDoc(patch))

    const result = await service.create('u1', { ...dto, ...patch })

    expect(result.city).toBe(patch.city ?? null)
    expect(result.postalCode).toBe(patch.postalCode ?? null)
  })
})

describe('AddressService.findOwned (RQ-AUTH-20: aislamiento entre clientes)', () => {
  it('busca por id y userId (nunca solo por id)', async () => {
    const { repository, service } = makeService()
    repository.findOwnedById.mockResolvedValue(buildDoc())

    const result = await service.findOwned('a1', 'u1')

    expect(repository.findOwnedById).toHaveBeenCalledWith('a1', 'u1')
    expect(result?.id).toBe('a1')
  })

  it.each([
    { name: 'dirección inexistente', userId: 'u1', doc: null },
    { name: 'dirección de otro cliente', userId: 'otro', doc: null },
    { name: 'dirección desactivada (filtro active del repositorio)', userId: 'u1', doc: null },
  ])('devuelve null: $name', async ({ userId, doc }) => {
    const { repository, service } = makeService()
    repository.findOwnedById.mockResolvedValue(doc)

    await expect(service.findOwned('a1', userId)).resolves.toBeNull()
  })
})

describe('AddressService.update (RQ-AUTH-20)', () => {
  it.each<{ name: string; patch: Record<string, unknown> }>([
    { name: 'label', patch: { label: 'Trabajo' } },
    { name: 'text', patch: { text: 'Otra calle 456' } },
    { name: 'coordenadas', patch: { latitude: 10, longitude: 20 } },
    { name: 'varios campos', patch: { label: 'Casa 2', city: 'Rosario', postalCode: '2000' } },
  ])('actualiza campos permitidos: $name', async ({ patch }) => {
    const { repository, service } = makeService()
    repository.updateOwned.mockResolvedValue(buildDoc(patch))

    const result = await service.update('a1', 'u1', patch)

    expect(repository.updateOwned).toHaveBeenCalledWith('a1', 'u1', patch)
    expect(result).toMatchObject(patch)
  })

  it.each([
    { name: 'dirección inexistente', userId: 'u1' },
    { name: 'dirección de otro cliente', userId: 'otro' },
  ])('devuelve null al intentar actualizar: $name', async ({ userId }) => {
    const { repository, service } = makeService()
    repository.updateOwned.mockResolvedValue(null)

    await expect(service.update('a1', userId, { label: 'X' })).resolves.toBeNull()
  })
})

describe('AddressService.remove (RQ-AUTH-21: desactivación, no borrado físico)', () => {
  it('desactiva una dirección propia y devuelve true', async () => {
    const { repository, service } = makeService()
    repository.softDeleteOwned.mockResolvedValue(true)

    const result = await service.remove('a1', 'u1')

    expect(repository.softDeleteOwned).toHaveBeenCalledWith('a1', 'u1')
    expect(result).toBe(true)
  })

  it.each([
    { name: 'dirección ajena', userId: 'otro', result: false },
    { name: 'dirección inexistente', userId: 'u1', result: false },
    { name: 'dirección ya desactivada', userId: 'u1', result: false },
  ])('devuelve false al eliminar: $name', async ({ userId, result }) => {
    const { repository, service } = makeService()
    repository.softDeleteOwned.mockResolvedValue(result)

    await expect(service.remove('a1', userId)).resolves.toBe(false)
  })
})
