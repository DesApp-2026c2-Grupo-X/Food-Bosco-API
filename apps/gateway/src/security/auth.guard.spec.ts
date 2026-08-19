import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { GqlExecutionContext } from '@nestjs/graphql'
import { Role } from '../config/constants'
import { AUTHENTICATED_KEY } from './authenticated.decorator'
import { ROLES_KEY } from './roles.decorator'
import { AuthGuard } from './auth.guard'

type Metadata = { roles?: Role[]; authenticated?: boolean }

const makeGuard = (metadata: Metadata): AuthGuard => {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === ROLES_KEY) return metadata.roles
      if (key === AUTHENTICATED_KEY) return metadata.authenticated
      return undefined
    }),
  }

  return new AuthGuard(reflector as unknown as Reflector)
}

const buildContext = (authenticated: boolean, roles: Role[]): ExecutionContext => {
  jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
    getContext: () => ({ authenticated, roles }),
  } as unknown as GqlExecutionContext)

  return { getHandler: () => ({}), getClass: () => ({}) } as unknown as ExecutionContext
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('AuthGuard.canActivate', () => {
  it('permite operaciones públicas (sin roles ni autenticación)', () => {
    expect(makeGuard({}).canActivate(buildContext(false, []))).toBe(true)
  })

  it('permite un usuario autenticado (cualquier rol)', () => {
    const guard = makeGuard({ authenticated: true })
    expect(guard.canActivate(buildContext(true, ['customer']))).toBe(true)
  })

  it('rechaza con 401 una operación que exige autenticación sin token', () => {
    const guard = makeGuard({ authenticated: true })
    expect(() => guard.canActivate(buildContext(false, []))).toThrow(UnauthorizedException)
  })

  it('permite si el rol del contexto coincide con el requerido', () => {
    const guard = makeGuard({ roles: ['super_admin'] })
    expect(guard.canActivate(buildContext(true, ['super_admin']))).toBe(true)
  })

  it('rechaza con 403 si el rol del contexto no coincide', () => {
    const guard = makeGuard({ roles: ['super_admin'] })
    expect(() => guard.canActivate(buildContext(true, ['customer']))).toThrow(ForbiddenException)
  })

  it('rechaza con 401 si exige rol y el contexto no está autenticado', () => {
    const guard = makeGuard({ roles: ['customer'] })
    expect(() => guard.canActivate(buildContext(false, []))).toThrow(UnauthorizedException)
  })
})
