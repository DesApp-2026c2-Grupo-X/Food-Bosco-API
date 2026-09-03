import { Injectable, Logger } from '@nestjs/common'
import { CONFIG_GROUP_TYPE, ORDER_STATUS, PARAMETER_KEYS } from '../config/constants'
import { env } from '../config/env'
import { BranchService } from '../branch/branch.service'
import type { BranchHours } from '../branch/branch.model'
import { CategoryService } from '../category/category.service'
import { IngredientService } from '../ingredient/ingredient.service'
import { OrderStateService } from '../order-state/order-state.service'
import { ParameterService } from '../parameter/parameter.service'
import { ProductService } from '../product/product.service'
import { PromotionService } from '../promotion/promotion.service'
import { StockService } from '../stock/stock.service'

const img = (id: string, width = 800) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`

const weekdayHours = (opening: string, closing: string): BranchHours[] =>
  [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, opening, closing, closed: false }))

const SEED_CATEGORIES = ['Hamburguesas', 'Pizzas', 'Acompañamientos', 'Bebidas', 'Postres']

const SEED_INGREDIENTS: { name: string; unit: string }[] = [
  { name: 'Pan de hamburguesa', unit: 'un' },
  { name: 'Medallón de carne', unit: 'un' },
  { name: 'Feta de queso', unit: 'un' },
  { name: 'Lechuga', unit: 'un' },
  { name: 'Tomate', unit: 'un' },
  { name: 'Masa de pizza', unit: 'un' },
  { name: 'Muzzarella', unit: 'g' },
  { name: 'Salsa de tomate', unit: 'g' },
  { name: 'Papa', unit: 'kg' },
  { name: 'Bebida cola', unit: 'botella' },
  { name: 'Helado', unit: 'un' },
  { name: 'Leche', unit: 'l' },
]

const SEED_BRANCHES = [
  {
    name: 'Centro',
    addressText: 'Av. Vergara 1200, Hurlingham',
    latitude: -34.589,
    longitude: -58.636,
    phone: '11 5555 1111',
  },
  {
    name: 'Norte',
    addressText: 'Calle 25 de Mayo 450, Villa Tesei',
    latitude: -34.586,
    longitude: -58.63,
    phone: '11 5555 2222',
  },
  {
    name: 'Oeste',
    addressText: 'Av. Roca 600, Morón',
    latitude: -34.651,
    longitude: -58.621,
    phone: '11 5555 3333',
  },
]

interface OptionSeed {
  name: string
  extraPrice: number
}

interface GroupSeed {
  name: string
  type: 'single' | 'multiple'
  required: boolean
  min: number | null
  max: number | null
  options: OptionSeed[]
}

interface ProductSeed {
  category: string
  name: string
  description: string
  price: number
  image: string
  groups: GroupSeed[]
  recipe: { ingredient: string; quantity: number }[]
}

const sizeGroup = (name: string, options: [string, number][]): GroupSeed => ({
  name,
  type: CONFIG_GROUP_TYPE.single,
  required: true,
  min: 1,
  max: 1,
  options: options.map(([optionName, extraPrice]) => ({ name: optionName, extraPrice })),
})

const extrasGroup = (options: [string, number][]): GroupSeed => ({
  name: 'Extras',
  type: CONFIG_GROUP_TYPE.multiple,
  required: false,
  min: 0,
  max: options.length,
  options: options.map(([optionName, extraPrice]) => ({ name: optionName, extraPrice })),
})

const SEED_PRODUCTS: ProductSeed[] = [
  {
    category: 'Hamburguesas',
    name: 'Hamburguesa Clásica',
    description: 'Carne 120g, cheddar, lechuga, tomate y salsa de la casa.',
    price: 6500,
    image: img('1568901346375-23c9450c58cd'),
    groups: [
      sizeGroup('Tamaño', [
        ['Simple', 0],
        ['Doble', 1500],
        ['Triple', 2500],
      ]),
      extrasGroup([
        ['Queso extra', 800],
        ['Bacon', 900],
        ['Huevo', 500],
      ]),
    ],
    recipe: [
      { ingredient: 'Pan de hamburguesa', quantity: 1 },
      { ingredient: 'Medallón de carne', quantity: 1 },
      { ingredient: 'Feta de queso', quantity: 1 },
      { ingredient: 'Lechuga', quantity: 1 },
      { ingredient: 'Tomate', quantity: 1 },
    ],
  },
  {
    category: 'Hamburguesas',
    name: 'Doble Cheddar',
    description: 'Doble carne, doble cheddar y cebolla caramelizada.',
    price: 8900,
    image: img('1571091718767-18b5b1457add'),
    groups: [
      sizeGroup('Tamaño', [
        ['Simple', 0],
        ['Doble', 1200],
      ]),
      extrasGroup([
        ['Bacon', 900],
        ['Jalapeños', 600],
      ]),
    ],
    recipe: [
      { ingredient: 'Pan de hamburguesa', quantity: 1 },
      { ingredient: 'Medallón de carne', quantity: 2 },
      { ingredient: 'Feta de queso', quantity: 2 },
    ],
  },
  {
    category: 'Pizzas',
    name: 'Pizza Mozzarella',
    description: 'Muzzarella, tomate, aceite de oliva y orégano.',
    price: 7800,
    image: img('1513104890138-7c749659a591'),
    groups: [
      sizeGroup('Tamaño', [
        ['Grande', 0],
        ['Familiar', 2500],
      ]),
      extrasGroup([
        ['Jamón', 1200],
        ['Aceitunas', 700],
      ]),
    ],
    recipe: [
      { ingredient: 'Masa de pizza', quantity: 1 },
      { ingredient: 'Muzzarella', quantity: 150 },
      { ingredient: 'Salsa de tomate', quantity: 80 },
    ],
  },
  {
    category: 'Pizzas',
    name: 'Pizza Napolitana',
    description: 'Muzzarella, tomate, ajo y albahaca fresca.',
    price: 8200,
    image: img('1565299624946-b28f40a0ae38'),
    groups: [
      sizeGroup('Tamaño', [
        ['Grande', 0],
        ['Familiar', 2500],
      ]),
      extrasGroup([['Queso extra', 1000]]),
    ],
    recipe: [
      { ingredient: 'Masa de pizza', quantity: 1 },
      { ingredient: 'Muzzarella', quantity: 150 },
      { ingredient: 'Salsa de tomate', quantity: 80 },
      { ingredient: 'Tomate', quantity: 1 },
    ],
  },
  {
    category: 'Acompañamientos',
    name: 'Papas Fritas',
    description: 'Papas crocantes con sal de la casa.',
    price: 3200,
    image: img('1573080496219-bb080dd4f877'),
    groups: [
      sizeGroup('Tamaño', [
        ['Chico', 0],
        ['Grande', 900],
      ]),
      extrasGroup([
        ['Cheddar', 900],
        ['Bacon', 800],
      ]),
    ],
    recipe: [{ ingredient: 'Papa', quantity: 0.4 }],
  },
  {
    category: 'Acompañamientos',
    name: 'Pollo Crocante',
    description: 'Bocaditos de pollo rebozados con salsa de la casa.',
    price: 5600,
    image: img('1562967914-608f82629710'),
    groups: [
      sizeGroup('Porción', [
        ['6 unidades', 0],
        ['10 unidades', 1400],
      ]),
    ],
    recipe: [{ ingredient: 'Papa', quantity: 0.3 }],
  },
  {
    category: 'Acompañamientos',
    name: 'Ensalada Fresh',
    description: 'Mix de hojas, tomate, zanahoria y aderezo cítrico.',
    price: 4800,
    image: img('1512621776951-a57141f2eefd'),
    groups: [
      extrasGroup([
        ['Pollo', 1600],
        ['Queso', 700],
      ]),
    ],
    recipe: [
      { ingredient: 'Lechuga', quantity: 1 },
      { ingredient: 'Tomate', quantity: 1 },
    ],
  },
  {
    category: 'Bebidas',
    name: 'Gaseosa',
    description: 'Línea regular, bien fría.',
    price: 1900,
    image: img('1554866585-cd94860890b7'),
    groups: [
      sizeGroup('Tamaño', [
        ['500ml', 0],
        ['1L', 600],
      ]),
    ],
    recipe: [{ ingredient: 'Bebida cola', quantity: 1 }],
  },
  {
    category: 'Bebidas',
    name: 'Café',
    description: 'Café de especialidad, con opción a leche.',
    price: 2100,
    image: img('1509042239860-f550ce710b93'),
    groups: [
      extrasGroup([
        ['Leche', 200],
        ['Azúcar', 0],
      ]),
    ],
    recipe: [{ ingredient: 'Leche', quantity: 0.3 }],
  },
  {
    category: 'Postres',
    name: 'Helado',
    description: 'Dos bochas a elección con salsa de chocolate.',
    price: 3400,
    image: img('1560008581-09826d1de69e'),
    groups: [
      sizeGroup('Tamaño', [
        ['1 bocha', 0],
        ['2 bochas', 700],
        ['3 bochas', 1300],
      ]),
    ],
    recipe: [{ ingredient: 'Helado', quantity: 2 }],
  },
  {
    category: 'Postres',
    name: 'Milkshake',
    description: 'Cremoso, con crema batida y cereza.',
    price: 3900,
    image: img('1572490122747-3968b75cc699'),
    groups: [
      sizeGroup('Tamaño', [
        ['Chico', 0],
        ['Grande', 800],
      ]),
    ],
    recipe: [
      { ingredient: 'Helado', quantity: 2 },
      { ingredient: 'Leche', quantity: 0.25 },
    ],
  },
  {
    category: 'Postres',
    name: 'Donas',
    description: 'Media docena surtida.',
    price: 3600,
    image: img('1551024601-bec78aea704b'),
    groups: [
      sizeGroup('Cantidad', [
        ['Media docena', 0],
        ['Docena', 3200],
      ]),
    ],
    recipe: [],
  },
]

const ORDER_STATE_SEED = [
  { code: ORDER_STATUS.pending, name: 'Pendiente', order: 0 },
  { code: ORDER_STATUS.confirmed, name: 'Confirmado', order: 1 },
  { code: ORDER_STATUS.preparing, name: 'En preparación', order: 2 },
  { code: ORDER_STATUS.readyForDelivery, name: 'Listo para entregar', order: 3 },
  { code: ORDER_STATUS.onTheWay, name: 'En camino', order: 4 },
  { code: ORDER_STATUS.delivered, name: 'Entregado', order: 5 },
  { code: ORDER_STATUS.cancelled, name: 'Cancelado', order: 6 },
]

const PARAMETER_SEED = [
  { key: PARAMETER_KEYS.maxDistanceKm, value: env.seed.maxDistanceKm, unit: 'km' },
  { key: PARAMETER_KEYS.basePrepMin, value: env.seed.basePrepMin, unit: 'min' },
  { key: PARAMETER_KEYS.avgSpeedKmh, value: env.seed.avgSpeedKmh, unit: 'km/h' },
]

interface SeedSummary {
  categories: number
  ingredients: number
  products: number
  branches: number
  promotions: number
  stockRows: number
  orderStates: number
  parameters: number
}

export interface SeedResult {
  summary: SeedSummary
  branches: { id: string; name: string }[]
}

@Injectable()
export class SeedService {
  constructor(
    private readonly orderStateService: OrderStateService,
    private readonly parameterService: ParameterService,
    private readonly categoryService: CategoryService,
    private readonly ingredientService: IngredientService,
    private readonly branchService: BranchService,
    private readonly productService: ProductService,
    private readonly promotionService: PromotionService,
    private readonly stockService: StockService,
  ) {}

  async seed(): Promise<SeedResult> {
    await this.seedOrderStates()
    await this.seedParameters()

    const categories = await this.seedCategories()
    const ingredients = await this.seedIngredients()
    const branches = await this.seedBranches()
    const products = await this.seedProducts(categories, ingredients)
    const promotions = await this.seedPromotions()
    const stockRows = await this.seedStock(branches, ingredients)

    return {
      summary: {
        categories: categories.length,
        ingredients: ingredients.size,
        products: products,
        branches: branches.length,
        promotions,
        stockRows,
        orderStates: ORDER_STATE_SEED.length,
        parameters: PARAMETER_SEED.length,
      },
      branches: branches.map((branch) => ({ id: branch.id, name: branch.name })),
    }
  }

  private async seedOrderStates(): Promise<void> {
    for (const state of ORDER_STATE_SEED) {
      const existing = await this.orderStateService.findByCode(state.code)
      if (!existing) {
        await this.orderStateService.create(state)
        Logger.log(`order-state creado: ${state.code}`, 'Seed')
      }
    }
  }

  private async seedParameters(): Promise<void> {
    for (const parameter of PARAMETER_SEED) {
      const existing = await this.parameterService.findByKey(parameter.key)
      if (!existing) {
        await this.parameterService.create(parameter)
        Logger.log(`parameter creado: ${parameter.key}`, 'Seed')
      }
    }
  }

  private async seedCategories(): Promise<{ id: string; name: string }[]> {
    const { data } = await this.categoryService.list({ limit: 500, offset: 0 })
    const result: { id: string; name: string }[] = []

    for (const name of SEED_CATEGORIES) {
      const existing = data.find((category) => category.name === name)
      if (existing) {
        result.push({ id: existing.id, name: existing.name })
        continue
      }
      const created = await this.categoryService.create({ name })
      result.push({ id: created.id, name: created.name })
      Logger.log(`categoría creada: ${created.name}`, 'Seed')
    }

    return result
  }

  private async seedIngredients(): Promise<Map<string, string>> {
    const { data } = await this.ingredientService.list({ limit: 500, offset: 0 })
    const byName = new Map<string, string>()

    for (const seed of SEED_INGREDIENTS) {
      const existing = data.find((ingredient) => ingredient.name === seed.name)
      if (existing) {
        byName.set(existing.name, existing.id)
        continue
      }
      const created = await this.ingredientService.create({ name: seed.name, unit: seed.unit })
      byName.set(created.name, created.id)
      Logger.log(`ingrediente creado: ${created.name}`, 'Seed')
    }

    return byName
  }

  private async seedBranches(): Promise<{ id: string; name: string }[]> {
    const { data } = await this.branchService.list({ limit: 500, offset: 0 })
    const result: { id: string; name: string }[] = []

    for (const seed of SEED_BRANCHES) {
      const existing = data.find((branch) => branch.name === seed.name)
      if (existing) {
        result.push({ id: existing.id, name: existing.name })
        continue
      }

      const created = await this.branchService.create({
        name: seed.name,
        addressText: seed.addressText,
        latitude: seed.latitude,
        longitude: seed.longitude,
        phone: seed.phone,
      })

      await this.branchService.updateHours(created.id, [
        ...weekdayHours('09:00', '23:00'),
        { dayOfWeek: 6, opening: '10:00', closing: '23:00', closed: false },
        { dayOfWeek: 0, opening: '10:00', closing: '22:00', closed: false },
      ])

      result.push({ id: created.id, name: created.name })
      Logger.log(`sucursal creada: ${created.name}`, 'Seed')
    }

    return result
  }

  private async seedProducts(
    categories: { id: string; name: string }[],
    ingredients: Map<string, string>,
  ): Promise<number> {
    const { data } = await this.productService.list({ limit: 500, offset: 0 })
    let createdCount = 0

    for (const seed of SEED_PRODUCTS) {
      if (data.find((product) => product.name === seed.name)) {
        continue
      }

      const category = categories.find((entry) => entry.name === seed.category)
      if (!category) continue

      const product = await this.productService.create({
        categoryId: category.id,
        name: seed.name,
        description: seed.description,
        price: seed.price,
        image: seed.image,
      })

      for (const group of seed.groups) {
        const createdGroup = await this.productService.addConfigGroup(product.id, {
          name: group.name,
          type: group.type,
          required: group.required,
          min: group.min,
          max: group.max,
        })

        if (!createdGroup) continue

        for (const option of group.options) {
          await this.productService.addConfigOption(product.id, createdGroup.id, {
            name: option.name,
            extraPrice: option.extraPrice,
          })
        }
      }

      const recipe = seed.recipe
        .map((item) => {
          const ingredientId = ingredients.get(item.ingredient)
          return ingredientId ? { ingredientId, quantity: item.quantity } : null
        })
        .filter((item): item is { ingredientId: string; quantity: number } => item !== null)

      if (recipe.length > 0) {
        await this.productService.setRecipe(product.id, recipe)
      }

      createdCount += 1
      Logger.log(`producto creado: ${seed.name}`, 'Seed')
    }

    return createdCount
  }

  private async seedPromotions(): Promise<number> {
    const { data } = await this.promotionService.list({ limit: 500, offset: 0 })
    const now = Date.now()
    const seeds = [
      {
        name: 'Promo invierno',
        description: 'Promoción de temporada.',
        startDate: new Date(now),
        endDate: new Date(now + 30 * 24 * 60 * 60 * 1000),
      },
      {
        name: 'Promo especial',
        description: 'Promoción de fin de semana.',
        startDate: new Date(now),
        endDate: new Date(now + 30 * 24 * 60 * 60 * 1000),
      },
    ]

    let createdCount = 0
    for (const seed of seeds) {
      if (data.find((promotion) => promotion.name === seed.name)) continue
      await this.promotionService.create(seed)
      createdCount += 1
      Logger.log(`promoción creada: ${seed.name}`, 'Seed')
    }

    return createdCount
  }

  private async seedStock(
    branches: { id: string; name: string }[],
    ingredients: Map<string, string>,
  ): Promise<number> {
    let createdCount = 0
    const ingredientIds = [...ingredients.values()]

    for (const branch of branches) {
      const existing = await this.stockService.list(branch.id)
      const existingIngredientIds = new Set(existing.map((row) => row.ingredientId))

      for (const ingredientId of ingredientIds) {
        if (existingIngredientIds.has(ingredientId)) continue
        await this.stockService.adjust(branch.id, ingredientId, 20)
        createdCount += 1
      }
    }

    if (createdCount > 0) {
      Logger.log(`stock inicial creado: ${createdCount} filas`, 'Seed')
    }

    return createdCount
  }
}
