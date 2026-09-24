import type { OrderStateDocument } from './order-state.model'
import type { UpdateOrderStateData } from './order-state.repository'
import { OrderStateRepository } from './order-state.repository'
import { OrderStateService } from './order-state.service'

const orderStateDoc = (
  overrides: Partial<{ code: string; name: string; order: number; active: boolean }> = {},
): OrderStateDocument =>
  ({
    code: 'PENDING',
    name: 'Pendiente',
    order: 1,
    active: true,
    ...overrides,
  }) as unknown as OrderStateDocument

const makeService = (overrides: Partial<Record<string, jest.Mock>> = {}) => {
  const repository = {
    findAll: jest.fn().mockResolvedValue([]),
    findByCode: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    ...overrides,
  }
  return {
    repository,
    service: new OrderStateService(repository as unknown as OrderStateRepository),
  }
}

describe('OrderStateService.list (RQ-CFG-05)', () => {
  it('serializa los estados respetando el orden del repositorio', async () => {
    const { service } = makeService({
      findAll: jest
        .fn()
        .mockResolvedValue([
          orderStateDoc({ code: 'PENDING', name: 'Pendiente', order: 1 }),
          orderStateDoc({ code: 'CONFIRMED', name: 'Confirmado', order: 2 }),
        ]),
    })

    const result = await service.list()

    expect(result).toEqual([
      { code: 'PENDING', name: 'Pendiente', order: 1, active: true },
      { code: 'CONFIRMED', name: 'Confirmado', order: 2, active: true },
    ])
  })

  it('devuelve lista vacía cuando no hay estados', async () => {
    const { service } = makeService({ findAll: jest.fn().mockResolvedValue([]) })

    await expect(service.list()).resolves.toEqual([])
  })
})

describe('OrderStateService.findByCode (RQ-CFG-05)', () => {
  it('devuelve el estado serializado cuando existe', async () => {
    const { repository, service } = makeService({
      findByCode: jest.fn().mockResolvedValue(orderStateDoc({ code: 'PENDING' })),
    })

    const result = await service.findByCode('PENDING')

    expect(repository.findByCode).toHaveBeenCalledWith('PENDING')
    expect(result).toEqual({ code: 'PENDING', name: 'Pendiente', order: 1, active: true })
  })

  it('devuelve null cuando el estado no existe', async () => {
    const { service } = makeService({ findByCode: jest.fn().mockResolvedValue(null) })

    await expect(service.findByCode('MISSING')).resolves.toBeNull()
  })
})

describe('OrderStateService.create (RQ-CFG-05/06)', () => {
  it('delega los datos y serializa el estado creado activo', async () => {
    const { repository, service } = makeService({
      create: jest
        .fn()
        .mockResolvedValue(orderStateDoc({ code: 'PREPARING', name: 'Preparando', order: 3 })),
    })

    const result = await service.create({ code: 'PREPARING', name: 'Preparando', order: 3 })

    expect(repository.create).toHaveBeenCalledWith({
      code: 'PREPARING',
      name: 'Preparando',
      order: 3,
    })
    expect(result).toEqual({ code: 'PREPARING', name: 'Preparando', order: 3, active: true })
  })

  it('propaga el error de código duplicado del repositorio', async () => {
    const duplicateError = Object.assign(new Error('E11000 duplicate key error'), { code: 11000 })
    const { service } = makeService({ create: jest.fn().mockRejectedValue(duplicateError) })

    await expect(
      service.create({ code: 'PENDING', name: 'Duplicado', order: 1 }),
    ).rejects.toMatchObject({ code: 11000 })
  })
})

describe('OrderStateService.update (RQ-CFG-06)', () => {
  it('devuelve el estado actualizado cuando existe', async () => {
    const { repository, service } = makeService({
      update: jest.fn().mockResolvedValue(orderStateDoc({ name: 'Nuevo nombre', order: 9 })),
    })

    const patch: UpdateOrderStateData = { name: 'Nuevo nombre', order: 9 }
    const result = await service.update('PENDING', patch)

    expect(repository.update).toHaveBeenCalledWith('PENDING', patch)
    expect(result).toEqual({ code: 'PENDING', name: 'Nuevo nombre', order: 9, active: true })
  })

  it('devuelve null cuando el estado no existe', async () => {
    const { service } = makeService({ update: jest.fn().mockResolvedValue(null) })

    await expect(service.update('MISSING', { name: 'X' })).resolves.toBeNull()
  })
})

describe('OrderStateService.setActive (RQ-CFG-06)', () => {
  const cases: Array<{ name: string; active: boolean }> = [
    { name: 'activa el estado', active: true },
    { name: 'desactiva el estado', active: false },
  ]

  it.each(cases)('$name', async ({ active }) => {
    const { repository, service } = makeService({
      setActive: jest.fn().mockResolvedValue(orderStateDoc({ active })),
    })

    const result = await service.setActive('PENDING', active)

    expect(repository.setActive).toHaveBeenCalledWith('PENDING', active)
    expect(result?.active).toBe(active)
  })

  it('devuelve null cuando el estado no existe', async () => {
    const { service } = makeService({ setActive: jest.fn().mockResolvedValue(null) })

    await expect(service.setActive('MISSING', true)).resolves.toBeNull()
  })
})
