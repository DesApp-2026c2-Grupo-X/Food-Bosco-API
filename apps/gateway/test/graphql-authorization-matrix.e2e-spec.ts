import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { createDownstreamMock, DownstreamMock, gql, GraphQLBody, signToken } from './downstream'

interface ProtectedOperation {
  name: string
  query: string
  // Rol autenticado que NO está habilitado para la operación. Ausente cuando la
  // operación sólo exige estar autenticado (@Authenticated): cualquier rol pasa el
  // guard, por lo que no existe un "rol incorrecto" que deba devolver FORBIDDEN.
  wrongRole?: string
}

const catalogMutationOps: ProtectedOperation[] = [
  {
    name: 'createCategory',
    query: 'mutation { createCategory(input: { name: "Postres", active: true }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'updateCategory',
    query: 'mutation { updateCategory(id: "c1", input: { name: "Nueva" }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'setCategoryActive',
    query: 'mutation { setCategoryActive(id: "c1", active: false) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'createProduct',
    query:
      'mutation { createProduct(input: { categoryId: "c1", name: "X", description: "d", price: 1 }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'updateProduct',
    query:
      'mutation { updateProduct(id: "p1", input: { categoryId: "c1", name: "X", description: "d", price: 9 }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'setProductAvailable',
    query: 'mutation { setProductAvailable(id: "p1", available: false) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'createConfigGroup',
    query:
      'mutation { createConfigGroup(productId: "p1", input: { name: "g", type: SINGLE, required: true }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'updateConfigGroup',
    query:
      'mutation { updateConfigGroup(productId: "p1", groupId: "g1", input: { name: "E", type: SINGLE, required: false }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'deleteConfigGroup',
    query: 'mutation { deleteConfigGroup(productId: "p1", groupId: "g1") }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'createConfigOption',
    query:
      'mutation { createConfigOption(productId: "p1", groupId: "g1", input: { name: "o", extraPrice: 1 }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'updateConfigOption',
    query:
      'mutation { updateConfigOption(productId: "p1", groupId: "g1", optionId: "op1", input: { name: "o2", extraPrice: 2 }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'deleteConfigOption',
    query: 'mutation { deleteConfigOption(productId: "p1", groupId: "g1", optionId: "op1") }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'setProductRecipe',
    query:
      'mutation { setProductRecipe(productId: "p1", items: [{ ingredientId: "i1", quantity: 0.5 }]) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'addRecipeItem',
    query:
      'mutation { addRecipeItem(productId: "p1", input: { ingredientId: "i1", quantity: 0.5 }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'updateRecipeItem',
    query:
      'mutation { updateRecipeItem(productId: "p1", itemId: "ri1", input: { ingredientId: "i1", quantity: 0.7 }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'removeRecipeItem',
    query: 'mutation { removeRecipeItem(productId: "p1", itemId: "ri1") { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'createIngredient',
    query: 'mutation { createIngredient(input: { name: "Queso", unit: "kg" }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'updateIngredient',
    query: 'mutation { updateIngredient(id: "i1", input: { name: "Queso", unit: "g" }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'setIngredientActive',
    query: 'mutation { setIngredientActive(id: "i1", active: false) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'createPromotion',
    query:
      'mutation { createPromotion(input: { name: "p", startDate: "2026-01-01", endDate: "2026-02-01" }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'updatePromotion',
    query:
      'mutation { updatePromotion(id: "pr1", input: { name: "3x1", startDate: "2026-01-01", endDate: "2026-02-01" }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'setPromotionActive',
    query: 'mutation { setPromotionActive(id: "pr1", active: false) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'createBranch',
    query:
      'mutation { createBranch(input: { name: "N", addressText: "C", latitude: 1, longitude: 2 }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'updateBranch',
    query:
      'mutation { updateBranch(id: "b1", input: { name: "Centro", addressText: "Calle 9", latitude: -34.6, longitude: -58.4 }) { id } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'setBranchActive',
    query: 'mutation { setBranchActive(id: "b1", active: false) { id } }',
    // branch_admin puede abrir/cerrar su propia sucursal; el rol realmente prohibido es customer
    wrongRole: 'customer',
  },
  {
    name: 'updateBranchHours',
    query:
      'mutation { updateBranchHours(branchId: "b1", hours: [{ dayOfWeek: 1, opening: "09:00", closing: "18:00", closed: false }]) { dayOfWeek } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'updateParameter',
    query: 'mutation { updateParameter(key: "deliveryFee", value: 10) { key } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'createOrderState',
    query: 'mutation { createOrderState(input: { name: "N", order: 1 }) { code } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'updateOrderState',
    query:
      'mutation { updateOrderState(code: "PENDING", input: { name: "E", order: 2 }) { code } }',
    wrongRole: 'branch_admin',
  },
  {
    name: 'setOrderStateActive',
    query: 'mutation { setOrderStateActive(code: "PENDING", active: false) { code } }',
    wrongRole: 'branch_admin',
  },
]

const reportQueryOps: ProtectedOperation[] = [
  // @Authenticated → cualquier rol autenticado es válido: sólo se prueba sin token.
  { name: 'orderHistory', query: 'query { orderHistory(id: "o1") { newStatus } }' },
  {
    name: 'reportsOverview',
    query: 'query { reportsOverview { kpis { totalRevenue } } }',
    wrongRole: 'customer',
  },
  {
    name: 'leastSoldProducts',
    query: 'query { leastSoldProducts { position } }',
    wrongRole: 'customer',
  },
  {
    name: 'outOfStockProducts',
    query: 'query { outOfStockProducts { quantity } }',
    wrongRole: 'customer',
  },
  {
    name: 'highestRevenueProducts',
    query: 'query { highestRevenueProducts { position } }',
    wrongRole: 'customer',
  },
  {
    name: 'bestSellingProducts',
    query: 'query { bestSellingProducts { position } }',
    wrongRole: 'customer',
  },
  { name: 'promotions', query: 'query { promotions { id } }', wrongRole: 'branch_admin' },
  { name: 'promotion', query: 'query { promotion(id: "pr1") { id } }', wrongRole: 'branch_admin' },
  { name: 'branches', query: 'query { branches { id } }', wrongRole: 'branch_admin' },
]

const cartOrderOps: ProtectedOperation[] = [
  {
    name: 'updateCartItem',
    query: 'mutation { updateCartItem(itemId: "ci1", input: { quantity: 3 }) { id } }',
    wrongRole: 'rider',
  },
  {
    name: 'removeCartItem',
    query: 'mutation { removeCartItem(itemId: "ci1") { id } }',
    wrongRole: 'rider',
  },
  {
    name: 'createOrder',
    query: 'mutation { createOrder(addressId: "a1") { id } }',
    wrongRole: 'rider',
  },
  {
    name: 'changeOrderStatus',
    query: 'mutation { changeOrderStatus(orderId: "o1", status: CONFIRMED) { id } }',
    wrongRole: 'customer',
  },
  {
    name: 'repeatOrder',
    query: 'mutation { repeatOrder(orderId: "o1") { cart { id } } }',
    wrongRole: 'rider',
  },
]

const authOps: ProtectedOperation[] = [
  // @Authenticated → cualquier rol autenticado es válido: sólo se prueba sin token.
  { name: 'logout', query: 'mutation { logout }' },
  {
    name: 'updateProfile',
    query:
      'mutation { updateProfile(input: { firstName: "A", lastName: "B", phone: "1" }) { id } }',
  },
  { name: 'user', query: 'query { user(id: "u1") { id } }', wrongRole: 'customer' },
  {
    name: 'createStaff',
    query:
      'mutation { createStaff(input: { firstName: "A", lastName: "B", email: "a@b.com", phone: "1", password: "p", branchId: "b1" }) { id } }',
    wrongRole: 'customer',
  },
  {
    name: 'createAdmin',
    query:
      'mutation { createAdmin(input: { firstName: "A", lastName: "B", email: "a@b.com", phone: "1", password: "p" }) { id } }',
    wrongRole: 'customer',
  },
  {
    name: 'createRider',
    query:
      'mutation { createRider(input: { firstName: "A", lastName: "B", email: "a@b.com", phone: "1", password: "p", vehicle: "Moto" }) { id } }',
    wrongRole: 'customer',
  },
  {
    name: 'setUserActive',
    query: 'mutation { setUserActive(id: "u1", active: false) { id } }',
    wrongRole: 'customer',
  },
  { name: 'myAddresses', query: 'query { myAddresses { id } }', wrongRole: 'rider' },
  { name: 'address', query: 'query { address(id: "a1") { id } }', wrongRole: 'rider' },
  {
    name: 'createAddress',
    query:
      'mutation { createAddress(input: { label: "Casa", text: "Av 1", latitude: -34.6, longitude: -58.4 }) { id } }',
    wrongRole: 'rider',
  },
  {
    name: 'updateAddress',
    query: 'mutation { updateAddress(id: "a1", input: { label: "Trabajo" }) { id } }',
    wrongRole: 'rider',
  },
  { name: 'deleteAddress', query: 'mutation { deleteAddress(id: "a1") }', wrongRole: 'rider' },
]

const protectedOperations: ProtectedOperation[] = [
  ...catalogMutationOps,
  ...reportQueryOps,
  ...cartOrderOps,
  ...authOps,
]

describe('Gateway autorización por operación (e2e) — matriz protegida', () => {
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

  const post = (query: string, token?: string) => {
    const req = request(app.getHttpServer()).post('/graphql')
    if (token) req.set('Authorization', `Bearer ${token}`)
    return req.send(gql(query))
  }

  describe('sin token → UNAUTHENTICATED', () => {
    it.each(protectedOperations)('$name', async ({ query }) => {
      const res = await post(query).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED')
      expect(body.errors?.[0].message).toBe('Unauthorized')
      expect(downstream.calls).toHaveLength(0)
    })
  })

  describe('rol incorrecto → FORBIDDEN', () => {
    const forbiddenOperations = protectedOperations.filter(
      (operation): operation is ProtectedOperation & { wrongRole: string } =>
        operation.wrongRole !== undefined,
    )

    it.each(forbiddenOperations)('$name con rol $wrongRole', async ({ query, wrongRole }) => {
      const token = signToken({ userId: 'u1', roles: [wrongRole] })

      const res = await post(query, token).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].extensions?.code).toBe('FORBIDDEN')
      expect(body.errors?.[0].message).toBe('Forbidden')
      expect(downstream.calls).toHaveLength(0)
    })
  })
})
