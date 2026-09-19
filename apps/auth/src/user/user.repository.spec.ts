import type { Model } from 'mongoose'
import type { UserDocument } from './user.model'
import { UserRepository } from './user.repository'

interface QueryChain<T> {
  sort: jest.Mock
  skip: jest.Mock
  limit: jest.Mock
  select: jest.Mock
  exec: jest.Mock<Promise<T>, []>
}

const chainable = <T>(result: T): QueryChain<T> => {
  const chain = {
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    select: jest.fn(),
    exec: jest.fn().mockResolvedValue(result),
  }
  chain.sort.mockReturnValue(chain)
  chain.skip.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  return chain as QueryChain<T>
}

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): UserDocument =>
  ({
    _id: { toString: () => 'u1' },
    email: 'cliente@example.com',
    passwordHash: '$2a$10$hash',
    role: 'customer',
    firstName: 'Juan',
    lastName: 'Perez',
    phone: '11223344',
    active: true,
    branchId: null,
    vehicle: null,
    ...overrides,
  }) as unknown as UserDocument

const makeRepository = () => {
  const model = {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  }
  return { model, repository: new UserRepository(model as unknown as Model<UserDocument>) }
}

describe('UserRepository.findByEmail / findById', () => {
  it('findByEmail consulta por email y ejecuta la query', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable(buildDoc())
    model.findOne.mockReturnValue(chain)

    await expect(repository.findByEmail('cliente@example.com')).resolves.toMatchObject({
      email: 'cliente@example.com',
    })
    expect(model.findOne).toHaveBeenCalledWith({ email: 'cliente@example.com' })
    expect(chain.exec).toHaveBeenCalledTimes(1)
  })

  it('findByEmailWithPassword selecciona explícitamente el hash (que es select:false)', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable(buildDoc())
    model.findOne.mockReturnValue(chain)

    await repository.findByEmailWithPassword('cliente@example.com')

    expect(model.findOne).toHaveBeenCalledWith({ email: 'cliente@example.com' })
    expect(chain.select).toHaveBeenCalledWith('+passwordHash')
  })

  it('findById consulta por id y devuelve null si no existe', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable(null)
    model.findById.mockReturnValue(chain)

    await expect(repository.findById('missing')).resolves.toBeNull()
    expect(model.findById).toHaveBeenCalledWith('missing')
  })

  it('findByIdWithPassword selecciona explícitamente el hash', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable(buildDoc())
    model.findById.mockReturnValue(chain)

    await repository.findByIdWithPassword('u1')

    expect(model.findById).toHaveBeenCalledWith('u1')
    expect(chain.select).toHaveBeenCalledWith('+passwordHash')
  })
})

describe('UserRepository.create (RQ-AUTH-01/03)', () => {
  it('fuerza active:true al crear y nunca recibe la contraseña en texto plano', async () => {
    const { model, repository } = makeRepository()
    model.create.mockResolvedValue(buildDoc())

    await repository.create({
      email: 'nuevo@example.com',
      passwordHash: '$2a$10$hash',
      role: 'customer',
      firstName: 'Nuevo',
      lastName: 'Cliente',
      phone: '1',
    })

    expect(model.create).toHaveBeenCalledWith({
      email: 'nuevo@example.com',
      passwordHash: '$2a$10$hash',
      role: 'customer',
      firstName: 'Nuevo',
      lastName: 'Cliente',
      phone: '1',
      active: true,
    })
  })
})

describe('UserRepository.list (filtros role/active/search + paginación)', () => {
  it('sin filtros consulta todo, ordena por createdAt desc y aplica paginación', async () => {
    const { model, repository } = makeRepository()
    const data = chainable([buildDoc()])
    const total = chainable(3)
    model.find.mockReturnValue(data)
    model.countDocuments.mockReturnValue(total)

    const result = await repository.list({ limit: 10, offset: 20 })

    expect(model.find).toHaveBeenCalledWith({})
    expect(model.countDocuments).toHaveBeenCalledWith({})
    expect(data.sort).toHaveBeenCalledWith({ createdAt: -1 })
    expect(data.skip).toHaveBeenCalledWith(20)
    expect(data.limit).toHaveBeenCalledWith(10)
    expect(result.total).toBe(3)
    expect(result.data).toHaveLength(1)
  })

  it.each([
    { name: 'rol rider', query: { role: 'rider' as const }, expected: { role: 'rider' } },
    {
      name: 'rol branch_admin',
      query: { role: 'branch_admin' as const },
      expected: { role: 'branch_admin' },
    },
    {
      name: 'rol super_admin',
      query: { role: 'super_admin' as const },
      expected: { role: 'super_admin' },
    },
  ])('agrega el filtro $name', async ({ query, expected }) => {
    const { model, repository } = makeRepository()
    model.find.mockReturnValue(chainable([]))
    model.countDocuments.mockReturnValue(chainable(0))

    await repository.list({ ...query, limit: 20, offset: 0 })

    expect(model.find).toHaveBeenCalledWith(expected)
  })

  it.each([
    { name: 'activos', active: true },
    { name: 'inactivos', active: false },
  ])('agrega el filtro active para usuarios $name (active:false no se descarta)', async ({
    active,
  }) => {
    const { model, repository } = makeRepository()
    model.find.mockReturnValue(chainable([]))
    model.countDocuments.mockReturnValue(chainable(0))

    await repository.list({ active, limit: 20, offset: 0 })

    expect(model.find).toHaveBeenCalledWith({ active })
  })

  it('construye un $or que busca en firstName, lastName y email', async () => {
    const { model, repository } = makeRepository()
    model.find.mockReturnValue(chainable([]))
    model.countDocuments.mockReturnValue(chainable(0))

    await repository.list({ search: 'juan', limit: 20, offset: 0 })

    const [filter] = model.find.mock.calls[0] as [Record<string, unknown>]
    const or = filter.$or as Array<Record<string, RegExp>>
    expect(or.map((clause) => Object.keys(clause)[0])).toEqual(['firstName', 'lastName', 'email'])
    expect(or.every((clause) => Object.values(clause)[0].flags.includes('i'))).toBe(true)
  })

  it.each([
    { name: 'escapa caracteres especiales de regex', search: 'a+b', expected: 'a\\+b' },
    { name: 'escapa paréntesis y punto', search: '(1.0)', expected: '\\(1\\.0\\)' },
    { name: 'mantiene el texto simple', search: 'juan', expected: 'juan' },
  ])('$name en la búsqueda', async ({ search, expected }) => {
    const { model, repository } = makeRepository()
    model.find.mockReturnValue(chainable([]))
    model.countDocuments.mockReturnValue(chainable(0))

    await repository.list({ search, limit: 20, offset: 0 })

    const [filter] = model.find.mock.calls[0] as [Record<string, unknown>]
    const or = filter.$or as Array<Record<string, RegExp>>
    expect(or[0].firstName.source).toBe(expected)
    expect(or[0].firstName.flags).toBe('i')
  })

  it('combina role, active y search en un mismo filtro', async () => {
    const { model, repository } = makeRepository()
    model.find.mockReturnValue(chainable([]))
    model.countDocuments.mockReturnValue(chainable(0))

    await repository.list({
      role: 'branch_admin',
      active: true,
      search: 'suc',
      limit: 20,
      offset: 0,
    })

    const [filter] = model.find.mock.calls[0] as [Record<string, unknown>]
    expect(filter.role).toBe('branch_admin')
    expect(filter.active).toBe(true)
    expect(filter.$or).toBeDefined()
  })

  it('cuenta y busca con el mismo filtro', async () => {
    const { model, repository } = makeRepository()
    model.find.mockReturnValue(chainable([]))
    model.countDocuments.mockReturnValue(chainable(0))

    await repository.list({ role: 'rider', limit: 20, offset: 0 })

    const filter = { role: 'rider' }
    expect(model.find).toHaveBeenCalledWith(filter)
    expect(model.countDocuments).toHaveBeenCalledWith(filter)
  })
})

describe('UserRepository.update / setActive', () => {
  it('update aplica $set y new:true', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable(buildDoc({ firstName: 'Ana' }))
    model.findByIdAndUpdate.mockReturnValue(chain)

    await repository.update('u1', { firstName: 'Ana' })

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'u1',
      { $set: { firstName: 'Ana' } },
      { new: true },
    )
    expect(chain.exec).toHaveBeenCalledTimes(1)
  })

  it.each([
    { name: 'activar', active: true },
    { name: 'desactivar', active: false },
  ])('setActive $name con $set y new:true', async ({ active }) => {
    const { model, repository } = makeRepository()
    model.findByIdAndUpdate.mockReturnValue(chainable(buildDoc({ active })))

    await repository.setActive('u1', active)

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith('u1', { $set: { active } }, { new: true })
  })

  it('devuelve null cuando el id no existe al actualizar', async () => {
    const { model, repository } = makeRepository()
    model.findByIdAndUpdate.mockReturnValue(chainable(null))

    await expect(repository.update('missing', { firstName: 'X' })).resolves.toBeNull()
  })
})

describe('UserRepository.updatePassword (RQ-AUTH-03)', () => {
  it('actualiza el hash con updateOne atómico por _id', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable({ acknowledged: true, modifiedCount: 1 })
    model.updateOne.mockReturnValue(chain)

    await repository.updatePassword('u1', '$2a$10$nuevoHash')

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'u1' },
      { $set: { passwordHash: '$2a$10$nuevoHash' } },
    )
    expect(chain.exec).toHaveBeenCalledTimes(1)
  })
})
