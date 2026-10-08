import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { createDownstreamMock, DownstreamMock, gql, GraphQLBody } from './downstream'

interface ProtectedOperation {
  name: string
  query: string
}

// Operaciones @Roles(branchAdmin, superAdmin) que quedaron sin el caso "sin token":
// la matriz sólo probaba FORBIDDEN con rol incorrecto.
const protectedOperations: ProtectedOperation[] = [
  {
    name: 'orders',
    query: 'query { orders { id } }',
  },
  {
    name: 'adjustStock',
    query:
      'mutation { adjustStock(input: { branchId: "b1", ingredientId: "i1", delta: -1, reason: "adjust" }) { quantity } }',
  },
]

describe('Gateway autorización por operación (e2e) — sin token en operaciones restantes', () => {
  let app: INestApplication<App>
  let downstream: DownstreamMock

  beforeAll(async () => {
    downstream = createDownstreamMock(() => undefined)

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
    await app.listen(0)
  })

  afterAll(async () => {
    downstream.restore()
    await app.close()
  })

  beforeEach(() => downstream.reset())

  const post = (query: string) => request(app.getHttpServer()).post('/graphql').send(gql(query))

  describe('sin token → UNAUTHENTICATED', () => {
    it.each(protectedOperations)('$name', async ({ query }) => {
      const res = await post(query).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED')
      expect(body.errors?.[0].message).toBe('Unauthorized')
      expect(downstream.calls).toHaveLength(0)
    })
  })
})
