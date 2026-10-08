import jwt from 'jsonwebtoken'
import { env } from '../env'
import type { AuthContext } from './jwt.service'
import { JwtService } from './jwt.service'

const service = new JwtService()

const sign = (payload: object, options?: jwt.SignOptions): string =>
  jwt.sign(payload, env.jwtSecret, options)

const anonymous: AuthContext = {
  authenticated: false,
  userId: null,
  roles: [],
  branchId: null,
  internal: false,
}

describe('JwtService.verify (RQ-SEC-01/02)', () => {
  it.each<{ name: string; token: () => string | undefined; expected: Partial<AuthContext> }>([
    {
      name: 'token válido con todos los campos',
      token: () => sign({ userId: 'u1', roles: ['customer'], branchId: 'b1' }),
      expected: { authenticated: true, userId: 'u1', roles: ['customer'], branchId: 'b1' },
    },
    {
      name: 'token válido con prefijo Bearer',
      token: () => `Bearer ${sign({ userId: 'u1', roles: ['rider'] })}`,
      expected: { authenticated: true, userId: 'u1', roles: ['rider'], branchId: null },
    },
    {
      name: 'prefijo bearer en minúsculas',
      token: () => `bearer ${sign({ userId: 'u1', roles: ['rider'] })}`,
      expected: { authenticated: true, userId: 'u1', roles: ['rider'] },
    },
    {
      name: 'sin userId cae a sub',
      token: () => sign({ sub: 'u-por-sub', roles: ['customer'] }),
      expected: { authenticated: true, userId: 'u-por-sub' },
    },
    {
      name: 'sin roles devuelve arreglo vacío',
      token: () => sign({ userId: 'u1' }),
      expected: { authenticated: true, roles: [] },
    },
    {
      name: 'sin branchId devuelve null',
      token: () => sign({ userId: 'u1', roles: ['customer'] }),
      expected: { authenticated: true, branchId: null },
    },
    {
      name: 'sin identidad resoluble (userId ni sub) se trata como anónimo',
      token: () => sign({ roles: ['customer'] }),
      expected: anonymous,
    },
    {
      name: 'sin token',
      token: () => undefined,
      expected: anonymous,
    },
    {
      name: 'token vacío',
      token: () => '',
      expected: anonymous,
    },
    {
      name: 'token expirado',
      token: () => sign({ userId: 'u1' }, { expiresIn: -10 }),
      expected: anonymous,
    },
    {
      name: 'firma inválida (otro secreto)',
      token: () => jwt.sign({ userId: 'u1' }, 'otro-secreto'),
      expected: anonymous,
    },
    {
      name: 'malformado',
      token: () => 'no-es-un-jwt',
      expected: anonymous,
    },
  ])('$name', ({ token, expected }) => {
    expect(service.verify(token())).toMatchObject(expected)
  })
})
