import jwt from 'jsonwebtoken'
import { Role, ROLES } from '../constants'
import { env } from '../env'
import type { AuthContext, TokenUser } from './jwt.service'
import { JwtService } from './jwt.service'

const service = new JwtService()

const sign = (payload: object, options?: jwt.SignOptions): string =>
  jwt.sign(payload, env.jwtSecret, options)

describe('JwtService.signAccessToken (RQ-SEC-01/02)', () => {
  it('firma un token con userId, roles y branchId', () => {
    const token = service.signAccessToken({ id: 'u1', role: 'customer', branchId: 'b1' })
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload

    expect(payload.sub).toBe('u1')
    expect(payload.userId).toBe('u1')
    expect(payload.roles).toEqual(['customer'])
    expect(payload.branchId).toBe('b1')
  })

  it.each<{ name: string; user: TokenUser; expectedRole: Role; expectedBranch: string | null }>([
    {
      name: 'cliente con sucursal',
      user: { id: 'u1', role: ROLES.customer, branchId: 'b1' },
      expectedRole: ROLES.customer,
      expectedBranch: 'b1',
    },
    {
      name: 'admin de sucursal',
      user: { id: 'u2', role: ROLES.branchAdmin, branchId: 'b7' },
      expectedRole: ROLES.branchAdmin,
      expectedBranch: 'b7',
    },
    {
      name: 'repartidor sin sucursal',
      user: { id: 'u3', role: ROLES.rider, branchId: null },
      expectedRole: ROLES.rider,
      expectedBranch: null,
    },
    {
      name: 'super admin sin sucursal',
      user: { id: 'u4', role: ROLES.superAdmin, branchId: null },
      expectedRole: ROLES.superAdmin,
      expectedBranch: null,
    },
  ])('$name: incluye userId, rol en arreglo y branchId', ({ user, expectedRole, expectedBranch }) => {
    const payload = jwt.verify(service.signAccessToken(user), env.jwtSecret) as jwt.JwtPayload

    expect(payload.userId).toBe(user.id)
    expect(payload.sub).toBe(user.id)
    expect(payload.roles).toEqual([expectedRole])
    expect(payload.branchId).toBe(expectedBranch)
  })

  it('incluye expiración coherente con jwtAccessExpiresIn', () => {
    const payload = jwt.verify(
      service.signAccessToken({ id: 'u1', role: ROLES.customer, branchId: null }),
      env.jwtSecret,
    ) as jwt.JwtPayload

    expect(typeof payload.iat).toBe('number')
    expect(typeof payload.exp).toBe('number')
    expect(payload.exp as number).toBeGreaterThan(payload.iat as number)
  })

  it('normaliza branchId undefined a null', () => {
    const payload = jwt.verify(
      service.signAccessToken({ id: 'u1', role: ROLES.customer, branchId: undefined as never }),
      env.jwtSecret,
    ) as jwt.JwtPayload

    expect(payload.branchId).toBeNull()
  })

  it('firma con el secreto compartido del entorno', () => {
    const token = service.signAccessToken({ id: 'u1', role: ROLES.customer, branchId: null })

    expect(() => jwt.verify(token, env.jwtSecret)).not.toThrow()
    expect(() => jwt.verify(token, 'otro-secreto')).toThrow()
  })
})

describe('JwtService.verify (RQ-SEC-01/02, RQ-GW-04/05)', () => {
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
      name: 'múltiples roles',
      token: () => sign({ userId: 'u1', roles: ['branch_admin', 'rider'], branchId: 'b2' }),
      expected: { authenticated: true, roles: ['branch_admin', 'rider'], branchId: 'b2' },
    },
    {
      name: 'sin userId cae a sub',
      token: () => sign({ sub: 'u-por-sub', roles: ['customer'] }),
      expected: { authenticated: true, userId: 'u-por-sub' },
    },
    {
      name: 'sin userId ni sub devuelve userId null',
      token: () => sign({ roles: ['customer'] }),
      expected: { authenticated: true, userId: null },
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
      name: 'sin token',
      token: () => undefined,
      expected: { authenticated: false },
    },
    {
      name: 'token vacío',
      token: () => '',
      expected: { authenticated: false },
    },
    {
      name: 'token expirado',
      token: () => sign({ userId: 'u1' }, { expiresIn: -10 }),
      expected: { authenticated: false },
    },
    {
      name: 'firma inválida (otro secreto)',
      token: () => jwt.sign({ userId: 'u1' }, 'otro-secreto'),
      expected: { authenticated: false },
    },
    {
      name: 'malformado',
      token: () => 'no-es-un-jwt',
      expected: { authenticated: false },
    },
    {
      name: 'JWT de 3 partes con payload corrupto',
      token: () => 'aaa.bbb.ccc',
      expected: { authenticated: false },
    },
  ])('$name', ({ token, expected }) => {
    expect(service.verify(token())).toMatchObject(expected)
  })

  it.each([
    { name: 'sin token', token: undefined },
    { name: 'token vacío', token: '' },
    { name: 'token malformado', token: 'no-es-un-jwt' },
    { name: 'token expirado', token: sign({ userId: 'u1' }, { expiresIn: -10 }) },
    { name: 'firma inválida', token: jwt.sign({ userId: 'u1' }, 'otro-secreto') },
  ])('devuelve contexto anónimo y sin identidad para $name', ({ token }) => {
    expect(service.verify(token)).toEqual({
      authenticated: false,
      userId: null,
      roles: [],
      branchId: null,
    })
  })
})
