import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import {
  createDownstreamMock,
  DownstreamCall,
  DownstreamMock,
  gql,
  GraphQLBody,
  okResponse,
  queryParams,
  signToken,
} from './downstream'

const rawCategory = { id: 'c1', name: 'Hamburguesas', active: true }

const rawIngredient = { id: 'i1', name: 'Queso', unit: 'kg', active: true }

const rawOption = { id: 'op1', name: 'Extra queso', extraPrice: 1.5, available: true }

const rawConfigGroup = {
  id: 'g1',
  name: 'Extras',
  type: 'single',
  required: true,
  min: 1,
  max: 2,
  options: [rawOption],
}

const rawRecipeItem = { id: 'ri1', ingredientId: 'i1', quantity: 0.2 }

const rawProduct = {
  id: 'p1',
  categoryId: 'c1',
  name: 'Burger',
  description: 'Clásica',
  price: 10,
  image: null,
  available: true,
  configGroups: [rawConfigGroup],
  recipe: [rawRecipeItem],
}

const rawPromotion = {
  id: 'pr1',
  name: '2x1',
  description: 'promo',
  startDate: '2026-01-01',
  endDate: '2026-02-01',
  active: true,
}

const rawBranchHour = { dayOfWeek: 1, opening: '09:00', closing: '18:00', closed: false }

const rawBranch = {
  id: 'b1',
  name: 'Centro',
  addressText: 'Calle 1',
  latitude: -34.6,
  longitude: -58.4,
  phone: null,
  active: true,
  hours: [rawBranchHour],
}

const rawCartItem = { id: 'ci1', productId: 'p1', quantity: 2, observations: null, optionIds: ['op1'] }

const rawCart = {
  id: 'cart1',
  clientId: 'u1',
  status: 'active',
  items: [rawCartItem],
  total: 20,
}

const rawOrderItem = {
  productId: 'p1',
  name: 'Burger',
  unitPrice: 10,
  quantity: 2,
  observations: null,
  subtotal: 20,
  options: [{ optionId: 'op1', name: 'Extra queso', extraPrice: 1.5 }],
}

const rawOrder = {
  id: 'o1',
  number: '0001',
  clientId: 'u1',
  branchId: 'b1',
  deliveryAddress: { text: 'Av 1', latitude: -34.6, longitude: -58.4 },
  status: 'confirmed',
  total: 21.5,
  estimatedDeliveryAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  items: [rawOrderItem],
  statusHistory: [
    { previousStatus: 'pending', newStatus: 'confirmed', changedAt: '2026-01-01T00:00:00.000Z' },
  ],
  availableTransitions: ['preparing', 'cancelled'],
}

const rawStock = { branchId: 'b1', ingredientId: 'i1', quantity: 5 }

const rawReportRow = { position: 1, product: rawProduct, category: rawCategory, quantity: 3, revenue: 30 }

const rawOutOfStock = { product: rawProduct, category: rawCategory, quantity: 0 }

const rawParameter = { key: 'deliveryFee', value: 200, unit: 'ARS' }

const rawOrderState = { code: 'PENDING', name: 'Pendiente', order: 1, active: true }

type HandlerMap = Record<string, unknown>

const respondWith =
  (handlers: HandlerMap) =>
  (call: { method: string; path: string }) => {
    const key = `${call.method} ${call.path}`
    return key in handlers ? okResponse(handlers[key]) : undefined
  }

describe('Gateway commerce (e2e) — frontend → GraphQL → REST', () => {
  let app: INestApplication<App>
  let downstream: DownstreamMock

  beforeAll(async () => {
    downstream = createDownstreamMock(() => undefined)

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    downstream.restore()
    await app.close()
  })

  beforeEach(() => downstream.reset())

  const run = (query: string, role: string) => {
    const token = signToken({ userId: 'u1', roles: [role] })
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql(query))
  }

  const callFor = (method: string, path: string): DownstreamCall => {
    const call = downstream.calls.find((entry) => entry.method === method && entry.path === path)
    if (!call) {
      throw new Error(`No hubo llamada downstream ${method} ${path}`)
    }
    return call
  }

  describe('catálogo, sucursales y configuración (queries)', () => {
    it('categories mapea data y envía activeOnly + page', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/catalog/categories': { data: [rawCategory] } }))

      const res = await run(
        'query { categories(activeOnly: true, page: { limit: 2, offset: 1 }) { id name active } }',
        'customer',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        categories: [{ id: 'c1', name: 'Hamburguesas', active: true }],
      })
      const params = queryParams(callFor('GET', '/v1/catalog/categories').url)
      expect(params.get('activeOnly')).toBe('true')
      expect(params.get('limit')).toBe('2')
      expect(params.get('offset')).toBe('1')
    })

    it('category(id) hace GET por id', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/catalog/categories/c1': rawCategory }))

      const res = await run('query { category(id: "c1") { id name } }', 'customer').expect(200)

      expect((res.body as GraphQLBody).data).toEqual({ category: { id: 'c1', name: 'Hamburguesas' } })
    })

    it('products mapea enums de configuración, receta y filtros/página', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/catalog/products': { data: [rawProduct] } }))

      const res = await run(
        'query { products(filter: { categoryId: "c1", search: "bur", available: true }, page: { limit: 3, offset: 6 }) { id name price available configGroups { id type required min max options { id extraPrice } } recipe { id ingredientId quantity } } }',
        'customer',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        products: [
          {
            id: 'p1',
            name: 'Burger',
            price: 10,
            available: true,
            configGroups: [
              {
                id: 'g1',
                type: 'SINGLE',
                required: true,
                min: 1,
                max: 2,
                options: [{ id: 'op1', extraPrice: 1.5 }],
              },
            ],
            recipe: [{ id: 'ri1', ingredientId: 'i1', quantity: 0.2 }],
          },
        ],
      })
      const params = queryParams(callFor('GET', '/v1/catalog/products').url)
      expect(params.get('categoryId')).toBe('c1')
      expect(params.get('search')).toBe('bur')
      expect(params.get('available')).toBe('true')
      expect(params.get('limit')).toBe('3')
      expect(params.get('offset')).toBe('6')
    })

    it('products con lat/lng usa /v1/branches/available/products y availableInBranch', async () => {
      downstream.setResponder(
        respondWith({
          'GET /v1/branches/available/products': { data: [{ ...rawProduct, availableInBranch: false }] },
        }),
      )

      const res = await run('query { products(filter: { lat: -34.6, lng: -58.4 }) { id available } }', 'customer').expect(
        200,
      )

      expect((res.body as GraphQLBody).data).toEqual({ products: [{ id: 'p1', available: false }] })
      const params = queryParams(callFor('GET', '/v1/branches/available/products').url)
      expect(params.get('lat')).toBe('-34.6')
      expect(params.get('lng')).toBe('-58.4')
    })

    it('ingredients pagina y filtra activeOnly (super_admin)', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/catalog/ingredients': { data: [rawIngredient] } }))

      const res = await run(
        'query { ingredients(activeOnly: true, page: { limit: 4, offset: 0 }) { id name unit active } }',
        'super_admin',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        ingredients: [{ id: 'i1', name: 'Queso', unit: 'kg', active: true }],
      })
      const params = queryParams(callFor('GET', '/v1/catalog/ingredients').url)
      expect(params.get('activeOnly')).toBe('true')
      expect(params.get('limit')).toBe('4')
    })

    it('promotions pagina y mapea fechas (super_admin)', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/catalog/promotions': { data: [rawPromotion] } }))

      const res = await run(
        'query { promotions(activeOnly: false, page: { limit: 1, offset: 0 }) { id name startDate endDate active } }',
        'super_admin',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        promotions: [{ id: 'pr1', name: '2x1', startDate: '2026-01-01', endDate: '2026-02-01', active: true }],
      })
      const params = queryParams(callFor('GET', '/v1/catalog/promotions').url)
      expect(params.get('activeOnly')).toBe('false')
      expect(params.get('limit')).toBe('1')
    })

    it('branches filtra/pagina y mapea hours', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/branches': { data: [rawBranch] } }))

      const res = await run(
        'query { branches(filter: { active: true, search: "cen" }, page: { limit: 2, offset: 0 }) { id name active hours { dayOfWeek opening closing closed } } }',
        'super_admin',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        branches: [
          {
            id: 'b1',
            name: 'Centro',
            active: true,
            hours: [{ dayOfWeek: 1, opening: '09:00', closing: '18:00', closed: false }],
          },
        ],
      })
      const params = queryParams(callFor('GET', '/v1/branches').url)
      expect(params.get('active')).toBe('true')
      expect(params.get('search')).toBe('cen')
      expect(params.get('limit')).toBe('2')
    })

    it('branchHours devuelve la lista de horarios', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/branches/b1/hours': [rawBranchHour] }))

      const res = await run(
        'query { branchHours(branchId: "b1") { dayOfWeek opening closing closed } }',
        'customer',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        branchHours: [{ dayOfWeek: 1, opening: '09:00', closing: '18:00', closed: false }],
      })
    })

    it('availableBranches envía lat/lng', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/branches/available': [rawBranch] }))

      const res = await run('query { availableBranches(lat: -34.6, lng: -58.4) { id name } }', 'customer').expect(200)

      expect((res.body as GraphQLBody).data).toEqual({ availableBranches: [{ id: 'b1', name: 'Centro' }] })
      const params = queryParams(callFor('GET', '/v1/branches/available').url)
      expect(params.get('lat')).toBe('-34.6')
      expect(params.get('lng')).toBe('-58.4')
    })

    it('branchProducts usa availableInBranch (branch_admin)', async () => {
      downstream.setResponder(
        respondWith({ 'GET /v1/branches/b1/products': { data: [{ ...rawProduct, availableInBranch: false }] } }),
      )

      const res = await run('query { branchProducts(branchId: "b1") { id available } }', 'branch_admin').expect(200)

      expect((res.body as GraphQLBody).data).toEqual({ branchProducts: [{ id: 'p1', available: false }] })
    })

    it('branchStock filtra por branchId (branch_admin)', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/stock': [rawStock] }))

      const res = await run('query { branchStock(branchId: "b1") { branchId ingredientId quantity } }', 'branch_admin').expect(
        200,
      )

      expect((res.body as GraphQLBody).data).toEqual({
        branchStock: [{ branchId: 'b1', ingredientId: 'i1', quantity: 5 }],
      })
      expect(queryParams(callFor('GET', '/v1/stock').url).get('branchId')).toBe('b1')
    })

    it('parameters y orderStates mapean data', async () => {
      downstream.setResponder(
        respondWith({
          'GET /v1/config/parameters': [rawParameter],
          'GET /v1/config/order-states': [rawOrderState],
        }),
      )

      const parameters = await run('query { parameters { key value unit } }', 'super_admin').expect(200)
      expect((parameters.body as GraphQLBody).data).toEqual({
        parameters: [{ key: 'deliveryFee', value: 200, unit: 'ARS' }],
      })

      const states = await run('query { orderStates { code name order active } }', 'customer').expect(200)
      expect((states.body as GraphQLBody).data).toEqual({
        orderStates: [{ code: 'PENDING', name: 'Pendiente', order: 1, active: true }],
      })
    })

    const reportCases: Array<{ name: string; query: string; path: string }> = [
      {
        name: 'bestSellingProducts',
        query: 'query { bestSellingProducts { position product { id name } category { id name } quantity revenue } }',
        path: '/v1/reporting/products/best-sellers',
      },
      {
        name: 'leastSoldProducts',
        query: 'query { leastSoldProducts { position product { id name } quantity revenue } }',
        path: '/v1/reporting/products/least-sold',
      },
      {
        name: 'highestRevenueProducts',
        query: 'query { highestRevenueProducts { position product { id name } quantity revenue } }',
        path: '/v1/reporting/products/highest-revenue',
      },
    ]

    it.each(reportCases)('$name mapea product/category anidados', async ({ query, path }) => {
      downstream.setResponder(respondWith({ [`GET ${path}`]: [rawReportRow] }))

      const res = await run(query, 'branch_admin').expect(200)

      const data = (res.body as GraphQLBody).data ?? {}
      const rows = Object.values(data)[0] as Array<Record<string, unknown>>
      expect(rows[0]).toMatchObject({ position: 1, quantity: 3, revenue: 30 })
    })

    it('outOfStockProducts mapea quantity flotante', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/reporting/products/out-of-stock': [rawOutOfStock] }))

      const res = await run(
        'query { outOfStockProducts { product { id name } category { id } quantity } }',
        'branch_admin',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        outOfStockProducts: [{ product: { id: 'p1', name: 'Burger' }, category: { id: 'c1' }, quantity: 0 }],
      })
    })
  })

  describe('carrito y pedidos (queries)', () => {
    it('myCart mapea items y resuelve options contra el producto', async () => {
      downstream.setResponder(
        respondWith({
          'GET /v1/carts': rawCart,
          'GET /v1/catalog/products/p1': rawProduct,
        }),
      )

      const res = await run(
        'query { myCart { id status total items { id productId quantity optionIds options { id name } } } }',
        'customer',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        myCart: {
          id: 'cart1',
          status: 'active',
          total: 20,
          items: [
            {
              id: 'ci1',
              productId: 'p1',
              quantity: 2,
              optionIds: ['op1'],
              options: [{ id: 'op1', name: 'Extra queso' }],
            },
          ],
        },
      })
    })

    it('myOrders traduce status enum→snake y pagina', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/orders': { data: [rawOrder] } }))

      const res = await run(
        'query { myOrders(filter: { status: CONFIRMED, branchId: "b1", search: "0001" }, page: { limit: 1, offset: 2 }) { id status } }',
        'customer',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({ myOrders: [{ id: 'o1', status: 'CONFIRMED' }] })
      const params = queryParams(callFor('GET', '/v1/orders').url)
      expect(params.get('status')).toBe('confirmed')
      expect(params.get('branchId')).toBe('b1')
      expect(params.get('search')).toBe('0001')
      expect(params.get('limit')).toBe('1')
      expect(params.get('offset')).toBe('2')
    })

    it('order mapea items, opciones e historial con enums', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/orders/o1': rawOrder }))

      const res = await run(
        'query { order(id: "o1") { number status total estimatedDeliveryAt items { productId unitPrice quantity subtotal options { optionId extraPrice } } statusHistory { previousStatus newStatus } availableTransitions } }',
        'customer',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        order: {
          number: '0001',
          status: 'CONFIRMED',
          total: 21.5,
          estimatedDeliveryAt: null,
          items: [
            {
              productId: 'p1',
              unitPrice: 10,
              quantity: 2,
              subtotal: 20,
              options: [{ optionId: 'op1', extraPrice: 1.5 }],
            },
          ],
          statusHistory: [{ previousStatus: 'PENDING', newStatus: 'CONFIRMED' }],
          availableTransitions: ['PREPARING', 'CANCELLED'],
        },
      })
    })

    it('orderHistory mapea los estados a enums', async () => {
      downstream.setResponder(
        respondWith({
          'GET /v1/orders/o1/history': [
            { previousStatus: 'pending', newStatus: 'confirmed', changedAt: '2026-01-01T00:00:00.000Z' },
            { previousStatus: 'confirmed', newStatus: 'preparing', changedAt: '2026-01-01T00:05:00.000Z' },
          ],
        }),
      )

      const res = await run('query { orderHistory(id: "o1") { previousStatus newStatus changedAt } }', 'customer').expect(
        200,
      )

      expect((res.body as GraphQLBody).data).toEqual({
        orderHistory: [
          { previousStatus: 'PENDING', newStatus: 'CONFIRMED', changedAt: '2026-01-01T00:00:00.000Z' },
          { previousStatus: 'CONFIRMED', newStatus: 'PREPARING', changedAt: '2026-01-01T00:05:00.000Z' },
        ],
      })
    })
  })

  describe('mutaciones (mapeo REST)', () => {
    interface MutationCase {
      name: string
      query: string
      role: string
      method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'
      path: string
      body?: unknown
      response: unknown
      expected: Record<string, unknown>
    }

    const cases: MutationCase[] = [
      {
        name: 'createCategory',
        query: 'mutation { createCategory(input: { name: "Postres", active: true }) { id name } }',
        role: 'super_admin',
        method: 'POST',
        path: '/v1/catalog/categories',
        body: { name: 'Postres', active: true },
        response: rawCategory,
        expected: { createCategory: { id: 'c1', name: 'Hamburguesas' } },
      },
      {
        name: 'updateCategory',
        query: 'mutation { updateCategory(id: "c1", input: { name: "Nueva" }) { id name } }',
        role: 'super_admin',
        method: 'PATCH',
        path: '/v1/catalog/categories/c1',
        body: { name: 'Nueva' },
        response: rawCategory,
        expected: { updateCategory: { id: 'c1' } },
      },
      {
        name: 'setCategoryActive',
        query: 'mutation { setCategoryActive(id: "c1", active: false) { id active } }',
        role: 'super_admin',
        method: 'PATCH',
        path: '/v1/catalog/categories/c1/active',
        body: { active: false },
        response: { ...rawCategory, active: false },
        expected: { setCategoryActive: { id: 'c1', active: false } },
      },
      {
        name: 'createProduct',
        query:
          'mutation { createProduct(input: { categoryId: "c1", name: "Nueva", description: "d", price: 5, available: true }) { id price } }',
        role: 'super_admin',
        method: 'POST',
        path: '/v1/catalog/products',
        body: { categoryId: 'c1', name: 'Nueva', description: 'd', price: 5, available: true },
        response: rawProduct,
        expected: { createProduct: { id: 'p1', price: 10 } },
      },
      {
        name: 'updateProduct',
        query: 'mutation { updateProduct(id: "p1", input: { categoryId: "c1", name: "X", description: "d", price: 9 }) { id price } }',
        role: 'super_admin',
        method: 'PATCH',
        path: '/v1/catalog/products/p1',
        body: { categoryId: 'c1', name: 'X', description: 'd', price: 9 },
        response: rawProduct,
        expected: { updateProduct: { id: 'p1' } },
      },
      {
        name: 'setProductAvailable',
        query: 'mutation { setProductAvailable(id: "p1", available: false) { id available } }',
        role: 'super_admin',
        method: 'PATCH',
        path: '/v1/catalog/products/p1/available',
        body: { available: false },
        response: { ...rawProduct, available: false },
        expected: { setProductAvailable: { id: 'p1', available: false } },
      },
      // KNOWN BUG: `configGroupTypeToRest` existe pero no se usa; el enum GraphQL viaja
      // a REST en mayúsculas ('MULTIPLE') cuando el contrato REST usa minúsculas ('multiple').
      {
        name: 'createConfigGroup',
        query:
          'mutation { createConfigGroup(productId: "p1", input: { name: "Extras", type: MULTIPLE, required: true }) { id name type } }',
        role: 'super_admin',
        method: 'POST',
        path: '/v1/catalog/products/p1/configurations',
        body: { name: 'Extras', type: 'MULTIPLE', required: true },
        response: rawConfigGroup,
        expected: { createConfigGroup: { id: 'g1', name: 'Extras', type: 'SINGLE' } },
      },
      // KNOWN BUG: mismo caso que createConfigGroup; Commerce valida type con @IsIn(['single','multiple']).
      {
        name: 'updateConfigGroup',
        query: 'mutation { updateConfigGroup(productId: "p1", groupId: "g1", input: { name: "E", type: SINGLE, required: false }) { id } }',
        role: 'super_admin',
        method: 'PATCH',
        path: '/v1/catalog/products/p1/configurations/g1',
        body: { name: 'E', type: 'SINGLE', required: false },
        response: rawConfigGroup,
        expected: { updateConfigGroup: { id: 'g1' } },
      },
      {
        name: 'deleteConfigGroup',
        query: 'mutation { deleteConfigGroup(productId: "p1", groupId: "g1") }',
        role: 'super_admin',
        method: 'DELETE',
        path: '/v1/catalog/products/p1/configurations/g1',
        response: {},
        expected: { deleteConfigGroup: true },
      },
      {
        name: 'createConfigOption',
        query: 'mutation { createConfigOption(productId: "p1", groupId: "g1", input: { name: "Q", extraPrice: 2 }) { id extraPrice } }',
        role: 'super_admin',
        method: 'POST',
        path: '/v1/catalog/products/p1/configurations/g1/options',
        body: { name: 'Q', extraPrice: 2 },
        response: rawOption,
        expected: { createConfigOption: { id: 'op1', extraPrice: 1.5 } },
      },
      {
        name: 'updateConfigOption',
        query:
          'mutation { updateConfigOption(productId: "p1", groupId: "g1", optionId: "op1", input: { name: "Q2", extraPrice: 2 }) { id extraPrice } }',
        role: 'super_admin',
        method: 'PATCH',
        path: '/v1/catalog/products/p1/configurations/g1/options/op1',
        body: { name: 'Q2', extraPrice: 2 },
        response: rawOption,
        expected: { updateConfigOption: { id: 'op1', extraPrice: 1.5 } },
      },
      {
        name: 'deleteConfigOption',
        query: 'mutation { deleteConfigOption(productId: "p1", groupId: "g1", optionId: "op1") }',
        role: 'super_admin',
        method: 'DELETE',
        path: '/v1/catalog/products/p1/configurations/g1/options/op1',
        response: {},
        expected: { deleteConfigOption: true },
      },
      {
        name: 'setProductRecipe',
        query: 'mutation { setProductRecipe(productId: "p1", items: [{ ingredientId: "i1", quantity: 0.5 }]) { id } }',
        role: 'super_admin',
        method: 'PUT',
        path: '/v1/catalog/products/p1/recipe',
        body: { items: [{ ingredientId: 'i1', quantity: 0.5 }] },
        response: rawProduct,
        expected: { setProductRecipe: { id: 'p1' } },
      },
      {
        name: 'addRecipeItem',
        query: 'mutation { addRecipeItem(productId: "p1", input: { ingredientId: "i1", quantity: 0.5 }) { id } }',
        role: 'super_admin',
        method: 'POST',
        path: '/v1/catalog/products/p1/recipe/items',
        body: { ingredientId: 'i1', quantity: 0.5 },
        response: rawProduct,
        expected: { addRecipeItem: { id: 'p1' } },
      },
      {
        name: 'updateRecipeItem',
        query: 'mutation { updateRecipeItem(productId: "p1", itemId: "ri1", input: { ingredientId: "i1", quantity: 0.7 }) { id } }',
        role: 'super_admin',
        method: 'PATCH',
        path: '/v1/catalog/products/p1/recipe/items/ri1',
        body: { ingredientId: 'i1', quantity: 0.7 },
        response: rawProduct,
        expected: { updateRecipeItem: { id: 'p1' } },
      },
      {
        name: 'removeRecipeItem',
        query: 'mutation { removeRecipeItem(productId: "p1", itemId: "ri1") { id } }',
        role: 'super_admin',
        method: 'DELETE',
        path: '/v1/catalog/products/p1/recipe/items/ri1',
        response: rawProduct,
        expected: { removeRecipeItem: { id: 'p1' } },
      },
      {
        name: 'createIngredient',
        query: 'mutation { createIngredient(input: { name: "Queso", unit: "kg" }) { id name } }',
        role: 'super_admin',
        method: 'POST',
        path: '/v1/catalog/ingredients',
        body: { name: 'Queso', unit: 'kg' },
        response: rawIngredient,
        expected: { createIngredient: { id: 'i1', name: 'Queso' } },
      },
      {
        name: 'updateIngredient',
        query: 'mutation { updateIngredient(id: "i1", input: { name: "Queso", unit: "g" }) { id unit } }',
        role: 'super_admin',
        method: 'PATCH',
        path: '/v1/catalog/ingredients/i1',
        body: { name: 'Queso', unit: 'g' },
        response: rawIngredient,
        expected: { updateIngredient: { id: 'i1' } },
      },
      {
        name: 'setIngredientActive',
        query: 'mutation { setIngredientActive(id: "i1", active: false) { id active } }',
        role: 'super_admin',
        method: 'PATCH',
        path: '/v1/catalog/ingredients/i1/active',
        body: { active: false },
        response: { ...rawIngredient, active: false },
        expected: { setIngredientActive: { id: 'i1', active: false } },
      },
      {
        name: 'createPromotion',
        query:
          'mutation { createPromotion(input: { name: "2x1", startDate: "2026-01-01", endDate: "2026-02-01" }) { id } }',
        role: 'super_admin',
        method: 'POST',
        path: '/v1/catalog/promotions',
        body: { name: '2x1', startDate: '2026-01-01', endDate: '2026-02-01' },
        response: rawPromotion,
        expected: { createPromotion: { id: 'pr1' } },
      },
      {
        name: 'updatePromotion',
        query:
          'mutation { updatePromotion(id: "pr1", input: { name: "3x1", startDate: "2026-01-01", endDate: "2026-02-01" }) { id } }',
        role: 'super_admin',
        method: 'PATCH',
        path: '/v1/catalog/promotions/pr1',
        body: { name: '3x1', startDate: '2026-01-01', endDate: '2026-02-01' },
        response: rawPromotion,
        expected: { updatePromotion: { id: 'pr1' } },
      },
      {
        name: 'setPromotionActive',
        query: 'mutation { setPromotionActive(id: "pr1", active: false) { id active } }',
        role: 'super_admin',
        method: 'PATCH',
        path: '/v1/catalog/promotions/pr1/active',
        body: { active: false },
        response: { ...rawPromotion, active: false },
        expected: { setPromotionActive: { id: 'pr1', active: false } },
      },
      {
        name: 'createBranch',
        query:
          'mutation { createBranch(input: { name: "Norte", addressText: "Calle 2", latitude: -34.5, longitude: -58.5 }) { id name } }',
        role: 'super_admin',
        method: 'POST',
        path: '/v1/branches',
        body: { name: 'Norte', addressText: 'Calle 2', latitude: -34.5, longitude: -58.5 },
        response: rawBranch,
        expected: { createBranch: { id: 'b1', name: 'Centro' } },
      },
      {
        name: 'updateBranch',
        query:
          'mutation { updateBranch(id: "b1", input: { name: "Centro", addressText: "Calle 9", latitude: -34.6, longitude: -58.4 }) { id name } }',
        role: 'super_admin',
        method: 'PATCH',
        path: '/v1/branches/b1',
        body: { name: 'Centro', addressText: 'Calle 9', latitude: -34.6, longitude: -58.4 },
        response: rawBranch,
        expected: { updateBranch: { id: 'b1', name: 'Centro' } },
      },
      {
        name: 'setBranchActive',
        query: 'mutation { setBranchActive(id: "b1", active: false) { id active } }',
        role: 'super_admin',
        method: 'PATCH',
        path: '/v1/branches/b1/active',
        body: { active: false },
        response: { ...rawBranch, active: false },
        expected: { setBranchActive: { id: 'b1', active: false } },
      },
      {
        name: 'updateBranchHours',
        query:
          'mutation { updateBranchHours(branchId: "b1", hours: [{ dayOfWeek: 1, opening: "09:00", closing: "18:00", closed: false }]) { dayOfWeek opening } }',
        role: 'super_admin',
        method: 'PUT',
        path: '/v1/branches/b1/hours',
        body: { hours: [{ dayOfWeek: 1, opening: '09:00', closing: '18:00', closed: false }] },
        response: [rawBranchHour],
        expected: { updateBranchHours: [{ dayOfWeek: 1, opening: '09:00' }] },
      },
      {
        name: 'setBranchProductAvailability',
        query: 'mutation { setBranchProductAvailability(branchId: "b1", productId: "p1", available: false) }',
        role: 'branch_admin',
        method: 'PATCH',
        path: '/v1/branches/b1/products/p1/availability',
        body: { available: false },
        response: {},
        expected: { setBranchProductAvailability: true },
      },
      {
        name: 'addCartItem',
        query: 'mutation { addCartItem(input: { productId: "p1", quantity: 1 }) { id total } }',
        role: 'customer',
        method: 'POST',
        path: '/v1/carts/items',
        body: { productId: 'p1', quantity: 1 },
        response: rawCart,
        expected: { addCartItem: { id: 'cart1', total: 20 } },
      },
      {
        name: 'updateCartItem',
        query: 'mutation { updateCartItem(itemId: "ci1", input: { quantity: 3 }) { id total } }',
        role: 'customer',
        method: 'PATCH',
        path: '/v1/carts/items/ci1',
        body: { quantity: 3 },
        response: rawCart,
        expected: { updateCartItem: { id: 'cart1' } },
      },
      {
        name: 'removeCartItem',
        query: 'mutation { removeCartItem(itemId: "ci1") { id total } }',
        role: 'customer',
        method: 'DELETE',
        path: '/v1/carts/items/ci1',
        response: rawCart,
        expected: { removeCartItem: { id: 'cart1' } },
      },
      {
        name: 'changeOrderStatus',
        query: 'mutation { changeOrderStatus(orderId: "o1", status: CONFIRMED) { id status } }',
        role: 'branch_admin',
        method: 'PATCH',
        path: '/v1/orders/o1/status',
        body: { status: 'confirmed' },
        response: rawOrder,
        expected: { changeOrderStatus: { id: 'o1', status: 'CONFIRMED' } },
      },
      {
        name: 'adjustStock',
        query:
          'mutation { adjustStock(input: { branchId: "b1", ingredientId: "i1", delta: -2, reason: "adjust" }) { branchId quantity } }',
        role: 'branch_admin',
        method: 'POST',
        path: '/v1/stock/adjustments',
        body: { branchId: 'b1', ingredientId: 'i1', delta: -2, reason: 'adjust' },
        response: rawStock,
        expected: { adjustStock: { branchId: 'b1', quantity: 5 } },
      },
      {
        name: 'updateParameter',
        query: 'mutation { updateParameter(key: "deliveryFee", value: 250) { key value } }',
        role: 'super_admin',
        method: 'PATCH',
        path: '/v1/config/parameters/deliveryFee',
        body: { value: 250 },
        response: rawParameter,
        expected: { updateParameter: { key: 'deliveryFee', value: 200 } },
      },
      {
        name: 'createOrderState',
        query: 'mutation { createOrderState(input: { name: "Nuevo", order: 9 }) { code name order } }',
        role: 'super_admin',
        method: 'POST',
        path: '/v1/config/order-states',
        body: { name: 'Nuevo', order: 9 },
        response: rawOrderState,
        expected: { createOrderState: { code: 'PENDING', name: 'Pendiente' } },
      },
      {
        name: 'updateOrderState',
        query: 'mutation { updateOrderState(code: "PENDING", input: { name: "En espera", order: 2 }) { code name order } }',
        role: 'super_admin',
        method: 'PUT',
        path: '/v1/config/order-states/PENDING',
        body: { name: 'En espera', order: 2 },
        response: rawOrderState,
        expected: { updateOrderState: { code: 'PENDING' } },
      },
      {
        name: 'setOrderStateActive',
        query: 'mutation { setOrderStateActive(code: "PENDING", active: false) { code active } }',
        role: 'super_admin',
        method: 'PATCH',
        path: '/v1/config/order-states/PENDING/active',
        body: { active: false },
        response: { ...rawOrderState, active: false },
        expected: { setOrderStateActive: { code: 'PENDING', active: false } },
      },
    ]

    it.each(cases)('$name → $method $path', async ({ query, role, method, path, body, response, expected }) => {
      downstream.setResponder(respondWith({ [`${method} ${path}`]: response }))

      const res = await run(query, role).expect(200)
      const graphql = res.body as GraphQLBody

      expect(graphql.errors).toBeUndefined()
      expect(graphql.data).toMatchObject(expected)
      const call = callFor(method, path)
      if (body !== undefined) {
        expect(call.body).toEqual(body)
      }
    })

    it('createOrder toma la dirección de Auth y confirma el pedido en Commerce', async () => {
      downstream.setResponder(
        respondWith({
          'GET /v1/addresses/a1': {
            id: 'a1',
            text: 'Av 1',
            latitude: -34.6,
            longitude: -58.4,
          },
          'POST /v1/orders': rawOrder,
        }),
      )

      const res = await run('mutation { createOrder(addressId: "a1") { id number } }', 'customer').expect(200)

      expect((res.body as GraphQLBody).data).toEqual({ createOrder: { id: 'o1', number: '0001' } })
      expect(callFor('GET', '/v1/addresses/a1').headers['x-user-id']).toBe('u1')
      expect(callFor('POST', '/v1/orders').body).toEqual({
        addressId: 'a1',
        deliveryAddress: { text: 'Av 1', latitude: -34.6, longitude: -58.4 },
      })
    })

    it('repeatOrder mapea cart y skippedProducts', async () => {
      downstream.setResponder(
        respondWith({
          'POST /v1/orders/o1/repeat': { cart: rawCart, skippedProducts: [{ ...rawProduct, id: 'p9' }] },
        }),
      )

      const res = await run(
        'mutation { repeatOrder(orderId: "o1") { cart { id total } skippedProducts { id name } } }',
        'customer',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        repeatOrder: { cart: { id: 'cart1', total: 20 }, skippedProducts: [{ id: 'p9', name: 'Burger' }] },
      })
    })
  })
})
