import { INestApplication, ValidationPipe } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import type { App } from 'supertest/types'
import { BranchModule } from '../src/branch/branch.module'
import { CartModule } from '../src/cart/cart.module'
import { CategoryModule } from '../src/category/category.module'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { IngredientModule } from '../src/ingredient/ingredient.module'
import { OrderModule } from '../src/order/order.module'
import { ParameterModule } from '../src/parameter/parameter.module'
import { ProductModule } from '../src/product/product.module'
import { StockModule } from '../src/stock/stock.module'
import { UploadModule } from '../src/upload/upload.module'
import { UploadRepository } from '../src/upload/upload.repository'

const CLOUDINARY_URL =
  'https://res.cloudinary.com/demo/image/upload/v1/fastfood/products/burger.png'

const DAYS = [0, 1, 2, 3, 4, 5, 6]

const openHours = DAYS.map((dayOfWeek) => ({
  dayOfWeek,
  opening: '00:00',
  closing: '23:59',
  closed: false,
}))

const customerToken = (id: string): string =>
  jwt.sign({ userId: id, roles: ['customer'] }, env.jwtSecret)

const branchAdminTokenFor = (branchId: string, userId = 'branch-1'): string =>
  jwt.sign({ userId, roles: ['branch_admin'], branchId }, env.jwtSecret)

const superToken = jwt.sign({ userId: 'admin-1', roles: ['super_admin'] }, env.jwtSecret)

const deliveryAddress = {
  addressId: 'addr-1',
  deliveryAddress: { text: 'Av Cliente', latitude: 0.0001, longitude: 0 },
}

describe('Commerce Service — flujo de pedidos (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>

  let branchId = ''
  let ingredientId = ''
  let lowIngredientId = ''
  let mainProductId = ''
  let branchProductId = ''
  let lowStockProductId = ''
  let repeatAvailableProductId = ''
  let repeatGoneProductId = ''
  let matrixProductId = ''
  let extraOptionId = ''

  const auth = (token: string): [string, string] => ['Authorization', `Bearer ${token}`]
  const http = () => request(app.getHttpServer())

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        SecurityModule,
        CategoryModule,
        ProductModule,
        IngredientModule,
        BranchModule,
        CartModule,
        OrderModule,
        StockModule,
        ParameterModule,
        UploadModule,
      ],
    })
      .overrideProvider(UploadRepository)
      .useValue({ upload: jest.fn().mockResolvedValue({ url: CLOUDINARY_URL }) })
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.init()

    const category = await http()
      .post('/v1/catalog/categories')
      .set(...auth(superToken))
      .send({ name: 'Hamburguesas' })
      .expect(201)

    const ingredient = await http()
      .post('/v1/catalog/ingredients')
      .set(...auth(superToken))
      .send({ name: 'Medallón', unit: 'un' })
      .expect(201)
    ingredientId = ingredient.body.id as string

    const lowIngredient = await http()
      .post('/v1/catalog/ingredients')
      .set(...auth(superToken))
      .send({ name: 'Queso escaso', unit: 'un' })
      .expect(201)
    lowIngredientId = lowIngredient.body.id as string

    const branch = await http()
      .post('/v1/branches')
      .set(...auth(superToken))
      .send({ name: 'Centro', addressText: 'Av 1', latitude: 0, longitude: 0 })
      .expect(201)
    branchId = branch.body.id as string

    await http()
      .put(`/v1/branches/${branchId}/hours`)
      .set(...auth(superToken))
      .send({ hours: openHours })
      .expect(200)

    await http()
      .post('/v1/stock/adjustments')
      .set(...auth(superToken))
      .send({ branchId, ingredientId, delta: 1000 })
      .expect(201)

    await http()
      .post('/v1/stock/adjustments')
      .set(...auth(superToken))
      .send({ branchId, ingredientId: lowIngredientId, delta: 1 })
      .expect(201)

    const createProduct = async (name: string, categoryId: string): Promise<string> => {
      const res = await http()
        .post('/v1/catalog/products')
        .set(...auth(superToken))
        .send({ categoryId, name, description: 'Rica', price: 100 })
        .expect(201)
      return res.body.id as string
    }

    const setRecipe = (
      productId: string,
      quantity: number,
      recipeIngredientId = ingredientId,
    ): Promise<unknown> =>
      http()
        .put(`/v1/catalog/products/${productId}/recipe`)
        .set(...auth(superToken))
        .send({ items: [{ ingredientId: recipeIngredientId, quantity }] })
        .expect(200)

    mainProductId = await createProduct('Hamburguesa principal', category.body.id as string)
    branchProductId = await createProduct('Hamburguesa de sucursal', category.body.id as string)
    lowStockProductId = await createProduct('Hamburguesa escasa', category.body.id as string)
    repeatAvailableProductId = await createProduct(
      'Hamburguesa repetible',
      category.body.id as string,
    )
    repeatGoneProductId = await createProduct(
      'Hamburguesa discontinuada',
      category.body.id as string,
    )
    matrixProductId = await createProduct('Hamburguesa de estados', category.body.id as string)

    await setRecipe(mainProductId, 2)
    await setRecipe(branchProductId, 1)
    await setRecipe(lowStockProductId, 5, lowIngredientId)
    await setRecipe(repeatAvailableProductId, 1)
    await setRecipe(repeatGoneProductId, 1)
    await setRecipe(matrixProductId, 1)

    const group = await http()
      .post(`/v1/catalog/products/${mainProductId}/configurations`)
      .set(...auth(superToken))
      .send({ name: 'Extras', type: 'single', required: false })
      .expect(201)

    const option = await http()
      .post(`/v1/catalog/products/${mainProductId}/configurations/${group.body.id}/options`)
      .set(...auth(superToken))
      .send({ name: 'Extra queso', extraPrice: 50 })
      .expect(201)
    extraOptionId = option.body.id as string
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  const addCartItem = (
    token: string,
    body: { productId: string; quantity: number; optionIds?: string[]; observations?: string },
  ) =>
    http()
      .post('/v1/carts/items')
      .set(...auth(token))
      .send(body)

  const createPendingOrder = async (customerId: string): Promise<string> => {
    const token = customerToken(customerId)
    await addCartItem(token, { productId: matrixProductId, quantity: 1 }).expect(201)
    const created = await http()
      .post('/v1/orders')
      .set(...auth(token))
      .send(deliveryAddress)
      .expect(201)
    return created.body.id as string
  }

  const setBranchClosed = (closed: boolean) =>
    http()
      .put(`/v1/branches/${branchId}/hours`)
      .set(...auth(superToken))
      .send({ hours: openHours.map((hour) => ({ ...hour, closed })) })
      .expect(200)

  describe('confirmación: total, snapshot y ETA (RQ-ORD-06/07/09)', () => {
    it('guarda snapshot de nombre, precio unitario y opciones, y calcula el total', async () => {
      const token = customerToken('cust-total')

      await addCartItem(token, {
        productId: mainProductId,
        quantity: 2,
        optionIds: [extraOptionId],
        observations: 'sin sal',
      }).expect(201)

      const created = await http()
        .post('/v1/orders')
        .set(...auth(token))
        .send(deliveryAddress)
        .expect(201)

      expect(created.body.total).toBe(300)
      expect(created.body.branchId).toBe(branchId)
      expect(created.body.status).toBe('pending')
      expect(created.body.estimatedDeliveryAt).toBeTruthy()
      expect(created.body.items[0]).toMatchObject({
        productId: mainProductId,
        name: 'Hamburguesa principal',
        unitPrice: 150,
        quantity: 2,
        observations: 'sin sal',
        subtotal: 300,
        options: [{ optionId: extraOptionId, name: 'Extra queso', extraPrice: 50 }],
      })

      const fetched = await http()
        .get(`/v1/orders/${created.body.id}`)
        .set(...auth(token))
        .expect(200)

      expect(fetched.body.items[0].unitPrice).toBe(150)
      expect(fetched.body.items[0].options[0].name).toBe('Extra queso')
      expect(fetched.body.total).toBe(300)
    })
  })

  describe('validaciones de confirmación (RQ-ORD-01/03/04, RQ-STK-06)', () => {
    it('stock insuficiente → 409 INSUFFICIENT_STOCK y no crea el pedido', async () => {
      const token = customerToken('cust-low')

      await addCartItem(token, { productId: lowStockProductId, quantity: 1 }).expect(201)

      const res = await http()
        .post('/v1/orders')
        .set(...auth(token))
        .send(deliveryAddress)
        .expect(409)

      expect(res.body.code).toBe('INSUFFICIENT_STOCK')

      const orders = await http()
        .get('/v1/orders')
        .set(...auth(token))
        .expect(200)
      expect(orders.body.data).toHaveLength(0)

      const cart = await http()
        .get('/v1/carts')
        .set(...auth(token))
        .expect(200)
      expect(cart.body.items).toHaveLength(1)
    })

    it('sin sucursal abierta → 409 NO_BRANCH_AVAILABLE', async () => {
      const token = customerToken('cust-closed')
      await addCartItem(token, { productId: mainProductId, quantity: 1 }).expect(201)
      await setBranchClosed(true)

      try {
        const res = await http()
          .post('/v1/orders')
          .set(...auth(token))
          .send(deliveryAddress)
          .expect(409)

        expect(res.body.code).toBe('NO_BRANCH_AVAILABLE')
      } finally {
        await setBranchClosed(false)
      }
    })

    it('producto pausado en la sucursal → 400 PRODUCT_UNAVAILABLE', async () => {
      const token = customerToken('cust-branch-product')
      await addCartItem(token, { productId: branchProductId, quantity: 1 }).expect(201)

      await http()
        .patch(`/v1/branches/${branchId}/products/${branchProductId}/availability`)
        .set(...auth(superToken))
        .send({ available: false })
        .expect(200)

      const res = await http()
        .post('/v1/orders')
        .set(...auth(token))
        .send(deliveryAddress)
        .expect(400)

      expect(res.body.code).toBe('PRODUCT_UNAVAILABLE')
    })

    // KNOWN BUG: CreateOrderDto no exige `deliveryAddress` (ver order-dtos.spec.ts). Al faltar,
    // el orchestrator lee `input.deliveryAddress.latitude` sobre undefined y responde 500 en
    // lugar del 400 de validación. Impacto: un cliente no puede saber que envió mal el payload.
    it('KNOWN BUG: sin deliveryAddress responde 500 en lugar de 400', async () => {
      const token = customerToken('cust-no-address')
      await addCartItem(token, { productId: mainProductId, quantity: 1 }).expect(201)

      const res = await http()
        .post('/v1/orders')
        .set(...auth(token))
        .send({ addressId: 'addr-1' })
        .expect(500)

      expect(res.body.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })

  describe('máquina de estados vía HTTP (RQ-ORD-14/15)', () => {
    it('recorre toda la cadena válida Pendiente → Entregado', async () => {
      const orderId = await createPendingOrder('cust-matrix-valid')
      const admin = branchAdminTokenFor(branchId)
      const chain = ['confirmed', 'preparing', 'ready_for_delivery', 'on_the_way', 'delivered']

      for (const status of chain) {
        const res = await http()
          .patch(`/v1/orders/${orderId}/status`)
          .set(...auth(admin))
          .send({ status })
          .expect(200)
        expect(res.body.status).toBe(status)
      }

      const history = await http()
        .get(`/v1/orders/${orderId}/history`)
        .set(...auth(branchAdminTokenFor(branchId)))
        .expect(200)
      expect(history.body).toHaveLength(6)
    })

    it.each([
      { name: 'pendiente → entregado', target: 'delivered' },
      { name: 'pendiente → en preparación', target: 'preparing' },
      { name: 'pendiente → en camino', target: 'on_the_way' },
    ])('$name → 409 INVALID_TRANSITION', async ({ target }) => {
      const orderId = await createPendingOrder(`cust-invalid-${target}`)

      const res = await http()
        .patch(`/v1/orders/${orderId}/status`)
        .set(...auth(branchAdminTokenFor(branchId)))
        .send({ status: target })
        .expect(409)

      expect(res.body.code).toBe('INVALID_TRANSITION')
      expect(res.body.message).toContain('Transición inválida')
    })

    it('confirmado → entregado → 409 INVALID_TRANSITION', async () => {
      const orderId = await createPendingOrder('cust-invalid-confirmed')
      const admin = branchAdminTokenFor(branchId)

      await http()
        .patch(`/v1/orders/${orderId}/status`)
        .set(...auth(admin))
        .send({ status: 'confirmed' })
        .expect(200)

      const res = await http()
        .patch(`/v1/orders/${orderId}/status`)
        .set(...auth(admin))
        .send({ status: 'delivered' })
        .expect(409)

      expect(res.body.code).toBe('INVALID_TRANSITION')
    })

    it('cancelación: activo → cancelado permitido y cancelado terminal', async () => {
      const orderId = await createPendingOrder('cust-cancel')
      const admin = branchAdminTokenFor(branchId)

      const cancelled = await http()
        .patch(`/v1/orders/${orderId}/status`)
        .set(...auth(admin))
        .send({ status: 'cancelled' })
        .expect(200)
      expect(cancelled.body.status).toBe('cancelled')

      const res = await http()
        .patch(`/v1/orders/${orderId}/status`)
        .set(...auth(admin))
        .send({ status: 'confirmed' })
        .expect(409)
      expect(res.body.code).toBe('INVALID_TRANSITION')
    })

    it('un admin de otra sucursal no puede operar el pedido (403)', async () => {
      const orderId = await createPendingOrder('cust-forbidden')

      const res = await http()
        .patch(`/v1/orders/${orderId}/status`)
        .set(...auth(branchAdminTokenFor('other-branch', 'branch-2')))
        .send({ status: 'confirmed' })
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })
  })

  describe('idempotencia de estados (RQ-ORD-15)', () => {
    it('repetir el mismo estado no duplica el historial', async () => {
      const token = customerToken('cust-idempotent')
      const orderId = await createPendingOrder('cust-idempotent')
      const admin = branchAdminTokenFor(branchId)

      const initial = await http()
        .get(`/v1/orders/${orderId}/history`)
        .set(...auth(token))
        .expect(200)
      expect(initial.body).toHaveLength(1)

      await http()
        .patch(`/v1/orders/${orderId}/status`)
        .set(...auth(admin))
        .send({ status: 'pending' })
        .expect(200)

      const afterSame = await http()
        .get(`/v1/orders/${orderId}/history`)
        .set(...auth(token))
        .expect(200)
      expect(afterSame.body).toHaveLength(1)

      await http()
        .patch(`/v1/orders/${orderId}/status`)
        .set(...auth(admin))
        .send({ status: 'confirmed' })
        .expect(200)
      await http()
        .patch(`/v1/orders/${orderId}/status`)
        .set(...auth(admin))
        .send({ status: 'confirmed' })
        .expect(200)

      const afterRepeat = await http()
        .get(`/v1/orders/${orderId}/history`)
        .set(...auth(token))
        .expect(200)
      expect(afterRepeat.body).toHaveLength(2)
    })
  })

  describe('repetir pedido (RQ-ORD-17)', () => {
    it('omite los productos no disponibles y reconstruye el carrito', async () => {
      const token = customerToken('cust-repeat')
      await addCartItem(token, { productId: repeatAvailableProductId, quantity: 2 }).expect(201)
      await addCartItem(token, { productId: repeatGoneProductId, quantity: 1 }).expect(201)

      const created = await http()
        .post('/v1/orders')
        .set(...auth(token))
        .send(deliveryAddress)
        .expect(201)
      expect(created.body.items).toHaveLength(2)

      await http()
        .patch(`/v1/catalog/products/${repeatGoneProductId}/available`)
        .set(...auth(superToken))
        .send({ available: false })
        .expect(200)

      const repeated = await http()
        .post(`/v1/orders/${created.body.id}/repeat`)
        .set(...auth(token))
        .expect(201)

      expect(repeated.body.skippedProducts).toHaveLength(1)
      expect(repeated.body.skippedProducts[0].id).toBe(repeatGoneProductId)
      expect(repeated.body.cart.items).toHaveLength(1)
      expect(repeated.body.cart.items[0]).toMatchObject({
        productId: repeatAvailableProductId,
        quantity: 2,
      })
      expect(repeated.body.cart.total).toBe(200)
    })

    it('rechaza repetir un pedido de otro cliente (404)', async () => {
      const owner = customerToken('cust-repeat-owner')
      await addCartItem(owner, { productId: repeatAvailableProductId, quantity: 1 }).expect(201)
      const created = await http()
        .post('/v1/orders')
        .set(...auth(owner))
        .send(deliveryAddress)
        .expect(201)

      const res = await http()
        .post(`/v1/orders/${created.body.id}/repeat`)
        .set(...auth(customerToken('cust-other')))
        .expect(404)

      expect(res.body.code).toBe('ORDER_NOT_FOUND')
    })
  })

  describe('actualización y eliminación de ítems (RQ-CART-04/05/06/07)', () => {
    const patchItem = (token: string, itemId: string, body: Record<string, unknown>) =>
      http()
        .patch(`/v1/carts/items/${itemId}`)
        .set(...auth(token))
        .send(body)

    it('recalcula el total en el servidor al actualizar cantidad, opciones y quitar', async () => {
      const token = customerToken('cust-cart')

      const added = await addCartItem(token, { productId: mainProductId, quantity: 1 }).expect(201)
      expect(added.body.total).toBe(100)

      const withQuantity = await patchItem(token, added.body.items[0].id as string, {
        quantity: 2,
      }).expect(200)
      expect(withQuantity.body.total).toBe(200)

      const withOption = await patchItem(token, withQuantity.body.items[0].id as string, {
        optionIds: [extraOptionId],
      }).expect(200)
      expect(withOption.body.total).toBe(300)

      const withObservation = await patchItem(token, withOption.body.items[0].id as string, {
        observations: 'sin cebolla',
      }).expect(200)
      expect(withObservation.body.total).toBe(300)
      expect(withObservation.body.items[0].observations).toBe('sin cebolla')

      const removed = await http()
        .delete(`/v1/carts/items/${withObservation.body.items[0].id}`)
        .set(...auth(token))
        .expect(200)
      expect(removed.body.total).toBe(0)
      expect(removed.body.items).toHaveLength(0)
    })

    // KNOWN BUG: el repositorio reemplaza el array completo con `$set: { items }`, así que Mongo
    // regenera el `_id` de todos los subdocumentos en cada mutación. El `id` de un ítem deja de
    // ser válido tras cualquier update; un cliente que reutiliza el id que obtuvo al agregarlo
    // recibe 404 CART_ITEM_NOT_FOUND. Impacto: rompe el contrato PATCH/DELETE por itemId estable.
    it('KNOWN BUG: el id del ítem cambia tras una actualización', async () => {
      const token = customerToken('cust-cart-id')

      const added = await addCartItem(token, { productId: mainProductId, quantity: 1 }).expect(201)
      const originalId = added.body.items[0].id as string

      const updated = await patchItem(token, originalId, { quantity: 2 }).expect(200)
      const newId = updated.body.items[0].id as string

      expect(newId).not.toBe(originalId)

      const res = await patchItem(token, originalId, { quantity: 3 }).expect(404)
      expect(res.body.code).toBe('CART_ITEM_NOT_FOUND')
    })
  })

  describe('duplicado de confirmación desde el mismo carrito (RQ-CART-08/09)', () => {
    it('un segundo createOrder del mismo cliente responde 400 CART_NOT_FOUND sin duplicar', async () => {
      const token = customerToken('cust-duplicate')
      await addCartItem(token, { productId: mainProductId, quantity: 1 }).expect(201)

      await http()
        .post('/v1/orders')
        .set(...auth(token))
        .send(deliveryAddress)
        .expect(201)

      const res = await http()
        .post('/v1/orders')
        .set(...auth(token))
        .send(deliveryAddress)
        .expect(400)

      expect(res.body.code).toBe('CART_NOT_FOUND')

      const orders = await http()
        .get('/v1/orders')
        .set(...auth(token))
        .expect(200)
      expect(orders.body.data).toHaveLength(1)
    })
  })
})
