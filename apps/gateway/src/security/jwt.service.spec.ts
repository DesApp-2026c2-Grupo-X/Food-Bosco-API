import jwt from 'jsonwebtoken'
import { JwtService } from './jwt.service'
import { env } from '../config/env'
import { Role } from '../config/constants'

const sign = (payload: object, options?: jwt.SignOptions): string =>
  jwt.sign(payload, env.jwtSecret, options)

describe('JwtService.verify', () => {
  const service = new JwtService()

  const cases: Array<{
    name: string
    token: () => string | undefined
    authenticated: boolean
    userId?: string | null
    roles?: Role[]
    branchId?: string | null
  }> = [
    {
      name: 'token válido con roles y branchId',
      token: () => sign({ userId: 'u1', roles: ['customer'], branchId: 'b1' }),
      authenticated: true,
      userId: 'u1',
      roles: ['customer'],
      branchId: 'b1',
    },
    {
      name: 'token con prefijo Bearer',
      token: () => `Bearer ${sign({ userId: 'u1', roles: ['rider'] })}`,
      authenticated: true,
      userId: 'u1',
      roles: ['rider'],
    },
    {
      name: 'token válido sin roles',
      token: () => sign({ userId: 'u1' }),
      authenticated: true,
      userId: 'u1',
      roles: [],
      branchId: null,
    },
    {
      name: 'token sin userId usa el claim sub',
      token: () => sign({ sub: 'u-sub', roles: ['rider'] }),
      authenticated: true,
      userId: 'u-sub',
      roles: ['rider'],
      branchId: null,
    },
    {
      name: 'sin token',
      token: () => undefined,
      authenticated: false,
    },
    {
      name: 'token vacío',
      token: () => '',
      authenticated: false,
    },
    {
      name: 'token expirado',
      token: () => sign({ userId: 'u1', roles: ['customer'] }, { expiresIn: -10 }),
      authenticated: false,
    },
    {
      name: 'firma inválida',
      token: () => jwt.sign({ userId: 'u1', roles: ['customer'] }, 'otro-secreto'),
      authenticated: false,
    },
    {
      name: 'token malformado',
      token: () => 'no-es-un-jwt',
      authenticated: false,
    },
  ]

  it.each(cases)('$name', ({ token, authenticated, userId, roles, branchId }) => {
    const result = service.verify(token())

    expect(result.authenticated).toBe(authenticated)

    if (authenticated) {
      expect(result.userId).toBe(userId)
      expect(result.roles).toEqual(roles ?? [])
      expect(result.branchId).toBe(branchId ?? null)
    } else {
      expect(result.userId).toBeNull()
      expect(result.roles).toEqual([])
      expect(result.branchId).toBeNull()
    }
  })

  it('devuelve exactamente la forma del AuthContext', () => {
    const result = service.verify(sign({ userId: 'u1', roles: ['rider'], branchId: 'b1' }))

    expect(Object.keys(result).sort()).toEqual(['authenticated', 'branchId', 'roles', 'userId'])
  })

  it('rechaza un token firmado con otro secreto', () => {
    const token = jwt.sign({ userId: 'u1', roles: ['customer'] }, 'otro-secreto')

    expect(service.verify(token)).toEqual({
      authenticated: false,
      userId: null,
      roles: [],
      branchId: null,
    })
  })
})
