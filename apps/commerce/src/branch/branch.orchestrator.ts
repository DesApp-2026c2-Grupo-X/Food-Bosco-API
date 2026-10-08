import { Injectable } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
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
  ) {}

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
