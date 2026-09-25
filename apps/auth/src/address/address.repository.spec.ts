import type { Model } from 'mongoose'
import type { AddressDocument } from './address.model'
import { AddressRepository } from './address.repository'

interface QueryChain<T> {
  sort: jest.Mock
  exec: jest.Mock<Promise<T>, []>
}

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
    userId: 'u1',
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

    const result = await repository.listByUser('u1')

    expect(model.find).toHaveBeenCalledWith({ userId: 'u1', active: true })
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 })
    expect(chain.exec).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
  })

  it('devuelve un arreglo vacío cuando el usuario no tiene direcciones activas', async () => {
    const { model, repository } = makeRepository()
    model.find.mockReturnValue(chainable([]))

    await expect(repository.listByUser('u1')).resolves.toEqual([])
  })
})

describe('AddressRepository.findOwnedById (RQ-AUTH-20: aislamiento)', () => {
  it('busca por _id, userId y active:true', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable(buildDoc())
    model.findOne.mockReturnValue(chain)

    await repository.findOwnedById('a1', 'u1')

    expect(model.findOne).toHaveBeenCalledWith({ _id: 'a1', userId: 'u1', active: true })
    expect(chain.exec).toHaveBeenCalledTimes(1)
  })

  it('devuelve null si la dirección pertenece a otro usuario', async () => {
    const { model, repository } = makeRepository()
    model.findOne.mockReturnValue(chainable(null))

    await expect(repository.findOwnedById('a1', 'otro')).resolves.toBeNull()
  })

  it('devuelve null si la dirección está desactivada', async () => {
    const { model, repository } = makeRepository()
    model.findOne.mockReturnValue(chainable(null))

    await repository.findOwnedById('a1', 'u1')

    expect(model.findOne).toHaveBeenCalledWith({ _id: 'a1', userId: 'u1', active: true })
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

    await repository.create('u1', data)

    expect(model.create).toHaveBeenCalledWith({ ...data, userId: 'u1', active: true })
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

    await repository.create('u2', data)

    expect(model.create).toHaveBeenCalledWith({ ...data, userId: 'u2', active: true })
  })
})

describe('AddressRepository.updateOwned (RQ-AUTH-20)', () => {
  it('actualiza filtrando por _id y userId con $set y new:true', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable(buildDoc({ label: 'Trabajo' }))
    model.findOneAndUpdate.mockReturnValue(chain)

    await repository.updateOwned('a1', 'u1', { label: 'Trabajo' })

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'a1', userId: 'u1' },
      { $set: { label: 'Trabajo' } },
      { new: true },
    )
    expect(chain.exec).toHaveBeenCalledTimes(1)
  })

  // KNOWN BUG: `updateOwned` no filtra por `active: true`, a diferencia de
  // `listByUser` y `findOwnedById`. Se puede modificar una dirección ya desactivada
  // y la operación devuelve el documento, aunque luego no sea visible en el listado.
  it('permite actualizar una dirección desactivada porque no filtra por active (KNOWN BUG)', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable(buildDoc({ active: false, label: 'Trabajo' }))
    model.findOneAndUpdate.mockReturnValue(chain)

    const result = await repository.updateOwned('a1', 'u1', { label: 'Trabajo' })

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'a1', userId: 'u1' },
      { $set: { label: 'Trabajo' } },
      { new: true },
    )
    expect(result?.active).toBe(false)
  })

  it('devuelve null si la dirección no pertenece al usuario', async () => {
    const { model, repository } = makeRepository()
    model.findOneAndUpdate.mockReturnValue(chainable(null))

    await expect(repository.updateOwned('a1', 'otro', { label: 'X' })).resolves.toBeNull()
  })
})

describe('AddressRepository.softDeleteOwned (RQ-AUTH-21)', () => {
  it('desactiva (no borra) filtrando por _id y userId y devuelve true', async () => {
    const { model, repository } = makeRepository()
    model.updateOne.mockReturnValue(chainable({ acknowledged: true, modifiedCount: 1 }))

    const result = await repository.softDeleteOwned('a1', 'u1')

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'a1', userId: 'u1' },
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

    await expect(repository.softDeleteOwned('a1', 'u1')).resolves.toBe(false)
  })

  it('devuelve false si el resultado no reporta modifiedCount', async () => {
    const { model, repository } = makeRepository()
    model.updateOne.mockReturnValue(chainable({}))

    await expect(repository.softDeleteOwned('a1', 'u1')).resolves.toBe(false)
  })
})
