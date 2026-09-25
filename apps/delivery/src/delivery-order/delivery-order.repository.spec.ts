import { Model } from 'mongoose'
import { DeliveryOrderDocument, serializeDeliveryOrder } from './delivery-order.model'
import { DeliveryOrderRepository } from './delivery-order.repository'

const makeRepository = () => {
  const model = {
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
    find: jest.fn(),
    updateMany: jest.fn(),
  }
  const repository = new DeliveryOrderRepository(model as unknown as Model<DeliveryOrderDocument>)
  return { repository, model }
}

const execChain = (result: unknown) => ({ exec: jest.fn().mockResolvedValue(result) })

const upsertInput = {
  orderId: 'ord-1',
  branchId: 'b1',
  branchLocation: { latitude: -34.6, longitude: -58.4 },
  deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
}

describe('DeliveryOrderRepository', () => {
  it('upsertReady hace upsert por orderId y resetea reserva y rotación', async () => {
    const { repository, model } = makeRepository()
    const saved = { orderId: 'ord-1' }
    model.findOneAndUpdate.mockReturnValue(execChain(saved))

    const result = await repository.upsertReady(upsertInput)

    expect(result).toBe(saved)
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { orderId: 'ord-1' },
      {
        $set: {
          branchId: 'b1',
          branchLocation: { latitude: -34.6, longitude: -58.4 },
          deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
          status: 'ready',
          tripId: null,
          reservedUntil: null,
          rotationRoster: null,
          rotationIndex: null,
          rotationTurnUntil: null,
        },
      },
      { new: true, upsert: true },
    )
  })

  it('upsertReady es idempotente por clave: dos eventos del mismo pedido usan el mismo filtro/upsert', async () => {
    const { repository, model } = makeRepository()
    model.findOneAndUpdate.mockReturnValue(execChain({ orderId: 'ord-1' }))

    await repository.upsertReady(upsertInput)
    await repository.upsertReady({ ...upsertInput, branchId: 'b2' })

    const filters = model.findOneAndUpdate.mock.calls.map((call) => call[0])
    const options = model.findOneAndUpdate.mock.calls.map((call) => call[2])
    expect(filters).toEqual([{ orderId: 'ord-1' }, { orderId: 'ord-1' }])
    expect(options).toEqual([
      { new: true, upsert: true },
      { new: true, upsert: true },
    ])
  })

  it('remove borra por orderId', async () => {
    const { repository, model } = makeRepository()
    const removed = { deletedCount: 1 }
    model.deleteOne.mockReturnValue(execChain(removed))

    const result = await repository.remove('ord-1')

    expect(result).toBe(removed)
    expect(model.deleteOne).toHaveBeenCalledWith({ orderId: 'ord-1' })
  })

  it('listReadyDocs filtra por ready y ordena por createdAt ascendente', async () => {
    const { repository, model } = makeRepository()
    const docs = [{ orderId: 'ord-1' }]
    const exec = jest.fn().mockResolvedValue(docs)
    const sort = jest.fn().mockReturnValue({ exec })
    model.find.mockReturnValue({ sort })

    const result = await repository.listReadyDocs()

    expect(result).toBe(docs)
    expect(model.find).toHaveBeenCalledWith({ status: 'ready' })
    expect(sort).toHaveBeenCalledWith({ createdAt: 1 })
  })

  it('findReservedDocsByTripId filtra por tripId reservado', async () => {
    const { repository, model } = makeRepository()
    const docs = [{ orderId: 'ord-1' }]
    model.find.mockReturnValue(execChain(docs))

    const result = await repository.findReservedDocsByTripId('t1')

    expect(result).toBe(docs)
    expect(model.find).toHaveBeenCalledWith({ tripId: 't1', status: 'reserved' })
  })

  it('findExpiredReservedDocs busca reservas con reservedUntil anterior a now', async () => {
    const { repository, model } = makeRepository()
    const now = new Date('2026-01-01T00:00:00.000Z')
    model.find.mockReturnValue(execChain([]))

    await repository.findExpiredReservedDocs(now)

    expect(model.find).toHaveBeenCalledWith({
      status: 'reserved',
      reservedUntil: { $lt: now },
    })
  })

  it('reserve devuelve la cantidad de órdenes efectivamente reservadas', async () => {
    const { repository, model } = makeRepository()
    const until = new Date('2026-01-01T00:01:00.000Z')
    model.updateMany.mockReturnValue(execChain({ matchedCount: 2, modifiedCount: 2 }))

    const result = await repository.reserve(['ord-1', 'ord-2'], 't1', until)

    expect(result).toBe(2)
    expect(model.updateMany).toHaveBeenCalledWith(
      { orderId: { $in: ['ord-1', 'ord-2'] }, status: 'ready' },
      { $set: { status: 'reserved', tripId: 't1', reservedUntil: until } },
    )
  })

  it.each([
    { name: 'ninguna orden disponible', matchedCount: 0 },
    { name: 'todas las órdenes disponibles', matchedCount: 2 },
  ])('reserve reporta matchedCount=$matchedCount ($name)', async ({ matchedCount }) => {
    const { repository, model } = makeRepository()
    model.updateMany.mockReturnValue(execChain({ matchedCount }))

    await expect(
      repository.reserve(['ord-1', 'ord-2'], 't1', new Date('2026-01-01T00:01:00.000Z')),
    ).resolves.toBe(matchedCount)
  })

  it('markAssigned marca reservadas del viaje como assigned y limpia reservedUntil', async () => {
    const { repository, model } = makeRepository()
    model.updateMany.mockReturnValue(execChain({ matchedCount: 1 }))

    await repository.markAssigned(['ord-1'], 't1')

    expect(model.updateMany).toHaveBeenCalledWith(
      { orderId: { $in: ['ord-1'] }, tripId: 't1', status: 'reserved' },
      { $set: { status: 'assigned', reservedUntil: null } },
    )
  })
})

describe('serializeDeliveryOrder', () => {
  it('expone solo los campos públicos del pool', () => {
    const doc = {
      orderId: 'ord-1',
      branchId: 'b1',
      branchLocation: { latitude: 1, longitude: 2 },
      deliveryAddress: { text: 'Av', latitude: 3, longitude: 4 },
      status: 'ready',
    } as unknown as DeliveryOrderDocument

    expect(serializeDeliveryOrder(doc)).toEqual({
      orderId: 'ord-1',
      branchId: 'b1',
      branchLocation: { latitude: 1, longitude: 2 },
      deliveryAddress: { text: 'Av', latitude: 3, longitude: 4 },
      status: 'ready',
    })
  })
})
