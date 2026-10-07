import { ERROR_CODES, ROLES } from '../config/constants'
import type { AuthContext } from '../config/security/jwt.service'
import { CategoryController } from './category.controller'
import type { CategoryListResponse } from './category.service'
import { CategoryService } from './category.service'

const auth = (roles: AuthContext['roles']): AuthContext => ({
  authenticated: roles.length > 0,
  userId: 'u1',
  roles,
  branchId: null,
  internal: false,
})

const emptyList: CategoryListResponse = { data: [], meta: { total: 0, limit: 20, offset: 0 } }

const makeController = (
  overrides: Partial<
    Record<'list' | 'findById' | 'create' | 'update' | 'setActive', jest.Mock>
  > = {},
) => {
  const service = {
    list: jest.fn().mockResolvedValue(emptyList),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    ...overrides,
  }
  return { service, controller: new CategoryController(service as unknown as CategoryService) }
}

describe('CategoryController.list — visibilidad por rol (RQ-CAT-05)', () => {
  it.each([
    { name: 'público anónimo sólo ve activas', roles: [] as AuthContext['roles'], expected: true },
    {
      name: 'branch_admin no es admin global, sólo ve activas',
      roles: [ROLES.branchAdmin] as AuthContext['roles'],
      expected: true,
    },
    {
      name: 'super_admin ve todas por defecto',
      roles: [ROLES.superAdmin] as AuthContext['roles'],
      expected: undefined,
    },
  ])('$name', async ({ roles, expected }) => {
    const { service, controller } = makeController()

    await controller.list(auth(roles), {})

    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ activeOnly: expected }))
  })

  it('respeta activeOnly explícito aunque sea super_admin', async () => {
    const { service, controller } = makeController()

    await controller.list(auth([ROLES.superAdmin]), { activeOnly: false })

    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ activeOnly: false }))
  })

  it('aplica paginación por defecto limit 20 / offset 0', async () => {
    const { service, controller } = makeController()

    await controller.list(auth([ROLES.superAdmin]), {})

    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, offset: 0 }))
  })

  it('propaga search, limit y offset explícitos', async () => {
    const { service, controller } = makeController()

    await controller.list(auth([ROLES.superAdmin]), { search: 'beb', limit: 5, offset: 10 })

    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'beb', limit: 5, offset: 10 }),
    )
  })
})

describe('CategoryController.create (RQ-CAT-02)', () => {
  it('delega en el servicio con el DTO recibido', async () => {
    const { service, controller } = makeController({
      create: jest.fn().mockResolvedValue({ id: 'cat1', name: 'Postres', active: true }),
    })

    await expect(controller.create({ name: 'Postres' })).resolves.toMatchObject({ id: 'cat1' })
    expect(service.create).toHaveBeenCalledWith({ name: 'Postres' })
  })
})

describe('CategoryController.get — error de dominio (RQ-CAT-01)', () => {
  it('devuelve la categoría cuando existe', async () => {
    const { controller } = makeController({
      findById: jest.fn().mockResolvedValue({ id: 'cat1', name: 'Bebidas', active: true }),
    })

    await expect(controller.get('cat1')).resolves.toMatchObject({ id: 'cat1' })
  })

  it('lanza CATEGORY_NOT_FOUND 404 con mensaje cuando no existe', async () => {
    const { controller } = makeController({ findById: jest.fn().mockResolvedValue(null) })

    await expect(controller.get('missing')).rejects.toMatchObject({
      code: ERROR_CODES.categoryNotFound,
      message: 'Categoría no encontrada',
      status: 404,
    })
  })
})

describe('CategoryController.update / setActive — error de dominio (RQ-CAT-01)', () => {
  it('lanza CATEGORY_NOT_FOUND 404 al actualizar un id inexistente', async () => {
    const { controller } = makeController({ update: jest.fn().mockResolvedValue(null) })

    await expect(controller.update('missing', { name: 'X' })).rejects.toMatchObject({
      code: ERROR_CODES.categoryNotFound,
      message: 'Categoría no encontrada',
      status: 404,
    })
  })

  it('lanza CATEGORY_NOT_FOUND 404 al activar/desactivar un id inexistente', async () => {
    const { controller } = makeController({ setActive: jest.fn().mockResolvedValue(null) })

    await expect(controller.setActive('missing', { active: false })).rejects.toMatchObject({
      code: ERROR_CODES.categoryNotFound,
      message: 'Categoría no encontrada',
      status: 404,
    })
  })

  it('pasa el nuevo estado al servicio al activar/desactivar', async () => {
    const { service, controller } = makeController({
      setActive: jest.fn().mockResolvedValue({ id: 'cat1', name: 'Bebidas', active: false }),
    })

    await controller.setActive('cat1', { active: false })

    expect(service.setActive).toHaveBeenCalledWith('cat1', false)
  })
})
