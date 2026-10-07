import 'reflect-metadata'
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import jwt from 'jsonwebtoken'
import { HEADERS, ROLES } from '../constants'
import { env } from '../env'
import { AUTHENTICATED_KEY } from './authenticated.decorator'
import { INTERNAL_KEY } from './internal.decorator'
import { JwtService } from './jwt.service'
import { RolesGuard } from './roles.guard'
import { ROLES_KEY } from './roles.decorator'

type Headers = Record<string, string | string[] | undefined>

const makeContext = (headers: Headers = {}) => {
  const request: { headers: Headers; user?: unknown } = { headers }
  const context = {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
  return { context, request }
}

const makeGuard = (meta: Record<string, unknown>, jwtService: JwtService = new JwtService()) => {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => meta[key]),
  } as unknown as Reflector
  return new RolesGuard(reflector, jwtService)
}

const tokenFor = (userId: string, roles: string[], branchId?: string): string =>
  jwt.sign({ userId, roles, branchId }, env.jwtSecret)

describe('Commerce RolesGuard (RQ-SEC-04)', () => {
  it('permite rutas públicas sin metadatos', () => {
    const guard = makeGuard({})
    const { context, request } = makeContext()

    expect(guard.canActivate(context)).toBe(true)
    expect(request.user).toMatchObject({ authenticated: false, userId: null })
  })

  it.each([
    { name: 'rol exacto', required: [ROLES.customer], token: ['customer'], allowed: true },
    { name: 'rol insuficiente', required: [ROLES.superAdmin], token: ['customer'], allowed: false },
    {
      name: 'uno de varios',
      required: [ROLES.branchAdmin, ROLES.superAdmin],
      token: [ROLES.branchAdmin],
      allowed: true,
    },
  ])('$name → permitido=$allowed', ({ required, token, allowed }) => {
    const guard = makeGuard({ [ROLES_KEY]: required })
    const { context } = makeContext({
      [HEADERS.authorization]: `Bearer ${tokenFor('u1', token as unknown as string[])}`,
    })

    if (allowed) {
      expect(guard.canActivate(context)).toBe(true)
    } else {
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
    }
  })

  it('rechaza con 401 una ruta autenticada sin token', () => {
    const guard = makeGuard({ [AUTHENTICATED_KEY]: true })

    expect(() => guard.canActivate(makeContext().context)).toThrow(UnauthorizedException)
  })

  it('autoriza el acceso interno con el token correcto', () => {
    const jwtService = { verify: jest.fn() } as unknown as JwtService
    const guard = makeGuard({ [INTERNAL_KEY]: true }, jwtService)
    const { context, request } = makeContext({ [HEADERS.internalToken]: env.internalApiToken })

    expect(guard.canActivate(context)).toBe(true)
    expect(request.user).toMatchObject({ internal: true })
    expect(jwtService.verify).not.toHaveBeenCalled()
  })

  it('rechaza con 401 un endpoint interno con token incorrecto y sin JWT (regresión de seguridad)', () => {
    const guard = makeGuard({ [INTERNAL_KEY]: true })
    const { context } = makeContext({ [HEADERS.internalToken]: 'token-incorrecto' })

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException)
  })

  it('permite un endpoint interno con JWT válido cuando el token interno no coincide', () => {
    const guard = makeGuard({ [INTERNAL_KEY]: true })
    const { context, request } = makeContext({
      [HEADERS.internalToken]: 'token-incorrecto',
      [HEADERS.authorization]: `Bearer ${tokenFor('u1', [ROLES.superAdmin])}`,
    })

    expect(guard.canActivate(context)).toBe(true)
    expect(request.user).toMatchObject({ authenticated: true, userId: 'u1' })
  })
})
