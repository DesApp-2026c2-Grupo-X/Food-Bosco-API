import { Injectable, Logger } from '@nestjs/common'
import { join } from 'node:path'
import { isDuplicateKeyError, loadSeedData } from '@repo/seed-utils'
import { PARAMETER_KEYS } from '../config/constants'
import { env } from '../config/env'
import { BranchService } from '../branch/branch.service'
import type { BranchHours } from '../branch/branch.model'
import { buildBranchHours, type HoursSchedule } from './branch-hours'
import { CategoryService } from '../category/category.service'
import { IngredientService } from '../ingredient/ingredient.service'
import { OrderStateService } from '../order-state/order-state.service'
import { ParameterService } from '../parameter/parameter.service'
import { ProductService } from '../product/product.service'
import { PromotionService } from '../promotion/promotion.service'
import { StockService } from '../stock/stock.service'

interface BranchSeed {
  name: string
  addressText: string
  latitude: number
  longitude: number
  phone?: string
  hours?: BranchHours[]
}

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

interface PromotionSeed {
  name: string
  description?: string
}

interface OrderStateSeed {
  code: string
  name: string
  order: number
}

interface ParameterSeed {
  key: string
  unit: string
}

interface CommerceSeedData {
  categories: string[]
  ingredients: { name: string; unit: string }[]
  hours: HoursSchedule
  branches: BranchSeed[]
  products: ProductSeed[]
  promotions: PromotionSeed[]
  orderStates: OrderStateSeed[]
  parameters: ParameterSeed[]
}

const DATA_DIR = join(__dirname, 'data')

const PARAMETER_VALUES: Record<string, number> = {
  [PARAMETER_KEYS.maxDistanceKm]: env.seed.maxDistanceKm,
  [PARAMETER_KEYS.basePrepMin]: env.seed.basePrepMin,
  [PARAMETER_KEYS.avgSpeedKmh]: env.seed.avgSpeedKmh,
}

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
    const data = this.loadData()

    await this.seedOrderStates(data.orderStates)
    await this.seedParameters(data.parameters)

    const categories = await this.seedCategories(data.categories)
    const ingredients = await this.seedIngredients(data.ingredients)
    const branches = await this.seedBranches(data)
    const products = await this.seedProducts(data.products, categories, ingredients)
    const promotions = await this.seedPromotions(data.promotions)
    const stockRows = await this.seedStock(branches, ingredients)

    return {
      summary: {
        categories: categories.length,
        ingredients: ingredients.size,
        products,
        branches: branches.length,
        promotions,
        stockRows,
        orderStates: data.orderStates.length,
        parameters: data.parameters.length,
      },
      branches: branches.map((branch) => ({ id: branch.id, name: branch.name })),
    }
  }

  private async seedOrderStates(orderStates: OrderStateSeed[]): Promise<void> {
    for (const state of orderStates) {
      const existing = await this.orderStateService.findByCode(state.code)
      if (existing) continue
      await this.orderStateService.upsertByCode(state)
      Logger.log(`order-state creado: ${state.code}`, 'Seed')
    }
  }

  private async seedParameters(parameters: ParameterSeed[]): Promise<void> {
    for (const parameter of parameters) {
      const existing = await this.parameterService.findByKey(parameter.key)
      if (existing) continue
      await this.parameterService.upsertByKey({
        key: parameter.key,
        value: PARAMETER_VALUES[parameter.key] ?? 0,
        unit: parameter.unit,
      })
      Logger.log(`parameter creado: ${parameter.key}`, 'Seed')
    }
  }

  private async seedCategories(names: string[]): Promise<{ id: string; name: string }[]> {
    const { data } = await this.categoryService.list({ limit: 500, offset: 0 })
    const result: { id: string; name: string }[] = []

    for (const name of names) {
      const found = data.find((category) => category.name === name)
      if (found) {
        result.push({ id: found.id, name: found.name })
        continue
      }
      const created = await this.categoryService.upsertByName(name)
      result.push({ id: created.id, name: created.name })
      Logger.log(`categoría creada: ${created.name}`, 'Seed')
    }

    return result
  }

  private async seedIngredients(
    ingredients: { name: string; unit: string }[],
  ): Promise<Map<string, string>> {
    const { data } = await this.ingredientService.list({ limit: 500, offset: 0 })
    const byName = new Map<string, string>()

    for (const seed of ingredients) {
      const existing = data.find((ingredient) => ingredient.name === seed.name)
      if (existing) {
        byName.set(existing.name, existing.id)
        continue
      }
      const created = await this.ingredientService.upsertByName(seed)
      byName.set(created.name, created.id)
      Logger.log(`ingrediente creado: ${created.name}`, 'Seed')
    }

    return byName
  }

  private async seedBranches(data: CommerceSeedData): Promise<{ id: string; name: string }[]> {
    const { data: existingBranches } = await this.branchService.list({ limit: 500, offset: 0 })
    const result: { id: string; name: string }[] = []

    for (const seed of data.branches) {
      const existing = existingBranches.find((branch) => branch.name === seed.name)
      if (existing) {
        result.push({ id: existing.id, name: existing.name })
        continue
      }

      const created = await this.branchService.upsertByName({
        name: seed.name,
        addressText: seed.addressText,
        latitude: seed.latitude,
        longitude: seed.longitude,
        phone: seed.phone,
      })

      if (created.hours.length === 0) {
        await this.branchService.updateHours(created.id, seed.hours ?? buildBranchHours(data.hours))
      }

      result.push({ id: created.id, name: created.name })
      Logger.log(`sucursal creada: ${created.name}`, 'Seed')
    }

    return result
  }

  private async seedProducts(
    products: ProductSeed[],
    categories: { id: string; name: string }[],
    ingredients: Map<string, string>,
  ): Promise<number> {
    const { data } = await this.productService.list({ limit: 500, offset: 0 })
    let createdCount = 0

    for (const seed of products) {
      if (data.find((product) => product.name === seed.name)) {
        continue
      }

      const category = categories.find((entry) => entry.name === seed.category)
      if (!category) continue

      try {
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
      } catch (error: unknown) {
        if (isDuplicateKeyError(error)) continue
        throw error
      }
    }

    return createdCount
  }

  private async seedPromotions(promotions: PromotionSeed[]): Promise<number> {
    const now = Date.now()
    const { data } = await this.promotionService.list({ limit: 500, offset: 0 })
    let createdCount = 0

    for (const seed of promotions) {
      if (data.find((promotion) => promotion.name === seed.name)) continue

      await this.promotionService.upsertByName({
        name: seed.name,
        description: seed.description,
        startDate: new Date(now),
        endDate: new Date(now + 30 * 24 * 60 * 60 * 1000),
      })
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

  private loadData(): CommerceSeedData {
    return loadSeedData<CommerceSeedData>('commerce', { baseDir: DATA_DIR })
  }
}
