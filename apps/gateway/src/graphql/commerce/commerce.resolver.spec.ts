import type { GraphQLContext } from '../../gateway/gateway.context'
import type { RestClient } from '../../rest/rest.client'
import { OrderStatus } from '../common/order-status.enum'
import { CommerceResolver } from './commerce.resolver'

const ctx = {
  authenticated: true,
  userId: 'u1',
  roles: ['customer'],
  branchId: null,
  requestId: 'rid-1',
  authorization: 'Bearer xyz',
} as unknown as GraphQLContext

const rawCategory = { id: 'c1', name: 'Hamburguesas', active: true }

const rawProduct = {
  id: 'p1',
  categoryId: 'c1',
  name: 'Hamburguesa',
  description: 'Clásica',
  price: 100,
  image: null,
  available: true,
  configGroups: [],
  recipe: [],
}

const rawOrder = {
  id: 'o1',
  number: '000123',
  clientId: 'u1',
  branchId: 'b1',
  addressId: 'a1',
  deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
  status: 'pending',
  total: 100,
  estimatedDeliveryAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  items: [],
  statusHistory: [],
  availableTransitions: ['confirmed', 'cancelled'],
}

describe('CommerceResolver — queries', () => {
  const rest = { get: jest.fn() }
  const authRest = { get: jest.fn() }
  const resolver = new CommerceResolver(
    rest as unknown as RestClient,
    authRest as unknown as RestClient,
  )

  beforeEach(() => jest.clearAllMocks())

  it('categories → GET /v1/catalog/categories y mapea data', async () => {
    rest.get.mockResolvedValue({ data: [rawCategory] })

    const result = await resolver.categories(null, null, ctx)

    expect(rest.get).toHaveBeenCalledWith(
      '/v1/catalog/categories',
      expect.objectContaining({ query: expect.objectContaining({ activeOnly: undefined }) }),
    )
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Hamburguesas')
  })

  it('product → GET /v1/catalog/products/{id}', async () => {
    rest.get.mockResolvedValue(rawProduct)

    const result = await resolver.product('p1', ctx)

    expect(rest.get).toHaveBeenCalledWith('/v1/catalog/products/p1', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.id).toBe('p1')
    expect(result.price).toBe(100)
  })

  it('order → GET /v1/orders/{id} y mapea status/transiciones', async () => {
    rest.get.mockResolvedValue(rawOrder)

    const result = await resolver.order('o1', ctx)

    expect(result.status).toBe(OrderStatus.PENDING)
    expect(result.availableTransitions).toEqual([OrderStatus.CONFIRMED, OrderStatus.CANCELLED])
  })
})

describe('CommerceResolver — mutations', () => {
  const rest = { post: jest.fn(), patch: jest.fn() }
  const authRest = { get: jest.fn() }
  const resolver = new CommerceResolver(
    rest as unknown as RestClient,
    authRest as unknown as RestClient,
  )

  beforeEach(() => jest.clearAllMocks())

  it('createOrder → valida la dirección contra Auth y confirma el pedido', async () => {
    authRest.get.mockResolvedValue({
      id: 'a1',
      text: 'Av 1',
      latitude: 0,
      longitude: 0,
    })
    rest.post.mockResolvedValue(rawOrder)

    const result = await resolver.createOrder('a1', ctx)

    expect(authRest.get).toHaveBeenCalledWith('/v1/addresses/a1', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(rest.post).toHaveBeenCalledWith(
      '/v1/orders',
      expect.objectContaining({
        body: { addressId: 'a1', deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 } },
      }),
    )
    expect(result.number).toBe('000123')
  })

  it('changeOrderStatus → PATCH /v1/orders/{id}/status con el status en snake_case', async () => {
    rest.patch.mockResolvedValue({ ...rawOrder, status: 'confirmed' })

    const result = await resolver.changeOrderStatus('o1', OrderStatus.CONFIRMED, ctx)

    expect(rest.patch).toHaveBeenCalledWith('/v1/orders/o1/status', {
      body: { status: 'confirmed' },
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.status).toBe(OrderStatus.CONFIRMED)
  })

  it('addCartItem → POST /v1/carts/items y devuelve el carrito', async () => {
    rest.post.mockResolvedValue({
      id: 'cart1',
      clientId: 'u1',
      status: 'active',
      items: [],
      total: 0,
    })

    await resolver.addCartItem({ productId: 'p1', quantity: 1 }, ctx)

    expect(rest.post).toHaveBeenCalledWith('/v1/carts/items', {
      body: { productId: 'p1', quantity: 1 },
      context: expect.objectContaining({ userId: 'u1' }),
    })
  })
})
