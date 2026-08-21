import { Injectable } from '@nestjs/common'
import { ERROR_CODES, RiderStatus } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { AuthClient } from '../config/http/auth.client'
import { PublicRider } from './rider.model'
import { RiderService } from './rider.service'

export interface UpdateRiderProfileInput {
  vehicle?: string | null
  phone?: string
}

@Injectable()
export class RiderOrchestrator {
  constructor(
    private readonly riderService: RiderService,
    private readonly authClient: AuthClient,
  ) {}

  async getProfile(userId: string): Promise<PublicRider> {
    return this.ensureProfile(userId)
  }

  async updateProfile(userId: string, patch: UpdateRiderProfileInput): Promise<PublicRider> {
    await this.ensureProfile(userId)
    const rider = await this.riderService.updateProfile(userId, patch)
    return rider ?? this.notFound()
  }

  async setAvailability(userId: string, online: boolean): Promise<PublicRider> {
    await this.ensureProfile(userId)
    const rider = await this.riderService.setAvailability(userId, online)
    return rider ?? this.notFound()
  }

  async updateLocation(userId: string, latitude: number, longitude: number): Promise<PublicRider> {
    await this.ensureProfile(userId)
    const rider = await this.riderService.updateLocation(userId, latitude, longitude)
    return rider ?? this.notFound()
  }

  async setStatus(userId: string, status: RiderStatus): Promise<void> {
    await this.riderService.setStatus(userId, status)
  }

  private async ensureProfile(userId: string): Promise<PublicRider> {
    const existing = await this.riderService.findByUserId(userId)
    if (existing) {
      return existing
    }

    const user = await this.authClient.getUser(userId)
    if (!user) {
      throw new DomainException(ERROR_CODES.riderNotFound, 'Repartidor no encontrado', 404)
    }

    return this.riderService.create({
      userId,
      firstName: user.firstName,
      lastName: user.lastName,
      vehicle: user.vehicle,
      phone: user.phone,
    })
  }

  private notFound(): never {
    throw new DomainException(ERROR_CODES.riderNotFound, 'Repartidor no encontrado', 404)
  }
}
