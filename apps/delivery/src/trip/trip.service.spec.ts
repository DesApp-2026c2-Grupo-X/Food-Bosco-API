import { ERROR_CODES } from '../config/constants'
import { Trip, TripDocument, TripOrder } from './trip.model'
import { TripRepository } from './trip.repository'
import { TripService } from './trip.service'

const buildOrder = (overrides: Partial<TripOrder> = {}): TripOrder => ({
  orderId: 'ord-1',
  pickupBranchId: 'b1',
  pickupLocation: { latitude: -34.6, longitude: -58.4 },
  deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
  status: 'ready_for_delivery',
  pickedUpAt: null,
  deliveredAt: null,
  ...overrides,
})

const buildDoc = (overrides: Partial<Trip> = {}): TripDocument =>
  ({
    _id: { toString: () => 't1' },
    riderId: 'u1',
    status: 'offered',
    orders: [buildOrder()],
    distanceKm: 5,
    estimatedMinutes: 12,
    estimatedEarnings: 1500,
    earnings: null,
    startedAt: null,
    completedAt: null,
    expiresAt: new Date('2026-01-01T00:01:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as unknown as TripDocument

const makeService = () => {
  const repository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdForRider: jest.fn(),
    findActiveOfferByRider: jest.fn(),
    findByOrderId: jest.fn().mockResolvedValue([]),
    listByRider: jest.fn(),
    save: jest.fn((doc: TripDocument) => Promise.resolve(doc)),
  }
  const service = new TripService(repository as unknown as TripRepository)
  return { service, repository }
}

describe('TripService.markActive (RQ-DLV-06)', () => {
  it('transiciona offered → active y registra startedAt', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(buildDoc())

    const result = await service.markActive('t1')

    expect(result.status).toBe('active')
    expect(result.startedAt).not.toBeNull()
    expect(result.expiresAt).toBeNull()
    expect(repository.save).toHaveBeenCalled()
  })

  it.each(['active', 'completed', 'cancelled'])(
    'rechaza activar un viaje en estado %s',
    async (status) => {
      const { service, repository } = makeService()
      repository.findById.mockResolvedValue(buildDoc({ status: status as Trip['status'] }))

      await expect(service.markActive('t1')).rejects.toMatchObject({
        code: ERROR_CODES.invalidTripStatus,
      })
    },
  )
})

describe('TripService.markCancelled', () => {
  it.each(['offered', 'active'])('permite cancelar desde %s', async (status) => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(buildDoc({ status: status as Trip['status'] }))

    const result = await service.markCancelled('t1')

    expect(result.status).toBe('cancelled')
  })

  it.each(['completed', 'cancelled'])('rechaza cancelar un viaje en %s', async (status) => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(buildDoc({ status: status as Trip['status'] }))

    await expect(service.markCancelled('t1')).rejects.toMatchObject({
      code: ERROR_CODES.invalidTripStatus,
    })
  })
})

describe('TripService.markOrderPickedUp (RQ-DLV-07)', () => {
  it('marca el retiro: ready_for_delivery → on_the_way', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(buildDoc({ status: 'active' }))

    const result = await service.markOrderPickedUp('t1', 'ord-1')

    expect(result.orders[0].status).toBe('on_the_way')
    expect(result.orders[0].pickedUpAt).not.toBeNull()
  })

  it('rechaza retirar dos veces la misma orden', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(
      buildDoc({ status: 'active', orders: [buildOrder({ status: 'on_the_way' })] }),
    )

    await expect(service.markOrderPickedUp('t1', 'ord-1')).rejects.toMatchObject({
      code: ERROR_CODES.invalidTripStatus,
    })
  })

  it('rechaza una orden que no pertenece al viaje', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(buildDoc({ status: 'active' }))

    await expect(service.markOrderPickedUp('t1', 'ord-999')).rejects.toMatchObject({
      code: ERROR_CODES.orderNotInTrip,
    })
  })

  it.each(['offered', 'completed', 'cancelled'])(
    'rechaza si el viaje no está en curso (estado %s)',
    async (status) => {
      const { service, repository } = makeService()
      repository.findById.mockResolvedValue(buildDoc({ status: status as Trip['status'] }))

      await expect(service.markOrderPickedUp('t1', 'ord-1')).rejects.toMatchObject({
        code: ERROR_CODES.invalidTripStatus,
      })
    },
  )
})

describe('TripService.markOrderDelivered (RQ-DLV-07/08)', () => {
  it('marca la entrega: on_the_way → delivered y completa el viaje', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(
      buildDoc({ status: 'active', orders: [buildOrder({ status: 'on_the_way' })] }),
    )

    const result = await service.markOrderDelivered('t1', 'ord-1')

    expect(result.status).toBe('completed')
    expect(result.orders[0].status).toBe('delivered')
    expect(result.orders[0].deliveredAt).not.toBeNull()
    expect(result.earnings).toBe(1500)
    expect(result.completedAt).not.toBeNull()
  })

  it('no completa el viaje si quedan órdenes pendientes', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(
      buildDoc({
        status: 'active',
        orders: [
          buildOrder({ status: 'on_the_way' }),
          buildOrder({ orderId: 'ord-2', status: 'on_the_way' }),
        ],
      }),
    )

    const result = await service.markOrderDelivered('t1', 'ord-1')

    expect(result.status).toBe('active')
    expect(result.earnings).toBeNull()
    expect(result.orders[1].status).toBe('on_the_way')
  })

  it('rechaza entregar una orden que no fue retirada', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(buildDoc({ status: 'active' }))

    await expect(service.markOrderDelivered('t1', 'ord-1')).rejects.toMatchObject({
      code: ERROR_CODES.invalidTripStatus,
    })
  })

  it('rechaza una orden que no pertenece al viaje', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(
      buildDoc({ status: 'active', orders: [buildOrder({ status: 'on_the_way' })] }),
    )

    await expect(service.markOrderDelivered('t1', 'ord-999')).rejects.toMatchObject({
      code: ERROR_CODES.orderNotInTrip,
    })
  })

  it.each(['offered', 'completed', 'cancelled'])(
    'rechaza si el viaje no está en curso (estado %s)',
    async (status) => {
      const { service, repository } = makeService()
      repository.findById.mockResolvedValue(buildDoc({ status: status as Trip['status'] }))

      await expect(service.markOrderDelivered('t1', 'ord-1')).rejects.toMatchObject({
        code: ERROR_CODES.invalidTripStatus,
      })
    },
  )
})

describe('TripService.findByIdForRider (RQ-SEC-06)', () => {
  it('solo devuelve viajes del repartidor', async () => {
    const { service, repository } = makeService()
    repository.findByIdForRider.mockResolvedValue(null)

    await expect(service.findByIdForRider('t1', 'u1')).resolves.toBeNull()
    expect(repository.findByIdForRider).toHaveBeenCalledWith('t1', 'u1')
  })
})

describe('TripService.listByRider / createOffered', () => {
  it('lista los viajes con meta de paginación', async () => {
    const { service, repository } = makeService()
    repository.listByRider.mockResolvedValue({
      data: [buildDoc({ status: 'completed' })],
      total: 1,
    })

    const result = await service.listByRider('u1', 20, 0)

    expect(result.data).toHaveLength(1)
    expect(result.data[0].status).toBe('completed')
    expect(result.meta).toEqual({ total: 1, limit: 20, offset: 0 })
  })

  it('crea un viaje en estado offered', async () => {
    const { service, repository } = makeService()
    repository.create.mockResolvedValue(buildDoc())

    const result = await service.createOffered({
      riderId: 'u1',
      orders: [buildOrder()],
      distanceKm: 5,
      estimatedMinutes: 12,
      estimatedEarnings: 1500,
      expiresAt: new Date('2026-01-01T00:01:00.000Z'),
    })

    expect(result.status).toBe('offered')
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ riderId: 'u1', status: 'offered' }),
    )
  })
})

describe('TripService — errores de dominio con código, mensaje y status', () => {
  type Repository = ReturnType<typeof makeService>['repository']

  const activeWithOrder = (status: TripOrder['status'] = 'ready_for_delivery') =>
    buildDoc({ status: 'active', orders: [buildOrder({ status })] })

  const cases: Array<{
    name: string
    setup: (repository: Repository) => void
    run: (service: TripService) => Promise<unknown>
    code: string
    message: string
    status: number
  }> = [
    {
      name: 'markActive sobre viaje inexistente',
      setup: (repository) => repository.findById.mockResolvedValue(null),
      run: (service) => service.markActive('t1'),
      code: ERROR_CODES.tripNotFound,
      message: 'Viaje no encontrado',
      status: 404,
    },
    {
      name: 'markActive sobre viaje ya completado',
      setup: (repository) =>
        repository.findById.mockResolvedValue(buildDoc({ status: 'completed' })),
      run: (service) => service.markActive('t1'),
      code: ERROR_CODES.invalidTripStatus,
      message: 'Transición de viaje inválida',
      status: 409,
    },
    {
      name: 'markCancelled sobre viaje inexistente',
      setup: (repository) => repository.findById.mockResolvedValue(null),
      run: (service) => service.markCancelled('t1'),
      code: ERROR_CODES.tripNotFound,
      message: 'Viaje no encontrado',
      status: 404,
    },
    {
      name: 'markCancelled sobre viaje ya completado',
      setup: (repository) =>
        repository.findById.mockResolvedValue(buildDoc({ status: 'completed' })),
      run: (service) => service.markCancelled('t1'),
      code: ERROR_CODES.invalidTripStatus,
      message: 'Transición de viaje inválida',
      status: 409,
    },
    {
      name: 'markOrderPickedUp sobre viaje inexistente',
      setup: (repository) => repository.findById.mockResolvedValue(null),
      run: (service) => service.markOrderPickedUp('t1', 'ord-1'),
      code: ERROR_CODES.tripNotFound,
      message: 'Viaje no encontrado',
      status: 404,
    },
    {
      name: 'markOrderPickedUp con viaje no activo',
      setup: (repository) => repository.findById.mockResolvedValue(buildDoc({ status: 'offered' })),
      run: (service) => service.markOrderPickedUp('t1', 'ord-1'),
      code: ERROR_CODES.invalidTripStatus,
      message: 'Transición de viaje inválida',
      status: 409,
    },
    {
      name: 'markOrderPickedUp con orden ya retirada',
      setup: (repository) => repository.findById.mockResolvedValue(activeWithOrder('on_the_way')),
      run: (service) => service.markOrderPickedUp('t1', 'ord-1'),
      code: ERROR_CODES.invalidTripStatus,
      message: 'La orden no está lista para retirar',
      status: 409,
    },
    {
      name: 'markOrderPickedUp con orden ajena al viaje',
      setup: (repository) => repository.findById.mockResolvedValue(activeWithOrder()),
      run: (service) => service.markOrderPickedUp('t1', 'ord-999'),
      code: ERROR_CODES.orderNotInTrip,
      message: 'La orden no pertenece al viaje',
      status: 404,
    },
    {
      name: 'markOrderDelivered sobre viaje inexistente',
      setup: (repository) => repository.findById.mockResolvedValue(null),
      run: (service) => service.markOrderDelivered('t1', 'ord-1'),
      code: ERROR_CODES.tripNotFound,
      message: 'Viaje no encontrado',
      status: 404,
    },
    {
      name: 'markOrderDelivered con viaje no activo',
      setup: (repository) => repository.findById.mockResolvedValue(buildDoc({ status: 'offered' })),
      run: (service) => service.markOrderDelivered('t1', 'ord-1'),
      code: ERROR_CODES.invalidTripStatus,
      message: 'Transición de viaje inválida',
      status: 409,
    },
    {
      name: 'markOrderDelivered con orden no retirada',
      setup: (repository) => repository.findById.mockResolvedValue(activeWithOrder()),
      run: (service) => service.markOrderDelivered('t1', 'ord-1'),
      code: ERROR_CODES.invalidTripStatus,
      message: 'La orden no está en camino',
      status: 409,
    },
    {
      name: 'markOrderDelivered con orden ajena al viaje',
      setup: (repository) => repository.findById.mockResolvedValue(activeWithOrder('on_the_way')),
      run: (service) => service.markOrderDelivered('t1', 'ord-999'),
      code: ERROR_CODES.orderNotInTrip,
      message: 'La orden no pertenece al viaje',
      status: 404,
    },
  ]

  it.each(cases)('$name → $code', async ({ setup, run, code, message, status }) => {
    const { service, repository } = makeService()
    setup(repository)

    await expect(run(service)).rejects.toMatchObject({ code, message, status })
  })
})

describe('TripService.markActive (RQ-DLV-06)', () => {
  it('no persiste si el estado de origen no es offered', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(buildDoc({ status: 'cancelled' }))

    await expect(service.markActive('t1')).rejects.toMatchObject({
      code: ERROR_CODES.invalidTripStatus,
    })
    expect(repository.save).not.toHaveBeenCalled()
  })
})

describe('TripService.markOrderDelivered — ganancias (RQ-DLV-08)', () => {
  const earningsCases: Array<{
    name: string
    distanceKm: number
    orderCount: number
    estimatedEarnings: number
  }> = [
    { name: 'un pedido', distanceKm: 1, orderCount: 1, estimatedEarnings: 800 },
    { name: 'varios pedidos', distanceKm: 10, orderCount: 3, estimatedEarnings: 3200 },
    { name: 'distancia 0', distanceKm: 0, orderCount: 1, estimatedEarnings: 500 },
    { name: 'ganancia 0 (límite)', distanceKm: 5, orderCount: 1, estimatedEarnings: 0 },
  ]

  it.each(earningsCases)(
    'asigna earnings = estimada al entregar todas ($name)',
    async ({ distanceKm, orderCount, estimatedEarnings }) => {
      const { service, repository } = makeService()
      const orders = Array.from({ length: orderCount }, (_, index) =>
        buildOrder({ orderId: `ord-${index + 1}`, status: 'on_the_way' }),
      )
      repository.findById.mockResolvedValue(
        buildDoc({ status: 'active', orders, distanceKm, estimatedEarnings }),
      )

      for (const order of orders.slice(0, -1)) {
        await service.markOrderDelivered('t1', order.orderId)
      }
      const last = orders[orders.length - 1]
      const result = await service.markOrderDelivered('t1', last.orderId)

      expect(result.status).toBe('completed')
      expect(result.earnings).toBe(estimatedEarnings)
      expect(result.orders.every((order) => order.status === 'delivered')).toBe(true)
    },
  )

  it('no asigna ganancias hasta entregar la última orden', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(
      buildDoc({
        status: 'active',
        estimatedEarnings: 2000,
        orders: [
          buildOrder({ orderId: 'ord-1', status: 'on_the_way' }),
          buildOrder({ orderId: 'ord-2', status: 'on_the_way' }),
        ],
      }),
    )

    const partial = await service.markOrderDelivered('t1', 'ord-1')

    expect(partial.status).toBe('active')
    expect(partial.earnings).toBeNull()
  })
})

describe('TripService — idempotencia de pickup/deliver (comportamiento actual)', () => {
  it('repetir el retiro de la misma orden lanza 409', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(buildDoc({ status: 'active' }))

    await service.markOrderPickedUp('t1', 'ord-1')
    await expect(service.markOrderPickedUp('t1', 'ord-1')).rejects.toMatchObject({
      code: ERROR_CODES.invalidTripStatus,
      message: 'La orden no está lista para retirar',
      status: 409,
    })
  })

  it('repetir la entrega de una orden ya entregada en viaje multiorden lanza 409', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(
      buildDoc({
        status: 'active',
        orders: [
          buildOrder({ orderId: 'ord-1', status: 'on_the_way' }),
          buildOrder({ orderId: 'ord-2', status: 'on_the_way' }),
        ],
      }),
    )

    await service.markOrderDelivered('t1', 'ord-1')
    await expect(service.markOrderDelivered('t1', 'ord-1')).rejects.toMatchObject({
      code: ERROR_CODES.invalidTripStatus,
      message: 'La orden no está en camino',
      status: 409,
    })
  })

  it('repetir la entrega sobre un viaje ya completado lanza 409', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(
      buildDoc({ status: 'active', orders: [buildOrder({ status: 'on_the_way' })] }),
    )

    await service.markOrderDelivered('t1', 'ord-1')
    await expect(service.markOrderDelivered('t1', 'ord-1')).rejects.toMatchObject({
      code: ERROR_CODES.invalidTripStatus,
      message: 'Transición de viaje inválida',
      status: 409,
    })
  })
})

describe('TripService.listByRider — paginación (RQ-DLV-10)', () => {
  it.each([
    { name: 'primera página', limit: 1, offset: 0 },
    { name: 'página intermedia', limit: 20, offset: 40 },
    { name: 'límite máximo', limit: 100, offset: 0 },
  ])('propaga $name (limit=$limit, offset=$offset)', async ({ limit, offset }) => {
    const { service, repository } = makeService()
    repository.listByRider.mockResolvedValue({ data: [], total: 0 })

    const result = await service.listByRider('u1', limit, offset)

    expect(repository.listByRider).toHaveBeenCalledWith('u1', limit, offset)
    expect(result.meta).toEqual({ total: 0, limit, offset })
  })
})

describe('TripService.findById / findActiveOffer / createOffered', () => {
  it('findById devuelve null si no existe', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(null)

    await expect(service.findById('t1')).resolves.toBeNull()
  })

  it('findById serializa el viaje existente', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(buildDoc())

    const result = await service.findById('t1')

    expect(result?.id).toBe('t1')
  })

  it('findActiveOffer consulta con la fecha actual', async () => {
    const { service, repository } = makeService()
    repository.findActiveOfferByRider.mockResolvedValue(null)

    await expect(service.findActiveOffer('u1')).resolves.toBeNull()
    expect(repository.findActiveOfferByRider).toHaveBeenCalledWith('u1', expect.any(Date))
  })

  it('findActiveOffer serializa la oferta vigente', async () => {
    const { service, repository } = makeService()
    repository.findActiveOfferByRider.mockResolvedValue(buildDoc())

    const result = await service.findActiveOffer('u1')

    expect(result?.status).toBe('offered')
  })

  it('createOffered persiste todos los campos calculados', async () => {
    const { service, repository } = makeService()
    repository.create.mockResolvedValue(buildDoc())
    const expiresAt = new Date('2026-01-01T00:01:00.000Z')

    await service.createOffered({
      riderId: 'u1',
      orders: [buildOrder()],
      distanceKm: 5,
      estimatedMinutes: 12,
      estimatedEarnings: 1500,
      expiresAt,
    })

    expect(repository.create).toHaveBeenCalledWith({
      riderId: 'u1',
      status: 'offered',
      orders: [buildOrder()],
      distanceKm: 5,
      estimatedMinutes: 12,
      estimatedEarnings: 1500,
      expiresAt,
    })
  })
})

describe('TripService.cancelOrder (orden cancelada, RQ-DLV-08)', () => {
  it('marca la orden cancelada y completa el viaje cuando no queda nada pendiente', async () => {
    const { service, repository } = makeService()
    repository.findByOrderId.mockResolvedValue([buildDoc({ status: 'active' })])

    const freed = await service.cancelOrder('ord-1')

    expect(freed).toEqual(['u1'])
    const saved = repository.save.mock.calls[0][0] as TripDocument
    expect(saved.orders[0].status).toBe('cancelled')
    expect(saved.status).toBe('completed')
  })

  it('no completa el viaje si quedan órdenes activas', async () => {
    const { service, repository } = makeService()
    repository.findByOrderId.mockResolvedValue([
      buildDoc({
        status: 'active',
        orders: [buildOrder(), buildOrder({ orderId: 'ord-2', status: 'on_the_way' })],
      }),
    ])

    const freed = await service.cancelOrder('ord-1')

    expect(freed).toEqual([])
    const saved = repository.save.mock.calls[0][0] as TripDocument
    expect(saved.status).toBe('active')
  })

  it('ignora viajes que no contienen la orden o ya la tienen resuelta', async () => {
    const { service, repository } = makeService()
    repository.findByOrderId.mockResolvedValue([])

    await expect(service.cancelOrder('ord-1')).resolves.toEqual([])
    expect(repository.save).not.toHaveBeenCalled()
  })
})

describe('TripService.releaseOrder (liberar rider, RQ-DLV-09)', () => {
  it('quita la orden del viaje y libera al rider si el viaje queda sin órdenes', async () => {
    const { service, repository } = makeService()
    repository.findByOrderId.mockResolvedValue([buildDoc({ status: 'active' })])

    const result = await service.releaseOrder('ord-1')

    expect(result).toEqual({ riderId: 'u1', finished: true })
    const saved = repository.save.mock.calls[0][0] as TripDocument
    expect(saved.orders).toHaveLength(0)
    expect(saved.status).toBe('cancelled')
  })

  it('mantiene el viaje activo si quedan otras órdenes', async () => {
    const { service, repository } = makeService()
    repository.findByOrderId.mockResolvedValue([
      buildDoc({
        status: 'active',
        orders: [buildOrder(), buildOrder({ orderId: 'ord-2', status: 'ready_for_delivery' })],
      }),
    ])

    const result = await service.releaseOrder('ord-1')

    expect(result).toEqual({ riderId: 'u1', finished: false })
    const saved = repository.save.mock.calls[0][0] as TripDocument
    expect(saved.orders.map((order) => order.orderId)).toEqual(['ord-2'])
    expect(saved.status).toBe('active')
  })

  it('devuelve null cuando ningún viaje contiene la orden', async () => {
    const { service, repository } = makeService()
    repository.findByOrderId.mockResolvedValue([])

    await expect(service.releaseOrder('ord-1')).resolves.toBeNull()
    expect(repository.save).not.toHaveBeenCalled()
  })
})
