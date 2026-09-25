import type { Model } from 'mongoose'
import type { BranchDocument, BranchHours } from './branch.model'
import type { BranchProductAvailabilityDocument } from './branch-product-availability.model'
import { BranchRepository } from './branch.repository'

type QueryMock = {
  exec: jest.Mock
  sort: jest.Mock
  skip: jest.Mock
  limit: jest.Mock
}

const makeQuery = (result: unknown): QueryMock => {
  const query = {} as QueryMock
  query.exec = jest.fn().mockResolvedValue(result)
  query.sort = jest.fn().mockReturnValue(query)
  query.skip = jest.fn().mockReturnValue(query)
  query.limit = jest.fn().mockReturnValue(query)
  return query
}

const availability = (productId: string, available: boolean) => ({ productId, available })

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): BranchDocument =>
  ({
    _id: { toString: () => 'b1' },
    name: 'Centro',
    addressText: 'Av 1',
    latitude: 0,
    longitude: 0,
    phone: null,
    active: true,
    hours: [],
    ...overrides,
  }) as unknown as BranchDocument

const makeRepository = () => {
  const model = {
    findById: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  }
  const availabilityModel = { find: jest.fn(), findOneAndUpdate: jest.fn() }
  const repository = new BranchRepository(
    model as unknown as Model<BranchDocument>,
    availabilityModel as unknown as Model<BranchProductAvailabilityDocument>,
  )
  return { repository, model, availabilityModel }
}

describe('BranchRepository.findById', () => {
  it('busca por id y ejecuta la consulta', async () => {
    const { repository, model } = makeRepository()
    const query = makeQuery(buildDoc())
    model.findById.mockReturnValue(query)

    const result = await repository.findById('b1')

    expect(model.findById).toHaveBeenCalledWith('b1')
    expect(query.exec).toHaveBeenCalledTimes(1)
    expect(result).toBeTruthy()
  })

  it('devuelve null cuando la sucursal no existe', async () => {
    const { repository, model } = makeRepository()
    model.findById.mockReturnValue(makeQuery(null))

    await expect(repository.findById('missing')).resolves.toBeNull()
  })
})

describe('BranchRepository.findActive (RQ-BRN-06)', () => {
  it('filtra únicamente las sucursales activas', async () => {
    const { repository, model } = makeRepository()
    const query = makeQuery([buildDoc()])
    model.find.mockReturnValue(query)

    const result = await repository.findActive()

    expect(model.find).toHaveBeenCalledWith({ active: true })
    expect(query.exec).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
  })
})

describe('BranchRepository.findAll', () => {
  it('consulta todas las sucursales sin filtro', async () => {
    const { repository, model } = makeRepository()
    const query = makeQuery([buildDoc()])
    model.find.mockReturnValue(query)

    const result = await repository.findAll()

    expect(model.find).toHaveBeenCalledWith({})
    expect(query.exec).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
  })
})

describe('BranchRepository.create', () => {
  it.each([
    {
      name: 'sin opcionales → phone null, active true, hours vacío',
      data: { name: 'Nueva', addressText: 'Calle 2', latitude: -34.6, longitude: -58.4 },
      expected: { phone: null, active: true, hours: [] },
    },
    {
      name: 'con teléfono y activa false',
      data: {
        name: 'Nueva',
        addressText: 'Calle 2',
        latitude: -34.6,
        longitude: -58.4,
        phone: '555',
        active: false,
      },
      expected: { phone: '555', active: false, hours: [] },
    },
  ])('$name', async ({ data, expected }) => {
    const { repository, model } = makeRepository()
    model.create.mockResolvedValue(buildDoc(data))

    await repository.create(data)

    expect(model.create).toHaveBeenCalledWith(expect.objectContaining(expected))
  })
})

describe('BranchRepository.list', () => {
  it.each([
    {
      name: 'sin filtros usa filter vacío',
      query: { limit: 20, offset: 0 },
      expectedFilter: {},
    },
    {
      name: 'solo activas',
      query: { active: true, limit: 20, offset: 0 },
      expectedFilter: { active: true },
    },
    {
      name: 'solo inactivas con paginación',
      query: { active: false, limit: 5, offset: 10 },
      expectedFilter: { active: false },
    },
  ])('$name', async ({ query, expectedFilter }) => {
    const { repository, model } = makeRepository()
    const dataQuery = makeQuery([buildDoc()])
    const countQuery = makeQuery(3)
    model.find.mockReturnValue(dataQuery)
    model.countDocuments.mockReturnValue(countQuery)

    const result = await repository.list(query)

    expect(model.find).toHaveBeenCalledWith(expectedFilter)
    expect(model.countDocuments).toHaveBeenCalledWith(expectedFilter)
    expect(dataQuery.sort).toHaveBeenCalledWith({ name: 1 })
    expect(dataQuery.skip).toHaveBeenCalledWith(query.offset)
    expect(dataQuery.limit).toHaveBeenCalledWith(query.limit)
    expect(result.total).toBe(3)
    expect(result.data).toHaveLength(1)
  })

  it('busca por nombre o dirección escapando caracteres especiales', async () => {
    const { repository, model } = makeRepository()
    model.find.mockReturnValue(makeQuery([]))
    model.countDocuments.mockReturnValue(makeQuery(0))

    await repository.list({ search: 'a.*', limit: 20, offset: 0 })

    const filter = model.find.mock.calls[0][0] as {
      active?: boolean
      $or?: Array<{ name: RegExp; addressText: RegExp }>
    }

    expect(filter.active).toBeUndefined()
    expect(filter.$or).toHaveLength(2)
    expect(filter.$or?.[0].name.flags).toContain('i')
    expect(filter.$or?.[0].name.test('a.*')).toBe(true)
    expect(filter.$or?.[0].name.test('abc')).toBe(false)
    expect(filter.$or?.[1].addressText).toBeInstanceOf(RegExp)
  })

  it('combina filtro de estado y búsqueda', async () => {
    const { repository, model } = makeRepository()
    model.find.mockReturnValue(makeQuery([]))
    model.countDocuments.mockReturnValue(makeQuery(0))

    await repository.list({ active: true, search: 'cen', limit: 20, offset: 0 })

    expect(model.find).toHaveBeenCalledWith(
      expect.objectContaining({ active: true, $or: expect.any(Array) }),
    )
  })
})

describe('BranchRepository.update', () => {
  it('actualiza con $set y devuelve el documento nuevo', async () => {
    const { repository, model } = makeRepository()
    const query = makeQuery(buildDoc({ name: 'Renombrada' }))
    model.findByIdAndUpdate.mockReturnValue(query)

    const result = await repository.update('b1', { name: 'Renombrada' })

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'b1',
      { $set: { name: 'Renombrada' } },
      { new: true },
    )
    expect(result).toBeTruthy()
  })
})

describe('BranchRepository.setActive', () => {
  it.each([
    { name: 'activa', active: true },
    { name: 'desactiva', active: false },
  ])('$name la sucursal', async ({ active }) => {
    const { repository, model } = makeRepository()
    model.findByIdAndUpdate.mockReturnValue(makeQuery(buildDoc({ active })))

    await repository.setActive('b1', active)

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'b1',
      { $set: { active } },
      { new: true },
    )
  })
})

describe('BranchRepository.updateHours', () => {
  it('reemplaza el arreglo de horarios con $set', async () => {
    const { repository, model } = makeRepository()
    const hours: BranchHours[] = [
      { dayOfWeek: 1, opening: '08:00', closing: '20:00', closed: false },
    ]
    model.findByIdAndUpdate.mockReturnValue(makeQuery(buildDoc({ hours })))

    await repository.updateHours('b1', hours)

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith('b1', { $set: { hours } }, { new: true })
  })
})

describe('BranchRepository.listAvailability', () => {
  it('lista la disponibilidad de la sucursal por branchId', async () => {
    const { repository, availabilityModel } = makeRepository()
    const query = makeQuery([availability('p1', true), availability('p2', false)])
    availabilityModel.find.mockReturnValue(query)

    const result = await repository.listAvailability('b1')

    expect(availabilityModel.find).toHaveBeenCalledWith({ branchId: 'b1' })
    expect(result).toHaveLength(2)
  })
})

describe('BranchRepository.upsertAvailability', () => {
  it.each([
    { name: 'pausar', available: false },
    { name: 'reactivar', available: true },
  ])('$name el producto con upsert', async ({ available }) => {
    const { repository, availabilityModel } = makeRepository()
    const query = makeQuery({})
    availabilityModel.findOneAndUpdate.mockReturnValue(query)

    await repository.upsertAvailability('b1', 'p1', available)

    expect(availabilityModel.findOneAndUpdate).toHaveBeenCalledWith(
      { branchId: 'b1', productId: 'p1' },
      { $set: { available } },
      { new: true, upsert: true },
    )
    expect(query.exec).toHaveBeenCalledTimes(1)
  })
})
