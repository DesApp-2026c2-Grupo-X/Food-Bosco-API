import { INestApplication, ValidationPipe } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import type { App } from 'supertest/types'
import { BranchModule } from '../src/branch/branch.module'
import { CategoryModule } from '../src/category/category.module'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { IngredientModule } from '../src/ingredient/ingredient.module'
import { ProductModule } from '../src/product/product.module'
import { PromotionModule } from '../src/promotion/promotion.module'
import { ERROR_CODES } from '../src/config/constants'
import { createMongoServer } from './mongo'

const superToken = jwt.sign({ userId: 'admin-1', roles: ['super_admin'] }, env.jwtSecret)
const customerToken = jwt.sign({ userId: 'cust-1', roles: ['customer'] }, env.jwtSecret)
const riderToken = jwt.sign({ userId: 'rider-1', roles: ['rider'] }, env.jwtSecret)

const ISO_START = '2026-01-01T00:00:00.000Z'
const ISO_END = '2026-12-31T23:59:59.999Z'

describe('Commerce — Promociones CRUD, validaciones y endpoint público (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let categoryId = ''
  let productId = ''

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
        PromotionModule,
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

    // Crear categoría y producto base para referenciar
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
        name: 'Hamburguesa Doble',
        description: 'Hamburguesa con doble medallón de carne',
        price: 3500,
      })
    productId = prodRes.body.id
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('Control de acceso (RBAC)', () => {
    it('rechaza 401 si no hay token en POST /v1/catalog/promotions', async () => {
      await http()
        .post('/v1/catalog/promotions')
        .send({
          name: 'Promo Test',
          startDate: ISO_START,
          endDate: ISO_END,
        })
        .expect(401)
    })

    it('rechaza 403 a cliente en POST /v1/catalog/promotions', async () => {
      await http()
        .post('/v1/catalog/promotions')
        .set(...auth(customerToken))
        .send({
          name: 'Promo Test',
          startDate: ISO_START,
          endDate: ISO_END,
        })
        .expect(403)
    })

    it('rechaza 403 a rider en POST /v1/catalog/promotions', async () => {
      await http()
        .post('/v1/catalog/promotions')
        .set(...auth(riderToken))
        .send({
          name: 'Promo Test',
          startDate: ISO_START,
          endDate: ISO_END,
        })
        .expect(403)
    })
  })

  describe('CRUD de Promociones', () => {
    let createdId = ''

    it('crea una promoción porcentual con cupón y categoría', async () => {
      const res = await http()
        .post('/v1/catalog/promotions')
        .set(...auth(superToken))
        .send({
          name: '15% Off en Hamburguesas',
          description: 'Descuento especial con cupón',
          startDate: ISO_START,
          endDate: ISO_END,
          type: 'PERCENTAGE',
          discountValue: 15,
          maxDiscount: 2000,
          scope: 'CATEGORY',
          categoryIds: [categoryId],
          code: 'BURGER15',
          minSubtotal: 5000,
          maxUsesTotal: 50,
          maxUsesPerCustomer: 1,
        })
        .expect(201)

      expect(res.body).toMatchObject({
        name: '15% Off en Hamburguesas',
        type: 'PERCENTAGE',
        discountValue: 15,
        maxDiscount: 2000,
        scope: 'CATEGORY',
        categoryIds: [categoryId],
        code: 'BURGER15',
        active: true,
      })
      createdId = res.body.id
    })

    it('obtiene la promoción creada por ID', async () => {
      const res = await http()
        .get(`/v1/catalog/promotions/${createdId}`)
        .set(...auth(superToken))
        .expect(200)

      expect(res.body.id).toBe(createdId)
      expect(res.body.code).toBe('BURGER15')
    })

    it('desactiva y reactiva la promoción mediante PATCH :id/active', async () => {
      const resInactive = await http()
        .patch(`/v1/catalog/promotions/${createdId}/active`)
        .set(...auth(superToken))
        .send({ active: false })
        .expect(200)

      expect(resInactive.body.active).toBe(false)

      const resActive = await http()
        .patch(`/v1/catalog/promotions/${createdId}/active`)
        .set(...auth(superToken))
        .send({ active: true })
        .expect(200)

      expect(resActive.body.active).toBe(true)
    })

    it('actualiza datos de la promoción mediante PATCH :id', async () => {
      const res = await http()
        .patch(`/v1/catalog/promotions/${createdId}`)
        .set(...auth(superToken))
        .send({
          description: 'Nueva descripción',
          maxDiscount: 2500,
          active: true,
        })
        .expect(200)

      expect(res.body.description).toBe('Nueva descripción')
      expect(res.body.maxDiscount).toBe(2500)
      expect(res.body.active).toBe(true)
    })

    it('permite crear una promoción con active explícito', async () => {
      const res = await http()
        .post('/v1/catalog/promotions')
        .set(...auth(superToken))
        .send({
          name: 'Promo Inactiva Inicial',
          startDate: ISO_START,
          endDate: ISO_END,
          active: false,
        })
        .expect(201)

      expect(res.body.active).toBe(false)
    })

    it('lista promociones con filtros', async () => {
      const res = await http()
        .get('/v1/catalog/promotions')
        .query({ type: 'PERCENTAGE', activeOnly: true })
        .set(...auth(superToken))
        .expect(200)

      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data[0].id).toBe(createdId)
    })
  })

  describe('Validaciones de reglas de negocio (assertPromotionRules)', () => {
    it('rechaza PERCENTAGE con discountValue mayor a 100', async () => {
      const res = await http()
        .post('/v1/catalog/promotions')
        .set(...auth(superToken))
        .send({
          name: 'Promo Invalida %',
          startDate: ISO_START,
          endDate: ISO_END,
          type: 'PERCENTAGE',
          discountValue: 150,
          scope: 'ORDER',
        })
        .expect(400)

      expect(res.body.code).toBe(ERROR_CODES.invalidPromotionRules)
    })

    it('rechaza FIXED_AMOUNT con discountValue <= 0', async () => {
      const res = await http()
        .post('/v1/catalog/promotions')
        .set(...auth(superToken))
        .send({
          name: 'Promo Fija 0',
          startDate: ISO_START,
          endDate: ISO_END,
          type: 'FIXED_AMOUNT',
          discountValue: 0,
          scope: 'ORDER',
        })
        .expect(400)

      expect(res.body.code).toBe(ERROR_CODES.invalidPromotionRules)
    })

    it('rechaza BUY_X_GET_Y con buyQuantity <= payQuantity', async () => {
      const res = await http()
        .post('/v1/catalog/promotions')
        .set(...auth(superToken))
        .send({
          name: 'Promo NxM Invalida',
          startDate: ISO_START,
          endDate: ISO_END,
          type: 'BUY_X_GET_Y',
          buyQuantity: 2,
          payQuantity: 2,
          scope: 'PRODUCT',
          productIds: [productId],
        })
        .expect(400)

      expect(res.body.code).toBe(ERROR_CODES.invalidPromotionRules)
    })

    it('rechaza fechas invertidas (startDate >= endDate)', async () => {
      const res = await http()
        .post('/v1/catalog/promotions')
        .set(...auth(superToken))
        .send({
          name: 'Fechas invertidas',
          startDate: '2026-12-31T00:00:00.000Z',
          endDate: '2026-01-01T00:00:00.000Z',
          type: 'FIXED_AMOUNT',
          discountValue: 500,
          scope: 'ORDER',
        })
        .expect(400)

      expect([ERROR_CODES.invalidPromotionRules, ERROR_CODES.validationError]).toContain(
        res.body.code,
      )
    })

    it('rechaza cupón duplicado con código 409', async () => {
      await http()
        .post('/v1/catalog/promotions')
        .set(...auth(superToken))
        .send({
          name: 'Cupón Original',
          startDate: ISO_START,
          endDate: ISO_END,
          type: 'FIXED_AMOUNT',
          discountValue: 1000,
          scope: 'ORDER',
          code: 'CLONE1000',
        })
        .expect(201)

      const res = await http()
        .post('/v1/catalog/promotions')
        .set(...auth(superToken))
        .send({
          name: 'Cupón Duplicado',
          startDate: ISO_START,
          endDate: ISO_END,
          type: 'FIXED_AMOUNT',
          discountValue: 1000,
          scope: 'ORDER',
          code: 'clone1000', // Debería normalizarse a CLONE1000 y fallar por duplicado
        })
        .expect(409)

      expect(res.body.code).toBe(ERROR_CODES.promotionCodeAlreadyExists)
    })

    it('rechaza categoría inexistente con PROMOTION_REFERENCE_NOT_FOUND', async () => {
      const res = await http()
        .post('/v1/catalog/promotions')
        .set(...auth(superToken))
        .send({
          name: 'Cat Inexistente',
          startDate: ISO_START,
          endDate: ISO_END,
          type: 'PERCENTAGE',
          discountValue: 10,
          scope: 'CATEGORY',
          categoryIds: ['000000000000000000000000'],
        })
        .expect(400)

      expect(res.body.code).toBe(ERROR_CODES.promotionReferenceNotFound)
    })
  })

  describe('Endpoint público de promociones banner (GET /v1/catalog/promotions/public)', () => {
    it('devuelve promociones activas y vigentes sin autenticación y sin datos sensibles', async () => {
      // Crear promo pública activa
      const promoRes = await http()
        .post('/v1/catalog/promotions')
        .set(...auth(superToken))
        .send({
          name: 'Promo Banner Pública',
          description: 'Banner público',
          startDate: '2020-01-01T00:00:00.000Z',
          endDate: '2030-12-31T23:59:59.999Z',
          type: 'PERCENTAGE',
          discountValue: 20,
          scope: 'ORDER',
          code: 'SENSITIVE_CODE',
          maxUsesTotal: 10,
        })
        .expect(201)

      await http()
        .patch(`/v1/catalog/promotions/${promoRes.body.id}/active`)
        .set(...auth(superToken))
        .send({ active: true })
        .expect(200)

      const res = await http().get('/v1/catalog/promotions/public').expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      const found = res.body.find((p: { id: string }) => p.id === promoRes.body.id)
      expect(found).toBeDefined()
      expect(found.name).toBe('Promo Banner Pública')
      expect(found.discountValue).toBe(20)
      // Verificar que NO contiene code ni maxUsesTotal
      expect(found.code).toBeUndefined()
      expect(found.maxUsesTotal).toBeUndefined()
      expect(found.maxUsesPerCustomer).toBeUndefined()
    })
  })
})
