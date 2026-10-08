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

const MISSING_ID = '000000000000000000000000'

const superToken = jwt.sign({ userId: 'admin-1', roles: ['super_admin'] }, env.jwtSecret)
const customerToken = jwt.sign({ userId: 'cust-1', roles: ['customer'] }, env.jwtSecret)

describe('Commerce — catálogo de productos (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>

  let categoryId = ''
  let ingredientId = ''
  let ingredient2Id = ''
  let productId = ''
  let recipeProductId = ''
  let groupId = ''
  let optionId = ''
  let groupWithOptionsId = ''

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

    const category = await http()
      .post('/v1/catalog/categories')
      .set(...auth(superToken))
      .send({ name: 'Hamburguesas' })
      .expect(201)
    categoryId = category.body.id as string

    const ingredient = await http()
      .post('/v1/catalog/ingredients')
      .set(...auth(superToken))
      .send({ name: 'Medallón', unit: 'un' })
      .expect(201)
    ingredientId = ingredient.body.id as string

    const ingredient2 = await http()
      .post('/v1/catalog/ingredients')
      .set(...auth(superToken))
      .send({ name: 'Queso', unit: 'un' })
      .expect(201)
    ingredient2Id = ingredient2.body.id as string

    const product = await http()
      .post('/v1/catalog/products')
      .set(...auth(superToken))
      .send({ categoryId, name: 'Hamburguesa', description: 'Clásica', price: 100 })
      .expect(201)
    productId = product.body.id as string

    const recipeProduct = await http()
      .post('/v1/catalog/products')
      .set(...auth(superToken))
      .send({ categoryId, name: 'Milanesa', description: 'Con papas', price: 120 })
      .expect(201)
    recipeProductId = recipeProduct.body.id as string

    await http()
      .put(`/v1/catalog/products/${recipeProductId}/recipe`)
      .set(...auth(superToken))
      .send({ items: [{ ingredientId, quantity: 2 }] })
      .expect(200)

    const group = await http()
      .post(`/v1/catalog/products/${productId}/configurations`)
      .set(...auth(superToken))
      .send({ name: 'Tamaño', type: 'single', required: true, min: 1, max: 1 })
      .expect(201)
    groupId = group.body.id as string

    const option = await http()
      .post(`/v1/catalog/products/${productId}/configurations/${groupId}/options`)
      .set(...auth(superToken))
      .send({ name: 'Extra queso', extraPrice: 50 })
      .expect(201)
    optionId = option.body.id as string

    const groupWithOptions = await http()
      .post(`/v1/catalog/products/${productId}/configurations`)
      .set(...auth(superToken))
      .send({ name: 'Salsas', type: 'multiple', required: false })
      .expect(201)
    groupWithOptionsId = groupWithOptions.body.id as string

    await http()
      .post(`/v1/catalog/products/${productId}/configurations/${groupWithOptionsId}/options`)
      .set(...auth(superToken))
      .send({ name: 'Ketchup', extraPrice: 0 })
      .expect(201)
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('producto (RQ-CAT-03/14)', () => {
    it('GET /:productId devuelve el producto', async () => {
      const res = await http().get(`/v1/catalog/products/${productId}`).expect(200)
      expect(res.body).toMatchObject({
        id: productId,
        name: 'Hamburguesa',
        price: 100,
        available: true,
      })
    })

    it('GET /:productId inexistente → 404 PRODUCT_NOT_FOUND', async () => {
      const res = await http().get(`/v1/catalog/products/${MISSING_ID}`).expect(404)
      expect(res.body.code).toBe('PRODUCT_NOT_FOUND')
    })

    // INT-02: un id que no es ObjectId no debe filtrar un 500.
    it('GET /:productId con id no-ObjectId → 404', async () => {
      const res = await http().get('/v1/catalog/products/not-an-object-id').expect(404)
      expect(res.body.code).toBe('NOT_FOUND')
    })

    it('PATCH /:productId actualiza el producto', async () => {
      const res = await http()
        .patch(`/v1/catalog/products/${productId}`)
        .set(...auth(superToken))
        .send({ name: 'Hamburguesa doble', price: 150, description: 'Doble carne' })
        .expect(200)

      expect(res.body).toMatchObject({
        id: productId,
        name: 'Hamburguesa doble',
        price: 150,
        description: 'Doble carne',
      })
    })

    it('PATCH /:productId inexistente → 404', async () => {
      const res = await http()
        .patch(`/v1/catalog/products/${MISSING_ID}`)
        .set(...auth(superToken))
        .send({ price: 1 })
        .expect(404)
      expect(res.body.code).toBe('PRODUCT_NOT_FOUND')
    })

    it('PATCH /:productId sin rol admin → 403', async () => {
      const res = await http()
        .patch(`/v1/catalog/products/${productId}`)
        .set(...auth(customerToken))
        .send({ price: 1 })
        .expect(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })

    it('PATCH /:productId/available pausa y reactiva el producto', async () => {
      const paused = await http()
        .patch(`/v1/catalog/products/${productId}/available`)
        .set(...auth(superToken))
        .send({ available: false })
        .expect(200)
      expect(paused.body.available).toBe(false)

      const reactivated = await http()
        .patch(`/v1/catalog/products/${productId}/available`)
        .set(...auth(superToken))
        .send({ available: true })
        .expect(200)
      expect(reactivated.body.available).toBe(true)
    })

    it('PATCH /:productId/available inexistente → 404', async () => {
      const res = await http()
        .patch(`/v1/catalog/products/${MISSING_ID}/available`)
        .set(...auth(superToken))
        .send({ available: true })
        .expect(404)
      expect(res.body.code).toBe('PRODUCT_NOT_FOUND')
    })

    it('PATCH /:productId/available sin rol admin → 403', async () => {
      const res = await http()
        .patch(`/v1/catalog/products/${productId}/available`)
        .set(...auth(customerToken))
        .send({ available: true })
        .expect(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })
  })

  describe('grupos de configuración (RQ-CAT-06/07)', () => {
    it('GET /:productId/configurations lista los grupos del producto', async () => {
      const res = await http()
        .get(`/v1/catalog/products/${productId}/configurations`)
        .set(...auth(superToken))
        .expect(200)

      const ids = (res.body as Array<{ id: string }>).map((group) => group.id)
      expect(ids).toContain(groupId)
      expect(ids).toContain(groupWithOptionsId)
    })

    it('GET /:productId/configurations de producto inexistente → 404', async () => {
      const res = await http()
        .get(`/v1/catalog/products/${MISSING_ID}/configurations`)
        .set(...auth(superToken))
        .expect(404)
      expect(res.body.code).toBe('PRODUCT_NOT_FOUND')
    })

    it('PATCH /:productId/configurations/:groupId actualiza el grupo', async () => {
      const res = await http()
        .patch(`/v1/catalog/products/${productId}/configurations/${groupId}`)
        .set(...auth(superToken))
        .send({ name: 'Tamaño único', type: 'multiple', required: false })
        .expect(200)

      expect(res.body).toMatchObject({
        id: groupId,
        name: 'Tamaño único',
        type: 'multiple',
        required: false,
      })
    })

    it('PATCH /:productId/configurations/:groupId incoherente → 400', async () => {
      const res = await http()
        .patch(`/v1/catalog/products/${productId}/configurations/${groupId}`)
        .set(...auth(superToken))
        .send({ min: 5 })
        .expect(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('PATCH/DELETE /:productId/configurations/:groupId inexistente → 404 CONFIG_GROUP_NOT_FOUND', async () => {
      const updated = await http()
        .patch(`/v1/catalog/products/${productId}/configurations/${MISSING_ID}`)
        .set(...auth(superToken))
        .send({ name: 'X' })
        .expect(404)
      expect(updated.body.code).toBe('CONFIG_GROUP_NOT_FOUND')

      const removed = await http()
        .delete(`/v1/catalog/products/${productId}/configurations/${MISSING_ID}`)
        .set(...auth(superToken))
        .expect(404)
      expect(removed.body.code).toBe('CONFIG_GROUP_NOT_FOUND')
    })

    it.each([
      { name: 'type inválido', body: { name: 'X', type: 'invalid', required: false } },
      { name: 'required ausente', body: { name: 'X', type: 'single' } },
      { name: 'required true sin min', body: { name: 'X', type: 'single', required: true } },
      {
        name: 'min negativo',
        body: { name: 'X', type: 'multiple', required: false, min: -1, max: 2 },
      },
      {
        name: 'min mayor que max',
        body: { name: 'X', type: 'multiple', required: false, min: 5, max: 2 },
      },
    ])('POST grupo con $name → 400', async ({ body }) => {
      const res = await http()
        .post(`/v1/catalog/products/${productId}/configurations`)
        .set(...auth(superToken))
        .send(body)
        .expect(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('DELETE /:productId/configurations/:groupId borra el grupo con sus opciones', async () => {
      await http()
        .delete(`/v1/catalog/products/${productId}/configurations/${groupWithOptionsId}`)
        .set(...auth(superToken))
        .expect(200)
        .expect({ ok: true })

      const res = await http()
        .get(`/v1/catalog/products/${productId}/configurations`)
        .set(...auth(superToken))
        .expect(200)

      const ids = (res.body as Array<{ id: string }>).map((group) => group.id)
      expect(ids).not.toContain(groupWithOptionsId)
    })
  })

  describe('opciones de configuración (RQ-CAT-08)', () => {
    it('POST/PATCH/DELETE de una opción', async () => {
      const created = await http()
        .post(`/v1/catalog/products/${productId}/configurations/${groupId}/options`)
        .set(...auth(superToken))
        .send({ name: 'Sin cebolla', extraPrice: 0 })
        .expect(201)
      const createdOptionId = created.body.id as string
      expect(created.body).toMatchObject({ name: 'Sin cebolla', extraPrice: 0, available: true })

      const updated = await http()
        .patch(
          `/v1/catalog/products/${productId}/configurations/${groupId}/options/${createdOptionId}`,
        )
        .set(...auth(superToken))
        .send({ name: 'Con cebolla', extraPrice: 10 })
        .expect(200)
      expect(updated.body).toMatchObject({ name: 'Con cebolla', extraPrice: 10 })

      await http()
        .delete(
          `/v1/catalog/products/${productId}/configurations/${groupId}/options/${createdOptionId}`,
        )
        .set(...auth(superToken))
        .expect(200)
        .expect({ ok: true })

      const res = await http()
        .get(`/v1/catalog/products/${productId}/configurations`)
        .set(...auth(superToken))
        .expect(200)
      const group = (res.body as Array<{ id: string; options: Array<{ id: string }> }>).find(
        (entry) => entry.id === groupId,
      )
      expect(group?.options.map((option) => option.id)).not.toContain(createdOptionId)
    })

    it('POST opción en grupo inexistente → 404 CONFIG_GROUP_NOT_FOUND', async () => {
      const res = await http()
        .post(`/v1/catalog/products/${productId}/configurations/${MISSING_ID}/options`)
        .set(...auth(superToken))
        .send({ name: 'X', extraPrice: 1 })
        .expect(404)
      expect(res.body.code).toBe('CONFIG_GROUP_NOT_FOUND')
    })

    it('PATCH/DELETE opción inexistente → 404 CONFIG_OPTION_NOT_FOUND', async () => {
      const updated = await http()
        .patch(`/v1/catalog/products/${productId}/configurations/${groupId}/options/${MISSING_ID}`)
        .set(...auth(superToken))
        .send({ name: 'X' })
        .expect(404)
      expect(updated.body.code).toBe('CONFIG_OPTION_NOT_FOUND')

      const removed = await http()
        .delete(`/v1/catalog/products/${productId}/configurations/${groupId}/options/${MISSING_ID}`)
        .set(...auth(superToken))
        .expect(404)
      expect(removed.body.code).toBe('CONFIG_OPTION_NOT_FOUND')
    })

    // NEW-19: si falta el grupo, el error debe ser CONFIG_GROUP_NOT_FOUND (no OPTION).
    it('PATCH/DELETE opción con grupo inexistente → 404 CONFIG_GROUP_NOT_FOUND', async () => {
      const updated = await http()
        .patch(`/v1/catalog/products/${productId}/configurations/${MISSING_ID}/options/${optionId}`)
        .set(...auth(superToken))
        .send({ name: 'X' })
        .expect(404)
      expect(updated.body.code).toBe('CONFIG_GROUP_NOT_FOUND')

      const removed = await http()
        .delete(
          `/v1/catalog/products/${productId}/configurations/${MISSING_ID}/options/${optionId}`,
        )
        .set(...auth(superToken))
        .expect(404)
      expect(removed.body.code).toBe('CONFIG_GROUP_NOT_FOUND')
    })

    it('extraPrice negativo → 400 al crear y actualizar', async () => {
      const created = await http()
        .post(`/v1/catalog/products/${productId}/configurations/${groupId}/options`)
        .set(...auth(superToken))
        .send({ name: 'Negativa', extraPrice: -1 })
        .expect(400)
      expect(created.body.code).toBe('VALIDATION_ERROR')

      const updated = await http()
        .patch(`/v1/catalog/products/${productId}/configurations/${groupId}/options/${optionId}`)
        .set(...auth(superToken))
        .send({ extraPrice: -5 })
        .expect(400)
      expect(updated.body.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('receta (RQ-CAT-11/12)', () => {
    it('GET /:productId/recipe devuelve los ítems y 404 producto inexistente', async () => {
      const res = await http()
        .get(`/v1/catalog/products/${recipeProductId}/recipe`)
        .set(...auth(superToken))
        .expect(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].ingredientId).toBe(ingredientId)

      const missing = await http()
        .get(`/v1/catalog/products/${MISSING_ID}/recipe`)
        .set(...auth(superToken))
        .expect(404)
      expect(missing.body.code).toBe('PRODUCT_NOT_FOUND')
    })

    it('PUT /:productId/recipe reemplaza la receta completa', async () => {
      const res = await http()
        .put(`/v1/catalog/products/${recipeProductId}/recipe`)
        .set(...auth(superToken))
        .send({
          items: [
            { ingredientId, quantity: 1 },
            { ingredientId: ingredient2Id, quantity: 2 },
          ],
        })
        .expect(200)

      expect(res.body.recipe).toHaveLength(2)
      expect(res.body.recipe[0]).toMatchObject({ ingredientId, quantity: 1 })
    })

    it('PUT /:productId/recipe con ingrediente inexistente → 404 INGREDIENT_NOT_FOUND', async () => {
      const res = await http()
        .put(`/v1/catalog/products/${recipeProductId}/recipe`)
        .set(...auth(superToken))
        .send({ items: [{ ingredientId: MISSING_ID, quantity: 1 }] })
        .expect(404)
      expect(res.body.code).toBe('INGREDIENT_NOT_FOUND')
    })

    it('POST fusiona ingredientes repetidos y PATCH/DELETE operan sobre el ítem', async () => {
      const added = await http()
        .post(`/v1/catalog/products/${recipeProductId}/recipe/items`)
        .set(...auth(superToken))
        .send({ ingredientId, quantity: 5 })
        .expect(201)

      const recipe = added.body.recipe as Array<{
        id: string
        ingredientId: string
        quantity: number
      }>
      const mergedItems = recipe.filter((item) => item.ingredientId === ingredientId)
      expect(mergedItems).toHaveLength(1)
      expect(mergedItems[0].quantity).toBe(6)
      const itemId = mergedItems[0].id

      // RQ-CAT-11: reasignar a un ingrediente ya presente no reintroduce duplicados;
      // se fusionan las cantidades (2 del ítem previo + 7 del patch) en el ítem editado.
      const updated = await http()
        .patch(`/v1/catalog/products/${recipeProductId}/recipe/items/${itemId}`)
        .set(...auth(superToken))
        .send({ ingredientId: ingredient2Id, quantity: 7 })
        .expect(200)
      const updatedRecipe = updated.body.recipe as Array<{
        id: string
        ingredientId: string
        quantity: number
      }>
      const ingredient2Items = updatedRecipe.filter((item) => item.ingredientId === ingredient2Id)
      expect(ingredient2Items).toHaveLength(1)
      expect(ingredient2Items[0]).toMatchObject({ id: itemId, quantity: 9 })

      const removed = await http()
        .delete(`/v1/catalog/products/${recipeProductId}/recipe/items/${itemId}`)
        .set(...auth(superToken))
        .expect(200)
      expect(
        (removed.body.recipe as Array<{ id: string }>).some((item) => item.id === itemId),
      ).toBe(false)
    })

    it('PATCH/DELETE ítem de receta inexistente → 404 RECIPE_ITEM_NOT_FOUND', async () => {
      const updated = await http()
        .patch(`/v1/catalog/products/${recipeProductId}/recipe/items/${MISSING_ID}`)
        .set(...auth(superToken))
        .send({ ingredientId, quantity: 1 })
        .expect(404)
      expect(updated.body.code).toBe('RECIPE_ITEM_NOT_FOUND')

      const removed = await http()
        .delete(`/v1/catalog/products/${recipeProductId}/recipe/items/${MISSING_ID}`)
        .set(...auth(superToken))
        .expect(404)
      expect(removed.body.code).toBe('RECIPE_ITEM_NOT_FOUND')
    })

    it.each([
      {
        name: 'PUT',
        run: () =>
          http()
            .put(`/v1/catalog/products/${recipeProductId}/recipe`)
            .set(...auth(superToken))
            .send({ items: [{ ingredientId, quantity: 0 }] }),
      },
      {
        name: 'POST item',
        run: () =>
          http()
            .post(`/v1/catalog/products/${recipeProductId}/recipe/items`)
            .set(...auth(superToken))
            .send({ ingredientId, quantity: -1 }),
      },
      {
        name: 'PATCH item',
        run: () =>
          http()
            .patch(`/v1/catalog/products/${recipeProductId}/recipe/items/${MISSING_ID}`)
            .set(...auth(superToken))
            .send({ ingredientId, quantity: 0 }),
      },
    ])('cantidad ≤ 0 en $name → 400', async ({ run }) => {
      const res = await run().expect(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it.each([
      {
        name: 'PUT',
        run: () =>
          http()
            .put(`/v1/catalog/products/${recipeProductId}/recipe`)
            .set(...auth(superToken))
            .send({
              items: [
                {
                  ingredientId,
                  quantity: 1,
                  optionAdjustments: [{ optionId: MISSING_ID, quantity: 1 }],
                },
              ],
            }),
      },
      {
        name: 'POST item',
        run: () =>
          http()
            .post(`/v1/catalog/products/${recipeProductId}/recipe/items`)
            .set(...auth(superToken))
            .send({
              ingredientId,
              quantity: 1,
              optionAdjustments: [{ optionId: MISSING_ID, quantity: 1 }],
            }),
      },
    ])('$name con optionAdjustments de opción inexistente → 404', async ({ run }) => {
      const res = await run().expect(404)
      expect(res.body.code).toBe('OPTION_NOT_FOUND')
    })
  })
})
