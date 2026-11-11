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
import { ERROR_CODES } from '../src/config/constants'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { IngredientModule } from '../src/ingredient/ingredient.module'
import { OrderModule } from '../src/order/order.module'
import { ParameterModule } from '../src/parameter/parameter.module'
import { ProductModule } from '../src/product/product.module'
import { PromotionModule } from '../src/promotion/promotion.module'
import { StockModule } from '../src/stock/stock.module'
import { UploadModule } from '../src/upload/upload.module'
import { UploadRepository } from '../src/upload/upload.repository'
import { createMongoServer } from './mongo'

const superToken = jwt.sign({ userId: 'admin-1', roles: ['super_admin'] }, env.jwtSecret)
const customerToken = (id: string): string =>
  jwt.sign({ userId: id, roles: ['customer'] }, env.jwtSecret)

const DAYS = [0, 1, 2, 3, 4, 5, 6]
const openHours = DAYS.map((dayOfWeek) => ({
  dayOfWeek,
  opening: '00:00',
  closing: '23:59',
  closed: false,
}))

const deliveryAddress = {
  addressId: 'addr-1',
  deliveryAddress: { text: 'Av Rivadavia 1234', latitude: -34.6, longitude: -58.4 },
}

describe('Commerce — Carrito con promociones, cupones, snapshot y ledger (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let branchId = ''
  let categoryId = ''
  let productId = ''
  let couponPromoId = ''

  const auth = (token: string): [string, string] => ['Authorization', `Bearer ${token}`]
  const http = () => request(app.getHttpServer())

  beforeAll(async () => {
    mongod = await createMongoServer()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        SecurityModule,
        CategoryModule,
        IngredientModule,
        BranchModule,
        ProductModule,
        StockModule,
        PromotionModule,
        CartModule,
        OrderModule,
        ParameterModule,
        UploadModule,
      ],
    })
      .overrideProvider(UploadRepository)
      .useValue({
        uploadImage: jest.fn().mockResolvedValue({
          url: 'https://images.unsplash.com/photo-test',
          publicId: 'test-id',
        }),
        deleteImage: jest.fn().mockResolvedValue(true),
      })
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

    // Configurar parámetros base para cálculo de delivery/ETA
    await http()
      .put('/v1/parameters/MAX_DISTANCE_KM')
      .set(...auth(superToken))
      .send({ value: 50, unit: 'km' })

    await http()
      .put('/v1/parameters/BASE_PREP_MIN')
      .set(...auth(superToken))
      .send({ value: 15, unit: 'min' })

    await http()
      .put('/v1/parameters/AVG_SPEED_KMH')
      .set(...auth(superToken))
      .send({ value: 30, unit: 'km/h' })

    // Crear sucursal
    const branchRes = await http()
      .post('/v1/branches')
      .set(...auth(superToken))
      .send({
        name: 'Sucursal Central',
        addressText: 'Av Rivadavia 1200',
        latitude: -34.6,
        longitude: -58.4,
      })
    branchId = branchRes.body.id

    await http()
      .put(`/v1/branches/${branchId}/hours`)
      .set(...auth(superToken))
      .send({ hours: openHours })

    // Crear ingrediente y stock suficiente
    const ingRes = await http()
      .post('/v1/catalog/ingredients')
      .set(...auth(superToken))
      .send({ name: 'Medallón', unit: 'un', minQuantity: 5 })
    const ingredientId = ingRes.body.id

    await http()
      .post('/v1/stock/adjustments')
      .set(...auth(superToken))
      .send({ branchId, ingredientId, delta: 500 })
      .expect(201)

    // Crear categoría y producto ($5000 cada uno)
    const catRes = await http()
      .post('/v1/catalog/categories')
      .set(...auth(superToken))
      .send({ name: 'Hamburguesas' })
    categoryId = catRes.body.id

    const prodRes = await http()
      .post('/v1/catalog/products')
      .set(...auth(superToken))
      .send({
        categoryId,
        name: 'Burger Doble Cheddar',
        description: 'Hamburguesa premium',
        price: 5000,
      })
    productId = prodRes.body.id

    await http()
      .put(`/v1/catalog/products/${productId}/recipe`)
      .set(...auth(superToken))
      .send({ items: [{ ingredientId, quantity: 1 }] })

    // Crear cupón $2000 con límite 1 por cliente
    const couponRes = await http()
      .post('/v1/catalog/promotions')
      .set(...auth(superToken))
      .send({
        name: 'Cupón Bienvenida',
        description: '$2.000 off en orden',
        startDate: '2020-01-01T00:00:00.000Z',
        endDate: '2030-12-31T23:59:59.999Z',
        type: 'FIXED_AMOUNT',
        discountValue: 2000,
        scope: 'ORDER',
        code: 'PROMO2000',
        minSubtotal: 4000,
        maxUsesTotal: 10,
        maxUsesPerCustomer: 1,
      })
    couponPromoId = couponRes.body.id

    await http()
      .patch(`/v1/catalog/promotions/${couponPromoId}/active`)
      .set(...auth(superToken))
      .send({ active: true })
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('Carrito: Promociones automáticas y aplicación de cupones', () => {
    it('calcula subtotal y total sin descuentos cuando no hay cupón ni promo automática', async () => {
      const token = customerToken('user-1')

      await http()
        .post('/v1/carts/items')
        .set(...auth(token))
        .send({ productId, quantity: 2 })
        .expect(201)

      const cartRes = await http()
        .get('/v1/carts')
        .set(...auth(token))
        .expect(200)

      expect(cartRes.body.subtotal).toBe(10000)
      expect(cartRes.body.discountTotal).toBe(0)
      expect(cartRes.body.total).toBe(10000)
      expect(cartRes.body.appliedPromotions).toHaveLength(0)
    })

    it('aplica cupón válido normalizado a mayúsculas y reduce el total', async () => {
      const token = customerToken('user-1')

      const applyRes = await http()
        .patch('/v1/carts/promotion-code')
        .set(...auth(token))
        .send({ code: 'promo2000' })
        .expect(200)

      expect(applyRes.body.promotionCode).toBe('PROMO2000')
      expect(applyRes.body.subtotal).toBe(10000)
      expect(applyRes.body.discountTotal).toBe(2000)
      expect(applyRes.body.total).toBe(8000)
      expect(applyRes.body.appliedPromotions).toHaveLength(1)
      expect(applyRes.body.appliedPromotions[0]).toMatchObject({
        promotionId: couponPromoId,
        code: 'PROMO2000',
        amount: 2000,
      })
    })

    it('rechaza cupón inexistente con PROMOTION_CODE_INVALID', async () => {
      const token = customerToken('user-1')

      const res = await http()
        .patch('/v1/carts/promotion-code')
        .set(...auth(token))
        .send({ code: 'CODIGO_INEXISTENTE' })
        .expect(400)

      expect(res.body.code).toBe(ERROR_CODES.promotionCodeInvalid)
    })

    it('remueve cupón enviando { code: null } y restaura los montos originales', async () => {
      const token = customerToken('user-1')

      const removeRes = await http()
        .patch('/v1/carts/promotion-code')
        .set(...auth(token))
        .send({ code: null })
        .expect(200)

      expect(removeRes.body.promotionCode).toBeNull()
      expect(removeRes.body.subtotal).toBe(10000)
      expect(removeRes.body.discountTotal).toBe(0)
      expect(removeRes.body.total).toBe(10000)
      expect(removeRes.body.appliedPromotions).toHaveLength(0)
    })
  })

  describe('Creación de pedido con snapshot promocional y ledger', () => {
    let orderId = ''

    it('genera orden con snapshot inmutable y registra redención en ledger', async () => {
      const token = customerToken('user-coupon-1')

      // Agregar producto ($5000)
      await http()
        .post('/v1/carts/items')
        .set(...auth(token))
        .send({ productId, quantity: 1 })
        .expect(201)

      // Aplicar cupón ($2000)
      await http()
        .patch('/v1/carts/promotion-code')
        .set(...auth(token))
        .send({ code: 'PROMO2000' })
        .expect(200)

      // Crear orden
      const orderRes = await http()
        .post('/v1/orders')
        .set(...auth(token))
        .send(deliveryAddress)
        .expect(201)

      orderId = orderRes.body.id
      expect(orderRes.body.subtotal).toBe(5000)
      expect(orderRes.body.discountTotal).toBe(2000)
      expect(orderRes.body.total).toBe(3000)
      expect(orderRes.body.promotionCode).toBe('PROMO2000')
      expect(orderRes.body.appliedPromotions).toHaveLength(1)
      expect(orderRes.body.appliedPromotions[0]).toMatchObject({
        promotionId: couponPromoId,
        code: 'PROMO2000',
        amount: 2000,
      })

      // Verificar que usedCount de la promoción se incrementó a 1
      const promoCheck = await http()
        .get(`/v1/catalog/promotions/${couponPromoId}`)
        .set(...auth(superToken))
        .expect(200)

      expect(promoCheck.body.usedCount).toBe(1)
    })

    it('bloquea al mismo usuario de volver a usar el cupón que tiene maxUsesPerCustomer = 1', async () => {
      const token = customerToken('user-coupon-1')

      await http()
        .post('/v1/carts/items')
        .set(...auth(token))
        .send({ productId, quantity: 1 })
        .expect(201)

      const res = await http()
        .patch('/v1/carts/promotion-code')
        .set(...auth(token))
        .send({ code: 'PROMO2000' })
        .expect(409)

      expect(res.body.code).toBe(ERROR_CODES.promotionLimitReached)
    })

    it('libera la redención y decrementa usedCount al cancelar el pedido', async () => {
      const token = customerToken('user-coupon-1')

      // Cancelar pedido
      const cancelRes = await http()
        .patch(`/v1/orders/${orderId}/status`)
        .set(...auth(superToken))
        .send({ status: 'cancelled' })
        .expect(200)

      expect(cancelRes.body.status).toBe('cancelled')

      // Verificar que usedCount se decrementó a 0
      const promoCheck = await http()
        .get(`/v1/catalog/promotions/${couponPromoId}`)
        .set(...auth(superToken))
        .expect(200)

      expect(promoCheck.body.usedCount).toBe(0)

      // Ahora el usuario debe poder volver a aplicar el cupón
      const retryRes = await http()
        .patch('/v1/carts/promotion-code')
        .set(...auth(token))
        .send({ code: 'PROMO2000' })
        .expect(200)

      expect(retryRes.body.promotionCode).toBe('PROMO2000')
      expect(retryRes.body.discountTotal).toBe(2000)
      expect(retryRes.body.total).toBe(3000)
    })
  })
})
