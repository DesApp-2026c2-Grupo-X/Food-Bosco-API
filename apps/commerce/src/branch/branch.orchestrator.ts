import { Injectable } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { IngredientService } from '../ingredient/ingredient.service'
import type { PublicProduct } from '../product/product.model'
import { ProductService } from '../product/product.service'
import { StockService } from '../stock/stock.service'
import type { PublicBranch } from './branch.model'
import type { CreateBranchData } from './branch.repository'
import { BranchService } from './branch.service'

export interface PublicBranchProduct extends PublicProduct {
  availableInBranch: boolean
}

export interface BranchProductListResponse {
  data: PublicBranchProduct[]
}

@Injectable()
export class BranchOrchestrator {
  constructor(
    private readonly branchService: BranchService,
    private readonly productService: ProductService,
    private readonly ingredientService: IngredientService,
    private readonly stockService: StockService,
  ) {}

  async create(dto: CreateBranchData): Promise<PublicBranch> {
    const branch = await this.branchService.create(dto)
    const { data: ingredients } = await this.ingredientService.list({ limit: 500, offset: 0 })
    if (ingredients.length > 0) {
      await this.stockService.ensureStockRows(
        [branch.id],
        ingredients.map((ingredient) => ingredient.id),
      )
    }
    return branch
  }

  async listProducts(branchId: string): Promise<BranchProductListResponse> {
    await this.requireBranch(branchId)
    return this.buildProductList(branchId)
  }

  async listZoneProducts(latitude: number, longitude: number): Promise<BranchProductListResponse> {
    const branches = await this.branchService.findAvailable(latitude, longitude)
    const nearest = branches[0]
    if (!nearest) return { data: [] }
    return this.buildProductList(nearest.id)
  }

  async setProductAvailability(
    branchId: string,
    productId: string,
    available: boolean,
  ): Promise<void> {
    await this.requireBranch(branchId)

    const product = await this.productService.findById(productId)
    if (!product) {
      throw new DomainException(ERROR_CODES.productNotFound, 'Producto no encontrado', 404)
    }

    await this.branchService.setProductAvailability(branchId, productId, available)
  }

  private async buildProductList(branchId: string): Promise<BranchProductListResponse> {
    const [products, availability] = await Promise.all([
      this.productService.findAll(),
      this.branchService.getAvailabilityMap(branchId),
    ])

    const data = products.map((product) => ({
      ...product,
      availableInBranch: availability.get(product.id) ?? true,
    }))

    return { data }
  }

  private async requireBranch(branchId: string): Promise<void> {
    const branch = await this.branchService.findById(branchId)
    if (!branch) {
      throw new DomainException(ERROR_CODES.branchNotFound, 'Sucursal no encontrada', 404)
    }
  }
}
