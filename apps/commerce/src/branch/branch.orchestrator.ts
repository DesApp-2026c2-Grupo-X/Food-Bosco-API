import { Injectable } from '@nestjs/common'
import { CategoryService } from '../category/category.service'
import type { PublicProduct } from '../product/product.model'
import { ProductService } from '../product/product.service'
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
    private readonly categoryService: CategoryService,
  ) {}

  async listProducts(branchId: string): Promise<BranchProductListResponse> {
    const [products, availability, activeCategoryIds] = await Promise.all([
      this.productService.findAll(),
      this.branchService.getAvailabilityMap(branchId),
      this.categoryService.listActiveIds(),
    ])

    const data = products.map((product) => ({
      ...product,
      // El admin global gana: un producto no puede quedar disponible si está
      // desactivado globalmente, si su categoría está inactiva, o si la
      // sucursal lo pausó.
      availableInBranch:
        product.available &&
        activeCategoryIds.has(product.categoryId) &&
        (availability.get(product.id) ?? true),
    }))

    return { data }
  }

  async listZoneProducts(latitude: number, longitude: number): Promise<BranchProductListResponse> {
    const branches = await this.branchService.findAvailable(latitude, longitude)
    const nearest = branches[0]
    if (!nearest) return { data: [] }
    return this.listProducts(nearest.id)
  }
}
