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
import { OrderStateModule } from '../src/order-state/order-state.module'
import { ParameterModule } from '../src/parameter/parameter.module'
import { ProductModule } from '../src/product/product.module'
import { PromotionModule } from '../src/promotion/promotion.module'
import { ReportingModule } from '../src/reporting/reporting.module'
import { StockModule } from '../src/stock/stock.module'

const superToken = jwt.sign({ userId: 'admin-1', roles: ['super_admin'] }, env.jwtSecret)
const customerToken = jwt.sign({ userId: 'cust-1', roles: ['customer'] }, env.jwtSecret)

const branchAdminTokenFor = (branchId: string): string =>
  jwt.sign({ userId: 'branch-1', roles: ['branch_admin'], branchId }, env.jwtSecret)

describe('Commerce Service (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let categoryId = ''
  let ingredientId = ''
  let productId = ''
  let branchId = ''
  let orderId = ''

  const auth = (token: string): [string, string] => ['Authorization', `Bearer ${token}`]

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        SecurityModule,
        CategoryModule,
        ProductModule,
        IngredientModule,
        PromotionModule,
        BranchModule,
        CartModule,
        OrderModule,
        StockModule,
        ReportingModule,
        ParameterModule,
        OrderStateModule,
      ],
    }).compile()

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
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('catálogo (RQ-CAT)', () => {
    it('crea una categoría y un ingrediente', async () => {
      const category = await request(app.getHttpServer())
        .post('/v1/catalog/categories')
        .set(...auth(superToken))
        .send({ name: 'Hamburguesas' })
        .expect(201)

      categoryId = category.body.id as string

      const ingredient = await request(app.getHttpServer())
        .post('/v1/catalog/ingredients')
        .set(...auth(superToken))
        .send({ name: 'Medallón', unit: 'un' })
        .expect(201)

      ingredientId = ingredient.body.id as string
    })

    it('crea un producto con receta', async () => {
      const product = await request(app.getHttpServer())
        .post('/v1/catalog/products')
        .set(...auth(superToken))
        .send({ categoryId, name: 'Hamburguesa', description: 'Clásica', price: 100 })
        .expect(201)

      productId = product.body.id as string

      await request(app.getHttpServer())
        .put(`/v1/catalog/products/${productId}/recipe`)
        .set(...auth(superToken))
        .send({ items: [{ ingredientId, quantity: 2 }] })
        .expect(200)
    })

    it('expone el catálogo público', async () => {
      const res = await request(app.getHttpServer()).get('/v1/catalog/products').expect(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].available).toBe(true)
    })
  })

  describe('sucursal y stock (RQ-BRN, RQ-STK)', () => {
    it('crea una sucursal con horario abierto y ajusta stock', async () => {
      const branch = await request(app.getHttpServer())
        .post('/v1/branches')
        .set(...auth(superToken))
        .send({ name: 'Centro', addressText: 'Av 1', latitude: 0, longitude: 0 })
        .expect(201)

      branchId = branch.body.id as string

      const hours = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        opening: '00:00',
        closing: '23:59',
        closed: false,
      }))

      await request(app.getHttpServer())
        .put(`/v1/branches/${branchId}/hours`)
        .set(...auth(superToken))
        .send({ hours })
        .expect(200)

      await request(app.getHttpServer())
        .post('/v1/stock/adjustments')
        .set(...auth(superToken))
        .send({ branchId, ingredientId, delta: 10 })
        .expect(201)
    })
  })

  describe('carrito y pedido (RQ-CART, RQ-ORD)', () => {
    it('agrega al carrito y confirma el pedido asignando sucursal', async () => {
      await request(app.getHttpServer())
        .post('/v1/carts/items')
        .set(...auth(customerToken))
        .send({ productId, quantity: 1 })
        .expect(201)

      const created = await request(app.getHttpServer())
        .post('/v1/orders')
        .set(...auth(customerToken))
        .send({
          addressId: 'addr-1',
          deliveryAddress: { text: 'Av Cliente', latitude: 0.0001, longitude: 0 },
        })
        .expect(201)

      orderId = created.body.id as string

      expect(created.body.status).toBe('pending')
      expect(created.body.branchId).toBe(branchId)
      expect(created.body.total).toBe(100)
      expect(created.body.items[0].name).toBe('Hamburguesa')
      expect(created.body.estimatedDeliveryAt).toBeTruthy()
    })

    it('lista los pedidos del cliente', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/orders')
        .set(...auth(customerToken))
        .expect(200)

      expect(res.body.data).toHaveLength(1)
    })
  })

  describe('máquina de estados y descuento de stock (RQ-ORD-14, RQ-STK-07/08)', () => {
    it('transiciona a PREPARING y descuenta stock', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${branchAdminTokenFor(branchId)}`)
        .send({ status: 'confirmed' })
        .expect(200)

      await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${branchAdminTokenFor(branchId)}`)
        .send({ status: 'preparing' })
        .expect(200)

      const stock = await request(app.getHttpServer())
        .get(`/v1/stock?branchId=${branchId}`)
        .set('Authorization', `Bearer ${branchAdminTokenFor(branchId)}`)
        .expect(200)

      const entry = stock.body.find((row: { ingredientId: string }) => row.ingredientId === ingredientId)
      expect(entry.quantity).toBe(8)
    })

    it('rechaza una transición inválida', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${branchAdminTokenFor(branchId)}`)
        .send({ status: 'pending' })
        .expect(409)

      expect(res.body.code).toBe('INVALID_TRANSITION')
    })

    it('expone el historial de estados', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/orders/${orderId}/history`)
        .set(...auth(customerToken))
        .expect(200)

      expect(res.body).toHaveLength(3)
    })
  })

  describe('integración con Delivery (token interno, RQ-ORD-16)', () => {
    it('permite transicionar el pedido con X-Internal-Token', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/status`)
        .set('x-internal-token', env.internalApiToken)
        .send({ status: 'ready_for_delivery' })
        .expect(200)

      expect(res.body.status).toBe('ready_for_delivery')
    })
  })

  describe('seguridad (RQ-SEC-04/05)', () => {
    it('rechaza sin token (401)', async () => {
      const res = await request(app.getHttpServer()).get('/v1/carts').expect(401)
      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it('rechaza un no-admin en mutaciones de catálogo (403)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/catalog/categories')
        .set(...auth(customerToken))
        .send({ name: 'X' })
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })

    it('rechaza a un admin de otra sucursal operando el pedido', async () => {
      const otherAdmin = jwt.sign(
        { userId: 'branch-2', roles: ['branch_admin'], branchId: 'branch-2' },
        env.jwtSecret,
      )

      const res = await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${otherAdmin}`)
        .send({ status: 'ready_for_delivery' })
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })
  })
})
