import { BadRequestException } from '@nestjs/common'
import type { RestClient } from '../rest/rest.client'
import { SeedController } from './seed.controller'

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
  addresses: [
    {
      userId: 'u-customer',
      id: 'a1',
      label: 'Casa',
      text: 'Germán Argerich 1333, Hurlingham',
      latitude: -34.5918429,
      longitude: -58.6371925,
    },
  ],
}

const readyOrder = {
  id: 'o-ready',
  number: '000002',
  status: 'ready_for_delivery',
  branchId: 'b1',
  branchLocation: { latitude: -34.589, longitude: -58.636 },
  deliveryAddress: { text: 'Calle 1', latitude: -34.587, longitude: -58.634 },
}

const branch = { id: 'b1', name: 'Centro' }

const makeController = () => {
  const commerce = { post: jest.fn() }
  const auth = { post: jest.fn() }
  const delivery = { post: jest.fn() }
  const controller = new SeedController(
    commerce as unknown as RestClient,
    auth as unknown as RestClient,
    delivery as unknown as RestClient,
  )
  return { controller, commerce, auth, delivery }
}

const baseCommerce = {
  summary: { branches: 1 },
  branches: [branch],
}

const demoCommerce = {
  summary: { branches: 1, orders: 0, demoOrders: 150 },
  branches: [],
  orders: [readyOrder],
  demo: {
    enabled: true,
    batchId: '20261027201511-73',
    seed: 115,
    orders: 150,
    customers: 25,
    resetDeleted: 0,
    outOfStockRows: 2,
  },
}

const wireCommerce = (commerce: { post: jest.Mock }) =>
  commerce.post.mockImplementation(
    async (_path: string, options: { body?: { customers?: unknown } }) =>
      options?.body?.customers ? demoCommerce : baseCommerce,
  )

describe('Gateway SeedController (RQ-GW-12)', () => {
  it('orquesta maestros → clientes → pedidos demo → delivery', async () => {
    const { controller, commerce, auth, delivery } = makeController()
    wireCommerce(commerce)
    auth.post.mockResolvedValue({
      summary: { users: 27, addresses: 30 },
      users: [customer, rider],
      addresses: [],
      customers: [customer],
    })
    delivery.post.mockResolvedValue({ summary: { riders: 1, readyOrderId: 'o-ready' } })

    const result = await controller.seed({})

    expect(commerce.post).toHaveBeenNthCalledWith(
      1,
      '/v1/seed',
      expect.objectContaining({
        context: expect.objectContaining({ internalToken: expect.any(String) }),
      }),
    )
    expect(auth.post).toHaveBeenCalledWith(
      '/v1/seed',
      expect.objectContaining({
        body: { branches: [branch], demoCustomers: true },
      }),
    )
    expect(commerce.post).toHaveBeenNthCalledWith(
      2,
      '/v1/seed',
      expect.objectContaining({
        body: {
          customers: [
            {
              id: 'u-customer',
              addresses: [
                {
                  id: 'a1',
                  text: 'Germán Argerich 1333, Hurlingham',
                  latitude: -34.5918429,
                  longitude: -58.6371925,
                },
              ],
            },
          ],
          demo: {},
        },
      }),
    )
    expect(delivery.post).toHaveBeenCalledWith(
      '/v1/seed',
      expect.objectContaining({
        body: expect.objectContaining({
          userId: 'u-rider',
          available: true,
          location: { latitude: -34.589, longitude: -58.636 },
          readyOrders: [
            {
              orderId: 'o-ready',
              branchId: 'b1',
              branchLocation: { latitude: -34.589, longitude: -58.636 },
              deliveryAddress: { text: 'Calle 1', latitude: -34.587, longitude: -58.634 },
            },
          ],
        }),
      }),
    )
    expect(result).toEqual({
      commerce: baseCommerce.summary,
      auth: { users: 27, addresses: 30 },
      demo: demoCommerce.demo,
      delivery: { riders: 1, readyOrderId: 'o-ready' },
    })
  })

  it('propaga las opciones de demo al seed de pedidos', async () => {
    const { controller, commerce, auth, delivery } = makeController()
    wireCommerce(commerce)
    auth.post.mockResolvedValue({ summary: {}, users: [rider], customers: [customer] })
    delivery.post.mockResolvedValue({ summary: { riders: 1 } })

    await controller.seed({ orders: 300, days: 90, seed: 42, reset: true })

    const [, secondCall] = commerce.post.mock.calls
    expect(secondCall[1].body.demo).toEqual({ orders: 300, days: 90, seed: 42, reset: true })
  })

  it('reenvía la cantidad de clientes demo a auth', async () => {
    const { controller, commerce, auth, delivery } = makeController()
    wireCommerce(commerce)
    auth.post.mockResolvedValue({ summary: {}, users: [rider], customers: [customer] })
    delivery.post.mockResolvedValue({ summary: { riders: 1 } })

    await controller.seed({ clients: 60 })

    expect(auth.post).toHaveBeenCalledWith(
      '/v1/seed',
      expect.objectContaining({
        body: { branches: [branch], demoCustomers: true, demoCustomerCount: 60 },
      }),
    )
  })

  it('con demo=false no genera pedidos ni clientes demo', async () => {
    const { controller, commerce, auth, delivery } = makeController()
    commerce.post.mockResolvedValue(baseCommerce)
    auth.post.mockResolvedValue({ summary: { users: 3 }, users: [customer, rider] })
    delivery.post.mockResolvedValue({ summary: { riders: 1 } })

    const result = await controller.seed({ demo: false })

    expect(commerce.post).toHaveBeenCalledTimes(1)
    expect(auth.post).toHaveBeenCalledWith(
      '/v1/seed',
      expect.objectContaining({ body: { branches: [branch], demoCustomers: false } }),
    )
    expect(delivery.post.mock.calls[0][1].body.readyOrders).toEqual([])
    expect(result.demo).toMatchObject({ enabled: false, orders: 0 })
  })

  it('sin clientes en auth no pide pedidos a commerce', async () => {
    const { controller, commerce, auth, delivery } = makeController()
    commerce.post.mockResolvedValue(baseCommerce)
    auth.post.mockResolvedValue({ summary: { users: 3 }, users: [customer, rider], customers: [] })
    delivery.post.mockResolvedValue({ summary: { riders: 1 } })

    const result = await controller.seed({})

    expect(commerce.post).toHaveBeenCalledTimes(1)
    expect(result.demo).toMatchObject({ enabled: false })
  })

  it('sin usuario rider no llama a delivery', async () => {
    const { controller, commerce, auth, delivery } = makeController()
    wireCommerce(commerce)
    auth.post.mockResolvedValue({
      summary: { users: 25 },
      users: [customer],
      customers: [customer],
    })

    const result = await controller.seed({})

    expect(delivery.post).not.toHaveBeenCalled()
    expect(result.delivery).toEqual({ riders: 0 })
  })

  it.each([
    { name: 'orders negativo', body: { orders: -1 } },
    { name: 'orders excesivo', body: { orders: 5000 } },
    { name: 'days en cero', body: { days: 0 } },
    { name: 'seed no entero', body: { seed: 1.5 } },
    { name: 'clients excesivo', body: { clients: 501 } },
  ])('rechaza opciones inválidas ($name)', async ({ body }) => {
    const { controller } = makeController()

    await expect(controller.seed(body)).rejects.toBeInstanceOf(BadRequestException)
  })
})
