import type { Model } from 'mongoose'
import type { IngredientDocument } from './ingredient.model'
import { IngredientRepository } from './ingredient.repository'

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

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): IngredientDocument =>
  ({
    _id: { toString: () => 'ing1' },
    name: 'Papa',
    unit: 'kg',
    active: true,
    ...overrides,
  }) as unknown as IngredientDocument

const makeRepository = () => {
  const model = {
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  }
  return {
    model,
    repository: new IngredientRepository(model as unknown as Model<IngredientDocument>),
  }
}

describe('IngredientRepository.findById / findByIds', () => {
  it('busca por id y ejecuta la consulta', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable(buildDoc())
    model.findById.mockReturnValue(chain)

    await expect(repository.findById('ing1')).resolves.toMatchObject({ name: 'Papa' })
    expect(model.findById).toHaveBeenCalledWith('ing1')
    expect(chain.exec).toHaveBeenCalledTimes(1)
  })

  it('busca por lote usando $in sobre _id', async () => {
    const { model, repository } = makeRepository()
    model.find.mockReturnValue(chainable([buildDoc()]))

    await repository.findByIds(['ing1', 'ing2'])

    expect(model.find).toHaveBeenCalledWith({ _id: { $in: ['ing1', 'ing2'] } })
  })

  it('devuelve null cuando findById no encuentra documento', async () => {
    const { model, repository } = makeRepository()
    model.findById.mockReturnValue(chainable(null))

    await expect(repository.findById('missing')).resolves.toBeNull()
  })
})

describe('IngredientRepository.create (RQ-CAT-09)', () => {
  it.each([
    {
      name: 'sin estado, queda activo por defecto',
      input: { name: 'Papa', unit: 'kg' },
      expected: true,
    },
    {
      name: 'con active true',
      input: { name: 'Papa', unit: 'kg', active: true },
      expected: true,
    },
    {
      name: 'con active false',
      input: { name: 'Papa', unit: 'kg', active: false },
      expected: false,
    },
  ])('$name', async ({ input, expected }) => {
    const { model, repository } = makeRepository()
    model.create.mockResolvedValue(buildDoc({ active: expected }))

    await repository.create(input)

    expect(model.create).toHaveBeenCalledWith({ ...input, active: expected })
  })
})

describe('IngredientRepository.list (RQ-CAT-09)', () => {
  it('sin filtros consulta todo, ordena por nombre y aplica paginación', async () => {
    const { model, repository } = makeRepository()
    const data = chainable([buildDoc()])
    model.find.mockReturnValue(data)
    model.countDocuments.mockReturnValue(chainable(2))

    const result = await repository.list({ limit: 10, offset: 20 })

    expect(model.find).toHaveBeenCalledWith({})
    expect(model.countDocuments).toHaveBeenCalledWith({})
    expect(data.sort).toHaveBeenCalledWith({ name: 1 })
    expect(data.skip).toHaveBeenCalledWith(20)
    expect(data.limit).toHaveBeenCalledWith(10)
    expect(result.total).toBe(2)
    expect(result.data[0].name).toBe('Papa')
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
    { name: 'escapa corchetes', search: '[kg]', expected: '\\[kg\\]' },
    { name: 'mantiene el texto simple', search: 'papa', expected: 'papa' },
  ])('$name en la búsqueda', async ({ search, expected }) => {
    const { model, repository } = makeRepository()
    model.find.mockReturnValue(chainable([]))
    model.countDocuments.mockReturnValue(chainable(0))

    await repository.list({ search, limit: 20, offset: 0 })

    const [filter] = model.find.mock.calls[0] as [Record<string, unknown>]
    const pattern = filter.name as RegExp
    expect(pattern.source).toBe(expected)
    expect(pattern.flags).toBe('i')
  })
})

describe('IngredientRepository.update / setActive', () => {
  it('actualiza con $set y new: true', async () => {
    const { model, repository } = makeRepository()
    model.findByIdAndUpdate.mockReturnValue(chainable(buildDoc({ unit: 'g' })))

    await repository.update('ing1', { unit: 'g' })

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'ing1',
      { $set: { unit: 'g' } },
      { new: true },
    )
  })

  it.each([
    { name: 'activa', active: true },
    { name: 'desactiva', active: false },
  ])('$name con $set active', async ({ active }) => {
    const { model, repository } = makeRepository()
    model.findByIdAndUpdate.mockReturnValue(chainable(buildDoc({ active })))

    await repository.setActive('ing1', active)

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'ing1',
      { $set: { active } },
      { new: true },
    )
  })

  it('devuelve null cuando el id no existe al activar/desactivar', async () => {
    const { model, repository } = makeRepository()
    model.findByIdAndUpdate.mockReturnValue(chainable(null))

    await expect(repository.setActive('missing', false)).resolves.toBeNull()
  })
})
