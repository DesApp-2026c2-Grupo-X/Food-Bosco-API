import { INestApplication, ValidationPipe } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import { createMongoServer } from './mongo'
import type { App } from 'supertest/types'
import { CategoryModule } from '../src/category/category.module'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { IngredientModule } from '../src/ingredient/ingredient.module'
import { ProductModule } from '../src/product/product.module'
import { PromotionModule } from '../src/promotion/promotion.module'

const MISSING_ID = '000000000000000000000000'

const superToken = jwt.sign({ userId: 'admin-1', roles: ['super_admin'] }, env.jwtSecret)
const customerToken = jwt.sign({ userId: 'cust-1', roles: ['customer'] }, env.jwtSecret)

const ISO_START = '2026-01-01T00:00:00.000Z'
const ISO_END = '2026-12-31T00:00:00.000Z'

describe('Commerce — taxonomía del catálogo (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>

  let activeCategoryId = ''
  let ingredientId = ''
  let inactiveIngredientId = ''
  let promotionId = ''

  const auth = (token: string): [string, string] => ['Authorization', `Bearer ${token}`]
  const http = () => request(app.getHttpServer())

  beforeAll(async () => {
    mongod = await createMongoServer()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        SecurityModule,
        CategoryModule,
        ProductModule,
        IngredientModule,
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
    await app.listen(0)

    const activeCategory = await http()
      .post('/v1/catalog/categories')
      .set(...auth(superToken))
      .send({ name: 'Bebidas' })
      .expect(201)
    activeCategoryId = activeCategory.body.id as string

    await http()
      .post('/v1/catalog/categories')
      .set(...auth(superToken))
      .send({ name: 'Postres', active: false })
      .expect(201)

    const ingredient = await http()
      .post('/v1/catalog/ingredients')
      .set(...auth(superToken))
      .send({ name: 'Queso', unit: 'un' })
      .expect(201)
    ingredientId = ingredient.body.id as string

    const inactiveIngredient = await http()
      .post('/v1/catalog/ingredients')
      .set(...auth(superToken))
      .send({ name: 'Sal', unit: 'g', active: false })
      .expect(201)
    inactiveIngredientId = inactiveIngredient.body.id as string

    const product = await http()
      .post('/v1/catalog/products')
      .set(...auth(superToken))
      .send({
        categoryId: activeCategoryId,
        name: 'Hamburguesa',
        description: 'Clásica',
        price: 100,
      })
      .expect(201)

    await http()
      .put(`/v1/catalog/products/${product.body.id}/recipe`)
      .set(...auth(superToken))
      .send({ items: [{ ingredientId, quantity: 1 }] })
      .expect(200)

    const promotion = await http()
      .post('/v1/catalog/promotions')
      .set(...auth(superToken))
      .send({ name: 'Dos por uno', description: 'Promo', startDate: ISO_START, endDate: ISO_END })
      .expect(201)
    promotionId = promotion.body.id as string
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('categorías (RQ-CAT-01/02/14)', () => {
    it('GET muestra activas por defecto y todas para super_admin', async () => {
      const publicRes = await http().get('/v1/catalog/categories').expect(200)
      const publicNames = (publicRes.body.data as Array<{ name: string }>).map((row) => row.name)
      expect(publicNames).toContain('Bebidas')
      expect(publicNames).not.toContain('Postres')

      const adminRes = await http()
        .get('/v1/catalog/categories')
        .set(...auth(superToken))
        .expect(200)
      const adminNames = (adminRes.body.data as Array<{ name: string }>).map((row) => row.name)
      expect(adminNames).toContain('Bebidas')
      expect(adminNames).toContain('Postres')
    })

    // INT-03: `enableImplicitConversion` no debe forzar `activeOnly=false` a true.
    it('GET ?activeOnly=false incluye las categorías inactivas', async () => {
      const res = await http()
        .get('/v1/catalog/categories?activeOnly=false')
        .set(...auth(superToken))
        .expect(200)
      const names = (res.body.data as Array<{ name: string }>).map((row) => row.name)

      expect(names).toContain('Bebidas')
      expect(names).toContain('Postres')
    })

    it('GET /:id devuelve la categoría y 404 si no existe', async () => {
      const found = await http().get(`/v1/catalog/categories/${activeCategoryId}`).expect(200)
      expect(found.body).toMatchObject({ id: activeCategoryId, name: 'Bebidas' })

      const missing = await http().get(`/v1/catalog/categories/${MISSING_ID}`).expect(404)
      expect(missing.body.code).toBe('CATEGORY_NOT_FOUND')
    })

    // INT-02: un id que no es ObjectId no debe filtrar un 500.
    it('GET /:id con id no-ObjectId → 404', async () => {
      const res = await http().get('/v1/catalog/categories/not-an-object-id').expect(404)
      expect(res.body.code).toBe('NOT_FOUND')
    })

    it('POST duplicado → 409', async () => {
      const res = await http()
        .post('/v1/catalog/categories')
        .set(...auth(superToken))
        .send({ name: 'Bebidas' })
        .expect(409)
      expect(res.body.code).toBe('CATEGORY_ALREADY_EXISTS')
    })

    it('PATCH /:id actualiza y 404 si no existe', async () => {
      const updated = await http()
        .patch(`/v1/catalog/categories/${activeCategoryId}`)
        .set(...auth(superToken))
        .send({ name: 'Bebidas frías' })
        .expect(200)
      expect(updated.body).toMatchObject({ id: activeCategoryId, name: 'Bebidas frías' })

      const missing = await http()
        .patch(`/v1/catalog/categories/${MISSING_ID}`)
        .set(...auth(superToken))
        .send({ name: 'X' })
        .expect(404)
      expect(missing.body.code).toBe('CATEGORY_NOT_FOUND')
    })

    it('PATCH /:id/active activa/desactiva y 404 si no existe', async () => {
      const deactivated = await http()
        .patch(`/v1/catalog/categories/${activeCategoryId}/active`)
        .set(...auth(superToken))
        .send({ active: false })
        .expect(200)
      expect(deactivated.body.active).toBe(false)

      const activated = await http()
        .patch(`/v1/catalog/categories/${activeCategoryId}/active`)
        .set(...auth(superToken))
        .send({ active: true })
        .expect(200)
      expect(activated.body.active).toBe(true)

      const missing = await http()
        .patch(`/v1/catalog/categories/${MISSING_ID}/active`)
        .set(...auth(superToken))
        .send({ active: true })
        .expect(404)
      expect(missing.body.code).toBe('CATEGORY_NOT_FOUND')
    })
  })

  describe('ingredientes (RQ-CAT-09/10/14)', () => {
    it('GET lista protegida: no-admin → 403', async () => {
      const res = await http()
        .get('/v1/catalog/ingredients')
        .set(...auth(customerToken))
        .expect(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })

    it('GET aplica los filtros activeOnly y search', async () => {
      const all = await http()
        .get('/v1/catalog/ingredients')
        .set(...auth(superToken))
        .expect(200)
      const allNames = (all.body.data as Array<{ name: string }>).map((row) => row.name)
      expect(allNames).toContain('Queso')
      expect(allNames).toContain('Sal')

      const active = await http()
        .get('/v1/catalog/ingredients?activeOnly=true')
        .set(...auth(superToken))
        .expect(200)
      const activeNames = (active.body.data as Array<{ name: string }>).map((row) => row.name)
      expect(activeNames).toContain('Queso')
      expect(activeNames).not.toContain('Sal')

      const searched = await http()
        .get('/v1/catalog/ingredients?search=ques')
        .set(...auth(superToken))
        .expect(200)
      const searchedNames = (searched.body.data as Array<{ name: string }>).map((row) => row.name)
      expect(searchedNames).toEqual(['Queso'])
    })

    // INT-03: `?activeOnly=false` debe incluir los ingredientes inactivos.
    it('GET ?activeOnly=false incluye los ingredientes inactivos', async () => {
      const res = await http()
        .get('/v1/catalog/ingredients?activeOnly=false')
        .set(...auth(superToken))
        .expect(200)
      const names = (res.body.data as Array<{ name: string }>).map((row) => row.name)

      expect(names).toContain('Queso')
      expect(names).toContain('Sal')
    })

    it('GET /:id devuelve el ingrediente y 404 si no existe', async () => {
      const found = await http().get(`/v1/catalog/ingredients/${ingredientId}`).expect(200)
      expect(found.body).toMatchObject({ id: ingredientId, name: 'Queso' })

      const missing = await http().get(`/v1/catalog/ingredients/${MISSING_ID}`).expect(404)
      expect(missing.body.code).toBe('INGREDIENT_NOT_FOUND')
    })

    it('POST duplicado → 409', async () => {
      const res = await http()
        .post('/v1/catalog/ingredients')
        .set(...auth(superToken))
        .send({ name: 'Queso', unit: 'un' })
        .expect(409)
      expect(res.body.code).toBe('INGREDIENT_ALREADY_EXISTS')
    })

    it('PATCH /:id actualiza y 404 si no existe', async () => {
      const updated = await http()
        .patch(`/v1/catalog/ingredients/${ingredientId}`)
        .set(...auth(superToken))
        .send({ unit: 'kg' })
        .expect(200)
      expect(updated.body).toMatchObject({ id: ingredientId, unit: 'kg' })

      const missing = await http()
        .patch(`/v1/catalog/ingredients/${MISSING_ID}`)
        .set(...auth(superToken))
        .send({ unit: 'kg' })
        .expect(404)
      expect(missing.body.code).toBe('INGREDIENT_NOT_FOUND')
    })

    it('PATCH /:id/active false sobre ingrediente en receta activa → 409 INGREDIENT_IN_USE', async () => {
      const res = await http()
        .patch(`/v1/catalog/ingredients/${ingredientId}/active`)
        .set(...auth(superToken))
        .send({ active: false })
        .expect(409)
      expect(res.body.code).toBe('INGREDIENT_IN_USE')

      const stillActive = await http().get(`/v1/catalog/ingredients/${ingredientId}`).expect(200)
      expect(stillActive.body.active).toBe(true)
    })

    it('PATCH /:id/active activa/desactiva y 404 si no existe', async () => {
      const activated = await http()
        .patch(`/v1/catalog/ingredients/${inactiveIngredientId}/active`)
        .set(...auth(superToken))
        .send({ active: true })
        .expect(200)
      expect(activated.body.active).toBe(true)

      const missing = await http()
        .patch(`/v1/catalog/ingredients/${MISSING_ID}/active`)
        .set(...auth(superToken))
        .send({ active: false })
        .expect(404)
      expect(missing.body.code).toBe('INGREDIENT_NOT_FOUND')
    })
  })

  describe('promociones (RQ-CAT-13)', () => {
    it('GET lista y respeta activeOnly', async () => {
      const created = await http()
        .post('/v1/catalog/promotions')
        .set(...auth(superToken))
        .send({ name: 'Verano', startDate: ISO_START, endDate: ISO_END })
        .expect(201)

      await http()
        .patch(`/v1/catalog/promotions/${created.body.id}/active`)
        .set(...auth(superToken))
        .send({ active: false })
        .expect(200)

      const all = await http()
        .get('/v1/catalog/promotions')
        .set(...auth(superToken))
        .expect(200)
      expect((all.body.data as Array<{ id: string }>).map((row) => row.id)).toContain(
        created.body.id as string,
      )

      const active = await http()
        .get('/v1/catalog/promotions?activeOnly=true')
        .set(...auth(superToken))
        .expect(200)
      expect((active.body.data as Array<{ id: string }>).map((row) => row.id)).not.toContain(
        created.body.id as string,
      )

      // INT-03: `?activeOnly=false` debe incluir la promoción inactiva.
      const inactive = await http()
        .get('/v1/catalog/promotions?activeOnly=false')
        .set(...auth(superToken))
        .expect(200)
      expect((inactive.body.data as Array<{ id: string }>).map((row) => row.id)).toContain(
        created.body.id as string,
      )
    })

    it('POST crea y rechaza fechas invertidas → 400', async () => {
      const created = await http()
        .post('/v1/catalog/promotions')
        .set(...auth(superToken))
        .send({
          name: 'Invierno',
          description: 'Frío',
          startDate: ISO_START,
          endDate: ISO_END,
        })
        .expect(201)
      expect(created.body).toMatchObject({ name: 'Invierno', active: true })

      const invalid = await http()
        .post('/v1/catalog/promotions')
        .set(...auth(superToken))
        .send({ name: 'Invertida', startDate: ISO_END, endDate: ISO_START })
        .expect(400)
      expect(invalid.body.code).toBe('VALIDATION_ERROR')
    })

    it('GET /:id devuelve la promoción y 404 si no existe', async () => {
      const found = await http()
        .get(`/v1/catalog/promotions/${promotionId}`)
        .set(...auth(superToken))
        .expect(200)
      expect(found.body).toMatchObject({ id: promotionId, name: 'Dos por uno' })

      const missing = await http()
        .get(`/v1/catalog/promotions/${MISSING_ID}`)
        .set(...auth(superToken))
        .expect(404)
      expect(missing.body.code).toBe('PROMOTION_NOT_FOUND')
    })

    // INT-02: un id que no es ObjectId no debe filtrar un 500.
    it('GET /:id con id no-ObjectId → 404', async () => {
      const res = await http()
        .get('/v1/catalog/promotions/not-an-object-id')
        .set(...auth(superToken))
        .expect(404)
      expect(res.body.code).toBe('NOT_FOUND')
    })

    it('PATCH /:id actualiza, rechaza fechas invertidas y 404 si no existe', async () => {
      const updated = await http()
        .patch(`/v1/catalog/promotions/${promotionId}`)
        .set(...auth(superToken))
        .send({ name: 'Dos por uno extendida' })
        .expect(200)
      expect(updated.body.name).toBe('Dos por uno extendida')

      const invalid = await http()
        .patch(`/v1/catalog/promotions/${promotionId}`)
        .set(...auth(superToken))
        .send({ startDate: ISO_END, endDate: ISO_START })
        .expect(400)
      expect(invalid.body.code).toBe('VALIDATION_ERROR')

      const missing = await http()
        .patch(`/v1/catalog/promotions/${MISSING_ID}`)
        .set(...auth(superToken))
        .send({ name: 'X' })
        .expect(404)
      expect(missing.body.code).toBe('PROMOTION_NOT_FOUND')
    })

    it('PATCH /:id/active activa/desactiva y 404 si no existe', async () => {
      const deactivated = await http()
        .patch(`/v1/catalog/promotions/${promotionId}/active`)
        .set(...auth(superToken))
        .send({ active: false })
        .expect(200)
      expect(deactivated.body.active).toBe(false)

      const activated = await http()
        .patch(`/v1/catalog/promotions/${promotionId}/active`)
        .set(...auth(superToken))
        .send({ active: true })
        .expect(200)
      expect(activated.body.active).toBe(true)

      const missing = await http()
        .patch(`/v1/catalog/promotions/${MISSING_ID}/active`)
        .set(...auth(superToken))
        .send({ active: true })
        .expect(404)
      expect(missing.body.code).toBe('PROMOTION_NOT_FOUND')
    })

    // INT-03: un `active` no booleano no debe coaccionarse a `true`; el PATCH debe dar 400.
    it.each([
      { name: 'string "false"', active: 'false' },
      { name: 'string "true"', active: 'true' },
      { name: 'numérico 123', active: 123 },
    ])('PATCH /:id/active rechaza active $name → 400', async ({ active }) => {
      const res = await http()
        .patch(`/v1/catalog/promotions/${promotionId}/active`)
        .set(...auth(superToken))
        .send({ active })
        .expect(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })
})
