import type { Request } from 'express'
import { env } from '../../config/env'
import type { RestClient } from '../../rest/rest.client'
import { getCommerceLoaders } from './commerce.dataloaders'

const makeReq = (): Request => ({}) as unknown as Request

const makeRest = () => ({ get: jest.fn() })

const asClient = (mock: ReturnType<typeof makeRest>): RestClient =>
  mock as unknown as RestClient

describe('getCommerceLoaders', () => {
  it('cachea los loaders en el request para reutilizarlos', () => {
    const req = makeReq()
    const commerce = makeRest()
    const auth = makeRest()

    const first = getCommerceLoaders(req, asClient(commerce), asClient(auth))
    const second = getCommerceLoaders(req, asClient(commerce), asClient(auth))

    expect(second).toBe(first)
  })

  it('crea loaders independientes para requests distintos', () => {
    const commerce = makeRest()
    const auth = makeRest()

    const first = getCommerceLoaders(makeReq(), asClient(commerce), asClient(auth))
    const second = getCommerceLoaders(makeReq(), asClient(commerce), asClient(auth))

    expect(second).not.toBe(first)
  })

  describe.each<['category' | 'ingredient' | 'product' | 'branch', string]>([
    ['category', '/v1/catalog/categories'],
    ['ingredient', '/v1/catalog/ingredients'],
    ['product', '/v1/catalog/products'],
    ['branch', '/v1/branches'],
  ])('loader %s', (loaderName, prefix) => {
    const build = () => {
      const commerce = makeRest()
      const auth = makeRest()
      const loaders = getCommerceLoaders(makeReq(), asClient(commerce), asClient(auth))
      return { commerce, auth, loader: loaders[loaderName] }
    }

    it(`hace GET ${prefix}/{id}`, async () => {
      const { commerce, loader } = build()
      commerce.get.mockResolvedValue({ id: 'x1', name: 'X' })

      const result = await loader.load('x1')

      expect(commerce.get).toHaveBeenCalledWith(`${prefix}/x1`)
      expect(result).toEqual({ id: 'x1', name: 'X' })
    })

    it('devuelve null cuando REST rechaza', async () => {
      const { commerce, loader } = build()
      commerce.get.mockRejectedValue(new Error('404'))

      await expect(loader.load('missing')).resolves.toBeNull()
    })

    it.each([undefined, null])('devuelve null para id %p', async (missingId) => {
      const { commerce, loader } = build()
      commerce.get.mockRejectedValue(new Error('404'))

      await expect(loader.load(missingId as unknown as string)).resolves.toBeNull()
      expect(commerce.get).toHaveBeenCalledTimes(1)
    })
  })

  describe('batching', () => {
    const build = () => {
      const commerce = makeRest()
      const auth = makeRest()
      const loaders = getCommerceLoaders(makeReq(), asClient(commerce), asClient(auth))
      commerce.get.mockImplementation(async (path: string) => ({
        id: path.split('/').pop(),
        name: 'X',
      }))
      return { commerce, loader: loaders.category }
    }

    it('agrupa varias cargas del mismo tick en una sola tanda', async () => {
      const { commerce, loader } = build()

      const results = await Promise.all([
        loader.load('c1'),
        loader.load('c2'),
        loader.load('c3'),
      ])

      expect(commerce.get).toHaveBeenCalledTimes(3)
      expect(commerce.get).toHaveBeenNthCalledWith(1, '/v1/catalog/categories/c1')
      expect(commerce.get).toHaveBeenNthCalledWith(2, '/v1/catalog/categories/c2')
      expect(commerce.get).toHaveBeenNthCalledWith(3, '/v1/catalog/categories/c3')
      expect(results.map((entry) => entry?.id)).toEqual(['c1', 'c2', 'c3'])
    })

    it('preserva el orden de las keys', async () => {
      const { loader } = build()

      const results = await Promise.all([
        loader.load('c3'),
        loader.load('c1'),
        loader.load('c2'),
      ])

      expect(results.map((entry) => entry?.id)).toEqual(['c3', 'c1', 'c2'])
    })

    it('devuelve null solo para las keys que fallan', async () => {
      const { commerce, loader } = build()
      commerce.get.mockImplementation(async (path: string) => {
        if (path.endsWith('/c2')) {
          throw new Error('404')
        }
        return { id: path.split('/').pop() }
      })

      const results = await Promise.all([loader.load('c1'), loader.load('c2'), loader.load('c3')])

      expect(results).toEqual([{ id: 'c1' }, null, { id: 'c3' }])
    })

    it('no llama a REST si no hay cargas pendientes', async () => {
      const { commerce } = build()

      await Promise.all([])

      expect(commerce.get).not.toHaveBeenCalled()
    })

    it('NO deduplica keys repetidas dentro del mismo lote', async () => {
      const { commerce, loader } = build()

      const results = await Promise.all([loader.load('c1'), loader.load('c1')])

      // KNOWN BUG (RQ-GW-09): el DataLoader agrupa por tick pero no deduplica keys;
      // la misma categoría se pide dos veces al servicio REST.
      expect(commerce.get).toHaveBeenCalledTimes(2)
      expect(results).toEqual([
        { id: 'c1', name: 'X' },
        { id: 'c1', name: 'X' },
      ])
    })

    it('NO reutiliza resultados entre tandas (sin cache por key)', async () => {
      const { commerce, loader } = build()

      await loader.load('c1')
      await loader.load('c1')

      // KNOWN BUG (RQ-GW-09): no hay cache, por lo que una segunda resolución
      // en otro tick vuelve a golpear el servicio REST.
      expect(commerce.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('user loader', () => {
    it('consulta Auth con el token interno', async () => {
      const auth = makeRest()
      const loaders = getCommerceLoaders(makeReq(), asClient(makeRest()), asClient(auth))
      auth.get.mockResolvedValue({ id: 'u1', email: 'a@b.com' })

      const result = await loaders.user.load('u1')

      expect(auth.get).toHaveBeenCalledWith('/v1/users/u1', {
        context: { internalToken: env.internalApiToken },
      })
      expect(result).toEqual({ id: 'u1', email: 'a@b.com' })
    })

    it('devuelve null cuando Auth rechaza', async () => {
      const auth = makeRest()
      const loaders = getCommerceLoaders(makeReq(), asClient(makeRest()), asClient(auth))
      auth.get.mockRejectedValue(new Error('401'))

      await expect(loaders.user.load('u1')).resolves.toBeNull()
    })
  })
})
