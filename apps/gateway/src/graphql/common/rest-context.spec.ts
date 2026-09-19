import type { GraphQLContext } from '../../gateway/gateway.context'
import { toRestContext } from './rest-context'

const buildCtx = (overrides: Partial<GraphQLContext> = {}): GraphQLContext =>
  ({
    authenticated: true,
    userId: 'u1',
    roles: ['customer'],
    branchId: null,
    requestId: 'rid-1',
    authorization: 'Bearer xyz',
    req: { headers: {} },
    res: {},
    ...overrides,
  }) as unknown as GraphQLContext

describe('toRestContext', () => {
  it('copia exactamente los campos del contexto REST y descarta el resto', () => {
    const ctx = buildCtx({
      userId: 'u1',
      roles: ['branch_admin', 'super_admin'],
      branchId: 'b1',
      requestId: 'rid-9',
      authorization: 'Bearer abc',
    })

    expect(toRestContext(ctx)).toEqual({
      authorization: 'Bearer abc',
      userId: 'u1',
      roles: ['branch_admin', 'super_admin'],
      branchId: 'b1',
      requestId: 'rid-9',
    })
  })

  it.each<[Partial<GraphQLContext>, Record<string, unknown>]>([
    [
      { authenticated: false, userId: null, roles: [], branchId: null, requestId: null, authorization: null },
      { authorization: null, userId: null, roles: [], branchId: null, requestId: null },
    ],
    [
      { userId: 'u2', roles: ['rider'], branchId: 'b2', requestId: 'r2', authorization: 'Bearer def' },
      { authorization: 'Bearer def', userId: 'u2', roles: ['rider'], branchId: 'b2', requestId: 'r2' },
    ],
  ])('propaga los valores del contexto %#', (overrides, expected) => {
    expect(toRestContext(buildCtx(overrides))).toEqual(expected)
  })

  it('no incluye campos internos como authenticated, req o res', () => {
    const result = toRestContext(buildCtx()) as unknown as Record<string, unknown>

    expect(Object.keys(result).sort()).toEqual([
      'authorization',
      'branchId',
      'requestId',
      'roles',
      'userId',
    ])
    expect(result).not.toHaveProperty('authenticated')
    expect(result).not.toHaveProperty('req')
    expect(result).not.toHaveProperty('res')
  })
})
