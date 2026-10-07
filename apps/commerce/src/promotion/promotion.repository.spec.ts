import type { Model } from 'mongoose'
import type { PromotionDocument } from './promotion.model'
import { PromotionRepository } from './promotion.repository'

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

const start = new Date('2026-01-01T00:00:00.000Z')
const end = new Date('2026-02-01T00:00:00.000Z')

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): PromotionDocument =>
  ({
    _id: { toString: () => 'prom1' },
    name: '2x1',
    description: 'Martes',
    startDate: start,
    endDate: end,
    active: true,
    ...overrides,
  }) as unknown as PromotionDocument

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
    repository: new PromotionRepository(model as unknown as Model<PromotionDocument>),
  }
}

describe('PromotionRepository.findById', () => {
  it('busca por id y ejecuta la consulta', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable(buildDoc())
    model.findById.mockReturnValue(chain)

    await expect(repository.findById('prom1')).resolves.toMatchObject({ name: '2x1' })
    expect(model.findById).toHaveBeenCalledWith('prom1')
    expect(chain.exec).toHaveBeenCalledTimes(1)
  })

  it('devuelve null cuando no encuentra documento', async () => {
    const { model, repository } = makeRepository()
    model.findById.mockReturnValue(chainable(null))

    await expect(repository.findById('missing')).resolves.toBeNull()
  })
})

describe('PromotionRepository.create (RQ-CAT-13)', () => {
  it('siempre crea la promoción activa', async () => {
    const { model, repository } = makeRepository()
    model.create.mockResolvedValue(buildDoc())

    await repository.create({ name: 'Verano', description: 'x', startDate: start, endDate: end })

    expect(model.create).toHaveBeenCalledWith({
      name: 'Verano',
      description: 'x',
      startDate: start,
      endDate: end,
      active: true,
    })
  })

  it('acepta description ausente', async () => {
    const { model, repository } = makeRepository()
    model.create.mockResolvedValue(buildDoc({ description: null }))

    await repository.create({ name: 'Verano', startDate: start, endDate: end })

    expect(model.create).toHaveBeenCalledWith({
      name: 'Verano',
      startDate: start,
      endDate: end,
      active: true,
    })
  })
})

describe('PromotionRepository.list (RQ-CAT-13)', () => {
  it('sin filtros ordena por createdAt descendente y aplica paginación', async () => {
    const { model, repository } = makeRepository()
    const data = chainable([buildDoc()])
    model.find.mockReturnValue(data)
    model.countDocuments.mockReturnValue(chainable(1))

    const result = await repository.list({ limit: 10, offset: 5 })

    expect(model.find).toHaveBeenCalledWith({})
    expect(model.countDocuments).toHaveBeenCalledWith({})
    expect(data.sort).toHaveBeenCalledWith({ createdAt: -1 })
    expect(data.skip).toHaveBeenCalledWith(5)
    expect(data.limit).toHaveBeenCalledWith(10)
    expect(result.total).toBe(1)
    expect(result.data[0].name).toBe('2x1')
  })

  it('con activeOnly agrega el filtro active: true', async () => {
    const { model, repository } = makeRepository()
    model.find.mockReturnValue(chainable([]))
    model.countDocuments.mockReturnValue(chainable(0))

    await repository.list({ activeOnly: true, limit: 20, offset: 0 })

    expect(model.find).toHaveBeenCalledWith({ active: true })
    expect(model.countDocuments).toHaveBeenCalledWith({ active: true })
  })
})

describe('PromotionRepository.update / setActive', () => {
  it('actualiza con $set y new: true incluyendo fechas', async () => {
    const { model, repository } = makeRepository()
    model.findByIdAndUpdate.mockReturnValue(chainable(buildDoc({ name: 'Nueva' })))

    await repository.update('prom1', { name: 'Nueva', endDate: end })

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'prom1',
      { $set: { name: 'Nueva', endDate: end } },
      { new: true },
    )
  })

  it.each([
    { name: 'activa', active: true },
    { name: 'desactiva', active: false },
  ])('$name con $set active', async ({ active }) => {
    const { model, repository } = makeRepository()
    model.findByIdAndUpdate.mockReturnValue(chainable(buildDoc({ active })))

    await repository.setActive('prom1', active)

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'prom1',
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
