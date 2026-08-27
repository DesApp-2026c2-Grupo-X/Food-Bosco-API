import { Injectable } from '@nestjs/common'
import { PARAMETER_KEYS } from '../config/constants'
import { haversineDistanceKm } from '../config/geo/distance'
import { ParameterService } from '../parameter/parameter.service'
import { BranchHours, isBranchOpenNow, PublicBranch, serializeBranch } from './branch.model'
import {
  BranchListQuery,
  BranchRepository,
  CreateBranchData,
  UpdateBranchData,
} from './branch.repository'

export interface BranchListResponse {
  data: PublicBranch[]
  meta: { total: number; limit: number; offset: number }
}

@Injectable()
export class BranchService {
  constructor(
    private readonly repository: BranchRepository,
    private readonly parameterService: ParameterService,
  ) {}

  async list(query: BranchListQuery): Promise<BranchListResponse> {
    const { data, total } = await this.repository.list(query)
    return {
      data: data.map(serializeBranch),
      meta: { total, limit: query.limit, offset: query.offset },
    }
  }

  async findById(id: string): Promise<PublicBranch | null> {
    const doc = await this.repository.findById(id)
    return doc ? serializeBranch(doc) : null
  }

  async create(data: CreateBranchData): Promise<PublicBranch> {
    const doc = await this.repository.create(data)
    return serializeBranch(doc)
  }

  async update(id: string, patch: UpdateBranchData): Promise<PublicBranch | null> {
    const doc = await this.repository.update(id, patch)
    return doc ? serializeBranch(doc) : null
  }

  async setActive(id: string, active: boolean): Promise<PublicBranch | null> {
    const doc = await this.repository.setActive(id, active)
    return doc ? serializeBranch(doc) : null
  }

  async updateHours(id: string, hours: BranchHours[]): Promise<PublicBranch | null> {
    const doc = await this.repository.updateHours(id, hours)
    return doc ? serializeBranch(doc) : null
  }

  async findAvailable(latitude: number, longitude: number): Promise<PublicBranch[]> {
    const maxDistanceKm = await this.parameterService.getValue(PARAMETER_KEYS.maxDistanceKm)
    const docs = await this.repository.findActive()

    const origin = { latitude, longitude }

    return docs
      .map(serializeBranch)
      .filter((branch) => isBranchOpenNow(branch.hours))
      .filter((branch) => haversineDistanceKm(origin, branch) <= maxDistanceKm)
      .sort((a, b) => haversineDistanceKm(origin, a) - haversineDistanceKm(origin, b))
  }

  async getAvailabilityMap(branchId: string): Promise<Map<string, boolean>> {
    const docs = await this.repository.listAvailability(branchId)
    return new Map(docs.map((doc) => [doc.productId, doc.available]))
  }

  async setProductAvailability(
    branchId: string,
    productId: string,
    available: boolean,
  ): Promise<void> {
    await this.repository.upsertAvailability(branchId, productId, available)
  }
}
