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

describe('AuthGuard.canActivate — tabla de casos', () => {
  type Case = {
    name: string
    metadata: Metadata
    authenticated: boolean
    roles: Role[]
    expected: 'ok' | '401' | '403'
  }

  const cases: Case[] = [
    {
      name: 'público sin metadata',
      metadata: {},
      authenticated: false,
      roles: [],
      expected: 'ok',
    },
    {
      name: 'Roles([]) equivale a público',
      metadata: { roles: [] },
      authenticated: false,
      roles: [],
      expected: 'ok',
    },
    {
      name: 'Authenticated() con token válido de cualquier rol',
      metadata: { authenticated: true },
      authenticated: true,
      roles: ['rider'],
      expected: 'ok',
    },
    {
      name: 'Authenticated() sin token',
      metadata: { authenticated: true },
      authenticated: false,
      roles: [],
      expected: '401',
    },
    {
      name: 'Roles(super_admin) con super_admin',
      metadata: { roles: ['super_admin'] },
      authenticated: true,
      roles: ['super_admin'],
      expected: 'ok',
    },
    {
      name: 'Roles(branch_admin, super_admin) con super_admin',
      metadata: { roles: ['branch_admin', 'super_admin'] },
      authenticated: true,
      roles: ['super_admin'],
      expected: 'ok',
    },
    {
      name: 'Roles(branch_admin, super_admin) con rider',
      metadata: { roles: ['branch_admin', 'super_admin'] },
      authenticated: true,
      roles: ['rider'],
      expected: '403',
    },
    {
      name: 'Roles(customer) sin token',
      metadata: { roles: ['customer'] },
      authenticated: false,
      roles: [],
      expected: '401',
    },
    {
      name: 'Roles(customer) autenticado sin roles',
      metadata: { roles: ['customer'] },
      authenticated: true,
      roles: [],
      expected: '403',
    },
    {
      name: 'Authenticated + Roles con rol correcto',
      metadata: { authenticated: true, roles: ['customer'] },
      authenticated: true,
      roles: ['customer'],
      expected: 'ok',
    },
    {
      name: 'Authenticated + Roles con rol incorrecto',
      metadata: { authenticated: true, roles: ['customer'] },
      authenticated: true,
      roles: ['rider'],
      expected: '403',
    },
  ]

  it.each(cases)('$name → $expected', ({ metadata, authenticated, roles, expected }) => {
    const guard = makeGuard(metadata)
    const context = buildContext(authenticated, roles)

    if (expected === 'ok') {
      expect(guard.canActivate(context)).toBe(true)
    } else if (expected === '401') {
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException)
    } else {
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
    }
  })
})
