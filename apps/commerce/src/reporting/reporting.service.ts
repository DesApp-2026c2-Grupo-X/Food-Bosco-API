import { Injectable } from '@nestjs/common'
import { PublicCategory, serializeCategory } from '../category/category.model'
import { PublicProduct, serializeProduct } from '../product/product.model'
import { ReportingRepository } from './reporting.repository'

export interface ProductReportRow {
  position: number
  product: PublicProduct
  category: PublicCategory | null
  quantity: number | null
  revenue: number | null
}

export interface OutOfStockRow {
  product: PublicProduct
  category: PublicCategory | null
  quantity: number
}

@Injectable()
export class ReportingService {
  constructor(private readonly repository: ReportingRepository) {}

  async bestSellers(branchId?: string): Promise<ProductReportRow[]> {
    const { products, categories, sales } = await this.loadBase(branchId)

    return products
      .map((product) => ({ product, sales: sales.get(product.id) ?? { quantity: 0, revenue: 0 } }))
      .filter((entry) => entry.sales.quantity > 0)
      .sort((a, b) => b.sales.quantity - a.sales.quantity)
      .map((entry, index) => ({
        position: index + 1,
        product: entry.product,
        category: categories.get(entry.product.categoryId) ?? null,
        quantity: entry.sales.quantity,
        revenue: null,
      }))
  }

  async leastSold(branchId?: string): Promise<ProductReportRow[]> {
    const { products, categories, sales } = await this.loadBase(branchId)

    return products
      .map((product) => ({ product, sales: sales.get(product.id) ?? { quantity: 0, revenue: 0 } }))
      .sort((a, b) => a.sales.quantity - b.sales.quantity)
      .map((entry, index) => ({
        position: index + 1,
        product: entry.product,
        category: categories.get(entry.product.categoryId) ?? null,
        quantity: entry.sales.quantity,
        revenue: null,
      }))
  }

  async highestRevenue(branchId?: string): Promise<ProductReportRow[]> {
    const { products, categories, sales } = await this.loadBase(branchId)

    return products
      .map((product) => ({ product, sales: sales.get(product.id) ?? { quantity: 0, revenue: 0 } }))
      .filter((entry) => entry.sales.revenue > 0)
      .sort((a, b) => b.sales.revenue - a.sales.revenue)
      .map((entry, index) => ({
        position: index + 1,
        product: entry.product,
        category: categories.get(entry.product.categoryId) ?? null,
        quantity: null,
        revenue: entry.sales.revenue,
      }))
  }

  async outOfStock(branchId?: string): Promise<OutOfStockRow[]> {
    const { products, categories } = await this.loadBase(branchId)
    const stock = await this.repository.listStock(branchId)
    const stockByIngredient = new Map(stock.map((entry) => [entry.ingredientId, entry.quantity]))

    const result: OutOfStockRow[] = []

    for (const product of products) {
      if (product.recipe.length === 0) {
        continue
      }
      const minQuantity = Math.min(
        ...product.recipe.map((item) => stockByIngredient.get(item.ingredientId) ?? 0),
      )
      if (minQuantity <= 0) {
        result.push({
          product,
          category: categories.get(product.categoryId) ?? null,
          quantity: 0,
        })
      }
    }

    return result
  }

  private async loadBase(branchId?: string): Promise<{
    products: PublicProduct[]
    categories: Map<string, PublicCategory>
    sales: Map<string, { quantity: number; revenue: number }>
  }> {
    const [productDocs, categoryDocs, sales] = await Promise.all([
      this.repository.listProducts(),
      this.repository.listCategories(),
      this.repository.aggregateSales(branchId),
    ])

    return {
      products: productDocs.map(serializeProduct),
      categories: new Map(
        categoryDocs.map((doc) => {
          const category = serializeCategory(doc)
          return [category.id, category]
        }),
      ),
      sales,
    }
  }
}
