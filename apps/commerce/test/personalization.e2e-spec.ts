import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Connection, Types } from 'mongoose'
import request from 'supertest'
import type { App } from 'supertest/types'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { PersonalizationModule } from '../src/personalization/personalization.module'
import { createMongoServer } from './mongo'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date()

const customerToken = (id: string): string =>
  jwt.sign({ userId: id, roles: ['customer'] }, env.jwtSecret)

const openHours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  opening: '00:00',
  closing: '23:59',
  closed: false,
}))

describe('Commerce — personalización de la home (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let connection: Connection

  const categoryId = new Types.ObjectId()
  const saladCategoryId = new Types.ObjectId()
  const branchId = new Types.ObjectId()

  const burgerId = new Types.ObjectId()
  const burgerAltId = new Types.ObjectId()
  const saladId = new Types.ObjectId()
  const pausedId = new Types.ObjectId()
  const foreignId = new Types.ObjectId()

  const ownOrderId = new Types.ObjectId()
  const foreignOrderId = new Types.ObjectId()

  const auth = (token: string): [string, string] => ['Authorization', `Bearer ${token}`]
  const http = () => request(app.getHttpServer())

  beforeAll(async () => {
    mongod = await createMongoServer()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongod.getUri()), SecurityModule, PersonalizationModule],
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

    connection = app.get<Connection>(getConnectionToken())

    await connection.collection('categories').insertMany([
      { _id: categoryId, name: 'Hamburguesas', active: true, createdAt: NOW, updatedAt: NOW },
      { _id: saladCategoryId, name: 'Ensaladas', active: true, createdAt: NOW, updatedAt: NOW },
    ])

    await connection.collection('branches').insertOne({
      _id: branchId,
      name: 'Centro',
      addressText: 'Av 1',
      latitude: 0,
      longitude: 0,
      phone: null,
      active: true,
      hours: openHours,
      createdAt: NOW,
      updatedAt: NOW,
    })

    const product = (
      id: Types.ObjectId,
      category: Types.ObjectId,
      name: string,
      available = true,
    ) => ({
      _id: id,
      categoryId: category.toString(),
      name,
      description: name,
      price: 100,
      image: null,
      available,
      configGroups: [],
      recipe: [],
      createdAt: NOW,
      updatedAt: NOW,
    })

    await connection
      .collection('products')
      .insertMany([
        product(burgerId, categoryId, 'Burger clásica'),
        product(burgerAltId, categoryId, 'Burger doble'),
        product(saladId, saladCategoryId, 'Ensalada'),
        product(pausedId, categoryId, 'Burger pausada', false),
        product(foreignId, saladCategoryId, 'Ensalada ajena'),
      ])

    const deliveredOrder = (
      id: Types.ObjectId,
      number: string,
      clientId: string,
      productId: Types.ObjectId,
      productName: string,
    ) => ({
      _id: id,
      number,
      clientId,
      branchId: branchId.toString(),
      addressId: 'address-1',
      deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
      status: 'delivered',
      subtotal: 200,
      discountTotal: 0,
      total: 200,
      promotionCode: null,
      appliedPromotions: [],
      estimatedDeliveryAt: null,
      riderId: null,
      tripId: null,
      items: [
        {
          productId: productId.toString(),
          name: productName,
          unitPrice: 100,
          quantity: 2,
          observations: null,
          subtotal: 200,
          options: [],
        },
      ],
      statusHistory: [
        {
          previousStatus: 'on_the_way',
          newStatus: 'delivered',
          changedAt: new Date(NOW.getTime() - DAY_MS),
        },
      ],
      createdAt: new Date(NOW.getTime() - DAY_MS),
      updatedAt: NOW,
    })

    await connection
      .collection('orders')
      .insertMany([
        deliveredOrder(ownOrderId, '0001', 'customer-1', burgerId, 'Burger clásica'),
        deliveredOrder(foreignOrderId, '0002', 'customer-2', foreignId, 'Ensalada ajena'),
      ])

    await connection.collection('promotions').insertMany([
      {
        _id: new Types.ObjectId(),
        name: '2x1 burgers',
        description: null,
        startDate: new Date(NOW.getTime() - DAY_MS),
        endDate: new Date(NOW.getTime() + DAY_MS),
        active: true,
        type: 'BUY_X_GET_Y',
        discountValue: null,
        maxDiscount: null,
        buyQuantity: 2,
        payQuantity: 1,
        scope: 'CATEGORY',
        categoryIds: [categoryId.toString()],
        productIds: [],
        branchIds: [],
        minSubtotal: 0,
        minQuantity: 0,
        daysOfWeek: [],
        startTime: null,
        endTime: null,
        code: null,
        stackable: false,
        priority: 5,
        maxUsesTotal: null,
        maxUsesPerCustomer: null,
        usedCount: 0,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        _id: new Types.ObjectId(),
        name: 'Promo vencida',
        description: null,
        startDate: new Date(NOW.getTime() - 10 * DAY_MS),
        endDate: new Date(NOW.getTime() - DAY_MS),
        active: true,
        type: null,
        categoryIds: [],
        productIds: [],
        branchIds: [],
        priority: 0,
        usedCount: 0,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ])
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  it('devuelve secciones personalizadas y sólo los pedidos del cliente autenticado', async () => {
    const res = await http()
      .get('/v1/personalization/home-feed')
      .query({ lat: 0, lng: 0 })
      .set(...auth(customerToken('customer-1')))
      .expect(200)

    expect(res.body.hasHistory).toBe(true)
    expect(res.body.topCategory.id).toBe(categoryId.toString())
    expect(res.body.favoriteBranch.id).toBe(branchId.toString())
    expect(res.body.nearestBranch.distanceMeters).toBe(0)

    const forYouIds = res.body.forYou.map((entry: { product: { id: string } }) => entry.product.id)
    expect(forYouIds).toContain(burgerId.toString())
    expect(forYouIds).not.toContain(pausedId.toString())

    const discoveryIds = res.body.discovery.map(
      (entry: { product: { id: string } }) => entry.product.id,
    )
    expect(discoveryIds).toContain(saladId.toString())

    expect(res.body.reorder).toHaveLength(1)
    expect(res.body.reorder[0].id).toBe(ownOrderId.toString())
    expect(res.body.reorder[0].status).toBe('delivered')
    expect(res.body.reorder[0].branch.id).toBe(branchId.toString())
    expect(res.body.reorder[0].items).toEqual([
      { productId: burgerId.toString(), name: 'Burger clásica', quantity: 2 },
    ])

    expect(res.body.promotions.map((promotion: { name: string }) => promotion.name)).toEqual([
      '2x1 burgers',
    ])
    expect(res.body.promotions[0].categoryIds).toEqual([categoryId.toString()])
  })

  it('un request anónimo recibe la home pública sin secciones personales', async () => {
    const res = await http()
      .get('/v1/personalization/home-feed')
      .query({ lat: 0, lng: 0 })
      .expect(200)

    expect(res.body.hasHistory).toBe(false)
    expect(res.body.forYou).toEqual([])
    expect(res.body.discovery).toEqual([])
    expect(res.body.reorder).toEqual([])
    expect(res.body.favoriteBranch).toBeNull()
    expect(res.body.categories).toHaveLength(2)
    expect(res.body.promotions).toHaveLength(1)
    expect(res.body.nearestBranch.branch.id).toBe(branchId.toString())
  })

  it('sin coordenadas no hay sucursal cercana y el feed sigue funcionando', async () => {
    const res = await http()
      .get('/v1/personalization/home-feed')
      .set(...auth(customerToken('customer-1')))
      .expect(200)

    expect(res.body.nearestBranch).toBeNull()
    expect(res.body.reorder).toHaveLength(1)
  })

  it('rechaza coordenadas incompletas', async () => {
    const res = await http().get('/v1/personalization/home-feed').query({ lat: 0 }).expect(400)

    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('respeta el límite pedido para las secciones', async () => {
    const res = await http()
      .get('/v1/personalization/home-feed')
      .query({ forYouLimit: 1, discoveryLimit: 1, reorderLimit: 1 })
      .set(...auth(customerToken('customer-1')))
      .expect(200)

    expect(res.body.forYou).toHaveLength(1)
    expect(res.body.discovery).toHaveLength(1)
    expect(res.body.reorder).toHaveLength(1)
  })

  it('no mezcla pedidos entre clientes', async () => {
    const res = await http()
      .get('/v1/personalization/home-feed')
      .set(...auth(customerToken('customer-2')))
      .expect(200)

    const reorderIds = res.body.reorder.map((entry: { id: string }) => entry.id)
    expect(reorderIds).toEqual([foreignOrderId.toString()])
    expect(reorderIds).not.toContain(ownOrderId.toString())
  })
})
