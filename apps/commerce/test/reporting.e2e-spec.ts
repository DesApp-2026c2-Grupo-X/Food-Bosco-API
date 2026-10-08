import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getModelToken, MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { MongoMemoryServer } from 'mongodb-memory-server'
import type { Model } from 'mongoose'
import { createMongoServer } from './mongo'
import request from 'supertest'
import type { App } from 'supertest/types'
import { BranchModule } from '../src/branch/branch.module'
import { CartModule } from '../src/cart/cart.module'
import { CategoryModule } from '../src/category/category.module'
import type { OrderStatus } from '../src/config/constants'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { IngredientModule } from '../src/ingredient/ingredient.module'
import { Order, OrderDocument } from '../src/order/order.model'
import { OrderModule } from '../src/order/order.module'
import { ParameterModule } from '../src/parameter/parameter.module'
import { ProductModule } from '../src/product/product.module'
import { ReportingModule } from '../src/reporting/reporting.module'
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

const RANGE_FROM = '2026-01-01T00:00:00.000Z'
const RANGE_TO = '2026-01-31T23:59:59.999Z'
const ORDER_DATE = new Date('2026-01-15T15:00:00.000Z')
const OLD_ORDER_DATE = new Date('2020-01-01T15:00:00.000Z')

const customerToken = (id: string): string =>
  jwt.sign({ userId: id, roles: ['customer'] }, env.jwtSecret)

const branchAdminTokenFor = (branchId: string, userId = 'branch-1'): string =>
  jwt.sign({ userId, roles: ['branch_admin'], branchId }, env.jwtSecret)

const superToken = jwt.sign({ userId: 'admin-1', roles: ['super_admin'] }, env.jwtSecret)

const riderToken = jwt.sign({ userId: 'rider-1', roles: ['rider'] }, env.jwtSecret)

interface ProductReportRow {
  position: number
  product: { id: string; name: string; categoryId: string; price: number }
  category: { id: string; name: string } | null
  quantity: number | null
  revenue: number | null
}

interface OutOfStockRow {
  product: { id: string; name: string }
  category: { id: string; name: string } | null
  quantity: number
}

interface OverviewBody {
  period: { from: string; to: string }
  kpis: {
    totalRevenue: number
    totalOrders: number
    averageTicket: number
    cancelledOrders: number
    bestSellingProduct: {
      productId: string
      name: string
      quantity: number
      revenue: number
    } | null
    topBranch: { branchId: string; branchName: string; revenue: number; orders: number } | null
  }
  variation: {
    revenuePct: number | null
    ordersPct: number | null
    averageTicketPct: number | null
  }
  salesSeries: Array<{ bucket: string; revenue: number; orders: number }>
  ordersByStatus: Array<{ status: string; count: number }>
  topProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>
  branchPerformance: Array<{
    branchId: string
    branchName: string
    revenue: number
    orders: number
  }>
}

interface SeedItem {
  productId: string
  name: string
  unitPrice: number
  quantity: number
}

interface SeedOrder {
  number: string
  branchId: string
  status: OrderStatus
  total: number
  createdAt: Date
  items: SeedItem[]
}

const productIds = (rows: Array<{ product: { id: string } }>): string[] =>
  rows.map((row) => row.product.id)

const positions = (rows: Array<{ position: number }>): number[] => rows.map((row) => row.position)

describe('Commerce — reporting E2E (RQ-REP)', () => {
  let mongod: MongoMemoryServer
  let moduleFixture: TestingModule
  let app: INestApplication<App>
  let orderModel: Model<OrderDocument>

  let categoryBurger = ''
  let categoryDrink = ''
  let branchA = ''
  let branchB = ''

  const ingredientIds: Record<string, string> = {}

  const P_TOP = { name: 'A Top Burger', price: 100 }
  const P_MID = { name: 'B Mid Burger', price: 200 }
  const P_DRINK = { name: 'C Limonada', price: 50 }
  const P_ZERO = { name: 'D Sin ventas', price: 30 }
  const P_OOS = { name: 'E Agotada', price: 40 }

  const productId: Record<string, string> = {}

  const auth = (token: string): [string, string] => ['Authorization', `Bearer ${token}`]
  const http = () => request(app.getHttpServer())

  const report = (path: string, query: string, token: string) =>
    http()
      .get(`/v1/reporting/${path}${query}`)
      .set(...auth(token))

  const getStock = async (branchId: string, ingredientId: string): Promise<number> => {
    const res = await http()
      .get(`/v1/stock?branchId=${branchId}`)
      .set(...auth(superToken))
      .expect(200)
    const row = (res.body as Array<{ ingredientId: string; quantity: number }>).find(
      (entry) => entry.ingredientId === ingredientId,
    )
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

  const createProduct = async (
    name: string,
    price: number,
    categoryId: string,
  ): Promise<string> => {
    const res = await http()
      .post('/v1/catalog/products')
      .set(...auth(superToken))
      .send({ categoryId, name, description: 'Rica', price })
      .expect(201)
    return res.body.id as string
  }

  const setRecipe = (productIdValue: string, ingredientId: string, quantity: number) =>
    http()
      .put(`/v1/catalog/products/${productIdValue}/recipe`)
      .set(...auth(superToken))
      .send({ items: [{ ingredientId, quantity }] })
      .expect(200)

  const seedOrder = async (input: SeedOrder): Promise<void> => {
    await orderModel.create({
      number: input.number,
      clientId: `client-${input.number}`,
      branchId: input.branchId,
      addressId: 'addr-1',
      deliveryAddress: { text: 'Av Cliente', latitude: 0, longitude: 0 },
      status: input.status,
      total: input.total,
      estimatedDeliveryAt: null,
      riderId: null,
      tripId: null,
      items: input.items.map((item) => ({
        ...item,
        observations: null,
        subtotal: item.unitPrice * item.quantity,
        options: [],
      })),
      statusHistory: [],
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    })
  }

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

    orderModel = moduleFixture.get<Model<OrderDocument>>(getModelToken(Order.name))

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

    const burger = await http()
      .post('/v1/catalog/categories')
      .set(...auth(superToken))
      .send({ name: 'Hamburguesas' })
      .expect(201)
    categoryBurger = burger.body.id as string

    const drink = await http()
      .post('/v1/catalog/categories')
      .set(...auth(superToken))
      .send({ name: 'Bebidas' })
      .expect(201)
    categoryDrink = drink.body.id as string

    for (const name of ['ingReportA', 'ingReportB', 'ingReportC']) {
      ingredientIds[name] = await createIngredient(name)
    }

    productId.top = await createProduct(P_TOP.name, P_TOP.price, categoryBurger)
    productId.mid = await createProduct(P_MID.name, P_MID.price, categoryBurger)
    productId.drink = await createProduct(P_DRINK.name, P_DRINK.price, categoryDrink)
    productId.zero = await createProduct(P_ZERO.name, P_ZERO.price, categoryBurger)
    productId.oos = await createProduct(P_OOS.name, P_OOS.price, categoryDrink)

    await setRecipe(productId.top, ingredientIds.ingReportA, 1)
    await setRecipe(productId.mid, ingredientIds.ingReportA, 1)
    await setRecipe(productId.drink, ingredientIds.ingReportB, 1)
    await setRecipe(productId.zero, ingredientIds.ingReportA, 1)
    await setRecipe(productId.oos, ingredientIds.ingReportC, 1)

    const createBranch = async (name: string): Promise<string> => {
      const res = await http()
        .post('/v1/branches')
        .set(...auth(superToken))
        .send({ name, addressText: name, latitude: 0, longitude: 0 })
        .expect(201)
      await http()
        .put(`/v1/branches/${res.body.id}/hours`)
        .set(...auth(superToken))
        .send({ hours: openHours })
        .expect(200)
      return res.body.id as string
    }

    branchA = await createBranch('Centro Rep')
    branchB = await createBranch('Lejano Rep')

    await setStock(branchA, ingredientIds.ingReportA, 1000)
    await setStock(branchA, ingredientIds.ingReportB, 1000)
    await setStock(branchA, ingredientIds.ingReportC, 0)
    await setStock(branchB, ingredientIds.ingReportA, 1000)
    await setStock(branchB, ingredientIds.ingReportB, 1000)
    await setStock(branchB, ingredientIds.ingReportC, 50)

    await seedOrder({
      number: 'A1',
      branchId: branchA,
      status: 'delivered',
      total: 300,
      createdAt: ORDER_DATE,
      items: [{ productId: productId.top, name: P_TOP.name, unitPrice: 100, quantity: 3 }],
    })
    await seedOrder({
      number: 'A2',
      branchId: branchA,
      status: 'delivered',
      total: 200,
      createdAt: ORDER_DATE,
      items: [{ productId: productId.mid, name: P_MID.name, unitPrice: 200, quantity: 1 }],
    })
    await seedOrder({
      number: 'A3',
      branchId: branchA,
      status: 'cancelled',
      total: 500,
      createdAt: ORDER_DATE,
      items: [{ productId: productId.top, name: P_TOP.name, unitPrice: 100, quantity: 5 }],
    })
    await seedOrder({
      number: 'B1',
      branchId: branchB,
      status: 'delivered',
      total: 1000,
      createdAt: ORDER_DATE,
      items: [{ productId: productId.top, name: P_TOP.name, unitPrice: 100, quantity: 10 }],
    })
    await seedOrder({
      number: 'B2',
      branchId: branchB,
      status: 'delivered',
      total: 150,
      createdAt: ORDER_DATE,
      items: [{ productId: productId.drink, name: P_DRINK.name, unitPrice: 50, quantity: 3 }],
    })
    await seedOrder({
      number: 'OLD',
      branchId: branchA,
      status: 'delivered',
      total: 1400,
      createdAt: OLD_ORDER_DATE,
      items: [{ productId: productId.mid, name: P_MID.name, unitPrice: 200, quantity: 7 }],
    })
    await seedOrder({
      number: 'NOW',
      branchId: branchA,
      status: 'delivered',
      total: 50,
      createdAt: new Date(),
      items: [{ productId: productId.drink, name: P_DRINK.name, unitPrice: 50, quantity: 1 }],
    })
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('A. Seguridad y validación', () => {
    const endpoints = [
      '/v1/reporting/overview',
      '/v1/reporting/products/best-sellers',
      '/v1/reporting/products/least-sold',
      '/v1/reporting/products/highest-revenue',
      '/v1/reporting/products/out-of-stock',
    ]

    it('A1: sin token → 401 UNAUTHENTICATED en todos los endpoints', async () => {
      for (const endpoint of endpoints) {
        const res = await http().get(endpoint).expect(401)
        expect(res.body.code).toBe('UNAUTHENTICATED')
      }
    })

    it.each([
      { role: 'customer', token: customerToken('cust-rep') },
      { role: 'rider', token: riderToken },
    ])('A2: $role → 403 FORBIDDEN en todos los endpoints', async ({ token }) => {
      for (const endpoint of endpoints) {
        const res = await http()
          .get(endpoint)
          .set(...auth(token))
          .expect(403)
        expect(res.body.code).toBe('FORBIDDEN')
      }
    })

    it('A3: branch_admin sin branchId en el token → 403 en todos los endpoints', async () => {
      const token = jwt.sign({ userId: 'b1', roles: ['branch_admin'] }, env.jwtSecret)
      for (const endpoint of endpoints) {
        const res = await http()
          .get(endpoint)
          .set(...auth(token))
          .expect(403)
        expect(res.body.code).toBe('FORBIDDEN')
      }
    })

    it('A4: overview con rango invertido → 400 VALIDATION_ERROR', async () => {
      const res = await report(
        'overview',
        '?from=2026-02-01T00:00:00.000Z&to=2026-01-01T00:00:00.000Z',
        superToken,
      ).expect(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it.each([
      { name: 'from no ISO', query: '?from=ayer' },
      { name: 'status inválido', query: '?status=shipped' },
      { name: 'groupBy inválido', query: '?groupBy=year' },
    ])('A5: best-sellers con $name → 400 VALIDATION_ERROR', async ({ query }) => {
      const res = await report('products/best-sellers', query, superToken).expect(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('B. Productos más vendidos (RQ-REP-01)', () => {
    const rangeQuery = `?from=${RANGE_FROM}&to=${RANGE_TO}`

    it('B1: ranking global por cantidad desc y revenue nulo', async () => {
      const res = await report('products/best-sellers', rangeQuery, superToken).expect(200)
      const rows = res.body as ProductReportRow[]

      expect(productIds(rows)).toEqual([productId.top, productId.drink, productId.mid])
      expect(positions(rows)).toEqual([1, 2, 3])
      expect(rows.map((row) => row.quantity)).toEqual([13, 3, 1])
      expect(rows.every((row) => row.revenue === null)).toBe(true)
      expect(rows[0].product.name).toBe(P_TOP.name)
      expect(rows[0].category?.id).toBe(categoryBurger)
    })

    it('B2: filtra por branchId', async () => {
      const res = await report(
        'products/best-sellers',
        `${rangeQuery}&branchId=${branchA}`,
        superToken,
      ).expect(200)
      const rows = res.body as ProductReportRow[]

      expect(productIds(rows)).toEqual([productId.top, productId.mid])
      expect(rows.map((row) => row.quantity)).toEqual([3, 1])
    })

    it('B3: filtra por categoryId', async () => {
      const res = await report(
        'products/best-sellers',
        `${rangeQuery}&categoryId=${categoryDrink}`,
        superToken,
      ).expect(200)
      const rows = res.body as ProductReportRow[]

      expect(productIds(rows)).toEqual([productId.drink])
      expect(rows[0].quantity).toBe(3)
    })

    it('B4: el rango de fechas excluye pedidos fuera del período', async () => {
      const res = await report(
        'products/best-sellers',
        '?from=2099-01-01T00:00:00.000Z&to=2099-01-31T23:59:59.999Z',
        superToken,
      ).expect(200)
      expect(res.body).toEqual([])
    })

    it('B5: status=cancelled sólo cuenta pedidos cancelados', async () => {
      const res = await report(
        'products/best-sellers',
        `${rangeQuery}&status=cancelled`,
        superToken,
      ).expect(200)
      const rows = res.body as ProductReportRow[]

      expect(productIds(rows)).toEqual([productId.top])
      expect(rows[0].quantity).toBe(5)
    })

    it('B6: branch_admin queda forzado a su sucursal aunque pida otra', async () => {
      const res = await report(
        'products/best-sellers',
        `${rangeQuery}&branchId=${branchB}`,
        branchAdminTokenFor(branchA),
      ).expect(200)
      const rows = res.body as ProductReportRow[]

      expect(productIds(rows)).toEqual([productId.top, productId.mid])
      expect(rows.map((row) => row.quantity)).toEqual([3, 1])
    })

    it('B7: limit recorta el ranking y renumera posiciones', async () => {
      const res = await report('products/best-sellers', `${rangeQuery}&limit=1`, superToken).expect(
        200,
      )
      const rows = res.body as ProductReportRow[]

      expect(rows).toHaveLength(1)
      expect(productIds(rows)).toEqual([productId.top])
      expect(positions(rows)).toEqual([1])
    })
  })

  describe('C. Productos menos vendidos (RQ-REP-02)', () => {
    const rangeQuery = `?from=${RANGE_FROM}&to=${RANGE_TO}`

    it('C1: incluye productos con 0 ventas y ordena por cantidad ascendente', async () => {
      const res = await report('products/least-sold', rangeQuery, superToken).expect(200)
      const rows = res.body as ProductReportRow[]

      expect(productIds(rows)).toEqual([
        productId.zero,
        productId.oos,
        productId.mid,
        productId.drink,
        productId.top,
      ])
      expect(rows.map((row) => row.quantity)).toEqual([0, 0, 1, 3, 13])
      expect(rows.every((row) => row.revenue === null)).toBe(true)
      expect(positions(rows)).toEqual([1, 2, 3, 4, 5])
    })

    it('C2: filtra por branchId', async () => {
      const res = await report(
        'products/least-sold',
        `${rangeQuery}&branchId=${branchA}`,
        superToken,
      ).expect(200)
      const rows = res.body as ProductReportRow[]

      expect(productIds(rows)).toEqual([
        productId.drink,
        productId.zero,
        productId.oos,
        productId.mid,
        productId.top,
      ])
      expect(rows.map((row) => row.quantity)).toEqual([0, 0, 0, 1, 3])
    })

    it('C3: categoryId filtra el catálogo base de least-sold', async () => {
      const res = await report(
        'products/least-sold',
        `${rangeQuery}&categoryId=${categoryDrink}`,
        superToken,
      ).expect(200)
      const rows = res.body as ProductReportRow[]

      expect(productIds(rows)).toEqual([productId.oos, productId.drink])
      expect(rows.map((row) => row.quantity)).toEqual([0, 3])
    })

    it('C4: sin ventas en el período lista todo el catálogo con cantidad 0', async () => {
      const res = await report(
        'products/least-sold',
        '?from=2099-01-01T00:00:00.000Z&to=2099-01-31T23:59:59.999Z',
        superToken,
      ).expect(200)
      const rows = res.body as ProductReportRow[]

      expect(rows).toHaveLength(5)
      expect(rows.every((row) => row.quantity === 0)).toBe(true)
    })

    it('C5: branch_admin queda forzado a su sucursal', async () => {
      const res = await report(
        'products/least-sold',
        `${rangeQuery}&branchId=${branchB}`,
        branchAdminTokenFor(branchA),
      ).expect(200)
      const rows = res.body as ProductReportRow[]

      expect(rows.map((row) => row.quantity)).toEqual([0, 0, 0, 1, 3])
    })
  })

  describe('D. Mayor facturación (RQ-REP-04)', () => {
    const rangeQuery = `?from=${RANGE_FROM}&to=${RANGE_TO}`

    it('D1: ordena por ingreso desc, excluye sin facturación y quantity nulo', async () => {
      const res = await report('products/highest-revenue', rangeQuery, superToken).expect(200)
      const rows = res.body as ProductReportRow[]

      expect(productIds(rows)).toEqual([productId.top, productId.mid, productId.drink])
      expect(rows.map((row) => row.revenue)).toEqual([1300, 200, 150])
      expect(rows.every((row) => row.quantity === null)).toBe(true)
      expect(positions(rows)).toEqual([1, 2, 3])
    })

    it('D2: filtra por branchId', async () => {
      const res = await report(
        'products/highest-revenue',
        `${rangeQuery}&branchId=${branchA}`,
        superToken,
      ).expect(200)
      const rows = res.body as ProductReportRow[]

      expect(productIds(rows)).toEqual([productId.top, productId.mid])
      expect(rows.map((row) => row.revenue)).toEqual([300, 200])
    })

    it('D3: filtra por categoryId', async () => {
      const res = await report(
        'products/highest-revenue',
        `${rangeQuery}&categoryId=${categoryDrink}`,
        superToken,
      ).expect(200)
      const rows = res.body as ProductReportRow[]

      expect(productIds(rows)).toEqual([productId.drink])
      expect(rows[0].revenue).toBe(150)
    })

    it('D4: sin datos en el período devuelve lista vacía', async () => {
      const res = await report(
        'products/highest-revenue',
        '?from=2099-01-01T00:00:00.000Z&to=2099-01-31T23:59:59.999Z',
        superToken,
      ).expect(200)
      expect(res.body).toEqual([])
    })

    it('D5: branch_admin queda forzado a su sucursal', async () => {
      const res = await report(
        'products/highest-revenue',
        `${rangeQuery}&branchId=${branchB}`,
        branchAdminTokenFor(branchA),
      ).expect(200)
      const rows = res.body as ProductReportRow[]

      expect(rows.map((row) => row.revenue)).toEqual([300, 200])
    })
  })

  describe('E. Overview (RQ-REP-07/08/09/11)', () => {
    const rangeQuery = `?from=${RANGE_FROM}&to=${RANGE_TO}`

    const statusCount = (body: OverviewBody, status: string): number =>
      body.ordersByStatus.find((row) => row.status === status)?.count ?? 0

    it('E1: calcula KPIs, series, estados, top products y sucursales', async () => {
      const res = await report('overview', rangeQuery, superToken).expect(200)
      const body = res.body as OverviewBody

      expect(body.period).toEqual({ from: RANGE_FROM, to: RANGE_TO })
      expect(body.kpis).toMatchObject({
        totalRevenue: 1650,
        totalOrders: 4,
        averageTicket: 412.5,
        cancelledOrders: 1,
      })
      expect(body.kpis.bestSellingProduct).toMatchObject({
        productId: productId.top,
        name: P_TOP.name,
        quantity: 13,
        revenue: 1300,
      })
      expect(body.kpis.topBranch).toMatchObject({
        branchId: branchB,
        branchName: 'Lejano Rep',
        revenue: 1150,
        orders: 2,
      })
      expect(body.topProducts.map((row) => row.productId)).toEqual([
        productId.top,
        productId.drink,
        productId.mid,
      ])
      expect(body.branchPerformance.map((row) => row.branchId)).toEqual([branchB, branchA])
      expect(body.ordersByStatus).toHaveLength(7)
      expect(statusCount(body, 'delivered')).toBe(4)
      expect(statusCount(body, 'cancelled')).toBe(1)
      expect(body.salesSeries).toEqual([{ bucket: '2026-01-15', revenue: 1650, orders: 4 }])
      expect(body.variation).toEqual({
        revenuePct: null,
        ordersPct: null,
        averageTicketPct: null,
      })
    })

    it('E2: filtra por branchId', async () => {
      const res = await report('overview', `${rangeQuery}&branchId=${branchA}`, superToken).expect(
        200,
      )
      const body = res.body as OverviewBody

      expect(body.kpis).toMatchObject({
        totalRevenue: 500,
        totalOrders: 2,
        averageTicket: 250,
        cancelledOrders: 1,
      })
      expect(body.kpis.bestSellingProduct).toMatchObject({ productId: productId.top, quantity: 3 })
      expect(body.kpis.topBranch).toMatchObject({
        branchId: branchA,
        branchName: 'Centro Rep',
        revenue: 500,
        orders: 2,
      })
      expect(body.branchPerformance).toHaveLength(1)
      expect(body.salesSeries).toEqual([{ bucket: '2026-01-15', revenue: 500, orders: 2 }])
    })

    it('E3: branch_admin sin branchId usa el de su token', async () => {
      const res = await report('overview', rangeQuery, branchAdminTokenFor(branchA)).expect(200)
      const body = res.body as OverviewBody

      expect(body.kpis.totalRevenue).toBe(500)
      expect(body.kpis.totalOrders).toBe(2)
      expect(body.branchPerformance.map((row) => row.branchId)).toEqual([branchA])
    })

    it('E4: branch_admin queda forzado a su sucursal aunque pida otra', async () => {
      const res = await report(
        'overview',
        `${rangeQuery}&branchId=${branchB}`,
        branchAdminTokenFor(branchA),
      ).expect(200)
      const body = res.body as OverviewBody

      expect(body.kpis.totalRevenue).toBe(500)
      expect(body.branchPerformance.map((row) => row.branchId)).toEqual([branchA])
    })

    it('E5: sin from/to usa el rango por defecto de 30 días', async () => {
      const res = await report('overview', '', superToken).expect(200)
      const body = res.body as OverviewBody

      const from = new Date(body.period.from)
      const to = new Date(body.period.to)
      expect(to.getTime() - from.getTime()).toBe(30 * 24 * 60 * 60 * 1000)
      expect(body.kpis.totalOrders).toBeGreaterThanOrEqual(1)
      expect(body.kpis.totalRevenue).toBeGreaterThanOrEqual(50)
    })

    it('E6: agrupa la serie por mes', async () => {
      const res = await report('overview', `${rangeQuery}&groupBy=month`, superToken).expect(200)
      const body = res.body as OverviewBody

      expect(body.salesSeries).toEqual([{ bucket: '2026-01', revenue: 1650, orders: 4 }])
    })
  })

  describe('F. Productos sin stock — rama por rol y filtros (RQ-REP-03/06)', () => {
    it('F1: super_admin filtra por sucursal (A sin stock, B con stock)', async () => {
      const inA = await report('products/out-of-stock', `?branchId=${branchA}`, superToken).expect(
        200,
      )
      const rowsA = inA.body as OutOfStockRow[]
      const row = rowsA.find((entry) => entry.product.id === productId.oos)
      expect(row?.quantity).toBe(0)

      const inB = await report('products/out-of-stock', `?branchId=${branchB}`, superToken).expect(
        200,
      )
      expect(productIds(inB.body as OutOfStockRow[])).not.toContain(productId.oos)
    })

    it('F2: branch_admin sin query usa su sucursal', async () => {
      const res = await report('products/out-of-stock', '', branchAdminTokenFor(branchA)).expect(
        200,
      )
      expect(productIds(res.body as OutOfStockRow[])).toContain(productId.oos)
    })

    it('F3: branch_admin queda forzado a su sucursal aunque pida otra', async () => {
      const res = await report(
        'products/out-of-stock',
        `?branchId=${branchB}`,
        branchAdminTokenFor(branchA),
      ).expect(200)
      expect(productIds(res.body as OutOfStockRow[])).toContain(productId.oos)
    })
  })
})
