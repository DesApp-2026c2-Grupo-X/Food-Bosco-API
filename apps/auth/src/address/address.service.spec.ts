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

describe('AddressService (RQ-AUTH-19/20/21/22)', () => {
  it('lista las direcciones activas del usuario', async () => {
    const repository = { listByUser: jest.fn().mockResolvedValue([buildDoc()]) }
    const service = new AddressService(repository as unknown as AddressRepository)

    const result = await service.listByUser('u1')

    expect(repository.listByUser).toHaveBeenCalledWith('u1')
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('a1')
    expect(result.data[0].label).toBe('Casa')
  })

  it('crea una dirección propia', async () => {
    const repository = { create: jest.fn().mockResolvedValue(buildDoc()) }
    const service = new AddressService(repository as unknown as AddressRepository)

    const result = await service.create('u1', dto)

    expect(repository.create).toHaveBeenCalledWith('u1', dto)
    expect(result.id).toBe('a1')
  })

  it('encuentra solo una dirección propia (aislamiento entre clientes)', async () => {
    const repository = { findOwnedById: jest.fn().mockResolvedValue(buildDoc()) }
    const service = new AddressService(repository as unknown as AddressRepository)

    const result = await service.findOwned('a1', 'u1')

    expect(repository.findOwnedById).toHaveBeenCalledWith('a1', 'u1')
    expect(result?.id).toBe('a1')
  })

  it('devuelve null si la dirección no pertenece al usuario', async () => {
    const repository = { findOwnedById: jest.fn().mockResolvedValue(null) }
    const service = new AddressService(repository as unknown as AddressRepository)

    await expect(service.findOwned('a1', 'otro')).resolves.toBeNull()
  })

  it('actualiza una dirección propia', async () => {
    const repository = { updateOwned: jest.fn().mockResolvedValue(buildDoc({ label: 'Trabajo' })) }
    const service = new AddressService(repository as unknown as AddressRepository)

    const result = await service.update('a1', 'u1', { label: 'Trabajo' })

    expect(repository.updateOwned).toHaveBeenCalledWith('a1', 'u1', { label: 'Trabajo' })
    expect(result?.label).toBe('Trabajo')
  })

  it('elimina (desactiva) una dirección propia', async () => {
    const repository = { softDeleteOwned: jest.fn().mockResolvedValue(true) }
    const service = new AddressService(repository as unknown as AddressRepository)

    const result = await service.remove('a1', 'u1')

    expect(repository.softDeleteOwned).toHaveBeenCalledWith('a1', 'u1')
    expect(result).toBe(true)
  })

  it('devuelve false al eliminar una dirección ajena', async () => {
    const repository = { softDeleteOwned: jest.fn().mockResolvedValue(false) }
    const service = new AddressService(repository as unknown as AddressRepository)

    await expect(service.remove('a1', 'otro')).resolves.toBe(false)
  })
})
