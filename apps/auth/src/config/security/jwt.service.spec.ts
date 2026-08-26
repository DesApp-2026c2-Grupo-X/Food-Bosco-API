import jwt from 'jsonwebtoken'
import { env } from '../env'
import { JwtService } from './jwt.service'

describe('JwtService.signAccessToken (RQ-SEC-01/02)', () => {
  const service = new JwtService()

  it('firma un token con userId, roles y branchId', () => {
    const token = service.signAccessToken({ id: 'u1', role: 'customer', branchId: 'b1' })
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload

    expect(payload.sub).toBe('u1')
    expect(payload.userId).toBe('u1')
    expect(payload.roles).toEqual(['customer'])
    expect(payload.branchId).toBe('b1')
  })

  it('incluye roles como arreglo y branchId null cuando no hay sucursal', () => {
    const token = service.signAccessToken({ id: 'u1', role: 'rider', branchId: null })
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload

    expect(payload.roles).toEqual(['rider'])
    expect(payload.branchId).toBeNull()
  })
})

describe('JwtService.verify', () => {
  const service = new JwtService()
  const sign = (payload: object, options?: jwt.SignOptions): string =>
    jwt.sign(payload, env.jwtSecret, options)

  it.each([
    {
      name: 'token válido',
      token: () => sign({ userId: 'u1', roles: ['customer'], branchId: 'b1' }),
      authenticated: true,
    },
    {
      name: 'con prefijo Bearer',
      token: () => `Bearer ${sign({ userId: 'u1', roles: ['rider'] })}`,
      authenticated: true,
    },
    { name: 'sin token', token: () => undefined, authenticated: false },
    {
      name: 'token expirado',
      token: () => sign({ userId: 'u1' }, { expiresIn: -10 }),
      authenticated: false,
    },
    {
      name: 'firma inválida',
      token: () => jwt.sign({ userId: 'u1' }, 'otro-secreto'),
      authenticated: false,
    },
    { name: 'malformado', token: () => 'no-es-un-jwt', authenticated: false },
  ])('$name', ({ token, authenticated }) => {
    expect(service.verify(token()).authenticated).toBe(authenticated)
  })
})
