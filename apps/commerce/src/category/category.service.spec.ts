import type { CategoryDocument, PublicCategory } from './category.model'
import type { CategoryListQuery } from './category.repository'
import { CategoryRepository } from './category.repository'
import { CategoryService } from './category.service'

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): CategoryDocument =>
  ({
    _id: { toString: () => 'cat1' },
    name: 'Bebidas',
    active: true,
    ...overrides,
  }) as unknown as CategoryDocument

const makeService = (repository: Partial<Record<string, jest.Mock>> = {}) => {
  const mock = {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    ...repository,
  }
  return { repository: mock, service: new CategoryService(mock as unknown as CategoryRepository) }
}

describe('CategoryService.list (RQ-CAT-01/05)', () => {
  const query: CategoryListQuery = { limit: 20, offset: 0 }

  it('serializa las categorías y devuelve meta con total, limit y offset', async () => {
    const { service } = makeService({
      list: jest.fn().mockResolvedValue({
        data: [buildDoc(), buildDoc({ _id: { toString: () => 'cat2' }, active: false })],
        total: 7,
      }),
    })

    const result = await service.list(query)

    expect(result.meta).toEqual({ total: 7, limit: 20, offset: 0 })
    expect(result.data).toEqual<PublicCategory[]>([
      { id: 'cat1', name: 'Bebidas', active: true },
      { id: 'cat2', name: 'Bebidas', active: false },
    ])
  })

  it('devuelve lista vacía con total 0 cuando no hay coincidencias', async () => {
    const { service } = makeService({
      list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    })

    await expect(service.list(query)).resolves.toEqual({
      data: [],
      meta: { total: 0, limit: 20, offset: 0 },
    })
  })

  it('propaga el filtro activeOnly, search y paginación al repositorio', async () => {
    const { repository, service } = makeService({
      list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    })
    const filtered: CategoryListQuery = { activeOnly: true, search: 'beb', limit: 5, offset: 10 }

    await service.list(filtered)

    expect(repository.list).toHaveBeenCalledWith(filtered)
  })
})

describe('CategoryService.findById (RQ-CAT-01)', () => {
  it('devuelve la categoría serializada si existe', async () => {
    const { service } = makeService({
      findById: jest.fn().mockResolvedValue(buildDoc()),
    })

    await expect(service.findById('cat1')).resolves.toEqual({
      id: 'cat1',
      name: 'Bebidas',
      active: true,
    })
  })

  it('devuelve null si la categoría no existe', async () => {
    const { service } = makeService({ findById: jest.fn().mockResolvedValue(null) })

    await expect(service.findById('missing')).resolves.toBeNull()
  })
})

describe('CategoryService.create (RQ-CAT-02)', () => {
  it('crea la categoría y devuelve la representación pública', async () => {
    const { repository, service } = makeService({
      create: jest.fn().mockResolvedValue(buildDoc({ name: 'Postres', active: false })),
    })

    const result = await service.create({ name: 'Postres', active: false })

    expect(repository.create).toHaveBeenCalledWith({ name: 'Postres', active: false })
    expect(result).toEqual({ id: 'cat1', name: 'Postres', active: false })
  })
})

describe('CategoryService.update (RQ-CAT-01)', () => {
  it('actualiza y serializa cuando la categoría existe', async () => {
    const { repository, service } = makeService({
      update: jest.fn().mockResolvedValue(buildDoc({ name: 'Bebidas frías' })),
    })

    const result = await service.update('cat1', { name: 'Bebidas frías' })

    expect(repository.update).toHaveBeenCalledWith('cat1', { name: 'Bebidas frías' })
    expect(result).toEqual({ id: 'cat1', name: 'Bebidas frías', active: true })
  })

  it('devuelve null si la categoría a actualizar no existe', async () => {
    const { service } = makeService({ update: jest.fn().mockResolvedValue(null) })

    await expect(service.update('missing', { name: 'X' })).resolves.toBeNull()
  })
})

describe('CategoryService.setActive (RQ-CAT-01)', () => {
  it.each([
    { name: 'desactiva', active: false },
    { name: 'activa', active: true },
  ])('$name la categoría y devuelve el estado', async ({ active }) => {
    const { repository, service } = makeService({
      setActive: jest.fn().mockResolvedValue(buildDoc({ active })),
    })

    const result = await service.setActive('cat1', active)

    expect(repository.setActive).toHaveBeenCalledWith('cat1', active)
    expect(result?.active).toBe(active)
  })

  it('devuelve null si la categoría no existe', async () => {
    const { service } = makeService({ setActive: jest.fn().mockResolvedValue(null) })

    await expect(service.setActive('missing', false)).resolves.toBeNull()
  })
})
