import { Injectable } from '@nestjs/common'
import { PublicAddress, serializeAddress } from './address.model'
import { AddressRepository, CreateAddressData, UpdateAddressData } from './address.repository'

export interface AddressListResponse {
  data: PublicAddress[]
}

@Injectable()
export class AddressService {
  constructor(private readonly repository: AddressRepository) {}

  async listByUser(userId: string): Promise<AddressListResponse> {
    const docs = await this.repository.listByUser(userId)
    return { data: docs.map(serializeAddress) }
  }

  async findOwned(id: string, userId: string): Promise<PublicAddress | null> {
    const doc = await this.repository.findOwnedById(id, userId)
    return doc ? serializeAddress(doc) : null
  }

  async create(userId: string, data: CreateAddressData): Promise<PublicAddress> {
    const doc = await this.repository.create(userId, data)
    return serializeAddress(doc)
  }

  async update(id: string, userId: string, patch: UpdateAddressData): Promise<PublicAddress | null> {
    const doc = await this.repository.updateOwned(id, userId, patch)
    return doc ? serializeAddress(doc) : null
  }

  async remove(id: string, userId: string): Promise<boolean> {
    return this.repository.softDeleteOwned(id, userId)
  }
}
