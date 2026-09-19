import { ConfigGroupType } from '../common/config-group-type.enum'
import { OrderStatus } from '../common/order-status.enum'
import {
  mapBranch,
  mapBranchHour,
  mapBranchStock,
  mapCart,
  mapCartItem,
  mapCategory,
  mapConfigGroup,
  mapConfigOption,
  mapIngredient,
  mapOrder,
  mapOrderItem,
  mapOrderItemOption,
  mapOrderState,
  mapOrderStatusHistory,
  mapOutOfStockRow,
  mapParameter,
  mapProduct,
  mapProductReportRow,
  mapPromotion,
  mapRecipeItem,
  mapStockMovement,
} from './commerce.types'

const rawProduct = {
  id: 'p1',
  categoryId: 'c1',
  name: 'Hamburguesa',
  description: 'Clásica',
  price: 100,
  image: 'https://cdn/p1.png',
  available: true,
  configGroups: [],
  recipe: [],
}

describe('mapCategory', () => {
  it('mapea los campos y usa _id como fallback', () => {
    expect(mapCategory({ _id: 'c9', name: 'Bebidas', active: true })).toEqual({
      id: 'c9',
      name: 'Bebidas',
      active: true,
    })
  })

  it('aplica defaults ante campos ausentes o nulos', () => {
    expect(mapCategory({})).toEqual({ id: '', name: '', active: false })
    expect(mapCategory({ id: 'c1', name: null, active: undefined })).toEqual({
      id: 'c1',
      name: '',
      active: false,
    })
  })
})

describe('mapConfigOption', () => {
  it('mapea opción completa', () => {
    expect(
      mapConfigOption({ id: 'o1', name: 'Extra queso', extraPrice: 10.5, available: true }),
    ).toEqual({ id: 'o1', name: 'Extra queso', extraPrice: 10.5, available: true })
  })

  it('convierte respuestas parciales con valores por defecto', () => {
    expect(mapConfigOption({ name: 'Sin salsa' })).toEqual({
      id: '',
      name: 'Sin salsa',
      extraPrice: 0,
      available: false,
    })
  })
})

describe('mapConfigGroup', () => {
  it('mapea el grupo, su tipo y sus opciones anidadas', () => {
    const result = mapConfigGroup({
      id: 'g1',
      name: 'Extras',
      type: 'multiple',
      required: false,
      min: 1,
      max: 3,
      options: [{ id: 'o1', name: 'Queso', extraPrice: 10, available: true }],
    })

    expect(result).toEqual({
      id: 'g1',
      name: 'Extras',
      type: ConfigGroupType.MULTIPLE,
      required: false,
      min: 1,
      max: 3,
      options: [{ id: 'o1', name: 'Queso', extraPrice: 10, available: true }],
    })
  })

  it.each<[Record<string, unknown>, number | null, number | null]>([
    [{}, null, null],
    [{ min: null, max: null }, null, null],
    [{ min: 0, max: 0 }, 0, 0],
    [{ min: '2', max: 5 }, 2, 5],
  ])('resuelve min/max nulos o ausentes %#', (raw, min, max) => {
    const result = mapConfigGroup({ ...raw, type: 'single' })

    expect(result.min).toBe(min)
    expect(result.max).toBe(max)
  })

  it('devuelve options vacío cuando no es arreglo', () => {
    expect(mapConfigGroup({ type: 'single', options: 'nope' }).options).toEqual([])
  })

  it('lanza error con un tipo desconocido', () => {
    expect(() => mapConfigGroup({ type: 'inventado' })).toThrow(
      'Unknown config group type: inventado',
    )
  })
})

describe('mapRecipeItem', () => {
  it('mapea un ítem de receta', () => {
    expect(mapRecipeItem({ id: 'r1', ingredientId: 'i1', quantity: 2.5 })).toEqual({
      id: 'r1',
      ingredientId: 'i1',
      quantity: 2.5,
    })
  })

  it('usa defaults ante ausencia de datos', () => {
    expect(mapRecipeItem({})).toEqual({ id: '', ingredientId: '', quantity: 0 })
  })
})

describe('mapIngredient', () => {
  it('mapea un ingrediente completo', () => {
    expect(mapIngredient({ id: 'i1', name: 'Carne', unit: 'g', active: true })).toEqual({
      id: 'i1',
      name: 'Carne',
      unit: 'g',
      active: true,
    })
  })

  it('aplica defaults ante ausencia de datos', () => {
    expect(mapIngredient({})).toEqual({ id: '', name: '', unit: '', active: false })
  })
})

describe('mapProduct', () => {
  it('mapea el producto con configGroups y recipe anidados', () => {
    const result = mapProduct({
      ...rawProduct,
      configGroups: [
        {
          id: 'g1',
          name: 'Extras',
          type: 'single',
          required: true,
          min: null,
          max: null,
          options: [{ id: 'o1', name: 'Queso', extraPrice: 5, available: true }],
        },
      ],
      recipe: [{ id: 'r1', ingredientId: 'i1', quantity: 100 }],
    })

    expect(result.id).toBe('p1')
    expect(result.categoryId).toBe('c1')
    expect(result.price).toBe(100)
    expect(result.image).toBe('https://cdn/p1.png')
    expect(result.configGroups).toHaveLength(1)
    expect(result.configGroups[0].type).toBe(ConfigGroupType.SINGLE)
    expect(result.configGroups[0].options[0].id).toBe('o1')
    expect(result.recipe).toEqual([{ id: 'r1', ingredientId: 'i1', quantity: 100 }])
  })

  it('devuelve image null y colecciones vacías cuando faltan', () => {
    const result = mapProduct({ id: 'p1' })

    expect(result.image).toBeNull()
    expect(result.configGroups).toEqual([])
    expect(result.recipe).toEqual([])
    expect(result.price).toBe(0)
    expect(result.available).toBe(false)
  })
})

describe('mapPromotion', () => {
  it('mapea la promoción y deja description nullable', () => {
    expect(
      mapPromotion({
        id: 'pr1',
        name: '2x1',
        description: null,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        active: true,
      }),
    ).toEqual({
      id: 'pr1',
      name: '2x1',
      description: null,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      active: true,
    })
  })
})

describe('mapBranchHour', () => {
  it('mapea un horario abierto', () => {
    expect(
      mapBranchHour({ dayOfWeek: 1, opening: '09:00', closing: '18:00', closed: false }),
    ).toEqual({ dayOfWeek: 1, opening: '09:00', closing: '18:00', closed: false })
  })

  it('mapea un día cerrado con opening/closing nulos', () => {
    expect(mapBranchHour({ dayOfWeek: 0, closed: true })).toEqual({
      dayOfWeek: 0,
      opening: null,
      closing: null,
      closed: true,
    })
  })
})

describe('mapBranch', () => {
  it('mapea la sucursal con sus horas anidadas', () => {
    const result = mapBranch({
      id: 'b1',
      name: 'Centro',
      addressText: 'Av 1',
      latitude: -34,
      longitude: -58,
      phone: '123',
      active: true,
      hours: [{ dayOfWeek: 1, opening: '09:00', closing: '18:00', closed: false }],
    })

    expect(result).toEqual({
      id: 'b1',
      name: 'Centro',
      addressText: 'Av 1',
      latitude: -34,
      longitude: -58,
      phone: '123',
      active: true,
      hours: [{ dayOfWeek: 1, opening: '09:00', closing: '18:00', closed: false }],
    })
  })

  it('devuelve phone null y hours vacío cuando faltan', () => {
    const result = mapBranch({ id: 'b1' })

    expect(result.phone).toBeNull()
    expect(result.hours).toEqual([])
    expect(result.latitude).toBe(0)
  })
})

describe('mapCartItem', () => {
  it('mapea el ítem, sus optionIds y deja options vacío para resolver por campo', () => {
    expect(
      mapCartItem({
        id: 'ci1',
        productId: 'p1',
        quantity: 2,
        observations: null,
        optionIds: ['o1', 'o2'],
      }),
    ).toEqual({
      id: 'ci1',
      productId: 'p1',
      quantity: 2,
      observations: null,
      optionIds: ['o1', 'o2'],
      options: [],
    })
  })

  it('usa defaults ante campos ausentes', () => {
    expect(mapCartItem({})).toEqual({
      id: '',
      productId: '',
      quantity: 0,
      observations: null,
      optionIds: [],
      options: [],
    })
  })
})

describe('mapCart', () => {
  it('mapea el carrito y sus ítems', () => {
    const result = mapCart({
      id: 'cart1',
      clientId: 'u1',
      status: 'active',
      total: 200,
      items: [{ id: 'ci1', productId: 'p1', quantity: 2, optionIds: [] }],
    })

    expect(result.id).toBe('cart1')
    expect(result.total).toBe(200)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].productId).toBe('p1')
  })

  it('devuelve items vacío cuando no es arreglo', () => {
    expect(mapCart({ items: 'nope' }).items).toEqual([])
  })
})

describe('mapOrderItemOption', () => {
  it('mapea la opción del ítem', () => {
    expect(mapOrderItemOption({ optionId: 'o1', name: 'Queso', extraPrice: 5 })).toEqual({
      optionId: 'o1',
      name: 'Queso',
      extraPrice: 5,
    })
  })
})

describe('mapOrderItem', () => {
  it('mapea el ítem con options anidadas', () => {
    const result = mapOrderItem({
      productId: 'p1',
      name: 'Hamburguesa',
      unitPrice: 100,
      quantity: 2,
      observations: 'sin sal',
      subtotal: 200,
      options: [{ optionId: 'o1', name: 'Queso', extraPrice: 5 }],
    })

    expect(result).toEqual({
      productId: 'p1',
      name: 'Hamburguesa',
      unitPrice: 100,
      quantity: 2,
      observations: 'sin sal',
      subtotal: 200,
      options: [{ optionId: 'o1', name: 'Queso', extraPrice: 5 }],
    })
  })

  it('usa defaults y options vacío ante ausencia de datos', () => {
    expect(mapOrderItem({})).toEqual({
      productId: '',
      name: '',
      unitPrice: 0,
      quantity: 0,
      observations: null,
      subtotal: 0,
      options: [],
    })
  })
})

describe('mapOrderStatusHistory', () => {
  it('convierte los estados REST', () => {
    expect(
      mapOrderStatusHistory({
        previousStatus: 'pending',
        newStatus: 'ready_for_delivery',
        changedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      previousStatus: OrderStatus.PENDING,
      newStatus: OrderStatus.READY_FOR_DELIVERY,
      changedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('lanza error ante un estado desconocido', () => {
    expect(() => mapOrderStatusHistory({ previousStatus: 'foo', newStatus: 'pending' })).toThrow(
      'Unknown order status: foo',
    )
  })
})

describe('mapOrder', () => {
  it('mapea el pedido completo', () => {
    const result = mapOrder({
      id: 'o1',
      number: '000123',
      clientId: 'u1',
      riderId: 'r1',
      branchId: 'b1',
      deliveryAddress: { text: 'Av 1', latitude: -34, longitude: -58 },
      status: 'on_the_way',
      total: 250,
      estimatedDeliveryAt: '2026-01-01T00:30:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      items: [{ productId: 'p1', name: 'H', unitPrice: 100, quantity: 2, subtotal: 200 }],
      statusHistory: [{ previousStatus: 'pending', newStatus: 'confirmed', changedAt: 't' }],
      availableTransitions: ['delivered', 'cancelled'],
    })

    expect(result.id).toBe('o1')
    expect(result.riderId).toBe('r1')
    expect(result.status).toBe(OrderStatus.ON_THE_WAY)
    expect(result.deliveryAddress).toEqual({ text: 'Av 1', latitude: -34, longitude: -58 })
    expect(result.items).toHaveLength(1)
    expect(result.statusHistory[0].newStatus).toBe(OrderStatus.CONFIRMED)
    expect(result.availableTransitions).toEqual([
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ])
  })

  it('aplica defaults cuando faltan campos y la dirección', () => {
    const result = mapOrder({ status: 'pending' })

    expect(result.riderId).toBeNull()
    expect(result.estimatedDeliveryAt).toBeNull()
    expect(result.deliveryAddress).toEqual({ text: '', latitude: 0, longitude: 0 })
    expect(result.items).toEqual([])
    expect(result.statusHistory).toEqual([])
    expect(result.availableTransitions).toEqual([])
  })

  it('descarta transiciones que no son arreglo', () => {
    expect(mapOrder({ status: 'pending', availableTransitions: null }).availableTransitions).toEqual(
      [],
    )
  })

  it('lanza error si un elemento de availableTransitions es desconocido', () => {
    expect(() => mapOrder({ status: 'pending', availableTransitions: ['foo'] })).toThrow(
      'Unknown order status: foo',
    )
  })
})

describe('mapBranchStock', () => {
  it('mapea el stock de sucursal', () => {
    expect(mapBranchStock({ ingredientId: 'i1', branchId: 'b1', quantity: 10 })).toEqual({
      ingredientId: 'i1',
      branchId: 'b1',
      quantity: 10,
    })
  })
})

describe('mapStockMovement', () => {
  it('mapea el movimiento con orderId nullable', () => {
    expect(
      mapStockMovement({
        id: 'm1',
        branchId: 'b1',
        ingredientId: 'i1',
        delta: -2,
        reason: 'venta',
        orderId: 'o1',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      id: 'm1',
      branchId: 'b1',
      ingredientId: 'i1',
      delta: -2,
      reason: 'venta',
      orderId: 'o1',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('deja orderId null cuando falta', () => {
    expect(mapStockMovement({ id: 'm1' }).orderId).toBeNull()
  })
})

describe('mapParameter', () => {
  it('mapea el parámetro de configuración', () => {
    expect(mapParameter({ key: 'delivery_fee', value: 50, unit: 'ARS' })).toEqual({
      key: 'delivery_fee',
      value: 50,
      unit: 'ARS',
    })
  })
})

describe('mapOrderState', () => {
  it('mapea el estado de pedido configurable', () => {
    expect(mapOrderState({ code: 'pending', name: 'Pendiente', order: 1, active: true })).toEqual({
      code: 'pending',
      name: 'Pendiente',
      order: 1,
      active: true,
    })
  })
})

describe('mapProductReportRow', () => {
  it('mapea la fila con producto y categoría anidados', () => {
    const result = mapProductReportRow({
      position: 1,
      product: rawProduct,
      category: { id: 'c1', name: 'Hamburguesas', active: true },
      quantity: 5,
      revenue: 500,
    })

    expect(result.position).toBe(1)
    expect(result.product.id).toBe('p1')
    expect(result.category).toEqual({ id: 'c1', name: 'Hamburguesas', active: true })
    expect(result.quantity).toBe(5)
    expect(result.revenue).toBe(500)
  })

  it.each<[Record<string, unknown>, number | null, number | null]>([
    [{ category: null, quantity: null, revenue: null }, null, null],
    [{ quantity: 0, revenue: 0 }, 0, 0],
    [{ category: undefined }, null, null],
  ])('resuelve campos opcionales %#', (raw, quantity, revenue) => {
    const result = mapProductReportRow({ position: 1, product: rawProduct, ...raw })

    expect(result.category).toBeNull()
    expect(result.quantity).toBe(quantity)
    expect(result.revenue).toBe(revenue)
  })
})

describe('mapOutOfStockRow', () => {
  it('mapea la fila con categoría anidada', () => {
    const result = mapOutOfStockRow({
      product: rawProduct,
      category: { id: 'c1', name: 'Hamburguesas', active: true },
      quantity: 0,
    })

    expect(result.product.id).toBe('p1')
    expect(result.category).toEqual({ id: 'c1', name: 'Hamburguesas', active: true })
    expect(result.quantity).toBe(0)
  })

  it('deja category null cuando falta', () => {
    const result = mapOutOfStockRow({ product: rawProduct, quantity: 3 })

    expect(result.category).toBeNull()
    expect(result.quantity).toBe(3)
  })
})
