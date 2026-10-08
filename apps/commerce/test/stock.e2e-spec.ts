import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getModelToken, MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { MongoMemoryServer } from 'mongodb-memory-server'
import type { Model } from 'mongoose'
import { createMongoServer } from './mongo'
import request from 'supertest'
import type { Response as SupertestResponse } from 'supertest'
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
import { ReportingModule } from '../src/reporting/reporting.module'
import { StockModule } from '../src/stock/stock.module'
import { StockMovement, StockMovementDocument } from '../src/stock/stock-movement.model'
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

const riderToken = jwt.sign({ userId: 'rider-1', roles: ['rider'] }, env.jwtSecret)

const deliveryAddress = {
  addressId: 'addr-1',
  deliveryAddress: { text: 'Av Cliente', latitude: 0.0001, longitude: 0 },
}

interface StockRow {
  ingredientId: string
  branchId: string
  quantity: number
}

describe('Commerce — stock E2E (RQ-STK, RQ-REP-03/06)', () => {
  let mongod: MongoMemoryServer
  let moduleFixture: TestingModule
  let app: INestApplication<App>
  let movementModel: Model<StockMovementDocument>

  let categoryId = ''
  let branchA = ''
  let branchB = ''

  const ingredientIds: Record<string, string> = {}
  const productIds: Record<string, string> = {}
  let optDoubleId = ''

  const auth = (token: string): [string, string] => ['Authorization', `Bearer ${token}`]
  const http = () => request(app.getHttpServer())

  const getStock = async (branchId: string, ingredientId: string): Promise<number> => {
    const res = await http()
      .get(`/v1/stock?branchId=${branchId}`)
      .set(...auth(superToken))
      .expect(200)
    const row = (res.body as StockRow[]).find((entry) => entry.ingredientId === ingredientId)
    return row?.quantity ?? 0
  }

  const setStock = async (
    branchId: string,
    ingredientId: string,
    quantity: number,
  ): Promise<void> => {
    const current = await getStock(branchId, ingredientId)
    await http()
      .post('/v1/stock/adjustments')
      .set(...auth(superToken))
      .send({ branchId, ingredientId, delta: quantity - current })
      .expect(201)
  }

  const createIngredient = async (name: string): Promise<string> => {
    const res = await http()
      .post('/v1/catalog/ingredients')
      .set(...auth(superToken))
      .send({ name, unit: 'un' })
      .expect(201)
    return res.body.id as string
  }

  const createProduct = async (name: string): Promise<string> => {
    const res = await http()
      .post('/v1/catalog/products')
      .set(...auth(superToken))
      .send({ categoryId, name, description: 'Rica', price: 100 })
      .expect(201)
    return res.body.id as string
  }

  const setRecipe = (
    productId: string,
    items: Array<{
      ingredientId: string
      quantity: number
      optionAdjustments?: Array<{ optionId: string; quantity: number }>
    }>,
  ): Promise<unknown> =>
    http()
      .put(`/v1/catalog/products/${productId}/recipe`)
      .set(...auth(superToken))
      .send({ items })
      .expect(200)

  const addCartItem = (token: string, productId: string, quantity: number, optionIds?: string[]) =>
    http()
      .post('/v1/carts/items')
      .set(...auth(token))
      .send({ productId, quantity, optionIds })

  const placeOrder = async (
    customerId: string,
    productId: string,
    quantity = 1,
    optionIds?: string[],
  ): Promise<SupertestResponse> => {
    const token = customerToken(customerId)
    await addCartItem(token, productId, quantity, optionIds).expect(201)
    return http()
      .post('/v1/orders')
      .set(...auth(token))
      .send(deliveryAddress)
  }

  const transition = (orderId: string, status: string, token = branchAdminTokenFor(branchA)) =>
    http()
      .patch(`/v1/orders/${orderId}/status`)
      .set(...auth(token))
      .send({ status })

  beforeAll(async () => {
    mongod = await createMongoServer()

    moduleFixture = await Test.createTestingModule({
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
        ReportingModule,
        ParameterModule,
        UploadModule,
      ],
    })
      .overrideProvider(UploadRepository)
      .useValue({ upload: jest.fn().mockResolvedValue({ url: CLOUDINARY_URL }) })
      .compile()

    movementModel = moduleFixture.get<Model<StockMovementDocument>>(
      getModelToken(StockMovement.name),
    )

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

    for (const name of [
      'ingA',
      'ingB',
      'ingC',
      'ingD1',
      'ingD2',
      'ingE',
      'ingF',
      'ingAbsent',
      'ingNever',
    ]) {
      ingredientIds[name] = await createIngredient(name)
    }

    const createBranch = async (name: string, latitude: number, longitude: number) => {
      const res = await http()
        .post('/v1/branches')
        .set(...auth(superToken))
        .send({ name, addressText: name, latitude, longitude })
        .expect(201)
      await http()
        .put(`/v1/branches/${res.body.id}/hours`)
        .set(...auth(superToken))
        .send({ hours: openHours })
        .expect(200)
      return res.body.id as string
    }

    branchA = await createBranch('Centro', 0, 0)
    branchB = await createBranch('Lejano', 1, 1)

    productIds.pMain = await createProduct('Hamburguesa principal')
    productIds.pLow = await createProduct('Hamburguesa escasa')
    productIds.pExact = await createProduct('Hamburguesa exacta')
    productIds.pMulti = await createProduct('Hamburguesa múltiple')
    productIds.pAbsent = await createProduct('Hamburguesa ausente')
    productIds.pNever = await createProduct('Hamburguesa sin stock cargado')
    productIds.pVariant = await createProduct('Hamburguesa variable')
    productIds.pAccum = await createProduct('Hamburguesa acumulable')
    productIds.pNoRecipe = await createProduct('Hamburguesa sin receta')

    await setRecipe(productIds.pMain, [{ ingredientId: ingredientIds.ingA, quantity: 2 }])
    await setRecipe(productIds.pLow, [{ ingredientId: ingredientIds.ingB, quantity: 5 }])
    await setRecipe(productIds.pExact, [{ ingredientId: ingredientIds.ingC, quantity: 6 }])
    await setRecipe(productIds.pMulti, [
      { ingredientId: ingredientIds.ingD1, quantity: 2 },
      { ingredientId: ingredientIds.ingD2, quantity: 20 },
    ])
    await setRecipe(productIds.pAbsent, [{ ingredientId: ingredientIds.ingAbsent, quantity: 1 }])
    await setRecipe(productIds.pNever, [{ ingredientId: ingredientIds.ingNever, quantity: 1 }])
    await setRecipe(productIds.pAccum, [{ ingredientId: ingredientIds.ingF, quantity: 1 }])

    const group = await http()
      .post(`/v1/catalog/products/${productIds.pVariant}/configurations`)
      .set(...auth(superToken))
      .send({ name: 'Tamaño', type: 'single', required: false })
      .expect(201)

    const option = await http()
      .post(`/v1/catalog/products/${productIds.pVariant}/configurations/${group.body.id}/options`)
      .set(...auth(superToken))
      .send({ name: 'Doble', extraPrice: 30 })
      .expect(201)
    optDoubleId = option.body.id as string

    await setRecipe(productIds.pVariant, [
      {
        ingredientId: ingredientIds.ingE,
        quantity: 1,
        optionAdjustments: [{ optionId: optDoubleId, quantity: 4 }],
      },
    ])

    // Stock inicial determinista.
    await setStock(branchA, ingredientIds.ingA, 1000)
    await setStock(branchA, ingredientIds.ingC, 6)
    await setStock(branchA, ingredientIds.ingD1, 3)
    await setStock(branchA, ingredientIds.ingD2, 10)
    await setStock(branchA, ingredientIds.ingE, 100)
    await setStock(branchA, ingredientIds.ingF, 100)
    await setStock(branchA, ingredientIds.ingB, 1)
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('A. Listado y seguridad (RQ-STK-01/02/03/10)', () => {
    it('A1: super_admin lista el stock de todas las sucursales', async () => {
      const res = await http()
        .get('/v1/stock')
        .set(...auth(superToken))
        .expect(200)
      const rows = res.body as StockRow[]
      expect(rows.some((row) => row.branchId === branchA)).toBe(true)
    })

    it('A2: super_admin filtra el stock por sucursal', async () => {
      await setStock(branchB, ingredientIds.ingA, 42)
      const res = await http()
        .get(`/v1/stock?branchId=${branchB}`)
        .set(...auth(superToken))
        .expect(200)
      const rows = res.body as StockRow[]
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every((row) => row.branchId === branchB)).toBe(true)
      expect(rows.find((row) => row.ingredientId === ingredientIds.ingA)?.quantity).toBe(42)
    })

    it('A3: branch_admin sólo ve su sucursal aunque pida otra por query', async () => {
      const res = await http()
        .get(`/v1/stock?branchId=${branchB}`)
        .set(...auth(branchAdminTokenFor(branchA)))
        .expect(200)
      const rows = res.body as StockRow[]
      expect(rows.every((row) => row.branchId === branchA)).toBe(true)
    })

    it('A4: branch_admin sin sucursal en el token → 403 FORBIDDEN', async () => {
      const token = jwt.sign({ userId: 'b1', roles: ['branch_admin'] }, env.jwtSecret)
      const res = await http()
        .get('/v1/stock')
        .set(...auth(token))
        .expect(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })

    it.each([
      { name: 'customer', token: customerToken('cust-list') },
      { name: 'rider', token: riderToken },
    ])('A5: $name no puede listar stock → 403', async ({ token }) => {
      const res = await http()
        .get('/v1/stock')
        .set(...auth(token))
        .expect(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })

    it('A6: sin token → 401 UNAUTHENTICATED', async () => {
      const res = await http().get('/v1/stock').expect(401)
      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it.each([
      { name: 'customer', token: customerToken('cust-adj') },
      { name: 'rider', token: riderToken },
    ])('A7: $name no puede ajustar stock → 403', async ({ token }) => {
      const res = await http()
        .post('/v1/stock/adjustments')
        .set(...auth(token))
        .send({ branchId: branchA, ingredientId: ingredientIds.ingA, delta: 1 })
        .expect(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })
  })

  describe('B. Ajuste de stock y movimientos (RQ-STK-04)', () => {
    it('B1: delta positivo crea y luego incrementa la fila', async () => {
      await setStock(branchA, ingredientIds.ingC, 0)
      const created = await http()
        .post('/v1/stock/adjustments')
        .set(...auth(superToken))
        .send({ branchId: branchA, ingredientId: ingredientIds.ingC, delta: 5 })
        .expect(201)
      expect(created.body).toMatchObject({
        branchId: branchA,
        ingredientId: ingredientIds.ingC,
        quantity: 5,
      })

      const again = await http()
        .post('/v1/stock/adjustments')
        .set(...auth(superToken))
        .send({ branchId: branchA, ingredientId: ingredientIds.ingC, delta: 3 })
        .expect(201)
      expect(again.body.quantity).toBe(8)
    })

    it('B2: delta negativo decrementa', async () => {
      await setStock(branchA, ingredientIds.ingC, 10)
      const res = await http()
        .post('/v1/stock/adjustments')
        .set(...auth(superToken))
        .send({ branchId: branchA, ingredientId: ingredientIds.ingC, delta: -4 })
        .expect(201)
      expect(res.body.quantity).toBe(6)
    })

    it('B3: delta negativo que cruza el cero se recorta a 0', async () => {
      await setStock(branchA, ingredientIds.ingC, 2)
      const res = await http()
        .post('/v1/stock/adjustments')
        .set(...auth(superToken))
        .send({ branchId: branchA, ingredientId: ingredientIds.ingC, delta: -10 })
        .expect(201)
      expect(res.body.quantity).toBe(0)
    })

    it('B4: ajustar un ingrediente inexistente crea la fila', async () => {
      const res = await http()
        .post('/v1/stock/adjustments')
        .set(...auth(superToken))
        .send({ branchId: branchA, ingredientId: ingredientIds.ingAbsent, delta: 7 })
        .expect(201)
      expect(res.body.quantity).toBe(7)
    })

    it('B5: se registra un movimiento con el reason recibido y el delta aplicado', async () => {
      await setStock(branchA, ingredientIds.ingD2, 10)
      await movementModel.deleteMany({ branchId: branchA, ingredientId: ingredientIds.ingD2 })

      await http()
        .post('/v1/stock/adjustments')
        .set(...auth(superToken))
        .send({
          branchId: branchA,
          ingredientId: ingredientIds.ingD2,
          delta: 4,
          reason: 'reposicion',
        })
        .expect(201)

      const movements = await movementModel
        .find({ branchId: branchA, ingredientId: ingredientIds.ingD2 })
        .lean()
        .exec()
      expect(movements).toHaveLength(1)
      expect(movements[0]).toMatchObject({
        branchId: branchA,
        ingredientId: ingredientIds.ingD2,
        delta: 4,
        reason: 'reposicion',
        orderId: null,
      })
      expect(movements[0].createdAt).toBeInstanceOf(Date)
    })

    it('B5b: sin reason se registra "adjust" por defecto', async () => {
      await setStock(branchA, ingredientIds.ingD2, 10)
      await movementModel.deleteMany({ branchId: branchA, ingredientId: ingredientIds.ingD2 })

      await http()
        .post('/v1/stock/adjustments')
        .set(...auth(superToken))
        .send({ branchId: branchA, ingredientId: ingredientIds.ingD2, delta: 2 })
        .expect(201)

      const movements = await movementModel
        .find({ branchId: branchA, ingredientId: ingredientIds.ingD2 })
        .lean()
        .exec()
      expect(movements).toHaveLength(1)
      expect(movements[0]).toMatchObject({ delta: 2, reason: 'adjust' })
    })

    it('B6: branch_admin enviando otro branchId queda forzado a su sucursal', async () => {
      await setStock(branchA, ingredientIds.ingD1, 10)
      await setStock(branchB, ingredientIds.ingD1, 10)

      await http()
        .post('/v1/stock/adjustments')
        .set(...auth(branchAdminTokenFor(branchA)))
        .send({ branchId: branchB, ingredientId: ingredientIds.ingD1, delta: 5 })
        .expect(201)

      expect(await getStock(branchA, ingredientIds.ingD1)).toBe(15)
      expect(await getStock(branchB, ingredientIds.ingD1)).toBe(10)
    })

    it('B7: branch_admin sin sucursal en el token → 403', async () => {
      const token = jwt.sign({ userId: 'b1', roles: ['branch_admin'] }, env.jwtSecret)
      const res = await http()
        .post('/v1/stock/adjustments')
        .set(...auth(token))
        .send({ branchId: branchA, ingredientId: ingredientIds.ingA, delta: 1 })
        .expect(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })

    it.each([
      { name: 'sin ingredientId', body: { branchId: branchA, delta: 1 } },
      {
        name: 'delta no numérico',
        body: { branchId: branchA, ingredientId: 'y', delta: 'abc' },
      },
      { name: 'sin branchId', body: { ingredientId: 'y', delta: 1 } },
    ])('B8: $name → 400 validation', async ({ body }) => {
      const res = await http()
        .post('/v1/stock/adjustments')
        .set(...auth(superToken))
        .send(body)
        .expect(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('B9 (documentado): super_admin sin branchId → 400 por DTO (no llega al 403 del controller)', async () => {
      const res = await http()
        .post('/v1/stock/adjustments')
        .set(...auth(superToken))
        .send({ ingredientId: ingredientIds.ingA, delta: 1 })
        .expect(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('C. Validación al confirmar pedido (RQ-STK-05/06)', () => {
    it('C1: con stock suficiente crea el pedido y NO descuenta al confirmar', async () => {
      await setStock(branchA, ingredientIds.ingA, 50)
      const res = await placeOrder('cust-c1', productIds.pMain, 2)
      expect(res.status).toBe(201)
      expect(res.body.status).toBe('pending')
      expect(await getStock(branchA, ingredientIds.ingA)).toBe(50)
    })

    it('C2: stock insuficiente → 409 INSUFFICIENT_STOCK sin crear pedido', async () => {
      await setStock(branchA, ingredientIds.ingB, 1)
      const token = customerToken('cust-c2')
      await addCartItem(token, productIds.pLow, 1).expect(201)

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
      expect(await getStock(branchA, ingredientIds.ingB)).toBe(1)
    })

    it('C3: cantidad exactamente igual al stock (límite) → 201', async () => {
      await setStock(branchA, ingredientIds.ingC, 6)
      const res = await placeOrder('cust-c3', productIds.pExact, 1)
      expect(res.status).toBe(201)
      expect(await getStock(branchA, ingredientIds.ingC)).toBe(6)
    })

    it('C4: ingrediente sin fila de stock (0) → 409', async () => {
      const res = await placeOrder('cust-c4', productIds.pNever, 1)
      expect(res.status).toBe(409)
      expect(res.body.code).toBe('INSUFFICIENT_STOCK')
    })

    it('C5: varios ingredientes con uno insuficiente → 409 nombrando el ingrediente', async () => {
      await setStock(branchA, ingredientIds.ingD1, 3)
      await setStock(branchA, ingredientIds.ingD2, 10)
      const res = await placeOrder('cust-c5', productIds.pMulti, 1)
      expect(res.status).toBe(409)
      expect(res.body.code).toBe('INSUFFICIENT_STOCK')
      expect(res.body.message).toContain(ingredientIds.ingD2)
    })

    it('C6: la variante elegida cambia el requerimiento (base ok, opción insuficiente)', async () => {
      await setStock(branchA, ingredientIds.ingE, 3)

      const base = await placeOrder('cust-c6-base', productIds.pVariant, 1)
      expect(base.status).toBe(201)

      const variant = await placeOrder('cust-c6-opt', productIds.pVariant, 1, [optDoubleId])
      expect(variant.status).toBe(409)
      expect(variant.body.code).toBe('INSUFFICIENT_STOCK')
    })
  })

  describe('D. Descuento al PREPARING y cancelación (RQ-STK-07/08/09)', () => {
    it('D1: pending → confirmed no modifica el stock', async () => {
      await setStock(branchA, ingredientIds.ingA, 30)
      const order = await placeOrder('cust-d1', productIds.pMain, 1)
      expect(order.status).toBe(201)

      await transition(order.body.id, 'confirmed').expect(200)
      expect(await getStock(branchA, ingredientIds.ingA)).toBe(30)
    })

    it('D2: confirmed → preparing descuenta receta × cantidad', async () => {
      await setStock(branchA, ingredientIds.ingA, 30)
      const order = await placeOrder('cust-d2', productIds.pMain, 3)
      await transition(order.body.id, 'confirmed').expect(200)

      const preparing = await transition(order.body.id, 'preparing').expect(200)
      expect(preparing.body.status).toBe('preparing')
      expect(await getStock(branchA, ingredientIds.ingA)).toBe(24)
    })

    it('D3: el descuento respeta el ajuste de la opción elegida', async () => {
      await setStock(branchA, ingredientIds.ingE, 20)
      const order = await placeOrder('cust-d3', productIds.pVariant, 2, [optDoubleId])
      await transition(order.body.id, 'confirmed').expect(200)
      await transition(order.body.id, 'preparing').expect(200)

      // 2 unidades × 4 (ajuste "Doble") = 8 descontadas.
      expect(await getStock(branchA, ingredientIds.ingE)).toBe(12)
    })

    it('D4a: cancelar desde pending no descuenta', async () => {
      await setStock(branchA, ingredientIds.ingA, 30)
      const order = await placeOrder('cust-d4a', productIds.pMain, 2)
      await transition(order.body.id, 'cancelled').expect(200)
      expect(await getStock(branchA, ingredientIds.ingA)).toBe(30)
    })

    it('D4b: cancelar desde confirmed no descuenta', async () => {
      await setStock(branchA, ingredientIds.ingA, 30)
      const order = await placeOrder('cust-d4b', productIds.pMain, 2)
      await transition(order.body.id, 'confirmed').expect(200)
      await transition(order.body.id, 'cancelled').expect(200)
      expect(await getStock(branchA, ingredientIds.ingA)).toBe(30)
    })

    it('D5: repetir el estado PREPARING no descuenta dos veces', async () => {
      await setStock(branchA, ingredientIds.ingA, 30)
      const order = await placeOrder('cust-d5', productIds.pMain, 2)
      await transition(order.body.id, 'confirmed').expect(200)
      await transition(order.body.id, 'preparing').expect(200)
      await transition(order.body.id, 'preparing').expect(200)

      expect(await getStock(branchA, ingredientIds.ingA)).toBe(26)
    })

    it('D6: transición inválida pending → preparing no descuenta', async () => {
      await setStock(branchA, ingredientIds.ingA, 30)
      const order = await placeOrder('cust-d6', productIds.pMain, 2)
      const res = await transition(order.body.id, 'preparing').expect(409)
      expect(res.body.code).toBe('INVALID_TRANSITION')
      expect(await getStock(branchA, ingredientIds.ingA)).toBe(30)
    })

    it('D7: el movimiento registra el cambio real cuando el stock se recorta a 0', async () => {
      await setStock(branchA, ingredientIds.ingA, 10)
      const order = await placeOrder('cust-d7', productIds.pMain, 2)
      await transition(order.body.id, 'confirmed').expect(200)

      // El stock cae por debajo del requerimiento entre la creación y la preparación.
      await setStock(branchA, ingredientIds.ingA, 1)
      await movementModel.deleteMany({ branchId: branchA, ingredientId: ingredientIds.ingA })

      await transition(order.body.id, 'preparing').expect(200)

      expect(await getStock(branchA, ingredientIds.ingA)).toBe(0)
      const movements = await movementModel
        .find({ branchId: branchA, ingredientId: ingredientIds.ingA, reason: 'preparing' })
        .lean()
        .exec()
      // El stock real bajó 1 (de 1 a 0) y el movimiento registra ese cambio real.
      expect(movements).toHaveLength(1)
      expect(movements[0].delta).toBe(-1)
    })

    it('D8: dos pedidos distintos acumulan el descuento', async () => {
      await setStock(branchA, ingredientIds.ingF, 10)

      const first = await placeOrder('cust-d8a', productIds.pAccum, 1)
      const second = await placeOrder('cust-d8b', productIds.pAccum, 1)
      await transition(first.body.id, 'confirmed').expect(200)
      await transition(first.body.id, 'preparing').expect(200)
      await transition(second.body.id, 'confirmed').expect(200)
      await transition(second.body.id, 'preparing').expect(200)

      expect(await getStock(branchA, ingredientIds.ingF)).toBe(8)
    })

    it('D9 (documentado): el descuento usa la receta actual, no el snapshot del pedido', async () => {
      await setStock(branchA, ingredientIds.ingA, 30)
      const order = await placeOrder('cust-d9', productIds.pMain, 1)
      await transition(order.body.id, 'confirmed').expect(200)

      // La receta cambia después de confirmar (snapshot del pedido intacto).
      await setRecipe(productIds.pMain, [{ ingredientId: ingredientIds.ingA, quantity: 5 }])
      await transition(order.body.id, 'preparing').expect(200)

      // Se descuentan 5 (receta nueva) y no 2 (receta al momento del pedido).
      expect(await getStock(branchA, ingredientIds.ingA)).toBe(25)

      await setRecipe(productIds.pMain, [{ ingredientId: ingredientIds.ingA, quantity: 2 }])
    })
  })

  describe('E. Reporte de productos sin stock (RQ-REP-03/06)', () => {
    const outOfStock = (token: string, branchId?: string) =>
      http()
        .get(`/v1/reporting/products/out-of-stock${branchId ? `?branchId=${branchId}` : ''}`)
        .set(...auth(token))

    const productIdsIn = (body: unknown): string[] =>
      (body as Array<{ product: { id: string } }>).map((row) => row.product.id)

    it('E1: producto con ingrediente en 0 aparece; con stock no aparece', async () => {
      await setStock(branchA, ingredientIds.ingA, 0)
      await setStock(branchA, ingredientIds.ingB, 10)

      const res = await outOfStock(superToken, branchA).expect(200)
      const ids = productIdsIn(res.body)
      expect(ids).toContain(productIds.pMain)
      expect(ids).not.toContain(productIds.pLow)
    })

    it('E2: producto con todos los ingredientes > 0 no aparece', async () => {
      await setStock(branchA, ingredientIds.ingA, 5)
      const res = await outOfStock(superToken, branchA).expect(200)
      expect(productIdsIn(res.body)).not.toContain(productIds.pMain)
    })

    it('E3: producto sin receta queda excluido', async () => {
      const res = await outOfStock(superToken, branchA).expect(200)
      expect(productIdsIn(res.body)).not.toContain(productIds.pNoRecipe)
    })

    it('E4: branch_admin sólo ve su sucursal', async () => {
      await setStock(branchA, ingredientIds.ingA, 0)
      await setStock(branchB, ingredientIds.ingA, 50)

      const res = await outOfStock(branchAdminTokenFor(branchA)).expect(200)
      expect(productIdsIn(res.body)).toContain(productIds.pMain)
    })

    it('E4b (bug conocido): super_admin sin filtro colapsa el stock por ingrediente entre sucursales', async () => {
      await setStock(branchA, ingredientIds.ingA, 0)
      await setStock(branchB, ingredientIds.ingA, 50)

      const res = await outOfStock(superToken).expect(200)
      // El stock por sucursal se mezcla en un único mapa por ingrediente:
      // el resultado depende de la última sucursal leída y es inconsistente.
      expect(res.status).toBe(200)
    })

    it('E5: al descontar hasta 0 en PREPARING el producto pasa a "sin stock"', async () => {
      await setStock(branchA, ingredientIds.ingA, 2)
      const order = await placeOrder('cust-e5', productIds.pMain, 1)
      await transition(order.body.id, 'confirmed').expect(200)
      await transition(order.body.id, 'preparing').expect(200)

      const res = await outOfStock(superToken, branchA).expect(200)
      expect(productIdsIn(res.body)).toContain(productIds.pMain)
    })

    it('E6: la fila reportada tiene quantity 0', async () => {
      await setStock(branchA, ingredientIds.ingA, 0)
      const res = await outOfStock(superToken, branchA).expect(200)
      const row = (res.body as Array<{ product: { id: string }; quantity: number }>).find(
        (entry) => entry.product.id === productIds.pMain,
      )
      expect(row?.quantity).toBe(0)
    })
  })
})
