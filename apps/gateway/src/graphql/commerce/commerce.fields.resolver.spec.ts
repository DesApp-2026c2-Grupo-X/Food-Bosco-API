import type { Request } from 'express'
import { env } from '../../config/env'
import type { GraphQLContext } from '../../gateway/gateway.context'
import type { RestClient } from '../../rest/rest.client'
import { Role } from '../common/role.enum'
import {
  BranchStockFieldResolver,
  CartItemFieldResolver,
  OrderFieldResolver,
  ProductFieldResolver,
  RecipeItemFieldResolver,
} from './commerce.fields.resolver'
import { BranchStock, CartItem, Order, Product, RecipeItem } from './commerce.types'

const makeCtx = (): GraphQLContext => ({ req: {} as Request }) as unknown as GraphQLContext

const makeRest = () => ({ get: jest.fn() })

const asClient = (mock: ReturnType<typeof makeRest>): RestClient => mock as unknown as RestClient

const asProduct = (categoryId: string): Product => ({ categoryId }) as unknown as Product
const asRecipeItem = (ingredientId: string): RecipeItem =>
  ({ ingredientId }) as unknown as RecipeItem
const asCartItem = (productId: string, optionIds: string[]): CartItem =>
  ({ productId, optionIds }) as unknown as CartItem
const asOrder = (fields: { clientId?: string; branchId?: string; riderId?: string | null }): Order =>
  fields as unknown as Order
const asBranchStock = (ingredientId: string): BranchStock =>
  ({ ingredientId }) as unknown as BranchStock

const rawCategory = { id: 'c1', name: 'Hamburguesas', active: true }
const rawIngredient = { id: 'i1', name: 'Carne', unit: 'g', active: true }
const rawBranch = {
  id: 'b1',
  name: 'Centro',
  addressText: 'Av 1',
  latitude: -34,
  longitude: -58,
  phone: null,
  active: true,
  hours: [],
}
const rawUser = {
  id: 'u1',
  email: 'a@b.com',
  firstName: 'Ana',
  lastName: 'Díaz',
  phone: null,
  role: 'customer',
  active: true,
  branchId: null,
  vehicle: null,
}
const rawProduct = {
  id: 'p1',
  categoryId: 'c1',
  name: 'Hamburguesa',
  description: 'Clásica',
  price: 100,
  image: null,
  available: true,
  configGroups: [
    {
      id: 'g1',
      name: 'Extras',
      type: 'multiple',
      required: false,
      min: null,
      max: null,
      options: [
        { id: 'o1', name: 'Queso', extraPrice: 5, available: true },
        { id: 'o2', name: 'Bacon', extraPrice: 8, available: true },
      ],
    },
    {
      id: 'g2',
      name: 'Salsas',
      type: 'single',
      required: false,
      min: null,
      max: null,
      options: [{ id: 'o3', name: 'Ketchup', extraPrice: 0, available: true }],
    },
  ],
  recipe: [],
}

describe('ProductFieldResolver.category', () => {
  const build = () => {
    const commerce = makeRest()
    const auth = makeRest()
    const resolver = new ProductFieldResolver(asClient(commerce), asClient(auth))
    return { commerce, resolver }
  }

  it('resuelve la categoría por DataLoader con GET /v1/catalog/categories/{id}', async () => {
    const { commerce, resolver } = build()
    commerce.get.mockResolvedValue(rawCategory)

    const result = await resolver.category(asProduct('c1'), makeCtx())

    expect(commerce.get).toHaveBeenCalledWith('/v1/catalog/categories/c1')
    expect(result).toEqual({ id: 'c1', name: 'Hamburguesas', active: true })
  })

  it('devuelve null cuando el REST de la categoría falla', async () => {
    const { commerce, resolver } = build()
    commerce.get.mockRejectedValue(new Error('404'))

    await expect(resolver.category(asProduct('missing'), makeCtx())).resolves.toBeNull()
  })

  it('agrupa varias categorías del mismo tick en una tanda de llamadas', async () => {
    const { commerce, resolver } = build()
    commerce.get.mockImplementation(async (path: string) => ({
      id: path.split('/').pop(),
      name: 'Cat',
      active: true,
    }))
    const ctx = makeCtx()

    const results = await Promise.all([
      resolver.category(asProduct('c1'), ctx),
      resolver.category(asProduct('c2'), ctx),
      resolver.category(asProduct('c3'), ctx),
    ])

    expect(commerce.get).toHaveBeenCalledTimes(3)
    expect(results.map((entry) => entry?.id)).toEqual(['c1', 'c2', 'c3'])
  })

  it('NO deduplica la misma categoría pedida por dos productos (KNOWN BUG RQ-GW-09)', async () => {
    const { commerce, resolver } = build()
    commerce.get.mockResolvedValue(rawCategory)
    const ctx = makeCtx()

    await Promise.all([
      resolver.category(asProduct('c1'), ctx),
      resolver.category(asProduct('c1'), ctx),
    ])

    // KNOWN BUG (RQ-GW-09): dos productos de la misma categoría disparan dos GET.
    expect(commerce.get).toHaveBeenCalledTimes(2)
  })
})

describe('RecipeItemFieldResolver.ingredient', () => {
  const build = () => {
    const commerce = makeRest()
    const auth = makeRest()
    const resolver = new RecipeItemFieldResolver(asClient(commerce), asClient(auth))
    return { commerce, resolver }
  }

  it('resuelve el ingrediente con GET /v1/catalog/ingredients/{id}', async () => {
    const { commerce, resolver } = build()
    commerce.get.mockResolvedValue(rawIngredient)

    const result = await resolver.ingredient(asRecipeItem('i1'), makeCtx())

    expect(commerce.get).toHaveBeenCalledWith('/v1/catalog/ingredients/i1')
    expect(result).toEqual({ id: 'i1', name: 'Carne', unit: 'g', active: true })
  })

  it('devuelve null cuando el ingrediente no existe', async () => {
    const { commerce, resolver } = build()
    commerce.get.mockRejectedValue(new Error('404'))

    await expect(resolver.ingredient(asRecipeItem('i9'), makeCtx())).resolves.toBeNull()
  })
})

describe('CartItemFieldResolver.product', () => {
  const build = () => {
    const commerce = makeRest()
    const auth = makeRest()
    const resolver = new CartItemFieldResolver(asClient(commerce), asClient(auth))
    return { commerce, resolver }
  }

  it('resuelve el producto con GET /v1/catalog/products/{id}', async () => {
    const { commerce, resolver } = build()
    commerce.get.mockResolvedValue(rawProduct)

    const result = await resolver.product(asCartItem('p1', []), makeCtx())

    expect(commerce.get).toHaveBeenCalledWith('/v1/catalog/products/p1')
    expect(result?.id).toBe('p1')
    expect(result?.configGroups).toHaveLength(2)
  })

  it('devuelve null cuando el producto no existe', async () => {
    const { commerce, resolver } = build()
    commerce.get.mockRejectedValue(new Error('404'))

    await expect(resolver.product(asCartItem('p9', []), makeCtx())).resolves.toBeNull()
  })
})

describe('CartItemFieldResolver.options', () => {
  const build = () => {
    const commerce = makeRest()
    const auth = makeRest()
    const resolver = new CartItemFieldResolver(asClient(commerce), asClient(auth))
    return { commerce, resolver }
  }

  it('filtra las opciones del producto según los optionIds del ítem', async () => {
    const { commerce, resolver } = build()
    commerce.get.mockResolvedValue(rawProduct)

    const result = await resolver.options(asCartItem('p1', ['o1', 'o3']), makeCtx())

    expect(commerce.get).toHaveBeenCalledWith('/v1/catalog/products/p1')
    expect(result).toEqual([
      { id: 'o1', name: 'Queso', extraPrice: 5, available: true },
      { id: 'o3', name: 'Ketchup', extraPrice: 0, available: true },
    ])
  })

  it('devuelve vacío cuando ningún optionId pertenece al producto', async () => {
    const { commerce, resolver } = build()
    commerce.get.mockResolvedValue(rawProduct)

    await expect(resolver.options(asCartItem('p1', ['zzz']), makeCtx())).resolves.toEqual([])
  })

  it('devuelve vacío cuando el producto no existe', async () => {
    const { commerce, resolver } = build()
    commerce.get.mockRejectedValue(new Error('404'))

    await expect(resolver.options(asCartItem('p9', ['o1']), makeCtx())).resolves.toEqual([])
  })
})

describe('OrderFieldResolver.client', () => {
  const build = () => {
    const commerce = makeRest()
    const auth = makeRest()
    const delivery = makeRest()
    const resolver = new OrderFieldResolver(
      asClient(commerce),
      asClient(auth),
      asClient(delivery),
    )
    return { auth, resolver }
  }

  it('resuelve el cliente contra Auth con el token interno', async () => {
    const { auth, resolver } = build()
    auth.get.mockResolvedValue(rawUser)

    const result = await resolver.client(asOrder({ clientId: 'u1' }), makeCtx())

    expect(auth.get).toHaveBeenCalledWith('/v1/users/u1', {
      context: { internalToken: env.internalApiToken },
    })
    expect(result).toEqual({
      id: 'u1',
      email: 'a@b.com',
      firstName: 'Ana',
      lastName: 'Díaz',
      phone: null,
      role: Role.CUSTOMER,
      active: true,
      branchId: null,
      vehicle: null,
    })
  })

  it('devuelve null cuando el cliente no existe', async () => {
    const { auth, resolver } = build()
    auth.get.mockRejectedValue(new Error('404'))

    await expect(resolver.client(asOrder({ clientId: 'u9' }), makeCtx())).resolves.toBeNull()
  })

  it('NO reutiliza la carga del mismo cliente en el mismo tick (KNOWN BUG RQ-GW-09)', async () => {
    const { auth, resolver } = build()
    auth.get.mockResolvedValue(rawUser)
    const ctx = makeCtx()

    const results = await Promise.all([
      resolver.client(asOrder({ clientId: 'u1' }), ctx),
      resolver.client(asOrder({ clientId: 'u1' }), ctx),
    ])

    // KNOWN BUG (RQ-GW-09): no hay deduplicación de keys repetidas en el lote.
    expect(auth.get).toHaveBeenCalledTimes(2)
    expect(results.map((entry) => entry?.id)).toEqual(['u1', 'u1'])
  })
})

describe('OrderFieldResolver.branch', () => {
  const build = () => {
    const commerce = makeRest()
    const auth = makeRest()
    const delivery = makeRest()
    const resolver = new OrderFieldResolver(
      asClient(commerce),
      asClient(auth),
      asClient(delivery),
    )
    return { commerce, resolver }
  }

  it('resuelve la sucursal con GET /v1/branches/{id}', async () => {
    const { commerce, resolver } = build()
    commerce.get.mockResolvedValue(rawBranch)

    const result = await resolver.branch(asOrder({ branchId: 'b1' }), makeCtx())

    expect(commerce.get).toHaveBeenCalledWith('/v1/branches/b1')
    expect(result?.id).toBe('b1')
    expect(result?.hours).toEqual([])
  })

  it('devuelve null cuando la sucursal no existe', async () => {
    const { commerce, resolver } = build()
    commerce.get.mockRejectedValue(new Error('404'))

    await expect(resolver.branch(asOrder({ branchId: 'b9' }), makeCtx())).resolves.toBeNull()
  })
})

describe('OrderFieldResolver.riderLocation', () => {
  const build = () => {
    const commerce = makeRest()
    const auth = makeRest()
    const delivery = makeRest()
    const resolver = new OrderFieldResolver(
      asClient(commerce),
      asClient(auth),
      asClient(delivery),
    )
    return { delivery, resolver }
  }

  it('resuelve la ubicación del rider contra Delivery con token interno', async () => {
    const { delivery, resolver } = build()
    delivery.get.mockResolvedValue({ currentLocation: { latitude: -34.6, longitude: -58.4 } })

    const result = await resolver.riderLocation(asOrder({ riderId: 'r1' }))

    expect(delivery.get).toHaveBeenCalledWith('/v1/riders/by-user/r1', {
      context: { internalToken: env.internalApiToken },
    })
    expect(result).toEqual({ latitude: -34.6, longitude: -58.4 })
  })

  it('devuelve null sin consultar si el pedido no tiene rider', async () => {
    const { delivery, resolver } = build()

    await expect(resolver.riderLocation(asOrder({ riderId: null }))).resolves.toBeNull()
    expect(delivery.get).not.toHaveBeenCalled()
  })

  it('devuelve null cuando el rider no tiene ubicación', async () => {
    const { delivery, resolver } = build()
    delivery.get.mockResolvedValue({ currentLocation: null })

    await expect(resolver.riderLocation(asOrder({ riderId: 'r1' }))).resolves.toBeNull()
  })

  it('devuelve null cuando Delivery falla', async () => {
    const { delivery, resolver } = build()
    delivery.get.mockRejectedValue(new Error('503'))

    await expect(resolver.riderLocation(asOrder({ riderId: 'r1' }))).resolves.toBeNull()
  })
})

describe('BranchStockFieldResolver.ingredient', () => {
  const build = () => {
    const commerce = makeRest()
    const auth = makeRest()
    const resolver = new BranchStockFieldResolver(asClient(commerce), asClient(auth))
    return { commerce, resolver }
  }

  it('resuelve el ingrediente del stock', async () => {
    const { commerce, resolver } = build()
    commerce.get.mockResolvedValue(rawIngredient)

    const result = await resolver.ingredient(asBranchStock('i1'), makeCtx())

    expect(commerce.get).toHaveBeenCalledWith('/v1/catalog/ingredients/i1')
    expect(result?.unit).toBe('g')
  })

  it('devuelve null cuando el ingrediente no existe', async () => {
    const { commerce, resolver } = build()
    commerce.get.mockRejectedValue(new Error('404'))

    await expect(resolver.ingredient(asBranchStock('i9'), makeCtx())).resolves.toBeNull()
  })
})
