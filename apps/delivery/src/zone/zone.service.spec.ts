import { Zone, ZoneDocument } from './zone.model'
import { ZoneRepository } from './zone.repository'
import { ZoneService } from './zone.service'

const buildDoc = (overrides: Partial<Zone> = {}): ZoneDocument =>
  ({
    _id: { toString: () => 'z1' },
    name: 'Centro',
    center: { latitude: -34.589, longitude: -58.636 },
    radiusKm: 4,
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as unknown as ZoneDocument

describe('ZoneService', () => {
  it('list serializa todas las zonas', async () => {
    const repository = { findAll: jest.fn().mockResolvedValue([buildDoc()]) }
    const service = new ZoneService(repository as unknown as ZoneRepository)

    const result = await service.list()

    expect(result).toEqual([
      {
        id: 'z1',
        name: 'Centro',
        center: { latitude: -34.589, longitude: -58.636 },
        radiusKm: 4,
        active: true,
      },
    ])
  })

  it('findByName devuelve null cuando no existe', async () => {
    const repository = { findByName: jest.fn().mockResolvedValue(null) }
    const service = new ZoneService(repository as unknown as ZoneRepository)

    await expect(service.findByName('Inexistente')).resolves.toBeNull()
  })

  it('create delega al repositorio y serializa', async () => {
    const repository = { create: jest.fn().mockResolvedValue(buildDoc()) }
    const service = new ZoneService(repository as unknown as ZoneRepository)

    const data = {
      name: 'Centro',
      center: { latitude: -34.589, longitude: -58.636 },
      radiusKm: 4,
    }
    const result = await service.create(data)

    expect(repository.create).toHaveBeenCalledWith(data)
    expect(result.id).toBe('z1')
    expect(result.active).toBe(true)
  })

  it('upsertByName delega al repositorio con la clave natural', async () => {
    const repository = { upsertByName: jest.fn().mockResolvedValue(buildDoc()) }
    const service = new ZoneService(repository as unknown as ZoneRepository)

    const data = { name: 'Centro', center: { latitude: -34.589, longitude: -58.636 }, radiusKm: 4 }
    const result = await service.upsertByName('Centro', data)

    expect(repository.upsertByName).toHaveBeenCalledWith('Centro', data)
    expect(result?.name).toBe('Centro')
  })

  it('setActive actualiza y serializa', async () => {
    const repository = { setActive: jest.fn().mockResolvedValue(buildDoc({ active: false })) }
    const service = new ZoneService(repository as unknown as ZoneRepository)

    const result = await service.setActive('z1', false)

    expect(repository.setActive).toHaveBeenCalledWith('z1', false)
    expect(result?.active).toBe(false)
  })

  it('listActive usa findActive y devuelve null ante doc nulo', async () => {
    const repository = {
      findActive: jest.fn().mockResolvedValue([buildDoc()]),
      findById: jest.fn().mockResolvedValue(null),
    }
    const service = new ZoneService(repository as unknown as ZoneRepository)

    const active = await service.listActive()
    expect(active).toHaveLength(1)

    await expect(service.findById('missing')).resolves.toBeNull()
  })
})
