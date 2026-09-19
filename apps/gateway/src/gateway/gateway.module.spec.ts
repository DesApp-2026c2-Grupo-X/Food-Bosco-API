import { Test } from '@nestjs/testing'
import { GRAPHQL_MODULE_OPTIONS } from '@nestjs/graphql'
import type { ApolloDriverConfig } from '@nestjs/apollo'
import type { Request, Response } from 'express'
import { formatGraphQLError } from '../observability/graphql-error-formatter'
import { GatewayModule } from './gateway.module'

type ContextFactory = (params: { req: Request; res: Response }) => Record<string, unknown>

describe('GatewayModule', () => {
  let options: ApolloDriverConfig

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [GatewayModule] }).compile()
    options = moduleRef.get<ApolloDriverConfig>(GRAPHQL_MODULE_OPTIONS)
    await moduleRef.close()
  })

  it('usa un esquema en memoria ordenado (RQ-GW-01/RQ-GW-02)', () => {
    expect(options.autoSchemaFile).toBe(true)
    expect(options.sortSchema).toBe(true)
  })

  it('expone introspection y playground fuera de producción (RQ-GW-11)', () => {
    expect(options.introspection).toBe(true)
    expect(options.playground).toBe(true)
  })

  it('usa el formateador de errores del gateway (RQ-GW-07)', () => {
    expect(options.formatError).toBe(formatGraphQLError)
  })

  it('construye el contexto GraphQL desde el request (RQ-GW-05)', () => {
    expect(typeof options.context).toBe('function')
    const context = options.context as unknown as ContextFactory
    const req = { headers: { 'x-request-id': 'rid-1' } } as unknown as Request
    const res = {} as unknown as Response

    const built = context({ req, res })

    expect(built).toMatchObject({
      authenticated: false,
      userId: null,
      roles: [],
      branchId: null,
      requestId: 'rid-1',
      authorization: null,
    })
    expect(built.req).toBe(req)
    expect(built.res).toBe(res)
  })
})
