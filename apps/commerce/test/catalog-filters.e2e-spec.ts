import { INestApplication, ValidationPipe } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import { createMongoServer } from './mongo'
import type { App } from 'supertest/types'
import { BranchModule } from '../src/branch/branch.module'
import { CategoryModule } from '../src/category/category.module'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { IngredientModule } from '../src/ingredient/ingredient.module'
import { ParameterModule } from '../src/parameter/parameter.module'
import { ProductModule } from '../src/product/product.module'
import { PromotionModule } from '../src/promotion/promotion.module'

const superToken = jwt.sign({ userId: 'admin-1', roles: ['super_admin'] }, env.jwtSecret)

const ISO_START = '2026-01-01T00:00:00.000Z'
const ISO_END = '2026-12-31T00:00:00.000Z'

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

interface ProductListBody {
  data: Array<{ id: string; name: string; categoryId: string; available: boolean }>
  meta: { total: number; limit: number; offset: number }
}

interface NamedListBody {
  data: Array<{ id: string; name: string }>
  meta: { total: number; limit: number; offset: number }
}

describe('Commerce — filtros y paginación de listados (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>

  let categoryBebidasId = ''
  let categoryPostresId = ''

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
        BranchModule,
        ParameterModule,
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

    const bebidas = await http()
      .post('/v1/catalog/categories')
      .set(...auth(superToken))
      .send({ name: 'Bebidas' })
      .expect(201)
    categoryBebidasId = bebidas.body.id as string

    const postres = await http()
      .post('/v1/catalog/categories')
      .set(...auth(superToken))
      .send({ name: 'Postres' })
      .expect(201)
    categoryPostresId = postres.body.id as string

    await http()
      .post('/v1/catalog/categories')
      .set(...auth(superToken))
      .send({ name: 'Bebidas Frías' })
      .expect(201)

    await http()
      .post('/v1/catalog/categories')
      .set(...auth(superToken))
      .send({ name: 'Postres Inactivos', active: false })
      .expect(201)

    const createProduct = (name: string, categoryId: string): Promise<{ body: { id: string } }> =>
      http()
        .post('/v1/catalog/products')
        .set(...auth(superToken))
        .send({ categoryId, name, description: 'Rica', price: 100 })
        .expect(201)

    await createProduct('Ensalada', categoryPostresId)
    await createProduct('Hamburguesa Clásica', categoryBebidasId)
    await createProduct('Hamburguesa Doble', categoryBebidasId)

    const pausada = await createProduct('Hamburguesa Pausada', categoryBebidasId)
    await http()
      .patch(`/v1/catalog/products/${pausada.body.id}/available`)
      .set(...auth(superToken))
      .send({ available: false })
      .expect(200)

    for (const name of ['Queso', 'Sal', 'Tomate']) {
      await http()
        .post('/v1/catalog/ingredients')
        .set(...auth(superToken))
        .send({ name, unit: 'un' })
        .expect(201)
    }

    for (const name of ['Promo A', 'Promo B', 'Promo C']) {
      await http()
        .post('/v1/catalog/promotions')
        .set(...auth(superToken))
        .send({ name, startDate: ISO_START, endDate: ISO_END })
        .expect(201)
      await sleep(5)
    }

    for (const name of ['Sucursal A', 'Sucursal B', 'Sucursal C']) {
      await http()
        .post('/v1/branches')
        .set(...auth(superToken))
        .send({ name, addressText: `${name} 123`, latitude: 0, longitude: 0 })
        .expect(201)
    }
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('GET /v1/catalog/products — filtros', () => {
    it('el público excluye los no disponibles y el super_admin los incluye', async () => {
      const publicRes = await http().get('/v1/catalog/products').expect(200)
      const publicNames = (publicRes.body as ProductListBody).data.map((row) => row.name)

      expect(publicNames).toContain('Ensalada')
      expect(publicNames).toContain('Hamburguesa Clásica')
      expect(publicNames).not.toContain('Hamburguesa Pausada')

      const adminRes = await http()
        .get('/v1/catalog/products')
        .set(...auth(superToken))
        .expect(200)
      const adminNames = (adminRes.body as ProductListBody).data.map((row) => row.name)
      expect(adminNames).toContain('Hamburguesa Pausada')
    })

    // INT-03: el tipo union del DTO evita que `enableImplicitConversion` coaccione el
    // string 'false' a `true`, por lo que `?available=false` filtra los no disponibles.
    it('?available=false lista sólo los no disponibles', async () => {
      const res = await http().get('/v1/catalog/products?available=false').expect(200)
      const data = (res.body as ProductListBody).data

      expect(data.every((row) => row.available === false)).toBe(true)
      expect(data.map((row) => row.name)).toContain('Hamburguesa Pausada')
    })

    it('?available=true lista sólo los disponibles', async () => {
      const res = await http().get('/v1/catalog/products?available=true').expect(200)
      const data = (res.body as ProductListBody).data

      expect(data.every((row) => row.available === true)).toBe(true)
      expect(data.map((row) => row.name)).not.toContain('Hamburguesa Pausada')
    })

    it('?categoryId filtra por categoría', async () => {
      const res = await http()
        .get(`/v1/catalog/products?categoryId=${categoryPostresId}`)
        .set(...auth(superToken))
        .expect(200)
      const data = (res.body as ProductListBody).data

      expect(data.map((row) => row.name)).toEqual(['Ensalada'])
      expect(data.every((row) => row.categoryId === categoryPostresId)).toBe(true)
    })

    it('?search filtra por nombre sin distinguir mayúsculas', async () => {
      const res = await http()
        .get('/v1/catalog/products?search=hamburguesa')
        .set(...auth(superToken))
        .expect(200)
      const names = (res.body as ProductListBody).data.map((row) => row.name)

      expect(names).toContain('Hamburguesa Clásica')
      expect(names).toContain('Hamburguesa Pausada')
      expect(names).not.toContain('Ensalada')
    })

    it('aplica limit/offset y expone meta de paginación', async () => {
      const page1 = await http()
        .get('/v1/catalog/products?limit=2&offset=0')
        .set(...auth(superToken))
        .expect(200)
      const page2 = await http()
        .get('/v1/catalog/products?limit=2&offset=2')
        .set(...auth(superToken))
        .expect(200)

      const body1 = page1.body as ProductListBody
      const body2 = page2.body as ProductListBody

      expect(body1.meta).toMatchObject({ limit: 2, offset: 0, total: 4 })
      expect(body2.meta).toMatchObject({ limit: 2, offset: 2, total: 4 })
      expect(body1.data).toHaveLength(2)
      expect(body2.data).toHaveLength(2)
      expect(body1.data.map((row) => row.id)).not.toEqual(body2.data.map((row) => row.id))
    })
  })

  describe('GET /v1/catalog/ingredients — paginación', () => {
    it('pagina el listado protegido', async () => {
      const page1 = await http()
        .get('/v1/catalog/ingredients?limit=2&offset=0')
        .set(...auth(superToken))
        .expect(200)
      const page2 = await http()
        .get('/v1/catalog/ingredients?limit=2&offset=2')
        .set(...auth(superToken))
        .expect(200)

      const body1 = page1.body as NamedListBody
      const body2 = page2.body as NamedListBody

      expect(body1.meta).toMatchObject({ limit: 2, offset: 0, total: 3 })
      expect(body1.data).toHaveLength(2)
      expect(body2.data).toHaveLength(1)
      expect(body1.data.map((row) => row.id)).not.toEqual(body2.data.map((row) => row.id))
    })

    // NEW-04: un `activeOnly` inválido se rechaza en vez de coaccionarse a false.
    it('?activeOnly inválido → 400 VALIDATION_ERROR', async () => {
      const res = await http()
        .get('/v1/catalog/ingredients?activeOnly=garbage')
        .set(...auth(superToken))
        .expect(400)
      expect((res.body as { code: string }).code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /v1/catalog/promotions — paginación', () => {
    it('pagina las promociones de super_admin', async () => {
      const page1 = await http()
        .get('/v1/catalog/promotions?limit=2&offset=0')
        .set(...auth(superToken))
        .expect(200)
      const page2 = await http()
        .get('/v1/catalog/promotions?limit=2&offset=2')
        .set(...auth(superToken))
        .expect(200)

      const body1 = page1.body as NamedListBody
      const body2 = page2.body as NamedListBody

      expect(body1.meta).toMatchObject({ limit: 2, offset: 0, total: 3 })
      expect(body1.data).toHaveLength(2)
      expect(body2.data).toHaveLength(1)
      expect(body1.data.map((row) => row.id)).not.toEqual(body2.data.map((row) => row.id))
    })

    // NEW-04: un `activeOnly` inválido se rechaza en vez de coaccionarse a false.
    it('?activeOnly inválido → 400 VALIDATION_ERROR', async () => {
      const res = await http()
        .get('/v1/catalog/promotions?activeOnly=nope')
        .set(...auth(superToken))
        .expect(400)
      expect((res.body as { code: string }).code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /v1/catalog/categories — search y paginación', () => {
    it('?search filtra por nombre', async () => {
      const res = await http().get('/v1/catalog/categories?search=Postres').expect(200)
      const names = (res.body as NamedListBody).data.map((row) => row.name)

      expect(names).toEqual(['Postres'])
    })

    it('pagina el listado con limit/offset', async () => {
      const page1 = await http()
        .get('/v1/catalog/categories?limit=2&offset=0')
        .set(...auth(superToken))
        .expect(200)
      const page2 = await http()
        .get('/v1/catalog/categories?limit=2&offset=2')
        .set(...auth(superToken))
        .expect(200)

      const body1 = page1.body as NamedListBody
      const body2 = page2.body as NamedListBody

      expect(body1.meta).toMatchObject({ limit: 2, offset: 0, total: 4 })
      expect(body1.data).toHaveLength(2)
      expect(body2.data).toHaveLength(2)
      expect(body1.data.map((row) => row.id)).not.toEqual(body2.data.map((row) => row.id))
    })

    // INT-03: `?activeOnly=false` no debe coaccionarse a true; incluye inactivas.
    it('?activeOnly=false incluye la categoría inactiva', async () => {
      const res = await http()
        .get('/v1/catalog/categories?activeOnly=false')
        .set(...auth(superToken))
        .expect(200)
      const names = (res.body as NamedListBody).data.map((row) => row.name)

      expect(names).toContain('Postres Inactivos')
    })

    // NEW-04: un `activeOnly` inválido se rechaza en vez de coaccionarse a false.
    it('?activeOnly inválido → 400 VALIDATION_ERROR', async () => {
      const res = await http()
        .get('/v1/catalog/categories?activeOnly=maybe')
        .set(...auth(superToken))
        .expect(400)
      expect((res.body as { code: string }).code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /v1/branches — limit/offset', () => {
    it('pagina el listado de sucursales', async () => {
      const page1 = await http()
        .get('/v1/branches?limit=2&offset=0')
        .set(...auth(superToken))
        .expect(200)
      const page2 = await http()
        .get('/v1/branches?limit=2&offset=2')
        .set(...auth(superToken))
        .expect(200)

      const body1 = page1.body as NamedListBody
      const body2 = page2.body as NamedListBody

      expect(body1.meta).toMatchObject({ limit: 2, offset: 0, total: 3 })
      expect(body1.data).toHaveLength(2)
      expect(body2.data).toHaveLength(1)
      expect(body1.data.map((row) => row.id)).not.toEqual(body2.data.map((row) => row.id))
    })
  })
})
