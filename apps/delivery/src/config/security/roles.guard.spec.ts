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

const tokenFor = (userId: string, roles: string[]): string =>
  jwt.sign({ userId, roles }, env.jwtSecret)

describe('RolesGuard (RQ-SEC)', () => {
  it('permite el paso sin metadatos y deja el usuario anónimo en el request', () => {
    const guard = makeGuard({})
    const { context, request } = makeContext()

    expect(guard.canActivate(context)).toBe(true)
    expect(request.user).toMatchObject({ authenticated: false, userId: null })
  })

  it('permite el paso con autenticación requerida y token válido', () => {
    const guard = makeGuard({ [AUTHENTICATED_KEY]: true })
    const { context, request } = makeContext({
      [HEADERS.authorization]: `Bearer ${tokenFor('u1', ['rider'])}`,
    })

    expect(guard.canActivate(context)).toBe(true)
    expect(request.user).toMatchObject({ authenticated: true, userId: 'u1' })
  })

  it('rechaza con 401 cuando se exige autenticación y no hay token', () => {
    const guard = makeGuard({ [AUTHENTICATED_KEY]: true })
    const { context } = makeContext()

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException)
    try {
      guard.canActivate(context)
    } catch (error) {
      expect((error as UnauthorizedException).getStatus()).toBe(401)
    }
  })

  it('permite el paso cuando el rol requerido está presente', () => {
    const guard = makeGuard({ [ROLES_KEY]: [ROLES.rider] })
    const { context, request } = makeContext({
      [HEADERS.authorization]: `Bearer ${tokenFor('u1', ['rider', 'customer'])}`,
    })

    expect(guard.canActivate(context)).toBe(true)
    expect(request.user).toMatchObject({ roles: ['rider', 'customer'] })
  })

  it('rechaza con 403 cuando el token no tiene el rol requerido', () => {
    const guard = makeGuard({ [ROLES_KEY]: [ROLES.rider] })
    const { context } = makeContext({
      [HEADERS.authorization]: `Bearer ${tokenFor('u1', ['customer'])}`,
    })

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
    try {
      guard.canActivate(context)
    } catch (error) {
      expect((error as ForbiddenException).getStatus()).toBe(403)
    }
  })

  it('rechaza con 401 cuando hay rol requerido pero no hay token', () => {
    const guard = makeGuard({ [ROLES_KEY]: [ROLES.rider] })
    const { context } = makeContext()

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException)
  })

  it('acepta el header authorization como arreglo', () => {
    const guard = makeGuard({ [AUTHENTICATED_KEY]: true })
    const { context } = makeContext({
      [HEADERS.authorization]: [`Bearer ${tokenFor('u1', ['rider'])}`],
    })

    expect(guard.canActivate(context)).toBe(true)
  })

  it('autoriza solicitudes internas con el token interno correcto', () => {
    const jwtService = { verify: jest.fn() } as unknown as JwtService
    const guard = makeGuard({ [INTERNAL_KEY]: true }, jwtService)
    const { context, request } = makeContext({
      [HEADERS.internalToken]: env.internalApiToken,
    })

    expect(guard.canActivate(context)).toBe(true)
    expect(request.user).toMatchObject({ internal: true, authenticated: false })
    expect(jwtService.verify).not.toHaveBeenCalled()
  })

  it('ignora el atajo interno cuando el token no coincide (cae a autenticación normal)', () => {
    const guard = makeGuard({ [INTERNAL_KEY]: true })
    const { context, request } = makeContext({ [HEADERS.internalToken]: 'token-incorrecto' })

    expect(guard.canActivate(context)).toBe(true)
    expect(request.user).not.toMatchObject({ internal: true })
  })

  it('rechaza una solicitud interna cuando además se exige rol y no hay token', () => {
    const guard = makeGuard({ [INTERNAL_KEY]: true, [ROLES_KEY]: [ROLES.rider] })
    const { context } = makeContext({ [HEADERS.internalToken]: 'token-incorrecto' })

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException)
  })
})
