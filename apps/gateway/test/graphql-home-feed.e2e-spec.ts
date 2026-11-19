import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import {
  createDownstreamMock,
  DownstreamCall,
  DownstreamMock,
  errorResponse,
  GraphQLBody,
  okResponse,
  queryParams,
  signToken,
} from './downstream'

const rawCategory = { id: 'c1', name: 'Hamburguesas', active: true }

const rawProduct = {
  id: 'p1',
  categoryId: 'c1',
  name: 'Burger',
  description: 'Clásica',
  price: 10,
  image: null,
  available: true,
  configGroups: [],
  recipe: [],
}

const rawBranch = {
  id: 'b1',
  name: 'Centro',
  addressText: 'Calle 1',
  latitude: -34.6,
  longitude: -58.4,
  phone: null,
  active: true,
  hours: [],
}

const rawPromotion = {
  id: 'pr1',
  name: '2x1',
  description: null,
  startDate: '2026-11-01T00:00:00.000Z',
  endDate: '2026-11-30T00:00:00.000Z',
  type: 'BUY_X_GET_Y',
  discountValue: null,
  maxDiscount: null,
  buyQuantity: 2,
  payQuantity: 1,
  scope: 'CATEGORY',
  categoryIds: ['c1'],
  productIds: [],
  branchIds: [],
  minSubtotal: 0,
  minQuantity: 0,
  daysOfWeek: [],
  startTime: null,
  endTime: null,
}

const rawFeed = {
  generatedAt: '2026-11-18T03:00:00.000Z',
  hasHistory: true,
  topCategory: rawCategory,
  favoriteBranch: rawBranch,
  nearestBranch: { branch: rawBranch, distanceMeters: 820 },
  categories: [rawCategory],
  forYou: [{ product: rawProduct, reason: 'REPEAT', hint: 'Ya lo pediste', score: 5.25 }],
  discovery: [{ product: rawProduct, reason: 'DISCOVERY', hint: 'Nuevo para vos', score: 0.8 }],
  reorder: [
    {
      id: 'o1',
      number: '0001',
      status: 'delivered',
      createdAt: '2026-11-10T10:00:00.000Z',
      total: 21,
      branchId: 'b1',
      branch: rawBranch,
      items: [{ productId: 'p1', name: 'Burger', quantity: 2 }],
    },
  ],
  promotions: [rawPromotion],
}

const HOME_FEED_QUERY = `
  query HomeFeed($input: HomeFeedInput) {
    homeFeed(input: $input) {
      generatedAt
      hasHistory
      topCategory { id name }
      favoriteBranch { id name }
      nearestBranch { distanceMeters branch { id } }
      categories { id }
      forYou { reason hint score product { id name price available } }
      discovery { reason product { id } }
      reorder { id status total branch { id } items { productId quantity } }
      promotions { id name type scope categoryIds }
    }
  }
`

describe('Gateway — homeFeed (e2e)', () => {
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

  const post = (variables: Record<string, unknown>, token?: string) => {
    const http = request(app.getHttpServer())
      .post('/graphql')
      .send({ query: HOME_FEED_QUERY, variables })
    if (token === undefined) return http
    return http.set('Authorization', `Bearer ${token}`)
  }

  const customerToken = (): string => signToken({ userId: 'u1', roles: ['customer'] })

  const callsTo = (path: string): DownstreamCall[] =>
    downstream.calls.filter((call) => call.path === path)

  const respondWithFeed = (): void => {
    downstream.setResponder((call) => {
      if (call.method === 'GET' && call.path === '/v1/addresses/a1') {
        return okResponse({ id: 'a1', latitude: -34.6, longitude: -58.4 })
      }
      if (call.method === 'GET' && call.path === '/v1/personalization/home-feed') {
        return okResponse(rawFeed)
      }
      return undefined
    })
  }

  it('valida addressId contra Auth, usa sus coordenadas y mapea el feed', async () => {
    respondWithFeed()

    const res = await post({ input: { addressId: 'a1' } }, customerToken()).expect(200)
    const body = res.body as GraphQLBody

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      homeFeed: {
        generatedAt: '2026-11-18T03:00:00.000Z',
        hasHistory: true,
        topCategory: { id: 'c1', name: 'Hamburguesas' },
        favoriteBranch: { id: 'b1', name: 'Centro' },
        nearestBranch: { distanceMeters: 820, branch: { id: 'b1' } },
        categories: [{ id: 'c1' }],
        forYou: [
          {
            reason: 'REPEAT',
            hint: 'Ya lo pediste',
            score: 5.25,
            product: { id: 'p1', name: 'Burger', price: 10, available: true },
          },
        ],
        discovery: [{ reason: 'DISCOVERY', product: { id: 'p1' } }],
        reorder: [
          {
            id: 'o1',
            status: 'DELIVERED',
            total: 21,
            branch: { id: 'b1' },
            items: [{ productId: 'p1', quantity: 2 }],
          },
        ],
        promotions: [
          {
            id: 'pr1',
            name: '2x1',
            type: 'BUY_X_GET_Y',
            scope: 'CATEGORY',
            categoryIds: ['c1'],
          },
        ],
      },
    })

    const params = queryParams(callsTo('/v1/personalization/home-feed')[0].url)
    expect(params.get('lat')).toBe('-34.6')
    expect(params.get('lng')).toBe('-58.4')
    expect(params.get('forYouLimit')).toBe('8')
    expect(params.get('discoveryLimit')).toBe('4')
    expect(params.get('reorderLimit')).toBe('3')
  })

  it('recorta los límites antes de llamar a Commerce', async () => {
    respondWithFeed()

    await post(
      { input: { lat: 1, lng: 2, forYouLimit: 99, discoveryLimit: 99, reorderLimit: 99 } },
      customerToken(),
    ).expect(200)

    const params = queryParams(callsTo('/v1/personalization/home-feed')[0].url)
    expect(params.get('forYouLimit')).toBe('12')
    expect(params.get('discoveryLimit')).toBe('8')
    expect(params.get('reorderLimit')).toBe('5')
    expect(params.get('lat')).toBe('1')
    expect(params.get('lng')).toBe('2')
    expect(callsTo('/v1/addresses/a1')).toHaveLength(0)
  })

  it('permite la home anónima sin secciones personales', async () => {
    downstream.setResponder((call) =>
      call.method === 'GET' && call.path === '/v1/personalization/home-feed'
        ? okResponse({
            ...rawFeed,
            hasHistory: false,
            forYou: [],
            discovery: [],
            reorder: [],
            favoriteBranch: null,
          })
        : undefined,
    )

    const res = await post({}).expect(200)
    const body = res.body as GraphQLBody

    expect(body.errors).toBeUndefined()
    expect(body.data).toMatchObject({
      homeFeed: { hasHistory: false, forYou: [], discovery: [], reorder: [] },
    })
    const commerceCall = callsTo('/v1/personalization/home-feed')[0]
    expect(commerceCall.headers['x-user-id']).toBeUndefined()
    expect(commerceCall.headers.authorization).toBeUndefined()
  })

  it('propaga el error de una dirección ajena y no llama a Commerce', async () => {
    downstream.setResponder((call) =>
      call.path === '/v1/addresses/a1'
        ? errorResponse(404, 'ADDRESS_NOT_FOUND', 'Dirección no encontrada', call.path)
        : undefined,
    )

    const res = await post({ input: { addressId: 'a1' } }, customerToken()).expect(200)
    const body = res.body as GraphQLBody

    expect(body.data).toBeNull()
    expect(body.errors?.[0].extensions?.code).toBe('ADDRESS_NOT_FOUND')
    expect(callsTo('/v1/personalization/home-feed')).toHaveLength(0)
  })

  it('traduce la caída de Commerce a SERVICE_UNAVAILABLE', async () => {
    downstream.setResponder((call) =>
      call.path === '/v1/personalization/home-feed'
        ? errorResponse(503, 'SERVICE_UNAVAILABLE', 'caído', call.path)
        : undefined,
    )

    const res = await post({}).expect(200)
    const body = res.body as GraphQLBody

    expect(body.errors?.[0].extensions?.code).toBe('SERVICE_UNAVAILABLE')
  })
})
