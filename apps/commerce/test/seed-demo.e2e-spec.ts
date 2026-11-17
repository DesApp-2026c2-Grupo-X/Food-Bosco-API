import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getConnectionToken, getModelToken } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import mongoose, { Connection, Model } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import type { App } from 'supertest/types'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { Order, OrderDocument } from '../src/order/order.model'
import { OrderReview, OrderReviewDocument } from '../src/order-review/order-review.model'
import { OrderReviewModule } from '../src/order-review/order-review.module'
import { ReportingModule } from '../src/reporting/reporting.module'
import { SeedModule } from '../src/seed/seed.module'
import { createMongoServer } from './mongo'

const DAY_MS = 86_400_000

const superToken = jwt.sign({ userId: 'admin-1', roles: ['super_admin'] }, env.jwtSecret)

const customers = [
  {
    id: 'c-centro',
    addresses: [
      {
        id: 'a-centro',
        text: 'Germán Argerich 1333, Hurlingham',
        latitude: -34.5918429,
        longitude: -58.6371925,
      },
    ],
  },
  {
    id: 'c-norte',
    addresses: [
      {
        id: 'a-norte',
        text: 'Félix Frías 3259, Villa Tesei',
        latitude: -34.6091317,
        longitude: -58.6432517,
      },
    ],
  },
  {
    id: 'c-oeste',
    addresses: [
      {
        id: 'a-oeste',
        text: 'Avenida Rivadavia 18500, Morón',
        latitude: -34.6492342,
        longitude: -58.6240339,
      },
    ],
  },
]

describe('Commerce — seed demo E2E (reportes)', () => {
  let mongod: MongoMemoryServer
  let connection: Connection
  let app: INestApplication<App>
  let orderModel: Model<OrderDocument>
  let reviewModel: Model<OrderReviewDocument>

  beforeAll(async () => {
    mongod = await createMongoServer()
    connection = await mongoose.createConnection(mongod.getUri()).asPromise()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SecurityModule, ReportingModule, OrderReviewModule, SeedModule],
    })
      .overrideProvider(getConnectionToken())
      .useValue(connection)
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

    orderModel = app.get<Model<OrderDocument>>(getModelToken(Order.name))
    reviewModel = app.get<Model<OrderReviewDocument>>(getModelToken(OrderReview.name))
  })

  afterAll(async () => {
    await app.close()
    await connection.close()
    await mongod.stop()
  })

  const seed = (body: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/v1/seed')
      .set('x-internal-token', env.internalApiToken)
      .send(body)

  const overview = () =>
    request(app.getHttpServer())
      .get('/v1/reporting/overview')
      .set('Authorization', `Bearer ${superToken}`)

  it('el seed de maestros solo no crea pedidos', async () => {
    const res = await seed().expect(201)

    expect(res.body.summary.demoOrders).toBe(0)
    expect(res.body.demo.enabled).toBe(false)
    await expect(orderModel.countDocuments().exec()).resolves.toBe(0)
  })

  it('genera un lote histórico que alimenta todos los reportes y calificaciones', async () => {
    const res = await seed({
      customers,
      riderIds: ['rider-1', 'rider-2'],
      demo: { orders: 80, days: 60, seed: 123 },
    }).expect(201)

    expect(res.body.demo).toMatchObject({
      enabled: true,
      orders: 80,
      customers: 3,
      seed: 123,
      outOfStockRows: 2,
    })
    expect(res.body.demo.reviews).toBeGreaterThan(0)
    expect(res.body.summary.demoOrders).toBe(80)

    const docs = await orderModel.find().lean().exec()

    expect(docs).toHaveLength(80)
    expect(docs.every((doc) => typeof doc.demoBatchId === 'string')).toBe(true)
    expect(docs.every((doc) => doc.items.length > 0 && doc.total > 0)).toBe(true)
    expect(new Set(docs.map((doc) => doc.status)).size).toBe(7)
    expect(docs.some((doc) => doc.status === 'delivered' && doc.riderId !== null)).toBe(true)

    const reviewCount = await reviewModel.countDocuments().exec()
    expect(reviewCount).toBe(res.body.demo.reviews)

    const timestamps = docs.map((doc) => doc.createdAt.getTime())
    expect(Math.max(...timestamps) - Math.min(...timestamps)).toBeGreaterThan(30 * DAY_MS)
    expect(Math.max(...timestamps)).toBeLessThanOrEqual(Date.now())

    const report = await overview().expect(200)

    expect(report.body.kpis.totalOrders).toBeGreaterThan(0)
    expect(report.body.kpis.totalRevenue).toBeGreaterThan(0)
    expect(report.body.kpis.averageTicket).toBeGreaterThan(0)
    expect(report.body.kpis.cancelledOrders).toBeGreaterThan(0)
    expect(report.body.variation.revenuePct).not.toBeNull()
    expect(report.body.salesSeries.length).toBeGreaterThan(5)
    expect(report.body.branchPerformance).toHaveLength(3)
    expect(report.body.topProducts.length).toBeGreaterThan(3)
    expect(
      (report.body.ordersByStatus as { count: number }[]).filter((row) => row.count > 0),
    ).toHaveLength(7)

    const reviewsSummary = await request(app.getHttpServer())
      .get('/v1/reviews/summary')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200)
    expect(reviewsSummary.body.branchAverageRating).toBeGreaterThan(0)
    expect(reviewsSummary.body.branchReviews).toBeGreaterThan(0)
    expect(reviewsSummary.body.courierAverageRating).toBeGreaterThan(0)
    expect(reviewsSummary.body.courierReviews).toBeGreaterThan(0)

    const branchesRanking = await request(app.getHttpServer())
      .get('/v1/reviews/branches/ranking')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200)
    expect(branchesRanking.body.length).toBeGreaterThan(0)

    const couriersRanking = await request(app.getHttpServer())
      .get('/v1/reviews/couriers/ranking')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200)
    expect(couriersRanking.body.length).toBe(2)
  })

  it('el reporte de productos sin stock devuelve las filas agotadas', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/reporting/products/out-of-stock')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200)

    expect((res.body as unknown[]).length).toBeGreaterThan(0)
  })

  it('reset borra sólo los lotes demo previos y sus reseñas', async () => {
    const realOrder = await orderModel.create({
      number: '999999',
      clientId: 'cliente-real',
      branchId: 'branch-real',
      addressId: 'address-real',
      deliveryAddress: { text: 'Calle Real 123', latitude: -34.6, longitude: -58.63 },
      status: 'delivered',
      total: 12345,
      estimatedDeliveryAt: null,
      items: [],
      statusHistory: [],
    })
    await reviewModel.create({
      orderId: realOrder._id.toString(),
      customerId: 'cliente-real',
      branchId: 'branch-real',
      branchRating: 5,
      branchComment: 'Reseña real',
    })

    const res = await seed({
      customers,
      riderIds: ['rider-1'],
      demo: { orders: 10, seed: 5, reset: true },
    }).expect(201)

    expect(res.body.demo).toMatchObject({ enabled: true, orders: 10, resetDeleted: 80 })

    const docs = await orderModel.find().lean().exec()
    expect(docs).toHaveLength(11)
    expect(docs.filter((doc) => doc.demoBatchId !== null)).toHaveLength(10)
    expect(docs.some((doc) => doc.number === '999999')).toBe(true)

    const reviews = await reviewModel.find().lean().exec()
    expect(reviews).toHaveLength(1 + (res.body.demo.reviews as number))
    expect(reviews.some((review) => review.orderId === realOrder._id.toString())).toBe(true)
  })
})
