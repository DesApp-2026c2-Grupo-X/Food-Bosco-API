import type { Model } from 'mongoose'
import type { CategoryDocument } from './category.model'
import { CategoryRepository } from './category.repository'

interface QueryChain<T> {
  sort: jest.Mock
  skip: jest.Mock
  limit: jest.Mock
  exec: jest.Mock<Promise<T>, []>
}

const chainable = <T>(result: T): QueryChain<T> => {
  const chain: QueryChain<T> = {
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    exec: jest.fn().mockResolvedValue(result),
  }
  chain.sort.mockReturnValue(chain)
  chain.skip.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  return chain
}

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): CategoryDocument =>
  ({
    _id: { toString: () => 'cat1' },
    name: 'Bebidas',
    active: true,
    ...overrides,
  }) as unknown as CategoryDocument

const makeRepository = () => {
  const model = {
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  }
  return { model, repository: new CategoryRepository(model as unknown as Model<CategoryDocument>) }
}

describe('CategoryRepository.findById / findByIds', () => {
  it('busca por id y ejecuta la consulta', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable(buildDoc())
    model.findById.mockReturnValue(chain)

    await expect(repository.findById('cat1')).resolves.toMatchObject({ name: 'Bebidas' })
    expect(model.findById).toHaveBeenCalledWith('cat1')
    expect(chain.exec).toHaveBeenCalledTimes(1)
  })

  it('busca por lote usando $in sobre _id', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable([buildDoc()])
    model.find.mockReturnValue(chain)

    await repository.findByIds(['cat1', 'cat2'])

    expect(model.find).toHaveBeenCalledWith({ _id: { $in: ['cat1', 'cat2'] } })
  })

  it('devuelve null cuando findById no encuentra documento', async () => {
    const { model, repository } = makeRepository()
    model.findById.mockReturnValue(chainable(null))

    await expect(repository.findById('missing')).resolves.toBeNull()
  })
})

describe('CategoryRepository.create (RQ-CAT-02)', () => {
  it.each([
    { name: 'sin estado, queda activa por defecto', input: { name: 'Bebidas' }, expected: true },
    { name: 'con active true', input: { name: 'Bebidas', active: true }, expected: true },
    { name: 'con active false', input: { name: 'Bebidas', active: false }, expected: false },
  ])('$name', async ({ input, expected }) => {
    const { model, repository } = makeRepository()
    model.create.mockResolvedValue(buildDoc({ active: expected }))

    await repository.create(input)

    expect(model.create).toHaveBeenCalledWith({ ...input, active: expected })
  })

  // KNOWN BUG: no hay índice único ni guarda de duplicados para `name`. Un error de clave
  // duplicada de Mongo se propaga sin traducirse a un error de dominio (CATEGORY_ALREADY_EXISTS).
  it('propaga el error crudo de Mongo ante un nombre duplicado (sin manejo de unicidad)', async () => {
    const { model, repository } = makeRepository()
    const duplicateError = Object.assign(new Error('E11000 duplicate key error'), { code: 11000 })
    model.create.mockRejectedValue(duplicateError)

    await expect(repository.create({ name: 'Bebidas' })).rejects.toBe(duplicateError)
  })
})

describe('CategoryRepository.list (RQ-CAT-01/05)', () => {
  it('sin filtros consulta todo, ordena por nombre y aplica paginación', async () => {
    const { model, repository } = makeRepository()
    const data = chainable([buildDoc()])
    const total = chainable(3)
    model.find.mockReturnValue(data)
    model.countDocuments.mockReturnValue(total)

    const result = await repository.list({ limit: 10, offset: 20 })

    expect(model.find).toHaveBeenCalledWith({})
    expect(model.countDocuments).toHaveBeenCalledWith({})
    expect(data.sort).toHaveBeenCalledWith({ name: 1 })
    expect(data.skip).toHaveBeenCalledWith(20)
    expect(data.limit).toHaveBeenCalledWith(10)
    expect(result.total).toBe(3)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].name).toBe('Bebidas')
  })

  it('con activeOnly agrega el filtro active: true', async () => {
    const { model, repository } = makeRepository()
    model.find.mockReturnValue(chainable([]))
    model.countDocuments.mockReturnValue(chainable(0))

    await repository.list({ activeOnly: true, limit: 20, offset: 0 })

    expect(model.find).toHaveBeenCalledWith({ active: true })
  })

  it.each([
    { name: 'escapa caracteres especiales de regex', search: 'a+b', expected: 'a\\+b' },
    { name: 'escapa paréntesis y punto', search: '(1.0)', expected: '\\(1\\.0\\)' },
    { name: 'mantiene el texto simple', search: 'bebidas', expected: 'bebidas' },
  ])('$name en la búsqueda', async ({ search, expected }) => {
    const { model, repository } = makeRepository()
    model.find.mockReturnValue(chainable([]))
    model.countDocuments.mockReturnValue(chainable(0))

    await repository.list({ search, limit: 20, offset: 0 })

    const [filter] = model.find.mock.calls[0] as [Record<string, unknown>]
    const pattern = filter.name as RegExp
    expect(pattern).toBeInstanceOf(RegExp)
    expect(pattern.source).toBe(expected)
    expect(pattern.flags).toBe('i')
  })

  it('combina activeOnly y search en un mismo filtro', async () => {
    const { model, repository } = makeRepository()
    model.find.mockReturnValue(chainable([]))
    model.countDocuments.mockReturnValue(chainable(0))

    await repository.list({ activeOnly: true, search: 'postre', limit: 20, offset: 0 })

    const [filter] = model.find.mock.calls[0] as [Record<string, unknown>]
    expect(filter.active).toBe(true)
    expect((filter.name as RegExp).source).toBe('postre')
  })
})

describe('CategoryRepository.update / setActive', () => {
  it('actualiza con $set y new: true', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable(buildDoc({ name: 'Nuevo' }))
    model.findByIdAndUpdate.mockReturnValue(chain)

    await repository.update('cat1', { name: 'Nuevo' })

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'cat1',
      { $set: { name: 'Nuevo' } },
      { new: true },
    )
    expect(chain.exec).toHaveBeenCalledTimes(1)
  })

  it.each([
    { name: 'activa', active: true },
    { name: 'desactiva', active: false },
  ])('$name con $set active', async ({ active }) => {
    const { model, repository } = makeRepository()
    model.findByIdAndUpdate.mockReturnValue(chainable(buildDoc({ active })))

    await repository.setActive('cat1', active)

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'cat1',
      { $set: { active } },
      { new: true },
    )
  })

  it('devuelve null cuando el id no existe al actualizar', async () => {
    const { model, repository } = makeRepository()
    model.findByIdAndUpdate.mockReturnValue(chainable(null))

    await expect(repository.update('missing', { name: 'X' })).resolves.toBeNull()
  })
})
