import { CartService } from '../cart/cart.service'
import { CartOrchestrator } from '../cart/cart.orchestrator'
import type { CartItemData } from '../cart/cart.repository'
import type { PublicBranch } from '../branch/branch.model'
import { BranchService } from '../branch/branch.service'
import { ERROR_CODES, ORDER_STATUS, ROLES } from '../config/constants'
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

const admin = (branchId: string | null): AuthContext => ({
  authenticated: true,
  userId: 'u1',
  roles: [ROLES.branchAdmin],
  branchId,
  internal: false,
})

const makeOrchestrator = () => {
  const orderService = { findById: jest.fn(), create: jest.fn(), applyTransition: jest.fn() }
  const cartService = { findActiveByClient: jest.fn(), confirm: jest.fn() }
  const cartOrchestrator = { replaceItems: jest.fn() }
  const productService = { findByIds: jest.fn(), findById: jest.fn() }
  const branchService = { findAvailable: jest.fn(), findById: jest.fn() }
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
