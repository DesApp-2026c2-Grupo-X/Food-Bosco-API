import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import {
  createDownstreamMock,
  DownstreamMock,
  errorResponse,
  gql,
  GraphQLBody,
  signToken,
} from './downstream'

type Service = 'auth' | 'commerce' | 'delivery'

interface DownstreamCase {
  name: string
  query: string
  role: string
  service: Service
  restPath: string
}

const commerceQueries: DownstreamCase[] = [
  {
    name: 'categories',
    query: 'query { categories { id } }',
    role: 'customer',
    service: 'commerce',
    restPath: '/v1/catalog/categories',
  },
  {
    name: 'category',
    query: 'query { category(id: "c1") { id } }',
    role: 'customer',
    service: 'commerce',
    restPath: '/v1/catalog/categories/c1',
  },
  {
    name: 'products',
    query: 'query { products { id } }',
    role: 'customer',
    service: 'commerce',
    restPath: '/v1/catalog/products',
  },
  {
    name: 'product',
    query: 'query { product(id: "p1") { id } }',
    role: 'customer',
    service: 'commerce',
    restPath: '/v1/catalog/products/p1',
  },
  {
    name: 'ingredients',
    query: 'query { ingredients { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/ingredients',
  },
  {
    name: 'promotions',
    query: 'query { promotions { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/promotions',
  },
  {
    name: 'branches',
    query: 'query { branches { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/branches',
  },
  {
    name: 'branchHours',
    query: 'query { branchHours(branchId: "b1") { dayOfWeek } }',
    role: 'customer',
    service: 'commerce',
    restPath: '/v1/branches/b1/hours',
  },
  {
    name: 'availableBranches',
    query: 'query { availableBranches(lat: -34.6, lng: -58.4) { id } }',
    role: 'customer',
    service: 'commerce',
    restPath: '/v1/branches/available',
  },
  {
    name: 'nearbyBranches',
    query: 'query { nearbyBranches(lat: -34.6, lng: -58.4) { id } }',
    role: 'customer',
    service: 'commerce',
    restPath: '/v1/branches/nearby',
  },
  {
    name: 'branchProducts',
    query: 'query { branchProducts(branchId: "b1") { id } }',
    role: 'branch_admin',
    service: 'commerce',
    restPath: '/v1/branches/b1/products',
  },
  {
    name: 'myCart',
    query: 'query { myCart { id } }',
    role: 'customer',
    service: 'commerce',
    restPath: '/v1/carts',
  },
  {
    name: 'myOrders',
    query: 'query { myOrders { id } }',
    role: 'customer',
    service: 'commerce',
    restPath: '/v1/orders',
  },
  {
    name: 'orderHistory',
    query: 'query { orderHistory(id: "o1") { newStatus } }',
    role: 'customer',
    service: 'commerce',
    restPath: '/v1/orders/o1/history',
  },
  {
    name: 'branchStock',
    query: 'query { branchStock { ingredientId } }',
    role: 'branch_admin',
    service: 'commerce',
    restPath: '/v1/stock',
  },
  {
    name: 'reportsOverview',
    query: 'query { reportsOverview { kpis { totalRevenue } } }',
    role: 'branch_admin',
    service: 'commerce',
    restPath: '/v1/reporting/overview',
  },
  {
    name: 'bestSellingProducts',
    query: 'query { bestSellingProducts { position } }',
    role: 'branch_admin',
    service: 'commerce',
    restPath: '/v1/reporting/products/best-sellers',
  },
  {
    name: 'leastSoldProducts',
    query: 'query { leastSoldProducts { position } }',
    role: 'branch_admin',
    service: 'commerce',
    restPath: '/v1/reporting/products/least-sold',
  },
  {
    name: 'outOfStockProducts',
    query: 'query { outOfStockProducts { quantity } }',
    role: 'branch_admin',
    service: 'commerce',
    restPath: '/v1/reporting/products/out-of-stock',
  },
  {
    name: 'highestRevenueProducts',
    query: 'query { highestRevenueProducts { position } }',
    role: 'branch_admin',
    service: 'commerce',
    restPath: '/v1/reporting/products/highest-revenue',
  },
  {
    name: 'parameters',
    query: 'query { parameters { key } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/config/parameters',
  },
  {
    name: 'orderStates',
    query: 'query { orderStates { code } }',
    role: 'customer',
    service: 'commerce',
    restPath: '/v1/config/order-states',
  },
]

const commerceMutations: DownstreamCase[] = [
  {
    name: 'createCategory',
    query: 'mutation { createCategory(input: { name: "Postres", active: true }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/categories',
  },
  {
    name: 'updateCategory',
    query: 'mutation { updateCategory(id: "c1", input: { name: "Nueva" }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/categories/c1',
  },
  {
    name: 'setCategoryActive',
    query: 'mutation { setCategoryActive(id: "c1", active: false) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/categories/c1/active',
  },
  {
    name: 'createProduct',
    query:
      'mutation { createProduct(input: { categoryId: "c1", name: "X", description: "d", price: 1 }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/products',
  },
  {
    name: 'updateProduct',
    query:
      'mutation { updateProduct(id: "p1", input: { categoryId: "c1", name: "X", description: "d", price: 9 }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/products/p1',
  },
  {
    name: 'setProductAvailable',
    query: 'mutation { setProductAvailable(id: "p1", available: false) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/products/p1/available',
  },
  {
    name: 'createConfigGroup',
    query:
      'mutation { createConfigGroup(productId: "p1", input: { name: "g", type: SINGLE, required: true }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/products/p1/configurations',
  },
  {
    name: 'updateConfigGroup',
    query:
      'mutation { updateConfigGroup(productId: "p1", groupId: "g1", input: { name: "E", type: SINGLE, required: false }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/products/p1/configurations/g1',
  },
  {
    name: 'deleteConfigGroup',
    query: 'mutation { deleteConfigGroup(productId: "p1", groupId: "g1") }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/products/p1/configurations/g1',
  },
  {
    name: 'createConfigOption',
    query:
      'mutation { createConfigOption(productId: "p1", groupId: "g1", input: { name: "o", extraPrice: 1 }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/products/p1/configurations/g1/options',
  },
  {
    name: 'updateConfigOption',
    query:
      'mutation { updateConfigOption(productId: "p1", groupId: "g1", optionId: "op1", input: { name: "o2", extraPrice: 2 }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/products/p1/configurations/g1/options/op1',
  },
  {
    name: 'deleteConfigOption',
    query: 'mutation { deleteConfigOption(productId: "p1", groupId: "g1", optionId: "op1") }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/products/p1/configurations/g1/options/op1',
  },
  {
    name: 'setProductRecipe',
    query:
      'mutation { setProductRecipe(productId: "p1", items: [{ ingredientId: "i1", quantity: 0.5 }]) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/products/p1/recipe',
  },
  {
    name: 'addRecipeItem',
    query:
      'mutation { addRecipeItem(productId: "p1", input: { ingredientId: "i1", quantity: 0.5 }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/products/p1/recipe/items',
  },
  {
    name: 'updateRecipeItem',
    query:
      'mutation { updateRecipeItem(productId: "p1", itemId: "ri1", input: { ingredientId: "i1", quantity: 0.7 }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/products/p1/recipe/items/ri1',
  },
  {
    name: 'removeRecipeItem',
    query: 'mutation { removeRecipeItem(productId: "p1", itemId: "ri1") { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/products/p1/recipe/items/ri1',
  },
  {
    name: 'createIngredient',
    query: 'mutation { createIngredient(input: { name: "Queso", unit: "kg" }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/ingredients',
  },
  {
    name: 'updateIngredient',
    query: 'mutation { updateIngredient(id: "i1", input: { name: "Queso", unit: "g" }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/ingredients/i1',
  },
  {
    name: 'setIngredientActive',
    query: 'mutation { setIngredientActive(id: "i1", active: false) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/ingredients/i1/active',
  },
  {
    name: 'createPromotion',
    query:
      'mutation { createPromotion(input: { name: "p", startDate: "2026-01-01", endDate: "2026-02-01" }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/promotions',
  },
  {
    name: 'updatePromotion',
    query:
      'mutation { updatePromotion(id: "pr1", input: { name: "3x1", startDate: "2026-01-01", endDate: "2026-02-01" }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/promotions/pr1',
  },
  {
    name: 'setPromotionActive',
    query: 'mutation { setPromotionActive(id: "pr1", active: false) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/catalog/promotions/pr1/active',
  },
  {
    name: 'createBranch',
    query:
      'mutation { createBranch(input: { name: "N", addressText: "C", latitude: 1, longitude: 2 }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/branches',
  },
  {
    name: 'updateBranch',
    query:
      'mutation { updateBranch(id: "b1", input: { name: "Centro", addressText: "Calle 9", latitude: -34.6, longitude: -58.4 }) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/branches/b1',
  },
  {
    name: 'setBranchActive',
    query: 'mutation { setBranchActive(id: "b1", active: false) { id } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/branches/b1/active',
  },
  {
    name: 'updateBranchHours',
    query:
      'mutation { updateBranchHours(branchId: "b1", hours: [{ dayOfWeek: 1, opening: "09:00", closing: "18:00", closed: false }]) { dayOfWeek } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/branches/b1/hours',
  },
  {
    name: 'setBranchProductAvailability',
    query:
      'mutation { setBranchProductAvailability(branchId: "b1", productId: "p1", available: false) }',
    role: 'branch_admin',
    service: 'commerce',
    restPath: '/v1/branches/b1/products/p1/availability',
  },
  {
    name: 'addCartItem',
    query: 'mutation { addCartItem(input: { productId: "p1", quantity: 1 }) { id } }',
    role: 'customer',
    service: 'commerce',
    restPath: '/v1/carts/items',
  },
  {
    name: 'updateCartItem',
    query: 'mutation { updateCartItem(itemId: "ci1", input: { quantity: 3 }) { id } }',
    role: 'customer',
    service: 'commerce',
    restPath: '/v1/carts/items/ci1',
  },
  {
    name: 'removeCartItem',
    query: 'mutation { removeCartItem(itemId: "ci1") { id } }',
    role: 'customer',
    service: 'commerce',
    restPath: '/v1/carts/items/ci1',
  },
  {
    name: 'updateParameter',
    query: 'mutation { updateParameter(key: "deliveryFee", value: 10) { key } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/config/parameters/deliveryFee',
  },
  {
    name: 'createOrderState',
    query: 'mutation { createOrderState(input: { name: "N", order: 1 }) { code } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/config/order-states',
  },
  {
    name: 'updateOrderState',
    query:
      'mutation { updateOrderState(code: "PENDING", input: { name: "E", order: 2 }) { code } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/config/order-states/PENDING',
  },
  {
    name: 'setOrderStateActive',
    query: 'mutation { setOrderStateActive(code: "PENDING", active: false) { code } }',
    role: 'super_admin',
    service: 'commerce',
    restPath: '/v1/config/order-states/PENDING/active',
  },
]

const authCases: DownstreamCase[] = [
  {
    name: 'refreshToken',
    query: 'mutation { refreshToken(refreshToken: "r") { accessToken } }',
    role: 'customer',
    service: 'auth',
    restPath: '/v1/auth/refresh',
  },
  {
    name: 'setUserActive',
    query: 'mutation { setUserActive(id: "u1", active: false) { id } }',
    role: 'super_admin',
    service: 'auth',
    restPath: '/v1/users/u1/active',
  },
  {
    name: 'createAddress',
    query:
      'mutation { createAddress(input: { label: "Casa", text: "Av 1", latitude: -34.6, longitude: -58.4 }) { id } }',
    role: 'customer',
    service: 'auth',
    restPath: '/v1/addresses',
  },
]

const deliveryCases: DownstreamCase[] = [
  {
    name: 'tripOffers',
    query: 'query { tripOffers { id } }',
    role: 'rider',
    service: 'delivery',
    restPath: '/v1/trips/offers',
  },
  {
    name: 'updateRiderProfile',
    query: 'mutation { updateRiderProfile(input: { phone: "9" }) { id } }',
    role: 'rider',
    service: 'delivery',
    restPath: '/v1/riders/me',
  },
  {
    name: 'setRiderAvailability',
    query: 'mutation { setRiderAvailability(online: false) { id } }',
    role: 'rider',
    service: 'delivery',
    restPath: '/v1/riders/me/availability',
  },
  {
    name: 'updateRiderLocation',
    query: 'mutation { updateRiderLocation(lat: -34.6, lng: -58.4) { id } }',
    role: 'rider',
    service: 'delivery',
    restPath: '/v1/riders/me/location',
  },
]

const cases: DownstreamCase[] = [
  ...commerceQueries,
  ...commerceMutations,
  ...authCases,
  ...deliveryCases,
]

const domainCode = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toUpperCase()

describe('Gateway errores downstream por operación (e2e) — 500 y 4xx', () => {
  let app: INestApplication<App>
  let downstream: DownstreamMock

  beforeAll(async () => {
    downstream = createDownstreamMock(() => undefined)

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
    await app.listen(0)
  })

  afterAll(async () => {
    downstream.restore()
    await app.close()
  })

  beforeEach(() => downstream.reset())

  const run = (query: string, role: string) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${signToken({ userId: 'u1', roles: [role] })}`)
      .send(gql(query))

  describe('downstream 500 sin code → INTERNAL_SERVER_ERROR', () => {
    it.each(cases)('$name', async ({ query, role, service }) => {
      downstream.setResponder(() => ({ status: 500, body: { message: 'sin code' } }))

      const res = await run(query, role).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR')
      expect(body.errors?.[0].message).toBe(`${service} devolvió HTTP 500`)
    })
  })

  describe('downstream 4xx con code de dominio → propagación', () => {
    it.each(cases)('$name', async ({ name, query, role, restPath }) => {
      const code = domainCode(name)
      const message = 'Regla de negocio violada'
      downstream.setResponder(() => errorResponse(400, code, message, restPath))

      const res = await run(query, role).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].message).toBe(message)
      expect(body.errors?.[0].extensions).toEqual({ code, path: restPath })
    })
  })
})
