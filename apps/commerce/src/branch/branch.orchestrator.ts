import { Injectable } from '@nestjs/common'
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
}
