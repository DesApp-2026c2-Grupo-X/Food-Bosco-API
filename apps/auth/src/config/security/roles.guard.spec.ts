import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import jwt from 'jsonwebtoken'
import { HEADERS, Role } from '../constants'
import { env } from '../env'
import { AUTHENTICATED_KEY } from './authenticated.decorator'
import { INTERNAL_KEY } from './internal.decorator'
import { JwtService } from './jwt.service'
import { ROLES_KEY } from './roles.decorator'
import { RolesGuard } from './roles.guard'

type Metadata = { roles?: Role[]; authenticated?: boolean; internal?: boolean }

const sign = (payload: object, options?: jwt.SignOptions): string =>
  jwt.sign(payload, env.jwtSecret, options)

const makeGuard = (metadata: Metadata): RolesGuard => {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === ROLES_KEY) return metadata.roles
      if (key === AUTHENTICATED_KEY) return metadata.authenticated
      if (key === INTERNAL_KEY) return metadata.internal
      return undefined
    }),
  }

  return new RolesGuard(reflector as unknown as Reflector, new JwtService())
}

const buildContext = (headers: Record<string, string | string[] | undefined> = {}) => {
  const request: { headers: Record<string, string | string[] | undefined>; user?: unknown } = {
    headers,
  }
  return {
    request,
    executionContext: {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
  }
}

const captureError = (fn: () => unknown): { status?: number; message?: string; name?: string } => {
  try {
    fn()
  } catch (error) {
    const httpError = error as { getStatus?: () => number; message?: string; name?: string }
    return { status: httpError.getStatus?.(), message: httpError.message, name: httpError.name }
  }
  return {}
}

const bearer = (payload: object, options?: jwt.SignOptions): string => `Bearer ${sign(payload, options)}`

describe('RolesGuard.canActivate (RQ-SEC-04)', () => {
  it('permite rutas públicas (sin roles ni autenticación)', () => {
    const guard = makeGuard({})
    const context = buildContext()

    expect(guard.canActivate(context.executionContext)).toBe(true)
    expect(context.request.user).toEqual({
      authenticated: false,
      userId: null,
      roles: [],
      branchId: null,
    })
  })

  it('permite un usuario autenticado y puebla request.user con roles y branchId', () => {
    const guard = makeGuard({ authenticated: true })
    const context = buildContext({
      authorization: bearer({ userId: 'u1', roles: ['branch_admin'], branchId: 'b7' }),
    })

    expect(guard.canActivate(context.executionContext)).toBe(true)
    expect(context.request.user).toEqual({
      authenticated: true,
      userId: 'u1',
      roles: ['branch_admin'],
      branchId: 'b7',
    })
  })

  it('rechaza una ruta autenticada sin token', () => {
    const guard = makeGuard({ authenticated: true })

    expect(() => guard.canActivate(buildContext().executionContext)).toThrow(UnauthorizedException)
  })

  it('rechaza una ruta autenticada con token expirado', () => {
    const guard = makeGuard({ authenticated: true })
    const context = buildContext({
      authorization: bearer({ userId: 'u1', roles: ['customer'] }, { expiresIn: -10 }),
    })

    expect(() => guard.canActivate(context.executionContext)).toThrow(UnauthorizedException)
  })

  it.each<{ name: string; required: Role[]; tokenRoles: Role[]; allowed: boolean }>([
    { name: 'rol exacto', required: ['customer'], tokenRoles: ['customer'], allowed: true },
    { name: 'rol distinto', required: ['customer'], tokenRoles: ['rider'], allowed: false },
    {
      name: 'uno de varios roles requeridos',
      required: ['super_admin', 'branch_admin'],
      tokenRoles: ['branch_admin'],
      allowed: true,
    },
    {
      name: 'ninguno de varios roles requeridos',
      required: ['super_admin', 'branch_admin'],
      tokenRoles: ['customer'],
      allowed: false,
    },
    {
      name: 'rol presente junto a otros',
      required: ['rider'],
      tokenRoles: ['customer', 'rider'],
      allowed: true,
    },
  ])('$name → permitido=$allowed', ({ required, tokenRoles, allowed }) => {
    const guard = makeGuard({ roles: required })
    const context = buildContext({ authorization: bearer({ userId: 'u1', roles: tokenRoles }) })

    if (allowed) {
      expect(guard.canActivate(context.executionContext)).toBe(true)
    } else {
      expect(() => guard.canActivate(context.executionContext)).toThrow(ForbiddenException)
    }
  })

  it('rechaza con 403 FORBIDDEN y mensaje cuando el rol es insuficiente', () => {
    const guard = makeGuard({ roles: ['super_admin'] })
    const context = buildContext({ authorization: bearer({ userId: 'u1', roles: ['customer'] }) })

    const error = captureError(() => guard.canActivate(context.executionContext))

    expect(error.name).toBe('ForbiddenException')
    expect(error.status).toBe(403)
    expect(error.message).toBe('Forbidden')
  })

  it('rechaza con 401 UNAUTHENTICATED y mensaje cuando falta el token para un rol', () => {
    const guard = makeGuard({ roles: ['super_admin'] })
    const error = captureError(() => guard.canActivate(buildContext().executionContext))

    expect(error.name).toBe('UnauthorizedException')
    expect(error.status).toBe(401)
    expect(error.message).toBe('Unauthorized')
  })

  it('un token con roles no arreglo no habilita el rol requerido', () => {
    const guard = makeGuard({ roles: ['super_admin'] })
    const context = buildContext({ authorization: bearer({ userId: 'u1', roles: 'customer' }) })

    expect(() => guard.canActivate(context.executionContext)).toThrow(ForbiddenException)
  })

  it('acepta el header Authorization como arreglo tomando el primer valor', () => {
    const guard = makeGuard({ authenticated: true })
    const context = buildContext({
      authorization: [bearer({ userId: 'u1', roles: ['rider'] }), 'Bearer otro'],
    })

    expect(guard.canActivate(context.executionContext)).toBe(true)
    expect(context.request.user).toMatchObject({ userId: 'u1' })
  })
})

describe('RolesGuard scope de super_admin (RQ-SEC-04/05)', () => {
  it('super_admin sólo satisface el rol super_admin (sin escalada implícita)', () => {
    const guard = makeGuard({ roles: ['super_admin'] })
    const context = buildContext({ authorization: bearer({ userId: 'u1', roles: ['super_admin'] }) })

    expect(guard.canActivate(context.executionContext)).toBe(true)
  })

  it('super_admin no satisface un rol de sucursal requerido', () => {
    const guard = makeGuard({ roles: ['branch_admin'] })
    const context = buildContext({ authorization: bearer({ userId: 'u1', roles: ['super_admin'] }) })

    expect(() => guard.canActivate(context.executionContext)).toThrow(ForbiddenException)
  })

  it('branch_admin no satisface el rol super_admin requerido', () => {
    const guard = makeGuard({ roles: ['super_admin'] })
    const context = buildContext({
      authorization: bearer({ userId: 'u1', roles: ['branch_admin'], branchId: 'b7' }),
    })

    expect(() => guard.canActivate(context.executionContext)).toThrow(ForbiddenException)
  })

  it('expone el branchId del admin de sucursal en request.user', () => {
    const guard = makeGuard({ roles: ['branch_admin'] })
    const context = buildContext({
      authorization: bearer({ userId: 'u1', roles: ['branch_admin'], branchId: 'b7' }),
    })

    expect(guard.canActivate(context.executionContext)).toBe(true)
    expect(context.request.user).toMatchObject({ branchId: 'b7' })
  })
})

describe('RolesGuard acceso interno (RQ-AUTH-17)', () => {
  it('permite el acceso interno con X-Internal-Token válido aunque se requiera un rol', () => {
    const guard = makeGuard({ roles: ['super_admin'], internal: true })
    const context = buildContext({ [HEADERS.internalToken]: env.internalApiToken })

    expect(guard.canActivate(context.executionContext)).toBe(true)
    expect(context.request.user).toEqual({
      authenticated: false,
      userId: null,
      roles: [],
      branchId: null,
    })
  })

  it('rechaza el acceso interno con token incorrecto y sin JWT válido', () => {
    const guard = makeGuard({ roles: ['super_admin'], internal: true })
    const context = buildContext({ [HEADERS.internalToken]: 'token-incorrecto' })

    expect(() => guard.canActivate(context.executionContext)).toThrow(UnauthorizedException)
  })

  it('si el endpoint no permite acceso interno, el token interno no basta', () => {
    const guard = makeGuard({ roles: ['super_admin'], internal: false })
    const context = buildContext({ [HEADERS.internalToken]: env.internalApiToken })

    expect(() => guard.canActivate(context.executionContext)).toThrow(UnauthorizedException)
  })

  it('con token interno incorrecto pero JWT válido usa el JWT y valida el rol', () => {
    const guard = makeGuard({ roles: ['super_admin'], internal: true })
    const context = buildContext({
      [HEADERS.internalToken]: 'token-incorrecto',
      authorization: bearer({ userId: 'u1', roles: ['super_admin'] }),
    })

    expect(guard.canActivate(context.executionContext)).toBe(true)
    expect(context.request.user).toMatchObject({ authenticated: true, userId: 'u1' })
  })
})
