import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import type { AuthContext } from '../config/security/jwt.service'
import { BranchOrchestrator } from './branch.orchestrator'
import { BranchController } from './branch.controller'
import type { PublicBranch, PublicBranchHour } from './branch.model'
import { BranchService } from './branch.service'
import type { BranchHourDto } from './dto/branch-hours.dto'

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

const auth = (overrides: Partial<AuthContext> = {}): AuthContext => ({
  authenticated: true,
  userId: 'u1',
  roles: [ROLES.branchAdmin],
  branchId: 'b1',
  internal: false,
  ...overrides,
})

const makeController = () => {
  const branchService = {
    list: jest.fn(),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn().mockResolvedValue(null),
    setActive: jest.fn().mockResolvedValue(null),
    updateHours: jest.fn().mockResolvedValue(null),
    findAvailable: jest.fn(),
    getAvailabilityMap: jest.fn(),
    setProductAvailability: jest.fn(),
  }
  const orchestrator = { listProducts: jest.fn(), listZoneProducts: jest.fn() }
  const controller = new BranchController(
    branchService as unknown as BranchService,
    orchestrator as unknown as BranchOrchestrator,
  )
  return { controller, branchService, orchestrator }
}

const captureDomainError = async (promise: Promise<unknown>): Promise<DomainException> => {
  const error = await promise.then(
    () => {
      throw new Error('Se esperaba un DomainException')
    },
    (rejection: unknown) => rejection,
  )
  if (!(error instanceof DomainException)) {
    throw new Error('Se esperaba un DomainException')
  }
  return error
}

const expectDomainError = async (
  promise: Promise<unknown>,
  code: string,
  message: string,
  status: number,
): Promise<void> => {
  const error = await captureDomainError(promise)

  expect(error).toBeInstanceOf(DomainException)
  expect(error).toMatchObject({ code, message })
  expect(error.getStatus()).toBe(status)
}

describe('BranchController — list (RQ-BRN-01)', () => {
  it.each([
    {
      name: 'sin filtros usa paginación por defecto',
      query: {},
      expected: { active: undefined, search: undefined, limit: 20, offset: 0 },
    },
    {
      name: 'respeta filtros y paginación',
      query: { active: true, search: 'cen', limit: 5, offset: 10 },
      expected: { active: true, search: 'cen', limit: 5, offset: 10 },
    },
  ])('$name', async ({ query, expected }) => {
    const { controller, branchService } = makeController()
    branchService.list.mockResolvedValue({ data: [], meta: { total: 0, limit: 20, offset: 0 } })

    await controller.list(query)

    expect(branchService.list).toHaveBeenCalledWith(expected)
  })
})

describe('BranchController — sucursal inexistente (RQ-BRN-07)', () => {
  const cases: Array<{ name: string; invoke: (controller: BranchController) => Promise<unknown> }> =
    [
      { name: 'get', invoke: (controller) => controller.get('missing') },
      { name: 'update', invoke: (controller) => controller.update('missing', {}) },
      {
        name: 'setActive',
        invoke: (controller) => controller.setActive('missing', { active: true }),
      },
      { name: 'getHours', invoke: (controller) => controller.getHours('missing') },
      {
        name: 'updateHours',
        invoke: (controller) => controller.updateHours('missing', { hours: [] }),
      },
    ]

  it.each(cases)('$name → BRANCH_NOT_FOUND (404)', async ({ invoke }) => {
    const { controller } = makeController()

    await expectDomainError(
      invoke(controller),
      ERROR_CODES.branchNotFound,
      'Sucursal no encontrada',
      404,
    )
  })
})

describe('BranchController — CRUD exitoso (RQ-BRN-01/02)', () => {
  it('get devuelve la sucursal encontrada', async () => {
    const { controller, branchService } = makeController()
    branchService.findById.mockResolvedValue(branch())

    await expect(controller.get('b1')).resolves.toMatchObject({ id: 'b1', name: 'Centro' })
  })

  it('create delega el DTO y devuelve la sucursal', async () => {
    const { controller, branchService } = makeController()
    const dto = { name: 'Nueva', addressText: 'Calle 2', latitude: -34.6, longitude: -58.4 }
    branchService.create.mockResolvedValue(branch({ name: 'Nueva' }))

    await expect(controller.create(dto)).resolves.toMatchObject({ name: 'Nueva' })
    expect(branchService.create).toHaveBeenCalledWith(dto)
  })

  it('update delega el patch y devuelve la sucursal', async () => {
    const { controller, branchService } = makeController()
    branchService.update.mockResolvedValue(branch({ name: 'Renombrada' }))

    await expect(controller.update('b1', { name: 'Renombrada' })).resolves.toMatchObject({
      name: 'Renombrada',
    })
    expect(branchService.update).toHaveBeenCalledWith('b1', { name: 'Renombrada' })
  })

  it.each([
    { name: 'activar', active: true },
    { name: 'desactivar', active: false },
  ])('setActive $name delega el booleano', async ({ active }) => {
    const { controller, branchService } = makeController()
    branchService.setActive.mockResolvedValue(branch({ active }))

    await expect(controller.setActive('b1', { active })).resolves.toMatchObject({ active })
    expect(branchService.setActive).toHaveBeenCalledWith('b1', active)
  })

  it('getHours devuelve los horarios de la sucursal', async () => {
    const hours: PublicBranchHour[] = [
      { dayOfWeek: 1, opening: '08:00', closing: '20:00', closed: false },
    ]
    const { controller, branchService } = makeController()
    branchService.findById.mockResolvedValue(branch({ hours }))

    await expect(controller.getHours('b1')).resolves.toEqual(hours)
  })

  it.each([
    {
      name: 'con apertura, cierre y cerrado',
      hours: [{ dayOfWeek: 1, opening: '08:00', closing: '20:00', closed: false }],
      expected: [{ dayOfWeek: 1, opening: '08:00', closing: '20:00', closed: false }],
    },
    {
      name: 'cerrado sin apertura ni cierre → null',
      hours: [{ dayOfWeek: 1, closed: true }],
      expected: [{ dayOfWeek: 1, opening: null, closing: null, closed: true }],
    },
  ] as Array<{ name: string; hours: BranchHourDto[]; expected: PublicBranchHour[] }>)(
    'updateHours mapea el DTO ($name)',
    async ({ hours, expected }) => {
      const { controller, branchService } = makeController()
      branchService.updateHours.mockResolvedValue(branch({ hours: expected }))

      const result = await controller.updateHours('b1', { hours })

      expect(branchService.updateHours).toHaveBeenCalledWith('b1', expected)
      expect(result).toEqual(expected)
    },
  )

  it('available convierte lat/lng a número', async () => {
    const { controller, branchService } = makeController()
    branchService.findAvailable.mockResolvedValue([branch()])

    await expect(controller.available('-34.6', '-58.4')).resolves.toHaveLength(1)
    expect(branchService.findAvailable).toHaveBeenCalledWith(-34.6, -58.4)
  })

  it('availableProducts delega en el orchestrator con lat/lng numéricos', async () => {
    const { controller, orchestrator } = makeController()
    orchestrator.listZoneProducts.mockResolvedValue({ data: [] })

    await expect(controller.availableProducts('0', '0')).resolves.toEqual({ data: [] })
    expect(orchestrator.listZoneProducts).toHaveBeenCalledWith(0, 0)
  })
})

describe('BranchController — control de acceso (RQ-SEC-05)', () => {
  it.each([
    {
      name: 'super_admin sin sucursal asignada',
      auth: auth({ roles: [ROLES.superAdmin], branchId: null }),
    },
    { name: 'branch_admin con su propia sucursal', auth: auth({ branchId: 'b1' }) },
  ])('$name accede a listProducts', async ({ auth: context }) => {
    const { controller, orchestrator } = makeController()
    orchestrator.listProducts.mockResolvedValue({ data: [] })

    await expect(controller.listProducts(context, 'b1')).resolves.toEqual({ data: [] })
    expect(orchestrator.listProducts).toHaveBeenCalledWith('b1')
  })

  it.each([
    { name: 'otra sucursal', branchId: 'b2' },
    { name: 'sin sucursal asignada', branchId: null },
  ])('branch_admin de $name → FORBIDDEN (403) en listProducts', async ({ branchId }) => {
    const { controller, orchestrator } = makeController()

    await expectDomainError(
      controller.listProducts(auth({ branchId }), 'b1'),
      ERROR_CODES.forbidden,
      'Sin acceso a esta sucursal',
      403,
    )
    expect(orchestrator.listProducts).not.toHaveBeenCalled()
  })

  it('super_admin puede cambiar la disponibilidad de cualquier sucursal', async () => {
    const { controller, branchService } = makeController()
    branchService.setProductAvailability.mockResolvedValue(undefined)

    await expect(
      controller.setProductAvailability(
        auth({ roles: [ROLES.superAdmin], branchId: null }),
        'b1',
        'p1',
        { available: false },
      ),
    ).resolves.toEqual({ ok: true })
    expect(branchService.setProductAvailability).toHaveBeenCalledWith('b1', 'p1', false)
  })

  it('branch_admin ajeno → FORBIDDEN (403) en setProductAvailability y no llama al servicio', async () => {
    const { controller, branchService } = makeController()

    await expectDomainError(
      controller.setProductAvailability(auth({ branchId: 'b2' }), 'b1', 'p1', { available: true }),
      ERROR_CODES.forbidden,
      'Sin acceso a esta sucursal',
      403,
    )
    expect(branchService.setProductAvailability).not.toHaveBeenCalled()
  })
})
