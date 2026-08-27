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
})
