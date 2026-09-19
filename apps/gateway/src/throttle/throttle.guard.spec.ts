import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { GqlExecutionContext } from '@nestjs/graphql'
import {
  ThrottlerException,
  ThrottlerStorageService,
  type ThrottlerRequest,
} from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { HEADERS } from '../config/constants'
import { GatewayThrottlerGuard } from './throttle.guard'

type ThrottlerOption = { ttl: number; limit: number }

class TestableGuard extends GatewayThrottlerGuard {
  tracker(req: Record<string, unknown>): Promise<string> {
    return this.getTracker(req)
  }

  requestResponse(context: ExecutionContext): { req: Request; res: Response } {
    return this.getRequestResponse(context)
  }

  request(props: ThrottlerRequest): Promise<boolean> {
    return this.handleRequest(props)
  }
}

const makeReflector = (): Reflector =>
  ({ getAllAndOverride: jest.fn(() => undefined) }) as unknown as Reflector

const createdStorages: ThrottlerStorageService[] = []

const makeGuard = (
  options: ThrottlerOption[] = [{ ttl: 60_000, limit: 3 }],
): { guard: TestableGuard; storage: ThrottlerStorageService } => {
  const storage = new ThrottlerStorageService()
  createdStorages.push(storage)
  const guard = new TestableGuard(options, storage, makeReflector())

  return { guard, storage }
}

type HttpContext = {
  context: ExecutionContext
  request: { headers: Record<string, string | string[]>; ip?: string }
  response: { header: jest.Mock }
}

const makeHttpContext = (
  params: { headers?: Record<string, string | string[]>; ip?: string } = {},
): HttpContext => {
  const request = { headers: params.headers ?? {}, ip: params.ip }
  const response = { header: jest.fn() }

  const context = {
    getType: () => 'http',
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext

  return { context, request, response }
}

afterEach(() => {
  createdStorages.splice(0).forEach((storage) => storage.onApplicationShutdown())
  jest.restoreAllMocks()
})

describe('GatewayThrottlerGuard.getTracker', () => {
  const { guard } = makeGuard()

  const cases: Array<{
    name: string
    headers: Record<string, string | string[]>
    ip?: string
    expected: string
  }> = [
    {
      name: 'usa el Authorization como tracker por token',
      headers: { [HEADERS.authorization]: 'Bearer token-a' },
      expected: 'Bearer token-a',
    },
    {
      name: 'sin Authorization usa la IP del cliente',
      headers: {},
      ip: '10.0.0.1',
      expected: '10.0.0.1',
    },
    {
      name: 'Authorization vacío cae a la IP',
      headers: { [HEADERS.authorization]: '' },
      ip: '10.0.0.2',
      expected: '10.0.0.2',
    },
    {
      name: 'Authorization como array cae a la IP',
      headers: { [HEADERS.authorization]: ['Bearer a', 'Bearer b'] },
      ip: '10.0.0.3',
      expected: '10.0.0.3',
    },
    {
      name: 'sin Authorization ni IP usa anonymous',
      headers: {},
      expected: 'anonymous',
    },
  ]

  it.each(cases)('$name', async ({ headers, ip, expected }) => {
    await expect(guard.tracker({ headers, ip })).resolves.toBe(expected)
  })
})

describe('GatewayThrottlerGuard.getRequestResponse', () => {
  const { guard } = makeGuard()

  it('extrae req/res del contexto GraphQL', () => {
    const req = { kind: 'req' }
    const res = { kind: 'res' }
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req, res }),
    } as unknown as GqlExecutionContext)

    const context = { getType: () => 'graphql' } as unknown as ExecutionContext

    expect(guard.requestResponse(context)).toEqual({ req, res })
  })

  it('contexto GraphQL sin req/res → objetos vacíos', () => {
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({}),
    } as unknown as GqlExecutionContext)

    const context = { getType: () => 'graphql' } as unknown as ExecutionContext
    const result = guard.requestResponse(context)

    expect(result.req).toEqual({})
    expect(result.res).toEqual({})
  })

  it('contexto HTTP usa switchToHttp', () => {
    const { context, request, response } = makeHttpContext()

    expect(guard.requestResponse(context)).toEqual({ req: request, res: response })
  })
})

describe('GatewayThrottlerGuard.canActivate — límite por ventana', () => {
  it.each([
    { limit: 1 },
    { limit: 2 },
    { limit: 3 },
  ])('permite $limit requests y bloquea el siguiente con 429', async ({ limit }) => {
    const { guard } = makeGuard([{ ttl: 60_000, limit }])
    await guard.onModuleInit()
    const authorization = `Bearer token-${limit}`
    const { context } = makeHttpContext({ headers: { [HEADERS.authorization]: authorization } })

    for (let attempt = 0; attempt < limit; attempt += 1) {
      await expect(guard.canActivate(context)).resolves.toBe(true)
    }

    const error = await guard.canActivate(context).catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(ThrottlerException)
    expect((error as ThrottlerException).getStatus()).toBe(429)
  })

  it('los tokens distintos tienen cupos independientes', async () => {
    const { guard } = makeGuard([{ ttl: 60_000, limit: 1 }])
    await guard.onModuleInit()
    const tokenA = makeHttpContext({ headers: { [HEADERS.authorization]: 'Bearer a' } }).context
    const tokenB = makeHttpContext({ headers: { [HEADERS.authorization]: 'Bearer b' } }).context

    await expect(guard.canActivate(tokenA)).resolves.toBe(true)
    await expect(guard.canActivate(tokenA)).rejects.toBeInstanceOf(ThrottlerException)
    await expect(guard.canActivate(tokenB)).resolves.toBe(true)
  })

  it('los clientes anónimos tienen cupos independientes por IP', async () => {
    const { guard } = makeGuard([{ ttl: 60_000, limit: 1 }])
    await guard.onModuleInit()
    const ipA = makeHttpContext({ ip: '10.0.0.1' }).context
    const ipB = makeHttpContext({ ip: '10.0.0.2' }).context

    await expect(guard.canActivate(ipA)).resolves.toBe(true)
    await expect(guard.canActivate(ipA)).rejects.toBeInstanceOf(ThrottlerException)
    await expect(guard.canActivate(ipB)).resolves.toBe(true)
  })

  it('expone Retry-After y X-RateLimit-* en la respuesta', async () => {
    const { guard } = makeGuard([{ ttl: 60_000, limit: 1 }])
    await guard.onModuleInit()
    const { context, response } = makeHttpContext({ headers: { [HEADERS.authorization]: 'Bearer a' } })

    await guard.canActivate(context)
    await guard.canActivate(context).catch(() => undefined)

    expect(response.header).toHaveBeenCalledWith('X-RateLimit-Limit', 1)
    expect(response.header).toHaveBeenCalledWith('X-RateLimit-Remaining', 0)
    expect(response.header).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number))
    expect(response.header).toHaveBeenCalledWith('Retry-After', expect.any(Number))
  })

  it('resetea el cupo al expirar la ventana (ttl)', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

    try {
      const { guard } = makeGuard([{ ttl: 1000, limit: 1 }])
      await guard.onModuleInit()
      const { context } = makeHttpContext({ headers: { [HEADERS.authorization]: 'Bearer a' } })

      await expect(guard.canActivate(context)).resolves.toBe(true)
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ThrottlerException)

      jest.advanceTimersByTime(1500)

      await expect(guard.canActivate(context)).resolves.toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })
})
