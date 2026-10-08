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
}

const address = {
  userId: 'u-customer',
  id: 'a1',
  label: 'Casa',
  text: 'Av. Vergara 1250',
  latitude: -34.587,
  longitude: -58.634,
}

const readyOrder = {
  id: 'o-ready',
  number: '000002',
  status: 'ready_for_delivery',
  branchId: 'b1',
  branchLocation: { latitude: -34.589, longitude: -58.636 },
  deliveryAddress: { text: 'Av. Vergara 1250', latitude: -34.587, longitude: -58.634 },
}

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
  summary: { branches: 1, orders: 0 },
  branches: [{ id: 'b1', name: 'Centro' }],
}
const ordersCommerce = { summary: { branches: 1, orders: 5 }, branches: [], orders: [readyOrder] }

const wireCommerce = (commerce: { post: jest.Mock }) =>
  commerce.post.mockImplementation(
    async (_path: string, options: { body?: { order?: unknown } }) =>
      options?.body?.order ? ordersCommerce : baseCommerce,
  )

describe('Gateway SeedController (RQ-GW-12)', () => {
  it('orquesta commerce → auth → pedidos → delivery y devuelve los resúmenes', async () => {
    const { controller, commerce, auth, delivery } = makeController()
    wireCommerce(commerce)
    auth.post.mockResolvedValue({
      summary: { users: 5, addresses: 2 },
      users: [customer, rider],
      addresses: [address],
    })
    delivery.post.mockResolvedValue({ summary: { riders: 1, readyOrderId: 'o-ready' } })

    const result = await controller.seed()

    expect(commerce.post).toHaveBeenNthCalledWith(
      1,
      '/v1/seed',
      expect.objectContaining({
        context: expect.objectContaining({ internalToken: expect.any(String) }),
      }),
    )
    expect(auth.post).toHaveBeenCalledWith(
      '/v1/seed',
      expect.objectContaining({ body: { branches: [{ id: 'b1', name: 'Centro' }] } }),
    )
    expect(commerce.post).toHaveBeenNthCalledWith(
      2,
      '/v1/seed',
      expect.objectContaining({
        body: {
          order: {
            clientId: 'u-customer',
            address: {
              id: 'a1',
              text: 'Av. Vergara 1250',
              latitude: -34.587,
              longitude: -58.634,
            },
          },
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
          readyOrder: expect.objectContaining({ orderId: 'o-ready', branchId: 'b1' }),
        }),
      }),
    )
    expect(result).toEqual({
      commerce: { branches: 1, orders: 0 },
      auth: { users: 5, addresses: 2 },
      delivery: { riders: 1, readyOrderId: 'o-ready' },
    })
  })

  it('sin customer/dirección no siembra pedidos y no manda readyOrder a delivery', async () => {
    const { controller, commerce, auth, delivery } = makeController()
    wireCommerce(commerce)
    auth.post.mockResolvedValue({ summary: { users: 4 }, users: [rider], addresses: [] })
    delivery.post.mockResolvedValue({ summary: { riders: 1 } })

    await controller.seed()

    expect(commerce.post).toHaveBeenCalledTimes(1)
    expect(delivery.post).toHaveBeenCalledWith(
      '/v1/seed',
      expect.objectContaining({
        body: expect.objectContaining({
          available: true,
          location: undefined,
          readyOrder: undefined,
        }),
      }),
    )
  })

  it('no siembra el perfil de delivery cuando no hay usuario rider', async () => {
    const { controller, commerce, auth, delivery } = makeController()
    wireCommerce(commerce)
    auth.post.mockResolvedValue({
      summary: { users: 3 },
      users: [customer],
      addresses: [address],
    })

    const result = await controller.seed()

    expect(delivery.post).not.toHaveBeenCalled()
    expect(result.delivery).toEqual({ riders: 0 })
  })

  it('sin sucursales reenvía Auth con branches vacío', async () => {
    const { controller, commerce, auth } = makeController()
    commerce.post.mockResolvedValue({ summary: { branches: 0 }, branches: [] })
    auth.post.mockResolvedValue({ summary: { users: 1 }, users: [], addresses: [] })

    await controller.seed()

    expect(auth.post).toHaveBeenCalledWith(
      '/v1/seed',
      expect.objectContaining({ body: { branches: [] } }),
    )
  })
})
