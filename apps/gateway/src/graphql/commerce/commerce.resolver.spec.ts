import type { GraphQLContext } from '../../gateway/gateway.context'
import type { RestClient } from '../../rest/rest.client'
import { ConfigGroupType } from '../common/config-group-type.enum'
import { OrderStatus } from '../common/order-status.enum'
import { CommerceResolver } from './commerce.resolver'

type RawRecord = Record<string, unknown>
type ResolverInvoker = (resolver: CommerceResolver) => Promise<unknown>

const ctx = {
  authenticated: true,
  userId: 'u1',
  roles: ['customer'],
  branchId: null,
  requestId: 'rid-1',
  authorization: 'Bearer xyz',
} as unknown as GraphQLContext

const restMock = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}
const authMock = { get: jest.fn() }
const deliveryMock = { post: jest.fn() }
const resolver = new CommerceResolver(
  restMock as unknown as RestClient,
  authMock as unknown as RestClient,
  deliveryMock as unknown as RestClient,
)

beforeEach(() => jest.resetAllMocks())

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
const rawIngredient = { id: 'i1', name: 'Carne', unit: 'g', active: true }
const rawPromotion = {
  id: 'pr1',
  name: '2x1',
  description: null,
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  active: true,
}
const rawBranchHour = { dayOfWeek: 1, opening: '09:00', closing: '18:00', closed: false }
const rawBranch = {
  id: 'b1',
  name: 'Centro',
  addressText: 'Av 1',
  latitude: -34,
  longitude: -58,
  phone: null,
  active: true,
  hours: [rawBranchHour],
}
const rawCart = {
  id: 'cart1',
  clientId: 'u1',
  status: 'active',
  items: [{ id: 'ci1', productId: 'p1', quantity: 2, observations: null, optionIds: [] }],
  total: 200,
}
const rawOrder = {
  id: 'o1',
  number: '000123',
  clientId: 'u1',
  riderId: 'r1',
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
const rawStatusHistory = { previousStatus: 'pending', newStatus: 'confirmed', changedAt: 't' }
const rawStock = { ingredientId: 'i1', branchId: 'b1', quantity: 10 }
const rawReportRow = {
  position: 1,
  product: rawProduct,
  category: rawCategory,
  quantity: 5,
  revenue: 500,
}
const rawOutOfStock = { product: rawProduct, category: null, quantity: 0 }
const rawParameter = { key: 'delivery_fee', value: 50, unit: 'ARS' }
const rawOrderState = { code: 'pending', name: 'Pendiente', order: 1, active: true }

const categoryInput = { name: 'Bebidas', active: true }
const productInput = {
  categoryId: 'c1',
  name: 'Hamburguesa',
  description: 'Clásica',
  price: 100,
  image: 'https://cdn/p1.png',
  available: true,
}
const configGroupInput = {
  name: 'Extras',
  type: ConfigGroupType.MULTIPLE,
  required: false,
  min: 1,
  max: 2,
}
const configOptionInput = { name: 'Queso', extraPrice: 5, available: true }
const recipeItemInput = { ingredientId: 'i1', quantity: 100 }
const ingredientInput = { name: 'Carne', unit: 'g', active: true }
const promotionInput = {
  name: '2x1',
  description: 'Dos por uno',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  active: true,
}
const branchInput = {
  name: 'Centro',
  addressText: 'Av 1',
  latitude: -34,
  longitude: -58,
  phone: '123',
  active: true,
}
const branchHoursInput = [rawBranchHour]
const addCartItemInput = {
  productId: 'p1',
  quantity: 2,
  observations: 'sin cebolla',
  optionIds: ['o1'],
}
const updateCartItemInput = { quantity: 3 }
const adjustStockInput = { branchId: 'b1', ingredientId: 'i1', delta: -2, reason: 'venta' }
const orderStateInput = { name: 'Pendiente', order: 1, active: true }

describe('CommerceResolver — lookups por id', () => {
  interface LookupCase {
    name: string
    path: string
    raw: RawRecord
    expectedId: string
    invoke: ResolverInvoker
  }

  const cases: LookupCase[] = [
    {
      name: 'category',
      path: '/v1/catalog/categories/c1',
      raw: rawCategory,
      expectedId: 'c1',
      invoke: (r) => r.category('c1', ctx),
    },
    {
      name: 'product',
      path: '/v1/catalog/products/p1',
      raw: rawProduct,
      expectedId: 'p1',
      invoke: (r) => r.product('p1', ctx),
    },
    {
      name: 'ingredient',
      path: '/v1/catalog/ingredients/i1',
      raw: rawIngredient,
      expectedId: 'i1',
      invoke: (r) => r.ingredient('i1', ctx),
    },
    {
      name: 'promotion',
      path: '/v1/catalog/promotions/pr1',
      raw: rawPromotion,
      expectedId: 'pr1',
      invoke: (r) => r.promotion('pr1', ctx),
    },
    {
      name: 'branch',
      path: '/v1/branches/b1',
      raw: rawBranch,
      expectedId: 'b1',
      invoke: (r) => r.branch('b1', ctx),
    },
    {
      name: 'order',
      path: '/v1/orders/o1',
      raw: rawOrder,
      expectedId: 'o1',
      invoke: (r) => r.order('o1', ctx),
    },
  ]

  it.each(cases)(
    '$name → GET $path y mapea la entidad',
    async ({ path, raw, expectedId, invoke }) => {
      restMock.get.mockResolvedValue(raw)

      const result = (await invoke(resolver)) as { id: string }

      expect(restMock.get).toHaveBeenCalledTimes(1)
      expect(restMock.get).toHaveBeenCalledWith(path, {
        context: expect.objectContaining({ userId: 'u1', authorization: 'Bearer xyz' }),
      })
      expect(result.id).toBe(expectedId)
    },
  )

  it('order → convierte status y availableTransitions', async () => {
    restMock.get.mockResolvedValue(rawOrder)

    const result = await resolver.order('o1', ctx)

    expect(result.status).toBe(OrderStatus.PENDING)
    expect(result.availableTransitions).toEqual([OrderStatus.CONFIRMED, OrderStatus.CANCELLED])
    expect(result.deliveryAddress).toEqual({ text: 'Av 1', latitude: 0, longitude: 0 })
  })

  it('product → mapea price numérico y colecciones', async () => {
    restMock.get.mockResolvedValue(rawProduct)

    const result = await resolver.product('p1', ctx)

    expect(result.price).toBe(100)
    expect(result.configGroups).toEqual([])
    expect(result.recipe).toEqual([])
  })
})

describe('CommerceResolver — listas envueltas en data', () => {
  interface ListCase {
    name: string
    path: string
    data: RawRecord[]
    query?: RawRecord
    invoke: ResolverInvoker
  }

  const cases: ListCase[] = [
    {
      name: 'categories',
      path: '/v1/catalog/categories',
      data: [rawCategory],
      query: { activeOnly: undefined, limit: undefined, offset: undefined },
      invoke: (r) => r.categories(null, null, ctx),
    },
    {
      name: 'products',
      path: '/v1/catalog/products',
      data: [rawProduct],
      query: {
        categoryId: undefined,
        search: undefined,
        available: undefined,
        limit: undefined,
        offset: undefined,
      },
      invoke: (r) => r.products(null, null, ctx),
    },
    {
      name: 'ingredients',
      path: '/v1/catalog/ingredients',
      data: [rawIngredient],
      query: { activeOnly: undefined, limit: undefined, offset: undefined },
      invoke: (r) => r.ingredients(null, null, ctx),
    },
    {
      name: 'promotions',
      path: '/v1/catalog/promotions',
      data: [rawPromotion],
      query: { activeOnly: undefined, limit: undefined, offset: undefined },
      invoke: (r) => r.promotions(null, null, ctx),
    },
    {
      name: 'branches',
      path: '/v1/branches',
      data: [rawBranch],
      query: { active: undefined, search: undefined, limit: undefined, offset: undefined },
      invoke: (r) => r.branches(null, null, ctx),
    },
    {
      name: 'myOrders',
      path: '/v1/orders',
      data: [rawOrder],
      query: {
        status: undefined,
        branchId: undefined,
        search: undefined,
        limit: undefined,
        offset: undefined,
      },
      invoke: (r) => r.myOrders(null, null, ctx),
    },
    {
      name: 'orders',
      path: '/v1/orders',
      data: [rawOrder],
      query: {
        status: undefined,
        branchId: undefined,
        search: undefined,
        limit: undefined,
        offset: undefined,
      },
      invoke: (r) => r.orders(null, null, ctx),
    },
    {
      name: 'branchProducts',
      path: '/v1/branches/b1/products',
      data: [rawProduct],
      invoke: (r) => r.branchProducts('b1', ctx),
    },
  ]

  it.each(cases)('$name → GET $path mapea data', async ({ path, data, query, invoke }) => {
    restMock.get.mockResolvedValue({ data })

    const result = (await invoke(resolver)) as unknown[]

    expect(restMock.get).toHaveBeenCalledWith(path, {
      context: expect.objectContaining({ userId: 'u1' }),
      ...(query ? { query } : {}),
    })
    expect(result).toHaveLength(1)
  })

  it('products con lat/lng → GET /v1/branches/available/products y usa availableInBranch', async () => {
    restMock.get.mockResolvedValue({
      data: [{ ...rawProduct, available: true, availableInBranch: false }],
    })

    const result = await resolver.products({ lat: -34.6, lng: -58.4 }, null, ctx)

    expect(restMock.get).toHaveBeenCalledWith('/v1/branches/available/products', {
      context: expect.objectContaining({ userId: 'u1' }),
      query: { lat: -34.6, lng: -58.4 },
    })
    expect(result[0].available).toBe(false)
  })

  it.each<Partial<{ lat: number; lng: number }>>([
    { lat: -34.6 },
    { lng: -58.4 },
    { lat: undefined, lng: -58.4 },
  ])('products sin lat y lng completos cae al catálogo: %p', async (filter) => {
    restMock.get.mockResolvedValue({ data: [] })

    await resolver.products(filter, null, ctx)

    expect(restMock.get).toHaveBeenCalledWith(
      '/v1/catalog/products',
      expect.objectContaining({ query: expect.not.objectContaining({ lat: expect.anything() }) }),
    )
  })

  it('branchProducts sobrescribe available con availableInBranch', async () => {
    restMock.get.mockResolvedValue({ data: [{ ...rawProduct, availableInBranch: true }] })

    const result = await resolver.branchProducts('b1', ctx)

    expect(result[0].available).toBe(true)
  })
})

describe('CommerceResolver — listas planas', () => {
  interface ListCase {
    name: string
    path: string
    data: RawRecord[]
    query?: RawRecord
    invoke: ResolverInvoker
  }

  const cases: ListCase[] = [
    {
      name: 'branchHours',
      path: '/v1/branches/b1/hours',
      data: [rawBranchHour],
      invoke: (r) => r.branchHours('b1', ctx),
    },
    {
      name: 'orderHistory',
      path: '/v1/orders/o1/history',
      data: [rawStatusHistory],
      invoke: (r) => r.orderHistory('o1', ctx),
    },
    {
      name: 'branchStock',
      path: '/v1/stock',
      data: [rawStock],
      query: { branchId: undefined },
      invoke: (r) => r.branchStock(null, ctx),
    },
    {
      name: 'bestSellingProducts',
      path: '/v1/reporting/products/best-sellers',
      data: [rawReportRow],
      query: { branchId: undefined },
      invoke: (r) => r.bestSellingProducts(null, ctx),
    },
    {
      name: 'leastSoldProducts',
      path: '/v1/reporting/products/least-sold',
      data: [rawReportRow],
      query: { branchId: undefined },
      invoke: (r) => r.leastSoldProducts(null, ctx),
    },
    {
      name: 'outOfStockProducts',
      path: '/v1/reporting/products/out-of-stock',
      data: [rawOutOfStock],
      query: { branchId: undefined },
      invoke: (r) => r.outOfStockProducts(null, ctx),
    },
    {
      name: 'highestRevenueProducts',
      path: '/v1/reporting/products/highest-revenue',
      data: [rawReportRow],
      query: { branchId: undefined },
      invoke: (r) => r.highestRevenueProducts(null, ctx),
    },
    {
      name: 'parameters',
      path: '/v1/config/parameters',
      data: [rawParameter],
      invoke: (r) => r.parameters(ctx),
    },
    {
      name: 'orderStates',
      path: '/v1/config/order-states',
      data: [rawOrderState],
      invoke: (r) => r.orderStates(ctx),
    },
  ]

  it.each(cases)('$name → GET $path mapea data', async ({ path, data, query, invoke }) => {
    restMock.get.mockResolvedValue(data)

    const result = (await invoke(resolver)) as unknown[]

    expect(restMock.get).toHaveBeenCalledWith(path, {
      context: expect.objectContaining({ userId: 'u1' }),
      ...(query ? { query } : {}),
    })
    expect(result).toHaveLength(1)
  })

  it('availableBranches → GET /v1/branches/available con lat/lng', async () => {
    restMock.get.mockResolvedValue([rawBranch])

    const result = await resolver.availableBranches(-34.6, -58.4, ctx)

    expect(restMock.get).toHaveBeenCalledWith('/v1/branches/available', {
      context: expect.objectContaining({ userId: 'u1' }),
      query: { lat: -34.6, lng: -58.4 },
    })
    expect(result[0].id).toBe('b1')
  })

  it('myCart → GET /v1/carts y mapea el carrito', async () => {
    restMock.get.mockResolvedValue(rawCart)

    const result = await resolver.myCart(ctx)

    expect(restMock.get).toHaveBeenCalledWith('/v1/carts', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.id).toBe('cart1')
    expect(result.items[0].productId).toBe('p1')
  })
})

describe('CommerceResolver — filtros y paginación', () => {
  it('categories → mapea activeOnly, limit y offset', async () => {
    restMock.get.mockResolvedValue({ data: [rawCategory] })

    await resolver.categories(true, { limit: 5, offset: 10 }, ctx)

    expect(restMock.get).toHaveBeenCalledWith('/v1/catalog/categories', {
      context: expect.objectContaining({ userId: 'u1' }),
      query: { activeOnly: true, limit: 5, offset: 10 },
    })
  })

  it('categories → activeOnly null se envía como undefined', async () => {
    restMock.get.mockResolvedValue({ data: [] })

    await resolver.categories(null, null, ctx)

    expect(restMock.get).toHaveBeenCalledWith('/v1/catalog/categories', {
      context: expect.objectContaining({ userId: 'u1' }),
      query: { activeOnly: undefined, limit: undefined, offset: undefined },
    })
  })

  it('products → mapea filtros de catálogo y paginación', async () => {
    restMock.get.mockResolvedValue({ data: [rawProduct] })

    await resolver.products(
      { categoryId: 'c1', search: 'hamb', available: true },
      { limit: 20, offset: 0 },
      ctx,
    )

    expect(restMock.get).toHaveBeenCalledWith('/v1/catalog/products', {
      context: expect.objectContaining({ userId: 'u1' }),
      query: {
        categoryId: 'c1',
        search: 'hamb',
        available: true,
        limit: 20,
        offset: 0,
      },
    })
  })

  it('branches → mapea active, search y paginación', async () => {
    restMock.get.mockResolvedValue({ data: [rawBranch] })

    await resolver.branches({ active: false, search: 'centro' }, { limit: 3, offset: 1 }, ctx)

    expect(restMock.get).toHaveBeenCalledWith('/v1/branches', {
      context: expect.objectContaining({ userId: 'u1' }),
      query: { active: false, search: 'centro', limit: 3, offset: 1 },
    })
  })

  it.each<[OrderStatus, string]>([
    [OrderStatus.PENDING, 'pending'],
    [OrderStatus.READY_FOR_DELIVERY, 'ready_for_delivery'],
    [OrderStatus.ON_THE_WAY, 'on_the_way'],
  ])('myOrders → traduce el status %s a "%s"', async (status, expected) => {
    restMock.get.mockResolvedValue({ data: [rawOrder] })

    await resolver.myOrders({ status, branchId: 'b1', search: 'x' }, { limit: 5, offset: 0 }, ctx)

    expect(restMock.get).toHaveBeenCalledWith('/v1/orders', {
      context: expect.objectContaining({ userId: 'u1' }),
      query: { status: expected, branchId: 'b1', search: 'x', limit: 5, offset: 0 },
    })
  })

  it('branchStock con branchId nulo lo envía undefined', async () => {
    restMock.get.mockResolvedValue([rawStock])

    await resolver.branchStock(null, ctx)

    expect(restMock.get).toHaveBeenCalledWith('/v1/stock', {
      context: expect.objectContaining({ userId: 'u1' }),
      query: { branchId: undefined },
    })
  })
})

describe('CommerceResolver — mutaciones', () => {
  interface MutationCase {
    name: string
    method: 'post' | 'patch' | 'put' | 'delete'
    path: string
    body?: unknown
    raw: unknown
    invoke: ResolverInvoker
  }

  const cases: MutationCase[] = [
    {
      name: 'createCategory',
      method: 'post',
      path: '/v1/catalog/categories',
      body: categoryInput,
      raw: rawCategory,
      invoke: (r) => r.createCategory(categoryInput, ctx),
    },
    {
      name: 'updateCategory',
      method: 'patch',
      path: '/v1/catalog/categories/c1',
      body: categoryInput,
      raw: rawCategory,
      invoke: (r) => r.updateCategory('c1', categoryInput, ctx),
    },
    {
      name: 'setCategoryActive',
      method: 'patch',
      path: '/v1/catalog/categories/c1/active',
      body: { active: false },
      raw: { ...rawCategory, active: false },
      invoke: (r) => r.setCategoryActive('c1', false, ctx),
    },
    {
      name: 'createProduct',
      method: 'post',
      path: '/v1/catalog/products',
      body: productInput,
      raw: rawProduct,
      invoke: (r) => r.createProduct(productInput, ctx),
    },
    {
      name: 'updateProduct',
      method: 'patch',
      path: '/v1/catalog/products/p1',
      body: productInput,
      raw: rawProduct,
      invoke: (r) => r.updateProduct('p1', productInput, ctx),
    },
    {
      name: 'setProductAvailable',
      method: 'patch',
      path: '/v1/catalog/products/p1/available',
      body: { available: false },
      raw: { ...rawProduct, available: false },
      invoke: (r) => r.setProductAvailable('p1', false, ctx),
    },
    {
      name: 'createConfigGroup',
      method: 'post',
      path: '/v1/catalog/products/p1/configurations',
      body: configGroupInput,
      raw: { id: 'g1', name: 'Extras', type: 'multiple', required: false, options: [] },
      invoke: (r) => r.createConfigGroup('p1', configGroupInput, ctx),
    },
    {
      name: 'updateConfigGroup',
      method: 'patch',
      path: '/v1/catalog/products/p1/configurations/g1',
      body: configGroupInput,
      raw: { id: 'g1', name: 'Extras', type: 'multiple', required: false, options: [] },
      invoke: (r) => r.updateConfigGroup('p1', 'g1', configGroupInput, ctx),
    },
    {
      name: 'deleteConfigGroup',
      method: 'delete',
      path: '/v1/catalog/products/p1/configurations/g1',
      raw: {},
      invoke: (r) => r.deleteConfigGroup('p1', 'g1', ctx),
    },
    {
      name: 'createConfigOption',
      method: 'post',
      path: '/v1/catalog/products/p1/configurations/g1/options',
      body: configOptionInput,
      raw: { id: 'o1', name: 'Queso', extraPrice: 5, available: true },
      invoke: (r) => r.createConfigOption('p1', 'g1', configOptionInput, ctx),
    },
    {
      name: 'updateConfigOption',
      method: 'patch',
      path: '/v1/catalog/products/p1/configurations/g1/options/o1',
      body: configOptionInput,
      raw: { id: 'o1', name: 'Queso', extraPrice: 5, available: true },
      invoke: (r) => r.updateConfigOption('p1', 'g1', 'o1', configOptionInput, ctx),
    },
    {
      name: 'deleteConfigOption',
      method: 'delete',
      path: '/v1/catalog/products/p1/configurations/g1/options/o1',
      raw: {},
      invoke: (r) => r.deleteConfigOption('p1', 'g1', 'o1', ctx),
    },
    {
      name: 'setProductRecipe',
      method: 'put',
      path: '/v1/catalog/products/p1/recipe',
      body: { items: [recipeItemInput] },
      raw: rawProduct,
      invoke: (r) => r.setProductRecipe('p1', [recipeItemInput], ctx),
    },
    {
      name: 'addRecipeItem',
      method: 'post',
      path: '/v1/catalog/products/p1/recipe/items',
      body: recipeItemInput,
      raw: rawProduct,
      invoke: (r) => r.addRecipeItem('p1', recipeItemInput, ctx),
    },
    {
      name: 'updateRecipeItem',
      method: 'patch',
      path: '/v1/catalog/products/p1/recipe/items/r1',
      body: recipeItemInput,
      raw: rawProduct,
      invoke: (r) => r.updateRecipeItem('p1', 'r1', recipeItemInput, ctx),
    },
    {
      name: 'removeRecipeItem',
      method: 'delete',
      path: '/v1/catalog/products/p1/recipe/items/r1',
      raw: rawProduct,
      invoke: (r) => r.removeRecipeItem('p1', 'r1', ctx),
    },
    {
      name: 'createIngredient',
      method: 'post',
      path: '/v1/catalog/ingredients',
      body: ingredientInput,
      raw: rawIngredient,
      invoke: (r) => r.createIngredient(ingredientInput, ctx),
    },
    {
      name: 'updateIngredient',
      method: 'patch',
      path: '/v1/catalog/ingredients/i1',
      body: ingredientInput,
      raw: rawIngredient,
      invoke: (r) => r.updateIngredient('i1', ingredientInput, ctx),
    },
    {
      name: 'setIngredientActive',
      method: 'patch',
      path: '/v1/catalog/ingredients/i1/active',
      body: { active: false },
      raw: { ...rawIngredient, active: false },
      invoke: (r) => r.setIngredientActive('i1', false, ctx),
    },
    {
      name: 'createPromotion',
      method: 'post',
      path: '/v1/catalog/promotions',
      body: promotionInput,
      raw: rawPromotion,
      invoke: (r) => r.createPromotion(promotionInput, ctx),
    },
    {
      name: 'updatePromotion',
      method: 'patch',
      path: '/v1/catalog/promotions/pr1',
      body: promotionInput,
      raw: rawPromotion,
      invoke: (r) => r.updatePromotion('pr1', promotionInput, ctx),
    },
    {
      name: 'setPromotionActive',
      method: 'patch',
      path: '/v1/catalog/promotions/pr1/active',
      body: { active: false },
      raw: { ...rawPromotion, active: false },
      invoke: (r) => r.setPromotionActive('pr1', false, ctx),
    },
    {
      name: 'createBranch',
      method: 'post',
      path: '/v1/branches',
      body: branchInput,
      raw: rawBranch,
      invoke: (r) => r.createBranch(branchInput, ctx),
    },
    {
      name: 'updateBranch',
      method: 'patch',
      path: '/v1/branches/b1',
      body: branchInput,
      raw: rawBranch,
      invoke: (r) => r.updateBranch('b1', branchInput, ctx),
    },
    {
      name: 'setBranchActive',
      method: 'patch',
      path: '/v1/branches/b1/active',
      body: { active: false },
      raw: { ...rawBranch, active: false },
      invoke: (r) => r.setBranchActive('b1', false, ctx),
    },
    {
      name: 'updateBranchHours',
      method: 'put',
      path: '/v1/branches/b1/hours',
      body: { hours: branchHoursInput },
      raw: [rawBranchHour],
      invoke: (r) => r.updateBranchHours('b1', branchHoursInput, ctx),
    },
    {
      name: 'setBranchProductAvailability',
      method: 'patch',
      path: '/v1/branches/b1/products/p1/availability',
      body: { available: true },
      raw: {},
      invoke: (r) => r.setBranchProductAvailability('b1', 'p1', true, ctx),
    },
    {
      name: 'addCartItem',
      method: 'post',
      path: '/v1/carts/items',
      body: addCartItemInput,
      raw: rawCart,
      invoke: (r) => r.addCartItem(addCartItemInput, ctx),
    },
    {
      name: 'updateCartItem',
      method: 'patch',
      path: '/v1/carts/items/ci1',
      body: updateCartItemInput,
      raw: rawCart,
      invoke: (r) => r.updateCartItem('ci1', updateCartItemInput, ctx),
    },
    {
      name: 'removeCartItem',
      method: 'delete',
      path: '/v1/carts/items/ci1',
      raw: rawCart,
      invoke: (r) => r.removeCartItem('ci1', ctx),
    },
    {
      name: 'changeOrderStatus',
      method: 'patch',
      path: '/v1/orders/o1/status',
      body: { status: 'confirmed' },
      raw: { ...rawOrder, status: 'confirmed' },
      invoke: (r) => r.changeOrderStatus('o1', OrderStatus.CONFIRMED, ctx),
    },
    {
      name: 'adjustStock',
      method: 'post',
      path: '/v1/stock/adjustments',
      body: adjustStockInput,
      raw: rawStock,
      invoke: (r) => r.adjustStock(adjustStockInput, ctx),
    },
    {
      name: 'updateParameter',
      method: 'patch',
      path: '/v1/config/parameters/delivery_fee',
      body: { value: 75 },
      raw: { ...rawParameter, value: 75 },
      invoke: (r) => r.updateParameter('delivery_fee', 75, ctx),
    },
    {
      name: 'createOrderState',
      method: 'post',
      path: '/v1/config/order-states',
      body: orderStateInput,
      raw: rawOrderState,
      invoke: (r) => r.createOrderState(orderStateInput, ctx),
    },
    {
      name: 'updateOrderState',
      method: 'put',
      path: '/v1/config/order-states/pending',
      body: orderStateInput,
      raw: rawOrderState,
      invoke: (r) => r.updateOrderState('pending', orderStateInput, ctx),
    },
    {
      name: 'setOrderStateActive',
      method: 'patch',
      path: '/v1/config/order-states/pending/active',
      body: { active: false },
      raw: { ...rawOrderState, active: false },
      invoke: (r) => r.setOrderStateActive('pending', false, ctx),
    },
  ]

  it.each(cases)('$name → ${method} $path con body y contexto', async (testCase) => {
    const { method, path, body, raw, invoke } = testCase
    restMock[method].mockResolvedValue(raw)

    await invoke(resolver)

    const expected: Record<string, unknown> = {
      context: expect.objectContaining({ userId: 'u1', authorization: 'Bearer xyz' }),
    }
    if (body !== undefined) {
      expected.body = body
    }

    expect(restMock[method]).toHaveBeenCalledTimes(1)
    expect(restMock[method]).toHaveBeenCalledWith(path, expected)
  })

  it('deleteConfigGroup y deleteConfigOption y setBranchProductAvailability devuelven true', async () => {
    restMock.delete.mockResolvedValue({})
    restMock.patch.mockResolvedValue({})

    await expect(resolver.deleteConfigGroup('p1', 'g1', ctx)).resolves.toBe(true)
    await expect(resolver.deleteConfigOption('p1', 'g1', 'o1', ctx)).resolves.toBe(true)
    await expect(resolver.setBranchProductAvailability('b1', 'p1', true, ctx)).resolves.toBe(true)
  })

  it('updateBranchHours mapea el arreglo de horarios devuelto', async () => {
    restMock.put.mockResolvedValue([
      { dayOfWeek: 1, opening: '09:00', closing: '18:00', closed: false },
      { dayOfWeek: 2, closed: true },
    ])

    const result = await resolver.updateBranchHours('b1', branchHoursInput, ctx)

    expect(result).toEqual([
      { dayOfWeek: 1, opening: '09:00', closing: '18:00', closed: false },
      { dayOfWeek: 2, opening: null, closing: null, closed: true },
    ])
  })

  it('setProductRecipe envuelve los items en { items }', async () => {
    restMock.put.mockResolvedValue(rawProduct)

    await resolver.setProductRecipe('p1', [recipeItemInput], ctx)

    expect(restMock.put).toHaveBeenCalledWith('/v1/catalog/products/p1/recipe', {
      body: { items: [recipeItemInput] },
      context: expect.objectContaining({ userId: 'u1' }),
    })
  })
})

describe('CommerceResolver — createOrder (Auth + Commerce)', () => {
  const address = { id: 'a1', text: 'Av 1', latitude: -34.6, longitude: -58.4 }

  it('valida la dirección contra Auth y confirma el pedido con deliveryAddress', async () => {
    authMock.get.mockResolvedValue(address)
    restMock.post.mockResolvedValue(rawOrder)

    const result = await resolver.createOrder('a1', ctx)

    expect(authMock.get).toHaveBeenCalledWith('/v1/addresses/a1', {
      context: expect.objectContaining({ userId: 'u1', authorization: 'Bearer xyz' }),
    })
    expect(restMock.post).toHaveBeenCalledWith('/v1/orders', {
      body: {
        addressId: 'a1',
        deliveryAddress: { text: 'Av 1', latitude: -34.6, longitude: -58.4 },
      },
      context: expect.objectContaining({ userId: 'u1', authorization: 'Bearer xyz' }),
    })
    expect(result.number).toBe('000123')
  })

  it('propaga el error de Auth y no confirma el pedido', async () => {
    const error = new Error('address 404')
    authMock.get.mockRejectedValue(error)

    await expect(resolver.createOrder('a9', ctx)).rejects.toBe(error)
    expect(restMock.post).not.toHaveBeenCalled()
  })
})

describe('CommerceResolver — changeOrderStatus y repeatOrder', () => {
  it('changeOrderStatus traduce el estado GraphQL al REST en snake_case', async () => {
    restMock.patch.mockResolvedValue({ ...rawOrder, status: 'ready_for_delivery' })

    const result = await resolver.changeOrderStatus('o1', OrderStatus.READY_FOR_DELIVERY, ctx)

    expect(restMock.patch).toHaveBeenCalledWith('/v1/orders/o1/status', {
      body: { status: 'ready_for_delivery' },
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.status).toBe(OrderStatus.READY_FOR_DELIVERY)
  })

  it('repeatOrder mapea el carrito y los productos omitidos', async () => {
    restMock.post.mockResolvedValue({ cart: rawCart, skippedProducts: [rawProduct] })

    const result = await resolver.repeatOrder('o1', ctx)

    expect(restMock.post).toHaveBeenCalledWith('/v1/orders/o1/repeat', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.cart.id).toBe('cart1')
    expect(result.skippedProducts[0].id).toBe('p1')
  })
})

describe('CommerceResolver — contexto REST y errores', () => {
  it('propaga el contexto completo en cada llamada', async () => {
    restMock.get.mockResolvedValue({ data: [] })

    await resolver.categories(null, null, ctx)

    expect(restMock.get).toHaveBeenCalledWith('/v1/catalog/categories', {
      context: {
        authorization: 'Bearer xyz',
        userId: 'u1',
        roles: ['customer'],
        branchId: null,
        requestId: 'rid-1',
      },
      query: { activeOnly: undefined, limit: undefined, offset: undefined },
    })
  })

  it('propaga branchId y roles de un admin de sucursal', async () => {
    const adminCtx = {
      ...ctx,
      roles: ['branch_admin'],
      branchId: 'b9',
    } as unknown as GraphQLContext
    restMock.get.mockResolvedValue({ data: [] })

    await resolver.orders(null, null, adminCtx)

    expect(restMock.get).toHaveBeenCalledWith('/v1/orders', {
      context: {
        authorization: 'Bearer xyz',
        userId: 'u1',
        roles: ['branch_admin'],
        branchId: 'b9',
        requestId: 'rid-1',
      },
      query: {
        status: undefined,
        branchId: undefined,
        search: undefined,
        limit: undefined,
        offset: undefined,
      },
    })
  })

  it('propaga el error de una query sin envolverlo', async () => {
    const error = new Error('commerce caído')
    restMock.get.mockRejectedValue(error)

    await expect(resolver.category('c1', ctx)).rejects.toBe(error)
  })

  it('propaga el error de una mutation sin envolverlo', async () => {
    const error = new Error('conflicto')
    restMock.post.mockRejectedValue(error)

    await expect(resolver.createCategory(categoryInput, ctx)).rejects.toBe(error)
  })

  it.each<OrderStatus>([
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_DELIVERY,
    OrderStatus.ON_THE_WAY,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ])('ordena el status %s al invocar el listado', async (status) => {
    restMock.get.mockResolvedValue({ data: [] })

    await resolver.myOrders({ status }, null, ctx)

    expect(restMock.get).toHaveBeenCalledWith('/v1/orders', {
      context: expect.objectContaining({ userId: 'u1' }),
      query: {
        status: status.toLowerCase(),
        branchId: undefined,
        search: undefined,
        limit: undefined,
        offset: undefined,
      },
    })
  })
})
