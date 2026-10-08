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
import { CategoryModule } from '../src/category/category.module'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { IngredientModule } from '../src/ingredient/ingredient.module'
import { ParameterModule } from '../src/parameter/parameter.module'
import { ProductModule } from '../src/product/product.module'

const DAYS = [0, 1, 2, 3, 4, 5, 6]

interface HourInput {
  dayOfWeek: number
  opening?: string | null
  closing?: string | null
  closed: boolean
}

const openHours: HourInput[] = DAYS.map((dayOfWeek) => ({
  dayOfWeek,
  opening: '00:00',
  closing: '23:59',
  closed: false,
}))

const closedHours: HourInput[] = DAYS.map((dayOfWeek) => ({ dayOfWeek, closed: true }))

const superToken = jwt.sign({ userId: 'admin-1', roles: ['super_admin'] }, env.jwtSecret)

const customerToken = (id = 'cust-1'): string =>
  jwt.sign({ userId: id, roles: ['customer'] }, env.jwtSecret)

const branchAdminTokenFor = (branchId: string | null, userId = 'branch-1'): string =>
  jwt.sign({ userId, roles: ['branch_admin'], branchId }, env.jwtSecret)

interface BranchBody {
  id: string
  name: string
  addressText: string
  phone: string | null
  active: boolean
  hours: Array<{
    dayOfWeek: number
    opening: string | null
    closing: string | null
    closed: boolean
  }>
}

interface ProductBody {
  id: string
  name: string
  availableInBranch: boolean
}

interface ErrorBody {
  code: string
  message: string
  path: string
}

describe('Commerce — sucursales E2E (RQ-BRN)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>

  let categoryId = ''
  let productAId = ''
  let productBId = ''
  let centroId = ''
  let cerradoId = ''
  let inactivoId = ''
  let lejanoId = ''
  let horasId = ''
  let unknownId = ''

  const auth = (token: string): [string, string] => ['Authorization', `Bearer ${token}`]
  const http = () => request(app.getHttpServer())

  const createBranch = async (
    name: string,
    latitude: number,
    longitude: number,
    hours: HourInput[] = openHours,
    active?: boolean,
  ): Promise<string> => {
    const created = await http()
      .post('/v1/branches')
      .set(...auth(superToken))
      .send({ name, addressText: `${name} address`, latitude, longitude, active })
      .expect(201)

    const id = created.body.id as string

    await http()
      .put(`/v1/branches/${id}/hours`)
      .set(...auth(superToken))
      .send({ hours })
      .expect(200)

    return id
  }

  const createProduct = async (name: string): Promise<string> => {
    const res = await http()
      .post('/v1/catalog/products')
      .set(...auth(superToken))
      .send({ categoryId, name, description: 'Rica', price: 100 })
      .expect(201)
    return res.body.id as string
  }

  beforeAll(async () => {
    mongod = await createMongoServer()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        SecurityModule,
        CategoryModule,
        ProductModule,
        IngredientModule,
        ParameterModule,
        BranchModule,
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

    productAId = await createProduct('Producto A E2E')
    productBId = await createProduct('Producto B E2E')

    // 0,0 → dentro de la zona (radio por defecto 10 km). 1,1 → ~157 km, fuera.
    centroId = await createBranch('Centro E2E', 0, 0, openHours)
    cerradoId = await createBranch('Cerrado E2E', 0.0005, 0, closedHours)
    inactivoId = await createBranch('Inactivo E2E', 0.001, 0, openHours, false)
    lejanoId = await createBranch('Lejano E2E', 1, 1, openHours)
    horasId = await createBranch('Horario E2E', 0.002, 0, openHours)

    unknownId = new Types.ObjectId().toString()
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('GET /v1/branches — listado, filtros y seguridad', () => {
    it('sin token → 401 UNAUTHENTICATED', async () => {
      const res = await http().get('/v1/branches').expect(401)
      expect((res.body as ErrorBody).code).toBe('UNAUTHENTICATED')
    })

    it.each([
      { name: 'customer', token: customerToken('cust-list') },
      { name: 'branch_admin', token: branchAdminTokenFor(centroId) },
    ])('$name → 403 FORBIDDEN', async ({ token }) => {
      const res = await http()
        .get('/v1/branches')
        .set(...auth(token))
        .expect(403)
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN')
    })

    it('super_admin lista con meta de paginación', async () => {
      const res = await http()
        .get('/v1/branches')
        .set(...auth(superToken))
        .expect(200)

      expect(res.body.meta).toMatchObject({ limit: 20, offset: 0 })
      expect(res.body.meta.total).toBeGreaterThanOrEqual(5)
      const ids = (res.body.data as BranchBody[]).map((branch) => branch.id)
      expect(ids).toContain(centroId)
    })

    it('filtra por active=true', async () => {
      const res = await http()
        .get('/v1/branches?active=true')
        .set(...auth(superToken))
        .expect(200)

      const data = res.body.data as BranchBody[]
      expect(data.every((branch) => branch.active === true)).toBe(true)
      expect(data.map((branch) => branch.id)).toContain(centroId)
      expect(data.map((branch) => branch.id)).not.toContain(inactivoId)
    })

    // INT-03: el tipo union del DTO evita que `enableImplicitConversion`
    // coaccione 'false' a true; el filtro de inactivas es alcanzable vía HTTP.
    it('active=false lista sólo las sucursales inactivas', async () => {
      const res = await http()
        .get('/v1/branches?active=false')
        .set(...auth(superToken))
        .expect(200)

      const data = res.body.data as BranchBody[]
      expect(data.every((branch) => branch.active === false)).toBe(true)
      expect(data.map((branch) => branch.id)).toContain(inactivoId)
      expect(data.map((branch) => branch.id)).not.toContain(centroId)
    })

    it('filtra por search en el nombre', async () => {
      const res = await http()
        .get(`/v1/branches?search=${encodeURIComponent('Lejano E2E')}`)
        .set(...auth(superToken))
        .expect(200)

      expect((res.body.data as BranchBody[]).map((branch) => branch.id)).toEqual([lejanoId])
    })
  })

  describe('POST /v1/branches — autorización', () => {
    it.each([
      { name: 'customer', token: customerToken('cust-post') },
      { name: 'branch_admin', token: branchAdminTokenFor(centroId) },
    ])('$name → 403 FORBIDDEN', async ({ token }) => {
      const res = await http()
        .post('/v1/branches')
        .set(...auth(token))
        .send({ name: 'No permitida', addressText: 'X', latitude: 0, longitude: 0 })
        .expect(403)

      expect((res.body as ErrorBody).code).toBe('FORBIDDEN')
    })
  })

  describe('GET /v1/branches/available — sucursales abiertas en radio', () => {
    it('con lat/lng incluye la abierta cercana y excluye cerrada y lejana', async () => {
      const res = await http().get('/v1/branches/available?lat=0&lng=0').expect(200)
      const data = res.body as BranchBody[]
      const ids = data.map((branch) => branch.id)

      expect(data[0].id).toBe(centroId)
      expect(ids).toContain(horasId)
      expect(ids).not.toContain(cerradoId)
      expect(ids).not.toContain(lejanoId)
      expect(ids).not.toContain(inactivoId)
    })

    // INT-10: los query params de `available` son obligatorios y válidos (igual que `nearby`).
    it('sin coords → 400 VALIDATION_ERROR', async () => {
      const res = await http().get('/v1/branches/available').expect(400)
      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR')
    })

    it.each([
      { name: 'lat fuera de rango', query: 'lat=91&lng=0' },
      { name: 'lng fuera de rango', query: 'lat=0&lng=181' },
      { name: 'lat no numérica', query: 'lat=norte&lng=0' },
    ])('$name → 400 VALIDATION_ERROR', async ({ query }) => {
      const res = await http().get(`/v1/branches/available?${query}`).expect(400)
      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR')
    })

    it('sin sucursal disponible en el radio responde lista vacía', async () => {
      const res = await http().get('/v1/branches/available?lat=50&lng=50').expect(200)
      expect(res.body).toEqual([])
    })
  })

  describe('GET /v1/branches/nearby — zona y radio', () => {
    it('incluye dentro de la zona y excluye fuera de radio', async () => {
      const res = await http().get('/v1/branches/nearby?lat=0&lng=0').expect(200)
      const data = res.body as BranchBody[]
      const ids = data.map((branch) => branch.id)

      expect(data[0].id).toBe(centroId)
      expect(ids).toContain(cerradoId)
      expect(ids).toContain(inactivoId)
      expect(ids).not.toContain(lejanoId)
    })

    it('ordena las sucursales abiertas antes que las cerradas', async () => {
      const res = await http().get('/v1/branches/nearby?lat=0&lng=0').expect(200)
      const ids = (res.body as BranchBody[]).map((branch) => branch.id)

      expect(ids.indexOf(centroId)).toBeLessThan(ids.indexOf(cerradoId))
      expect(ids.indexOf(horasId)).toBeLessThan(ids.indexOf(inactivoId))
    })

    // INT-10: los query params de `nearby` son obligatorios y válidos.
    it('sin coords → 400 VALIDATION_ERROR', async () => {
      const res = await http().get('/v1/branches/nearby').expect(400)
      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR')
    })

    it.each([
      { name: 'lat fuera de rango', query: 'lat=91&lng=0' },
      { name: 'lng fuera de rango', query: 'lat=0&lng=181' },
      { name: 'lat no numérica', query: 'lat=norte&lng=0' },
    ])('$name → 400 VALIDATION_ERROR', async ({ query }) => {
      const res = await http().get(`/v1/branches/nearby?${query}`).expect(400)
      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /v1/branches/available/products — productos de la zona', () => {
    it('devuelve los productos de la sucursal disponible más cercana', async () => {
      const res = await http().get('/v1/branches/available/products?lat=0&lng=0').expect(200)
      const data = res.body.data as ProductBody[]

      expect(data.map((product) => product.id)).toEqual(
        expect.arrayContaining([productAId, productBId]),
      )
      expect(data.every((product) => product.availableInBranch)).toBe(true)
    })

    it('refleja la disponibilidad pausada de la sucursal', async () => {
      await http()
        .patch(`/v1/branches/${centroId}/products/${productBId}/availability`)
        .set(...auth(superToken))
        .send({ available: false })
        .expect(200)

      try {
        const res = await http().get('/v1/branches/available/products?lat=0&lng=0').expect(200)
        const row = (res.body.data as ProductBody[]).find((product) => product.id === productBId)
        expect(row?.availableInBranch).toBe(false)
      } finally {
        await http()
          .patch(`/v1/branches/${centroId}/products/${productBId}/availability`)
          .set(...auth(superToken))
          .send({ available: true })
          .expect(200)
      }
    })

    it('sin sucursal disponible en el radio responde data vacía', async () => {
      const res = await http().get('/v1/branches/available/products?lat=50&lng=50').expect(200)

      expect(res.body.data).toEqual([])
    })

    // INT-10: los query params de `available/products` también son obligatorios y válidos.
    it('sin coords → 400 VALIDATION_ERROR', async () => {
      const res = await http().get('/v1/branches/available/products').expect(400)
      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR')
    })

    it.each([
      { name: 'lat fuera de rango', query: 'lat=91&lng=0' },
      { name: 'lng no numérica', query: 'lat=0&lng=sur' },
    ])('$name → 400 VALIDATION_ERROR', async ({ query }) => {
      const res = await http().get(`/v1/branches/available/products?${query}`).expect(400)
      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR')
    })
  })

  describe('CRUD /v1/branches/:branchId', () => {
    it('GET devuelve la sucursal con sus horarios', async () => {
      const res = await http().get(`/v1/branches/${centroId}`).expect(200)
      const branch = res.body as BranchBody

      expect(branch.id).toBe(centroId)
      expect(branch.name).toBe('Centro E2E')
      expect(branch.hours).toHaveLength(7)
    })

    it('GET sucursal inexistente → 404 BRANCH_NOT_FOUND', async () => {
      const res = await http().get(`/v1/branches/${unknownId}`).expect(404)
      expect((res.body as ErrorBody).code).toBe('BRANCH_NOT_FOUND')
    })

    it('PATCH actualiza los datos de la sucursal', async () => {
      const res = await http()
        .patch(`/v1/branches/${horasId}`)
        .set(...auth(superToken))
        .send({ phone: '555-9000' })
        .expect(200)

      expect((res.body as BranchBody).phone).toBe('555-9000')
    })

    it('PATCH sucursal inexistente → 404 BRANCH_NOT_FOUND', async () => {
      const res = await http()
        .patch(`/v1/branches/${unknownId}`)
        .set(...auth(superToken))
        .send({ phone: '555' })
        .expect(404)
      expect((res.body as ErrorBody).code).toBe('BRANCH_NOT_FOUND')
    })

    it('PATCH sin rol admin → 403 FORBIDDEN', async () => {
      const res = await http()
        .patch(`/v1/branches/${centroId}`)
        .set(...auth(customerToken('cust-patch')))
        .send({ phone: '555' })
        .expect(403)
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN')
    })

    it('PATCH active activa y desactiva la sucursal', async () => {
      const activated = await http()
        .patch(`/v1/branches/${inactivoId}/active`)
        .set(...auth(superToken))
        .send({ active: true })
        .expect(200)
      expect((activated.body as BranchBody).active).toBe(true)

      const deactivated = await http()
        .patch(`/v1/branches/${inactivoId}/active`)
        .set(...auth(superToken))
        .send({ active: false })
        .expect(200)
      expect((deactivated.body as BranchBody).active).toBe(false)
    })

    it('PATCH active sucursal inexistente → 404 BRANCH_NOT_FOUND', async () => {
      const res = await http()
        .patch(`/v1/branches/${unknownId}/active`)
        .set(...auth(superToken))
        .send({ active: true })
        .expect(404)
      expect((res.body as ErrorBody).code).toBe('BRANCH_NOT_FOUND')
    })

    it('branch_admin puede abrir/cerrar SU propia sucursal', async () => {
      const closed = await http()
        .patch(`/v1/branches/${centroId}/active`)
        .set(...auth(branchAdminTokenFor(centroId)))
        .send({ active: false })
        .expect(200)
      expect((closed.body as BranchBody).active).toBe(false)

      const opened = await http()
        .patch(`/v1/branches/${centroId}/active`)
        .set(...auth(branchAdminTokenFor(centroId)))
        .send({ active: true })
        .expect(200)
      expect((opened.body as BranchBody).active).toBe(true)
    })

    it('branch_admin NO puede abrir/cerrar otra sucursal → 403', async () => {
      const res = await http()
        .patch(`/v1/branches/${inactivoId}/active`)
        .set(...auth(branchAdminTokenFor('otra-sucursal', 'branch-2')))
        .send({ active: true })
        .expect(403)
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN')
    })

    it('GET hours devuelve los horarios', async () => {
      const res = await http().get(`/v1/branches/${centroId}/hours`).expect(200)
      const hours = res.body as BranchBody['hours']

      expect(hours).toHaveLength(7)
      expect(hours[0]).toMatchObject({ dayOfWeek: 0, closed: false })
    })

    it('GET hours sucursal inexistente → 404 BRANCH_NOT_FOUND', async () => {
      const res = await http().get(`/v1/branches/${unknownId}/hours`).expect(404)
      expect((res.body as ErrorBody).code).toBe('BRANCH_NOT_FOUND')
    })
  })

  describe('PUT /v1/branches/:branchId/hours', () => {
    it('actualiza los horarios con un payload válido', async () => {
      const hours = [{ dayOfWeek: 3, opening: '09:00', closing: '17:00', closed: false }]
      const res = await http()
        .put(`/v1/branches/${horasId}/hours`)
        .set(...auth(superToken))
        .send({ hours })
        .expect(200)

      expect(res.body).toEqual(hours)
    })

    it.each([
      { name: 'hora 25:00 fuera de rango', opening: '25:00' },
      { name: 'minutos 08:99 fuera de rango', opening: '08:99' },
    ])('$name → 400 VALIDATION_ERROR', async ({ opening }) => {
      const res = await http()
        .put(`/v1/branches/${centroId}/hours`)
        .set(...auth(superToken))
        .send({ hours: [{ dayOfWeek: 1, opening, closing: '20:00', closed: false }] })
        .expect(400)

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR')
    })

    it('closed:false sin opening/closing → 400 VALIDATION_ERROR', async () => {
      const res = await http()
        .put(`/v1/branches/${centroId}/hours`)
        .set(...auth(superToken))
        .send({ hours: [{ dayOfWeek: 1, closed: false }] })
        .expect(400)

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR')
    })

    // NEW-21: no se admite un arreglo vacío ni días repetidos.
    it('hours vacío → 400 VALIDATION_ERROR', async () => {
      const res = await http()
        .put(`/v1/branches/${centroId}/hours`)
        .set(...auth(superToken))
        .send({ hours: [] })
        .expect(400)

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR')
    })

    it('dayOfWeek repetido → 400 VALIDATION_ERROR', async () => {
      const res = await http()
        .put(`/v1/branches/${centroId}/hours`)
        .set(...auth(superToken))
        .send({
          hours: [
            { dayOfWeek: 1, opening: '08:00', closing: '20:00', closed: false },
            { dayOfWeek: 1, opening: '09:00', closing: '18:00', closed: false },
          ],
        })
        .expect(400)

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR')
    })

    it('sucursal inexistente → 404 BRANCH_NOT_FOUND', async () => {
      const res = await http()
        .put(`/v1/branches/${unknownId}/hours`)
        .set(...auth(superToken))
        .send({ hours: openHours })
        .expect(404)

      expect((res.body as ErrorBody).code).toBe('BRANCH_NOT_FOUND')
    })
  })

  describe('GET /v1/branches/:branchId/products — assertBranchAccess', () => {
    it('super_admin lista los productos de la sucursal', async () => {
      const res = await http()
        .get(`/v1/branches/${centroId}/products`)
        .set(...auth(superToken))
        .expect(200)
      const data = res.body.data as ProductBody[]

      expect(data.map((product) => product.id)).toEqual(
        expect.arrayContaining([productAId, productBId]),
      )
    })

    it('branch_admin de la propia sucursal → 200', async () => {
      await http()
        .get(`/v1/branches/${centroId}/products`)
        .set(...auth(branchAdminTokenFor(centroId)))
        .expect(200)
    })

    it('branch_admin de otra sucursal → 403 FORBIDDEN', async () => {
      const res = await http()
        .get(`/v1/branches/${centroId}/products`)
        .set(...auth(branchAdminTokenFor('otra-sucursal', 'branch-2')))
        .expect(403)

      expect((res.body as ErrorBody).code).toBe('FORBIDDEN')
    })

    it('branch_admin sin branchId en el token → 403 FORBIDDEN', async () => {
      const res = await http()
        .get(`/v1/branches/${centroId}/products`)
        .set(...auth(branchAdminTokenFor(null)))
        .expect(403)

      expect((res.body as ErrorBody).code).toBe('FORBIDDEN')
    })

    // INT-09: listProducts verifica que la sucursal exista.
    it('sucursal inexistente → 404 BRANCH_NOT_FOUND', async () => {
      const res = await http()
        .get(`/v1/branches/${unknownId}/products`)
        .set(...auth(superToken))
        .expect(404)

      expect((res.body as ErrorBody).code).toBe('BRANCH_NOT_FOUND')
    })
  })

  describe('PATCH /v1/branches/:branchId/products/:productId/availability', () => {
    it('super_admin pausa y reactiva un producto de la sucursal', async () => {
      const paused = await http()
        .patch(`/v1/branches/${centroId}/products/${productAId}/availability`)
        .set(...auth(superToken))
        .send({ available: false })
        .expect(200)
      expect(paused.body).toEqual({ ok: true })

      const afterPause = await http()
        .get(`/v1/branches/${centroId}/products`)
        .set(...auth(superToken))
        .expect(200)
      const pausedRow = (afterPause.body.data as ProductBody[]).find(
        (product) => product.id === productAId,
      )
      expect(pausedRow?.availableInBranch).toBe(false)

      await http()
        .patch(`/v1/branches/${centroId}/products/${productAId}/availability`)
        .set(...auth(superToken))
        .send({ available: true })
        .expect(200)
    })

    it('branch_admin de la propia sucursal → 200', async () => {
      const res = await http()
        .patch(`/v1/branches/${centroId}/products/${productBId}/availability`)
        .set(...auth(branchAdminTokenFor(centroId)))
        .send({ available: false })
        .expect(200)
      expect(res.body).toEqual({ ok: true })

      await http()
        .patch(`/v1/branches/${centroId}/products/${productBId}/availability`)
        .set(...auth(branchAdminTokenFor(centroId)))
        .send({ available: true })
        .expect(200)
    })

    it('branch_admin de otra sucursal → 403 FORBIDDEN', async () => {
      const res = await http()
        .patch(`/v1/branches/${centroId}/products/${productAId}/availability`)
        .set(...auth(branchAdminTokenFor('otra-sucursal', 'branch-2')))
        .send({ available: false })
        .expect(403)

      expect((res.body as ErrorBody).code).toBe('FORBIDDEN')
    })

    // INT-09: se verifica la existencia de la sucursal y del producto.
    it('producto inexistente → 404 PRODUCT_NOT_FOUND', async () => {
      const res = await http()
        .patch(`/v1/branches/${centroId}/products/${unknownId}/availability`)
        .set(...auth(superToken))
        .send({ available: false })
        .expect(404)

      expect((res.body as ErrorBody).code).toBe('PRODUCT_NOT_FOUND')
    })

    it('sucursal inexistente → 404 BRANCH_NOT_FOUND', async () => {
      const res = await http()
        .patch(`/v1/branches/${unknownId}/products/${productAId}/availability`)
        .set(...auth(superToken))
        .send({ available: false })
        .expect(404)

      expect((res.body as ErrorBody).code).toBe('BRANCH_NOT_FOUND')
    })
  })
})
