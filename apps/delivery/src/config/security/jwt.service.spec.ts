import jwt from 'jsonwebtoken'
import { Role } from '../constants'
import { env } from '../env'
import { JwtService } from './jwt.service'

const sign = (payload: Record<string, unknown>, options?: jwt.SignOptions): string =>
  jwt.sign(payload, env.jwtSecret, options)

describe('JwtService.verify (RQ-SEC)', () => {
  const service = new JwtService()

  it('acepta un token válido y expone userId, roles y branchId', () => {
    const token = sign({ userId: 'u1', roles: ['rider'], branchId: 'b1' })

    expect(service.verify(token)).toEqual({
      authenticated: true,
      userId: 'u1',
      roles: ['rider'],
      branchId: 'b1',
    })
  })

  it('usa el claim sub cuando no hay userId', () => {
    const token = sign({ sub: 'u2', roles: ['rider'] })

    expect(service.verify(token).userId).toBe('u2')
  })

  it.each([
    { name: 'token válido sin user ni sub', payload: { roles: [] as Role[] } },
    { name: 'token válido sin roles', payload: { userId: 'u3' } },
  ])('aplica defaults en $name', ({ payload }) => {
    const result = service.verify(sign(payload))

    expect(result.authenticated).toBe(true)
    expect(result.roles).toEqual([])
    expect(result.branchId).toBeNull()
  })

  it('quita el prefijo Bearer y espacios', () => {
    const token = sign({ userId: 'u1', roles: ['rider'] })

    expect(service.verify(`Bearer   ${token}  `).userId).toBe('u1')
  })

  it('usa userId aunque venga sub (userId tiene prioridad)', () => {
    const token = sign({ userId: 'primary', sub: 'secondary' })

    expect(service.verify(token).userId).toBe('primary')
  })

  it('rechaza un token expirado', () => {
    const token = sign({ userId: 'u1', roles: ['rider'] }, { expiresIn: -10 })

    expect(service.verify(token)).toEqual({
      authenticated: false,
      userId: null,
      roles: [],
      branchId: null,
    })
  })

  it('rechaza un token firmado con otra clave', () => {
    const token = jwt.sign({ userId: 'u1' }, 'otra-clave')

    expect(service.verify(token).authenticated).toBe(false)
  })

  it.each([
    { name: 'token malformado', token: 'no-es-un-jwt' },
    { name: 'token vacío', token: '' },
    { name: 'solo Bearer', token: 'Bearer ' },
    { name: 'undefined', token: undefined },
  ])('devuelve contexto anónimo para $name', ({ token }) => {
    expect(service.verify(token)).toEqual({
      authenticated: false,
      userId: null,
      roles: [],
      branchId: null,
    })
  })
})
