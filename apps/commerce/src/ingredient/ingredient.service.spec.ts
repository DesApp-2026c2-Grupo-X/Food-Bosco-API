import type { IngredientDocument, PublicIngredient } from './ingredient.model'
import type { IngredientListQuery } from './ingredient.repository'
import { IngredientRepository } from './ingredient.repository'
import { IngredientService } from './ingredient.service'

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): IngredientDocument =>
  ({
    _id: { toString: () => 'ing1' },
    name: 'Papa',
    unit: 'kg',
    active: true,
    ...overrides,
  }) as unknown as IngredientDocument

const makeService = (repository: Partial<Record<string, jest.Mock>> = {}) => {
  const mock = {
    list: jest.fn(),
    findById: jest.fn(),
    findByIds: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    ...repository,
  }
  return {
    repository: mock,
    service: new IngredientService(mock as unknown as IngredientRepository),
  }
}

describe('IngredientService.list (RQ-CAT-09)', () => {
  const query: IngredientListQuery = { limit: 20, offset: 0 }

  it('serializa los ingredientes y devuelve meta con total, limit y offset', async () => {
    const { service } = makeService({
      list: jest.fn().mockResolvedValue({
        data: [buildDoc(), buildDoc({ _id: { toString: () => 'ing2' }, unit: 'unidad' })],
        total: 4,
      }),
    })

    const result = await service.list(query)

    expect(result.meta).toEqual({ total: 4, limit: 20, offset: 0 })
    expect(result.data).toEqual<PublicIngredient[]>([
      { id: 'ing1', name: 'Papa', unit: 'kg', active: true },
      { id: 'ing2', name: 'Papa', unit: 'unidad', active: true },
    ])
  })

  it('propaga filtros y paginación al repositorio', async () => {
    const { repository, service } = makeService({
      list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    })
    const filtered: IngredientListQuery = { activeOnly: true, search: 'pa', limit: 5, offset: 10 }

    await service.list(filtered)

    expect(repository.list).toHaveBeenCalledWith(filtered)
  })

  it('devuelve lista vacía con total 0 cuando no hay coincidencias', async () => {
    const { service } = makeService({ list: jest.fn().mockResolvedValue({ data: [], total: 0 }) })

    await expect(service.list(query)).resolves.toEqual({
      data: [],
      meta: { total: 0, limit: 20, offset: 0 },
    })
  })
})

describe('IngredientService.findById', () => {
  it('devuelve el ingrediente serializado si existe', async () => {
    const { service } = makeService({ findById: jest.fn().mockResolvedValue(buildDoc()) })

    await expect(service.findById('ing1')).resolves.toEqual({
      id: 'ing1',
      name: 'Papa',
      unit: 'kg',
      active: true,
    })
  })

  it('devuelve null si no existe', async () => {
    const { service } = makeService({ findById: jest.fn().mockResolvedValue(null) })

    await expect(service.findById('missing')).resolves.toBeNull()
  })
})

describe('IngredientService.create (RQ-CAT-09)', () => {
  it('crea el ingrediente y devuelve la representación pública', async () => {
    const { repository, service } = makeService({
      create: jest.fn().mockResolvedValue(buildDoc({ name: 'Queso', unit: 'laminas' })),
    })

    const result = await service.create({ name: 'Queso', unit: 'laminas' })

    expect(repository.create).toHaveBeenCalledWith({ name: 'Queso', unit: 'laminas' })
    expect(result).toEqual({ id: 'ing1', name: 'Queso', unit: 'laminas', active: true })
  })
})

describe('IngredientService.update', () => {
  it('actualiza y serializa cuando el ingrediente existe', async () => {
    const { repository, service } = makeService({
      update: jest.fn().mockResolvedValue(buildDoc({ unit: 'g' })),
    })

    const result = await service.update('ing1', { unit: 'g' })

    expect(repository.update).toHaveBeenCalledWith('ing1', { unit: 'g' })
    expect(result?.unit).toBe('g')
  })

  it('devuelve null si el ingrediente a actualizar no existe', async () => {
    const { service } = makeService({ update: jest.fn().mockResolvedValue(null) })

    await expect(service.update('missing', { unit: 'g' })).resolves.toBeNull()
  })
})

describe('IngredientService.setActive', () => {
  it.each([
    { name: 'desactiva', active: false },
    { name: 'activa', active: true },
  ])('$name el ingrediente y devuelve el estado', async ({ active }) => {
    const { repository, service } = makeService({
      setActive: jest.fn().mockResolvedValue(buildDoc({ active })),
    })

    const result = await service.setActive('ing1', active)

    expect(repository.setActive).toHaveBeenCalledWith('ing1', active)
    expect(result?.active).toBe(active)
  })

  it('devuelve null si el ingrediente no existe', async () => {
    const { service } = makeService({ setActive: jest.fn().mockResolvedValue(null) })

    await expect(service.setActive('missing', false)).resolves.toBeNull()
  })
})

describe('IngredientService.findByIds', () => {
  it.each([
    { name: 'varios ingredientes', ids: ['ing1', 'ing2'], expected: 2 },
    { name: 'un ingrediente', ids: ['ing1'], expected: 1 },
    { name: 'ninguno', ids: [], expected: 0 },
  ])('serializa la lista ($name)', async ({ ids, expected }) => {
    const docs = ids.map((id) => buildDoc({ _id: { toString: () => id } }))
    const { repository, service } = makeService({
      findByIds: jest.fn().mockResolvedValue(docs),
    })

    const result = await service.findByIds(ids)

    expect(repository.findByIds).toHaveBeenCalledWith(ids)
    expect(result).toHaveLength(expected)
    result.forEach((ingredient) => expect(typeof ingredient.id).toBe('string'))
  })
})
