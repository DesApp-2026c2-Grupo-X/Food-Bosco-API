import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { HEADERS } from '../config/constants'
import { env } from '../config/env'
import { InternalGuard } from './internal.guard'

const makeContext = (headers: Record<string, string | string[] | undefined> = {}) => {
  const request = { headers }
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}

describe('InternalGuard (RQ-GW-12, seguridad del seed)', () => {
  const guard = new InternalGuard()

  it('permite el paso con el X-Internal-Token correcto', () => {
    const context = makeContext({ [HEADERS.internalToken]: env.internalApiToken })

    expect(guard.canActivate(context)).toBe(true)
  })

  it('acepta el header como arreglo y toma el primer valor', () => {
    const context = makeContext({
      [HEADERS.internalToken]: [env.internalApiToken, 'otro'],
    })

    expect(guard.canActivate(context)).toBe(true)
  })

  it.each([
    { name: 'sin header', headers: {} },
    { name: 'token incorrecto', headers: { [HEADERS.internalToken]: 'otro-token' } },
    { name: 'token vacío', headers: { [HEADERS.internalToken]: '' } },
  ])('rechaza con 401 cuando $name', ({ headers }) => {
    const context = makeContext(headers)

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException)
    try {
      guard.canActivate(context)
    } catch (error) {
      expect((error as UnauthorizedException).getStatus()).toBe(401)
    }
  })
})
