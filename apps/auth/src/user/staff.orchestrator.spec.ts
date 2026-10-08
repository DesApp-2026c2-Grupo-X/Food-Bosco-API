import { ServiceUnavailableException } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { CommerceClient } from '../config/http/commerce.client'
import { DomainException } from '../config/exceptions/domain.exception'
import { PublicUser, UserService } from './user.service'
import { CreateStaffInput, StaffOrchestrator } from './staff.orchestrator'

const staffInput: CreateStaffInput = {
  firstName: 'Sofía',
  lastName: 'Sosa',
  email: 'staff@example.com',
  phone: '11223344',
  password: 'password123',
  branchId: 'branch-1',
}

const publicUser = (overrides: Partial<PublicUser> = {}): PublicUser => ({
  id: 'u1',
  email: 'staff@example.com',
  role: ROLES.branchAdmin,
  firstName: 'Sofía',
  lastName: 'Sosa',
  phone: '11223344',
  active: true,
  branchId: 'branch-1',
  vehicle: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

interface CommerceMock {
  branchExists: jest.Mock
}

interface UserServiceMock {
  createUser: jest.Mock
  update: jest.Mock
}

const makeOrchestrator = (overrides: Partial<CommerceMock> = {}) => {
  const commerce: CommerceMock = { branchExists: jest.fn(), ...overrides }
  const userService: UserServiceMock = { createUser: jest.fn(), update: jest.fn() }
  const orchestrator = new StaffOrchestrator(
    userService as unknown as UserService,
    commerce as unknown as CommerceClient,
  )
  return { commerce, userService, orchestrator }
}

describe('StaffOrchestrator.createStaff (RQ-AUTH-13)', () => {
  it('valida la sucursal antes de crear y fuerza el rol branch_admin', async () => {
    const { commerce, userService, orchestrator } = makeOrchestrator()
    commerce.branchExists.mockResolvedValue(true)
    userService.createUser.mockResolvedValue(publicUser())

    const result = await orchestrator.createStaff(staffInput)

    expect(commerce.branchExists).toHaveBeenCalledWith('branch-1')
    expect(userService.createUser).toHaveBeenCalledWith({
      ...staffInput,
      role: ROLES.branchAdmin,
    })
    expect(result.role).toBe(ROLES.branchAdmin)
  })

  it('rechaza con BRANCH_NOT_FOUND 404 cuando la sucursal no existe y no crea el usuario', async () => {
    const { commerce, userService, orchestrator } = makeOrchestrator()
    commerce.branchExists.mockResolvedValue(false)

    await expect(
      orchestrator.createStaff({ ...staffInput, branchId: 'no-existe' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.branchNotFound,
      message: 'Sucursal no encontrada',
      status: 404,
    })
    expect(commerce.branchExists).toHaveBeenCalledWith('no-existe')
    expect(userService.createUser).not.toHaveBeenCalled()
  })

  it('no crea el usuario si el cliente de Commerce lanza un error de gateway', async () => {
    const { commerce, userService, orchestrator } = makeOrchestrator()
    commerce.branchExists.mockRejectedValue(
      new ServiceUnavailableException('Commerce no disponible'),
    )

    await expect(orchestrator.createStaff(staffInput)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
    expect(userService.createUser).not.toHaveBeenCalled()
  })

  it('propaga el error de dominio de alta duplicada del UserService', async () => {
    const { commerce, userService, orchestrator } = makeOrchestrator()
    commerce.branchExists.mockResolvedValue(true)
    userService.createUser.mockRejectedValue(
      new DomainException(ERROR_CODES.emailTaken, 'El correo ya está registrado', 409),
    )

    await expect(orchestrator.createStaff(staffInput)).rejects.toMatchObject({
      code: ERROR_CODES.emailTaken,
      status: 409,
    })
  })
})

describe('StaffOrchestrator.updateUser (NEW-02, RQ-AUTH-13/16)', () => {
  it('actualiza sin consultar Commerce cuando el patch no incluye branchId', async () => {
    const { commerce, userService, orchestrator } = makeOrchestrator()
    userService.update.mockResolvedValue(publicUser({ firstName: 'Ana' }))

    const patch = { firstName: 'Ana' }
    const result = await orchestrator.updateUser('u1', patch)

    expect(commerce.branchExists).not.toHaveBeenCalled()
    expect(userService.update).toHaveBeenCalledWith('u1', patch)
    expect(result?.firstName).toBe('Ana')
  })

  it('valida la sucursal y actualiza cuando branchId existe', async () => {
    const { commerce, userService, orchestrator } = makeOrchestrator()
    commerce.branchExists.mockResolvedValue(true)
    userService.update.mockResolvedValue(publicUser({ branchId: 'branch-2' }))

    const result = await orchestrator.updateUser('u1', { branchId: 'branch-2' })

    expect(commerce.branchExists).toHaveBeenCalledWith('branch-2')
    expect(userService.update).toHaveBeenCalledWith('u1', { branchId: 'branch-2' })
    expect(result?.branchId).toBe('branch-2')
  })

  it('rechaza con BRANCH_NOT_FOUND 404 y no actualiza si la sucursal no existe', async () => {
    const { commerce, userService, orchestrator } = makeOrchestrator()
    commerce.branchExists.mockResolvedValue(false)

    await expect(orchestrator.updateUser('u1', { branchId: 'no-existe' })).rejects.toMatchObject({
      code: ERROR_CODES.branchNotFound,
      message: 'Sucursal no encontrada',
      status: 404,
    })
    expect(userService.update).not.toHaveBeenCalled()
  })

  it('permite limpiar la sucursal (branchId null) sin consultar Commerce', async () => {
    const { commerce, userService, orchestrator } = makeOrchestrator()
    userService.update.mockResolvedValue(publicUser({ branchId: null }))

    const result = await orchestrator.updateUser('u1', { branchId: null })

    expect(commerce.branchExists).not.toHaveBeenCalled()
    expect(userService.update).toHaveBeenCalledWith('u1', { branchId: null })
    expect(result?.branchId).toBeNull()
  })

  it('propaga el error de gateway si Commerce no responde y no actualiza', async () => {
    const { commerce, userService, orchestrator } = makeOrchestrator()
    commerce.branchExists.mockRejectedValue(
      new ServiceUnavailableException('Commerce no disponible'),
    )

    await expect(orchestrator.updateUser('u1', { branchId: 'branch-1' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
    expect(userService.update).not.toHaveBeenCalled()
  })

  it('devuelve null cuando el repositorio no encuentra al usuario', async () => {
    const { userService, orchestrator } = makeOrchestrator()
    userService.update.mockResolvedValue(null)

    await expect(orchestrator.updateUser('u1', { firstName: 'X' })).resolves.toBeNull()
  })
})
