import { CART_STATUS } from '../config/constants'
import type { CartDocument } from './cart.model'
import type { CartItemData, CartRepository } from './cart.repository'
import { CartService } from './cart.service'

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): CartDocument =>
  ({
    _id: { toString: () => 'cart1' },
    clientId: 'c1',
    status: CART_STATUS.active,
    items: [],
    total: 0,
    ...overrides,
  }) as unknown as CartDocument

const makeService = (repository: Partial<CartRepository> = {}) => {
  const repo = {
    findActiveByClient: jest.fn(),
    findById: jest.fn(),
    createActive: jest.fn(),
    setItemsAndTotal: jest.fn(),
    confirm: jest.fn(),
    ...repository,
  }
  return { service: new CartService(repo as unknown as CartRepository), repo }
}

describe('CartService.findActiveByClient (RQ-CART-01)', () => {
  it.each([
    { name: 'carrito activo existente', doc: buildDoc(), expected: true },
    { name: 'cliente sin carrito', doc: null, expected: false },
  ])('$name → encontrado = $expected', async ({ doc, expected }) => {
    const { service, repo } = makeService({
      findActiveByClient: jest.fn().mockResolvedValue(doc),
    })

    const result = await service.findActiveByClient('c1')

    expect(repo.findActiveByClient).toHaveBeenCalledWith('c1')
    if (expected) {
      expect(result).toMatchObject({ id: 'cart1', clientId: 'c1', status: CART_STATUS.active })
    } else {
      expect(result).toBeNull()
    }
  })
})

describe('CartService.findById (RQ-CART-01)', () => {
  it.each([
    { name: 'existente', doc: buildDoc(), expected: true },
    { name: 'inexistente', doc: null, expected: false },
  ])('$name → encontrado = $expected', async ({ doc, expected }) => {
    const { service, repo } = makeService({ findById: jest.fn().mockResolvedValue(doc) })

    const result = await service.findById('cart1')

    expect(repo.findById).toHaveBeenCalledWith('cart1')
    expect(result !== null).toBe(expected)
  })
})

describe('CartService.createActive (RQ-CART-01)', () => {
  it('crea y serializa un carrito vacío activo', async () => {
    const { service, repo } = makeService({
      createActive: jest.fn().mockResolvedValue(buildDoc()),
    })

    const result = await service.createActive('c1')

    expect(repo.createActive).toHaveBeenCalledWith('c1')
    expect(result).toMatchObject({ id: 'cart1', status: CART_STATUS.active, items: [], total: 0 })
  })
})

describe('CartService.replaceItems (RQ-CART-04/06/07)', () => {
  const items: CartItemData[] = [
    { productId: 'p1', quantity: 2, observations: 'sin sal', optionIds: ['opt1'] },
  ]

  it('reemplaza los ítems y el total, y serializa el resultado', async () => {
    const { service, repo } = makeService({
      setItemsAndTotal: jest.fn().mockResolvedValue(
        buildDoc({
          items: [
            {
              _id: { toString: () => 'i1' },
              productId: 'p1',
              quantity: 2,
              observations: 'sin sal',
              optionIds: ['opt1'],
            },
          ],
          total: 300,
        }),
      ),
    })

    const result = await service.replaceItems('cart1', items, 300)

    expect(repo.setItemsAndTotal).toHaveBeenCalledWith('cart1', items, 300)
    expect(result?.items[0]).toEqual({
      id: 'i1',
      productId: 'p1',
      quantity: 2,
      observations: 'sin sal',
      optionIds: ['opt1'],
    })
    expect(result?.total).toBe(300)
  })

  it.each([
    { name: 'vaciar el carrito', items: [] as CartItemData[], total: 0 },
    { name: 'recibir varios ítems', items: [...items, ...items], total: 600 },
  ])('$name → aplica el total recibido', async ({ items: nextItems, total }) => {
    const { service, repo } = makeService({
      setItemsAndTotal: jest.fn().mockResolvedValue(buildDoc({ items: nextItems, total })),
    })

    const result = await service.replaceItems('cart1', nextItems, total)

    expect(repo.setItemsAndTotal).toHaveBeenCalledWith('cart1', nextItems, total)
    expect(result?.total).toBe(total)
  })

  it('devuelve null si el carrito no existe', async () => {
    const { service, repo } = makeService({
      setItemsAndTotal: jest.fn().mockResolvedValue(null),
    })

    await expect(service.replaceItems('missing', items, 100)).resolves.toBeNull()
    expect(repo.setItemsAndTotal).toHaveBeenCalledWith('missing', items, 100)
  })
})

describe('CartService.confirm (RQ-CART-08/09)', () => {
  it.each([
    { name: 'carrito activo', doc: buildDoc({ status: CART_STATUS.confirmed }), expected: true },
    { name: 'carrito inexistente', doc: null, expected: false },
  ])('$name → confirmado = $expected', async ({ doc, expected }) => {
    const { service, repo } = makeService({ confirm: jest.fn().mockResolvedValue(doc) })

    const result = await service.confirm('cart1')

    expect(repo.confirm).toHaveBeenCalledWith('cart1')
    if (expected) {
      expect(result?.status).toBe(CART_STATUS.confirmed)
    } else {
      expect(result).toBeNull()
    }
  })
})
