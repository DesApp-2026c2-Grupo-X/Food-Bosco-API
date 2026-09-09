import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { JwtService } from '../security/jwt.service'
import { buildContext } from './gateway.context'
import { env } from '../config/env'

const sign = (payload: object): string => jwt.sign(payload, env.jwtSecret)

const buildParams = (
  headers: Record<string, string | string[]>,
): { req: Request; res: Response } => ({
  req: { headers } as unknown as Request,
  res: {} as unknown as Response,
})

describe('buildContext', () => {
  const contextBuilder = buildContext(new JwtService())

  it('construye contexto autenticado desde Authorization', () => {
    const token = sign({ userId: 'u1', roles: ['customer'], branchId: 'b1' })
    const ctx = contextBuilder(
      buildParams({ authorization: `Bearer ${token}`, 'x-request-id': 'rid-1' }),
    )

    expect(ctx.authenticated).toBe(true)
    expect(ctx.userId).toBe('u1')
    expect(ctx.roles).toEqual(['customer'])
    expect(ctx.branchId).toBe('b1')
    expect(ctx.authorization).toBe(`Bearer ${token}`)
    expect(ctx.requestId).toBe('rid-1')
  })

  it('construye contexto anónimo sin token', () => {
    const ctx = contextBuilder(buildParams({}))

    expect(ctx.authenticated).toBe(false)
    expect(ctx.userId).toBeNull()
    expect(ctx.roles).toEqual([])
    expect(ctx.branchId).toBeNull()
    expect(ctx.authorization).toBeNull()
    expect(ctx.requestId).toBeNull()
  })

  it('resuelve header que llega como array', () => {
    const token = sign({ userId: 'u1', roles: ['rider'] })
    const ctx = contextBuilder(buildParams({ authorization: [token] }))

    expect(ctx.authenticated).toBe(true)
    expect(ctx.userId).toBe('u1')
    expect(ctx.roles).toEqual(['rider'])
  })
})
