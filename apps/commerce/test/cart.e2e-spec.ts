import { INestApplication, ValidationPipe } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Types } from 'mongoose'
import request from 'supertest'
import { createMongoServer } from './mongo'
import type { App } from 'supertest/types'
import { BranchModule } from '../src/branch/branch.module'
import { CartModule } from '../src/cart/cart.module'
import { CategoryModule } from '../src/category/category.module'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { IngredientModule } from '../src/ingredient/ingredient.module'
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

const superToken = jwt.sign({ userId: 'admin-1', roles: ['super_admin'] }, env.jwtSecret)

const customerToken = (id: string): string =>
  jwt.sign({ userId: id, roles: ['customer'] }, env.jwtSecret)

const branchAdminTokenFor = (branchId: string, userId = 'branch-1'): string =>
  jwt.sign({ userId, roles: ['branch_admin'], branchId }, env.jwtSecret)

const riderToken = jwt.sign({ userId: 'rider-1', roles: ['rider'] }, env.jwtSecret)

describe('Commerce Service — carrito (e2e, RQ-CART-01/04/05/06/07/08/09)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>

  let branchId = ''
  let mainProductId = ''
  let unavailableProductId = ''

  const auth = (token: string): [string, string] => ['Authorization', `Bearer ${token}`]
  const http = () => request(app.getHttpServer())

  const addItem = (
    token: string,
    body: { productId: string; quantity: number; observations?: string },
  ) =>
    http()
      .post('/v1/carts/items')
      .set(...auth(token))
      .send(body)

  beforeAll(async () => {
    mongod = await createMongoServer()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        SecurityModule,
        CategoryModule,
        ProductModule,
        IngredientModule,
        BranchModule,
        CartModule,
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
    await app.listen(0)

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
    const ingredientId = ingredient.body.id as string

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

    const createProduct = async (name: string, available = true): Promise<string> => {
      const res = await http()
        .post('/v1/catalog/products')
        .set(...auth(superToken))
        .send({ categoryId: category.body.id, name, description: 'Rica', price: 100 })
        .expect(201)

      if (!available) {
        await http()
          .patch(`/v1/catalog/products/${res.body.id}/available`)
          .set(...auth(superToken))
          .send({ available: false })
          .expect(200)
      }

      return res.body.id as string
    }

    mainProductId = await createProduct('Hamburguesa principal')

    await http()
      .put(`/v1/catalog/products/${mainProductId}/recipe`)
      .set(...auth(superToken))
      .send({ items: [{ ingredientId, quantity: 1 }] })
      .expect(200)

    unavailableProductId = await createProduct('Hamburguesa pausada', false)
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('GET /v1/carts', () => {
    it('sin token → 401 UNAUTHENTICATED', async () => {
      const res = await http().get('/v1/carts').expect(401)
      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it.each([
      { name: 'branch_admin', token: branchAdminTokenFor(branchId) },
      { name: 'rider', token: riderToken },
    ])('$name → 403 FORBIDDEN', async ({ token }) => {
      const res = await http()
        .get('/v1/carts')
        .set(...auth(token))
        .expect(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })

    it('customer con carrito → 200 con los ítems y el total', async () => {
      const token = customerToken('cust-get-with-cart')
      await addItem(token, { productId: mainProductId, quantity: 2 }).expect(201)

      const res = await http()
        .get('/v1/carts')
        .set(...auth(token))
        .expect(200)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.total).toBe(200)
    })

    it('customer sin carrito → 200 con carrito activo vacío (creado bajo demanda)', async () => {
      const res = await http()
        .get('/v1/carts')
        .set(...auth(customerToken('cust-get-empty')))
        .expect(200)

      expect(res.body).toMatchObject({ status: 'active', total: 0, items: [] })
    })
  })

  describe('POST /v1/carts/items', () => {
    it('agrega un ítem y calcula el total en el servidor (201)', async () => {
      const res = await addItem(customerToken('cust-add-ok'), {
        productId: mainProductId,
        quantity: 2,
        observations: 'sin sal',
      }).expect(201)

      expect(res.body.total).toBe(200)
      expect(res.body.items[0]).toMatchObject({
        productId: mainProductId,
        quantity: 2,
        observations: 'sin sal',
      })
    })

    it('producto existente pero no disponible → 400 PRODUCT_UNAVAILABLE', async () => {
      const res = await addItem(customerToken('cust-add-unavailable'), {
        productId: unavailableProductId,
        quantity: 1,
      }).expect(400)

      expect(res.body.code).toBe('PRODUCT_UNAVAILABLE')
    })

    // INT-06: un producto inexistente se distingue de uno no disponible.
    it('producto inexistente → 404 PRODUCT_NOT_FOUND', async () => {
      const res = await addItem(customerToken('cust-add-missing'), {
        productId: new Types.ObjectId().toString(),
        quantity: 1,
      }).expect(404)

      expect(res.body.code).toBe('PRODUCT_NOT_FOUND')
    })

    it.each([{ quantity: 0 }, { quantity: -3 }])(
      'quantity=$quantity → 400 VALIDATION_ERROR',
      async ({ quantity }) => {
        const res = await addItem(customerToken(`cust-add-qty-${quantity}`), {
          productId: mainProductId,
          quantity,
        }).expect(400)

        expect(res.body.code).toBe('VALIDATION_ERROR')
      },
    )

    it.each([
      { name: 'branch_admin', token: branchAdminTokenFor(branchId) },
      { name: 'rider', token: riderToken },
    ])('$name → 403 FORBIDDEN', async ({ token }) => {
      const res = await addItem(token, { productId: mainProductId, quantity: 1 }).expect(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })
  })

  describe('PATCH /v1/carts/items/:itemId', () => {
    const patchItem = (token: string, itemId: string, body: Record<string, unknown>) =>
      http()
        .patch(`/v1/carts/items/${itemId}`)
        .set(...auth(token))
        .send(body)

    it('actualiza la cantidad y recalcula el total (200)', async () => {
      const token = customerToken('cust-patch-ok')
      const added = await addItem(token, { productId: mainProductId, quantity: 1 }).expect(201)
      const itemId = added.body.items[0].id as string

      const res = await patchItem(token, itemId, { quantity: 3 }).expect(200)
      expect(res.body.items[0].quantity).toBe(3)
      expect(res.body.total).toBe(300)
    })

    it('itemId inexistente → 404 CART_ITEM_NOT_FOUND', async () => {
      const res = await patchItem(
        customerToken('cust-patch-missing'),
        new Types.ObjectId().toString(),
        {
          quantity: 2,
        },
      ).expect(404)

      expect(res.body.code).toBe('CART_ITEM_NOT_FOUND')
    })

    it.each([
      { name: 'branch_admin', token: branchAdminTokenFor(branchId) },
      { name: 'rider', token: riderToken },
    ])('$name → 403 FORBIDDEN', async ({ token }) => {
      const res = await patchItem(token, new Types.ObjectId().toString(), { quantity: 2 }).expect(
        403,
      )
      expect(res.body.code).toBe('FORBIDDEN')
    })
  })

  describe('DELETE /v1/carts/items/:itemId', () => {
    it('elimina el ítem y deja el total en 0 (200)', async () => {
      const token = customerToken('cust-delete-ok')
      const added = await addItem(token, { productId: mainProductId, quantity: 1 }).expect(201)
      const itemId = added.body.items[0].id as string

      const res = await http()
        .delete(`/v1/carts/items/${itemId}`)
        .set(...auth(token))
        .expect(200)

      expect(res.body.items).toHaveLength(0)
      expect(res.body.total).toBe(0)
    })

    it('itemId inexistente → 404 CART_ITEM_NOT_FOUND', async () => {
      const res = await http()
        .delete(`/v1/carts/items/${new Types.ObjectId().toString()}`)
        .set(...auth(customerToken('cust-delete-missing')))
        .expect(404)

      expect(res.body.code).toBe('CART_ITEM_NOT_FOUND')
    })
  })

  describe('POST /v1/carts/confirm', () => {
    it('confirma un carrito con ítems y responde 200', async () => {
      const token = customerToken('cust-confirm-ok')
      await addItem(token, { productId: mainProductId, quantity: 2 }).expect(201)

      const res = await http()
        .post('/v1/carts/confirm')
        .set(...auth(token))
        .expect(200)
      expect(res.body.status).toBe('confirmed')
      expect(res.body.items).toHaveLength(1)
      expect(res.body.total).toBe(200)

      const after = await http()
        .get('/v1/carts')
        .set(...auth(token))
        .expect(200)
      expect(after.body).toMatchObject({ status: 'active', items: [] })
    })

    // INT-07: confirmar un carrito inexistente o vacío debe rechazarse. El
    // contrato sólo define CART_NOT_FOUND (no existe CART_EMPTY) → 404.
    it('carrito inexistente → 404 CART_NOT_FOUND', async () => {
      const res = await http()
        .post('/v1/carts/confirm')
        .set(...auth(customerToken('cust-confirm-empty')))
        .expect(404)

      expect(res.body.code).toBe('CART_NOT_FOUND')
    })

    it('carrito existente pero vacío → 404 CART_NOT_FOUND', async () => {
      const token = customerToken('cust-confirm-empty-cart')
      await http()
        .get('/v1/carts')
        .set(...auth(token))
        .expect(200)

      const res = await http()
        .post('/v1/carts/confirm')
        .set(...auth(token))
        .expect(404)

      expect(res.body.code).toBe('CART_NOT_FOUND')
    })

    it.each([
      { name: 'branch_admin', token: branchAdminTokenFor(branchId) },
      { name: 'rider', token: riderToken },
    ])('$name → 403 FORBIDDEN', async ({ token }) => {
      const res = await http()
        .post('/v1/carts/confirm')
        .set(...auth(token))
        .expect(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })
  })
})
