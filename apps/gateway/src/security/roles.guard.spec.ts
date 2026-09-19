import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import jwt from 'jsonwebtoken'
import { RolesGuard } from './roles.guard'
import { JwtService } from './jwt.service'
import { env } from '../config/env'
import { Role } from '../config/constants'

const sign = (payload: object, options?: jwt.SignOptions): string =>
  jwt.sign(payload, env.jwtSecret, options)

const buildContext = (authorization?: string): ExecutionContext => {
  const request = { headers: authorization ? { authorization } : {} }

  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}

describe('RolesGuard.canActivate', () => {
  const jwtService = new JwtService()

  const makeGuard = (requiredRoles: Role[] | undefined): RolesGuard => {
    const reflector = {
      getAllAndOverride: jest.fn(() => requiredRoles),
    } as unknown as Reflector

    return new RolesGuard(reflector, jwtService)
  }

  const cases: Array<{
    name: string
    requiredRoles: Role[] | undefined
    token: string | undefined
    expected: 'ok' | 'unauthorized' | 'forbidden'
  }> = [
    {
      name: 'sin roles requeridos → permite',
      requiredRoles: undefined,
      token: undefined,
      expected: 'ok',
    },
    {
      name: 'lista de roles vacía → permite',
      requiredRoles: [],
      token: undefined,
      expected: 'ok',
    },
    {
      name: 'token válido con rol requerido → permite',
      requiredRoles: ['customer'],
      token: sign({ userId: 'u1', roles: ['customer'] }),
      expected: 'ok',
    },
    {
      name: 'varios roles, uno coincide → permite',
      requiredRoles: ['branch_admin', 'super_admin'],
      token: sign({ userId: 'u1', roles: ['branch_admin'] }),
      expected: 'ok',
    },
    {
      name: 'super_admin requiere super_admin → permite',
      requiredRoles: ['super_admin'],
      token: sign({ userId: 'u1', roles: ['super_admin'] }),
      expected: 'ok',
    },
    {
      name: 'varios roles requeridos, coincide super_admin → permite',
      requiredRoles: ['branch_admin', 'super_admin'],
      token: sign({ userId: 'u1', roles: ['super_admin'] }),
      expected: 'ok',
    },
    {
      name: 'token con varios roles, uno coincide → permite',
      requiredRoles: ['rider'],
      token: sign({ userId: 'u1', roles: ['customer', 'rider'] }),
      expected: 'ok',
    },
    {
      name: 'sin token → 401',
      requiredRoles: ['customer'],
      token: undefined,
      expected: 'unauthorized',
    },
    {
      name: 'token expirado → 401',
      requiredRoles: ['customer'],
      token: sign({ userId: 'u1', roles: ['customer'] }, { expiresIn: -10 }),
      expected: 'unauthorized',
    },
    {
      name: 'token malformado → 401',
      requiredRoles: ['customer'],
      token: 'no-es-un-jwt',
      expected: 'unauthorized',
    },
    {
      name: 'firma ajena → 401',
      requiredRoles: ['customer'],
      token: jwt.sign({ userId: 'u1', roles: ['customer'] }, 'otro-secreto'),
      expected: 'unauthorized',
    },
    {
      name: 'token válido sin el rol requerido → 403',
      requiredRoles: ['super_admin'],
      token: sign({ userId: 'u1', roles: ['customer'] }),
      expected: 'forbidden',
    },
    {
      name: 'token válido sin ningún rol → 403',
      requiredRoles: ['customer'],
      token: sign({ userId: 'u1', roles: [] }),
      expected: 'forbidden',
    },
  ]

  it.each(cases)('$name', ({ requiredRoles, token, expected }) => {
    const guard = makeGuard(requiredRoles)
    const context = buildContext(token)

    if (expected === 'ok') {
      expect(guard.canActivate(context)).toBe(true)
    } else if (expected === 'unauthorized') {
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException)
    } else {
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
    }
  })
})
