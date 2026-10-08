import type { Model } from 'mongoose'
import type { CartDocument } from './cart.model'
import { CartRepository } from './cart.repository'

const execQuery = <T>(result: T): { exec: jest.Mock } => ({
  exec: jest.fn().mockResolvedValue(result),
})

const makeRepository = () => {
  const model = {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  }
  return {
    repository: new CartRepository(model as unknown as Model<CartDocument>),
    model,
  }
}

describe('CartRepository.setItemsAndTotal (RQ-CART-04/05)', () => {
  it('preserva el _id de los ítems existentes al reemplazar el arreglo', async () => {
    const { repository, model } = makeRepository()
    const doc = { _id: 'cart1' }
    model.findByIdAndUpdate.mockReturnValue(execQuery(doc))

    const result = await repository.setItemsAndTotal(
      'cart1',
      [
        { id: 'i1', productId: 'p1', quantity: 2, observations: null, optionIds: [] },
        { productId: 'p2', quantity: 1, observations: null, optionIds: [] },
      ],
      300,
    )

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'cart1',
      {
        $set: {
          items: [
            { _id: 'i1', productId: 'p1', quantity: 2, observations: null, optionIds: [] },
            { productId: 'p2', quantity: 1, observations: null, optionIds: [] },
          ],
          total: 300,
        },
      },
      { new: true },
    )
    expect(result).toBe(doc)
  })

  it('omite el _id cuando el ítem es nuevo para que Mongo lo genere', async () => {
    const { repository, model } = makeRepository()
    model.findByIdAndUpdate.mockReturnValue(execQuery(null))

    await repository.setItemsAndTotal(
      'cart1',
      [{ productId: 'p1', quantity: 1, observations: null, optionIds: [] }],
      100,
    )

    const payload = model.findByIdAndUpdate.mock.calls[0][1] as { $set: { items: unknown[] } }
    expect(payload.$set.items[0]).toEqual({
      productId: 'p1',
      quantity: 1,
      observations: null,
      optionIds: [],
    })
    expect(payload.$set.items[0]).not.toHaveProperty('_id')
  })

  it('devuelve null cuando el carrito no existe', async () => {
    const { repository, model } = makeRepository()
    model.findByIdAndUpdate.mockReturnValue(execQuery(null))

    await expect(repository.setItemsAndTotal('missing', [], 0)).resolves.toBeNull()
  })
})
