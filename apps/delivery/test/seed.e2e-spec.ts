import { INestApplication } from '@nestjs/common'
import { getConnectionToken, getModelToken } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import mongoose, { Connection, Model } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import type { App } from 'supertest/types'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { createValidationPipe } from '../src/config/validation/validation.pipe'
import { DeliveryOrder, DeliveryOrderDocument } from '../src/delivery-order/delivery-order.model'
import { SeedModule } from '../src/seed/seed.module'
import { createMongoServer } from './mongo'

const branchLocation = { latitude: -34.5899585, longitude: -58.6332502 }

const readyOrder = (orderId: string) => ({
  orderId,
  branchId: 'b-centro',
  branchLocation,
  deliveryAddress: {
    text: 'Germán Argerich 1333, Hurlingham',
    latitude: -34.5918429,
    longitude: -58.6371925,
  },
})

describe('Delivery — seed E2E', () => {
  let mongod: MongoMemoryServer
  let connection: Connection
  let app: INestApplication<App>
  let deliveryOrderModel: Model<DeliveryOrderDocument>

  beforeAll(async () => {
    mongod = await createMongoServer()
    connection = await mongoose.createConnection(mongod.getUri()).asPromise()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SecurityModule, SeedModule],
    })
      .overrideProvider(getConnectionToken())
      .useValue(connection)
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(createValidationPipe())
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.init()
    await app.listen(0)

    deliveryOrderModel = app.get<Model<DeliveryOrderDocument>>(getModelToken(DeliveryOrder.name))
  })

  afterAll(async () => {
    await app.close()
    await connection.close()
    await mongod.stop()
  })

  const seed = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/v1/seed')
      .set('x-internal-token', env.internalApiToken)
      .send(body)

  const baseBody = {
    userId: 'u-rider-1',
    firstName: 'Marcos',
    lastName: 'Peralta',
    phone: '3333333333',
    vehicle: 'Moto Honda CG Titan',
    available: true,
    location: branchLocation,
  }

  it('rechaza sin x-internal-token', async () => {
    await request(app.getHttpServer()).post('/v1/seed').send(baseBody).expect(401)
  })

  it('acepta readyOrders con la dirección de entrega completa', async () => {
    const res = await seed({
      ...baseBody,
      readyOrders: [readyOrder('o-1'), readyOrder('o-2')],
    }).expect(201)

    expect(res.body.rider).toEqual({ id: expect.any(String), userId: 'u-rider-1' })
    expect(res.body.readyOrderIds).toEqual(['o-1', 'o-2'])
    expect(res.body.readyOrderId).toBe('o-1')

    const rows = await deliveryOrderModel.find().sort({ orderId: 1 }).lean().exec()

    expect(rows).toHaveLength(2)
    expect(rows[0].status).toBe('ready')
    expect(rows[0].deliveryAddress.text).toBe('Germán Argerich 1333, Hurlingham')
  })

  it('sigue aceptando el readyOrder singular', async () => {
    const res = await seed({ ...baseBody, readyOrder: readyOrder('o-3') }).expect(201)

    expect(res.body.readyOrderIds).toEqual(['o-3'])
    await expect(deliveryOrderModel.countDocuments().exec()).resolves.toBe(3)
  })

  it('rechaza campos desconocidos dentro de la dirección', async () => {
    const invalid = readyOrder('o-4')

    await seed({
      ...baseBody,
      readyOrders: [
        {
          ...invalid,
          deliveryAddress: { ...invalid.deliveryAddress, extra: 'no permitido' },
        },
      ],
    }).expect(400)
  })
})
