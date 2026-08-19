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

const buildContext = (headers: Record<string, string> = {}) => {
  const request: { headers: Record<string, string>; user?: unknown } = { headers }
  return {
    request,
    executionContext: {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
  }
}

describe('RolesGuard.canActivate', () => {
  it('permite rutas públicas (sin roles ni autenticación)', () => {
    const guard = makeGuard({})

    expect(guard.canActivate(buildContext().executionContext)).toBe(true)
  })

  it('permite un usuario autenticado y puebla request.user', () => {
    const guard = makeGuard({ authenticated: true })
    const context = buildContext({ authorization: `Bearer ${sign({ userId: 'u1', roles: ['customer'] })}` })

    expect(guard.canActivate(context.executionContext)).toBe(true)
    expect(context.request.user).toMatchObject({ authenticated: true, userId: 'u1' })
  })

  it('rechaza una ruta autenticada sin token', () => {
    const guard = makeGuard({ authenticated: true })

    expect(() => guard.canActivate(buildContext().executionContext)).toThrow(UnauthorizedException)
  })

  it('permite si el token tiene el rol requerido', () => {
    const guard = makeGuard({ roles: ['super_admin'] })
    const context = buildContext({ authorization: `Bearer ${sign({ userId: 'u1', roles: ['super_admin'] })}` })

    expect(guard.canActivate(context.executionContext)).toBe(true)
  })

  it('rechaza con 403 si el token no tiene el rol requerido', () => {
    const guard = makeGuard({ roles: ['super_admin'] })
    const context = buildContext({ authorization: `Bearer ${sign({ userId: 'u1', roles: ['customer'] })}` })

    expect(() => guard.canActivate(context.executionContext)).toThrow(ForbiddenException)
  })

  it('rechaza con 401 si falta el token para un rol requerido', () => {
    const guard = makeGuard({ roles: ['super_admin'] })

    expect(() => guard.canActivate(buildContext().executionContext)).toThrow(UnauthorizedException)
  })

  it('permite el acceso interno con X-Internal-Token válido (RQ-AUTH-17)', () => {
    const guard = makeGuard({ roles: ['super_admin'], internal: true })
    const context = buildContext({ [HEADERS.internalToken]: env.internalApiToken })

    expect(guard.canActivate(context.executionContext)).toBe(true)
  })

  it('rechaza el acceso interno con token incorrecto y sin JWT válido', () => {
    const guard = makeGuard({ roles: ['super_admin'], internal: true })
    const context = buildContext({ [HEADERS.internalToken]: 'token-incorrecto' })

    expect(() => guard.canActivate(context.executionContext)).toThrow(UnauthorizedException)
  })
})
