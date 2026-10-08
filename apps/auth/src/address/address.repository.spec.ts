import type { Model } from 'mongoose'
import { ERROR_CODES } from '../config/constants'
import type { AddressDocument } from './address.model'
import { AddressRepository } from './address.repository'

interface QueryChain<T> {
  sort: jest.Mock
  exec: jest.Mock<Promise<T>, []>
}

const ADDRESS_ID = '507f1f77bcf86cd799439021'
const USER_ID = '507f1f77bcf86cd799439011'
const OTHER_USER_ID = '507f1f77bcf86cd799439022'

const chainable = <T>(result: T): QueryChain<T> => {
  const chain = {
    sort: jest.fn(),
    exec: jest.fn().mockResolvedValue(result),
  }
  chain.sort.mockReturnValue(chain)
  return chain as QueryChain<T>
}

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): AddressDocument =>
  ({
    _id: { toString: () => 'a1' },
    userId: USER_ID,
    label: 'Casa',
    text: 'Av. Siempre Viva 123',
    city: 'CABA',
    postalCode: '1000',
    latitude: -34.6,
    longitude: -58.4,
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as unknown as AddressDocument

const makeRepository = () => {
  const model = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  }
  return { model, repository: new AddressRepository(model as unknown as Model<AddressDocument>) }
}

describe('AddressRepository.listByUser (RQ-AUTH-19)', () => {
  it('filtra por userId y active:true y ordena por createdAt desc', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable([buildDoc()])
    model.find.mockReturnValue(chain)

    const result = await repository.listByUser(USER_ID)

    expect(model.find).toHaveBeenCalledWith({ userId: USER_ID, active: true })
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 })
    expect(chain.exec).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
  })

  it('devuelve un arreglo vacío cuando el usuario no tiene direcciones activas', async () => {
    const { model, repository } = makeRepository()
    model.find.mockReturnValue(chainable([]))

    await expect(repository.listByUser(USER_ID)).resolves.toEqual([])
  })

  it('devuelve [] sin consultar la base cuando el userId no es ObjectId (JWT defensivo)', async () => {
    const { model, repository } = makeRepository()

    await expect(repository.listByUser('not-a-valid-object-id')).resolves.toEqual([])
    expect(model.find).not.toHaveBeenCalled()
  })
})

describe('AddressRepository.findOwnedById (RQ-AUTH-20: aislamiento)', () => {
  it('busca por _id, userId y active:true', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable(buildDoc())
    model.findOne.mockReturnValue(chain)

    await repository.findOwnedById(ADDRESS_ID, USER_ID)

    expect(model.findOne).toHaveBeenCalledWith({ _id: ADDRESS_ID, userId: USER_ID, active: true })
    expect(chain.exec).toHaveBeenCalledTimes(1)
  })

  it('devuelve null si la dirección pertenece a otro usuario', async () => {
    const { model, repository } = makeRepository()
    model.findOne.mockReturnValue(chainable(null))

    await expect(repository.findOwnedById(ADDRESS_ID, OTHER_USER_ID)).resolves.toBeNull()
  })

  it('devuelve null si la dirección está desactivada', async () => {
    const { model, repository } = makeRepository()
    model.findOne.mockReturnValue(chainable(null))

    await repository.findOwnedById(ADDRESS_ID, USER_ID)

    expect(model.findOne).toHaveBeenCalledWith({ _id: ADDRESS_ID, userId: USER_ID, active: true })
  })

  it('devuelve null con un id no-ObjectId sin consultar la base (apto para 404)', async () => {
    const { model, repository } = makeRepository()

    await expect(repository.findOwnedById('not-a-valid-object-id', USER_ID)).resolves.toBeNull()
    expect(model.findOne).not.toHaveBeenCalled()
  })

  it('devuelve null con un userId no-ObjectId sin consultar la base (JWT defensivo)', async () => {
    const { model, repository } = makeRepository()

    await expect(repository.findOwnedById(ADDRESS_ID, 'not-a-valid-object-id')).resolves.toBeNull()
    expect(model.findOne).not.toHaveBeenCalled()
  })
})

describe('AddressRepository.create (RQ-AUTH-20/22)', () => {
  it('crea la dirección asociada al userId y active:true', async () => {
    const { model, repository } = makeRepository()
    model.create.mockResolvedValue(buildDoc())
    const data = {
      label: 'Casa',
      text: 'Av. Siempre Viva 123',
      latitude: -34.6,
      longitude: -58.4,
    }

    await repository.create(USER_ID, data)

    expect(model.create).toHaveBeenCalledWith({ ...data, userId: USER_ID, active: true })
  })

  it('conserva los campos opcionales recibidos', async () => {
    const { model, repository } = makeRepository()
    model.create.mockResolvedValue(buildDoc())
    const data = {
      label: 'Trabajo',
      text: 'Oficina 1',
      city: 'Córdoba',
      postalCode: '5000',
      latitude: 1,
      longitude: 2,
    }

    await repository.create(OTHER_USER_ID, data)

    expect(model.create).toHaveBeenCalledWith({ ...data, userId: OTHER_USER_ID, active: true })
  })

  it('rechaza con USER_NOT_FOUND 404 un userId no-ObjectId sin persistir (JWT defensivo)', async () => {
    const { model, repository } = makeRepository()
    const data = {
      label: 'Casa',
      text: 'Av. Siempre Viva 123',
      latitude: -34.6,
      longitude: -58.4,
    }

    await expect(repository.create('not-a-valid-object-id', data)).rejects.toMatchObject({
      code: ERROR_CODES.userNotFound,
      status: 404,
    })
    expect(model.create).not.toHaveBeenCalled()
  })
})

describe('AddressRepository.updateOwned (RQ-AUTH-20)', () => {
  it('actualiza filtrando por _id, userId y active:true con $set y new:true', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable(buildDoc({ label: 'Trabajo' }))
    model.findOneAndUpdate.mockReturnValue(chain)

    await repository.updateOwned(ADDRESS_ID, USER_ID, { label: 'Trabajo' })

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: ADDRESS_ID, userId: USER_ID, active: true },
      { $set: { label: 'Trabajo' } },
      { new: true },
    )
    expect(chain.exec).toHaveBeenCalledTimes(1)
  })

  it('no actualiza una dirección desactivada: filtra active:true y devuelve null', async () => {
    const { model, repository } = makeRepository()
    model.findOneAndUpdate.mockReturnValue(chainable(null))

    const result = await repository.updateOwned(ADDRESS_ID, USER_ID, { label: 'Trabajo' })

    expect(result).toBeNull()
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: ADDRESS_ID, userId: USER_ID, active: true },
      { $set: { label: 'Trabajo' } },
      { new: true },
    )
  })

  it('devuelve null si la dirección no pertenece al usuario', async () => {
    const { model, repository } = makeRepository()
    model.findOneAndUpdate.mockReturnValue(chainable(null))

    await expect(
      repository.updateOwned(ADDRESS_ID, OTHER_USER_ID, { label: 'X' }),
    ).resolves.toBeNull()
  })

  it('devuelve null con un id no-ObjectId sin consultar la base (apto para 404)', async () => {
    const { model, repository } = makeRepository()

    await expect(
      repository.updateOwned('not-a-valid-object-id', USER_ID, { label: 'X' }),
    ).resolves.toBeNull()
    expect(model.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('devuelve null con un userId no-ObjectId sin consultar la base (JWT defensivo)', async () => {
    const { model, repository } = makeRepository()

    await expect(
      repository.updateOwned(ADDRESS_ID, 'not-a-valid-object-id', { label: 'X' }),
    ).resolves.toBeNull()
    expect(model.findOneAndUpdate).not.toHaveBeenCalled()
  })
})

describe('AddressRepository.softDeleteOwned (RQ-AUTH-21)', () => {
  it('desactiva (no borra) filtrando por _id, userId y active:true y devuelve true', async () => {
    const { model, repository } = makeRepository()
    model.updateOne.mockReturnValue(chainable({ acknowledged: true, modifiedCount: 1 }))

    const result = await repository.softDeleteOwned(ADDRESS_ID, USER_ID)

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: ADDRESS_ID, userId: USER_ID, active: true },
      { $set: { active: false } },
    )
    expect(result).toBe(true)
  })

  it.each([
    { name: 'no pertenece al usuario', modifiedCount: 0 },
    { name: 'no existe', modifiedCount: 0 },
    { name: 'ya estaba desactivada', modifiedCount: 0 },
  ])('devuelve false cuando la dirección $name', async ({ modifiedCount }) => {
    const { model, repository } = makeRepository()
    model.updateOne.mockReturnValue(chainable({ acknowledged: true, modifiedCount }))

    await expect(repository.softDeleteOwned(ADDRESS_ID, USER_ID)).resolves.toBe(false)
  })

  it('devuelve false si el resultado no reporta modifiedCount', async () => {
    const { model, repository } = makeRepository()
    model.updateOne.mockReturnValue(chainable({}))

    await expect(repository.softDeleteOwned(ADDRESS_ID, USER_ID)).resolves.toBe(false)
  })

  it('devuelve false con un id no-ObjectId sin consultar la base (apto para 404)', async () => {
    const { model, repository } = makeRepository()

    await expect(repository.softDeleteOwned('not-a-valid-object-id', USER_ID)).resolves.toBe(false)
    expect(model.updateOne).not.toHaveBeenCalled()
  })

  it('devuelve false con un userId no-ObjectId sin consultar la base (JWT defensivo)', async () => {
    const { model, repository } = makeRepository()

    await expect(repository.softDeleteOwned(ADDRESS_ID, 'not-a-valid-object-id')).resolves.toBe(
      false,
    )
    expect(model.updateOne).not.toHaveBeenCalled()
  })
})
