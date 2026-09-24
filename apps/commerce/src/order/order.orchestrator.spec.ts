import { CartService } from '../cart/cart.service'
import { CartOrchestrator } from '../cart/cart.orchestrator'
import type { CartItemData } from '../cart/cart.repository'
import type { PublicCart } from '../cart/cart.model'
import type { PublicBranch } from '../branch/branch.model'
import { BranchService } from '../branch/branch.service'
import { ERROR_CODES, ORDER_STATUS, PARAMETER_KEYS, ROLES } from '../config/constants'
import { estimateMinutes, haversineDistanceKm } from '../config/geo/distance'
import { EventBus } from '../config/messaging/event-bus'
import type { AuthContext } from '../config/security/jwt.service'
import { ParameterService } from '../parameter/parameter.service'
import type { PublicProduct } from '../product/product.model'
import { ProductService } from '../product/product.service'
import { StockService } from '../stock/stock.service'
import type { PublicOrder } from './order.model'
import { OrderService } from './order.service'
import { OrderOrchestrator } from './order.orchestrator'

const product = (overrides: Partial<PublicProduct> = {}): PublicProduct => ({
  id: 'p1',
  categoryId: 'cat1',
  name: 'Hamburguesa',
  description: 'Clásica',
  price: 100,
  image: null,
  available: true,
  configGroups: [],
  recipe: [],
  ...overrides,
})

const branch = (overrides: Partial<PublicBranch> = {}): PublicBranch => ({
  id: 'b1',
  name: 'Centro',
  addressText: 'Av 1',
  latitude: 0,
  longitude: 0,
  phone: null,
  active: true,
  hours: [],
  ...overrides,
})

const order = (overrides: Partial<PublicOrder> = {}): PublicOrder => ({
  id: 'o1',
  number: '000001',
  clientId: 'c1',
  branchId: 'b1',
  addressId: 'a1',
  deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
  status: ORDER_STATUS.pending,
  total: 100,
  estimatedDeliveryAt: null,
  riderId: null,
  tripId: null,
  cancelReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  items: [],
  statusHistory: [],
  availableTransitions: [ORDER_STATUS.confirmed, ORDER_STATUS.cancelled],
  ...overrides,
})

const cartItem = (overrides: Partial<CartItemData> = {}): CartItemData => ({
  productId: 'p1',
  quantity: 2,
  observations: null,
  optionIds: [],
  ...overrides,
})

type CartOverrides = Partial<Omit<PublicCart, 'items'>> & {
  items?: Array<CartItemData & { id?: string }>
}

const cart = (overrides: CartOverrides = {}): PublicCart => ({
  id: 'cart1',
  clientId: 'c1',
  status: 'active',
  total: 0,
  ...overrides,
  items: (overrides.items ?? []).map((item, index) => ({
    id: item.id ?? `i${index}`,
    productId: item.productId,
    quantity: item.quantity,
    observations: item.observations,
    optionIds: item.optionIds,
  })),
})

const admin = (branchId: string | null): AuthContext => ({
  authenticated: true,
  userId: 'u1',
  roles: [ROLES.branchAdmin],
  branchId,
  internal: false,
})

const superAdmin = (): AuthContext => ({
  authenticated: true,
  userId: 'u0',
  roles: [ROLES.superAdmin],
  branchId: null,
  internal: false,
})

const internalActor = (): AuthContext => ({
  authenticated: false,
  userId: null,
  roles: [],
  branchId: null,
  internal: true,
})

const makeOrchestrator = () => {
  const orderService = {
    findById: jest.fn(),
    create: jest.fn(),
    applyTransition: jest.fn(),
    releaseRider: jest.fn(),
  }
  const cartService = { findActiveByClient: jest.fn(), confirm: jest.fn() }
  const cartOrchestrator = { replaceItems: jest.fn() }
  const productService = { findByIds: jest.fn(), findById: jest.fn() }
  const branchService = {
    findAvailable: jest.fn(),
    findById: jest.fn(),
    getAvailabilityMap: jest.fn(),
  }
  const stockService = { validateAvailability: jest.fn(), discount: jest.fn() }
  const parameterService = { getValue: jest.fn() }
  const eventBus = { publish: jest.fn() }

  const orchestrator = new OrderOrchestrator(
    orderService as unknown as OrderService,
    cartService as unknown as CartService,
    cartOrchestrator as unknown as CartOrchestrator,
    productService as unknown as ProductService,
    branchService as unknown as BranchService,
    stockService as unknown as StockService,
    parameterService as unknown as ParameterService,
    eventBus as unknown as EventBus,
  )

  return {
    orchestrator,
    orderService,
    cartService,
    cartOrchestrator,
    productService,
    branchService,
    stockService,
    parameterService,
    eventBus,
  }
}

describe('OrderOrchestrator.create (RQ-ORD-01..10)', () => {
  it('asigna sucursal, valida stock, crea snapshot y confirma el carrito', async () => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue({
      id: 'cart1',
      clientId: 'c1',
      status: 'active',
      items: [cartItem()],
      total: 200,
    })
    mocks.branchService.findAvailable.mockResolvedValue([branch()])
    mocks.branchService.getAvailabilityMap.mockResolvedValue(new Map())
    mocks.productService.findByIds.mockResolvedValue([product()])
    mocks.parameterService.getValue.mockImplementation((key: string) =>
      key === 'BASE_PREP_MIN' ? 15 : 25,
    )
    mocks.orderService.create.mockResolvedValue(
      order({ estimatedDeliveryAt: '2026-01-01T00:15:00.000Z' }),
    )

    const result = await mocks.orchestrator.create('c1', {
      addressId: 'a1',
      deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
    })

    expect(mocks.stockService.validateAvailability).toHaveBeenCalled()
    expect(mocks.orderService.create).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'b1', clientId: 'c1' }),
    )
    expect(mocks.cartService.confirm).toHaveBeenCalledWith('cart1')
    expect(result.id).toBe('o1')
  })

  it('rechaza si un producto está desactivado en la sucursal (availableInBranch)', async () => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue({
      id: 'cart1',
      clientId: 'c1',
      status: 'active',
      items: [cartItem()],
      total: 200,
    })
    mocks.branchService.findAvailable.mockResolvedValue([branch()])
    mocks.branchService.getAvailabilityMap.mockResolvedValue(new Map([['p1', false]]))
    mocks.productService.findByIds.mockResolvedValue([product()])

    await expect(
      mocks.orchestrator.create('c1', {
        addressId: 'a1',
        deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.productUnavailable })
  })

  it('rechaza si no hay sucursal disponible (RQ-ORD-04)', async () => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue({
      id: 'cart1',
      clientId: 'c1',
      status: 'active',
      items: [cartItem()],
      total: 200,
    })
    mocks.branchService.findAvailable.mockResolvedValue([])

    await expect(
      mocks.orchestrator.create('c1', {
        addressId: 'a1',
        deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.noBranchAvailable })
  })

  it('rechaza con carrito vacío o inexistente', async () => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue(null)

    await expect(
      mocks.orchestrator.create('c1', {
        addressId: 'a1',
        deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.cartNotFound })
  })
})

describe('OrderOrchestrator.changeStatus (RQ-ORD-14/18, RQ-STK-08)', () => {
  it('descuenta stock y emite evento al pasar a PREPARING', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(order({ status: ORDER_STATUS.confirmed }))
    mocks.orderService.applyTransition.mockResolvedValue({
      order: order({ status: ORDER_STATUS.preparing }),
      changed: true,
    })
    mocks.productService.findByIds.mockResolvedValue([product()])
    mocks.branchService.findById.mockResolvedValue(branch())

    await mocks.orchestrator.changeStatus(admin('b1'), 'o1', ORDER_STATUS.preparing)

    expect(mocks.stockService.discount).toHaveBeenCalledWith('b1', {}, 'o1')
    expect(mocks.eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order.status_changed', status: 'preparing' }),
    )
  })

  it('no descuenta stock en una transición distinta a PREPARING', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(order({ status: ORDER_STATUS.pending }))
    mocks.orderService.applyTransition.mockResolvedValue({
      order: order({ status: ORDER_STATUS.confirmed }),
      changed: true,
    })
    mocks.branchService.findById.mockResolvedValue(branch())

    await mocks.orchestrator.changeStatus(admin('b1'), 'o1', ORDER_STATUS.confirmed)

    expect(mocks.stockService.discount).not.toHaveBeenCalled()
    expect(mocks.eventBus.publish).toHaveBeenCalled()
  })

  it('rechaza a un admin de otra sucursal (RQ-SEC-05)', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(order({ branchId: 'b-other' }))

    await expect(
      mocks.orchestrator.changeStatus(admin('b1'), 'o1', ORDER_STATUS.preparing),
    ).rejects.toMatchObject({ code: ERROR_CODES.forbidden })
  })
})

describe('OrderOrchestrator.repeat (RQ-ORD-17)', () => {
  it('crea un carrito con los productos disponibles y lista los omitidos', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(
      order({
        clientId: 'c1',
        items: [
          {
            productId: 'p1',
            name: 'Disponible',
            unitPrice: 100,
            quantity: 1,
            observations: null,
            subtotal: 100,
            options: [],
          },
          {
            productId: 'p2',
            name: 'Pausado',
            unitPrice: 200,
            quantity: 1,
            observations: null,
            subtotal: 200,
            options: [],
          },
        ],
      }),
    )
    mocks.productService.findById.mockImplementation((id: string) =>
      Promise.resolve(id === 'p1' ? product() : product({ id: 'p2', available: false })),
    )
    mocks.cartOrchestrator.replaceItems.mockResolvedValue({ id: 'cart2' })

    const result = await mocks.orchestrator.repeat('c1', 'o1')

    expect(mocks.cartOrchestrator.replaceItems).toHaveBeenCalledWith(
      'c1',
      expect.arrayContaining([expect.objectContaining({ productId: 'p1' })]),
    )
    expect(result.skippedProducts).toHaveLength(1)
    expect(result.skippedProducts[0].id).toBe('p2')
  })

  it('rechaza repetir un pedido ajeno', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(order({ clientId: 'otro' }))

    await expect(mocks.orchestrator.repeat('c1', 'o1')).rejects.toMatchObject({
      code: ERROR_CODES.orderNotFound,
    })
  })
})

const optionProduct = (): PublicProduct =>
  product({
    price: 100,
    configGroups: [
      {
        id: 'g1',
        name: 'Tamaño',
        type: 'single',
        required: true,
        min: null,
        max: null,
        options: [
          { id: 'opt1', name: 'Doble', extraPrice: 50, available: true },
          { id: 'opt2', name: 'Pausada', extraPrice: 20, available: false },
        ],
      },
    ],
  })

const deliveryAddress = { text: 'Av 1', latitude: 0, longitude: 0 }

const primeCreate = (mocks: ReturnType<typeof makeOrchestrator>): void => {
  mocks.branchService.findAvailable.mockResolvedValue([branch()])
  mocks.branchService.getAvailabilityMap.mockResolvedValue(new Map())
  mocks.productService.findByIds.mockResolvedValue([product()])
  mocks.parameterService.getValue.mockResolvedValue(0)
  mocks.orderService.create.mockResolvedValue(order())
  mocks.cartService.confirm.mockResolvedValue(cart())
}

describe('OrderOrchestrator.create — cálculo, snapshot y sucursal (RQ-ORD-03/06/07)', () => {
  it('calcula total, subtotal, precio unitario y snapshot de opciones', async () => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue(
      cart({ items: [cartItem({ quantity: 2, optionIds: ['opt1'], observations: 'sin sal' })] }),
    )
    primeCreate(mocks)
    mocks.productService.findByIds.mockResolvedValue([optionProduct()])

    await mocks.orchestrator.create('c1', { addressId: 'a1', deliveryAddress })

    const input = mocks.orderService.create.mock.calls[0][0]
    expect(input.total).toBe(300)
    expect(input.items).toEqual([
      {
        productId: 'p1',
        name: 'Hamburguesa',
        unitPrice: 150,
        quantity: 2,
        observations: 'sin sal',
        subtotal: 300,
        options: [{ optionId: 'opt1', name: 'Doble', extraPrice: 50 }],
      },
    ])
  })

  it('acumula el total de varios ítems con adicionales', async () => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue(
      cart({
        items: [
          cartItem({ productId: 'p1', quantity: 2, optionIds: ['opt1'] }),
          cartItem({ productId: 'p1', quantity: 1, optionIds: [] }),
        ],
      }),
    )
    primeCreate(mocks)
    mocks.productService.findByIds.mockResolvedValue([optionProduct()])

    await mocks.orchestrator.create('c1', { addressId: 'a1', deliveryAddress })

    expect(mocks.orderService.create.mock.calls[0][0].total).toBe(400)
  })

  it('asigna la primera sucursal devuelta (la más cercana) y consulta su disponibilidad', async () => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue(cart({ items: [cartItem()] }))
    primeCreate(mocks)
    mocks.branchService.findAvailable.mockResolvedValue([
      branch({ id: 'b-near' }),
      branch({ id: 'b-far' }),
    ])

    await mocks.orchestrator.create('c1', { addressId: 'a1', deliveryAddress })

    expect(mocks.orderService.create).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'b-near' }),
    )
    expect(mocks.branchService.getAvailabilityMap).toHaveBeenCalledWith('b-near')
  })

  it.each([
    { name: 'carrito inexistente', activeCart: null },
    { name: 'carrito vacío', activeCart: cart({ items: [] }) },
  ])('$name → CART_NOT_FOUND sin consultar sucursales', async ({ activeCart }) => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue(activeCart)

    await expect(
      mocks.orchestrator.create('c1', { addressId: 'a1', deliveryAddress }),
    ).rejects.toMatchObject({ code: ERROR_CODES.cartNotFound, status: 400 })
    expect(mocks.branchService.findAvailable).not.toHaveBeenCalled()
  })
})

describe('OrderOrchestrator.create — ETA (RQ-ORD-09)', () => {
  const NOW = new Date('2026-08-24T12:00:00.000Z')

  beforeEach(() => jest.useFakeTimers({ now: NOW }))
  afterEach(() => jest.useRealTimers())

  it('suma tiempo base de preparación y traslado estimado por distancia', async () => {
    const mocks = makeOrchestrator()
    const address = { text: 'Av Cliente', latitude: 0, longitude: 0.5 }
    mocks.cartService.findActiveByClient.mockResolvedValue(cart({ items: [cartItem()] }))
    primeCreate(mocks)
    mocks.branchService.findAvailable.mockResolvedValue([branch({ latitude: 0, longitude: 0 })])
    mocks.parameterService.getValue.mockImplementation((key: string) => {
      if (key === PARAMETER_KEYS.basePrepMin) return Promise.resolve(15)
      if (key === PARAMETER_KEYS.avgSpeedKmh) return Promise.resolve(25)
      return Promise.resolve(0)
    })

    await mocks.orchestrator.create('c1', { addressId: 'a1', deliveryAddress: address })

    const distanceKm = haversineDistanceKm({ latitude: 0, longitude: 0 }, address)
    const expected = new Date(NOW.getTime() + (15 + estimateMinutes(distanceKm, 25)) * 60_000)
    expect(mocks.orderService.create.mock.calls[0][0].estimatedDeliveryAt).toEqual(expected)
    expect(mocks.parameterService.getValue).toHaveBeenCalledWith(PARAMETER_KEYS.basePrepMin)
    expect(mocks.parameterService.getValue).toHaveBeenCalledWith(PARAMETER_KEYS.avgSpeedKmh)
  })

  it.each([
    { name: 'velocidad 0', speed: 0, expectedExtraMinutes: 0 },
    { name: 'velocidad 25', speed: 25, expectedExtraMinutes: null },
  ])('$name → solo tiempo base más traslado finito', async ({ speed, expectedExtraMinutes }) => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue(cart({ items: [cartItem()] }))
    primeCreate(mocks)
    mocks.branchService.findAvailable.mockResolvedValue([branch({ latitude: 0, longitude: 0 })])
    mocks.parameterService.getValue.mockImplementation((key: string) =>
      Promise.resolve(key === PARAMETER_KEYS.basePrepMin ? 10 : speed),
    )

    await mocks.orchestrator.create('c1', { addressId: 'a1', deliveryAddress })

    const distanceKm = haversineDistanceKm({ latitude: 0, longitude: 0 }, deliveryAddress)
    const extra = expectedExtraMinutes ?? estimateMinutes(distanceKm, speed)
    const expected = new Date(NOW.getTime() + (10 + extra) * 60_000)
    expect(mocks.orderService.create.mock.calls[0][0].estimatedDeliveryAt).toEqual(expected)
  })
})

describe('OrderOrchestrator.create — stock y orden de operaciones (RQ-ORD-01, RQ-STK-06)', () => {
  it('valida el stock antes de crear y confirma el carrito solo después de crear', async () => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue(cart({ items: [cartItem()] }))
    primeCreate(mocks)

    await mocks.orchestrator.create('c1', { addressId: 'a1', deliveryAddress })

    const stockOrder = mocks.stockService.validateAvailability.mock.invocationCallOrder[0]
    const createOrder = mocks.orderService.create.mock.invocationCallOrder[0]
    const confirmOrder = mocks.cartService.confirm.mock.invocationCallOrder[0]
    expect(stockOrder).toBeLessThan(createOrder)
    expect(createOrder).toBeLessThan(confirmOrder)
    expect(mocks.cartService.confirm).toHaveBeenCalledWith('cart1')
  })

  it('calcula los requerimientos con la receta y los ajustes por opción', async () => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue(
      cart({ items: [cartItem({ quantity: 2, optionIds: ['opt1'] })] }),
    )
    primeCreate(mocks)
    mocks.productService.findByIds.mockResolvedValue([
      {
        ...optionProduct(),
        recipe: [
          {
            id: 'r1',
            ingredientId: 'ing1',
            quantity: 2,
            optionAdjustments: [{ optionId: 'opt1', quantity: 3 }],
          },
          { id: 'r2', ingredientId: 'ing2', quantity: 1, optionAdjustments: [] },
        ],
      },
    ])

    await mocks.orchestrator.create('c1', { addressId: 'a1', deliveryAddress })

    expect(mocks.stockService.validateAvailability).toHaveBeenCalledWith('b1', {
      ing1: 6,
      ing2: 2,
    })
  })

  it('si falta stock no crea el pedido ni confirma el carrito', async () => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue(cart({ items: [cartItem()] }))
    primeCreate(mocks)
    mocks.stockService.validateAvailability.mockRejectedValue(
      Object.assign(new Error('Stock insuficiente'), { code: ERROR_CODES.insufficientStock }),
    )

    await expect(
      mocks.orchestrator.create('c1', { addressId: 'a1', deliveryAddress }),
    ).rejects.toMatchObject({ code: ERROR_CODES.insufficientStock })
    expect(mocks.orderService.create).not.toHaveBeenCalled()
    expect(mocks.cartService.confirm).not.toHaveBeenCalled()
  })

  it('si falla la creación del pedido no confirma el carrito', async () => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue(cart({ items: [cartItem()] }))
    primeCreate(mocks)
    mocks.orderService.create.mockRejectedValue(new Error('fallo de persistencia'))

    await expect(
      mocks.orchestrator.create('c1', { addressId: 'a1', deliveryAddress }),
    ).rejects.toThrow('fallo de persistencia')
    expect(mocks.cartService.confirm).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'producto inexistente', products: [] as PublicProduct[] },
    { name: 'producto pausado globalmente', products: [product({ available: false })] },
  ])('$name → PRODUCT_UNAVAILABLE antes de validar stock', async ({ products }) => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue(cart({ items: [cartItem()] }))
    primeCreate(mocks)
    mocks.productService.findByIds.mockResolvedValue(products)

    await expect(
      mocks.orchestrator.create('c1', { addressId: 'a1', deliveryAddress }),
    ).rejects.toMatchObject({ code: ERROR_CODES.productUnavailable, status: 400 })
    expect(mocks.stockService.validateAvailability).not.toHaveBeenCalled()
    expect(mocks.orderService.create).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'opción inexistente', optionIds: ['missing'] },
    { name: 'opción pausada', optionIds: ['opt2'] },
  ])('$name → configuración no disponible', async ({ optionIds }) => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue(
      cart({ items: [cartItem({ optionIds })] }),
    )
    primeCreate(mocks)
    mocks.productService.findByIds.mockResolvedValue([optionProduct()])

    await expect(
      mocks.orchestrator.create('c1', { addressId: 'a1', deliveryAddress }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.productUnavailable,
      message: 'Configuración no disponible',
    })
    expect(mocks.orderService.create).not.toHaveBeenCalled()
  })
})

describe('OrderOrchestrator.changeStatus — acceso por sucursal (RQ-SEC-05)', () => {
  const cases: Array<{ name: string; actor: AuthContext; expected: 'ok' | 'error' }> = [
    { name: 'token interno', actor: internalActor(), expected: 'ok' },
    { name: 'super_admin', actor: superAdmin(), expected: 'ok' },
    { name: 'admin de la misma sucursal', actor: admin('b1'), expected: 'ok' },
    { name: 'admin de otra sucursal', actor: admin('b-other'), expected: 'error' },
  ]

  it.each(cases)('$name → $expected', async ({ actor, expected }) => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(order({ branchId: 'b1' }))
    mocks.orderService.applyTransition.mockResolvedValue({
      order: order({ status: ORDER_STATUS.confirmed }),
      changed: true,
    })
    mocks.branchService.findById.mockResolvedValue(branch())

    if (expected === 'ok') {
      await expect(
        mocks.orchestrator.changeStatus(actor, 'o1', ORDER_STATUS.confirmed),
      ).resolves.toMatchObject({ id: 'o1' })
      expect(mocks.orderService.applyTransition).toHaveBeenCalledWith('o1', ORDER_STATUS.confirmed)
      return
    }

    await expect(
      mocks.orchestrator.changeStatus(actor, 'o1', ORDER_STATUS.confirmed),
    ).rejects.toMatchObject({ code: ERROR_CODES.forbidden, status: 403 })
    expect(mocks.orderService.applyTransition).not.toHaveBeenCalled()
  })
})

describe('OrderOrchestrator.changeStatus — descuento, evento e idempotencia (RQ-ORD-15/18, RQ-STK-07/08)', () => {
  it.each([
    { name: 'confirmed', status: ORDER_STATUS.confirmed, expectedDiscount: false },
    { name: 'ready_for_delivery', status: ORDER_STATUS.readyForDelivery, expectedDiscount: false },
    { name: 'preparing', status: ORDER_STATUS.preparing, expectedDiscount: true },
  ])('$name → descuento de stock = $expectedDiscount', async ({ status, expectedDiscount }) => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(order({ status: ORDER_STATUS.confirmed }))
    mocks.orderService.applyTransition.mockResolvedValue({
      order: order({ status }),
      changed: true,
    })
    mocks.productService.findByIds.mockResolvedValue([product()])
    mocks.branchService.findById.mockResolvedValue(branch())

    await mocks.orchestrator.changeStatus(admin('b1'), 'o1', status)

    if (expectedDiscount) {
      expect(mocks.stockService.discount).toHaveBeenCalledWith('b1', {}, 'o1')
    } else {
      expect(mocks.stockService.discount).not.toHaveBeenCalled()
    }
    expect(mocks.eventBus.publish).toHaveBeenCalledTimes(1)
  })

  it('publica el evento con la ubicación de la sucursal y la dirección de entrega', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(order({ status: ORDER_STATUS.pending }))
    mocks.orderService.applyTransition.mockResolvedValue({
      order: order({ status: ORDER_STATUS.confirmed }),
      changed: true,
    })
    mocks.branchService.findById.mockResolvedValue(branch({ latitude: -34.6, longitude: -58.4 }))

    await mocks.orchestrator.changeStatus(admin('b1'), 'o1', ORDER_STATUS.confirmed)

    expect(mocks.eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'order.status_changed',
        orderId: 'o1',
        status: ORDER_STATUS.confirmed,
        branchId: 'b1',
        branchLocation: { latitude: -34.6, longitude: -58.4 },
        deliveryAddress,
      }),
    )
  })

  it('publica ubicación cero si la sucursal ya no existe', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(order({ status: ORDER_STATUS.pending }))
    mocks.orderService.applyTransition.mockResolvedValue({
      order: order({ status: ORDER_STATUS.confirmed }),
      changed: true,
    })
    mocks.branchService.findById.mockResolvedValue(null)

    await mocks.orchestrator.changeStatus(admin('b1'), 'o1', ORDER_STATUS.confirmed)

    expect(mocks.eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ branchLocation: { latitude: 0, longitude: 0 } }),
    )
  })

  it('no descuenta ni publica si el estado no cambió (idempotencia)', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(order({ status: ORDER_STATUS.confirmed }))
    mocks.orderService.applyTransition.mockResolvedValue({
      order: order({ status: ORDER_STATUS.confirmed }),
      changed: false,
    })

    const result = await mocks.orchestrator.changeStatus(admin('b1'), 'o1', ORDER_STATUS.confirmed)

    expect(result.status).toBe(ORDER_STATUS.confirmed)
    expect(mocks.stockService.discount).not.toHaveBeenCalled()
    expect(mocks.eventBus.publish).not.toHaveBeenCalled()
    expect(mocks.branchService.findById).not.toHaveBeenCalled()
  })

  it('rechaza con ORDER_NOT_FOUND si el pedido no existe', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(null)

    await expect(
      mocks.orchestrator.changeStatus(admin('b1'), 'o1', ORDER_STATUS.confirmed),
    ).rejects.toMatchObject({ code: ERROR_CODES.orderNotFound, status: 404 })
    expect(mocks.orderService.applyTransition).not.toHaveBeenCalled()
  })

  it('rechaza con ORDER_NOT_FOUND si el pedido desaparece durante la transición', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(order({ status: ORDER_STATUS.pending }))
    mocks.orderService.applyTransition.mockResolvedValue(null)

    await expect(
      mocks.orchestrator.changeStatus(admin('b1'), 'o1', ORDER_STATUS.confirmed),
    ).rejects.toMatchObject({ code: ERROR_CODES.orderNotFound, status: 404 })
  })
})

describe('OrderOrchestrator.repeat — reconstrucción del carrito (RQ-ORD-17)', () => {
  const orderItem = (productId: string, overrides: Partial<PublicOrder['items'][number]> = {}) => ({
    productId,
    name: `Producto ${productId}`,
    unitPrice: 100,
    quantity: 1,
    observations: null,
    subtotal: 100,
    options: [],
    ...overrides,
  })

  it('omite productos pausados y ausentes, y reconstruye el carrito con los disponibles', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(
      order({
        clientId: 'c1',
        items: [
          orderItem('p1', {
            quantity: 2,
            observations: 'sin sal',
            options: [{ optionId: 'opt1', name: 'Doble', extraPrice: 50 }],
          }),
          orderItem('p2'),
          orderItem('missing'),
        ],
      }),
    )
    mocks.productService.findById.mockImplementation((id: string) => {
      if (id === 'p1') return Promise.resolve(product())
      if (id === 'p2') return Promise.resolve(product({ id: 'p2', available: false }))
      return Promise.resolve(null)
    })
    mocks.cartOrchestrator.replaceItems.mockResolvedValue({ id: 'cart2' })

    const result = await mocks.orchestrator.repeat('c1', 'o1')

    expect(mocks.cartOrchestrator.replaceItems).toHaveBeenCalledWith('c1', [
      {
        productId: 'p1',
        quantity: 2,
        observations: 'sin sal',
        optionIds: ['opt1'],
      },
    ])
    expect(result.skippedProducts.map((entry) => entry.id)).toEqual(['p2'])
    expect(result.cart.id).toBe('cart2')
  })

  it('rechaza con ORDER_NOT_FOUND si el pedido no existe', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(null)

    await expect(mocks.orchestrator.repeat('c1', 'o1')).rejects.toMatchObject({
      code: ERROR_CODES.orderNotFound,
      status: 404,
    })
    expect(mocks.cartOrchestrator.replaceItems).not.toHaveBeenCalled()
  })

  it('reconstruye un carrito vacío si ningún producto está disponible', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(
      order({ clientId: 'c1', items: [orderItem('p2')] }),
    )
    mocks.productService.findById.mockResolvedValue(product({ id: 'p2', available: false }))
    mocks.cartOrchestrator.replaceItems.mockResolvedValue({ id: 'cart2' })

    const result = await mocks.orchestrator.repeat('c1', 'o1')

    expect(mocks.cartOrchestrator.replaceItems).toHaveBeenCalledWith('c1', [])
    expect(result.skippedProducts.map((entry) => entry.id)).toEqual(['p2'])
  })
})

describe('OrderOrchestrator.releaseRider (RQ-ORD-16)', () => {
  const rider = (userId: string): AuthContext => ({
    authenticated: true,
    userId,
    roles: [ROLES.rider],
    branchId: null,
    internal: false,
  })

  it('el rider solo puede liberar antes del retiro y publica el evento', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(
      order({ riderId: 'r1', status: ORDER_STATUS.readyForDelivery }),
    )
    mocks.orderService.releaseRider.mockResolvedValue({
      order: order({ riderId: null, status: ORDER_STATUS.readyForDelivery }),
      changed: true,
    })
    mocks.branchService.findById.mockResolvedValue(branch())

    await mocks.orchestrator.releaseRider(rider('r1'), 'o1')

    expect(mocks.orderService.releaseRider).toHaveBeenCalledWith('o1', { allowAfterPickup: false })
    expect(mocks.eventBus.publish).toHaveBeenCalled()
  })

  it('branch/admin pueden liberar aunque el pedido ya se haya retirado', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(
      order({ riderId: 'r1', status: ORDER_STATUS.onTheWay }),
    )
    mocks.orderService.releaseRider.mockResolvedValue({
      order: order({ riderId: null, status: ORDER_STATUS.cancelled, cancelReason: 'lost' }),
      changed: true,
    })
    mocks.branchService.findById.mockResolvedValue(branch())

    await mocks.orchestrator.releaseRider(superAdmin(), 'o1')

    expect(mocks.orderService.releaseRider).toHaveBeenCalledWith('o1', { allowAfterPickup: true })
  })

  it('rechaza al rider que no es dueño del pedido', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(order({ riderId: 'r1' }))

    await expect(mocks.orchestrator.releaseRider(rider('r2'), 'o1')).rejects.toMatchObject({
      code: ERROR_CODES.forbidden,
    })
  })

  it('rechaza a un branch_admin de otra sucursal', async () => {
    const mocks = makeOrchestrator()
    mocks.orderService.findById.mockResolvedValue(order({ branchId: 'b1', riderId: 'r1' }))

    await expect(mocks.orchestrator.releaseRider(admin('b2'), 'o1')).rejects.toMatchObject({
      code: ERROR_CODES.forbidden,
    })
  })
})
