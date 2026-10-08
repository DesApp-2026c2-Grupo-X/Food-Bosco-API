import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { env } from '../src/config/env'
import {
  createDownstreamMock,
  DownstreamCall,
  DownstreamMock,
  errorResponse,
  okResponse,
} from './downstream'

const rider = {
  id: 'u-rider',
  email: 'repartidor@foodbosco.local',
  role: 'rider',
  firstName: 'Marcos',
  lastName: 'Peralta',
  phone: '3333333333',
  vehicle: 'Moto Honda CG Titan',
}

const customer = {
  id: 'u-customer',
  email: 'cliente@foodbosco.local',
  role: 'customer',
  firstName: 'Cliente',
  lastName: 'Demo',
  phone: '1111111111',
  vehicle: null,
}

const address = {
  userId: 'u-customer',
  id: 'a1',
  label: 'Casa',
  text: 'Av. Vergara 1250',
  latitude: -34.587,
  longitude: -58.634,
}

const branch = { id: 'b1', name: 'Centro' }

const readyOrder = {
  id: 'o-ready',
  number: '000002',
  status: 'ready_for_delivery',
  branchId: 'b1',
  branchLocation: { latitude: -34.589, longitude: -58.636 },
  deliveryAddress: { text: 'Av. Vergara 1250', latitude: -34.587, longitude: -58.634 },
}

const startWith =
  (baseUrl: string) =>
  (call: DownstreamCall): boolean =>
    call.url.startsWith(baseUrl)

const isOrdersCall = (call: DownstreamCall): boolean =>
  Boolean((call.body as { order?: unknown } | undefined)?.order)

describe('Gateway seed (e2e) — POST /seed con InternalGuard', () => {
  let app: INestApplication<App>
  let downstream: DownstreamMock

  beforeAll(async () => {
    downstream = createDownstreamMock(() => undefined)

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
    await app.listen(0)
  })

  afterAll(async () => {
    downstream.restore()
    await app.close()
  })

  beforeEach(() => downstream.reset())

  const seed = (token?: string) => {
    const req = request(app.getHttpServer()).post('/seed')
    if (token !== undefined) req.set('x-internal-token', token)
    return req
  }

  const happyPath = (): void => {
    downstream.setResponder((call) => {
      if (startWith(env.services.commerce)(call)) {
        return isOrdersCall(call)
          ? okResponse({ summary: { branches: 1, orders: 5 }, branches: [], orders: [readyOrder] })
          : okResponse({ summary: { branches: 1 }, branches: [branch] })
      }
      if (startWith(env.services.auth)(call)) {
        return okResponse({
          summary: { users: 5, addresses: 1 },
          users: [customer, rider],
          addresses: [address],
        })
      }
      if (startWith(env.services.delivery)(call)) {
        return okResponse({ summary: { riders: 1, readyOrderId: 'o-ready' } })
      }
      return undefined
    })
  }

  describe('RQ-GW-12: autenticación con x-internal-token', () => {
    it('sin x-internal-token → 401 y no llama a ningún downstream', async () => {
      const res = await seed().expect(401)

      expect(res.body).toEqual({ statusCode: 401, message: 'Unauthorized' })
      expect(downstream.calls).toHaveLength(0)
    })

    it('token incorrecto → 401 y no llama a ningún downstream', async () => {
      const res = await seed('token-invalido').expect(401)

      expect(res.body).toEqual({ statusCode: 401, message: 'Unauthorized' })
      expect(downstream.calls).toHaveLength(0)
    })
  })

  describe('orquestación Commerce → Auth → Commerce(pedidos) → Delivery', () => {
    it('con token válido orquesta en orden y devuelve los resúmenes', async () => {
      happyPath()

      const res = await seed(env.internalApiToken).expect(201)

      expect(res.body).toEqual({
        commerce: { branches: 1 },
        auth: { users: 5, addresses: 1 },
        delivery: { riders: 1, readyOrderId: 'o-ready' },
      })

      expect(downstream.calls).toHaveLength(4)
      expect(downstream.calls.map((call) => call.url)).toEqual([
        expect.stringContaining(env.services.commerce),
        expect.stringContaining(env.services.auth),
        expect.stringContaining(env.services.commerce),
        expect.stringContaining(env.services.delivery),
      ])

      const [commerceCall, authCall, ordersCall, deliveryCall] = downstream.calls
      expect(commerceCall.method).toBe('POST')
      expect(commerceCall.path).toBe('/v1/seed')
      expect(commerceCall.body).toBeUndefined()
      expect(commerceCall.headers['x-internal-token']).toBe(env.internalApiToken)

      expect(authCall.path).toBe('/v1/seed')
      expect(authCall.body).toEqual({ branches: [branch] })
      expect(authCall.headers['x-internal-token']).toBe(env.internalApiToken)

      expect(ordersCall.path).toBe('/v1/seed')
      expect(ordersCall.body).toEqual({
        order: {
          clientId: 'u-customer',
          address: {
            id: 'a1',
            text: 'Av. Vergara 1250',
            latitude: -34.587,
            longitude: -58.634,
          },
        },
      })

      expect(deliveryCall.path).toBe('/v1/seed')
      expect(deliveryCall.body).toEqual({
        userId: 'u-rider',
        firstName: 'Marcos',
        lastName: 'Peralta',
        phone: '3333333333',
        vehicle: 'Moto Honda CG Titan',
        available: true,
        location: { latitude: -34.589, longitude: -58.636 },
        readyOrder: {
          orderId: 'o-ready',
          branchId: 'b1',
          branchLocation: { latitude: -34.589, longitude: -58.636 },
          deliveryAddress: { text: 'Av. Vergara 1250', latitude: -34.587, longitude: -58.634 },
        },
      })
      expect(deliveryCall.headers['x-internal-token']).toBe(env.internalApiToken)
    })

    it('sin rider en Auth siembra pedidos pero no Delivery, con { riders: 0 }', async () => {
      downstream.setResponder((call) => {
        if (startWith(env.services.commerce)(call)) {
          return isOrdersCall(call)
            ? okResponse({
                summary: { branches: 1, orders: 5 },
                branches: [],
                orders: [readyOrder],
              })
            : okResponse({ summary: { branches: 1 }, branches: [branch] })
        }
        if (startWith(env.services.auth)(call)) {
          return okResponse({
            summary: { users: 4, addresses: 1 },
            users: [customer],
            addresses: [address],
          })
        }
        return errorResponse(500, 'UNEXPECTED', 'no debería llamarse', call.path)
      })

      const res = await seed(env.internalApiToken).expect(201)

      expect(res.body).toEqual({
        commerce: { branches: 1 },
        auth: { users: 4, addresses: 1 },
        delivery: { riders: 0 },
      })
      expect(downstream.calls).toHaveLength(3)
      expect(downstream.calls.every((call) => !startWith(env.services.delivery)(call))).toBe(true)
    })

    it('sin sucursales reenvía Auth con branches vacío', async () => {
      downstream.setResponder((call) => {
        if (startWith(env.services.commerce)(call)) {
          return okResponse({ summary: { branches: 0 }, branches: [] })
        }
        if (startWith(env.services.auth)(call)) {
          return okResponse({ summary: { users: 1 }, users: [] })
        }
        return undefined
      })

      await seed(env.internalApiToken).expect(201)

      const authCall = downstream.calls[1]
      expect(authCall.url.startsWith(env.services.auth)).toBe(true)
      expect(authCall.body).toEqual({ branches: [] })
    })
  })

  describe('fallo downstream', () => {
    it('Commerce 500 corta la orquestación con un 500 genérico', async () => {
      downstream.setResponder((call) => {
        if (startWith(env.services.commerce)(call)) {
          return errorResponse(500, 'COMMERCE_DOWN', 'Commerce caído', '/v1/seed')
        }
        return errorResponse(500, 'UNEXPECTED', 'no debería llamarse', call.path)
      })

      const res = await seed(env.internalApiToken).expect(500)

      expect(res.body).toEqual({
        code: 'COMMERCE_DOWN',
        message: 'Commerce caído',
        path: '/v1/seed',
      })
      expect(downstream.calls).toHaveLength(1)
      expect(downstream.calls[0].url.startsWith(env.services.commerce)).toBe(true)
    })

    it('Auth 500 después de Commerce corta la orquestación sin llamar a Delivery', async () => {
      downstream.setResponder((call) => {
        if (startWith(env.services.commerce)(call)) {
          return okResponse({ summary: { branches: 1 }, branches: [branch] })
        }
        if (startWith(env.services.auth)(call)) {
          return errorResponse(500, 'AUTH_DOWN', 'Auth caído', '/v1/seed')
        }
        return errorResponse(500, 'UNEXPECTED', 'no debería llamarse', call.path)
      })

      const res = await seed(env.internalApiToken).expect(500)

      expect(res.body).toEqual({ code: 'AUTH_DOWN', message: 'Auth caído', path: '/v1/seed' })
      expect(downstream.calls).toHaveLength(2)
      expect(downstream.calls.every((call) => !startWith(env.services.delivery)(call))).toBe(true)
    })

    it('Delivery 500 tras el rider propaga el fallo', async () => {
      downstream.setResponder((call) => {
        if (startWith(env.services.commerce)(call)) {
          return isOrdersCall(call)
            ? okResponse({
                summary: { branches: 1, orders: 5 },
                branches: [],
                orders: [readyOrder],
              })
            : okResponse({ summary: { branches: 1 }, branches: [branch] })
        }
        if (startWith(env.services.auth)(call)) {
          return okResponse({
            summary: { users: 5, addresses: 1 },
            users: [customer, rider],
            addresses: [address],
          })
        }
        if (startWith(env.services.delivery)(call)) {
          return errorResponse(500, 'DELIVERY_DOWN', 'Delivery caído', '/v1/seed')
        }
        return undefined
      })

      const res = await seed(env.internalApiToken).expect(500)

      expect(res.body).toEqual({
        code: 'DELIVERY_DOWN',
        message: 'Delivery caído',
        path: '/v1/seed',
      })
      expect(downstream.calls).toHaveLength(4)
    })
  })
})
