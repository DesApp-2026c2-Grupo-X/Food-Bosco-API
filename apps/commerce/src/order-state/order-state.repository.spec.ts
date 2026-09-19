import type { Model } from 'mongoose'
import type { OrderStateDocument } from './order-state.model'
import { OrderStateRepository } from './order-state.repository'

const sortableQuery = <T>(result: T): { sort: jest.Mock; exec: jest.Mock } => {
  const exec = jest.fn().mockResolvedValue(result)
  const sort = jest.fn().mockReturnValue({ exec })
  return { sort, exec }
}

const execQuery = <T>(result: T): { exec: jest.Mock } => ({
  exec: jest.fn().mockResolvedValue(result),
})

const makeRepository = () => {
  const model = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
  }
  const repository = new OrderStateRepository(model as unknown as Model<OrderStateDocument>)
  return { repository, model }
}

describe('OrderStateRepository.findAll (RQ-CFG-05)', () => {
  it('ordena el catálogo por el campo order ascendente', async () => {
    const { repository, model } = makeRepository()
    const docs = [{ code: 'PENDING', order: 1 }]
    const query = sortableQuery(docs)
    model.find.mockReturnValue(query)

    const result = await repository.findAll()

    expect(model.find).toHaveBeenCalledWith()
    expect(query.sort).toHaveBeenCalledWith({ order: 1 })
    expect(result).toBe(docs)
  })

  it('devuelve arreglo vacío cuando no hay estados', async () => {
    const { repository, model } = makeRepository()
    model.find.mockReturnValue(sortableQuery([]))

    await expect(repository.findAll()).resolves.toEqual([])
  })
})

describe('OrderStateRepository.findByCode (RQ-CFG-05)', () => {
  it('busca por código', async () => {
    const { repository, model } = makeRepository()
    const doc = { code: 'PENDING' }
    model.findOne.mockReturnValue(execQuery(doc))

    const result = await repository.findByCode('PENDING')

    expect(model.findOne).toHaveBeenCalledWith({ code: 'PENDING' })
    expect(result).toBe(doc)
  })

  it('devuelve null cuando no existe', async () => {
    const { repository, model } = makeRepository()
    model.findOne.mockReturnValue(execQuery(null))

    await expect(repository.findByCode('MISSING')).resolves.toBeNull()
  })
})

describe('OrderStateRepository.create (RQ-CFG-06)', () => {
  it('crea el estado activo por defecto', async () => {
    const { repository, model } = makeRepository()
    const doc = { code: 'PREPARING', name: 'Preparando', order: 3, active: true }
    model.create.mockResolvedValue(doc)

    const result = await repository.create({ code: 'PREPARING', name: 'Preparando', order: 3 })

    expect(model.create).toHaveBeenCalledWith({
      code: 'PREPARING',
      name: 'Preparando',
      order: 3,
      active: true,
    })
    expect(result).toBe(doc)
  })
})

describe('OrderStateRepository.update (RQ-CFG-06)', () => {
  it('actualiza los campos indicados y devuelve el documento nuevo', async () => {
    const { repository, model } = makeRepository()
    const doc = { code: 'PENDING', name: 'Nuevo', order: 2 }
    model.findOneAndUpdate.mockReturnValue(execQuery(doc))

    const result = await repository.update('PENDING', { name: 'Nuevo', order: 2 })

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { code: 'PENDING' },
      { $set: { name: 'Nuevo', order: 2 } },
      { new: true },
    )
    expect(result).toBe(doc)
  })

  it('devuelve null si el estado no existe', async () => {
    const { repository, model } = makeRepository()
    model.findOneAndUpdate.mockReturnValue(execQuery(null))

    await expect(repository.update('MISSING', { name: 'X' })).resolves.toBeNull()
  })
})

describe('OrderStateRepository.setActive (RQ-CFG-06)', () => {
  const cases: Array<{ name: string; active: boolean }> = [
    { name: 'activa', active: true },
    { name: 'desactiva', active: false },
  ]

  it.each(cases)('$name el estado', async ({ active }) => {
    const { repository, model } = makeRepository()
    const doc = { code: 'PENDING', active }
    model.findOneAndUpdate.mockReturnValue(execQuery(doc))

    const result = await repository.setActive('PENDING', active)

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { code: 'PENDING' },
      { $set: { active } },
      { new: true },
    )
    expect(result).toBe(doc)
  })

  it('devuelve null si el estado no existe', async () => {
    const { repository, model } = makeRepository()
    model.findOneAndUpdate.mockReturnValue(execQuery(null))

    await expect(repository.setActive('MISSING', true)).resolves.toBeNull()
  })
})
