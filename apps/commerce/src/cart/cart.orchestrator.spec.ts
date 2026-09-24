import { ERROR_CODES } from '../config/constants'
import type { PublicProduct } from '../product/product.model'
import { ProductService } from '../product/product.service'
import type { PublicCart } from './cart.model'
import type { CartItemData } from './cart.repository'
import { CartService } from './cart.service'
import { CartOrchestrator } from './cart.orchestrator'

const product = (overrides: Partial<PublicProduct> = {}): PublicProduct => ({
  id: 'p1',
  categoryId: 'cat1',
  name: 'Hamburguesa',
  description: 'Clásica',
  price: 100,
  image: null,
  available: true,
  configGroups: [
    {
      id: 'g1',
      name: 'Tamaño',
      type: 'single',
      required: true,
      min: null,
      max: null,
      options: [
        { id: 'opt1', name: 'Doble', extraPrice: 50, available: true },
        { id: 'opt2', name: 'Simple', extraPrice: 0, available: true },
      ],
    },
  ],
  recipe: [],
  ...overrides,
})

const cart = (overrides: Partial<PublicCart> = {}): PublicCart => ({
  id: 'cart1',
  clientId: 'c1',
  status: 'active',
  items: [],
  total: 0,
  ...overrides,
})

const makeOrchestrator = () => {
  const cartService = {
    findActiveByClient: jest.fn(),
    createActive: jest.fn(),
    replaceItems: jest.fn(),
    confirm: jest.fn(),
  }
  const productService = {
    findById: jest.fn(),
    findByIds: jest.fn(),
  }
  const orchestrator = new CartOrchestrator(
    cartService as unknown as CartService,
    productService as unknown as ProductService,
  )
  return { orchestrator, cartService, productService }
}

describe('CartOrchestrator.getCart (RQ-CART-01)', () => {
  it('devuelve el carrito activo existente', async () => {
    const { orchestrator, cartService } = makeOrchestrator()
    cartService.findActiveByClient.mockResolvedValue(cart())

    await expect(orchestrator.getCart('c1')).resolves.toMatchObject({ id: 'cart1' })
    expect(cartService.createActive).not.toHaveBeenCalled()
  })

  it('crea un carrito si no existe', async () => {
    const { orchestrator, cartService } = makeOrchestrator()
    cartService.findActiveByClient.mockResolvedValue(null)
    cartService.createActive.mockResolvedValue(cart({ id: 'cart-new' }))

    await expect(orchestrator.getCart('c1')).resolves.toMatchObject({ id: 'cart-new' })
    expect(cartService.createActive).toHaveBeenCalledWith('c1')
  })
})

describe('CartOrchestrator.addItem (RQ-CART-02/06/07)', () => {
  it('calcula el total con adicionales de opciones', async () => {
    const { orchestrator, cartService, productService } = makeOrchestrator()
    cartService.findActiveByClient.mockResolvedValue(cart())
    productService.findById.mockResolvedValue(product())
    productService.findByIds.mockResolvedValue([product()])
    cartService.replaceItems.mockImplementation(async (_id: string, items: CartItemData[]) =>
      cart({ items: items.map((item, index) => ({ id: `i${index}`, ...item })), total: 300 }),
    )

    const result = await orchestrator.addItem('c1', {
      productId: 'p1',
      quantity: 2,
      optionIds: ['opt1'],
    })

    expect(result.total).toBe(300)
    expect(cartService.replaceItems).toHaveBeenCalled()
  })

  it('rechaza un producto no disponible', async () => {
    const { orchestrator, productService } = makeOrchestrator()
    productService.findById.mockResolvedValue(product({ available: false }))

    await expect(
      orchestrator.addItem('c1', { productId: 'p1', quantity: 1 }),
    ).rejects.toMatchObject({ code: ERROR_CODES.productUnavailable })
  })

  it('rechaza una opción no disponible', async () => {
    const { orchestrator, productService } = makeOrchestrator()
    productService.findById.mockResolvedValue(product())
    productService.findByIds.mockResolvedValue([product()])

    await expect(
      orchestrator.addItem('c1', { productId: 'p1', quantity: 1, optionIds: ['missing'] }),
    ).rejects.toMatchObject({ code: ERROR_CODES.productUnavailable })
  })
})

describe('CartOrchestrator.removeItem (RQ-CART-05)', () => {
  it('elimina el ítem y recalcula el total', async () => {
    const { orchestrator, cartService, productService } = makeOrchestrator()
    cartService.findActiveByClient.mockResolvedValue(
      cart({
        items: [{ id: 'i1', productId: 'p1', quantity: 2, observations: null, optionIds: [] }],
        total: 200,
      }),
    )
    productService.findByIds.mockResolvedValue([product()])
    cartService.replaceItems.mockResolvedValue(cart({ items: [], total: 0 }))

    const result = await orchestrator.removeItem('c1', 'i1')

    expect(result.total).toBe(0)
  })

  it('rechaza un ítem inexistente', async () => {
    const { orchestrator, cartService } = makeOrchestrator()
    cartService.findActiveByClient.mockResolvedValue(cart())

    await expect(orchestrator.removeItem('c1', 'missing')).rejects.toMatchObject({
      code: ERROR_CODES.cartItemNotFound,
    })
  })

  it('al eliminar el último ítem recalcula el total en 0 y envía la lista vacía', async () => {
    const { orchestrator, cartService, productService } = makeOrchestrator()
    cartService.findActiveByClient.mockResolvedValue(
      cart({
        items: [{ id: 'i1', productId: 'p1', quantity: 2, observations: null, optionIds: [] }],
        total: 200,
      }),
    )
    productService.findByIds.mockResolvedValue([])
    cartService.replaceItems.mockResolvedValue(cart({ items: [], total: 0 }))

    await orchestrator.removeItem('c1', 'i1')

    expect(cartService.replaceItems).toHaveBeenCalledWith('cart1', [], 0)
  })
})

describe('CartOrchestrator.addItem — apilado y cálculo (RQ-CART-03/06/07)', () => {
  it('agrega el ítem al final del carrito existente', async () => {
    const { orchestrator, cartService, productService } = makeOrchestrator()
    cartService.findActiveByClient.mockResolvedValue(
      cart({
        items: [{ id: 'i1', productId: 'p1', quantity: 1, observations: 'sin sal', optionIds: [] }],
        total: 100,
      }),
    )
    productService.findById.mockResolvedValue(product())
    productService.findByIds.mockResolvedValue([product()])
    cartService.replaceItems.mockResolvedValue(cart({ total: 300 }))

    await orchestrator.addItem('c1', { productId: 'p1', quantity: 2 })

    expect(cartService.replaceItems).toHaveBeenCalledWith(
      'cart1',
      [
        { productId: 'p1', quantity: 1, observations: 'sin sal', optionIds: [] },
        { productId: 'p1', quantity: 2, observations: null, optionIds: [] },
      ],
      300,
    )
  })

  it('calcula el total sumando los adicionales de las opciones', async () => {
    const { orchestrator, cartService, productService } = makeOrchestrator()
    cartService.findActiveByClient.mockResolvedValue(cart())
    productService.findById.mockResolvedValue(product())
    productService.findByIds.mockResolvedValue([product()])
    cartService.replaceItems.mockResolvedValue(cart({ total: 300 }))

    await orchestrator.addItem('c1', { productId: 'p1', quantity: 2, optionIds: ['opt1'] })

    const total = cartService.replaceItems.mock.calls[0][2]
    expect(total).toBe(300)
  })

  it('ignora productos ausentes en el cálculo del total', async () => {
    const { orchestrator, cartService, productService } = makeOrchestrator()
    cartService.findActiveByClient.mockResolvedValue(
      cart({
        items: [{ id: 'i1', productId: 'ghost', quantity: 1, observations: null, optionIds: [] }],
        total: 0,
      }),
    )
    productService.findById.mockResolvedValue(product())
    productService.findByIds.mockResolvedValue([])
    cartService.replaceItems.mockResolvedValue(cart())

    await orchestrator.addItem('c1', { productId: 'p1', quantity: 1 })

    expect(cartService.replaceItems.mock.calls[0][2]).toBe(0)
  })
})

describe('CartOrchestrator.updateItem (RQ-CART-04)', () => {
  const existingItem = {
    id: 'i1',
    productId: 'p1',
    quantity: 2,
    observations: null,
    optionIds: [] as string[],
  }

  const primeUpdate = (mocks: ReturnType<typeof makeOrchestrator>) => {
    mocks.cartService.findActiveByClient.mockResolvedValue(
      cart({ items: [existingItem], total: 200 }),
    )
    mocks.productService.findById.mockResolvedValue(product())
    mocks.productService.findByIds.mockResolvedValue([product()])
    mocks.cartService.replaceItems.mockResolvedValue(cart({ total: 200 }))
  }

  it('cambia la cantidad y recalcula el total', async () => {
    const mocks = makeOrchestrator()
    primeUpdate(mocks)

    await mocks.orchestrator.updateItem('c1', 'i1', { quantity: 3 })

    expect(mocks.cartService.replaceItems).toHaveBeenCalledWith(
      'cart1',
      [{ productId: 'p1', quantity: 3, observations: null, optionIds: [] }],
      300,
    )
  })

  it('cambia las observaciones sin tocar cantidad ni total', async () => {
    const mocks = makeOrchestrator()
    primeUpdate(mocks)

    await mocks.orchestrator.updateItem('c1', 'i1', { observations: 'sin hielo' })

    expect(mocks.cartService.replaceItems).toHaveBeenCalledWith(
      'cart1',
      [{ productId: 'p1', quantity: 2, observations: 'sin hielo', optionIds: [] }],
      200,
    )
  })

  it('cambia las opciones y suma sus adicionales al total', async () => {
    const mocks = makeOrchestrator()
    primeUpdate(mocks)

    await mocks.orchestrator.updateItem('c1', 'i1', { optionIds: ['opt1'] })

    expect(mocks.cartService.replaceItems).toHaveBeenCalledWith(
      'cart1',
      [{ productId: 'p1', quantity: 2, observations: null, optionIds: ['opt1'] }],
      300,
    )
  })

  it('permite limpiar las observaciones con null', async () => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue(
      cart({ items: [{ ...existingItem, observations: 'sin sal' }], total: 200 }),
    )
    mocks.productService.findById.mockResolvedValue(product())
    mocks.productService.findByIds.mockResolvedValue([product()])
    mocks.cartService.replaceItems.mockResolvedValue(cart({ total: 200 }))

    await mocks.orchestrator.updateItem('c1', 'i1', { observations: null })

    expect(mocks.cartService.replaceItems.mock.calls[0][1][0].observations).toBeNull()
  })

  it('rechaza si el ítem no existe', async () => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue(cart())

    await expect(
      mocks.orchestrator.updateItem('c1', 'missing', { quantity: 1 }),
    ).rejects.toMatchObject({ code: ERROR_CODES.cartItemNotFound, status: 404 })
    expect(mocks.cartService.replaceItems).not.toHaveBeenCalled()
  })

  it('rechaza si el producto dejó de estar disponible', async () => {
    const mocks = makeOrchestrator()
    mocks.cartService.findActiveByClient.mockResolvedValue(
      cart({ items: [existingItem], total: 200 }),
    )
    mocks.productService.findById.mockResolvedValue(product({ available: false }))

    await expect(mocks.orchestrator.updateItem('c1', 'i1', { quantity: 3 })).rejects.toMatchObject({
      code: ERROR_CODES.productUnavailable,
      status: 400,
    })
  })

  it('rechaza una opción inexistente al actualizar', async () => {
    const mocks = makeOrchestrator()
    primeUpdate(mocks)

    await expect(
      mocks.orchestrator.updateItem('c1', 'i1', { optionIds: ['missing'] }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.productUnavailable,
      message: 'Configuración no disponible',
    })
  })

  it('rechaza con CART_NOT_FOUND si el carrito desaparece al persistir', async () => {
    const mocks = makeOrchestrator()
    primeUpdate(mocks)
    mocks.cartService.replaceItems.mockResolvedValue(null)

    await expect(mocks.orchestrator.updateItem('c1', 'i1', { quantity: 3 })).rejects.toMatchObject({
      code: ERROR_CODES.cartNotFound,
      status: 404,
    })
  })
})

describe('CartOrchestrator.replaceItems (RQ-ORD-17)', () => {
  it('reemplaza ítems y total sobre el carrito activo', async () => {
    const { orchestrator, cartService, productService } = makeOrchestrator()
    cartService.findActiveByClient.mockResolvedValue(cart())
    productService.findByIds.mockResolvedValue([product()])
    cartService.replaceItems.mockResolvedValue(cart({ total: 400 }))

    const result = await orchestrator.replaceItems('c1', [
      { productId: 'p1', quantity: 2, observations: null, optionIds: [] },
      { productId: 'p1', quantity: 2, observations: null, optionIds: [] },
    ])

    expect(cartService.replaceItems).toHaveBeenCalledWith(
      'cart1',
      [
        { productId: 'p1', quantity: 2, observations: null, optionIds: [] },
        { productId: 'p1', quantity: 2, observations: null, optionIds: [] },
      ],
      400,
    )
    expect(result.total).toBe(400)
  })

  it('crea el carrito activo si el cliente no tiene uno', async () => {
    const { orchestrator, cartService, productService } = makeOrchestrator()
    cartService.findActiveByClient.mockResolvedValue(null)
    cartService.createActive.mockResolvedValue(cart({ id: 'cart-new' }))
    productService.findByIds.mockResolvedValue([])
    cartService.replaceItems.mockResolvedValue(cart({ id: 'cart-new' }))

    await orchestrator.replaceItems('c1', [])

    expect(cartService.createActive).toHaveBeenCalledWith('c1')
    expect(cartService.replaceItems).toHaveBeenCalledWith('cart-new', [], 0)
  })

  it('con una lista vacía deja el total en 0', async () => {
    const { orchestrator, cartService } = makeOrchestrator()
    cartService.findActiveByClient.mockResolvedValue(cart({ total: 500 }))
    cartService.replaceItems.mockResolvedValue(cart({ total: 0 }))

    await orchestrator.replaceItems('c1', [])

    expect(cartService.replaceItems).toHaveBeenCalledWith('cart1', [], 0)
  })
})

describe('CartOrchestrator.confirmCart (RQ-CART-08/09)', () => {
  it('confirma el carrito activo', async () => {
    const { orchestrator, cartService } = makeOrchestrator()
    cartService.findActiveByClient.mockResolvedValue(cart())
    cartService.confirm.mockResolvedValue(cart({ status: 'confirmed' }))

    const result = await orchestrator.confirmCart('c1')

    expect(cartService.confirm).toHaveBeenCalledWith('cart1')
    expect(result.status).toBe('confirmed')
  })

  it('rechaza con CART_NOT_FOUND si el carrito no puede confirmarse', async () => {
    const { orchestrator, cartService } = makeOrchestrator()
    cartService.findActiveByClient.mockResolvedValue(cart())
    cartService.confirm.mockResolvedValue(null)

    await expect(orchestrator.confirmCart('c1')).rejects.toMatchObject({
      code: ERROR_CODES.cartNotFound,
      status: 404,
    })
  })
})
