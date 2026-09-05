import { Shift, ShiftDocument } from './shift.model'
import { ShiftRepository } from './shift.repository'
import { ShiftService } from './shift.service'

const buildDoc = (overrides: Partial<Shift> = {}): ShiftDocument =>
  ({
    _id: { toString: () => 's1' },
    name: 'Mañana',
    startTime: '08:00',
    endTime: '13:00',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as unknown as ShiftDocument

describe('ShiftService', () => {
  it('list serializa todos los turnos', async () => {
    const repository = { findAll: jest.fn().mockResolvedValue([buildDoc()]) }
    const service = new ShiftService(repository as unknown as ShiftRepository)

    const result = await service.list()

    expect(result).toEqual([
      { id: 's1', name: 'Mañana', startTime: '08:00', endTime: '13:00', active: true },
    ])
  })

  it('findByName devuelve null cuando no existe', async () => {
    const repository = { findByName: jest.fn().mockResolvedValue(null) }
    const service = new ShiftService(repository as unknown as ShiftRepository)

    await expect(service.findByName('Inexistente')).resolves.toBeNull()
  })

  it('create delega al repositorio y serializa', async () => {
    const repository = { create: jest.fn().mockResolvedValue(buildDoc()) }
    const service = new ShiftService(repository as unknown as ShiftRepository)

    const data = { name: 'Mañana', startTime: '08:00', endTime: '13:00' }
    const result = await service.create(data)

    expect(repository.create).toHaveBeenCalledWith(data)
    expect(result.id).toBe('s1')
  })

  it('upsertByName delega al repositorio con la clave natural', async () => {
    const repository = { upsertByName: jest.fn().mockResolvedValue(buildDoc()) }
    const service = new ShiftService(repository as unknown as ShiftRepository)

    const data = { name: 'Mañana', startTime: '08:00', endTime: '13:00' }
    const result = await service.upsertByName('Mañana', data)

    expect(repository.upsertByName).toHaveBeenCalledWith('Mañana', data)
    expect(result?.name).toBe('Mañana')
  })

  it('setActive actualiza y serializa', async () => {
    const repository = { setActive: jest.fn().mockResolvedValue(buildDoc({ active: false })) }
    const service = new ShiftService(repository as unknown as ShiftRepository)

    const result = await service.setActive('s1', false)

    expect(repository.setActive).toHaveBeenCalledWith('s1', false)
    expect(result?.active).toBe(false)
  })
})
