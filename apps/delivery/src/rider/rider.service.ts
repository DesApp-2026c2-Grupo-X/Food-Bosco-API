import { Injectable } from '@nestjs/common'
import { RIDER_STATUS, RiderStatus } from '../config/constants'
import { PublicRider, serializeRider } from './rider.model'
import { CreateRiderData, RiderRepository, UpdateRiderProfileData } from './rider.repository'

@Injectable()
export class RiderService {
  constructor(private readonly repository: RiderRepository) {}

  async findByUserId(userId: string): Promise<PublicRider | null> {
    const doc = await this.repository.findByUserId(userId)
    return doc ? serializeRider(doc) : null
  }

  async create(data: CreateRiderData): Promise<PublicRider> {
    const doc = await this.repository.create(data)
    return serializeRider(doc)
  }

  async updateProfile(userId: string, patch: UpdateRiderProfileData): Promise<PublicRider | null> {
    const doc = await this.repository.updateProfile(userId, patch)
    return doc ? serializeRider(doc) : null
  }

  async setAvailability(userId: string, online: boolean): Promise<PublicRider | null> {
    const status = online ? RIDER_STATUS.free : RIDER_STATUS.offline
    const doc = await this.repository.setAvailability(userId, online, status)
    return doc ? serializeRider(doc) : null
  }

  async updateLocation(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<PublicRider | null> {
    const doc = await this.repository.setLocation(userId, { latitude, longitude })
    return doc ? serializeRider(doc) : null
  }

  async setStatus(userId: string, status: RiderStatus): Promise<PublicRider | null> {
    const doc = await this.repository.setStatus(userId, status)
    return doc ? serializeRider(doc) : null
  }
}
