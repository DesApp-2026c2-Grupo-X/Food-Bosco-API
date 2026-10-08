import { Injectable } from '@nestjs/common'
import { CommerceClient } from '../config/http/commerce.client'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import type { UpdateUserData } from './user.repository'
import { PublicUser, UserService } from './user.service'

export interface CreateStaffInput {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  branchId: string
}

@Injectable()
export class StaffOrchestrator {
  constructor(
    private readonly userService: UserService,
    private readonly commerceClient: CommerceClient,
  ) {}

  async createStaff(input: CreateStaffInput): Promise<PublicUser> {
    await this.ensureBranchExists(input.branchId)

    return this.userService.createUser({ ...input, role: ROLES.branchAdmin })
  }

  async updateUser(userId: string, patch: UpdateUserData): Promise<PublicUser | null> {
    if (patch.branchId != null) {
      await this.ensureBranchExists(patch.branchId)
    }

    return this.userService.update(userId, patch)
  }

  private async ensureBranchExists(branchId: string): Promise<void> {
    const branchExists = await this.commerceClient.branchExists(branchId)
    if (!branchExists) {
      throw new DomainException(ERROR_CODES.branchNotFound, 'Sucursal no encontrada', 404)
    }
  }
}
