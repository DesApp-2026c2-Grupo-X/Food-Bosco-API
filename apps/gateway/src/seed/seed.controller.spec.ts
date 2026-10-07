import type { RestClient } from '../rest/rest.client'
import { SeedController } from './seed.controller'

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

const rider = {
  id: 'u-rider',
  email: 'repartidor@foodbosco.local',
  role: 'rider',
  firstName: 'Marcos',
  lastName: 'Peralta',
  phone: '3333333333',
  vehicle: 'Moto Honda CG Titan',
}

describe('Gateway SeedController (RQ-GW-12)', () => {
  it('orquesta commerce → auth → delivery y devuelve los resúmenes', async () => {
    const { controller, commerce, auth, delivery } = makeController()
    commerce.post.mockResolvedValue({
      summary: { branches: 1 },
      branches: [{ id: 'b1', name: 'Centro' }],
    })
    auth.post.mockResolvedValue({ summary: { users: 4 }, users: [rider] })
    delivery.post.mockResolvedValue({ summary: { riders: 1 } })

    const result = await controller.seed()

    expect(commerce.post).toHaveBeenCalledWith(
      '/v1/seed',
      expect.objectContaining({
        context: expect.objectContaining({ internalToken: expect.any(String) }),
      }),
    )
    expect(auth.post).toHaveBeenCalledWith(
      '/v1/seed',
      expect.objectContaining({ body: { branchId: 'b1' } }),
    )
    expect(delivery.post).toHaveBeenCalledWith(
      '/v1/seed',
      expect.objectContaining({
        body: {
          userId: 'u-rider',
          firstName: 'Marcos',
          lastName: 'Peralta',
          phone: '3333333333',
          vehicle: 'Moto Honda CG Titan',
        },
      }),
    )
    expect(result).toEqual({
      commerce: { branches: 1 },
      auth: { users: 4 },
      delivery: { riders: 1 },
    })
  })

  it('no siembra el perfil de delivery cuando no hay usuario rider', async () => {
    const { controller, commerce, auth, delivery } = makeController()
    commerce.post.mockResolvedValue({
      summary: { branches: 1 },
      branches: [{ id: 'b1', name: 'Centro' }],
    })
    auth.post.mockResolvedValue({ summary: { users: 3 }, users: [] })

    const result = await controller.seed()

    expect(delivery.post).not.toHaveBeenCalled()
    expect(result.delivery).toEqual({ riders: 0 })
  })

  it('omite el branchId cuando commerce no devuelve sucursales', async () => {
    const { controller, commerce, auth } = makeController()
    commerce.post.mockResolvedValue({ summary: { branches: 0 }, branches: [] })
    auth.post.mockResolvedValue({ summary: { users: 1 }, users: [] })

    await controller.seed()

    expect(auth.post).toHaveBeenCalledWith(
      '/v1/seed',
      expect.objectContaining({ body: { branchId: undefined } }),
    )
  })
})
