import 'reflect-metadata'
import { ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import type { AuthContext } from '../config/security/jwt.service'
import { ROLES_KEY } from '../config/security/roles.decorator'
import { OrderController } from './order.controller'
import type { PublicOrder } from './order.model'
import { OrderOrchestrator } from './order.orchestrator'
import { OrderService } from './order.service'

const order = (overrides: Partial<PublicOrder> = {}): PublicOrder => ({
  id: 'o1',
  number: '000001',
  clientId: 'c1',
  branchId: 'b1',
  addressId: 'a1',
  deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
  status: 'pending',
  total: 100,
  estimatedDeliveryAt: null,
  riderId: null,
  tripId: null,
  items: [],
  statusHistory: [],
  availableTransitions: ['confirmed'],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const auth = (overrides: Partial<AuthContext> = {}): AuthContext => ({
  authenticated: true,
  userId: 'u1',
  roles: [ROLES.customer],
  branchId: null,
  internal: false,
  ...overrides,
})

const makeController = () => {
  const orderService = {
    list: jest.fn().mockResolvedValue({ data: [], meta: { total: 0, limit: 20, offset: 0 } }),
    findById: jest.fn(),
  }
  const orchestrator = {
    create: jest.fn(),
    changeStatus: jest.fn(),
    repeat: jest.fn(),
  }
  const controller = new OrderController(
    orderService as unknown as OrderService,
    orchestrator as unknown as OrderOrchestrator,
  )
  return { controller, orderService, orchestrator }
}

describe('OrderController.list — scope por rol (RQ-SEC-04)', () => {
  it('un cliente solo ve sus pedidos', async () => {
    const { controller, orderService } = makeController()

    await controller.list(auth({ roles: [ROLES.customer], userId: 'c1' }), {})

    expect(orderService.list).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'c1', branchId: undefined }),
    )
  })

  it('un admin de sucursal queda acotado a su sucursal', async () => {
    const { controller, orderService } = makeController()

    await controller.list(auth({ roles: [ROLES.branchAdmin], branchId: 'b7' }), {})

    expect(orderService.list).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'b7' }))
  })

  it('un admin de sucursal sin sucursal asignada recibe 403', () => {
    const { controller } = makeController()

    expect(() => controller.list(auth({ roles: [ROLES.branchAdmin], branchId: null }), {})).toThrow(
      DomainException,
    )
    try {
      controller.list(auth({ roles: [ROLES.branchAdmin], branchId: null }), {})
    } catch (error) {
      expect(error).toMatchObject({ status: 403 })
    }
  })

  it('rechaza con 401 a un customer sin userId en lugar de listar sin scope (NEW-20)', () => {
    const { controller, orderService } = makeController()

    expect(() => controller.list(auth({ roles: [ROLES.customer], userId: null }), {})).toThrow(
      DomainException,
    )
    try {
      controller.list(auth({ roles: [ROLES.customer], userId: null }), {})
    } catch (error) {
      expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
    }
    expect(orderService.list).not.toHaveBeenCalled()
  })

  it('un super_admin puede filtrar por cualquier sucursal', async () => {
    const { controller, orderService } = makeController()

    await controller.list(auth({ roles: [ROLES.superAdmin] }), { branchId: 'b9' })

    expect(orderService.list).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'b9', clientId: undefined }),
    )
  })
})

describe('OrderController.list — roles permitidos (RQ-SEC-04)', () => {
  it('restringe el listado a customer, branch_admin y super_admin (excluye rider)', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, OrderController.prototype.list) as string[]

    expect(roles).toEqual(
      expect.arrayContaining([ROLES.customer, ROLES.branchAdmin, ROLES.superAdmin]),
    )
    expect(roles).not.toContain(ROLES.rider)
  })
})

describe('OrderController.get — visibilidad (assertCanView)', () => {
  it.each([
    { name: 'dueño', ctx: auth({ userId: 'c1' }), doc: order({ clientId: 'c1' }), ok: true },
    {
      name: 'admin de la sucursal',
      ctx: auth({ roles: [ROLES.branchAdmin], branchId: 'b1' }),
      doc: order({ branchId: 'b1' }),
      ok: true,
    },
    { name: 'super_admin', ctx: auth({ roles: [ROLES.superAdmin] }), doc: order(), ok: true },
    {
      name: 'rider asignado',
      ctx: auth({ roles: [ROLES.rider], userId: 'r1' }),
      doc: order({ riderId: 'r1' }),
      ok: true,
    },
    {
      name: 'rider no asignado',
      ctx: auth({ roles: [ROLES.rider], userId: 'r1' }),
      doc: order({ riderId: 'r2' }),
      ok: false,
    },
    {
      name: 'cliente ajeno',
      ctx: auth({ userId: 'otro' }),
      doc: order({ clientId: 'c1' }),
      ok: false,
    },
  ])('$name → ok=$ok', async ({ ctx, doc, ok }) => {
    const { controller, orderService } = makeController()
    orderService.findById.mockResolvedValue(doc)

    if (ok) {
      await expect(controller.get(ctx, 'o1')).resolves.toEqual(doc)
    } else {
      await expect(controller.get(ctx, 'o1')).rejects.toMatchObject({ status: 404 })
    }
  })

  it('lanza 404 si el pedido no existe', async () => {
    const { controller, orderService } = makeController()
    orderService.findById.mockResolvedValue(null)

    await expect(controller.get(auth(), 'o1')).rejects.toBeInstanceOf(DomainException)
  })
})

describe('OrderController.create / changeStatus / repeat', () => {
  it('create delega en el orchestrator con el userId', async () => {
    const { controller, orchestrator } = makeController()

    await controller.create(auth({ userId: 'c1' }), {} as never)

    expect(orchestrator.create).toHaveBeenCalledWith('c1', {})
  })

  it('changeStatus delega en el orchestrator con el contexto', async () => {
    const { controller, orchestrator } = makeController()
    const ctx = auth({ roles: [ROLES.branchAdmin], branchId: 'b1' })

    await controller.changeStatus(ctx, 'o1', { status: 'confirmed' })

    expect(orchestrator.changeStatus).toHaveBeenCalledWith(ctx, 'o1', 'confirmed')
  })

  it('repeat delega en el orchestrator con el userId', async () => {
    const { controller, orchestrator } = makeController()

    await controller.repeat(auth({ userId: 'c1' }), 'o1')

    expect(orchestrator.repeat).toHaveBeenCalledWith('c1', 'o1')
  })
})
