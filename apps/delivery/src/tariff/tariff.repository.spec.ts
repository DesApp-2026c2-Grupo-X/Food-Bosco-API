import type { Model } from 'mongoose'
import type { DeliveryTariffDocument } from './tariff.model'
import { TariffRepository } from './tariff.repository'

const execQuery = <T>(result: T): { exec: jest.Mock } => ({
  exec: jest.fn().mockResolvedValue(result),
})

const makeRepository = () => {
  const model = {
    findOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
  }
  const repository = new TariffRepository(model as unknown as Model<DeliveryTariffDocument>)
  return { repository, model }
}

describe('TariffRepository', () => {
  const validId = '64b000000000000000000011'

  it('findActive busca la tarifa con active=true', async () => {
    const { repository, model } = makeRepository()
    const doc = { baseFare: 500 }
    model.findOne.mockReturnValue(execQuery(doc))

    await expect(repository.findActive()).resolves.toBe(doc)
    expect(model.findOne).toHaveBeenCalledWith({ active: true })
  })

  it('findHistory ordena por effectiveFrom descendente y aplica el límite', async () => {
    const { repository, model } = makeRepository()
    const docs = [{ baseFare: 500 }]
    const query = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(docs),
    }
    model.find.mockReturnValue(query)

    await expect(repository.findHistory(20)).resolves.toBe(docs)
    expect(model.find).toHaveBeenCalledWith()
    expect(query.sort).toHaveBeenCalledWith({ effectiveFrom: -1 })
    expect(query.limit).toHaveBeenCalledWith(20)
  })

  it('insertInactive crea la versión con active=false', async () => {
    const { repository, model } = makeRepository()
    const data = {
      baseFare: 500,
      perKm: 200,
      perOrder: 300,
      currency: 'ARS',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      createdBy: 'admin-1',
    }
    const doc = { ...data, active: false }
    model.create.mockResolvedValue(doc)

    await expect(repository.insertInactive(data)).resolves.toBe(doc)
    expect(model.create).toHaveBeenCalledWith({ ...data, active: false })
  })

  it('insertActive crea la tarifa bootstrap ya vigente', async () => {
    const { repository, model } = makeRepository()
    const data = {
      baseFare: 500,
      perKm: 200,
      perOrder: 300,
      currency: 'ARS',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      createdBy: 'system:bootstrap',
    }
    const doc = { ...data, active: true }
    model.create.mockResolvedValue(doc)

    await expect(repository.insertActive(data)).resolves.toBe(doc)
    expect(model.create).toHaveBeenCalledWith({ ...data, active: true })
  })

  it('deactivateAll actualiza sólo las activas', async () => {
    const { repository, model } = makeRepository()
    model.updateMany.mockReturnValue(execQuery({ modifiedCount: 1 }))

    await expect(repository.deactivateAll()).resolves.toBe(1)
    expect(model.updateMany).toHaveBeenCalledWith({ active: true }, { $set: { active: false } })
  })

  it('activateById activa y devuelve el documento actualizado', async () => {
    const { repository, model } = makeRepository()
    const doc = { baseFare: 500, active: true }
    model.updateOne.mockReturnValue(execQuery({ matchedCount: 1 }))
    model.findById.mockReturnValue(execQuery(doc))

    await expect(repository.activateById(validId)).resolves.toBe(doc)
    expect(model.updateOne).toHaveBeenCalledWith({ _id: validId }, { $set: { active: true } })
    expect(model.findById).toHaveBeenCalledWith(validId)
  })

  it('activateById devuelve null si el id no matchea', async () => {
    const { repository, model } = makeRepository()
    model.updateOne.mockReturnValue(execQuery({ matchedCount: 0 }))

    await expect(repository.activateById(validId)).resolves.toBeNull()
    expect(model.findById).not.toHaveBeenCalled()
  })

  it.each(['abc', '', '123'])('activateById ignora ids inválidos (%s)', async (id) => {
    const { repository, model } = makeRepository()

    await expect(repository.activateById(id)).resolves.toBeNull()
    expect(model.updateOne).not.toHaveBeenCalled()
  })

  it('deleteById elimina la versión indicada', async () => {
    const { repository, model } = makeRepository()
    model.deleteOne.mockReturnValue(execQuery({ deletedCount: 1 }))

    await expect(repository.deleteById(validId)).resolves.toBe(true)
    expect(model.deleteOne).toHaveBeenCalledWith({ _id: validId })
  })

  it('deleteById devuelve false si no existe o el id es inválido', async () => {
    const { repository, model } = makeRepository()
    model.deleteOne.mockReturnValue(execQuery({ deletedCount: 0 }))

    await expect(repository.deleteById(validId)).resolves.toBe(false)
    await expect(repository.deleteById('abc')).resolves.toBe(false)
    expect(model.deleteOne).toHaveBeenCalledTimes(1)
  })

  it('countActive cuenta las tarifas activas', async () => {
    const { repository, model } = makeRepository()
    model.countDocuments.mockReturnValue(execQuery(1))

    await expect(repository.countActive()).resolves.toBe(1)
    expect(model.countDocuments).toHaveBeenCalledWith({ active: true })
  })
})
